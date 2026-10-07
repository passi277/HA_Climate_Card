// Smoke-Test der Demo-Seite im Browser: alle Karten rendern, keine Fehler,
// Moduswechsel färbt die Karte um, Bedienelemente rufen die richtigen Dienste auf.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const page = fileURLToPath(new URL("../demo/index.html", import.meta.url));
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const p = await browser.newPage({ viewport: { width: 1100, height: 1200 }, locale: "de-DE" });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const fail = (msg) => { console.error("✗", msg); process.exitCode = 1; };
const ok = (msg) => console.log("✓", msg);

await p.goto(`file://${page}`);
await p.waitForFunction(() => window.__ready, null, { timeout: 10000 });
await p.waitForTimeout(500);

const rendered = await p.evaluate(() =>
  [...document.querySelectorAll("ha-climate-card, ha-climate-overview-card, ha-light-card, ha-light-group-card, ha-cover-card, ha-cover-group-card, ha-switch-time-card, ha-media-card, ha-room-card, ha-status-card, ha-vacuum-card, ha-presence-card, ha-alert-card, ha-energy-card")].filter((c) => c.shadowRoot?.querySelector("ha-card")).length);
rendered >= 12 ? ok(`${rendered} Karten gerendert`) : fail(`nur ${rendered} Karten gerendert`);

// Regler: Tippen in die Mitte verstellt nichts, Tippen auf den Ring schon
{
  const dial = await p.evaluateHandle(() =>
    document.querySelector("#card2").shadowRoot.querySelector("hcc-climate-dial").shadowRoot.querySelector("svg"));
  await dial.scrollIntoViewIfNeeded();
  const box = await dial.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const tempCalls = () => p.evaluate(() => window.serviceCalls.filter((c) => c.service === "set_temperature").length);
  const before = await tempCalls();
  for (const [dx, dy] of [[0, 0], [box.width * 0.18, 0], [0, -box.width * 0.2]]) await p.mouse.click(cx + dx, cy + dy);
  await p.waitForTimeout(700);
  (await tempCalls()) === before ? ok("Tippen in die Reglermitte ändert nichts") : fail("Tippen in die Mitte hat den Sollwert geändert");
  const r = box.width * (82 / 200);
  const a = (200 * Math.PI) / 180;
  await p.mouse.click(cx + r * Math.cos(a), cy + r * Math.sin(a));
  await p.waitForTimeout(700);
  (await tempCalls()) === before + 1 ? ok("Tippen auf den Ring setzt den Sollwert") : fail("Tippen auf den Ring wirkt nicht");
  // Touch: Wischen über die Mitte darf scrollen, Ziehen am Ring nicht
  const prevented = await p.evaluate(({ cx, cy, r }) => {
    const svg = document.querySelector("#card2").shadowRoot.querySelector("hcc-climate-dial").shadowRoot.querySelector("svg");
    const fire = (x, y) => {
      const t = new Touch({ identifier: 1, target: svg, clientX: x, clientY: y });
      const ev = new TouchEvent("touchstart", { touches: [t], targetTouches: [t], changedTouches: [t], cancelable: true, bubbles: true });
      svg.dispatchEvent(ev);
      return ev.defaultPrevented;
    };
    return { center: fire(cx, cy), ring: fire(cx - r, cy) };
  }, { cx, cy, r });
  !prevented.center && prevented.ring ? ok("Seite scrollt über der Mitte, nicht am Ring") : fail(`Touch-Verhalten: ${JSON.stringify(prevented)}`);
}

// Fenster & Türen: mehrere Kontakte, Tür erkannt
{
  const res = await p.evaluate(() => {
    const root = document.querySelector("#card2").shadowRoot;
    return {
      banner: root.querySelector(".banner strong")?.textContent,
      chips: root.querySelectorAll(".contact").length,
      open: root.querySelectorAll(".contact.open").length,
    };
  });
  res.banner === "Tür offen" && res.chips === 3 && res.open === 1
    ? ok("3 Kontakte, offene Balkontür als „Tür offen“ gemeldet")
    : fail(`Kontakte: ${JSON.stringify(res)}`);
}

// Außentemperatur aus Wetter-Entität, Sleeptimer sichtbar
{
  const res = await p.evaluate(async () => {
    const card = document.querySelector("#card0");
    const root = card.shadowRoot;
    root.querySelector(".expand")?.click();
    await new Promise((r) => setTimeout(r, 100));
    const tiles = [...root.querySelector("hcc-sensor-row").shadowRoot.querySelectorAll(".item")]
      .map((i) => `${i.querySelector(".label").textContent}=${i.querySelector(".value").textContent}`);
    return { tiles, sleep: !!root.querySelector("hcc-sleep-timer")?.shadowRoot.querySelector(".timer") };
  });
  res.tiles.includes("Außen=19.5 °C") ? ok("Außentemperatur aus Wetter-Entität") : fail(`Kacheln: ${res.tiles.join(", ")}`);
  res.sleep ? ok("Sleeptimer-Zeile sichtbar") : fail("Sleeptimer fehlt");
}

// Sleeptimer: eigene Zeitauswahl (Stunde/Minute) statt nativem Zeitfeld
{
  const res = await p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const timer = document.querySelector("#card0").shadowRoot.querySelector("hcc-sleep-timer").shadowRoot;
    const before = window.serviceCalls.length;
    timer.querySelector("button.time").click();
    await wait(100);
    const steps = timer.querySelector("hcc-time-picker").shadowRoot.querySelectorAll(".step");
    const press = (b) => { b.dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true })); b.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); };
    press(steps[1]); press(steps[1]); press(steps[3]);
    await wait(1300);
    const calls = window.serviceCalls.slice(before).filter((c) => c.service === "set_datetime");
    return { editor: !!timer.querySelector(".editor"), calls: calls.map((c) => c.data.time) };
  });
  res.editor && res.calls.length === 1 && res.calls[0] === "01:35:00"
    ? ok("Sleeptimer-Zeit per Stunde/Minute einstellbar (23:30 → 01:35, ein Befehl)")
    : fail(`Zeitauswahl: ${JSON.stringify(res)}`);
}

// Entfeuchten: Verlauf zeigt Luftfeuchte
{
  const res = await p.evaluate(async () => {
    const card = document.querySelector("#card1");
    const bar = card.shadowRoot.querySelector("hcc-mode-bar");
    bar.shadowRoot.querySelectorAll("button")[bar.modes.findIndex((m) => m.value === "dry")].click();
    await new Promise((r) => setTimeout(r, 800));
    const g = card.shadowRoot.querySelector("hcc-history-graph");
    return { label: card.shadowRoot.querySelector(".graph-wrap .row-label").textContent, metric: g.metric,
      unit: g.shadowRoot.querySelector(".labels span:last-child")?.textContent };
  });
  res.metric === "humidity" && res.label.includes("Luftfeuchte") && res.unit?.endsWith("%")
    ? ok("Entfeuchten: Verlauf zeigt Luftfeuchte")
    : fail(`Entfeuchten-Verlauf: ${JSON.stringify(res)}`);
}

// Heizung (Homematic): Profil erkannt, Wochenprogramm, Ventile, Boost
{
  const res = await p.evaluate(async () => {
    const card = [...document.querySelectorAll("ha-climate-card")].find((c) => c._config.entity === "climate.heizung_mein_zimmer");
    const root = card.shadowRoot;
    const before = window.serviceCalls.length;
    root.querySelector(".round.boost")?.click();
    await new Promise((r) => setTimeout(r, 300));
    return {
      timeline: !!root.querySelector("hcc-schedule-timeline")?.shadowRoot.querySelector(".seg"),
      valves: root.querySelectorAll(".valve").length,
      fan: !!root.querySelector("hcc-attribute-select"),
      airflow: !!root.querySelector("hcc-airflow"),
      waves: !!root.querySelector("hcc-heat-waves"),
      boost: window.serviceCalls.slice(before).map((c) => `${c.service}:${c.data.preset_mode}`),
      pills: [...root.querySelectorAll(".pill")].map((x) => x.textContent.trim()),
    };
  });
  res.timeline && res.valves === 2 && !res.fan && !res.airflow && res.waves
    ? ok("Heizung: Wochenprogramm, 2 Ventile, Wärmewellen, keine Lüfter/Lamellen")
    : fail(`Heizung: ${JSON.stringify(res)}`);
  res.boost.includes("set_preset_mode:boost") ? ok("Boost-Button schaltet Boost") : fail(`Boost: ${res.boost}`);
  res.pills.some((t) => t.includes("Batterie")) && res.pills.some((t) => t.includes("30 %"))
    ? ok("Pills: Batterie schwach, Ventil-Durchschnitt") : fail(`Pills: ${res.pills}`);
}

// Licht: Lampen der Hue-Gruppe, Szenen ohne Doppelte, Ring setzt Helligkeit, Szene und Lampe schalten
{
  const card = p.locator("ha-light-card").first();
  await card.scrollIntoViewIfNeeded();
  const info = await p.evaluate(() => {
    const root = document.querySelector("ha-light-card").shadowRoot;
    return { lights: root.querySelectorAll("hcc-lamp-row").length, scenes: [...root.querySelectorAll(".scene")].map((b) => b.textContent.trim()) };
  });
  info.lights === 3 && info.scenes.length === 4 && !info.scenes.includes("Gäste WC Entspannen")
    ? ok("Licht: 3 Lampen aus der Gruppe, 4 Hue-Szenen (ohne Doppelte, ohne Raumnamen)")
    : fail(`Licht: ${JSON.stringify(info)}`);
  const dial = await p.evaluateHandle(() =>
    document.querySelector("ha-light-card").shadowRoot.querySelector("hcc-climate-dial").shadowRoot.querySelector("svg"));
  const box = await dial.boundingBox();
  const r = box.width * (82 / 200);
  const ang = (300 * Math.PI) / 180;
  const before = await p.evaluate(() => window.serviceCalls.length);
  await p.mouse.click(box.x + box.width / 2 + r * Math.cos(ang), box.y + box.height / 2 + r * Math.sin(ang));
  await p.waitForTimeout(500);
  await p.evaluate(() => {
    const root = document.querySelector("ha-light-card").shadowRoot;
    root.querySelector(".scene").click();
    root.querySelectorAll("hcc-lamp-row")[2].shadowRoot.querySelector(".lamp-power").click();
  });
  await p.waitForTimeout(300);
  const calls = await p.evaluate((n) => window.serviceCalls.slice(n).map((c) => `${c.domain}.${c.service}:${c.data.entity_id}:${c.data.brightness_pct ?? ""}`), before);
  calls.some((c) => c.startsWith("light.turn_on:light.gaste_wc:") && Number(c.split(":")[2]) > 50)
    ? ok("Licht: Tippen auf den Ring setzt die Helligkeit") : fail(`Ring: ${calls}`);
  calls.some((c) => c.startsWith("scene.turn_on:scene.gaste_wc_")) && calls.some((c) => c.startsWith("light.toggle:light.gaste_wc_spiegel"))
    ? ok("Licht: Szene aktiviert, einzelne Lampe geschaltet") : fail(`Szene/Lampe: ${calls}`);
}

// Govee (govee2mqtt): Segmente, Geräteschalter, durchsuchbare Szenen, „Kein Effekt“
{
  const res = await p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const card = [...document.querySelectorAll("ha-light-card")].find((c) => c._config.entity === "light.carport_2");
    const root = card.shadowRoot;
    const segs = root.querySelector("hcc-segment-strip")?.shadowRoot.querySelectorAll(".seg") ?? [];
    const switches = [...(root.querySelector("hcc-shortcut-row")?.shadowRoot.querySelectorAll(".sc span") ?? [])].map((s) => s.textContent.trim());
    const sel = root.querySelector('hcc-attribute-select[icon="mdi:auto-fix"]') ?? [...root.querySelectorAll("hcc-attribute-select")].find((x) => x.icon === "mdi:auto-fix");
    const sr = sel.shadowRoot;
    sr.querySelector(".trigger").click();
    await wait(100);
    const search = sr.querySelector(".search");
    search.value = "fire";
    search.dispatchEvent(new Event("input"));
    await wait(100);
    const options = [...sr.querySelectorAll(".option span")].map((o) => o.textContent.trim());
    const before = window.serviceCalls.length;
    sr.querySelectorAll(".option")[1].click();
    await wait(300);
    sel.shadowRoot.querySelector(".trigger").click();
    await wait(100);
    sel.shadowRoot.querySelector(".option").click();
    await wait(300);
    const calls = window.serviceCalls.slice(before).map((c) => c.data);
    return { segs: segs.length, switches, hasSearch: !!search, options, calls };
  });
  res.segs === 5 ? ok("Govee: 5 Segmente erkannt (light.carport_2 → carport_segment_00x)") : fail(`Segmente: ${res.segs}`);
  res.switches.length === 1 && res.switches[0] === "Gradient" ? ok("Govee: Gradient-Schalter (ohne Power/Request)") : fail(`Schalter: ${res.switches}`);
  res.hasSearch && res.options.length === 9 && res.options.every((o) => /fire/i.test(o))
    ? ok("Szenen-Suche filtert („fire“ → 9 Treffer)") : fail(`Suche: ${JSON.stringify(res.options)}`);
  res.calls[0]?.effect === "Fire-A" && res.calls[1] && !("effect" in res.calls[1]) && Array.isArray(res.calls[1].rgb_color)
    ? ok("Szene per Klick gewählt, „Kein Effekt“ setzt die Farbe erneut") : fail(`Effekt: ${JSON.stringify(res.calls)}`);
}

// Govee: Musik-Modi als eigener Bereich (nicht doppelt in der Effektliste), Modus wählen, „Aus“, abschaltbar
{
  const card = await p.evaluateHandle(() => [...document.querySelectorAll("ha-light-card")].find((c) => c._config?.entity === "light.carport_2"));
  await card.evaluate((c) => c.scrollIntoView({ block: "center" }));
  await p.waitForTimeout(300);
  const calls = async (fn, wait = 350) => { const n = await p.evaluate(() => window.serviceCalls.length); await card.evaluate(fn); await p.waitForTimeout(wait);
    return p.evaluate((n) => window.serviceCalls.slice(n).map((c) => c.data), n); };
  const m0 = await card.evaluate((c) => { const r = c.shadowRoot; const sel = [...r.querySelectorAll("hcc-attribute-select")].find((x) => x.icon === "mdi:auto-fix");
    return { chips: [...r.querySelectorAll(".mchip")].map((x) => x.textContent.trim()), inEffects: (sel?.options ?? []).some((o) => /^Music/.test(o.value)) }; });
  const pick = await calls((c) => [...c.shadowRoot.querySelectorAll(".mchip")].find((x) => /Energisch/.test(x.textContent)).click());
  const m1 = await card.evaluate((c) => { const r = c.shadowRoot; return { now: r.querySelector(".music-now")?.textContent.trim(), eq: !!r.querySelector(".music .eq"),
    sel: r.querySelector(".mchip.sel")?.textContent.trim(), pill: [...r.querySelectorAll(".pill")].map((x) => x.textContent.trim()).join("|") }; });
  const off = await calls((c) => c.shadowRoot.querySelector(".mchip.off").click());
  const hidden = await card.evaluate(async (c) => { c.setConfig({ ...c._config, show: { music: false } }); await new Promise((r) => setTimeout(r, 100));
    const sel = [...c.shadowRoot.querySelectorAll("hcc-attribute-select")].find((x) => x.icon === "mdi:auto-fix");
    const res = { section: !!c.shadowRoot.querySelector(".music"), inEffects: (sel?.options ?? []).some((o) => /^Music/.test(o.value)) };
    c.setConfig({ ...c._config, show: undefined }); return res; });
  m0.chips.join() === "Tag & Nacht,Energisch,Klavier,Rhythmus,Spektrum" && !m0.inEffects && pick[0]?.effect === "Music: Energic"
    && m1.now === "Energisch" && m1.eq && m1.sel === "Energisch" && /Energisch/.test(m1.pill)
    && off[0] && !("effect" in off[0]) && !hidden.section && hidden.inEffects
    ? ok("Govee-Musik: eigener Bereich mit Modi, Auswahl, läuft-Anzeige, „Aus“, per show.music abschaltbar")
    : fail(`Musik: ${JSON.stringify({ m0, pick, m1, off, hidden })}`);
}

// Licht-Gruppe: jede Lampe zeigt nur, was sie kann; Gruppenregler steuert nur dimmbare Lampen
{
  const res = await p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const root = document.querySelector("ha-light-group-card").shadowRoot;
    const caps = {};
    for (const row of root.querySelectorAll("hcc-lamp-row")) {
      row.shadowRoot.querySelector(".lamp-more")?.click();
      await wait(60);
      const fresh = row.shadowRoot;
      caps[row.dataset.entity.split(".")[1]] = {
        slider: !!fresh.querySelector(".lamp > hcc-gradient-slider"),
        more: !!fresh.querySelector(".lamp-more"),
        details: [...fresh.querySelectorAll(".lamp-details > *")].map((d) => d.icon),
        disabled: fresh.querySelector(".lamp-power").disabled,
      };
    }
    const before = window.serviceCalls.length;
    const slider = root.querySelector(".group-slider");
    slider.value = 40;
    slider.dispatchEvent(new CustomEvent("value-changed", { detail: { value: 40 } }));
    await wait(400);
    root.querySelector(".header .power").click();
    await wait(300);
    const calls = window.serviceCalls.slice(before).map((c) => ({ s: c.service, ids: [].concat(c.data.entity_id), b: c.data.brightness_pct }));
    const slider2 = [...document.querySelectorAll("ha-light-card")].find((c) => c._config.layout === "compact")
      .shadowRoot.querySelector("hcc-gradient-slider");
    const compact = slider2.shadowRoot;
    const resting = !compact.querySelector(".track.flash") && compact.querySelectorAll(".tick.lit").length > 5;
    slider2.value = slider2.value - 20;
    await wait(150);
    const flashDown = !!compact.querySelector(".track.flash.down");
    await wait(2100);
    return { caps, calls, animated: resting && flashDown && !compact.querySelector(".track.flash") };
  });
  const c = res.caps;
  c.wohnzimmer_stehlampe?.details.join() === "mdi:thermometer,mdi:palette,mdi:auto-fix"
    && c.wohnzimmer_decke?.details.join() === "mdi:thermometer"
    && c.wohnzimmer_regal?.slider && !c.wohnzimmer_regal.more
    && !c.wohnzimmer_lichterkette?.slider && !c.wohnzimmer_lichterkette.more
    && c.wohnzimmer_vitrine?.disabled && !c.wohnzimmer_vitrine.slider
    ? ok("Licht-Gruppe: Funktionen je Lampe erkannt (Farbe/Weißton/Effekt, nur Weißton, dimmbar, Ein/Aus, nicht verfügbar)")
    : fail(`Licht-Gruppe Funktionen: ${JSON.stringify(c)}`);
  const dim = res.calls.find((x) => x.b === 40);
  dim && dim.ids.length === 3 && !dim.ids.includes("light.wohnzimmer_lichterkette") && !dim.ids.includes("light.wohnzimmer_vitrine")
    ? ok("Licht-Gruppe: Gruppenregler dimmt nur dimmbare, verfügbare Lampen") : fail(`Gruppenregler: ${JSON.stringify(res.calls)}`);
  res.calls.some((x) => x.s === "turn_off" && x.ids.length >= 3) ? ok("Licht-Gruppe: Alle ausschalten") : fail(`Alle aus: ${JSON.stringify(res.calls)}`);
  res.animated ? ok("Kompakter Lichtregler: ruht, Lauflicht nur kurz nach Änderung (dunkler → nach links)") : fail("Regler-Animation nicht nur bei Änderung");
}

