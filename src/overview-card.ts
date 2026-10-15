import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant, OverviewCardConfig, OverviewEntityConfig } from "./types";
import { ClimateFeature, supports } from "./const";
import { DOCS_URL } from "./shared";
import { formatAttribute, formatMode, localize } from "./localize/localize";
import { detectDeviceType, effectiveAction, isActive, modeColor, stateIcon, temperatureOf, temperatureTint, UNAVAILABLE } from "./utils";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-climate-overview-card",
  name: "HA Climate Overview",
  description: "Alle Klimaanlagen auf einen Blick – mit Temperatur, Schnellregelung und „Alle aus“.",
  preview: true,
  documentationURL: DOCS_URL,
});

/** Übersichtskarte für mehrere Klimageräte mit Sollwert-Stepper, Ein/Aus und "Alle aus". */
@customElement("ha-climate-overview-card")
export class HaClimateOverviewCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: OverviewCardConfig;
  @state() private _pending: Record<string, number> = {};
  private _timers: Record<string, number> = {};
  private _holdDelay?: number;
  private _holdRepeat?: number;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._holdEnd();
  }

  private _haptic(type = "light"): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: type }));
  }

  private _callService(service: string, data: Record<string, unknown>): void {
    this.hass!.callService("climate", service, data).catch((err) => {
      this._haptic("failure");
      this.dispatchEvent(new CustomEvent("hass-notification", {
        detail: { message: `${localize(this.hass, "card.error")}: ${err?.message ?? err}` }, bubbles: true, composed: true,
      }));
    });
  }

  private _holdStart(ev: PointerEvent, fn: () => void): void {
    if (ev.button !== 0) return;
    this._holdEnd();
    fn();
    this._holdDelay = window.setTimeout(() => (this._holdRepeat = window.setInterval(fn, 110)), 420);
  }

  private _holdEnd = (): void => {
    clearTimeout(this._holdDelay);
    clearInterval(this._holdRepeat);
  };

  private _holdButton(label: string, icon: string, fn: () => void) {
    return html`<button aria-label=${label}
      @pointerdown=${(e: PointerEvent) => this._holdStart(e, fn)} @pointerup=${this._holdEnd}
      @pointerleave=${this._holdEnd} @pointercancel=${this._holdEnd} @contextmenu=${(e: Event) => e.preventDefault()}
      @click=${(e: MouseEvent) => { if (e.detail === 0) fn(); }}><ha-icon icon=${icon}></ha-icon></button>`;
  }

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
    const rounded = Number(next.toFixed(step < 1 ? 1 : 0));
    if (rounded !== base) this._haptic("selection");
    this._pending = { ...this._pending, [st.entity_id]: rounded };
    clearTimeout(this._timers[st.entity_id]);
    this._timers[st.entity_id] = window.setTimeout(() => {
      this._callService("set_temperature", { entity_id: st.entity_id, temperature: this._pending[st.entity_id] });
    }, 1000);
  }

  private _togglePower(st: HassEntity): void {
    this._haptic();
    const a = st.attributes;
    if (st.state === "off") {
      if (supports(a, ClimateFeature.TURN_ON)) this._callService("turn_on", { entity_id: st.entity_id });
      else {
        const mode = (a.hvac_modes as string[] | undefined)?.find((m) => m !== "off");
        if (mode) this._callService("set_hvac_mode", { entity_id: st.entity_id, hvac_mode: mode });
      }
    } else if (supports(a, ClimateFeature.TURN_OFF)) this._callService("turn_off", { entity_id: st.entity_id });
    else this._callService("set_hvac_mode", { entity_id: st.entity_id, hvac_mode: "off" });
  }

  private _allOff(ids: string[]): void {
    this._haptic("success");
    for (const id of ids) {
      const st = this.hass!.states[id];
      if (supports(st.attributes, ClimateFeature.TURN_OFF)) this._callService("turn_off", { entity_id: id });
      else this._callService("set_hvac_mode", { entity_id: id, hvac_mode: "off" });
    }
  }

  private _moreInfo(entityId: string): void {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  private _renderRow(cfg: OverviewEntityConfig) {
    const st = this.hass!.states[cfg.entity];
    if (!st) return html`<div class="row missing">${this._t("card.entity_not_found")}: ${cfg.entity}</div>`;
    const a = st.attributes;
    const action = effectiveAction(st).action;
    const color = modeColor(st, action);
    const off = st.state === "off";
    const unavailable = UNAVAILABLE.includes(st.state);
    const step = this._step(st);
    const current = temperatureOf(st);
    const target = this._pending[st.entity_id] ?? (a.temperature != null ? Number(a.temperature) : undefined);
    const range = a.target_temp_low != null && a.target_temp_high != null && a.temperature == null;
    const status = unavailable ? this._t("card.unavailable")
      : action ? formatAttribute(this.hass!, st, "hvac_action", action) : formatMode(this.hass!, st, st.state);
    const name = cfg.name ?? a.friendly_name ?? st.entity_id;
    const active = isActive(st, action);
    return html`<div class="row ${off ? "off" : ""} ${active ? "active" : ""}" style="--hcc-accent-c:${color}">
      <button class="info" @click=${() => this._moreInfo(st.entity_id)}>
        <span class="badge ${active ? "active" : ""}" data-action=${action ?? ""}>
          <ha-icon .icon=${stateIcon(st, action)}></ha-icon>
        </span>
        <span class="names">
          <span class="name">${name}</span>
          <span class="status">${status}${current != null ? html` · <ha-icon icon="mdi:home-thermometer-outline"></ha-icon><span
            style=${`color:${off ? "inherit" : temperatureTint(current, target) ?? "inherit"}`}>${this._fmt(current, step)}°</span>` : nothing}</span>
        </span>
      </button>
      ${this._config!.show_controls && !off && !unavailable
        ? range
          ? html`<span class="target">${this._fmt(Number(a.target_temp_low), step)}–${this._fmt(Number(a.target_temp_high), step)}°</span>`
          : target != null ? html`<div class="stepper">
              ${this._holdButton("-", "mdi:minus", () => this._stepTarget(st, -1))}
              <span class="target">${this._fmt(target, step)}°</span>
              ${this._holdButton("+", "mdi:plus", () => this._stepTarget(st, 1))}
            </div>` : nothing
        : nothing}
      ${!off && !unavailable && detectDeviceType(st) === "heating" && (a.preset_modes ?? []).includes("boost")
        ? html`<button class="boost ${a.preset_mode === "boost" ? "on" : ""}" title="Boost" aria-label="Boost"
            aria-pressed=${a.preset_mode === "boost"}
            @click=${() => { this._haptic(); this._callService("set_preset_mode", { entity_id: st.entity_id, preset_mode: a.preset_mode === "boost" ? "none" : "boost" }); }}>
            <ha-icon icon="mdi:rocket-launch"></ha-icon></button>`
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
    .row { --accent: var(--hcc-accent-c, var(--primary-color)); position: relative; overflow: hidden; isolation: isolate;
      display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: calc(var(--ha-card-border-radius, 16px) * 0.85);
      background: color-mix(in srgb, var(--accent) 10%, rgba(127,127,127,0.06));
      transition: --hcc-accent-c 0.7s ease, background 0.3s; animation: row-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }
    .row::before { content: ""; position: absolute; inset: -40% auto -40% -10%; width: 45%; z-index: -1; pointer-events: none;
      background: radial-gradient(closest-side, color-mix(in srgb, var(--accent) 35%, transparent), transparent); opacity: 0; transition: opacity 0.6s; }
    .row.active::before { opacity: 1; animation: row-glow 4s ease-in-out infinite; }
    .rows .row:nth-child(2) { animation-delay: 0.05s; } .rows .row:nth-child(3) { animation-delay: 0.1s; }
    .rows .row:nth-child(4) { animation-delay: 0.15s; } .rows .row:nth-child(n+5) { animation-delay: 0.2s; }
    @keyframes row-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    @keyframes row-glow { 0%, 100% { transform: translateX(0) scale(1); } 50% { transform: translateX(8%) scale(1.1); } }
    .row.off { background: rgba(127,127,127,0.08); }
    .row.missing { color: var(--error-color, #db4437); font-size: 13px; }
    .info { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; background: none; border: none; padding: 0;
      cursor: pointer; text-align: left; }
    .badge { flex: none; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      background: color-mix(in srgb, var(--accent) 22%, transparent); color: var(--accent); }
    .badge.active ha-icon { animation: breathe 2.4s ease-in-out infinite; }
    .badge.active[data-action="cooling"] ha-icon { animation: spin 9s linear infinite; }
    .badge.active[data-action="fan"] ha-icon { animation: spin 1.6s linear infinite; }
    .badge.active[data-action="heating"] ha-icon, .badge.active[data-action="preheating"] ha-icon {
      animation: flicker 1.8s ease-in-out infinite; transform-origin: 50% 85%; }
    .badge.active[data-action="drying"] ha-icon { animation: bob 2s ease-in-out infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes flicker { 0%, 100% { transform: scale(1) rotate(0); } 25% { transform: scale(1.08, 0.95) rotate(-3deg); }
      50% { transform: scale(0.96, 1.07) rotate(2deg); } 75% { transform: scale(1.05, 0.97) rotate(-1deg); } }
    @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
    .names { display: flex; flex-direction: column; min-width: 0; }
    .name { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .status { display: flex; align-items: center; gap: 2px; font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; }
    .status span { flex: none; }
    .status ha-icon { --mdc-icon-size: 14px; }
    .stepper { display: flex; align-items: center; gap: 2px; background: var(--card-background-color, #fff); border-radius: 999px; padding: 2px; }
    .stepper button { width: 30px; height: 30px; border: none; border-radius: 50%; background: transparent; cursor: pointer;
      color: var(--accent); display: flex; align-items: center; justify-content: center; padding: 0; }
    .stepper button:hover { background: color-mix(in srgb, var(--accent) 18%, transparent); }
    .stepper ha-icon { --mdc-icon-size: 18px; }
    .target { min-width: 40px; text-align: center; font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .power { flex: none; width: 38px; height: 38px; border-radius: 50%; border: none; cursor: pointer; padding: 0;
      background: rgba(127,127,127,0.14); color: var(--secondary-text-color); display: flex; align-items: center; justify-content: center; }
    .power { transition: background 0.3s, box-shadow 0.4s, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .power:active { transform: scale(0.9); }
    .boost { flex: none; width: 34px; height: 34px; border-radius: 50%; border: none; cursor: pointer; padding: 0;
      background: rgba(127,127,127,0.14); color: var(--secondary-text-color); display: flex; align-items: center; justify-content: center;
      transition: background 0.3s, color 0.3s; }
    .boost.on { background: var(--state-climate-heat-color, #ff6d00); color: #fff; }
    .boost ha-icon { --mdc-icon-size: 18px; }
    .power.on { background: var(--accent); color: var(--text-primary-color, #fff);
      box-shadow: 0 4px 12px color-mix(in srgb, var(--accent) 45%, transparent); }
    .stepper button { touch-action: manipulation; user-select: none; -webkit-user-select: none; transition: background 0.2s, transform 0.2s; }
    .stepper button:active { transform: scale(0.86); }
    .power:disabled { opacity: 0.4; cursor: default; }
    .power ha-icon { --mdc-icon-size: 20px; }
    @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }
    @media (prefers-reduced-motion: reduce) { .badge.active ha-icon, .row, .row.active::before { animation: none; } }
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
