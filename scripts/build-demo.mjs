// Baut demo/index.html als eigenständige Datei (Karte + benötigte Icons eingebettet),
// damit die Demo ohne Webserver direkt im Browser geöffnet werden kann.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as mdi from "@mdi/js";

const root = new URL("..", import.meta.url).pathname;
const template = readFileSync(join(root, "demo/template.html"), "utf8");
const card = readFileSync(join(root, "dist/ha-modern-home-cards.js"), "utf8").replace(/<\/script/gi, "<\\/script");

const sources = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".ts")) sources.push(readFileSync(p, "utf8"));
  }
};
walk(join(root, "src"));
sources.push(template);

const toKey = (name) => "mdi" + name.split("-").filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join("");
const icons = {};
for (const [, name] of sources.join("\n").matchAll(/mdi:([a-z0-9-]+)/g)) {
  const key = toKey(name);
  if (mdi[key]) icons[key] = mdi[key];
}

const out = template.replace("/*__CARD__*/", () => card).replace("/*__ICONS__*/{}", () => JSON.stringify(icons));
writeFileSync(join(root, "demo/index.html"), out);
console.log(`demo/index.html erstellt (${Object.keys(icons).length} Icons, ${(out.length / 1024).toFixed(0)} KB)`);
