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
  [...document.querySelectorAll("ha-climate-card, ha-climate-overview-card, ha-light-card")].filter((c) => c.shadowRoot?.querySelector("ha-card")).length);
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
    const steps = timer.querySelectorAll(".step");
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
    return { lights: root.querySelectorAll(".light").length, scenes: [...root.querySelectorAll(".scene")].map((b) => b.textContent.trim()) };
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
    root.querySelectorAll(".light")[2].click();
  });
  await p.waitForTimeout(300);
  const calls = await p.evaluate((n) => window.serviceCalls.slice(n).map((c) => `${c.domain}.${c.service}:${c.data.entity_id}:${c.data.brightness_pct ?? ""}`), before);
  calls.some((c) => c.startsWith("light.turn_on:light.gaste_wc:") && Number(c.split(":")[2]) > 50)
    ? ok("Licht: Tippen auf den Ring setzt die Helligkeit") : fail(`Ring: ${calls}`);
  calls.some((c) => c.startsWith("scene.turn_on:scene.gaste_wc_")) && calls.some((c) => c.startsWith("light.toggle:light.gaste_wc_spiegel"))
    ? ok("Licht: Szene aktiviert, einzelne Lampe geschaltet") : fail(`Szene/Lampe: ${calls}`);
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
