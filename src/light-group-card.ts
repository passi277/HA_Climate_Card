import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant, LightGroupCardConfig } from "./types";
import { localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import {
  brightnessPct, isNoEffect, kelvinToRgb, lightColor, supportsBrightness, supportsColor, supportsColorTemp, UNAVAILABLE,
} from "./utils";
import "./components/gradient-slider";
import { presetStyles, renderPresetChips, resolvePresets } from "./components/preset-chips";
import { presetData } from "./utils";
import "./components/attribute-select";
import "./light-group-editor";

const OFF_COLOR = "var(--state-light-off-color, #8a8a8a)";
const WARM = "rgb(255,196,107)";
const HUE_SWATCHES = [0, 28, 50, 120, 180, 220, 270, 320];
const WHITE_PRESETS = [2700, 4000, 6000];
const HUE_GRADIENT = "linear-gradient(90deg, #f00, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00)";
const NO_EFFECT = "__hcc_no_effect__";
const rgb = (c: [number, number, number]) => `rgb(${c.join(",")})`;

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-light-group-card",
  name: "Modern Light Group Card",
  description: "Mehrere Lampen frei zusammenstellen: oben die ganze Gruppe, darunter jede Lampe mit genau den Funktionen, die sie kann (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

interface Lamp {
  entity: string;
  name: string;
  icon?: string;
  st: HassEntity;
  dim: boolean;
  temp: boolean;
  color: boolean;
  effects: string[];
}

/** Was wurde gesendet, bis die Lampe ihren neuen Zustand meldet (verhindert Zurückspringen der Regler). */
interface Pending { value: number; sentAt?: string; }

@customElement("ha-light-group-card")
export class HaLightGroupCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: LightGroupCardConfig;
  @state() private _pending: Record<string, Pending> = {};
  @state() private _open = new Set<string>();
  @state() private _listOpen = true;
  @state() private _groupColorOpen = false;
  private _timers: Record<string, number> = {};

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-light-group-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<LightGroupCardConfig> {
    const lamps = Object.values(hass.states)
      .filter((s) => s.entity_id.startsWith("light.") && !Array.isArray(s.attributes.entity_id))
      .slice(0, 3)
      .map((s) => s.entity_id);
    return { entities: lamps };
  }

  public setConfig(config: LightGroupCardConfig): void {
    if (!config || !Array.isArray(config.entities)) {
      throw new Error("ha-light-group-card: 'entities' muss eine Liste von Lampen sein");
    }
    const collapsedChanged = this._config?.collapsed !== config.collapsed;
    this._config = { ...config };
    if (collapsedChanged) this._listOpen = !config.collapsed;
  }

  public getCardSize(): number {
    return 2 + (this._config?.entities.length ?? 0);
  }

  public getGridOptions() {
    return { columns: 6, min_columns: 4, rows: "auto" };
  }

  private _t(key: string): string {
    return localize(this.hass, key);
  }

  private _lamps(): Lamp[] {
    const hass = this.hass!;
    return this._config!.entities
      .map((e) => (typeof e === "string" ? { entity: e } : e))
      .filter((e) => e?.entity && hass.states[e.entity])
      .map((e) => {
        const st = hass.states[e.entity];
        return {
          entity: e.entity,
          name: e.name ?? String(st.attributes.friendly_name ?? e.entity),
          icon: e.icon,
          st,
          dim: supportsBrightness(st),
          temp: supportsColorTemp(st),
          color: supportsColor(st),
          effects: [...new Set(((st.attributes.effect_list ?? []) as unknown[]).map(String).filter((x) => !isNoEffect(x)))],
        };
      });
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this._config) return true;
    return this._config.entities.some((e) => {
      const id = typeof e === "string" ? e : e.entity;
      return old.states[id] !== this.hass!.states[id];
    }) || old.locale !== this.hass!.locale;
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!changed.has("hass") || !this.hass) return;
    // Wert verwerfen, sobald die Lampe(n) einen neuen Zustand gemeldet haben
    let dirty = false;
    const next = { ...this._pending };
    for (const [key, p] of Object.entries(next)) {
      if (!p.sentAt) continue;
      const ids = key.split("|")[0].split(",");
      const sent = p.sentAt.split(",");
      if (ids.some((id, i) => this.hass!.states[id]?.last_updated !== sent[i])) {
        delete next[key];
        dirty = true;
      }
    }
    if (dirty) this._pending = next;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    Object.values(this._timers).forEach((t) => clearTimeout(t));
  }

  // ---------- Aktionen ----------

  private _haptic(type = "light"): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: type }));
  }

  private _call(service: "turn_on" | "turn_off" | "toggle", ids: string[], data: Record<string, unknown> = {}): void {
    if (!this.hass || !ids.length) return;
    this.hass.callService("light", service, { entity_id: ids.length === 1 ? ids[0] : ids, ...data }).catch((err) => {
      this._haptic("failure");
      this.dispatchEvent(new CustomEvent("hass-notification", {
        detail: { message: `${this._t("card.error")}: ${err?.message ?? err}` }, bubbles: true, composed: true,
      }));
    });
  }

  /** Wert merken und (verzögert) senden. Schlüssel: "<ids>|<art>". */
  private _set(ids: string[], kind: string, value: number, data: Record<string, unknown>, delay = 150): void {
    const key = `${ids.join(",")}|${kind}`;
    this._pending = { ...this._pending, [key]: { value } };
    clearTimeout(this._timers[key]);
    this._timers[key] = window.setTimeout(() => {
      const sentAt = ids.map((id) => this.hass!.states[id]?.last_updated ?? "").join(",");
      this._pending = { ...this._pending, [key]: { value, sentAt } };
      this._call("turn_on", ids, data);
    }, delay);
  }

  private _pendingValue(ids: string[], kind: string): number | undefined {
    return this._pending[`${ids.join(",")}|${kind}`]?.value;
  }

  private _moreInfo(entityId: string): void {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  private _toggleOpen(entity: string): void {
    const open = new Set(this._open);
    if (open.has(entity)) open.delete(entity);
    else open.add(entity);
    this._open = open;
  }

  // ---------- Gruppe ----------

  private _groupBrightness(lamps: Lamp[]): number {
    const on = lamps.filter((l) => l.dim && l.st.state === "on");
    if (!on.length) return lamps.some((l) => l.st.state === "on") ? 100 : 0;
    return Math.round(on.reduce((sum, l) => sum + brightnessPct(l.st), 0) / on.length);
  }

  /** Farbe/Weißton für alle: nur eingeschaltete Lampen (oder alle, wenn keine an ist), die das können. */
  private _targets(lamps: Lamp[], can: (l: Lamp) => boolean): string[] {
    const capable = lamps.filter((l) => can(l) && !UNAVAILABLE.includes(l.st.state));
    const on = capable.filter((l) => l.st.state === "on");
    return (on.length ? on : capable).map((l) => l.entity);
  }

  private _renderGroup(lamps: Lamp[]) {
    const dimIds = lamps.filter((l) => l.dim && !UNAVAILABLE.includes(l.st.state)).map((l) => l.entity);
    const anyOn = lamps.some((l) => l.st.state === "on");
    const pct = this._pendingValue(dimIds, "b") ?? this._groupBrightness(lamps);
    const first = lamps.find((l) => l.st.state === "on");
    const color = lightColor(first?.st) ?? WARM;
    const tempIds = this._targets(lamps, (l) => l.temp);
    const colorIds = this._targets(lamps, (l) => l.color);
    const colorable = this._config!.group_color !== false && (tempIds.length || colorIds.length);
    return html`
      ${dimIds.length ? html`<hcc-gradient-slider class="group-slider" .min=${1} .max=${100} .value=${anyOn ? pct : 0}
        .label=${this._t("light_group.all")} .icon=${"mdi:brightness-6"}
        .display=${anyOn ? `${pct} %` : this._t("light.off")} .fill=${true} .active=${anyOn} .color=${color}
        @value-changing=${(e: CustomEvent) => { this._pending = { ...this._pending, [`${dimIds.join(",")}|b`]: { value: e.detail.value } }; }}
        @value-changed=${(e: CustomEvent) => this._set(dimIds, "b", e.detail.value, { brightness_pct: e.detail.value })}>
      </hcc-gradient-slider>` : nothing}
      ${renderPresetChips(this.hass!, resolvePresets(this._config!.presets, lamps.some((l) => l.temp)), lamps.find((l) => l.temp && l.st.state === "on")?.st,
        (p) => { this._haptic("selection"); this._call("turn_on", lamps.filter((l) => !UNAVAILABLE.includes(l.st.state) && (p.kelvin == null || l.temp) && (!p.rgb || l.color)).map((l) => l.entity), presetData(p)); })}
      ${colorable ? html`<div class="group-colors">
        <button class="mini-toggle ${this._groupColorOpen ? "open" : ""}" aria-expanded=${this._groupColorOpen}
          @click=${() => { this._groupColorOpen = !this._groupColorOpen; }}>
          <ha-icon icon="mdi:palette-outline"></ha-icon>${this._t("light_group.color_all")}
          <ha-icon class="chevron" icon="mdi:chevron-down"></ha-icon>
        </button>
        ${this._groupColorOpen ? html`<div class="swatches">
          ${tempIds.length ? WHITE_PRESETS.map((k) => html`<button class="swatch" title="${k} K" aria-label="${k} K"
            style="--sw:${rgb(kelvinToRgb(k))}" @click=${() => { this._haptic("selection"); this._call("turn_on", tempIds, { color_temp_kelvin: k }); }}></button>`) : nothing}
          ${colorIds.length ? HUE_SWATCHES.map((h) => html`<button class="swatch" aria-label="${h}°" style="--sw:hsl(${h}, 100%, 50%)"
            @click=${() => { this._haptic("selection"); this._call("turn_on", colorIds, { hs_color: [h, 100] }); }}></button>`) : nothing}
        </div>` : nothing}
      </div>` : nothing}`;
  }

  // ---------- Einzellampe ----------

  private _lampStatus(l: Lamp, pct: number): string {
    const st = l.st;
    if (UNAVAILABLE.includes(st.state)) return this._t("card.unavailable");
    if (st.state !== "on") return this._t("light.off");
    const parts: string[] = [l.dim ? `${pct} %` : this._t("light.on")];
    const a = st.attributes;
    if (!isNoEffect(a.effect)) parts.push(String(a.effect));
    else if (a.color_mode === "color_temp" && a.color_temp_kelvin) parts.push(`${Math.round(Number(a.color_temp_kelvin))} K`);
    else if (Array.isArray(a.rgb_color) && l.color) parts.push(this._t("light.color"));
    return parts.join(" · ");
  }

  private _renderLampDetails(l: Lamp) {
    const a = l.st.attributes;
    const ids = [l.entity];
    const parts = [];
    if (l.temp) {
      const min = Number(a.min_color_temp_kelvin ?? 2000);
      const max = Number(a.max_color_temp_kelvin ?? 6500);
      const value = this._pendingValue(ids, "k") ?? Number(a.color_temp_kelvin ?? Math.round((min + max) / 2));
      parts.push(html`<hcc-gradient-slider small .min=${min} .max=${max} .step=${50} .value=${value}
        .label=${this._t("light.temperature")} .icon=${"mdi:thermometer"} .display=${`${Math.round(value)} K`}
        .gradient=${`linear-gradient(90deg, ${rgb(kelvinToRgb(min))}, ${rgb(kelvinToRgb((min + max) / 2))}, ${rgb(kelvinToRgb(max))})`}
        .knob=${rgb(kelvinToRgb(value))}
        @value-changing=${(e: CustomEvent) => { this._pending = { ...this._pending, [`${l.entity}|k`]: { value: e.detail.value } }; }}
        @value-changed=${(e: CustomEvent) => this._set(ids, "k", e.detail.value, { color_temp_kelvin: e.detail.value })}>
      </hcc-gradient-slider>`);
    }
    if (l.color) {
      const hue = this._pendingValue(ids, "h") ?? (Array.isArray(a.hs_color) ? Math.round(a.hs_color[0]) : 0);
      parts.push(html`<hcc-gradient-slider small .min=${0} .max=${359} .value=${hue} .label=${this._t("light.color")}
        .icon=${"mdi:palette"} .display=${`${hue}°`} .gradient=${HUE_GRADIENT} .knob=${`hsl(${hue}, 100%, 50%)`}
        @value-changing=${(e: CustomEvent) => { this._pending = { ...this._pending, [`${l.entity}|h`]: { value: e.detail.value } }; }}
        @value-changed=${(e: CustomEvent) => this._set(ids, "h", e.detail.value, { hs_color: [e.detail.value, 100] })}>
      </hcc-gradient-slider>`);
    }
    if (l.effects.length) {
      parts.push(html`<hcc-attribute-select .label=${this._t("light.effect")} .icon=${"mdi:auto-fix"} .dropdownThreshold=${4}
        .selected=${isNoEffect(a.effect) ? NO_EFFECT : String(a.effect)}
        .options=${[{ value: NO_EFFECT, label: this._t("light.no_effect") },
          ...l.effects.map((e) => ({ value: e, label: e.charAt(0).toUpperCase() + e.slice(1) }))]}
        @option-selected=${(e: CustomEvent) => this._setEffect(l, e.detail.value)}></hcc-attribute-select>`);
    }
    return parts;
  }

  private _setEffect(l: Lamp, value: string): void {
    this._haptic("selection");
    if (value !== NO_EFFECT) return this._call("turn_on", [l.entity], { effect: value });
    const named = ((l.st.attributes.effect_list ?? []) as unknown[]).map(String).find((e) => isNoEffect(e) && e.trim() !== "");
    if (named) return this._call("turn_on", [l.entity], { effect: named });
    const a = l.st.attributes;
    if (a.color_mode === "color_temp" && a.color_temp_kelvin) return this._call("turn_on", [l.entity], { color_temp_kelvin: a.color_temp_kelvin });
    if (Array.isArray(a.rgb_color)) return this._call("turn_on", [l.entity], { rgb_color: a.rgb_color });
    this._call("turn_on", [l.entity], {});
  }

  private _renderLamp(l: Lamp) {
    const on = l.st.state === "on";
    const unavailable = UNAVAILABLE.includes(l.st.state);
    const pct = this._pendingValue([l.entity], "b") ?? brightnessPct(l.st);
    const color = lightColor(l.st) ?? WARM;
    const hasDetails = !unavailable && (l.temp || l.color || l.effects.length > 0);
    const open = hasDetails && on && this._open.has(l.entity);
    const icon = l.icon ?? l.st.attributes.icon ?? (on ? "mdi:lightbulb-on" : "mdi:lightbulb-outline");
    return html`<div class="lamp ${on ? "on" : ""} ${unavailable ? "unavailable" : ""}" style="--lc:${color}" data-entity=${l.entity}>
      <div class="lamp-head">
        <button class="lamp-title" @click=${() => this._moreInfo(l.entity)}>
          <span class="lamp-icon"><ha-icon .icon=${icon}></ha-icon></span>
          <span class="lamp-text">
            <span class="lamp-name">${l.name}</span>
            <span class="lamp-state">${this._lampStatus(l, pct)}</span>
          </span>
        </button>
        ${hasDetails && on ? html`<button class="lamp-more ${open ? "open" : ""}" aria-expanded=${open}
          aria-label=${this._t(open ? "card.less" : "card.more")} @click=${() => this._toggleOpen(l.entity)}>
          <ha-icon icon="mdi:tune-variant"></ha-icon></button>` : nothing}
        <button class="lamp-power ${on ? "on" : ""}" ?disabled=${unavailable}
          aria-label=${this._t(on ? "card.turn_off" : "card.turn_on")}
          @click=${() => { this._haptic(); this._call("toggle", [l.entity]); }}>
          <ha-icon icon="mdi:power"></ha-icon>
        </button>
      </div>
      ${l.dim && !unavailable ? html`<hcc-gradient-slider small .min=${1} .max=${100} .value=${on ? pct : 0}
        .fill=${true} .active=${on} .color=${color} .label=${""}
        @value-changing=${(e: CustomEvent) => { this._pending = { ...this._pending, [`${l.entity}|b`]: { value: e.detail.value } }; }}
        @value-changed=${(e: CustomEvent) => this._set([l.entity], "b", e.detail.value, { brightness_pct: e.detail.value })}>
      </hcc-gradient-slider>` : nothing}
      ${open ? html`<div class="lamp-details">${this._renderLampDetails(l)}</div>` : nothing}
    </div>`;
  }

  // ---------- Karte ----------

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const lamps = this._lamps();
    const available = lamps.filter((l) => !UNAVAILABLE.includes(l.st.state));
    const onLamps = lamps.filter((l) => l.st.state === "on");
    const anyOn = onLamps.length > 0;
    const pct = this._groupBrightness(lamps);
    const c1 = lightColor(onLamps[0]?.st) ?? (anyOn ? WARM : OFF_COLOR);
    const c2 = lightColor(onLamps[1]?.st) ?? c1;
    const anim = this._config.animations ?? "full";
    const status = !lamps.length
      ? this._t("light_group.no_lights")
      : anyOn
        ? `${onLamps.length} ${this._t("overview.of")} ${lamps.length} ${this._t("light_group.on")}${available.some((l) => l.dim) ? ` · ${pct} %` : ""}`
        : this._t("light_group.all_off");
    const showLights = this._config.show_lights !== false;
    return html`<ha-card class="light-group-card compact ${anyOn ? "active" : "off"} anim-${anim}"
      style="--hcc-accent-c:${c1};--accent2:${c2};--glow-strength:${anyOn ? 0.35 + (pct / 100) * 0.65 : 0.25}">
      <div class="glow"><span class="blob b1"></span><span class="blob b2"></span></div>
      <div class="header">
        <div class="title static">
          <span class="icon-badge ${anyOn ? "active lit" : ""}">
            <ha-icon .icon=${this._config.icon ?? (anyOn ? "mdi:lightbulb-group" : "mdi:lightbulb-group-outline")}></ha-icon>
          </span>
          <span class="names">
            <span class="name">${this._config.title ?? this._t("light_group.title")}</span>
            <span class="status">${status}</span>
          </span>
        </div>
        <button class="power ${anyOn ? "on" : ""}" ?disabled=${!available.length}
          aria-label=${this._t(anyOn ? "light_group.all_off_action" : "light_group.all_on_action")}
          @click=${() => { this._haptic(); this._call(anyOn ? "turn_off" : "turn_on", (anyOn ? onLamps : available).map((l) => l.entity)); }}>
          <ha-icon icon="mdi:power"></ha-icon>
        </button>
      </div>
      ${this._renderGroup(lamps)}
      ${showLights && lamps.length ? html`
        <button class="list-toggle" aria-expanded=${this._listOpen} @click=${() => { this._listOpen = !this._listOpen; }}>
          <span>${this._t("light_group.lights")} · ${lamps.length}</span>
          <ha-icon class="chevron ${this._listOpen ? "open" : ""}" icon="mdi:chevron-down"></ha-icon>
        </button>
        <div class="collapsible ${this._listOpen ? "open" : ""}" ?inert=${!this._listOpen}>
          <div class="collapsible-inner"><div class="lamps">${lamps.map((l) => this._renderLamp(l))}</div></div>
        </div>` : nothing}
    </ha-card>`;
  }

  static styles = [cardStyles, presetStyles, css`
    ha-card.light-group-card { gap: 12px; }
    ha-card.light-group-card .collapsible { margin-top: -12px; }
    ha-card.light-group-card .collapsible.open { margin-top: 0; }
    ha-card.light-group-card .blob { opacity: var(--glow-strength, 0.5); }
    ha-card.light-group-card .b2 { background: radial-gradient(closest-side, color-mix(in srgb, var(--accent2) 26%, transparent), transparent 70%); }
    ha-card.light-group-card.off .blob { animation-play-state: paused; }
    .title.static { cursor: default; }
    .icon-badge.lit { box-shadow: 0 0 18px color-mix(in srgb, var(--accent) 60%, transparent); }
    .icon-badge.lit ha-icon { animation: none; }
    .power:disabled { opacity: 0.4; }
    .group-colors { display: flex; flex-direction: column; gap: 10px; }
    .mini-toggle, .list-toggle { display: flex; align-items: center; gap: 6px; border: none; background: none; cursor: pointer;
      padding: 2px; font: inherit; font-size: 12px; font-weight: 500; color: var(--secondary-text-color);
      text-transform: uppercase; letter-spacing: 0.04em; align-self: flex-start; }
    .mini-toggle ha-icon { --mdc-icon-size: 16px; }
    .list-toggle { align-self: stretch; justify-content: space-between; padding: 4px 2px; }
    .chevron { --mdc-icon-size: 18px; transition: transform 0.3s var(--ease-out); }
    .mini-toggle.open .chevron, .chevron.open { transform: rotate(180deg); }
    .swatches { display: flex; flex-wrap: wrap; gap: 8px; animation: slide-in 0.35s var(--ease-out) both; }
    .swatch { width: 28px; height: 28px; border-radius: 50%; border: none; cursor: pointer; background: var(--sw);
      box-shadow: 0 0 0 2px rgba(255,255,255,0.15), 0 2px 6px rgba(0,0,0,0.25); transition: transform 0.2s var(--ease-spring); }
    .swatch:hover { transform: scale(1.12); }
    .lamps { display: flex; flex-direction: column; gap: 8px; }
    .lamp { display: flex; flex-direction: column; gap: 8px; padding: 8px 10px 10px; border-radius: var(--hcc-inner-radius, 14px);
      background: rgba(127,127,127,0.1); transition: background 0.4s, box-shadow 0.4s;
      animation: slide-in 0.4s var(--ease-out) both; }
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
      transition: background 0.3s, color 0.3s, transform 0.2s var(--ease-spring); }
    .lamp-more ha-icon, .lamp-power ha-icon { --mdc-icon-size: 18px; }
    .lamp-more:active, .lamp-power:active { transform: scale(0.9); }
    .lamp-more.open { background: color-mix(in srgb, var(--lc) 26%, transparent); color: var(--primary-text-color); }
    .lamp-power.on { background: var(--lc); color: rgba(0,0,0,0.7); box-shadow: 0 0 12px color-mix(in srgb, var(--lc) 55%, transparent); }
    .lamp-power:disabled { opacity: 0.4; cursor: default; }
    .lamp-details { display: flex; flex-direction: column; gap: 12px; padding-top: 4px; animation: slide-in 0.35s var(--ease-out) both; }
    ha-card.anim-reduced .lamp, ha-card.anim-off .lamp { animation: none; }
  `];
}