// Editor: nur zum Gerät passende Optionen (Heizung ohne Lüfter/Lamellen)
{
  const res = await p.evaluate(async () => {
    const hass = document.querySelector("ha-climate-card").hass;
    const names = (schema) => schema.flatMap((s) => (s.schema ? names(s.schema) : [s.name]));
    const run = async (entity, extra = {}) => {
      const ed = document.createElement("ha-climate-card-editor");
      ed.hass = hass;
      ed.setConfig({ type: "custom:ha-climate-card", entity, ...extra });
      document.body.appendChild(ed);
      await ed.updateComplete;
      const out = { names: names(ed._schema()), detected: ed.shadowRoot.querySelector(".detected")?.textContent.replace(/\s+/g, " ").trim() };
      ed.remove();
      return out;
    };
    return { heat: await run("climate.heizung_mein_zimmer", { power_sensor: "sensor.klima_power" }), ac: await run("climate.1ed763d9", { power_sensor: "sensor.klima_power" }) };
  });
  const h = res.heat.names;
  !h.includes("fan") && !h.includes("swing") && !h.includes("power_threshold") && h.includes("valve_sensors") && /Heizung/.test(res.heat.detected ?? "")
    ? ok("Editor Heizung: keine Lüfter/Lamellen/Leistungsschwelle, Heizungsfelder, „Erkannt: Heizung“")
    : fail(`Editor Heizung: ${JSON.stringify(res.heat)}`);
  const a = res.ac.names;
  a.includes("fan") && a.includes("swing") && a.includes("power_threshold") && !a.includes("valve_sensors")
    ? ok("Editor Klima: Lüfter, Lamellen, Leistungsschwelle, keine Heizungsfelder") : fail(`Editor Klima: ${JSON.stringify(res.ac)}`);
}

// Rollläden: Fenster ziehen, Schnellwahl, Fahrt-Animation, Gruppe mit gemischten Fähigkeiten
{
  const card = p.locator("ha-cover-card").first();
  await card.scrollIntoViewIfNeeded();
  const glass = await p.evaluateHandle(() =>
    document.querySelector("ha-cover-card").shadowRoot.querySelector("hcc-cover-window").shadowRoot.querySelector(".glass"));
  const box = await glass.boundingBox();
  const before = await p.evaluate(() => window.serviceCalls.length);
  await p.mouse.click(box.x + box.width / 2, box.y + box.height * 0.25);
  await p.waitForTimeout(400);
  const moving = await p.evaluate(() => {
    const root = document.querySelector("ha-cover-card").shadowRoot;
    return { window: root.querySelector("hcc-cover-window").shadowRoot.querySelector(".window").className, badge: root.querySelector(".icon-badge").dataset.moving };
  });
  await p.waitForTimeout(1800);
  const res = await p.evaluate(async (n) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const root = document.querySelector("ha-cover-card").shadowRoot;
    const after = root.querySelector(".dial-big").textContent.trim();
    root.querySelector(".pos").click();
    await wait(300);
    const g = document.querySelector("ha-cover-group-card").shadowRoot;
    const tiles = [...g.querySelectorAll("hcc-cover-tile")];
    const tops = new Set(tiles.slice(0, 2).map((t) => Math.round(t.getBoundingClientRect().top)));
    const rows = Object.fromEntries(tiles.map((r) => [r.entity.split(".")[1], {
      slider: r.shadowRoot.querySelector("hcc-cover-window").settable, buttons: r.shadowRoot.querySelectorAll(".btn").length }]));
    rows.sideBySide = tops.size === 1;
    const b2 = window.serviceCalls.length;
    const slider = g.querySelector(".group-slider");
    slider.value = 50; slider.dispatchEvent(new CustomEvent("value-changed", { detail: { value: 50 } }));
    await wait(300);
    g.querySelectorAll(".header .round")[2].click();
    await wait(200);
    const groupCalls = window.serviceCalls.slice(b2).map((c) => ({ s: c.service, ids: [].concat(c.data.entity_id), p: c.data.position }));
    const compact = [...document.querySelectorAll("ha-cover-card")].find((c) => c._config.layout === "compact").shadowRoot;
    return { after, calls: window.serviceCalls.slice(n).map((c) => `${c.service}:${c.data.entity_id}:${c.data.position ?? ""}`), rows, groupCalls,
      tilt: [...compact.querySelectorAll("hcc-gradient-slider")].some((s) => s.icon === "mdi:angle-acute") };
  }, before);
  res.calls.some((c) => /^set_cover_position:cover.rollos_pascal:7[0-9]$/.test(c)) ? ok("Rollladen: Tippen ins Fenster (oberes Viertel) → ~75 % offen")
    : fail(`Fenster: ${res.calls}`);
  /opening/.test(moving.window) && moving.badge === "opening" ? ok("Rollladen: Fahrt-Animation (Lamellen laufen, Pfeil) nur während der Fahrt")
    : fail(`Fahrt: ${JSON.stringify(moving)}`);
  res.calls.includes("set_cover_position:cover.rollos_pascal:0") ? ok("Rollladen: Schnellwahl „Zu“") : fail(`Schnellwahl: ${res.calls}`);
  const r = res.rows;
  r.schreibtisch?.slider && r.schreibtisch.buttons === 3 && !r.terrasse_markise?.slider && r.terrasse_markise.buttons === 2 && r.kuche?.buttons === 0
    && r.sideBySide
    ? ok("Rollladen-Gruppe: Kacheln nebeneinander, Funktionen je Rollladen (Position, nur Auf/Ab, nicht verfügbar)") : fail(`Gruppe: ${JSON.stringify(r)}`);
  const pos = res.groupCalls.find((c) => c.s === "set_cover_position");
  const close = res.groupCalls.find((c) => c.s === "close_cover");
  pos?.ids.length === 4 && pos.p === 50 && close?.ids.length === 5 && !close.ids.includes("cover.kuche")
    ? ok("Rollladen-Gruppe: Regler nur für Positions-Rollläden, „Alle schließen“ ohne nicht verfügbare") : fail(`Gruppenaktionen: ${JSON.stringify(res.groupCalls)}`);
  res.tilt ? ok("Raffstore: Lamellen-Regler") : fail("Lamellen-Regler fehlt");
}

// Rollladen: gleichmäßige Fahrt (Position kommt erst am Ende), Himmel nach Sonnenstand
{
  const win = () => document.querySelector("ha-cover-card").shadowRoot.querySelector("hcc-cover-window").shadowRoot;
  await p.click('[data-sun="day"]');
  await p.waitForTimeout(1500);
  const h0 = await p.evaluate((f) => eval(f)().querySelector(".shutter").getBoundingClientRect().height, `(${win})`);
  await p.evaluate(() => [...document.querySelector("ha-cover-card").shadowRoot.querySelectorAll(".cover-buttons .round")].at(-1).click());
  await p.waitForTimeout(450);
  const h1 = await p.evaluate((f) => eval(f)().querySelector(".shutter").getBoundingClientRect().height, `(${win})`);
  await p.waitForTimeout(450);
  const h2 = await p.evaluate((f) => eval(f)().querySelector(".shutter").getBoundingClientRect().height, `(${win})`);
  const full = await p.evaluate((f) => eval(f)().querySelector(".glass").getBoundingClientRect().height, `(${win})`);
  h0 < h1 && h1 < full - 2 && h1 <= h2
    ? ok(`Rollladen fährt gleichmäßig (${Math.round(h0)} → ${Math.round(h1)} → ${Math.round(h2)} px), ohne Sprung`)
    : fail(`Fahrt nicht gleichmäßig: ${h0} ${h1} ${h2} / ${full}`);
  await p.waitForTimeout(3000);
  const sky = {};
  for (const phase of ["day", "twilight", "night"]) {
    await p.click(`[data-sun="${phase}"]`);
    await p.waitForTimeout(300);
    sky[phase] = await p.evaluate((f) => { const r = eval(f)(); return {
      cls: r.querySelector(".sky").className, sun: !!r.querySelector(".sun"), moon: !!r.querySelector(".moon"), clouds: r.querySelectorAll(".cloud").length }; }, `(${win})`);
  }
  sky.day.sun && !sky.day.moon && /twilight/.test(sky.twilight.cls) && sky.night.moon && !sky.night.sun && sky.day.clouds === 1
    ? ok("Fensterblick: Sonne am Tag, Abendrot in der Dämmerung, Mond nachts, Wolken laut Wetter")
    : fail(`Himmel: ${JSON.stringify(sky)}`);
  await p.click('[data-sun="day"]');
}

// Schalter + Uhrzeit: Schalter, Zeitauswahl, Datum
{
  const res = await p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const press = (b) => { b.dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true })); b.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); };
    const [alarm, water] = [...document.querySelectorAll("ha-switch-time-card, ha-media-card, ha-room-card, ha-status-card, ha-vacuum-card")].map((c) => c.shadowRoot);
    const before = window.serviceCalls.length;
    const status = alarm.querySelector(".status").textContent.trim();
    alarm.querySelector(".switch").click();
    alarm.querySelector(".clock").click();
    await wait(100);
    const steps = alarm.querySelector("hcc-time-picker").shadowRoot.querySelectorAll(".step");
    press(steps[1]); press(steps[3]); press(steps[3]);
    await wait(1200);
    water.querySelector(".clock").click();
    await wait(100);
    const wsteps = water.querySelector("hcc-time-picker").shadowRoot.querySelectorAll(".step");
    press(wsteps[1]); press(wsteps[5]);
    await wait(1200);
    return { status, calls: window.serviceCalls.slice(before).map((c) => `${c.domain}.${c.service}:${c.data.entity_id}:${c.data.time ?? c.data.datetime ?? ""}`) };
  });
  const c = res.calls;
  /^An · in /.test(res.status) && c.includes("homeassistant.turn_off:input_boolean.wecker:")
    ? ok("Schalter + Uhrzeit: Status „An · in …“, Schalter schaltet") : fail(`Schalter: ${res.status} ${c}`);
  c.filter((x) => x.startsWith("input_datetime.set_datetime:input_datetime.wecker_zeit")).length === 1 && c.includes("input_datetime.set_datetime:input_datetime.wecker_zeit:07:40:00")
    ? ok("Schalter + Uhrzeit: Stunde/Minute einstellbar (06:30 → 07:40, ein Befehl)") : fail(`Zeit: ${c}`);
  const d = new Date(Date.now() + 2 * 86400000);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  c.includes(`input_datetime.set_datetime:input_datetime.bewaesserung_start:${date} 19:16:00`)
    ? ok("Schalter + Datum/Uhrzeit: Tag weiter, Minute in 1er-Schritten") : fail(`Datum: ${c}`);
}

// Medien: Harmony-Aktivitäten, Befehle an das richtige Gerät, Media-Player
{
  const res = await p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const [hub, bar] = [...document.querySelectorAll("ha-media-card")].map((c) => c.shadowRoot);
    const acts = [...hub.querySelectorAll(".activity")];
    const labels = acts.map((a) => a.textContent.trim());
    const active = hub.querySelector(".activity.on")?.textContent.trim();
    const nowPlaying = hub.querySelector(".np-title")?.textContent.trim();
    const before = window.serviceCalls.length;
    acts[0].click();
    await wait(50);
    const starting = !!hub.querySelector(".activity.starting");
    const press = (b) => { b.dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true })); b.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); };
    const order = [...hub.querySelector("ha-card").children].map((el) => el.className.split(" ")[0]);
    const toggleAfterVolume = order.indexOf("remote-toggle") === order.indexOf("volume") + 1 && order.indexOf("collapsible") === order.indexOf("remote-toggle") + 1;
    const chInRemote = !!hub.querySelector(".collapsible .remote .rocker");
    press(hub.querySelector(".dir.up"));
    hub.querySelector(".ok").click();
    hub.querySelector(".np-title").closest(".now").querySelector(".key.play").click();
    const slider = bar.querySelector("hcc-gradient-slider");
    slider.value = 55; slider.dispatchEvent(new CustomEvent("value-changed", { detail: { value: 55 } }));
    await wait(1200);
    hub.querySelector(".remote-toggle").click();
    await wait(50);
    const closed = !hub.querySelector(".collapsible").classList.contains("open");
    let stored = null; try { stored = localStorage.getItem("hcc-media-remote:remote.harmony_hub_wohnzimmer"); } catch {}
    hub.querySelector(".remote-toggle").click();
    return { toggleAfterVolume, chInRemote, closed, stored, labels, active, nowPlaying, starting, calls: window.serviceCalls.slice(before).map((c) => `${c.domain}.${c.service}:${c.data.activity ?? c.data.command ?? c.data.volume_level ?? ""}:${c.data.device ?? ""}`),
      after: hub.querySelector(".activity.on")?.textContent.trim() };
  });
  res.labels.join("|") === "Ps4|Atmos|PC|Smart TV" && res.active === "Smart TV" && res.nowPlaying === "Interstellar"
    ? ok("Medien: 4 Harmony-Aktivitäten (kurze Namen), aktive leuchtet, „Läuft gerade“") : fail(`Medien: ${JSON.stringify(res)}`);
  res.calls.includes("remote.turn_on:Ps4:") && res.starting && res.after === "Ps4"
    ? ok("Medien: Aktivität starten (Anzeige „startet“, danach aktiv)") : fail(`Aktivität: ${JSON.stringify(res)}`);
  res.toggleAfterVolume && res.chInRemote && res.closed && (res.stored === "0" || res.stored === null)
    ? ok("Medien: Fernbedienung direkt unter der Lautstärke ein-/ausklappbar (inkl. Kanal), Zustand wird gemerkt")
    : fail(`Fernbedienung klappen: ${JSON.stringify({ t: res.toggleAfterVolume, ch: res.chInRemote, c: res.closed, s: res.stored })}`);
  const sends = res.calls.filter((x) => x.startsWith("remote.send_command"));
  sends.some((x) => x.startsWith("remote.send_command:DirectionUp:")) && sends.some((x) => x.startsWith("remote.send_command:Select:"))
    ? ok("Medien: Steuerkreuz sendet Harmony-Befehle an das Gerät der Aktivität") : fail(`Befehle: ${sends}`);
  res.calls.includes("media_player.media_play_pause::") && res.calls.includes("media_player.volume_set:0.55:")
    ? ok("Medien: Wiedergabe/Pause und Lautstärkeregler am Media-Player") : fail(`Media-Player: ${res.calls}`);
}

// Raum-Kopf, Status, Licht-Presets
{
  const res = await p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const room = document.querySelector("ha-room-card").shadowRoot;
    const chips = [...room.querySelectorAll(".chip")].map((c) => c.dataset.key + ":" + c.textContent.trim());
    const banner = room.querySelector(".banner")?.textContent.replace(/\s+/g, " ").trim();
    const before = window.serviceCalls.length;
    room.querySelector(".banner-action").click();
    await wait(50);
    const confirmText = room.querySelector(".banner-action").textContent.trim();
    const callsAfterFirst = window.serviceCalls.length - before;
    room.querySelector(".banner-action").click();
    await wait(300);
    const status = document.querySelector("ha-status-card").shadowRoot;
    const summary = status.querySelector(".head .row-state").textContent.trim();
    const bats = [...status.querySelectorAll(".battery .b-name > span")].map((x) => x.textContent.trim());
    const door = status.querySelector(".contact ha-icon").icon;
    const light = [...document.querySelectorAll("ha-light-card")].find((c) => c._config.presets === "default").shadowRoot;
    const presets = [...light.querySelectorAll(".preset")].map((x) => (x.classList.contains("on") ? "*" : "") + x.querySelector("span").textContent.trim());
    light.querySelectorAll(".preset")[2].click();
    await wait(300);
    return { chips, banner, confirmText, callsAfterFirst, summary, bats, door, presets,
      calls: window.serviceCalls.slice(before).map((c) => `${c.domain}.${c.service}:${c.data.entity_id}:${c.data.brightness_pct ?? ""}:${c.data.color_temp_kelvin ?? ""}`) };
  });
  const keys = res.chips.map((c) => c.split(":")[0]).filter((k) => !k.startsWith("trash-")).join(",");
  keys === "light,contacts,temperature,humidity,climate,media" && res.chips[1].includes("Schreibtisch offen") && res.chips[5].includes("Smart TV")
    ? ok("Raum-Kopf: 6 Status-Chips (Licht, Fenster, Temperatur, Feuchte, Klima, TV)") : fail(`Raum-Chips: ${JSON.stringify(res.chips)}`);
  /Fenster offen – Klima läuft/.test(res.banner ?? "") && res.callsAfterFirst === 0 && res.confirmText === "Wirklich?" && res.calls.includes("climate.turn_off:climate.1ed763d9::")
    ? ok("Raum-Kopf: Hinweis „Fenster offen – Klima läuft“, „Klima aus“ erst nach Bestätigung") : fail(`Banner: ${JSON.stringify(res)}`);
  /Schwach: Heizkörperthermostat 8 %/.test(res.summary) && res.bats[0] === "Heizkörperthermostat" && res.bats.length === 4 && res.door === "mdi:door-closed"
    ? ok("Status: Batterien aus Bereich (je Gerät eine, schwächste zuerst, ohne Raumnamen), Tür erkannt") : fail(`Status: ${JSON.stringify({ s: res.summary, b: res.bats, d: res.door })}`);
  res.presets.join("|") === "Hell|*Warm|Gemütlich" && res.calls.includes("light.turn_on:light.licht_mein_zimmer:25:2200")
    ? ok("Licht-Presets: aktives Preset markiert, „Gemütlich“ setzt 25 % / 2200 K") : fail(`Presets: ${JSON.stringify({ p: res.presets, c: res.calls })}`);
}

