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
  [...document.querySelectorAll("ha-climate-card, ha-climate-overview-card")].filter((c) => c.shadowRoot?.querySelector("ha-card")).length);
rendered >= 9 ? ok(`${rendered} Karten gerendert`) : fail(`nur ${rendered} Karten gerendert`);

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
