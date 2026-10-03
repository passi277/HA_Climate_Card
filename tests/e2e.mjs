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