// Light Card: Lampen der Gruppe einzeln steuerbar
{
  const res = await p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const rows = [...document.querySelector("ha-light-card").shadowRoot.querySelectorAll("hcc-lamp-row")];
    const oben = rows.find((r) => r.entity === "light.gaste_wc_oben").shadowRoot;
    const before = window.serviceCalls.length;
    const slider = oben.querySelector("hcc-gradient-slider.brightness");
    slider.value = 33;
    slider.dispatchEvent(new CustomEvent("value-changed", { detail: { value: 33 } }));
    oben.querySelector(".lamp-more").click();
    await wait(400);
    const details = [...oben.querySelectorAll(".lamp-details > *")].map((d) => d.icon);
    const spiegel = rows.find((r) => r.entity === "light.gaste_wc_spiegel").shadowRoot;
    return { details, spiegelSlider: !!spiegel.querySelector("hcc-gradient-slider.brightness"),
      calls: window.serviceCalls.slice(before).map((c) => `${c.service}:${[].concat(c.data.entity_id).join(",")}:${c.data.brightness_pct ?? ""}`) };
  });
  res.calls.length === 1 && res.calls[0] === "turn_on:light.gaste_wc_oben:33" && res.details.join() === "mdi:thermometer,mdi:palette"
    ? ok("Light Card: Lampe der Gruppe einzeln dimmbar (nur diese Lampe), ⚙ mit Weißton + Farbe")
    : fail(`Einzellampe: ${JSON.stringify(res)}`);
}

// Schalter als Button: kein Kippschalter, Tippen auf Symbol/Text schaltet
{
  const res = await p.evaluate(async () => {
    const card = [...document.querySelectorAll("ha-switch-time-card")].find((c) => c._config.switch_style === "button").shadowRoot;
    const before = window.serviceCalls.length;
    card.querySelector(".title").click();
    await new Promise((r) => setTimeout(r, 200));
    return { toggle: !!card.querySelector(".switch"), cls: card.querySelector("ha-card").className,
      calls: window.serviceCalls.slice(before).map((c) => `${c.domain}.${c.service}`) };
  });
  !res.toggle && /button-mode/.test(res.cls) && res.calls.length === 1 && /^homeassistant\.turn_(on|off)$/.test(res.calls[0])
    ? ok("Schalter als Button: nur Symbol + Text, Tippen schaltet") : fail(`Button-Modus: ${JSON.stringify(res)}`);
}

// Medien: Sleeptimer, Fernbedienung auch bei ausgeschaltetem Hub
{
  const res = await p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const card = document.querySelector("ha-media-card");
    const root = card.shadowRoot;
    const timer = root.querySelector("hcc-sleep-timer");
    const timerLabel = timer?.shadowRoot.querySelector(".label")?.textContent.trim();
    const before = window.serviceCalls.length;
    timer.shadowRoot.querySelector(".switch").click();
    await wait(200);
    const timerCall = window.serviceCalls.slice(before).map((c) => `${c.domain}.${c.service}:${c.data.entity_id}`)[0];
    root.querySelector(".header .power").click();
    await wait(400);
    const offToggle = !!root.querySelector(".remote-toggle");
    root.querySelector(".header .power").click();
    await wait(1200);
    return { timerLabel, timerCall, offToggle };
  });
  res.timerLabel === "Sleeptimer" && /^homeassistant\.turn_(on|off):input_boolean\.timer_klima_pascal$/.test(res.timerCall ?? "")
    ? ok("Medien: Sleeptimer (Schalter + Uhrzeit) in der Medienkarte") : fail(`Media-Sleeptimer: ${JSON.stringify(res)}`);
  res.offToggle ? ok("Medien: Fernbedienung auch bei ausgeschaltetem Hub ein-/ausklappbar") : fail("Fernbedienung fehlt bei Hub aus");
}

// Medien: eingeklappte Fernbedienung bleibt zu, wenn HA setConfig erneut aufruft (Konfiguration ohne layout)
{
  const res = await p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const card = document.querySelector("ha-media-card");
    const raw = { type: "custom:ha-media-card", entity: card._config.entity, media_player: card._config.media_player,
      timer_switch: card._config.timer_switch, timer_time: card._config.timer_time };
    const isOpen = () => card.shadowRoot.querySelector(".collapsible").classList.contains("open");
    if (isOpen()) card.shadowRoot.querySelector(".remote-toggle").click();
    await wait(100);
    const closed = !isOpen();
    card.setConfig({ ...raw });
    await wait(100);
    card.setConfig({ ...raw });
    await wait(100);
    const stillClosed = !isOpen();
    card.shadowRoot.querySelector(".remote-toggle").click();
    await wait(100);
    return { closed, stillClosed, reopened: isOpen() };
  });
  res.closed && res.stillClosed && res.reopened
    ? ok("Medien: Fernbedienung bleibt eingeklappt, auch wenn HA die Konfiguration neu setzt") : fail(`Einklappen: ${JSON.stringify(res)}`);
}

// Rollladen: Rollo-Timer (Schalter + Uhrzeit)
{
  const res = await p.evaluate(async () => {
    const t = document.querySelector("ha-cover-card").shadowRoot.querySelector("hcc-sleep-timer")?.shadowRoot;
    return { label: t?.querySelector(".label")?.textContent.trim(), status: t?.querySelector(".status")?.textContent.replace(/\s+/g, " ").trim(),
      icon: t?.querySelector(".badge ha-icon")?.getAttribute("icon") };
  });
  res.label === "Rollo-Timer" && /Fährt um/.test(res.status ?? "") && /timer/.test(res.icon ?? "")
    ? ok("Rollladen: Rollo-Timer mit „Fährt um …“") : fail(`Rollo-Timer: ${JSON.stringify(res)}`);
}

// Saugroboter: Raumwahl auf der Karte, Raumreinigung, Steuerung, Wartung
{
  const res = await p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const card = document.querySelector("ha-vacuum-card");
    card.scrollIntoView();
    await wait(400);
    const root = card.shadowRoot;
    const polys = root.querySelectorAll(".map-svg .room").length;
    root.querySelector('.room[data-room="22"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await wait(50);
    [...root.querySelectorAll(".room-chip")].find((x) => x.textContent.includes("Küche")).click();
    await wait(50);
    const chipsOn = [...root.querySelectorAll(".room-chip.on")].map((x) => x.textContent.trim());
    root.querySelectorAll(".repeat button")[1].click();
    await wait(50);
    const before = window.serviceCalls.length;
    root.querySelector(".clean").click();
    root.querySelector(".ctl").click();
    await wait(300);
    const calls = window.serviceCalls.slice(before).map((c) => ({ s: `${c.domain}.${c.service}`, d: c.data }));
    return { polys, chipsOn, calls, maint: root.querySelector(".maint-toggle").textContent.trim(),
      selects: [...root.querySelectorAll(".settings hcc-attribute-select")].map((x) => x.label) };
  });
  const seg = res.calls.find((c) => c.s === "vacuum.send_command");
  res.polys === 9 && res.chipsOn.join("|") === "Küche|Pascal" && seg?.d.command === "app_segment_clean"
    && JSON.stringify(seg.d.params) === JSON.stringify([{ segments: [22, 18], repeat: 2 }])
    ? ok("Saugroboter: 9 Räume auf der Karte, Auswahl per Karte + Chip, Raumreinigung (app_segment_clean, 2×)")
    : fail(`Saugroboter Räume: ${JSON.stringify(res)}`);
  res.calls.some((c) => c.s === "vacuum.pause") && /Wartung fällig: Sensorzeit/.test(res.maint)
    && res.selects.join("|") === "Saugstärke|Reinigungsmodus|Wisch-Intensität"
    ? ok("Saugroboter: Steuerung, Saugstärke + Modi vom Gerät (ohne Kartenauswahl), Wartung fällig") : fail(`Saugroboter: ${JSON.stringify(res)}`);
}

// Personen & Haustür: Handy-Akku, Halten zum Öffnen, Ring to Open, Klingel
{
  const card = await p.evaluateHandle(() => document.querySelector("ha-presence-card"));
  await card.evaluate((c) => c.scrollIntoView({ block: "center" }));
  await p.waitForTimeout(300);
  const persons = await card.evaluate((c) => [...c.shadowRoot.querySelectorAll(".person")].map((t) => ({
    cls: t.className, name: t.querySelector(".name").textContent, where: t.querySelector(".where-text").textContent,
    battery: t.querySelector(".battery")?.textContent.trim(), batteryCls: t.querySelector(".battery")?.className, avatar: t.querySelector(".avatar")?.textContent })));
  const [pa, ma] = persons;
  pa?.where === "Zuhause" && /home/.test(pa.cls) && pa.battery === "68 %" && /charging/.test(pa.batteryCls)
    && ma?.where === "Unterwegs" && /away/.test(ma.cls) && ma.battery === "15 %" && /low/.test(ma.batteryCls) && ma.avatar === "M"
    ? ok("Personen: Zuhause/Unterwegs, Handy-Akku automatisch (lädt / schwach), Initialen ohne Foto") : fail(`Personen: ${JSON.stringify(persons)}`);

  const main = await card.evaluateHandle((c) => c.shadowRoot.querySelector(".door-main"));
  const box = await main.boundingBox();
  const status = () => card.evaluate((c) => c.shadowRoot.querySelector(".door-status").textContent.trim());
  const opens = () => p.evaluate(() => window.serviceCalls.filter((c) => c.domain === "lock" && c.service === "open").length);
  const idle = await status();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(250);
  await p.mouse.up();
  await p.waitForTimeout(100);
  const short = await status();
  const afterShort = await opens();
  await p.mouse.down();
  await p.waitForTimeout(400);
  const holding = await status();
  await p.waitForTimeout(700);
  await p.mouse.up();
  await p.waitForTimeout(100);
  const done = await status();
  idle === "Halten zum Öffnen" && /Länger halten/.test(short) && afterShort === 0 && /Weiter halten/.test(holding) && done === "Geöffnet" && (await opens()) === 1
    ? ok("Haustür: kurzes Tippen öffnet nicht, Halten (0,9 s) ruft lock.open auf") : fail(`Haustür öffnen: ${JSON.stringify({ idle, short, afterShort, holding, done })}`);

  const rto = await card.evaluate(async (c) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await wait(4100); // „Geöffnet“ ausblenden lassen
    const before = window.serviceCalls.length;
    c.shadowRoot.querySelector(".door-chip").click();
    await wait(400);
    const call = window.serviceCalls.slice(before).map((x) => `${x.domain}.${x.service}`).join();
    const chip = c.shadowRoot.querySelector(".door-chip");
    const battery = !!c.shadowRoot.querySelector(".door-battery");
    // Klingeln simulieren
    const h = c.hass;
    c.hass = { ...h, states: { ...h.states, "binary_sensor.klingel_klingelaktion": { ...h.states["binary_sensor.klingel_klingelaktion"], state: "on" } } };
    await wait(100);
    const ringing = c.shadowRoot.querySelector(".door-status").textContent.trim();
    c.hass = h;
    await wait(100);
    return { call, on: chip.classList.contains("on"), pill: chip.querySelector(".pill").textContent, battery, ringing,
      rang: c.shadowRoot.querySelector(".door-status").textContent.trim() };
  });
  rto.call === "lock.unlock" && rto.on && rto.pill === "An" && rto.battery && rto.ringing === "Es klingelt!" && /^Geklingelt/.test(rto.rang)
    ? ok("Haustür: Ring to Open (lock.unlock), Batterie-Warnung, Klingeln + „Geklingelt“") : fail(`Haustür RTO/Klingel: ${JSON.stringify(rto)}`);
}

// Raum-Kopf: Müllabfuhr-Chips · Raumkacheln: Symbole, Navigation, lange drücken = Licht
{
  const res = await p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const rooms = [...document.querySelectorAll("ha-room-card")];
    const header = rooms.find((c) => c._config?.trash && c._config.layout !== "tile");
    const trash = [...header.shadowRoot.querySelectorAll('.chip[data-key^="trash-"]')].map((x) => x.textContent.trim());
    const tile = (t) => rooms.find((c) => c._config?.layout === "tile" && c._config.title === t).shadowRoot;
    const marks = (t) => [...tile(t).querySelectorAll(".mark")].map((m) => m.dataset.key.replace(/^trash-.*/, "trash"));
    const out = { trash, pascal: marks("Pascal"), pascalLit: tile("Pascal").querySelector("ha-card").classList.contains("lit"),
      wohn: marks("Wohnzimmer"), zuhause: marks("Zuhause"), sub: tile("Pascal").querySelector(".tile-sub").textContent.trim(),
      robo: tile("Saugroboter").querySelector(".tile-sub").textContent.trim() };
    const center = (t) => { const r = tile(t); const card = r.querySelector("ha-card").getBoundingClientRect(); const ic = r.querySelector(".icon-badge").getBoundingClientRect();
      return Math.abs((ic.left + ic.width / 2) - (card.left + card.width / 2)); };
    out.offCenter = Math.max(...["Pascal", "Wohnzimmer", "Bad", "Zuhause"].map(center));
    out.corners = Object.fromEntries([...tile("Wohnzimmer").querySelectorAll(".mark")].map((m) => [m.dataset.key, m.dataset.corner]));
    out.trashCorners = [...tile("Zuhause").querySelectorAll(".mark")].map((m) => m.dataset.corner);
    tile("Pascal").querySelector("ha-card").click();
    await wait(50);
    out.hash = location.hash;
    return out;
  });
  JSON.stringify(res.trash) === JSON.stringify(["Altpapier · morgen", "Restmüll · morgen"])
    ? ok("Raum-Kopf: Müllabfuhr aus dem Kalender (heute/morgen)") : fail(`Müll-Chips: ${JSON.stringify(res.trash)}`);
  res.pascalLit && res.pascal.includes("light") && res.wohn.includes("contacts") && res.wohn.includes("media")
    && res.zuhause.join() === "trash,trash" && /°C/.test(res.sub) && res.robo.length > 0 && res.hash === "#pascal"
    ? ok("Raumkacheln: Licht leuchtet, Symbole für Fenster/TV/Müll, Temperatur, Tippen navigiert") : fail(`Raumkacheln: ${JSON.stringify(res)}`);
  res.offCenter <= 2 && res.corners.contacts === "tr" && res.corners.climate === "bl" && res.corners.media === "br"
    && new Set(res.trashCorners).size === 2
    ? ok("Raumkacheln: Symbol mittig, Info-Symbole in festen Ecken (Fenster oben rechts, Klima unten links, TV unten rechts)")
    : fail(`Raumkacheln Ecken: ${JSON.stringify({ offCenter: res.offCenter, corners: res.corners, trash: res.trashCorners })}`);

  const gwc = await p.evaluateHandle(() => [...document.querySelectorAll("ha-room-card")].find((c) => c._config?.title === "Gäste WC" && c._config.layout === "tile").shadowRoot.querySelector("ha-card"));
  await gwc.evaluate((e) => e.scrollIntoView({ block: "center" }));
  const box = await gwc.boundingBox();
  const before = await p.evaluate(() => [window.serviceCalls.length, location.hash]);
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(650);
  await p.mouse.up();
  await p.waitForTimeout(100);
  const after = await p.evaluate((n) => [window.serviceCalls.slice(n).filter((c) => c.domain !== "ecovacs_goat_g1").map((c) => `${c.domain}.${c.service} ${c.data.entity_id}`), location.hash], before[0]);
  after[0].join() === "homeassistant.toggle light.gaste_wc" && after[1] === before[1]
    ? ok("Raumkachel: lange drücken schaltet das Licht (ohne zu navigieren)") : fail(`Raumkachel halten: ${JSON.stringify(after)}`);
}

// Hinweis-Karte: nur sichtbar, wenn etwas los ist
{
  const res = await p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const card = document.querySelector("ha-alert-card");
    const rows = () => [...card.shadowRoot.querySelectorAll(".row")].map((r) => r.querySelector(".title").textContent.trim() + "|" + (r.querySelector(".msg")?.textContent.trim() ?? ""));
    const h = card.hass;
    card.hass = { ...h, states: { ...h.states, "vacuum.roborock_s8_maxv_ultra": { ...h.states["vacuum.roborock_s8_maxv_ultra"], state: "cleaning" } } };
    await wait(100);
    const before = rows();
    const st = { ...h.states };
    for (const id of ["binary_sensor.buero_fenster", "binary_sensor.wz_balkontuer", "binary_sensor.wz_fenster"]) st[id] = { ...st[id], state: "off" };
    st["vacuum.roborock_s8_maxv_ultra"] = { ...st["vacuum.roborock_s8_maxv_ultra"], state: "docked" };
    let visEvent;
    card.addEventListener("card-visibility-changed", (e) => (visEvent = e.detail.value), { once: true });
    card.hass = { ...h, states: st };
    await wait(100);
    const hidden = card.hasAttribute("hidden") && getComputedStyle(card).display === "none";
    card.hass = { ...h, states: { ...st, "vacuum.roborock_s8_maxv_ultra": { ...st["vacuum.roborock_s8_maxv_ultra"], state: "error" } } };
    await wait(100);
    const back = !card.hasAttribute("hidden") && rows();
    card.hass = h;
    await wait(100);
    return { before, hidden, visEvent, back };
  });
  res.before.join() === "Fenster/Türen offen|Büro · Balkontür,Saugroboter putzt|cleaning"
    && res.hidden && res.visEvent === false && res.back?.join() === "Saugroboter hat ein Problem|error"
    ? ok("Hinweis-Karte: „Fenster/Türen offen – Büro · Balkontür“, Saugroboter; ohne Hinweis ausgeblendet") : fail(`Hinweis-Karte: ${JSON.stringify(res)}`);
}

// Licht-Gruppe: Szenen-Chips
{
  const res = await p.evaluate(async () => {
    const root = document.querySelector("ha-light-group-card").shadowRoot;
    const labels = [...root.querySelectorAll(".scene")].map((x) => x.textContent.trim());
    const before = window.serviceCalls.length;
    root.querySelector('.scene[data-scene="scene.gaste_wc_entspannen"]').click();
    await new Promise((r) => setTimeout(r, 50));
    return { labels, calls: window.serviceCalls.slice(before).map((c) => `${c.domain}.${c.service} ${c.data.entity_id}`) };
  });
  res.labels.join() === "Hell,Entspannen,Nachtlicht" && res.calls.join() === "scene.turn_on scene.gaste_wc_entspannen"
    ? ok("Licht-Gruppe: Szenen-Chips (ohne Raumnamen), Tippen ruft scene.turn_on") : fail(`Licht-Gruppe Szenen: ${JSON.stringify(res)}`);
}

