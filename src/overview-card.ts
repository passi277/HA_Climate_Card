import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant, OverviewCardConfig, OverviewEntityConfig } from "./types";
import { ACTION_ICONS, ClimateFeature, MODE_ICONS, supports } from "./const";
import { formatAttribute, formatMode, localize } from "./localize/localize";
import { isActive, modeColor, temperatureOf, UNAVAILABLE } from "./utils";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-climate-overview-card",
  name: "HA Climate Overview",
  description: "Alle Klimaanlagen auf einen Blick – mit Temperatur, Schnellregelung und „Alle aus“.",
  preview: true,
  documentationURL: "https://github.com/passi277/HA_Climate_Card",
});

/** Übersichtskarte für mehrere Klimageräte mit Sollwert-Stepper, Ein/Aus und "Alle aus". */
@customElement("ha-climate-overview-card")
export class HaClimateOverviewCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: OverviewCardConfig;
  @state() private _pending: Record<string, number> = {};
  private _timers: Record<string, number> = {};

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-climate-overview-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<OverviewCardConfig> {
    return { entities: Object.keys(hass.states).filter((id) => id.startsWith("climate.")).slice(0, 3) };
  }

  public setConfig(config: OverviewCardConfig): void {
    if (!Array.isArray(config?.entities) || !config.entities.length) {
      throw new Error("ha-climate-overview-card: 'entities' (Liste von climate-Entitäten) fehlt");
    }
    this._config = { show_all_off: true, show_controls: true, ...config };
  }

  public getCardSize(): number {
    return 1 + (this._config?.entities.length ?? 1);
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  private get _entities(): OverviewEntityConfig[] {
    return (this._config?.entities ?? []).map((e) => (typeof e === "string" ? { entity: e } : e));
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    return !old || this._entities.some((e) => old.states[e.entity] !== this.hass!.states[e.entity]);
  }

  updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!changed.has("hass")) return;
    const old = changed.get("hass") as HomeAssistant | undefined;
    for (const id of Object.keys(this._pending)) {
      if (old && old.states[id] !== this.hass!.states[id]) {
        const { [id]: _, ...rest } = this._pending;
        this._pending = rest;
      }
    }
  }

  private _t(key: string): string {
    return localize(this.hass, key);
  }

  private _unit(): string {
    return this.hass?.config?.unit_system?.temperature ?? "°C";
  }

  private _step(st: HassEntity): number {
    return Number(st.attributes.target_temp_step) || (this._unit() === "°F" ? 1 : 0.5);
  }

  private _fmt(v: number | undefined, step: number): string {
    return v == null ? "–" : v.toFixed(step < 1 ? 1 : 0);
  }

  private _stepTarget(st: HassEntity, dir: 1 | -1): void {
    const step = this._step(st);
    const a = st.attributes;
    const base = this._pending[st.entity_id] ?? Number(a.temperature);
    if (!Number.isFinite(base)) return;
    const next = Math.min(Number(a.max_temp ?? 35), Math.max(Number(a.min_temp ?? 7), base + dir * step));
    this._pending = { ...this._pending, [st.entity_id]: Number(next.toFixed(step < 1 ? 1 : 0)) };
    clearTimeout(this._timers[st.entity_id]);
    this._timers[st.entity_id] = window.setTimeout(() => {
      this.hass!.callService("climate", "set_temperature", { entity_id: st.entity_id, temperature: this._pending[st.entity_id] });
    }, 1000);
  }

  private _togglePower(st: HassEntity): void {
    const a = st.attributes;
    if (st.state === "off") {
      if (supports(a, ClimateFeature.TURN_ON)) this.hass!.callService("climate", "turn_on", { entity_id: st.entity_id });
      else {
        const mode = (a.hvac_modes as string[] | undefined)?.find((m) => m !== "off");
        if (mode) this.hass!.callService("climate", "set_hvac_mode", { entity_id: st.entity_id, hvac_mode: mode });
      }
    } else if (supports(a, ClimateFeature.TURN_OFF)) this.hass!.callService("climate", "turn_off", { entity_id: st.entity_id });
    else this.hass!.callService("climate", "set_hvac_mode", { entity_id: st.entity_id, hvac_mode: "off" });
  }

  private _allOff(ids: string[]): void {
    for (const id of ids) {
      const st = this.hass!.states[id];
      if (supports(st.attributes, ClimateFeature.TURN_OFF)) this.hass!.callService("climate", "turn_off", { entity_id: id });
      else this.hass!.callService("climate", "set_hvac_mode", { entity_id: id, hvac_mode: "off" });
    }
  }

  private _moreInfo(entityId: string): void {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  private _renderRow(cfg: OverviewEntityConfig) {
    const st = this.hass!.states[cfg.entity];
    if (!st) return html`<div class="row missing">${this._t("card.entity_not_found")}: ${cfg.entity}</div>`;
    const a = st.attributes;
    const color = modeColor(st);
    const off = st.state === "off";
    const unavailable = UNAVAILABLE.includes(st.state);
    const step = this._step(st);
    const current = temperatureOf(st);
    const target = this._pending[st.entity_id] ?? (a.temperature != null ? Number(a.temperature) : undefined);
    const range = a.target_temp_low != null && a.target_temp_high != null && a.temperature == null;
    const action = a.hvac_action as string | undefined;
    const status = unavailable ? this._t("card.unavailable")
      : action ? formatAttribute(this.hass!, st, "hvac_action", action) : formatMode(this.hass!, st, st.state);
    const name = cfg.name ?? a.friendly_name ?? st.entity_id;
    const active = isActive(st) && !!action;
    return html`<div class="row ${off ? "off" : ""}" style="--accent:${color}">
      <button class="info" @click=${() => this._moreInfo(st.entity_id)}>
        <span class="badge ${active ? "active" : ""}">
          <ha-icon .icon=${ACTION_ICONS[action ?? ""] ?? MODE_ICONS[st.state] ?? "mdi:air-conditioner"}></ha-icon>
        </span>
        <span class="names">
          <span class="name">${name}</span>
          <span class="status">${status}${current != null ? html` · <ha-icon icon="mdi:home-thermometer-outline"></ha-icon>${this._fmt(current, step)}°` : nothing}</span>
        </span>
      </button>
      ${this._config!.show_controls && !off && !unavailable
        ? range
          ? html`<span class="target">${this._fmt(Number(a.target_temp_low), step)}–${this._fmt(Number(a.target_temp_high), step)}°</span>`
          : target != null ? html`<div class="stepper">
              <button aria-label="-" @click=${() => this._stepTarget(st, -1)}><ha-icon icon="mdi:minus"></ha-icon></button>
              <span class="target">${this._fmt(target, step)}°</span>
              <button aria-label="+" @click=${() => this._stepTarget(st, 1)}><ha-icon icon="mdi:plus"></ha-icon></button>
            </div>` : nothing
        : nothing}
      <button class="power ${off ? "" : "on"}" ?disabled=${unavailable} @click=${() => this._togglePower(st)}
        aria-label=${this._t(off ? "card.turn_on" : "card.turn_off")} title=${this._t(off ? "card.turn_on" : "card.turn_off")}>
        <ha-icon icon="mdi:power"></ha-icon>
      </button>
    </div>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const ids = this._entities.map((e) => e.entity).filter((id) => this.hass!.states[id]);
    const running = ids.filter((id) => !["off", ...UNAVAILABLE].includes(this.hass!.states[id].state));
    return html`<ha-card>
      <div class="header">
        <div class="titles">
          <span class="title">${this._config.title ?? this._t("overview.title")}</span>
          <span class="sub">${running.length} ${this._t("overview.of")} ${ids.length} ${this._t("overview.running")}</span>
        </div>
        ${this._config.show_all_off ? html`<button class="all-off" ?disabled=${!running.length} @click=${() => this._allOff(running)}>
          <ha-icon icon="mdi:power"></ha-icon>${this._t("overview.all_off")}</button>` : nothing}
      </div>
      <div class="rows">${this._entities.map((e) => this._renderRow(e))}</div>
    </ha-card>`;
  }

  static styles = css`
    ha-card { padding: 16px; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; height: 100%; }
    button { font: inherit; color: inherit; }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .titles { display: flex; flex-direction: column; min-width: 0; }
    .title { font-size: 16px; font-weight: 600; }
    .sub { font-size: 13px; color: var(--secondary-text-color); }
    .all-off { display: flex; align-items: center; gap: 6px; border: none; border-radius: 999px; padding: 8px 14px; cursor: pointer;
      background: rgba(127,127,127,0.14); font-size: 13px; font-weight: 600; }
    .all-off:hover:not(:disabled) { background: color-mix(in srgb, var(--error-color, #db4437) 18%, transparent); color: var(--error-color, #db4437); }
    .all-off:disabled { opacity: 0.4; cursor: default; }
    .all-off ha-icon { --mdc-icon-size: 18px; }
    .rows { display: flex; flex-direction: column; gap: 8px; }
    .row { display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 16px;
      background: color-mix(in srgb, var(--accent) 10%, rgba(127,127,127,0.06)); transition: background 0.3s; }
    .row.off { background: rgba(127,127,127,0.08); }
    .row.missing { color: var(--error-color, #db4437); font-size: 13px; }
    .info { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; background: none; border: none; padding: 0;
      cursor: pointer; text-align: left; }
    .badge { flex: none; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      background: color-mix(in srgb, var(--accent) 22%, transparent); color: var(--accent); }
    .badge.active ha-icon { animation: breathe 2.4s ease-in-out infinite; }
    .names { display: flex; flex-direction: column; min-width: 0; }
    .name { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .status { display: flex; align-items: center; gap: 2px; font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; }
    .status ha-icon { --mdc-icon-size: 14px; }
    .stepper { display: flex; align-items: center; gap: 2px; background: var(--card-background-color, #fff); border-radius: 999px; padding: 2px; }
    .stepper button { width: 30px; height: 30px; border: none; border-radius: 50%; background: transparent; cursor: pointer;
      color: var(--accent); display: flex; align-items: center; justify-content: center; padding: 0; }
    .stepper button:hover { background: color-mix(in srgb, var(--accent) 18%, transparent); }
    .stepper ha-icon { --mdc-icon-size: 18px; }
    .target { min-width: 40px; text-align: center; font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .power { flex: none; width: 38px; height: 38px; border-radius: 50%; border: none; cursor: pointer; padding: 0;
      background: rgba(127,127,127,0.14); color: var(--secondary-text-color); display: flex; align-items: center; justify-content: center; }
    .power.on { background: var(--accent); color: var(--text-primary-color, #fff); }
    .power:disabled { opacity: 0.4; cursor: default; }
    .power ha-icon { --mdc-icon-size: 20px; }
    @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }
    @media (prefers-reduced-motion: reduce) { .badge.active ha-icon { animation: none; } }
  `;
}

@customElement("ha-climate-overview-card-editor")
export class HaClimateOverviewCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: OverviewCardConfig;

  public setConfig(config: OverviewCardConfig): void {
    this._config = config;
  }

  private _schema = [
    { name: "title", selector: { text: {} } },
    { name: "entities", required: true, selector: { entity: { multiple: true, filter: { domain: "climate" } } } },
    { type: "grid", name: "", schema: [
      { name: "show_all_off", selector: { boolean: {} } },
      { name: "show_controls", selector: { boolean: {} } },
    ] },
  ];

  private _computeLabel = (s: { name: string }) => localize(this.hass, `overview.editor_${s.name}`);

  private _valueChanged(ev: CustomEvent): void {
    const value = { ...ev.detail.value };
    const previous = this._config?.entities ?? [];
    value.entities = (value.entities ?? []).map((id: string) =>
      previous.find((p) => typeof p !== "string" && p.entity === id) ?? id);
    if (!value.title) delete value.title;
    this._config = value;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: value }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const data = {
      show_all_off: true, show_controls: true, ...this._config,
      entities: (this._config.entities ?? []).map((e) => (typeof e === "string" ? e : e.entity)),
    };
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>`;
  }
}
