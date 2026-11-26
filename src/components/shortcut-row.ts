import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { HassEntity, HomeAssistant } from "../types";

export interface ShortcutItem {
  entity: string;
  name: string;
  icon?: string;
}

const TOGGLE_DOMAINS = ["switch", "input_boolean", "light", "fan", "automation", "siren", "humidifier"];

const DOMAIN_ICONS: Record<string, string> = {
  switch: "mdi:toggle-switch-variant",
  input_boolean: "mdi:toggle-switch-variant",
  light: "mdi:lightbulb",
  fan: "mdi:fan",
  script: "mdi:script-text-play",
  scene: "mdi:palette",
  button: "mdi:gesture-tap-button",
  input_button: "mdi:gesture-tap-button",
  automation: "mdi:robot",
};

/** Symbol-Fallback anhand typischer Namen (z.B. Gree-Schalter), falls HA kein Icon liefert. */
const KEYWORD_ICONS: [RegExp, string][] = [
  [/licht|light|panel|display|led/i, "mdi:lightbulb-outline"],
  [/leise|quiet|silent/i, "mdi:volume-off"],
  [/frisch|fresh|air/i, "mdi:air-filter"],
  [/xfan|x-fan|zusatz|dry/i, "mdi:fan-plus"],
  [/health|ion|plasma/i, "mdi:shimmer"],
  [/turbo|boost|power/i, "mdi:rocket-launch-outline"],
  [/sleep|schlaf/i, "mdi:sleep"],
  [/timer/i, "mdi:timer-outline"],
];

export const fallbackIcon = (stateObj: HassEntity | undefined, entityId: string, name: string): string => {
  if (stateObj?.attributes.icon) return stateObj.attributes.icon;
  const match = KEYWORD_ICONS.find(([re]) => re.test(entityId) || re.test(name));
  return match?.[1] ?? DOMAIN_ICONS[entityId.split(".")[0]] ?? "mdi:gesture-tap";
};

/** Reihe von Umschalt-/Aktions-Buttons für Schalter, Skripte, Szenen und Buttons. */
@customElement("hcc-shortcut-row")
export class ShortcutRow extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ attribute: false }) items: ShortcutItem[] = [];

  private _activate(item: ShortcutItem): void {
    if (!this.hass) return;
    window.dispatchEvent(new CustomEvent("haptic", { detail: "light" }));
    const domain = item.entity.split(".")[0];
    const data = { entity_id: item.entity };
    if (TOGGLE_DOMAINS.includes(domain)) this.hass.callService("homeassistant", "toggle", data);
    else if (domain === "button" || domain === "input_button") this.hass.callService(domain, "press", data);
    else if (domain === "script" || domain === "scene") this.hass.callService(domain, "turn_on", data);
    else this.hass.callService("homeassistant", "toggle", data);
  }

  private _moreInfo(ev: Event, entityId: string): void {
    ev.preventDefault();
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  private _icon(item: ShortcutItem, stateObj?: HassEntity) {
    if (!item.icon && stateObj && customElements.get("ha-state-icon")) {
      return html`<ha-state-icon .hass=${this.hass} .stateObj=${stateObj}></ha-state-icon>`;
    }
    return html`<ha-icon .icon=${item.icon ?? fallbackIcon(stateObj, item.entity, item.name)}></ha-icon>`;
  }

  protected render() {
    if (!this.hass || !this.items.length) return nothing;
    const lang = this.hass.locale?.language ?? this.hass.language;
    return html`<div class="row" lang=${lang}>
      ${this.items.map((item) => {
        const st = this.hass!.states[item.entity];
        const on = st?.state === "on";
        const unavailable = !st || st.state === "unavailable";
        return html`<button class="sc ${on ? "on" : ""}" ?disabled=${unavailable} title=${item.name}
          aria-pressed=${TOGGLE_DOMAINS.includes(item.entity.split(".")[0]) ? String(on) : nothing}
          @click=${() => this._activate(item)} @contextmenu=${(e: Event) => this._moreInfo(e, item.entity)}>
          ${this._icon(item, st)}
          <span>${item.name}</span>
        </button>`;
      })}
    </div>`;
  }

  static styles = css`
    .row { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
    .sc {
      display: flex; align-items: center; gap: 10px; padding: 8px 10px; min-height: 48px; border: none; text-align: left;
      border-radius: var(--hcc-inner-radius, 14px); background: var(--hcc-chip-bg, rgba(127,127,127,0.12)); color: var(--secondary-text-color);
      font: inherit; font-size: 13px; cursor: pointer; transition: background 0.25s, color 0.25s, box-shadow 0.3s, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); min-width: 0;
    }
    .sc span { max-width: 100%; line-height: 1.25; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; -webkit-hyphens: auto; hyphens: auto; }
    .sc:hover { background: rgba(127,127,127,0.2); }
    .sc:active { transform: scale(0.95); }
    .sc.on { background: color-mix(in srgb, var(--hcc-accent, var(--primary-color)) 22%, transparent); color: var(--hcc-accent, var(--primary-color));
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--hcc-accent, var(--primary-color)) 30%, transparent); }
    .sc.on ha-icon, .sc.on ha-state-icon { filter: drop-shadow(0 0 6px color-mix(in srgb, var(--hcc-accent, var(--primary-color)) 60%, transparent)); }
    .sc:focus-visible { outline: 2px solid var(--hcc-accent, var(--primary-color)); outline-offset: 2px; }
    .sc:disabled { opacity: 0.4; cursor: default; }
    ha-icon, ha-state-icon { --mdc-icon-size: 22px; flex: none; }
  `;
}