// Schalter + Uhrzeit mit time.*-Entität (time.set_value)
{
  const res = await p.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const card = [...document.querySelectorAll("ha-switch-time-card")].find((c) => c._config.time_entity === "time.robo_ruhezeit_beginn");
    const root = card.shadowRoot;
    const shown = root.querySelector(".clock .time").textContent.trim();
    root.querySelector(".clock").click();
    await wait(100);
    const picker = root.querySelector("hcc-time-picker");
    const btn = picker.shadowRoot.querySelectorAll("button")[1];
    const before = window.serviceCalls.length;
    btn.click();
    await wait(1100);
    return { shown, calls: window.serviceCalls.slice(before).map((c) => `${c.domain}.${c.service} ${c.data.time ?? ""}`) };
  });
  res.shown === "22:00" && res.calls.length === 1 && /^time\.set_value \d\d:\d\d:00$/.test(res.calls[0])
    ? ok("Schalter + Uhrzeit: time.*-Entität lesen und per time.set_value setzen") : fail(`time-Entität: ${JSON.stringify(res)}`);
}

// Status: Einkaufsliste nach Batterietyp + „gewechselt vor …“
{
  const res = await p.evaluate(() => {
    const root = document.querySelector("ha-status-card").shadowRoot;
    return { shop: [...root.querySelectorAll(".shop-item .shop-qty")].map((x) => x.textContent.trim()),
      small: [...root.querySelectorAll(".b-name small")].map((x) => x.textContent.trim()) };
  });
  res.shop.join() === "2× AA" && res.small.some((x) => /2× AAA · gewechselt vor 12 Tagen/.test(x)) && res.small.some((x) => /gewechselt \d\d\/\d{4}/.test(x))
    ? ok("Status: Einkaufsliste (2× AA) und „gewechselt vor …“") : fail(`Status Einkaufsliste: ${JSON.stringify(res)}`);
}

// Status: Battery Notes als eigene Entitäten am Gerät + gedrückt halten = Wechsel eintragen
{
  const card = await p.evaluateHandle(() => [...document.querySelectorAll("ha-status-card")].find((c) => c._config.title === "Ventile"));
  await card.evaluate((c) => c.scrollIntoView({ block: "center" }));
  await p.waitForTimeout(300);
  const info = await card.evaluate((c) => {
    const root = c.shadowRoot;
    return { small: [...root.querySelectorAll(".battery")].map((b) => b.dataset.entity + "=" + (b.querySelector(".b-name small")?.textContent.trim() ?? "")),
      shop: [...root.querySelectorAll(".shop-item .shop-qty")].map((x) => x.textContent.trim()), hint: !!root.querySelector(".replace-hint") };
  });
  info.small.some((x) => /ventil_hecke_battery=4× AA · gewechselt \d\d\/\d{4}/.test(x)) && info.small.some((x) => /ventil_rasen_battery=4× AA · gewechselt vor 12 Tagen/.test(x))
    && info.shop.join() === "4× AA" && info.hint
    ? ok("Status: Battery-Notes-Entitäten am Gerät (Typ, Wechseldatum, Einkaufsliste)") : fail(`Status Battery Notes: ${JSON.stringify(info)}`);

  const before = await p.evaluate(() => window.serviceCalls.length);
  const row = await card.evaluateHandle((c) => c.shadowRoot.querySelector('.battery[data-entity="sensor.ventil_hecke_battery"]'));
  // einfacher Tipp: nur Details, kein Eintrag
  await row.click();
  await p.waitForTimeout(200);
  const afterTap = await p.evaluate((n) => window.serviceCalls.length - n, before);
  // gedrückt halten → Bestätigung → Tippen trägt ein
  const box = await row.boundingBox();
  await p.mouse.move(box.x + 20, box.y + box.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(650);
  await p.mouse.up();
  await p.waitForTimeout(100);
  const asking = await card.evaluate((c) => c.shadowRoot.querySelector(".battery.ask .ask-text")?.textContent.trim());
  const afterHold = await p.evaluate((n) => window.serviceCalls.length - n, before);
  await p.waitForTimeout(700);
  await row.click();
  await p.waitForTimeout(400);
  const calls = await p.evaluate((n) => window.serviceCalls.slice(n).map((c) => `${c.domain}.${c.service}:${c.data.entity_id}`), before);
  const small = await card.evaluate((c) => c.shadowRoot.querySelector('.battery[data-entity="sensor.ventil_hecke_battery"] .b-name small')?.textContent.trim());
  afterTap === 0 && afterHold === 0 && asking === "Tippen = Batteriewechsel eintragen" && calls.join() === "button.press:button.wasser_hecke_battery_replaced"
    && /heute gewechselt/.test(small)
    ? ok("Status: gedrückt halten + Tippen trägt Batteriewechsel ein (button.press)") : fail(`Status Wechsel: ${JSON.stringify({ afterTap, afterHold, asking, calls, small })}`);
}

// Medien: Fernseher, der nur „on“ meldet, zeigt trotzdem „Läuft gerade“ – Soundbar mit nur „on“ nicht
{
  const res = await p.evaluate(() => {
    const cards = [...document.querySelectorAll("ha-media-card")];
    const tv = cards.find((c) => c._config.entity === "media_player.bravia_schlafzimmer").shadowRoot;
    const bar = cards.find((c) => c._config.entity === "media_player.atmos").shadowRoot;
    return { title: tv.querySelector(".now .np-title")?.textContent.trim(), transport: tv.querySelectorAll(".now .transport button").length,
      icon: tv.querySelector(".now .art ha-icon")?.icon, bar: !!bar.querySelector(".now") };
  });
  res.title === "Smart TV" && res.transport === 0 && res.icon === "mdi:television-play" && !res.bar
    ? ok("Medien: „Läuft gerade“ auch bei Fernsehern, die nur „an“ melden") : fail(`Medien läuft gerade: ${JSON.stringify(res)}`);
}

// Mähroboter: Zustand, Live-Karte, Steuerung, Stopp mit Bestätigung, Wartung, Einstellungen
{
  const get = (name) => p.evaluateHandle((n) => [...document.querySelectorAll("ha-mower-card")].find((c) => c._config.name === n), name);
  const mowing = await get("GOAT Wiese");
  await mowing.evaluate((c) => c.scrollIntoView({ block: "center" }));
  await p.waitForTimeout(300);
  const a = await mowing.evaluate((c) => {
    const r = c.shadowRoot;
    return { sub: r.querySelector(".h-sub").textContent.trim(), map: !!r.querySelector(".map .m-path") && !!r.querySelector(".map .m-area") && !!r.querySelector(".map .m-arrow"),
      ctl: [...r.querySelectorAll(".ctl")].map((b) => `${b.textContent.trim()}:${b.disabled ? 0 : 1}`), progress: r.querySelector(".s-head b")?.textContent.trim(),
      session: r.querySelector(".s-stats")?.textContent.replace(/\s+/g, " ").trim(), stats: [...r.querySelectorAll(".stat b")].map((x) => x.textContent.trim()) };
  });
  a.sub === "Mäht · 42 %" && a.map && a.ctl.join() === "Mähen:0,Pause:1,Station:1,Stopp:1" && a.progress === "42 %"
    && /186 m² von 450 m²/.test(a.session) && /38 min/.test(a.session) && a.stats.join() === "1,84 ha,66 h,52"
    ? ok("Mähroboter (mäht): Zustand, Live-Karte, Fortschritt, Statistik, Tasten") : fail(`Mähroboter mäht: ${JSON.stringify(a)}`);
  const stream = await p.evaluate(() => window.serviceCalls.filter((c) => c.domain === "ecovacs_goat_g1").map((c) => `${c.service}:${c.data.entity_id}:${c.data.duration_seconds}`));
  const live = await mowing.evaluate((c) => c.shadowRoot.querySelector(".scene .live")?.textContent.trim());
  stream.length === 1 && stream[0] === "request_live_position_stream:lawn_mower.goat_wiese:120" && live === "LIVE"
    ? ok("Mähroboter: Live-Positions-Stream nur für den sichtbaren, mähenden Mäher") : fail(`Mähroboter Live-Stream: ${JSON.stringify({ stream, live })}`);

  const before = await p.evaluate(() => window.serviceCalls.length);
  await mowing.evaluate(async (c) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const btn = (t) => [...c.shadowRoot.querySelectorAll(".ctl")].find((b) => b.textContent.trim() === t);
    btn("Stopp").click(); await wait(100);
  });
  const askText = await mowing.evaluate((c) => c.shadowRoot.querySelector(".ctl.stop").textContent.trim());
  const afterAsk = await p.evaluate((n) => window.serviceCalls.length - n, before);
  await mowing.evaluate(async (c) => { c.shadowRoot.querySelector(".ctl.stop").click(); await new Promise((r) => setTimeout(r, 100));
    [...c.shadowRoot.querySelectorAll(".ctl")].find((b) => b.textContent.trim() === "Pause").click(); await new Promise((r) => setTimeout(r, 400)); });
  const calls = await p.evaluate((n) => window.serviceCalls.slice(n).map((c) => `${c.domain}.${c.service}:${c.data.entity_id}`), before);
  const after = await mowing.evaluate((c) => ({ sub: c.shadowRoot.querySelector(".h-sub").textContent.trim(),
    ctl: [...c.shadowRoot.querySelectorAll(".ctl")].map((b) => `${b.textContent.trim()}:${b.disabled ? 0 : 1}`) }));
  askText === "Sicher?" && afterAsk === 0 && calls.join() === "button.press:button.goat_wiese_stop_mowing,lawn_mower.pause:lawn_mower.goat_wiese"
    && after.sub === "Pausiert" && after.ctl[0] === "Weiter:1" && after.ctl[1] === "Pause:0"
    ? ok("Mähroboter: Stopp mit Rückfrage, Pause → „Weiter“") : fail(`Mähroboter Steuerung: ${JSON.stringify({ askText, afterAsk, calls, after })}`);

  const docked = await get("GOAT G1");
  await docked.evaluate((c) => c.scrollIntoView({ block: "center" }));
  await p.waitForTimeout(300);
  const before2 = await p.evaluate(() => window.serviceCalls.length);
  const d = await docked.evaluate(async (c) => {
    const r = c.shadowRoot;
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    const res = { sub: r.querySelector(".h-sub").textContent.trim(), bot: !!r.querySelector(".scene .bot"), charging: !!r.querySelector(".station.charging"),
      ctl: [...r.querySelectorAll(".ctl")].map((b) => `${b.textContent.trim()}:${b.disabled ? 0 : 1}`),
      blade: r.querySelector(".wear.warn .w-text small")?.textContent.trim(), update: !!r.querySelector(".update"),
      segs: [...r.querySelectorAll(".seg")].map((b) => (b.classList.contains("sel") ? "*" : "") + b.textContent.trim()),
      switches: [...r.querySelectorAll(".toggle-row")].map((b) => b.dataset.key + (b.classList.contains("on") ? "+" : "-")),
      animal: r.querySelector('.toggle-row[data-key="animal"] small')?.textContent.trim(), delay: r.querySelector(".d-val")?.textContent.trim() };
    [...r.querySelectorAll(".seg")].find((b) => b.textContent.trim() === "Gründlich").click();
    r.querySelector('.toggle-row[data-key="animal"]').click();
    r.querySelectorAll(".delay .step")[1].click();
    await wait(1500);
    res.delayAfter = r.querySelector(".d-val")?.textContent.trim();
    r.querySelector(".ctl.start").click();
    await wait(400);
    res.subAfter = r.querySelector(".h-sub").textContent.trim();
    return res;
  });
  const calls2 = await p.evaluate((n) => window.serviceCalls.slice(n).map((c) => `${c.domain}.${c.service}:${c.data.entity_id}:${c.data.option ?? c.data.value ?? ""}`), before2);
  d.sub === "In der Station · lädt" && d.bot && d.charging && d.ctl.join() === "Mähen:1,Pause:0,Station:0,Stopp:0" && d.blade === "Messer bald tauschen" && d.update
    && d.segs.join() === "Schnell,Gründlich,Kurzes Gras,*Standard,Uneben & hohes Gras" && d.switches.join() === "rain_sensor+,ai+,animal-,border+,safe-"
    && d.animal === "19:00–07:00" && d.delay === "3 h" && d.delayAfter === "3,5 h" && d.subAfter.startsWith("Mäht")
    && calls2.join() === "select.select_option:select.goat_g1_mowing_efficiency:Delicate,homeassistant.toggle:switch.goat_g1_animal_protection:,number.set_value:number.goat_g1_rain_delay:210,lawn_mower.start_mowing:lawn_mower.goat_g1:,ecovacs_goat_g1.request_live_position_stream:lawn_mower.goat_g1:"
    ? ok("Mähroboter (Station): Laden, Messer-Warnung, Update, Einstellungen, Start") : fail(`Mähroboter Station: ${JSON.stringify({ d, calls2 })}`);
}

