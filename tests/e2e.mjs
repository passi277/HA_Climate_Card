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
  [...document.querySelectorAll("ha-climate-card, ha-climate-overview-card, ha-light-card, ha-light-group-card, ha-cover-card, ha-cover-group-card, ha-switch-time-card, ha-media-card, ha-room-card, ha-status-card")].filter((c) => c.shadowRoot?.querySelector("ha-card")).length);
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
    const [alarm, water] = [...document.querySelectorAll("ha-switch-time-card, ha-media-card, ha-room-card, ha-status-card")].map((c) => c.shadowRoot);
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
  const keys = res.chips.map((c) => c.split(":")[0]).join(",");
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

// Theme-Umschalter
await p.click('[data-theme="dark"]');
(await p.evaluate(() => document.body.classList.contains("dark"))) ? ok("Dunkel-Modus umschaltbar") : fail("Dunkel-Modus");

errors.length ? fail(`Konsolenfehler: ${errors.join(" | ")}`) : ok("keine Konsolenfehler");
await browser.close();
