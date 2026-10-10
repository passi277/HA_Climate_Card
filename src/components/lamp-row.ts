import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant } from "../types";
import { localize } from "../localize/localize";
import {
  brightnessPct, isNoEffect, kelvinToRgb, lightColor, supportsBrightness, supportsColor, supportsColorTemp, UNAVAILABLE,
} from "../utils";
import "./gradient-slider";
import "./attribute-select";

const WARM = "rgb(255,196,107)";
const HUE_GRADIENT = "linear-gradient(90deg, #f00, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00)";
const NO_EFFECT = "__hcc_no_effect__";
const rgb = (c: [number, number, number]) => `rgb(${c.join(",")})`;

/**
 * Eine Lampe als Zeile: Symbol in Lichtfarbe, Name, Status, Ein/Aus, leuchtender Helligkeitsregler
 * (nur dimmbar) und über ⚙ Weißton/Farbe/Effekt – genau das, was die Lampe kann.
 */
@customElement("hcc-lamp-row")
export class LampRow extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property() entity = "";
  @property() name?: string;
  @property() icon?: string;
  @state() private _open = false;
  /** Werte, bis die Lampe ihren neuen Zustand meldet (kein Zurückspringen der Regler) */
  @state() private _pending: Record<string, number> = {};
  private _sentAt?: string;
  private _timers: Record<string, number> = {};

  private get _st(): HassEntity | undefined {
    return this.hass?.states[this.entity];
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    return !old || old.states[this.entity] !== this.hass?.states[this.entity] || old.locale !== this.hass?.locale;
  }

  protected updated(changed: PropertyValues): void {
    const st = this._st;
    if (changed.has("hass") && st && this._sentAt && st.last_updated !== this._sentAt) {
      this._sentAt = undefined;
      this._pending = {};
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    Object.values(this._timers).forEach((t) => clearTimeout(t));
  }

  private _t(key: string): string {
    return localize(this.hass, key);
  }

  private _haptic(type = "light"): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: type }));
  }

  private _call(service: "turn_on" | "toggle", data: Record<string, unknown> = {}): void {
    if (!this.hass) return;
    this._sentAt = this._st?.last_updated;
    this.hass.callService("light", service, { entity_id: this.entity, ...data }).catch((err) => {
      this._pending = {};
      this._haptic("failure");
      this.dispatchEvent(new CustomEvent("hass-notification", {
        detail: { message: `${this._t("card.error")}: ${err?.message ?? err}` }, bubbles: true, composed: true,
      }));
    });
  }

  /** Wert merken und kurz verzögert senden (sammelt schnelles Ziehen). */
  private _set(kind: string, value: number, data: Record<string, unknown>): void {
    this._pending = { ...this._pending, [kind]: value };
    clearTimeout(this._timers[kind]);
    this._timers[kind] = window.setTimeout(() => this._call("turn_on", data), 150);
  }

  private _moreInfo(): void {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: this.entity }, bubbles: true, composed: true }));
  }

  private _effects(st: HassEntity): string[] {
    return [...new Set(((st.attributes.effect_list ?? []) as unknown[]).map(String).filter((x) => !isNoEffect(x)))];
  }

  private _status(st: HassEntity, pct: number): string {
    if (UNAVAILABLE.includes(st.state)) return this._t("card.unavailable");
    if (st.state !== "on") return this._t("light.off");
    const parts: string[] = [supportsBrightness(st) ? `${pct} %` : this._t("light.on")];
    const a = st.attributes;
    if (!isNoEffect(a.effect)) parts.push(String(a.effect));
    else if (a.color_mode === "color_temp" && a.color_temp_kelvin) parts.push(`${Math.round(Number(this._pending.k ?? a.color_temp_kelvin))} K`);
    else if (Array.isArray(a.rgb_color) && supportsColor(st)) parts.push(this._t("light.color"));
    return parts.join(" · ");
  }

  private _setEffect(st: HassEntity, value: string): void {
    this._haptic("selection");
    if (value !== NO_EFFECT) return this._call("turn_on", { effect: value });
    const named = ((st.attributes.effect_list ?? []) as unknown[]).map(String).find((e) => isNoEffect(e) && e.trim() !== "");
    if (named) return this._call("turn_on", { effect: named });
    const a = st.attributes;
    if (a.color_mode === "color_temp" && a.color_temp_kelvin) return this._call("turn_on", { color_temp_kelvin: a.color_temp_kelvin });
    if (Array.isArray(a.rgb_color)) return this._call("turn_on", { rgb_color: a.rgb_color });
    this._call("turn_on");
  }

  private _renderDetails(st: HassEntity) {
    const a = st.attributes;
    const parts = [];
    if (supportsColorTemp(st)) {
      const min = Number(a.min_color_temp_kelvin ?? 2000);
      const max = Number(a.max_color_temp_kelvin ?? 6500);
      const value = this._pending.k ?? Number(a.color_temp_kelvin ?? Math.round((min + max) / 2));
      parts.push(html`<hcc-gradient-slider small class="temp" .min=${min} .max=${max} .step=${50} .value=${value}
        .label=${this._t("light.temperature")} .icon=${"mdi:thermometer"} .display=${`${Math.round(value)} K`}
        .gradient=${`linear-gradient(90deg, ${rgb(kelvinToRgb(min))}, ${rgb(kelvinToRgb((min + max) / 2))}, ${rgb(kelvinToRgb(max))})`}
        .knob=${rgb(kelvinToRgb(value))}
        @value-changing=${(e: CustomEvent) => { this._pending = { ...this._pending, k: e.detail.value }; }}
        @value-changed=${(e: CustomEvent) => this._set("k", e.detail.value, { color_temp_kelvin: e.detail.value })}>
      </hcc-gradient-slider>`);
    }
    if (supportsColor(st)) {
      const hue = this._pending.h ?? (Array.isArray(a.hs_color) ? Math.round(a.hs_color[0]) : 0);
      parts.push(html`<hcc-gradient-slider small class="hue" .min=${0} .max=${359} .value=${hue} .label=${this._t("light.color")}
        .icon=${"mdi:palette"} .display=${`${hue}°`} .gradient=${HUE_GRADIENT} .knob=${`hsl(${hue}, 100%, 50%)`}
        @value-changing=${(e: CustomEvent) => { this._pending = { ...this._pending, h: e.detail.value }; }}
        @value-changed=${(e: CustomEvent) => this._set("h", e.detail.value, { hs_color: [e.detail.value, 100] })}>
      </hcc-gradient-slider>`);
    }
    const effects = this._effects(st);
    if (effects.length) {
      parts.push(html`<hcc-attribute-select .label=${this._t("light.effect")} .icon=${"mdi:auto-fix"} .dropdownThreshold=${4}
        .selected=${isNoEffect(a.effect) ? NO_EFFECT : String(a.effect)}
        .options=${[{ value: NO_EFFECT, label: this._t("light.no_effect") },
          ...effects.map((e) => ({ value: e, label: e.charAt(0).toUpperCase() + e.slice(1) }))]}
        @option-selected=${(e: CustomEvent) => this._setEffect(st, e.detail.value)}></hcc-attribute-select>`);
    }
    return parts;
  }

  protected render() {
    const st = this._st;
    if (!st || !this.hass) return nothing;
    const on = st.state === "on";
    const unavailable = UNAVAILABLE.includes(st.state);
    const dim = supportsBrightness(st);
    const pct = this._pending.b ?? brightnessPct(st);
    const color = lightColor(st) ?? WARM;
    const hasDetails = !unavailable && (supportsColorTemp(st) || supportsColor(st) || this._effects(st).length > 0);
    const open = hasDetails && on && this._open;
    const name = this.name ?? String(st.attributes.friendly_name ?? this.entity);
    const icon = this.icon ?? st.attributes.icon ?? (on ? "mdi:lightbulb-on" : "mdi:lightbulb-outline");
    return html`<div class="lamp ${on ? "on" : ""} ${unavailable ? "unavailable" : ""}" style="--lc:${color}">
      <div class="lamp-head">
        <button class="lamp-title" @click=${this._moreInfo}>
          <span class="lamp-icon"><ha-icon .icon=${icon}></ha-icon></span>
          <span class="lamp-text">
            <span class="lamp-name">${name}</span>
            <span class="lamp-state">${this._status(st, pct)}</span>
          </span>
        </button>
        ${hasDetails && on ? html`<button class="lamp-more ${open ? "open" : ""}" aria-expanded=${open}
          aria-label="${name}: ${this._t(open ? "card.less" : "card.more")}" @click=${() => { this._open = !this._open; }}>
          <ha-icon icon="mdi:tune-variant"></ha-icon></button>` : nothing}
        <button class="lamp-power ${on ? "on" : ""}" ?disabled=${unavailable}
          aria-label="${name}: ${this._t(on ? "card.turn_off" : "card.turn_on")}"
          @click=${() => { this._haptic(); this._call("toggle"); }}>
          <ha-icon icon="mdi:power"></ha-icon>
        </button>
      </div>
      ${dim && !unavailable ? html`<hcc-gradient-slider small class="brightness" .min=${1} .max=${100} .value=${on ? pct : 0}
        .fill=${true} .active=${on} .color=${color} .label=${""}
        @value-changing=${(e: CustomEvent) => { this._pending = { ...this._pending, b: e.detail.value }; }}
        @value-changed=${(e: CustomEvent) => this._set("b", e.detail.value, { brightness_pct: e.detail.value })}>
      </hcc-gradient-slider>` : nothing}
      ${open ? html`<div class="lamp-details">${this._renderDetails(st)}</div>` : nothing}
    </div>`;
  }

  static styles = css`
    :host { display: block; }
    .lamp { display: flex; flex-direction: column; gap: 8px; padding: 8px 10px 10px; border-radius: var(--hcc-inner-radius, 14px);
      background: rgba(127,127,127,0.1); transition: background 0.4s, box-shadow 0.4s;
      animation: slide-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both; }
    .lamp.on { background: color-mix(in srgb, var(--lc) 12%, transparent);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--lc) 26%, transparent); }
    .lamp.unavailable { opacity: 0.5; }
    .lamp-head { display: flex; align-items: center; gap: 8px; }
    .lamp-title { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; border: none; background: none;
      padding: 0; cursor: pointer; text-align: left; font: inherit; color: inherit; }
    .lamp-icon { width: 34px; height: 34px; flex: none; border-radius: 50%; display: grid; place-items: center;
      background: rgba(127,127,127,0.14); color: var(--secondary-text-color); transition: background 0.4s, color 0.4s, box-shadow 0.4s; }
    .lamp-icon ha-icon { --mdc-icon-size: 20px; }
    .lamp.on .lamp-icon { background: color-mix(in srgb, var(--lc) 24%, transparent); color: var(--lc);
      box-shadow: 0 0 14px color-mix(in srgb, var(--lc) 45%, transparent); }
    .lamp.on .lamp-icon ha-icon { filter: drop-shadow(0 0 5px color-mix(in srgb, var(--lc) 70%, transparent)); }
    .lamp-text { display: flex; flex-direction: column; min-width: 0; }
    .lamp-name { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .lamp-state { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .lamp-more, .lamp-power { width: 34px; height: 34px; flex: none; border-radius: 50%; border: none; cursor: pointer;
      display: grid; place-items: center; background: rgba(127,127,127,0.14); color: var(--secondary-text-color);
      transition: background 0.3s, color 0.3s, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .lamp-more ha-icon, .lamp-power ha-icon { --mdc-icon-size: 18px; }
    .lamp-more:active, .lamp-power:active { transform: scale(0.9); }
    .lamp-more.open { background: color-mix(in srgb, var(--lc) 26%, transparent); color: var(--primary-text-color); }
    .lamp-power.on { background: var(--lc); color: rgba(0,0,0,0.7); box-shadow: 0 0 12px color-mix(in srgb, var(--lc) 55%, transparent); }
    .lamp-power:disabled { opacity: 0.4; cursor: default; }
    .lamp-more:focus-visible, .lamp-power:focus-visible, .lamp-title:focus-visible { outline: 2px solid var(--lc); outline-offset: 2px; }
    .lamp-details { display: flex; flex-direction: column; gap: 12px; padding-top: 4px; animation: slide-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both; }
    @keyframes slide-in { from { opacity: 0; transform: translateY(-6px) scale(0.98); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .lamp, .lamp-details { animation: none; } }
  `;
}