// Mähroboter: Bereiche antippen (Karte + Liste); die große Taste startet dann nur die Bereiche (Rückfrage); Sperre für mehrere Bereiche
{
  const card = await p.evaluateHandle(() => [...document.querySelectorAll("ha-mower-card")].find((c) => c._config.name === "GOAT A1600"));
  await card.evaluate((c) => c.scrollIntoView({ block: "center" }));
  await p.waitForTimeout(300);
  const before = await p.evaluate(() => window.serviceCalls.length);
  const r = await card.evaluate(async (c) => {
    const root = c.shadowRoot;
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    const startBtn = () => root.querySelector(".ctl.start");
    const withMulti = (allowed) => {
      const id = "lawn_mower.goat_a1600";
      const st = c.hass.states[id];
      const attributes = { ...st.attributes };
      if (allowed == null) delete attributes.multi_area_allowed; else attributes.multi_area_allowed = allowed;
      c.hass = { ...c.hass, states: { ...c.hass.states, [id]: { ...st, attributes } } };
    };
    const res = { zones: [...root.querySelectorAll(".map .m-zone")].map((z) => z.dataset.area), chips: [...root.querySelectorAll(".a-chip span")].map((x) => x.textContent.trim()),
      label0: startBtn().textContent.trim(), inlineStart: !!root.querySelector(".a-start") };
    root.querySelector('.map .m-zone[data-area="2"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await wait(50);
    root.querySelector('.a-chip[data-area="3"]').click();
    await wait(50);
    res.sel = [...root.querySelectorAll(".map .m-zone.sel")].map((z) => z.dataset.area).sort().join();
    res.sum = root.querySelector(".a-sum").textContent.trim();
    res.label = startBtn().textContent.trim();
    withMulti(false);
    await wait(50);
    res.blocked = { disabled: startBtn().disabled, warn: !!root.querySelector(".a-error.warn") };
    withMulti(null);
    await wait(50);
    startBtn().click();
    await wait(50);
    res.ask = startBtn().textContent.trim();
    res.callsAfterAsk = window.serviceCalls.filter((x) => x.domain === "goat_mower" || x.domain === "lawn_mower").length;
    startBtn().click();
    await wait(400);
    res.after = { sub: root.querySelector(".h-sub").textContent.trim(), job: [...root.querySelectorAll(".map .m-zone.job")].map((z) => z.dataset.area).sort().join(),
      label: startBtn().textContent.trim() };
    return res;
  });
  const calls = await p.evaluate((n) => window.serviceCalls.slice(n).filter((c) => c.domain !== "ecovacs_goat_g1").map((c) => `${c.domain}.${c.service}:${c.data.entity_id}:${c.data.area_ids}`), before);
  const mowerCallsBefore = await p.evaluate((n) => window.serviceCalls.slice(0, n).filter((x) => x.domain === "goat_mower" || x.domain === "lawn_mower").length, before);
  r.zones.join() === "1,3,2" && r.chips.join() === "Beet,Vorgarten,Zeltplatz" && r.label0 === "Mähen" && !r.inlineStart && r.sel === "2,3" && r.sum === "2 gewählt · 88\u00a0m²"
    && r.label === "Bereiche" && r.blocked.disabled && r.blocked.warn && r.ask === "Sicher?" && r.callsAfterAsk === mowerCallsBefore
    && calls.join() === "goat_mower.mow_areas:lawn_mower.goat_a1600:2,3" && r.after.sub.startsWith("Mäht") && r.after.job === "2,3" && r.after.label === "Mähen"
    ? ok("Mähroboter: Bereiche antippen; „Mähen“ startet dann nur die Bereiche (Rückfrage), Sperre für mehrere Bereiche") : fail(`Mähroboter Bereiche: ${JSON.stringify({ r, calls, mowerCallsBefore })}`);
}

// Mähroboter: Bereich gedrückt halten → Einstellungen; Vollbild mit Zoom
{
  const card = await p.evaluateHandle(() => [...document.querySelectorAll("ha-mower-card")].find((c) => c._config.name === "GOAT A1600"));
  await card.evaluate((c) => c.scrollIntoView({ block: "center" }));
  await p.waitForTimeout(300);
  const chip = await card.evaluateHandle((c) => c.shadowRoot.querySelector('.a-chip[data-area="1"]'));
  const box = await chip.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(650);
  await p.mouse.up();
  await p.waitForTimeout(100);
  const before = await p.evaluate(() => window.serviceCalls.length);
  const r = await card.evaluate(async (c) => {
    const root = c.shadowRoot;
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    const res = { head: root.querySelector(".a-panel .p-head b")?.textContent.trim(), selAfterHold: root.querySelector('.a-chip[data-area="1"]').classList.contains("sel"),
      height: root.querySelector('.p-row[data-key="area_height"] .p-val')?.textContent.trim(), speed: root.querySelector('.p-row[data-key="area_speed"] .p-val')?.textContent.trim(),
      segs: [...root.querySelectorAll('[data-key="area_avoidance"] .seg')].map((b) => (b.classList.contains("sel") ? "*" : "") + b.textContent.trim()) };
    root.querySelectorAll('.p-row[data-key="area_height"] .step')[1].click();
    await wait(50);
    res.heightPending = root.querySelector('.p-row[data-key="area_height"] .p-val').textContent.trim();
    await wait(900);
    [...root.querySelectorAll('[data-key="area_avoidance"] .seg')].find((b) => b.textContent.trim() === "flat").click();
    await wait(300);
    root.querySelector(".full-btn").click();
    await wait(300);
    const dlg = root.querySelector("dialog.full");
    res.open = !!dlg?.open;
    const vb0 = dlg.querySelector(".map").getAttribute("viewBox");
    dlg.querySelectorAll(".f-btn")[1].click();
    await wait(100);
    res.zoomed = dlg.querySelector(".map").getAttribute("viewBox") !== vb0;
    dlg.querySelector('.map .m-zone[data-area="2"]').dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await wait(100);
    res.selInFull = [...new Set([...root.querySelectorAll(".a-chip.sel")].map((b) => b.dataset.area))].join();
    res.panelAfterTap = root.querySelector(".f-body .a-panel .p-head b")?.textContent.trim();
    dlg.querySelectorAll(".f-btn")[2].click();
    await wait(200);
    res.closed = !root.querySelector("dialog.full");
    return res;
  });
  const calls = await p.evaluate((n) => window.serviceCalls.slice(n).filter((c) => c.domain !== "ecovacs_goat_g1").map((c) => `${c.domain}.${c.service}:${c.data.entity_id}:${c.data.value ?? c.data.option}`), before);
  r.head === "Vorgarten" && !r.selAfterHold && r.height === "6\u00a0cm" && r.speed === "0,4\u00a0m/s" && r.segs.join() === "flat,*normal,tall_grass" && r.heightPending === "7\u00a0cm"
    && calls.join() === "number.set_value:number.goat_a1600_vorgarten_cutting_height:7,select.select_option:select.goat_a1600_vorgarten_avoidance_mode:flat"
    && r.open && r.zoomed && r.selInFull === "2" && r.panelAfterTap === "Zeltplatz" && r.closed
    ? ok("Mähroboter: Bereich halten → Mähhöhe/Vermeidung; Vollbild mit Zoom und Auswahl") : fail(`Mähroboter Bereichseinstellungen: ${JSON.stringify({ r, calls })}`);
}

// Energiefluss: Werte, aktive Linien, Verbraucher-Kreise, Tageswerte, Akku-Restzeit, Schalter
{
  const card = await p.evaluateHandle(() => document.querySelector("ha-energy-card"));
  await card.evaluate((c) => c.scrollIntoView({ block: "center" }));
  await p.waitForTimeout(600);
  const res = await card.evaluate(async (card) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const root = card.shadowRoot;
    const val = (k) => root.querySelector(`.n-${k} .val`)?.textContent.trim();
    const day = { solar: val("solar"), home: val("home"), grid: val("grid"), battery: val("battery"),
      batTime: root.querySelector(".n-battery .sub2")?.textContent.trim() };
    const active = [...root.querySelectorAll(".line.active")].map((l) => l.id.replace("p-", "")).sort();
    const consumers = [...root.querySelectorAll(".node.small")].map((n) => n.title + ":" + n.querySelector(".val").textContent.trim());
    const durs = [...root.querySelectorAll("animateMotion")].map((a) => parseFloat(a.getAttribute("dur")));
    const daily = [...root.querySelectorAll(".day-item")].map((x) => x.textContent.replace(/\s+/g, " ").trim());
    const sw = root.querySelector(".n-c2 .sw");
    const autarky = root.querySelector(".pill")?.textContent.trim();
    let info;
    card.addEventListener("hass-more-info", (e) => (info = e.detail.entityId), { once: true });
    root.querySelector(".n-battery").click();
    const h = card.hass;
    // Pool (0 W) ist ausgeblendet, erscheint bei Verbrauch und verschwindet bei „nicht verfügbar“ wieder
    const pool = (v) => { card.hass = { ...h, states: { ...h.states, "sensor.pool_power": { ...h.states["sensor.pool_power"], state: v } } }; };
    const poolHidden0 = !root.querySelector(".n-c3");
    pool("450"); await wait(100);
    const poolShown = !!root.querySelector(".n-c3");
    pool("unavailable"); await wait(100);
    const poolHidden = poolHidden0 && poolShown && !root.querySelector(".n-c3");
    const st = { ...h.states };
    const set = (id, v) => (st[id] = { ...st[id], state: v });
    set("sensor.solarbank_solar", "0"); set("sensor.solarbank_laden", "0"); set("sensor.solarbank_entladen", "161");
    set("sensor.smart_meter_einspeisung", "0"); set("sensor.garten_hausbedarf", "161");
    card.hass = { ...h, states: st };
    await wait(100);
    const night = [...root.querySelectorAll(".line.active")].map((l) => l.id.replace("p-", "")).filter((k) => !k.startsWith("c") && k !== "other");
    const nightTime = root.querySelector(".n-battery .sub2")?.textContent.trim();
    card.hass = h;
    await wait(100);
    return { ...day, active, consumers, durs, daily, sw: sw?.className, autarky, info, night, nightTime, poolHidden };
  });
  res.solar === "1,2 kW" && res.home === "410 W" && res.grid === "310 W" && res.battery === "81 %"
    && res.active.join() === "c0,c1,c4,other,sb,sg,sh" && res.consumers.length === 5 && res.consumers[0] === "Kühlschrank:88 W" && res.poolHidden
    && res.consumers.at(-1).startsWith("Sonstiges:") && Math.min(...res.durs) > 2.5 && /Autarkie 100/.test(res.autarky)
    && res.info === "sensor.solarbank_ladestand" && res.night.join() === "bh"
    ? ok("Energiefluss: aktive Verbraucher als Kreise (+ Sonstiges), 0 W / nicht verfügbar ausgeblendet, ruhiges Tempo, abends Batterie → Haus") : fail(`Energiefluss: ${JSON.stringify(res)}`);
  /voll \d/.test(res.batTime ?? "") && /noch/.test(res.nightTime ?? "") && res.daily.some((d) => /Solar.*kWh/.test(d)) && res.sw?.trim() === "sw"
    ? ok("Energiefluss: Akku „voll in …“ / „noch …“, Tageswerte, Schalter-Symbol am Verbraucher") : fail(`Energiefluss Extras: ${JSON.stringify(res)}`);
  // Lange drücken auf „Pumpe“ schaltet den Stecker
  const node = await card.evaluateHandle((c) => c.shadowRoot.querySelector(".n-c2"));
  const box = await node.boundingBox();
  const before = await p.evaluate(() => window.serviceCalls.length);
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.waitForTimeout(650);
  await p.mouse.up();
  await p.waitForTimeout(100);
  const calls = await p.evaluate((n) => window.serviceCalls.slice(n).map((c) => `${c.domain}.${c.service} ${c.data.entity_id}`), before);
  calls.join() === "homeassistant.toggle switch.pumpe" ? ok("Energiefluss: lange drücken auf Verbraucher schaltet den Stecker") : fail(`Verbraucher-Schalter: ${JSON.stringify(calls)}`);
  // Zusammenfassung: Pfeile/Wischen wechseln Heute → Monat → Jahr → Gesamt
  const summary = async () => card.evaluate((c) => {
    const r = c.shadowRoot;
    return { title: r.querySelector(".daily-title")?.textContent.replace(/\s+/g, " ").trim(),
      solar: [...r.querySelectorAll(".day-item")].find((x) => /Solar/.test(x.textContent))?.querySelector(".day-val")?.textContent.trim() };
  });
  const nav = async (i) => { await card.evaluate((c, i) => c.shadowRoot.querySelectorAll(".daily .nav")[i].click(), i); await p.waitForTimeout(250); };
  const s0 = await summary();
  await nav(1); const s1 = await summary();
  await nav(1); await nav(1); const s3 = await summary();
  const daily = await card.evaluateHandle((c) => c.shadowRoot.querySelector(".daily-items"));
  const db = await daily.boundingBox();
  await p.mouse.move(db.x + 20, db.y + db.height / 2); await p.mouse.down();
  await p.mouse.move(db.x + 140, db.y + db.height / 2, { steps: 5 }); await p.mouse.up();
  await p.waitForTimeout(250);
  const s2 = await summary();
  const kwh = (v) => parseFloat((v ?? "").replace(/\./g, "").replace(",", ".")) * (/MWh/.test(v ?? "") ? 1000 : /kWh/.test(v ?? "") ? 1 : 0.001);
  const month = new Date().toLocaleDateString("de", { month: "long" }).toUpperCase();
  /Heute/i.test(s0.title) && s1.title.toUpperCase().includes(month) && /Gesamt.*seit/i.test(s3.title) && s2.title.includes(String(new Date().getFullYear()))
    && kwh(s3.solar) > kwh(s2.solar) && kwh(s2.solar) >= kwh(s1.solar) && kwh(s1.solar) >= kwh(s0.solar)
    ? ok("Energiefluss: Zusammenfassung Heute → Monat → Jahr → Gesamt per Pfeil und Wischen") : fail(`Zusammenfassung: ${JSON.stringify({ s0, s1, s2, s3 })}`);
}

// Pool: Becken, Wasserwerte mit Bereich, Hinweis, Laufzeit, Verlauf, Modus, Ziel-Laufzeit, Pflege, Rückspülen, Rückgespült, Auto-Aus
{
  const card = await p.evaluateHandle(() => document.querySelector("ha-pool-card"));
  await card.evaluate((c) => c.scrollIntoView({ block: "center" }));
  await p.waitForTimeout(400);
  const calls = async (fn, wait = 300) => { const n = await p.evaluate(() => window.serviceCalls.length); await card.evaluate(fn); await p.waitForTimeout(wait);
    return p.evaluate((n) => window.serviceCalls.slice(n).map((c) => `${c.domain}.${c.service} ${c.data.entity_id ?? ""}${c.data.option ? " " + c.data.option : ""}${c.data.value != null ? " " + c.data.value : ""}`.trim()), n); };
  const r0 = await card.evaluate((c) => { const r = c.shadowRoot; const t = (s) => r.querySelector(s)?.textContent.replace(/\s+/g, " ").trim();
    return { sub: t(".h-sub"), q: t(".q"), basin: t(".b-temp"), pump: t(".b-pump"), bubbles: r.querySelectorAll(".bubbles span").length,
      metrics: [...r.querySelectorAll(".metric")].map((m) => `${m.querySelector(".m-val").textContent.trim()}|${m.querySelector(".m-status").textContent.trim()}`),
      guide: r.querySelector(".guide")?.className, guideText: t(".g-text b"), runtime: t(".rt-goal"), ring: t(".ring-in") }; });
  await card.evaluate((c) => c.shadowRoot.querySelector(".metric.m-ph").click());
  await p.waitForTimeout(500);
  const hist = await card.evaluate((c) => ({ title: c.shadowRoot.querySelector(".hist-head span")?.textContent.trim(), path: !!c.shadowRoot.querySelector(".hist .spark path"), band: !!c.shadowRoot.querySelector(".hist .spark .band") }));
  const mode = await calls((c) => [...c.shadowRoot.querySelectorAll(".mode")].find((b) => b.textContent.trim() === "Solar-Automatik").click());
  await card.evaluate((c) => c.shadowRoot.querySelector(".t-row").click());
  await p.waitForTimeout(150);
  const target = await calls((c) => { const r = c.shadowRoot; r.querySelector(".ed-chip:nth-child(4)").click(); }, 200);
  const rec = await calls((c) => c.shadowRoot.querySelector(".rec").click(), 200);
  await card.evaluate((c) => c.shadowRoot.querySelector(".care .sec-head").click());
  await p.waitForTimeout(150);
  const care = await card.evaluate((c) => [...c.shadowRoot.querySelectorAll(".care-row .cr-text span")].map((x) => x.textContent.trim()));
  const backwash = await calls((c) => c.shadowRoot.querySelector(".mt-btn.backwash").click());
  const bwState = await card.evaluate((c) => { const b = c.shadowRoot.querySelector(".mt-btn.backwash"); return `${b.classList.contains("active")}|${b.querySelector("small").textContent.trim()}`; });
  const done1 = await calls((c) => c.shadowRoot.querySelector(".done").click(), 100);
  const done2 = await calls((c) => c.shadowRoot.querySelector(".done").click());
  const autoOff = await calls((c) => c.shadowRoot.querySelector(".toggle-row").click());
  const pump = await calls((c) => c.shadowRoot.querySelector(".b-pump").click());
  r0.sub === "Filter läuft · 64 W · Automatik" && r0.q === "prüfen" && r0.basin === "24,6°C perfekt" && r0.pump === "64 W" && r0.bubbles === 8
    && r0.metrics.join() === "24,6 °C|perfekt,6,92|ok,688 mV|optimal" && /bad/.test(r0.guide) && r0.guideText === "Handlungsbedarf"
    && /^von 6 h/.test(r0.runtime) && r0.ring === "2,1h" && hist.title === "pH · 48 h" && hist.path && hist.band
    && mode.join() === "input_select.select_option input_select.pool_modus Solar-Automatik"
    && target.join() === "input_number.set_value input_number.pool_ziel 8" && rec.join() === "input_number.set_value input_number.pool_ziel 9"
    && care[0] === "pH zu niedrig – 310 g pH-Plus" && care[1] === "Chlor / Redox optimal" && /^Heute 9 h laufen lassen/.test(care[2])
    && backwash.join() === "script.turn_on script.pool_rueckspuelen_start" && /^true\|noch [23]:\d\d$/.test(bwState)
    && done1.length === 0 && done2.join() === "button.press button.pool_rueckgespuelt" && autoOff.join() === "homeassistant.toggle input_boolean.pool_auto_aus"
    && pump.join() === "homeassistant.turn_off switch.poolpumpe"
    ? ok("Pool: Becken + Pumpe, Wasserwerte mit Bereich, Hinweis, Laufzeit, 48-h-Verlauf, Modus, Ziel-Laufzeit, Pflege, Rückspülen mit Countdown, Rückgespült (Rückfrage), Auto-Aus")
    : fail(`Pool: ${JSON.stringify({ r0, hist, mode, target, rec, care, backwash, bwState, done1, done2, autoOff, pump })}`);
}

// Kameras: Einzelkarte (Reolink) und Gruppe (Blink)
{
  const cam = await p.evaluateHandle(() => document.querySelector("ha-camera-card"));
  await cam.evaluate((c) => c.scrollIntoView({ block: "center" }));
  await p.waitForTimeout(400);
  const view = await cam.evaluateHandle((c) => c.shadowRoot.querySelector("hcc-camera-view").shadowRoot);
  const calls = async (fn, wait = 300) => { const n = await p.evaluate(() => window.serviceCalls.length); await view.evaluate(fn); await p.waitForTimeout(wait);
    return p.evaluate((n) => window.serviceCalls.slice(n).map((c) => `${c.domain}.${c.service} ${c.data.entity_id ?? ""}${c.data.option ? " " + c.data.option : ""}`.trim()), n); };
  const r0 = await view.evaluate((r) => ({ name: r.querySelector(".cam-name")?.textContent.trim(), alert: r.querySelector(".frame").classList.contains("alert"),
    badges: [...r.querySelectorAll(".badge")].map((b) => b.textContent.trim()).filter(Boolean), dets: [...r.querySelectorAll(".det")].map((d) => `${d.textContent.trim()}:${d.classList.contains("on")}`),
    acts: [...r.querySelectorAll(".act span")].map((a) => a.textContent.trim()), presets: r.querySelectorAll(".preset").length, ptz: r.querySelectorAll(".ptz button").length,
    lenses: [...r.querySelectorAll(".lens")].map((l) => l.textContent.trim()), img: r.querySelector("img.media")?.src.startsWith("data:image/svg") }));
  const light = await calls((r) => [...r.querySelectorAll(".act")].find((a) => /Licht/.test(a.textContent)).click());
  const siren1 = await calls((r) => r.querySelector(".act.siren").click(), 100);
  const asked = await view.evaluate((r) => r.querySelector(".act.siren").textContent.trim());
  const siren2 = await calls((r) => r.querySelector(".act.siren").click());
  const preset = await calls((r) => [...r.querySelectorAll(".preset")].find((b) => b.textContent.trim() === "Pool").click());
  const ptz = await calls((r) => r.querySelector(".ptz .p-left").click());
  const home = await calls((r) => [...r.querySelectorAll(".act")].find((a) => /Start/.test(a.textContent)).click());
  await view.evaluate((r) => r.querySelectorAll(".lens")[1].click());
  await p.waitForTimeout(200);
  const tele = await view.evaluate((r) => decodeURIComponent(r.querySelector("img.media").src).includes("HAUS TELE"));
  r0.name === "Haus" && r0.alert && r0.badges.join() === "86 %,12°" && r0.dets.join() === "Person:true,Fahrzeug:false,Tier:false,Bewegung:true"
    && r0.acts.join() === "Licht,Sirene,Erkennung,Tracking,Start,Patrouille" && r0.presets === 5 && r0.ptz === 5 && r0.lenses.join() === "Weitwinkel,Tele" && r0.img
    && light.join() === "homeassistant.toggle light.cam_haus_scheinwerfer" && siren1.length === 0 && /Sicher/.test(asked) && siren2.join() === "siren.turn_on siren.cam_haus_sirene"
    && preset.join() === "select.select_option select.cam_haus_ptz_voreinstellung Pool" && ptz.join() === "button.press button.cam_haus_ptz_links"
    && home.join() === "button.press button.cam_haus_gehe_zu_startposition" && tele
    ? ok("Kamera: Funktionen über das Gerät erkannt (Erkennung, Akku, Licht, Sirene mit Rückfrage, Positionen, Schwenken, Start, Tele-Linse)")
    : fail(`Kamera: ${JSON.stringify({ r0, light, siren1, asked, siren2, preset, ptz, home, tele })}`);

  const grp = await p.evaluateHandle(() => document.querySelector("ha-camera-group-card"));
  await grp.evaluate((c) => c.scrollIntoView({ block: "center" }));
  await p.waitForTimeout(300);
  const gcalls = async (fn, wait = 300) => { const n = await p.evaluate(() => window.serviceCalls.length); await grp.evaluate(fn); await p.waitForTimeout(wait);
    return p.evaluate((n) => window.serviceCalls.slice(n).map((c) => `${c.domain}.${c.service} ${c.data.entity_id ?? ""}`.trim()), n); };
  const g0 = await grp.evaluate((c) => { const r = c.shadowRoot; return { sub: r.querySelector(".h-sub").textContent.replace(/\s+/g, " ").trim(),
    tiles: [...r.querySelectorAll(".tile")].map((t) => `${t.querySelector(".t-name").textContent.trim()}${t.classList.contains("motion") ? "!" : ""}${t.querySelector(".t-warn") ? "B" : ""}${t.querySelector(".t-off") ? "x" : ""}`),
    chips: [...r.querySelectorAll(".sw-chip")].map((x) => `${x.textContent.trim()}:${x.classList.contains("on")}`) }; });
  await grp.evaluate((c) => c.shadowRoot.querySelector('.tile[data-cam="camera.blink_tor"]').click());
  await p.waitForTimeout(300);
  const opened = await grp.evaluate((c) => c.shadowRoot.querySelector(".open-view .ov-head span")?.textContent.trim());
  const dis1 = await gcalls((c) => [...c.shadowRoot.querySelectorAll(".arm-btn")][1].click(), 100);
  const dis2 = await gcalls((c) => [...c.shadowRoot.querySelectorAll(".arm-btn")][1].click());
  const arm = await gcalls((c) => [...c.shadowRoot.querySelectorAll(".arm-btn")][0].click());
  const sw = await gcalls((c) => [...c.shadowRoot.querySelectorAll(".sw-chip")].find((x) => /Pool/.test(x.textContent)).click());
  await grp.evaluate((c) => c.shadowRoot.querySelector(".health .sec-head").click());
  await p.waitForTimeout(150);
  const health = await grp.evaluate((c) => [...c.shadowRoot.querySelectorAll(".h-row")].map((r) => r.textContent.replace(/\s+/g, " ").trim()));
  g0.sub === "4 Kameras · scharf · 1× Bewegung · 1× Akku schwach · Carport" && g0.tiles.join() === "Carport!,Tor,Poolx,SchuppenB"
    && g0.chips.join() === "Carport:true,Tor:true,Pool:false,Schuppen:true" && opened === "Tor"
    && dis1.length === 0 && dis2.join() === "alarm_control_panel.alarm_disarm alarm_control_panel.blink_garten" && arm.join() === "alarm_control_panel.alarm_arm_away alarm_control_panel.blink_garten"
    && sw.join() === "homeassistant.toggle switch.blink_pool_bewegungserkennung_der_kamera" && health.length === 4 && /schwach/.test(health.join())
    ? ok("Kameragruppe: Raster (Bewegung zuerst, Akku, Erkennung aus), aufklappen, Scharf/Unscharf mit Rückfrage, Erkennung je Kamera, Zustand")
    : fail(`Kameragruppe: ${JSON.stringify({ g0, opened, dis1, dis2, arm, sw, health })}`);
}

