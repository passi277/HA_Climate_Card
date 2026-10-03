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
import "./components/lamp-row";
import "./light-group-editor";

const OFF_COLOR = "var(--state-light-off-color, #8a8a8a)";
const WARM = "rgb(255,196,107)";
const HUE_SWATCHES = [0, 28, 50, 120, 180, 220, 270, 320];
const WHITE_PRESETS = [2700, 4000, 6000];
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
      ${this._renderScenes()}
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

  /** Szenen-Chips („Gästezimmer Hell“ → „Hell“) */
  private _renderScenes() {
    const scenes = (this._config!.scenes ?? []).map((id) => this.hass!.states[id]).filter((s): s is HassEntity => !!s);
    if (!scenes.length) return nothing;
    const label = (s: HassEntity) => {
      const n = String(s.attributes.name ?? s.attributes.friendly_name ?? s.entity_id);
      const prefix = String(s.attributes.group_name ?? this._config!.title ?? "");
      return prefix && n.toLowerCase().startsWith(prefix.toLowerCase() + " ") ? n.slice(prefix.length + 1) : n;
    };
    return html`<div class="scenes">
      ${scenes.map((s) => html`<button class="scene" data-scene=${s.entity_id} @click=${(e: Event) => {
        this._haptic("selection");
        this.hass!.callService("scene", "turn_on", { entity_id: s.entity_id });
        const el = e.currentTarget as HTMLElement; el.classList.add("fired"); setTimeout(() => el.classList.remove("fired"), 700);
      }}><ha-icon icon="mdi:palette-outline"></ha-icon>${label(s)}</button>`)}
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
          <div class="collapsible-inner"><div class="lamps">${lamps.map((l) => html`<hcc-lamp-row .hass=${this.hass} .entity=${l.entity}
            .name=${l.name} .icon=${l.icon} data-entity=${l.entity}></hcc-lamp-row>`)}</div></div>
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
    .scenes { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
    .scenes::-webkit-scrollbar { display: none; }
    .scene { flex: none; display: inline-flex; align-items: center; gap: 5px; border: none; border-radius: 999px; padding: 7px 13px 7px 10px;
      font: inherit; font-size: 13px; cursor: pointer; background: rgba(127,127,127,0.12); color: var(--primary-text-color);
      transition: background 0.25s, transform 0.2s; }
    .scene ha-icon { --mdc-icon-size: 15px; color: var(--accent); }
    .scene:hover { background: color-mix(in srgb, var(--accent) 20%, transparent); }
    .scene.fired { background: var(--accent); color: #000; transform: scale(0.96); }
    .scene.fired ha-icon { color: #000; }
  `];
}
