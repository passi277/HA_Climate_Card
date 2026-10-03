import { css, html, nothing } from "lit";
import type { HassEntity, HomeAssistant, LightCardConfig } from "../types";
import { localize } from "../localize/localize";
import { DEFAULT_LIGHT_PRESETS, kelvinToRgb, presetActive, type LightPreset } from "../utils";

/** Presets aus der Konfiguration („default“ = Hell/Warm/Gemütlich, nur bei Lampen mit Weißton). */
export const resolvePresets = (cfg: LightCardConfig["presets"], canTemp: boolean): LightPreset[] => {
  if (cfg === "default") return canTemp ? DEFAULT_LIGHT_PRESETS : [];
  return Array.isArray(cfg) ? cfg.filter((p) => p?.name) : [];
};

const presetColor = (p: LightPreset): string =>
  p.rgb ? `rgb(${p.rgb.join(",")})` : p.kelvin ? `rgb(${kelvinToRgb(p.kelvin).join(",")})` : "rgb(255,196,107)";

/** Preset-Chips; `st` bestimmt, welches Preset gerade aktiv ist. */
export const renderPresetChips = (hass: HomeAssistant, presets: LightPreset[], st: HassEntity | undefined, onPick: (p: LightPreset) => void) => {
  if (!presets.length) return nothing;
  return html`<div class="presets" role="group" aria-label=${localize(hass, "light.presets")}>
    ${presets.map((p) => {
      const on = presetActive(st, p);
      const label = ["bright", "warm", "cozy"].includes(p.name) ? localize(hass, `light.preset_${p.name}`) : p.name;
      return html`<button class="preset ${on ? "on" : ""}" style="--pc:${presetColor(p)}" aria-pressed=${on} @click=${() => onPick(p)}>
        <ha-icon .icon=${p.icon ?? "mdi:lightbulb-outline"}></ha-icon><span>${label}</span>
        ${p.brightness != null ? html`<small>${p.brightness} %</small>` : nothing}
      </button>`;
    })}
  </div>`;
};

export const presetStyles = css`
  .presets { display: grid; grid-template-columns: repeat(auto-fit, minmax(84px, 1fr)); gap: 8px; }
  .preset { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 6px; border: none; cursor: pointer;
    border-radius: var(--hcc-inner-radius, 14px); background: rgba(127,127,127,0.1); color: var(--primary-text-color);
    font: inherit; font-size: 12px; font-weight: 500; transition: background 0.3s, box-shadow 0.3s, transform 0.2s var(--ease-spring); }
  .preset ha-icon { --mdc-icon-size: 22px; color: var(--pc); transition: filter 0.3s; }
  .preset small { font-size: 11px; color: var(--secondary-text-color); }
  .preset:hover { background: color-mix(in srgb, var(--pc) 16%, transparent); }
  .preset:active { transform: scale(0.95); }
  .preset.on { background: color-mix(in srgb, var(--pc) 24%, transparent); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--pc) 60%, transparent); }
  .preset.on ha-icon { filter: drop-shadow(0 0 6px color-mix(in srgb, var(--pc) 80%, transparent)); }
  .preset:focus-visible { outline: 2px solid var(--pc); outline-offset: 2px; }
`;