// Auswahl-Karte: Leiste, Chips mit Rückfrage, Kacheln, Dropdown, nicht verfügbar
{
  const card = await p.evaluateHandle(() => document.querySelector("ha-select-card"));
  await card.evaluate((c) => c.scrollIntoView({ block: "center" }));
  await p.waitForTimeout(300);
  const calls = async (h, fn, wait = 300) => { const n = await p.evaluate(() => window.serviceCalls.length); await h.evaluate(fn); await p.waitForTimeout(wait);
    return p.evaluate((n) => window.serviceCalls.slice(n).map((c) => `${c.domain}.${c.service} ${c.data.entity_id} ${c.data.option}`), n); };
  const row = (id) => `.row[data-entity="${id}"]`;
  const r0 = await card.evaluate((c, rows) => { const r = c.shadowRoot; return {
    layouts: [...r.querySelectorAll(".row")].map((x) => [...x.classList].find((k) => k.startsWith("l-"))),
    segSel: r.querySelector(`${rows[0]} .seg.sel`)?.textContent.trim(), icons: [...r.querySelectorAll(`${rows[0]} .seg ha-icon`)].map((i) => i.icon),
    disabled: [...r.querySelectorAll(`${rows[1]} button.seg`)].every((b) => b.disabled) }; }, [row("input_select.bewaesserung_modus"), row("select.defekter_modus")]);
  const seg = await calls(card, (c) => [...c.shadowRoot.querySelectorAll('.row[data-entity="input_select.jahreszeit"] .seg')].find((b) => /Winter/.test(b.textContent)).click());
  const segAfter = await card.evaluate((c) => c.shadowRoot.querySelector('.row[data-entity="input_select.jahreszeit"] .seg.sel')?.textContent.trim());
  const ask1 = await calls(card, (c) => [...c.shadowRoot.querySelectorAll('.row[data-entity="input_select.pool_modus"] .chip')].find((b) => /^Aus$/.test(b.textContent.trim())).click(), 100);
  const asked = await card.evaluate((c) => c.shadowRoot.querySelector('.row[data-entity="input_select.pool_modus"] .chip.ask')?.textContent.trim());
  const ask2 = await calls(card, (c) => c.shadowRoot.querySelector('.row[data-entity="input_select.pool_modus"] .chip.ask').click());
  const tile = await calls(card, (c) => [...c.shadowRoot.querySelectorAll(".tile")].find((b) => /Zuhause/.test(b.textContent)).click());
  const dd = await p.evaluateHandle(() => document.querySelectorAll("ha-select-card")[1]);
  await dd.evaluate((c) => c.shadowRoot.querySelector(".dd-btn").click());
  await p.waitForTimeout(150);
  const opened = await dd.evaluate((c) => c.shadowRoot.querySelectorAll(".dd .li").length);
  const pick = await calls(dd, (c) => [...c.shadowRoot.querySelectorAll(".dd .li")].find((b) => /gestartet/.test(b.textContent)).click());
  const closed = await dd.evaluate((c) => ({ list: !!c.shadowRoot.querySelector(".dd .list"), btn: c.shadowRoot.querySelector(".dd-btn").textContent.trim() }));
  r0.layouts.join() === "l-segment,l-chips,l-segment,l-tiles,l-segment" && r0.segSel === "Automatik" && r0.icons.join() === "mdi:power,mdi:robot,mdi:auto-fix" && r0.disabled
    && seg.join() === "input_select.select_option input_select.jahreszeit Winter" && segAfter === "Winter"
    && ask1.length === 0 && asked === "Sicher?" && ask2.join() === "input_select.select_option input_select.pool_modus Aus"
    && tile.join() === "input_select.select_option input_select.pascal_dashboard Zuhause" && opened === 3
    && pick.join() === "input_select.select_option input_select.bewaesserung_rasen_status gestartet" && !closed.list && closed.btn === "gestartet"
    ? ok("Auswahl: Leiste, Chips mit Rückfrage, Kacheln, Dropdown, Symbole automatisch, nicht verfügbar gesperrt")
    : fail(`Auswahl: ${JSON.stringify({ r0, seg, segAfter, ask1, asked, ask2, tile, opened, pick, closed })}`);
}
{
  const up = await p.evaluateHandle(() => document.querySelectorAll("ha-select-card")[2]);
  const before = await up.evaluate((c) => ({ chev: c.shadowRoot.querySelector(".chev").classList.contains("up"), list: !!c.shadowRoot.querySelector(".list") }));
  await up.evaluate((c) => c.shadowRoot.querySelector(".dd-btn").click());
  await p.waitForTimeout(150);
  const open = await up.evaluate((c) => { const dd = c.shadowRoot.querySelector(".dd"); const kids = [...dd.children].map((e) => e.className.split(" ")[0]);
    return { up: dd.classList.contains("up"), order: kids.join(","), chev: c.shadowRoot.querySelector(".chev").classList.contains("up"), items: dd.querySelectorAll(".li").length }; });
  const n0 = await p.evaluate(() => window.serviceCalls.length);
  await up.evaluate((c) => [...c.shadowRoot.querySelectorAll(".dd .li")].find((b) => !b.classList.contains("sel")).click());
  await p.waitForTimeout(300);
  const pick = await p.evaluate((n) => window.serviceCalls.slice(n).map((c) => `${c.domain}.${c.service} ${c.data.entity_id} ${c.data.option}`), n0);
  const after = await up.evaluate((c) => ({ list: !!c.shadowRoot.querySelector(".list"), up: c.shadowRoot.querySelector(".dd").classList.contains("up") }));
  before.chev && !before.list && open.up && open.order === "list,dd-btn" && !open.chev && open.items === 2
    && pick.length === 1 && pick[0].startsWith("input_select.select_option input_select.pascal_dashboard") && !after.list && !after.up
    ? ok("Auswahl: Dropdown öffnet nach oben (Liste vor dem Knopf), schließt nach Wahl")
    : fail(`Dropdown nach oben: ${JSON.stringify({ before, open, pick, after })}`);
}

// Bewässerung: parallele Stränge, Sonstiges, Ventil direkt schalten, Start/Pause/Stopp, Sperre ohne Pumpe, Modus
{
  const card = await p.evaluateHandle(() => document.querySelector("ha-irrigation-card"));
  await card.evaluate((c) => c.scrollIntoView({ block: "center" }));
  await p.waitForTimeout(400);
  const read = () => card.evaluate((c) => {
    const r = c.shadowRoot;
    return { sub: r.querySelector(".h-sub")?.textContent.replace(/\s+/g, " ").trim(),
      v: [...r.querySelectorAll(".pipe.v")].map((x) => x.classList.contains("flow")), trunk: r.querySelector(".pipe.trunk").classList.contains("flow"),
      cols: [...r.querySelectorAll(".col")].map((z) => [z.querySelector(".z-name").textContent.trim(), z.querySelector(".z-l1").textContent.trim(), z.querySelector(".z-l2").textContent.trim()].join("|")),
      play: [...r.querySelectorAll(".ctl.play")].map((b) => b.disabled), mode: r.querySelector(".mode.sel")?.textContent.trim(), hint: !!r.querySelector(".hint") };
  });
  const calls = async (fn, arg) => { const n = await p.evaluate(() => window.serviceCalls.length); await card.evaluate(fn, arg); await p.waitForTimeout(300);
    return p.evaluate((n) => window.serviceCalls.slice(n).map((c) => `${c.domain}.${c.service} ${[].concat(c.data.entity_id).join()}${c.data.duration ? " " + c.data.duration : ""}${c.data.option ? " " + c.data.option : ""}`), n); };
  const setStates = (patch) => card.evaluate((c, patch) => { const st = { ...c.hass.states }; for (const [id, v] of Object.entries(patch)) st[id] = { ...st[id], state: v }; c.hass = { ...c.hass, states: st }; }, patch);
  const r0 = await read();
  const start = await calls((c) => c.shadowRoot.querySelector('.zone[data-zone="1"] .ctl.play').click());
  const r1 = await read();
  const pause = await calls((c) => c.shadowRoot.querySelector('.zone[data-zone="0"] .ctl:not(.stop)').click());
  const r2 = await read();
  const stop = await calls((c) => c.shadowRoot.querySelector('.zone[data-zone="0"] .ctl.stop').click());
  const stop1 = await calls((c) => c.shadowRoot.querySelector('.zone[data-zone="1"] .ctl.stop').click());
  // Tippen aufs Ventil: nur Ventil auf/zu, kein Timer
  const tapOpen = await calls((c) => c.shadowRoot.querySelector('.zone[data-zone="2"] .z-badge').click());
  const tapClose = await calls((c) => c.shadowRoot.querySelector('.zone[data-zone="2"] .z-badge').click());
  // alle zu, Pumpe zieht Strom → Sonstiges
  const r3 = await read();
  const mode = await calls((c) => [...c.shadowRoot.querySelectorAll(".mode")].find((b) => b.textContent.trim() === "Aus").click());
  // Pumpe aus → nichts von Hand startbar
  await setStates({ "switch.hauswasserwerk": "off", "sensor.hauswasserwerk_power": "0" });
  await p.waitForTimeout(150);
  const r4 = await read();
  const locked = await calls((c) => { c.shadowRoot.querySelector('.zone[data-zone="0"] .z-badge').click(); c.shadowRoot.querySelector('.zone[data-zone="0"] .ctl.play').click(); });
  await setStates({ "switch.hauswasserwerk": "on", "sensor.hauswasserwerk_power": "642" });
  const okState = /^Pumpt · Rasen$/.test(r0.sub) && r0.v.join() === "true,false,false,false" && r0.trunk && /^Rasen\|\d+:\d\d\|14 L\/min$/.test(r0.cols[0])
    && r0.cols[1] === "Beete|zu|zuletzt 171 L" && r0.cols[2] === "Hecke|zu|14 %" && r0.cols[3] === "Sonstiges|–|" && r0.mode === "Automatik";
  const okActions = start.join() === "timer.start timer.beete 00:10:00,homeassistant.turn_on switch.ventil_beete" && r1.v.join() === "true,true,false,false"
    && pause.join() === "timer.pause timer.rasen,homeassistant.turn_off switch.ventil_rasen" && /^Rasen\|⏸ /.test(r2.cols[0])
    && stop.join() === "timer.cancel timer.rasen,homeassistant.turn_off switch.ventil_rasen" && stop1.length === 2
    && tapOpen.join() === "homeassistant.turn_on switch.ventil_hecke" && tapClose.join() === "homeassistant.turn_off switch.ventil_hecke"
    && r3.v.join() === "false,false,false,true" && r3.cols[3] === "Sonstiges|läuft|642 W"
    && mode.join() === "input_select.select_option input_select.bewaesserung_modus Aus";
  const okLock = r4.play.every(Boolean) && r4.hint && !r4.trunk && locked.length === 0;
  okState && okActions && okLock
    ? ok("Bewässerung: Ventile parallel am Verteiler + „Sonstiges“, Tippen schaltet nur das Ventil, Start/Pause/Stopp, ohne Pumpe gesperrt, Modus")
    : fail(`Bewässerung: ${JSON.stringify({ okState, okActions, okLock, r0, start, r1, pause, r2, stop, stop1, tapOpen, tapClose, r3, mode, r4, locked })}`);
  // Laufzeit direkt in der Karte: Schnellwahl sofort, −/+ gesammelt, Start nutzt den neuen Wert
  const ed = async (fn, wait = 300) => { const n = await p.evaluate(() => window.serviceCalls.length); await card.evaluate(fn); await p.waitForTimeout(wait);
    return p.evaluate((n) => window.serviceCalls.slice(n).map((c) => `${c.domain}.${c.service} ${c.data.entity_id}${c.data.value != null ? " " + c.data.value : ""}${c.data.duration ? " " + c.data.duration : ""}`), n); };
  await card.evaluate((c) => c.shadowRoot.querySelector('.zone[data-zone="1"] .dur').click());
  await p.waitForTimeout(150);
  const edTitle = await card.evaluate((c) => c.shadowRoot.querySelector(".editor .ed-title")?.textContent.trim());
  const chip = await ed((c) => [...c.shadowRoot.querySelectorAll(".ed-chip")].find((b) => b.textContent.trim() === "20").click());
  const plus = await ed((c) => { const b = c.shadowRoot.querySelectorAll(".ed-step")[1]; b.click(); b.click(); }, 900);
  const shown = await card.evaluate((c) => [c.shadowRoot.querySelector(".ed-val").textContent.replace(/\s+/g, " ").trim(), c.shadowRoot.querySelector('.zone[data-zone="1"] .dur').textContent.replace(/\s+/g, " ").trim()]);
  const minus = await ed((c) => c.shadowRoot.querySelectorAll(".ed-step")[0].click(), 50);
  const startEd = await ed((c) => c.shadowRoot.querySelector(".ed-start").click(), 400);
  const closed = await card.evaluate((c) => !c.shadowRoot.querySelector(".editor"));
  /Laufzeit · Beete/i.test(edTitle ?? "") && chip.join() === "input_number.set_value input_number.beete_dauer 20" && plus.join() === "input_number.set_value input_number.beete_dauer 30"
    && shown.join() === "30 min,30 min" && minus.length === 0
    && startEd.join() === "input_number.set_value input_number.beete_dauer 25,timer.start timer.beete 00:25:00,homeassistant.turn_on switch.ventil_beete" && closed
    ? ok("Bewässerung: Laufzeit direkt in der Karte (Schnellwahl, −/+ gesammelt, Starten mit neuer Laufzeit)")
    : fail(`Laufzeit: ${JSON.stringify({ edTitle, chip, plus, shown, minus, startEd, closed })}`);
  // Modus Smart: Laufzeit gesperrt, Vorschlag (aufgerundet, max 30, unter 3 min übersprungen), Start mit Vorschlag
  await card.evaluate((c) => c.shadowRoot.querySelector('.zone[data-zone="1"] .ctl.stop')?.click());
  await p.waitForTimeout(300);
  await card.evaluate((c) => [...c.shadowRoot.querySelectorAll(".mode")].find((b) => b.textContent.trim() === "Smart").click());
  await p.waitForTimeout(300);
  const chips = await card.evaluate((c) => [1, 2].map((i) => { const d = c.shadowRoot.querySelector(`.zone[data-zone="${i}"] .dur`); return `${d.className.includes("smart")}:${d.className.includes("skip")}:${d.textContent.replace(/\s+/g, " ").trim()}`; }));
  await card.evaluate((c) => c.shadowRoot.querySelector('.zone[data-zone="1"] .dur').click());
  await p.waitForTimeout(150);
  const smartEd = await card.evaluate((c) => { const e = c.shadowRoot.querySelector(".editor"); return { smart: e.classList.contains("smart"), steps: e.querySelectorAll(".ed-step, .ed-chip").length,
    val: e.querySelector(".ed-val").textContent.replace(/\s+/g, " ").trim(), note: e.querySelector(".ed-note").textContent.trim() }; });
  const smartStart = await ed((c) => c.shadowRoot.querySelector(".ed-start").click(), 400);
  // Smart-Bereich: Infos, Plan, Wasserkonten, Details mit Verlauf, Aktionen (mit Rückfrage)
  const panel = await card.evaluate((c) => { const r = c.shadowRoot.querySelector(".smart-panel"); return r && {
    chips: [...r.querySelectorAll(".sp-chip")].map((x) => x.textContent.replace(/\s+/g, " ").trim()), plan: r.querySelector(".sp-plan-text").textContent.replace(/\s+/g, " ").trim(),
    buckets: [...r.querySelectorAll(".sz-bucket")].map((x) => x.textContent.trim()), alert: !!r.querySelector(".sp-alert") }; });
  await card.evaluate((c) => c.shadowRoot.querySelectorAll(".sz-row")[1].click());
  await p.waitForTimeout(400);
  const details = await card.evaluate((c) => { const d = c.shadowRoot.querySelector(".sz.open .sz-details"); return d && {
    facts: [...d.querySelectorAll(".sz-facts b")].map((x) => x.textContent.trim()), spark: !!d.querySelector(".spark path") }; });
  const calc = await ed((c) => c.shadowRoot.querySelector(".sp-act").click());
  const run1 = await ed((c) => c.shadowRoot.querySelector(".sp-act.run").click(), 100);
  const asked = await card.evaluate((c) => c.shadowRoot.querySelector(".sp-act.run").textContent.trim());
  const run2 = await ed((c) => c.shadowRoot.querySelector(".sp-act.run").click());
  const reset = await ed((c) => { const b = c.shadowRoot.querySelector(".sp-act.reset"); b.click(); b.click(); });
  panel && !panel.alert && panel.chips.length === 4 && /^Sommer$/.test(panel.chips[0]) && panel.chips[1] === "DWD ok" && /^ET₀ 1,3 mm$/.test(panel.chips[2]) && /12 Messpunkte/.test(panel.chips[3])
    && panel.plan === "Rasen 9 min · Beete 30 min — übersprungen: Hecke" && panel.buckets.join() === "-1 mm · fehlt,-12,4 mm · fehlt,+0,6 mm · ok"
    && details?.facts.join() === "120 m²,8,5 mm/h,× 0,8" && details.spark
    && calc.join() === "script.turn_on script.smart_berechnen" && run1.length === 0 && /Sicher/.test(asked) && run2.join() === "script.turn_on script.smart_durchlauf"
    && reset.join() === "smart_irrigation.reset_all_buckets undefined"
    ? ok("Bewässerung: Smart-Bereich (Jahreszeit, DWD, ET₀, Plan, Wasserkonten + Verlauf, Neu berechnen / Jetzt gießen / Konten auf 0 mit Rückfrage)")
    : fail(`Smart-Bereich: ${JSON.stringify({ panel, details, calc, run1, asked, run2, reset })}`);
  await card.evaluate((c) => [...c.shadowRoot.querySelectorAll(".mode")].find((b) => b.textContent.trim() === "Automatik").click());
  await p.waitForTimeout(300);
  chips.join() === "true:false:30 min,true:true:" && smartEd.smart && smartEd.steps === 0 && smartEd.val === "30 min" && /gekappt – berechnet 35 min/.test(smartEd.note)
    && smartStart.join() === "timer.start timer.beete 00:30:00,homeassistant.turn_on switch.ventil_beete"
    ? ok("Bewässerung: im Modus Smart Laufzeit gesperrt, Vorschlag (gekappt / übersprungen), Start mit Vorschlag")
    : fail(`Smart: ${JSON.stringify({ chips, smartEd, smartStart })}`);
}

// Moduswechsel: jede Karte, jeder Modus (außer Auto/Heizen-Kühlen, dort zählt die Tätigkeit)
const colorFails = await p.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  for (const card of document.querySelectorAll("ha-climate-card")) {
    const root = card.shadowRoot;
    if (!root.querySelector("hcc-mode-bar")) root.querySelector(".expand")?.click();
    await wait(50);
    const bar = root.querySelector("hcc-mode-bar");
    if (!bar) continue;
    for (const [i, m] of bar.modes.map((x) => x.value).entries()) {
      bar.shadowRoot.querySelectorAll("button")[i].click();
      await wait(250);
      const accent = root.querySelector("ha-card").style.getPropertyValue("--hcc-accent-c");
      if (!["auto", "heat_cool"].includes(m) && !accent.includes(`climate-${m}-color`)) out.push(`${card.id} ${m} → ${accent}`);
    }
  }
  return out;
});
colorFails.length ? fail(`Farbe folgt nicht dem Modus: ${colorFails.join(", ")}`) : ok("Kartenfarbe folgt in allen Modi");

// Dienste
{
  const before = await p.evaluate(() => window.serviceCalls.length);
  await p.evaluate(() => document.querySelector("#card0").shadowRoot.querySelector("hcc-countdown-timer")?.shadowRoot.querySelector(".chip")?.click());
  await p.waitForTimeout(300);
  const calls = await p.evaluate((n) => window.serviceCalls.slice(n).map((c) => `${c.domain}.${c.service}`), before);
  calls.includes("timer.start") ? ok("Schnell-Timer startet timer.start") : fail(`Schnell-Timer: ${calls}`);
}

// Starlink + Speedtest
{
  const txt = async (sel) => p.evaluate((s) => document.querySelector("ha-starlink-card").shadowRoot.querySelector(s)?.textContent?.replace(/\s+/g, " ").trim() ?? "", sel);
  const head = await txt(".h-sub");
  /Verbunden · seit 3 T 7 h/.test(head) ? ok(`Starlink-Kopf: ${head}`) : fail(`Starlink-Kopf: ${head}`);
  const live = await txt(".live");
  /18\s*Mbit\/s/.test(live) && /28\s*ms/.test(live) ? ok("Starlink-Livewerte (Download, Ping)") : fail(`Starlink-Livewerte: ${live}`);
  (await p.evaluate(() => !!document.querySelector("ha-starlink-card").shadowRoot.querySelector(".spark path.s-down"))) ? ok("Speedtest-Verlauf gezeichnet") : fail("Speedtest-Verlauf fehlt");
  const before = await p.evaluate(() => window.serviceCalls.length);
  await p.evaluate(() => document.querySelector("ha-starlink-card").shadowRoot.querySelector(".run").click());
  await p.waitForTimeout(300);
  const calls = await p.evaluate((n) => window.serviceCalls.slice(n), before);
  const run = calls.find((c) => c.domain === "homeassistant" && c.service === "update_entity");
  run?.data.entity_id === "sensor.speedtest_download" ? ok("„Jetzt testen“ ruft homeassistant.update_entity") : fail(`Speedtest-Aufruf: ${JSON.stringify(calls)}`);
  (await p.evaluate(() => document.querySelector("ha-starlink-card").shadowRoot.querySelector(".run").disabled)) ? ok("Speedtest läuft (Knopf gesperrt)") : fail("Speedtest-Status fehlt");
  await p.waitForTimeout(2200);
  (await p.evaluate(() => !document.querySelector("ha-starlink-card").shadowRoot.querySelector(".run").disabled)) ? ok("neue Speedtest-Werte beenden den Test") : fail("Speedtest bleibt hängen");
  // Verstauen braucht eine Bestätigung
  const n = await p.evaluate(() => window.serviceCalls.length);
  await p.evaluate(() => document.querySelector("ha-starlink-card").shadowRoot.querySelector('[data-key="stow"]').click());
  await p.waitForTimeout(150);
  const asked = await p.evaluate((k) => window.serviceCalls.length === k, n);
  await p.evaluate(() => document.querySelector("ha-starlink-card").shadowRoot.querySelector('[data-key="stow"]').click());
  await p.waitForTimeout(400);
  const stowed = await p.evaluate(() => window.serviceCalls.at(-1));
  asked && stowed?.service === "toggle" && stowed.data.entity_id === "switch.starlink_verstaut" ? ok("Verstauen erst nach Bestätigung") : fail(`Verstauen: ${JSON.stringify(stowed)}`);
  const sub = await txt(".h-sub");
  /Verstaut/.test(sub) ? ok("Kopf zeigt „Verstaut“") : fail(`nach Verstauen: ${sub}`);
  const camper = await p.evaluate(() => document.querySelectorAll("ha-starlink-card")[1].shadowRoot.querySelector('.alert[data-key="obstructed"]')?.textContent.trim());
  camper ? ok(`Camper-Warnung: ${camper}`) : fail("Sichtbehinderungs-Warnung fehlt");
}

// KI-Timeline (LLM Vision)
{
  const q = (fn) => p.evaluate(fn);
  const info = await q(() => {
    const r = document.querySelector("ha-llm-timeline-card").shadowRoot;
    return { items: r.querySelectorAll(".item").length, hero: r.querySelector(".hero-text b")?.textContent, img: !!r.querySelector("img.hero-img"), sub: r.querySelector(".h-sub")?.textContent };
  });
  info.hero === "Marcels Auto" && info.img ? ok(`KI-Timeline: neuestes Ereignis mit Bild (${info.sub})`) : fail(`KI-Timeline Kopf: ${JSON.stringify(info)}`);
  info.items === 6 ? ok("KI-Timeline: 6 weitere Ereignisse, „Keine Aktivität“ ausgeblendet") : fail(`KI-Timeline Einträge: ${info.items}`);
  await q(() => document.querySelector("ha-llm-timeline-card").shadowRoot.querySelector('.chip[data-cat="animal"]').click());
  await p.waitForTimeout(300);
  const cats = await q(() => [...document.querySelector("ha-llm-timeline-card").shadowRoot.querySelectorAll(".item")].map((i) => i.dataset.cat));
  cats.length === 2 && cats.every((c) => c === "animal") ? ok("KI-Timeline: Filter „Tiere“") : fail(`KI-Timeline Filter: ${cats}`);
  await q(() => document.querySelector("ha-llm-timeline-card").shadowRoot.querySelector(".item").click());
  await p.waitForTimeout(400);
  const dlg = await q(() => { const d = document.querySelector("ha-llm-timeline-card").shadowRoot.querySelector("dialog.detail"); return d?.open ? d.querySelector("h3")?.textContent : null; });
  dlg?.includes("Unbekanntes Tier") ? ok("KI-Timeline: Detail öffnet sich") : fail(`KI-Timeline Detail: ${dlg}`);
  await q(() => document.querySelector("ha-llm-timeline-card").shadowRoot.querySelector(".d-close").click());
  await p.waitForTimeout(200);
  (await q(() => !document.querySelector("ha-llm-timeline-card").shadowRoot.querySelector("dialog.detail"))) ? ok("KI-Timeline: Detail schließt") : fail("KI-Timeline: Detail bleibt offen");
}

// Hausakku (Anker Solarbank)
{
  const info = await p.evaluate(() => [...document.querySelectorAll("ha-home-battery-card")].map((c) => {
    const r = c.shadowRoot;
    return { sub: r.querySelector(".h-sub")?.textContent.trim(), soc: r.querySelector(".r-in b")?.textContent.trim(),
      wires: [...r.querySelectorAll(".wire")].map((w) => w.classList.contains("on")), strings: r.querySelectorAll(".str").length, hist: !!r.querySelector(".h-soc") };
  }));
  const [a, b] = info;
  /Entlädt · Durchleitung · leer in ~22 h/.test(a?.sub ?? "") && a?.soc === "19%" ? ok(`Hausakku: ${a.sub}`) : fail(`Hausakku Kopf: ${JSON.stringify(a)}`);
  /Lädt · Durchleitung · voll in 2 h 18 min/.test(b?.sub ?? "") ? ok(`Hausakku lädt: ${b.sub}`) : fail(`Hausakku lädt: ${JSON.stringify(b)}`);
  a?.strings === 2 && a?.hist && a?.wires.every(Boolean) ? ok("Hausakku: 2 PV-Module, Fluss aktiv, Verlauf") : fail(`Hausakku Inhalt: ${JSON.stringify(a)}`);
  const n = await p.evaluate(() => window.serviceCalls.length);
  await p.evaluate(() => document.querySelector("ha-home-battery-card").shadowRoot.querySelector(".refresh").click());
  await p.waitForTimeout(200);
  const call = await p.evaluate((k) => window.serviceCalls.slice(k).find((c) => c.service === "press"), n);
  call?.data.entity_id === "button.solarbank_3_e2700_pro_details_aktualisieren" ? ok("Hausakku: Aktualisieren drückt den Button") : fail(`Hausakku Aktualisieren: ${JSON.stringify(call)}`);
}

// System & Updates
{
  const info = await p.evaluate(() => { const r = document.querySelector("ha-system-card").shadowRoot;
    return { sub: r.querySelector(".h-sub")?.textContent.trim(), rings: r.querySelectorAll(".res-item").length, upd: r.querySelectorAll(".upd").length,
      count: r.querySelector(".count")?.textContent.trim(), backup: r.querySelector(".b-text b")?.textContent.trim(), svc: r.querySelectorAll(".svc.ok").length }; });
  /Updates verfügbar/.test(info.sub) && info.rings === 3 && info.upd === 5 && info.svc === 2 && info.backup === "Backup aktuell"
    ? ok(`System: ${info.sub}, ${info.count} Updates, 3 Ringe, Backup aktuell`) : fail(`System: ${JSON.stringify(info)}`);
  const n = await p.evaluate(() => window.serviceCalls.length);
  await p.evaluate(() => document.querySelector("ha-system-card").shadowRoot.querySelector(".u-btn").click());
  await p.waitForTimeout(150);
  const asked = await p.evaluate((k) => window.serviceCalls.length === k && document.querySelector("ha-system-card").shadowRoot.querySelector(".u-btn").classList.contains("ask"), n);
  await p.evaluate(() => document.querySelector("ha-system-card").shadowRoot.querySelector(".u-btn.ask").click());
  await p.waitForTimeout(300);
  const call = await p.evaluate((k) => window.serviceCalls.slice(k).find((c) => c.service === "install"), n);
  asked && call?.data.entity_id === "update.home_assistant_core_update" && call.data.backup === true
    ? ok("System: Installieren fragt nach, Core mit Backup") : fail(`System Installieren: ${asked} ${JSON.stringify(call)}`);
  await p.evaluate(() => document.querySelector("ha-system-card").shadowRoot.querySelector(".restart").click());
  await p.waitForTimeout(100);
  const noRestart = await p.evaluate(() => !window.serviceCalls.some((c) => c.service === "restart"));
  await p.evaluate(() => document.querySelector("ha-system-card").shadowRoot.querySelector(".restart").click());
  await p.waitForTimeout(100);
  noRestart && (await p.evaluate(() => window.serviceCalls.some((c) => c.domain === "homeassistant" && c.service === "restart")))
    ? ok("System: Neustart erst nach Bestätigung") : fail("System: Neustart-Rückfrage");
}

// System: YAML prüfen, Schnell neu laden
{
  await p.evaluate(() => document.querySelector("ha-system-card").shadowRoot.querySelector('[data-act="check"]').click());
  await p.waitForTimeout(700);
  const chk = await p.evaluate(() => document.querySelector("ha-system-card").shadowRoot.querySelector('[data-act="check"]').textContent.trim());
  await p.evaluate(() => document.querySelector("ha-system-card").shadowRoot.querySelector('[data-act="reload"]').click());
  await p.waitForTimeout(200);
  const reload = await p.evaluate(() => window.serviceCalls.some((c) => c.domain === "homeassistant" && c.service === "reload_all"));
  chk === "YAML ok" && reload ? ok("System: YAML prüfen (gültig) und Schnell neu laden") : fail(`System Aktionen: ${chk} ${reload}`);
}

// Wetter
{
  const info = await p.evaluate(() => { const r = document.querySelector("ha-weather-card").shadowRoot;
    return { temp: r.querySelector(".h-main .h-temp")?.textContent.trim(), cond: r.querySelector(".h-cond")?.textContent.trim(), hint: r.querySelector(".hint")?.textContent.trim(),
      days: r.querySelectorAll("[data-day]").length, hours: r.querySelectorAll(".h-col").length, wind: r.querySelector('.det[data-k="wind"] small')?.textContent.trim() }; });
  info.temp === "11°" && info.cond === "Teilweise bewölkt" ? ok(`Wetter: ${info.temp} ${info.cond}`) : fail(`Wetter Hero: ${JSON.stringify(info)}`);
  /^Regen ab \d{2}:\d{2}$/.test(info.hint ?? "") ? ok(`Wetter-Hinweis: ${info.hint}`) : fail(`Wetter-Hinweis: ${info.hint}`);
  info.days === 7 && info.hours >= 20 && info.wind === "O" ? ok("Wetter: 7 Tage, Stundenverlauf, Wind aus Ost") : fail(`Wetter Inhalt: ${JSON.stringify(info)}`);
  await p.evaluate(() => document.querySelector("ha-weather-card").shadowRoot.querySelector(".fold").click());
  await p.waitForTimeout(200);
  const folded = await p.evaluate(() => { const r = document.querySelector("ha-weather-card").shadowRoot; return { body: !!r.querySelector(".fold-body"), label: r.querySelector(".fold span")?.textContent.trim(), saved: localStorage.getItem("hcc-weather-open:weather.forecast_home") }; });
  await p.evaluate(() => document.querySelector("ha-weather-card").shadowRoot.querySelector(".fold").click());
  await p.waitForTimeout(200);
  const reopened = await p.evaluate(() => !!document.querySelector("ha-weather-card").shadowRoot.querySelector(".fold-body [data-day]"));
  !folded.body && folded.label === "Details & Vorhersage" && folded.saved === "0" && reopened ? ok("Wetter: Details & Vorhersage auf-/zuklappbar (gemerkt)") : fail(`Wetter Klappen: ${JSON.stringify(folded)} ${reopened}`);
}

// Termine & Abfall
{
  const info = await p.evaluate(() => { const r = document.querySelector("ha-agenda-card").shadowRoot;
    return { bins: [...r.querySelectorAll(".bin .b-name")].map((b) => b.textContent.trim()), days: r.querySelectorAll(".day").length,
      first: r.querySelector(".ev b")?.textContent.trim(), sub: r.querySelector(".h-sub")?.textContent.trim() }; });
  info.bins.length >= 3 && info.days >= 4 && info.first === "Zahnarzt" ? ok(`Termine & Abfall: ${info.bins.join(", ")} · ${info.sub}`) : fail(`Agenda: ${JSON.stringify(info)}`);
}

// Gerätestatus
{
  const info = await p.evaluate(() => { const r = document.querySelector("ha-device-status-card").shadowRoot;
    return { sub: r.querySelector(".h-sub")?.textContent.trim(), first: r.querySelector(".d-text b")?.textContent.trim(), chips: r.querySelectorAll(".chip").length,
      ipad: [...r.querySelectorAll(".d-text b")].some((b) => b.textContent.includes("iPad")),
      starlink: [...r.querySelectorAll(".d-text b")].some((b) => b.textContent.includes("Starlink")) }; });
  /Geräte nicht erreichbar/.test(info.sub) && info.first === "MEATER+ Sonde" && info.chips >= 4 && !info.ipad && !info.starlink
    ? ok(`Gerätestatus: ${info.sub}, älteste zuerst, Geräte-Tracker und teilweise erreichbare Geräte (Starlink) ausgeblendet`) : fail(`Gerätestatus: ${JSON.stringify(info)}`);
  await p.evaluate(() => document.querySelector("ha-device-status-card").shadowRoot.querySelector('.chip[data-int="hue"]').click());
  await p.waitForTimeout(150);
  const hue = await p.evaluate(() => [...document.querySelector("ha-device-status-card").shadowRoot.querySelectorAll(".d-text b")].map((b) => b.textContent.trim()));
  await p.evaluate(() => document.querySelector("ha-device-status-card").shadowRoot.querySelector(".d-main").click());
  await p.waitForTimeout(150);
  const n = await p.evaluate(() => window.serviceCalls.length);
  await p.evaluate(() => [...document.querySelector("ha-device-status-card").shadowRoot.querySelectorAll(".act")].pop().click());
  await p.waitForTimeout(150);
  const call = await p.evaluate((k) => window.serviceCalls.slice(k).find((c) => c.service === "reload_config_entry"), n);
  hue.length === 1 && hue[0] === "Couch Lightstrip" && call?.data.entity_id === "light.couch_licht" ? ok("Gerätestatus: Filter Philips Hue, Integration neu laden") : fail(`Gerätestatus Filter/Reload: ${hue} ${JSON.stringify(call)}`);
}

// Rezepte (Mealie)
{
  const R = () => document.querySelector("ha-recipe-card").shadowRoot;
  const info = await p.evaluate(() => { const r = document.querySelector("ha-recipe-card").shadowRoot;
    return { meals: [...r.querySelectorAll(".meal:not(.empty) span")].map((s) => s.textContent.trim()), empty: r.querySelectorAll(".meal.empty").length,
      results: r.querySelectorAll(".res").length, sub: r.querySelector(".h-sub")?.textContent.trim() }; });
  info.meals.includes("Spaghetti Carbonara") && info.results === 4 && /Heute: Spaghetti/.test(info.sub)
    ? ok(`Rezepte: ${info.meals.length} geplant, ${info.empty} frei, ${info.results} neueste Rezepte`) : fail(`Rezepte: ${JSON.stringify(info)}`);
  await p.evaluate(() => document.querySelector("ha-recipe-card").shadowRoot.querySelector(".meal.empty").click());
  await p.waitForTimeout(100);
  await p.evaluate(() => document.querySelector("ha-recipe-card").shadowRoot.querySelector('.mini[data-act="random"]').click());
  await p.waitForTimeout(300);
  const after = await p.evaluate(() => ({ calls: window.serviceCalls.filter((c) => c.service === "set_random_mealplan").length,
    meals: document.querySelector("ha-recipe-card").shadowRoot.querySelectorAll(".meal:not(.empty)").length }));
  after.calls === 1 && after.meals === info.meals.length + 1 ? ok("Rezepte: freier Platz → Zufällig plant ein") : fail(`Rezepte Zufall: ${JSON.stringify(after)}`);
  await p.evaluate(() => { const i = document.querySelector("ha-recipe-card").shadowRoot.querySelector("input.search"); i.value = "gulasch"; i.dispatchEvent(new Event("input")); });
  await p.waitForTimeout(700);
  await p.evaluate(() => document.querySelector("ha-recipe-card").shadowRoot.querySelector(".res").click());
  await p.waitForTimeout(400);
  const dl = await p.evaluate(() => { const r = document.querySelector("ha-recipe-card").shadowRoot;
    r.querySelectorAll(".serv .step")[0].click(); r.querySelectorAll(".serv .step")[0].click(); r.querySelectorAll(".serv .step")[0].click();
    return { open: r.querySelector("dialog").open, title: r.querySelector(".dl-head h3")?.textContent }; });
  await p.waitForTimeout(150);
  const ing = await p.evaluate(() => document.querySelector("ha-recipe-card").shadowRoot.querySelector(".ings li span").textContent);
  await p.evaluate(() => document.querySelector("ha-recipe-card").shadowRoot.querySelector('.act[data-act="shop"]').click());
  await p.waitForTimeout(300);
  const shop = await p.evaluate(() => window.serviceCalls.filter((c) => c.domain === "todo" && c.service === "add_item"));
  dl.open && dl.title === "Rindergulasch" && ing === "½ kg Rindergulasch" && shop.length === 7 && shop[0].data.entity_id === "todo.mealie_einkaufsliste"
    ? ok("Rezepte: Suche → Rezept, 3 statt 6 Portionen, Zutaten auf die Einkaufsliste") : fail(`Rezept-Detail: ${JSON.stringify({ dl, ing, n: shop.length })}`);
  await p.evaluate(() => document.querySelector("ha-recipe-card").shadowRoot.querySelector(".x").click());
}

// Szenen
{
  const info = await p.evaluate(() => { const r = document.querySelector("ha-scene-card").shadowRoot;
    return { chips: [...r.querySelectorAll(".chip")].map((c) => c.textContent.trim()), scenes: r.querySelectorAll(".scene").length,
      last: r.querySelector(".scene.last .s-name")?.textContent.trim(), sub: r.querySelector(".h-sub")?.textContent.trim() }; });
  info.chips.length === 3 && info.scenes === 6 && info.last === "Ambiente Kaminfeuer" && /Kaminfeuer/.test(info.sub)
    ? ok(`Szenen: ${info.chips.join(", ")}, zuletzt ${info.last}`) : fail(`Szenen: ${JSON.stringify(info)}`);
  const n = await p.evaluate(() => window.serviceCalls.length);
  await p.evaluate(() => { const r = document.querySelector("ha-scene-card").shadowRoot; r.querySelector('.chip[data-room="g1"]').click(); });
  await p.waitForTimeout(150);
  await p.evaluate(() => document.querySelector("ha-scene-card").shadowRoot.querySelector('.scene[data-scene="scene.wohnzimmer_entspannen"]').click());
  await p.evaluate(() => document.querySelector("ha-scene-card").shadowRoot.querySelector(".all-off").click());
  await p.waitForTimeout(200);
  const calls = await p.evaluate((k) => window.serviceCalls.slice(k).map((c) => `${c.domain}.${c.service}`), n);
  calls.includes("scene.turn_on") && calls.includes("light.turn_off") ? ok("Szenen: Raum wechseln, Szene aktivieren, Alles aus") : fail(`Szenen Dienste: ${calls}`);
}

// Schlafen
{
  const info = await p.evaluate(() => { const r = document.querySelector("ha-sleep-card").shadowRoot;
    return { asleep: r.querySelectorAll(".person.asleep").length, persons: r.querySelectorAll(".person").length,
      tv: r.querySelector('.timer[data-timer="input_datetime.timer_tv"] small')?.textContent.trim(), alarm: !!r.querySelector(".alarm") }; });
  info.asleep === 1 && info.persons === 2 && /aus in 1:2\d h/.test(info.tv) && info.alarm
    ? ok(`Schlafen: Pascal schläft, TV ${info.tv}, Wecker`) : fail(`Schlafen: ${JSON.stringify(info)}`);
  const n = await p.evaluate(() => window.serviceCalls.length);
  await p.evaluate(() => document.querySelector("ha-sleep-card").shadowRoot.querySelectorAll('.timer[data-timer="input_datetime.timer_tv"] .step')[1].click());
  await p.evaluate(() => document.querySelector("ha-sleep-card").shadowRoot.querySelector('[data-person="1"] .gn').click());
  await p.waitForTimeout(100);
  const first = await p.evaluate((k) => window.serviceCalls.slice(k).filter((c) => c.service === "turn_off").length, n);
  await p.evaluate(() => document.querySelector("ha-sleep-card").shadowRoot.querySelector('[data-person="1"] .gn').click());
  await p.waitForTimeout(200);
  const calls = await p.evaluate((k) => window.serviceCalls.slice(k), n);
  const dt = calls.find((c) => c.service === "set_datetime");
  first === 0 && dt?.data.entity_id === "input_datetime.timer_tv" && calls.some((c) => c.service === "turn_on" && c.data.entity_id === "input_boolean.schlafen_marcel")
    && calls.some((c) => c.domain === "light" && c.service === "turn_off")
    ? ok(`Schlafen: +15 min (${dt.data.time}), „Gute Nacht“ erst nach Bestätigung`) : fail(`Schlafen Dienste: ${JSON.stringify(calls)}`);
}

// Klima-Räume
{
  const info = await p.evaluate(() => { const r = document.querySelector("ha-climate-rooms-card").shadowRoot;
    return { rooms: r.querySelectorAll(".room").length, win: r.querySelectorAll(".room.win").length, heat: r.querySelectorAll(".room.heating").length,
      next: r.querySelector('.room[data-room="Pascal"] .r-text small')?.textContent.trim(), sum: [...r.querySelectorAll(".sc")].map((s) => s.textContent.trim()) }; });
  info.rooms === 4 && info.win === 1 && info.next
    ? ok(`Klima 2.0: ${info.sum.join(", ")} · Pascal „${info.next}“`) : fail(`Klima 2.0: ${JSON.stringify(info)}`);
  const n = await p.evaluate(() => window.serviceCalls.length);
  // Frühere Tests haben die Heizung evtl. ausgeschaltet: erst einschalten, dann Boost
  if (/Heizung aus/.test(info.next)) {
    await p.evaluate(() => document.querySelector("ha-climate-rooms-card").shadowRoot.querySelector('.room[data-room="Pascal"] .pill[data-act="heat"]').click());
    await p.waitForTimeout(400);
  }
  await p.evaluate(() => document.querySelector("ha-climate-rooms-card").shadowRoot.querySelector('.room[data-room="Pascal"] .pill[data-act="boost"]').click());
  await p.waitForTimeout(300);
  const calls = await p.evaluate((k) => window.serviceCalls.slice(k), n);
  const boost = calls.find((c) => c.service === "set_preset_mode");
  const next = await p.evaluate(() => document.querySelector("ha-climate-rooms-card").shadowRoot.querySelector('.room[data-room="Pascal"] .r-text small')?.textContent.trim());
  boost?.data.entity_id === "climate.heizung_mein_zimmer" && (boost.data.preset_mode === "boost") === /Boost/.test(next)
    ? ok(`Klima 2.0: ${calls.length > 1 ? "Heizung an, " : ""}Boost umgeschaltet („${next}“)`) : fail(`Klima 2.0 Boost: ${JSON.stringify(calls)} ${next}`);
}

// Wochenrückblick Energie
{
  await p.waitForTimeout(200);
  const info = await p.evaluate(() => { const r = document.querySelector("ha-energy-week-card").shadowRoot;
    return { total: r.querySelector(".kpi.main .k-v")?.textContent.trim(), cols: r.querySelectorAll(".chart .col").length,
      shares: [...r.querySelectorAll(".share .s-name")].map((s) => s.textContent.trim()) }; });
  /kWh/.test(info.total) && info.cols === 7 && info.shares[0] === "Whirlpool" && info.shares.length === 3
    ? ok(`Energie-Woche: ${info.total}, ${info.shares.join(" > ")}`) : fail(`Energie-Woche: ${JSON.stringify(info)}`);
  await p.evaluate(() => document.querySelector("ha-energy-week-card").shadowRoot.querySelector('.seg [data-range="month"]').click());
  await p.waitForTimeout(400);
  const month = await p.evaluate(() => document.querySelector("ha-energy-week-card").shadowRoot.querySelectorAll(".chart .col").length);
  month >= 28 ? ok(`Energie-Woche: Monatsansicht (${month} Tage)`) : fail(`Energie-Monat: ${month}`);
}

// Rezepte ohne Essensplan
{
  const info = await p.evaluate(() => { const r = document.querySelectorAll("ha-recipe-card")[1].shadowRoot;
    return { title: r.querySelector(".h-title")?.textContent.trim(), week: !!r.querySelector(".week"), fill: !!r.querySelector(".fill"), search: !!r.querySelector("input.search"), res: r.querySelectorAll(".res").length }; });
  info.title === "Rezepte" && !info.week && !info.fill && info.search && info.res === 4 ? ok("Rezepte: show_plan: false → nur Suche und Rezepte") : fail(`Rezepte ohne Plan: ${JSON.stringify(info)}`);
}

// Szenen: Lampen aus dem Hue-Raum
{
  await p.evaluate(() => document.querySelector("ha-scene-card").shadowRoot.querySelector('.chip[data-room="g0"]').click());
  await p.waitForTimeout(150);
  const before = await p.evaluate(() => { const r = document.querySelector("ha-scene-card").shadowRoot;
    return { group: r.querySelector(".light")?.dataset.light, count: r.querySelector(".l-count")?.textContent.trim(), members: r.querySelectorAll(".members .light").length }; });
  await p.evaluate(() => document.querySelector("ha-scene-card").shadowRoot.querySelector(".l-name").click());
  await p.waitForTimeout(150);
  const members = await p.evaluate(() => document.querySelector("ha-scene-card").shadowRoot.querySelectorAll(".members .light").length);
  before.group === "light.hue_tv" && /5 Lampen/.test(before.count) && before.members === 0 && members === 5
    ? ok("Szenen: Raum TV → Hue-Gruppe mit 5 Lampen, aufklappbar") : fail(`Szenen Hue-Lampen: ${JSON.stringify(before)} ${members}`);
}

// Pakete (17TRACK)
{
  const P = () => document.querySelector("ha-parcel-card").shadowRoot;
  const info = await p.evaluate(() => { const r = document.querySelector("ha-parcel-card").shadowRoot;
    return { names: [...r.querySelectorAll(".p-text b")].map((b) => b.textContent.trim()), sub: r.querySelector(".h-sub")?.textContent.trim(),
      chips: r.querySelectorAll(".chip").length, carrier: r.querySelector('.pkg[data-nr="1Z999AA10123456784"] .p-text small:last-child')?.textContent }; });
  info.names[0] === "Ersatzakku" && info.names.length === 5 && !info.names.includes("Alte Lieferung") && /Abholen/.test(info.sub) && /UPS/.test(info.carrier)
    ? ok(`Pakete: ${info.names.join(", ")} · ${info.sub}`) : fail(`Pakete: ${JSON.stringify(info)}`);
  await p.evaluate(() => document.querySelector("ha-parcel-card").shadowRoot.querySelector('.chip[data-filter="transit"]').click());
  await p.waitForTimeout(100);
  const transit = await p.evaluate(() => document.querySelector("ha-parcel-card").shadowRoot.querySelectorAll(".pkg").length);
  await p.evaluate(() => document.querySelector("ha-parcel-card").shadowRoot.querySelector('.chip[data-filter="transit"]').click());
  await p.evaluate(() => document.querySelector("ha-parcel-card").shadowRoot.querySelector('.pkg[data-nr="DE5922818887"] .p-main').click());
  await p.waitForTimeout(100);
  const n = await p.evaluate(() => window.serviceCalls.length);
  await p.evaluate(() => document.querySelector("ha-parcel-card").shadowRoot.querySelector('.pkg[data-nr="DE5922818887"] [data-act="archive"]').click());
  await p.waitForTimeout(100);
  const first = await p.evaluate((k) => window.serviceCalls.slice(k).filter((c) => c.service === "archive_package").length, n);
  await p.evaluate(() => document.querySelector("ha-parcel-card").shadowRoot.querySelector('.pkg[data-nr="DE5922818887"] [data-act="archive"]').click());
  await p.waitForTimeout(300);
  const gone = await p.evaluate(() => !document.querySelector("ha-parcel-card").shadowRoot.querySelector('.pkg[data-nr="DE5922818887"]'));
  await p.evaluate(() => document.querySelector("ha-parcel-card").shadowRoot.querySelector('[data-act="add"]').click());
  await p.waitForTimeout(100);
  await p.evaluate(() => { const r = document.querySelector("ha-parcel-card").shadowRoot; const f = r.querySelector("form.add");
    f.querySelector('[name="nr"]').value = "JJD000390007777777"; f.querySelector('[name="name"]').value = "Lampe"; f.requestSubmit(); });
  await p.waitForTimeout(400);
  const add = await p.evaluate((k) => window.serviceCalls.slice(k).find((c) => c.service === "add_package"), n);
  const hasNew = await p.evaluate(() => !!document.querySelector("ha-parcel-card").shadowRoot.querySelector('.pkg[data-nr="JJD000390007777777"]'));
  transit === 2 && first === 0 && gone && add?.data.package_friendly_name === "Lampe" && hasNew
    ? ok("Pakete: Filter Unterwegs, Archivieren erst nach „Sicher?“, + Paket") : fail(`Pakete Aktionen: ${JSON.stringify({ transit, first, gone, add, hasNew })}`);
}

// Router (FRITZ!Box + TP-Link)
{
  const info = await p.evaluate(() => { const [a, b] = document.querySelectorAll("ha-router-card"); const ra = a.shadowRoot, rb = b.shadowRoot;
    return { title: ra.querySelector(".h-title")?.textContent.trim(), sub: ra.querySelector(".h-sub")?.textContent.trim(), upd: !!ra.querySelector('[data-act="update"]'),
      clients: ra.querySelectorAll(".client").length, wifi: [...ra.querySelectorAll(".w")].map((w) => w.textContent.trim()),
      tpTiles: [...rb.querySelectorAll(".tile .t-l")].map((t) => t.textContent.trim()), tpWifi: [...rb.querySelectorAll(".w")].map((w) => w.textContent.trim()) }; });
  info.title === "FRITZ!Box 7690" && /Online seit/.test(info.sub) && info.upd && info.clients >= 6 && info.wifi.includes("Gast") && info.tpTiles.includes("CPU") && info.tpWifi.includes("Gast 2,4 GHz")
    ? ok(`Router: ${info.title} (${info.sub}), ${info.clients} Geräte, WLAN ${info.wifi.join("/")}; TP-Link ${info.tpTiles.join("/")}`) : fail(`Router: ${JSON.stringify(info)}`);
  const n = await p.evaluate(() => window.serviceCalls.length);
  await p.evaluate(() => document.querySelector("ha-router-card").shadowRoot.querySelector('[data-act="reboot"]').click());
  await p.waitForTimeout(100);
  const first = await p.evaluate((k) => window.serviceCalls.slice(k).filter((c) => c.domain === "button").length, n);
  await p.evaluate(() => document.querySelector("ha-router-card").shadowRoot.querySelector('[data-act="reboot"]').click());
  await p.evaluate(() => document.querySelector("ha-router-card").shadowRoot.querySelector('[data-wifi="switch.fritz_box_7690_wi_fi_guest"]').click());
  await p.waitForTimeout(200);
  const calls = await p.evaluate((k) => window.serviceCalls.slice(k), n);
  first === 0 && calls.some((c) => c.domain === "button" && c.data.entity_id === "button.fritz_box_7690_neu_starten")
    && calls.some((c) => c.domain === "switch" && c.service === "turn_on" && c.data.entity_id === "switch.fritz_box_7690_wi_fi_guest")
    ? ok("Router: Neustart erst nach „Sicher?“, Gast-WLAN einschalten") : fail(`Router Aktionen: ${JSON.stringify(calls)}`);
}

// Theme-Umschalter
await p.click('[data-theme="dark"]');
(await p.evaluate(() => document.body.classList.contains("dark"))) ? ok("Dunkel-Modus umschaltbar") : fail("Dunkel-Modus");

errors.length ? fail(`Konsolenfehler: ${errors.join(" | ")}`) : ok("keine Konsolenfehler");
await browser.close();
