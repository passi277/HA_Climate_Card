import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { ClimateCardConfig, HassEntity, HomeAssistant, ShowConfig } from "./types";
import {
  ACTION_ICONS,
  ACTION_TO_MODE,
  AUTO_SHORTCUT_DOMAINS,
  CARD_VERSION,
  ClimateFeature,
  DEFAULT_SHOW,
  HVAC_MODE_ORDER,
  MODE_COLORS,
  MODE_ICONS,
  PRIMARY_SECTIONS,
  supports,
} from "./const";
import { formatAttribute, formatMode, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import type { SensorItem } from "./components/sensor-row";
import type { ShortcutItem } from "./components/shortcut-row";
import "./components/climate-dial";
import "./components/mode-bar";
import "./components/attribute-select";
import "./components/sensor-row";
import "./components/history-graph";
import "./components/shortcut-row";
import "./editor";

interface PendingTarget { value?: number; low?: number; high?: number; }
interface Section { key: string; tpl: TemplateResult; }

const UNAVAILABLE = ["unavailable", "unknown"];

console.info(
  `%c HA-CLIMATE-CARD %c v${CARD_VERSION} `,
  "color:#fff;background:#2196f3;font-weight:700;border-radius:4px 0 0 4px",
  "color:#2196f3;background:#fff;font-weight:700;border-radius:0 4px 4px 0",
);

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-climate-card",
  name: "HA Climate Card",
  description: "Moderne Karte für Klimaanlagen mit Drehregler, allen Modi, Sensoren und Verlauf.",
  preview: true,
  documentationURL: "https://github.com/passi277/HA_Climate_Card",
});

@customElement("ha-climate-card")
export class HaClimateCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: ClimateCardConfig;
  @state() private _pending?: PendingTarget;
  @state() private _pendingHumidity?: number;
  @state() private _expanded = false;

  private _tempTimer?: number;
  private _humTimer?: number;
  private _clearTimer?: number;
  private _sentAt?: string;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-climate-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<ClimateCardConfig> {
    const entity = Object.keys(hass.states).find((id) => id.startsWith("climate.")) ?? "";
    return { entity, layout: "full" };
  }

  public setConfig(config: ClimateCardConfig): void {
    if (!config?.entity || !config.entity.startsWith("climate.")) {
      throw new Error("ha-climate-card: 'entity' muss eine climate-Entität sein (climate.xyz)");
    }
    const startChanged = this._config?.start_expanded !== config.start_expanded;
    this._config = { layout: "full", graph_hours: 24, ...config };
    if (startChanged) this._expanded = !!config.start_expanded;
  }

  public getCardSize(): number {
    if (this._config?.layout === "compact") return this._expanded ? 6 : 2;
    if (this._config?.expandable !== false && !this._expanded) return 6;
    return this._show.graph ? 10 : 8;
  }

  public getGridOptions() {
    return { columns: 6, min_columns: 4, rows: "auto" };
  }

  private get _show(): Required<ShowConfig> {
    return { ...DEFAULT_SHOW, ...(this._config?.show ?? {}) };
  }

  private get _stateObj(): HassEntity | undefined {
    return this._config && this.hass?.states[this._config.entity];
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this._config) return true;
    const ids = [
      this._config.entity, this._config.temperature_sensor, this._config.humidity_sensor,
      this._config.outdoor_sensor, this._config.power_sensor, this._config.energy_sensor,
      this._config.window_sensor, ...this._shortcutIds(),
    ].filter(Boolean) as string[];
    return ids.some((id) => old.states[id] !== this.hass!.states[id]) || old.locale !== this.hass!.locale;
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    // Ausstehende Sollwerte verwerfen, sobald HA einen neuen Zustand meldet.
    const st = this._stateObj;
    if (st && this._sentAt && st.last_updated !== this._sentAt) {
      this._sentAt = undefined;
      this._pending = undefined;
      this._pendingHumidity = undefined;
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._tempTimer);
    clearTimeout(this._humTimer);
    clearTimeout(this._clearTimer);
  }

  // ---------- Helpers ----------

  private _t(key: string): string {
    return localize(this.hass, key);
  }

  private get _unit(): string {
    return this.hass?.config?.unit_system?.temperature ?? "°C";
  }

  private _step(st: HassEntity): number {
    return Number(st.attributes.target_temp_step) || (this._unit === "°F" ? 1 : 0.5);
  }

  private _fmt(v: number | undefined | null, step = 0.5): string {
    if (v == null || !Number.isFinite(Number(v))) return "–";
    return Number(v).toFixed(step < 1 ? 1 : 0);
  }

  private _isDual(st: HassEntity): boolean {
    const a = st.attributes;
    return (
      supports(a, ClimateFeature.TARGET_TEMPERATURE_RANGE) &&
      a.target_temp_low != null && a.target_temp_high != null &&
      (a.temperature == null || !supports(a, ClimateFeature.TARGET_TEMPERATURE))
    );
  }

  private _modeColor(st: HassEntity): string {
    if (st.state === "off" || UNAVAILABLE.includes(st.state)) return MODE_COLORS.off;
    const fromAction = ACTION_TO_MODE[st.attributes.hvac_action];
    return MODE_COLORS[fromAction ?? st.state] ?? "var(--primary-color)";
  }

  private _isActive(st: HassEntity): boolean {
    const action = st.attributes.hvac_action;
    return !!action && !["idle", "off"].includes(action) && st.state !== "off";
  }

  private _currentTemp(st: HassEntity): number | undefined {
    const sensor = this._config?.temperature_sensor;
    if (sensor && this._config?.use_sensor_for_current) {
      const v = Number(this.hass?.states[sensor]?.state);
      if (Number.isFinite(v)) return v;
    }
    const v = st.attributes.current_temperature;
    return v == null ? undefined : Number(v);
  }

  private _targets(st: HassEntity): PendingTarget {
    const a = st.attributes;
    return {
      value: this._pending?.value ?? (a.temperature != null ? Number(a.temperature) : undefined),
      low: this._pending?.low ?? (a.target_temp_low != null ? Number(a.target_temp_low) : undefined),
      high: this._pending?.high ?? (a.target_temp_high != null ? Number(a.target_temp_high) : undefined),
    };
  }

  private _sensorState(entityId?: string): string | undefined {
    if (!entityId || !this.hass) return undefined;
    const s = this.hass.states[entityId];
    if (!s) return undefined;
    if (UNAVAILABLE.includes(s.state)) return "–";
    if (this.hass.formatEntityState) return this.hass.formatEntityState(s);
    const unit = s.attributes.unit_of_measurement;
    return unit ? `${s.state} ${unit}` : s.state;
  }

  private _windowOpen(): boolean {
    const id = this._config?.window_sensor;
    return !!id && this.hass?.states[id]?.state === "on";
  }

  private _autoShortcutCache?: { key: unknown; device?: string; ids: string[] };

  /** Schalter/Buttons desselben Geräts (z.B. Gree: Frischluft, Leise, Licht, X-Fan). */
  private _autoShortcutIds(): string[] {
    const hass = this.hass;
    const entityId = this._config?.entity;
    if (!hass?.entities || !entityId) return [];
    const cache = this._autoShortcutCache;
    if (cache && cache.key === hass.entities && cache.device === entityId) return cache.ids;
    const deviceId = hass.entities[entityId]?.device_id;
    const ids = deviceId
      ? Object.values(hass.entities)
          .filter((e) => e.device_id === deviceId && e.entity_id !== entityId && !e.hidden
            && AUTO_SHORTCUT_DOMAINS.includes(e.entity_id.split(".")[0]))
          .map((e) => e.entity_id)
          .sort()
      : [];
    this._autoShortcutCache = { key: hass.entities, device: entityId, ids };
    return ids;
  }

  private _shortcutIds(): string[] {
    const c = this._config;
    if (!c) return [];
    if (c.shortcuts) return c.shortcuts.map((s) => (typeof s === "string" ? s : s.entity));
    return c.auto_shortcuts === false ? [] : this._autoShortcutIds();
  }

  private _shortName(entityId: string, st: HassEntity): string {
    const full: string = this.hass!.states[entityId]?.attributes.friendly_name ?? entityId.split(".")[1];
    const deviceId = this.hass!.entities?.[entityId]?.device_id;
    const device = deviceId ? this.hass!.devices?.[deviceId] : undefined;
    const prefixes = [device?.name_by_user, device?.name, st.attributes.friendly_name, this._config?.name]
      .filter((p): p is string => !!p)
      .sort((x, y) => y.length - x.length);
    for (const prefix of prefixes) {
      if (full.toLowerCase().startsWith(prefix.toLowerCase() + " ")) return full.slice(prefix.length + 1);
    }
    return full;
  }

  private _shortcutItems(st: HassEntity): ShortcutItem[] {
    const c = this._config!;
    const list = c.shortcuts ?? (c.auto_shortcuts === false ? [] : this._autoShortcutIds());
    return list
      .map((s) => (typeof s === "string" ? { entity: s } : s))
      .filter((s) => s?.entity && this.hass!.states[s.entity])
      .map((s) => ({ entity: s.entity, name: s.name ?? this._shortName(s.entity, st), icon: s.icon }));
  }

  // ---------- Service calls ----------

  private _call(service: string, data: Record<string, unknown> = {}): void {
    const st = this._stateObj;
    if (!st || !this.hass) return;
    this._sentAt = st.last_updated;
    this.hass.callService("climate", service, { entity_id: st.entity_id, ...data }).catch((err) => {
      console.error("ha-climate-card:", err);
      this._pending = undefined;
      this._pendingHumidity = undefined;
    });
    clearTimeout(this._clearTimer);
    this._clearTimer = window.setTimeout(() => {
      this._pending = undefined;
      this._pendingHumidity = undefined;
      this._sentAt = undefined;
    }, 6000);
  }

  private _scheduleTemp(delay: number): void {
    clearTimeout(this._tempTimer);
    this._tempTimer = window.setTimeout(() => {
      const st = this._stateObj;
      const p = this._pending;
      if (!st || !p) return;
      if (this._isDual(st)) {
        this._call("set_temperature", { target_temp_low: p.low, target_temp_high: p.high });
      } else if (p.value != null) {
        this._call("set_temperature", { temperature: p.value });
      }
    }, delay);
  }

  private _onDialChanging(ev: CustomEvent): void {
    clearTimeout(this._tempTimer);
    this._pending = { ...ev.detail };
  }

  private _onDialChanged(ev: CustomEvent): void {
    this._pending = { ...ev.detail };
    this._scheduleTemp(400);
  }

  private _stepTarget(which: keyof PendingTarget, dir: 1 | -1): void {
    const st = this._stateObj;
    if (!st) return;
    const step = this._step(st);
    const min = Number(st.attributes.min_temp ?? 7);
    const max = Number(st.attributes.max_temp ?? 35);
    const t = this._targets(st);
    const base = t[which] ?? (this._currentTemp(st) ?? min);
    let next = Math.min(max, Math.max(min, Math.round((base + dir * step) / step) * step));
    next = Number(next.toFixed(step < 1 ? 1 : 0));
    if (which === "low" && t.high != null) next = Math.min(next, t.high);
    if (which === "high" && t.low != null) next = Math.max(next, t.low);
    this._pending = { ...t, [which]: next };
    this._scheduleTemp(1000);
  }

  private _stepHumidity(dir: 1 | -1): void {
    const st = this._stateObj;
    if (!st) return;
    const min = Number(st.attributes.min_humidity ?? 30);
    const max = Number(st.attributes.max_humidity ?? 99);
    const base = this._pendingHumidity ?? Number(st.attributes.humidity ?? 50);
    this._pendingHumidity = Math.min(max, Math.max(min, base + dir));
    clearTimeout(this._humTimer);
    this._humTimer = window.setTimeout(() => this._call("set_humidity", { humidity: this._pendingHumidity }), 1000);
  }

  private _setMode(ev: CustomEvent): void {
    this._call("set_hvac_mode", { hvac_mode: ev.detail.mode });
  }

  private _togglePower(): void {
    const st = this._stateObj;
    if (!st) return;
    const a = st.attributes;
    if (st.state === "off") {
      if (supports(a, ClimateFeature.TURN_ON)) this._call("turn_on");
      else {
        const mode = (a.hvac_modes as string[] | undefined)?.find((m) => m !== "off");
        if (mode) this._call("set_hvac_mode", { hvac_mode: mode });
      }
    } else if (supports(a, ClimateFeature.TURN_OFF)) this._call("turn_off");
    else this._call("set_hvac_mode", { hvac_mode: "off" });
  }

  private _moreInfo(entityId?: string): void {
    this.dispatchEvent(new CustomEvent("hass-more-info", {
      detail: { entityId: entityId ?? this._config?.entity }, bubbles: true, composed: true,
    }));
  }

  // ---------- Render parts ----------

  private _renderHeader(st: HassEntity, name: string, color: string): TemplateResult {
    const action = st.attributes.hvac_action as string | undefined;
    const statusText = action
      ? formatAttribute(this.hass!, st, "hvac_action", action)
      : formatMode(this.hass!, st, st.state);
    const preset = st.attributes.preset_mode && st.attributes.preset_mode !== "none"
      ? ` · ${formatAttribute(this.hass!, st, "preset_mode", st.attributes.preset_mode)}` : "";
    const canPower = (st.attributes.hvac_modes ?? []).includes("off")
      || supports(st.attributes, ClimateFeature.TURN_OFF);
    return html`
      <div class="header">
        <button class="title" @click=${() => this._moreInfo()}>
          <span class="icon-badge ${this._isActive(st) ? "active" : ""}" style="--accent:${color}">
            <ha-icon .icon=${this._config!.icon ?? ACTION_ICONS[action ?? ""] ?? MODE_ICONS[st.state] ?? "mdi:air-conditioner"}></ha-icon>
          </span>
          <span class="names">
            <span class="name">${name}</span>
            <span class="status">${statusText}${preset}</span>
          </span>
        </button>
        ${canPower ? html`
          <button class="power ${st.state !== "off" ? "on" : ""}" style="--accent:${color}"
            title=${this._t(st.state === "off" ? "card.turn_on" : "card.turn_off")}
            aria-label=${this._t(st.state === "off" ? "card.turn_on" : "card.turn_off")}
            @click=${this._togglePower}>
            <ha-icon icon="mdi:power"></ha-icon>
          </button>` : nothing}
      </div>`;
  }

  private _renderWindowWarning(): TemplateResult | typeof nothing {
    if (!this._windowOpen()) return nothing;
    return html`<div class="banner" @click=${() => this._moreInfo(this._config!.window_sensor)}>
      <ha-icon icon="mdi:window-open-variant"></ha-icon>
      <div><strong>${this._t("card.window_open")}</strong><span>${this._t("card.window_open_hint")}</span></div>
    </div>`;
  }

  private _renderStepper(which: keyof PendingTarget, value: number | undefined, step: number, color?: string) {
    return html`<div class="stepper" style=${color ? `--accent:${color}` : ""}>
      <button aria-label="-" @click=${() => this._stepTarget(which, -1)}><ha-icon icon="mdi:minus"></ha-icon></button>
      <span class="stepper-value">${this._fmt(value, step)}<small>${this._unit}</small></span>
      <button aria-label="+" @click=${() => this._stepTarget(which, 1)}><ha-icon icon="mdi:plus"></ha-icon></button>
    </div>`;
  }

  private _renderDial(st: HassEntity, color: string): TemplateResult {
    const a = st.attributes;
    const step = this._step(st);
    const dual = this._isDual(st);
    const t = this._targets(st);
    const cur = this._currentTemp(st);
    const off = st.state === "off";
    const hasTarget = dual || (t.value != null && supports(a, ClimateFeature.TARGET_TEMPERATURE));
    const humidity = this._config?.humidity_sensor
      ? this.hass!.states[this._config.humidity_sensor]?.state
      : a.current_humidity;

    return html`
      <hcc-climate-dial
        .min=${Number(a.min_temp ?? 7)} .max=${Number(a.max_temp ?? 35)} .step=${step}
        .value=${t.value} .low=${t.low} .high=${t.high} .current=${cur}
        .dual=${dual} .disabled=${off || !hasTarget} .color=${color} .active=${this._isActive(st)}
        @value-changing=${this._onDialChanging} @value-changed=${this._onDialChanged}>
        <div class="dial-center">
          <span class="dial-label">${off ? formatMode(this.hass!, st, "off") : this._t("card.target")}</span>
          ${off || !hasTarget
            ? html`<span class="dial-big">${this._fmt(cur, step)}<sup>${this._unit}</sup></span>`
            : dual
              ? html`<span class="dial-range">
                  <span style="color:var(--state-climate-heat-color,#ff6d00)">${this._fmt(t.low, step)}</span>
                  <span class="sep">–</span>
                  <span style="color:var(--state-climate-cool-color,#2196f3)">${this._fmt(t.high, step)}</span>
                </span>`
              : html`<span class="dial-big">${this._fmt(t.value, step)}<sup>${this._unit}</sup></span>`}
          <span class="dial-sub">
            ${!off && hasTarget ? html`<ha-icon icon="mdi:home-thermometer-outline"></ha-icon>${this._fmt(cur, step)}${this._unit}` : nothing}
            ${humidity != null && humidity !== "" ? html`<ha-icon icon="mdi:water-percent"></ha-icon>${Math.round(Number(humidity))}%` : nothing}
          </span>
        </div>
      </hcc-climate-dial>
      ${!off && hasTarget ? html`<div class="dial-steppers ${dual ? "dual" : ""}">
        ${dual
          ? html`${this._renderStepper("low", t.low, step, "var(--state-climate-heat-color,#ff6d00)")}
                 ${this._renderStepper("high", t.high, step, "var(--state-climate-cool-color,#2196f3)")}`
          : html`<button class="round" aria-label="-" @click=${() => this._stepTarget("value", -1)}><ha-icon icon="mdi:minus"></ha-icon></button>
                 <button class="round" aria-label="+" @click=${() => this._stepTarget("value", 1)}><ha-icon icon="mdi:plus"></ha-icon></button>`}
      </div>` : nothing}`;
  }

  private _sections(st: HassEntity, color: string): Section[] {
    const a = st.attributes;
    const show = this._show;
    const hass = this.hass!;
    const sections: Section[] = [];
    const parts = { push: (tpl: TemplateResult, key: string) => sections.push({ key, tpl }) };

    const modes = ((a.hvac_modes ?? []) as string[])
      .slice()
      .sort((x, y) => HVAC_MODE_ORDER.indexOf(x) - HVAC_MODE_ORDER.indexOf(y))
      .map((m) => ({ value: m, label: formatMode(hass, st, m) }));
    if (show.modes && modes.length > 1) {
      parts.push(html`<hcc-mode-bar .modes=${modes} .selected=${st.state} @mode-selected=${this._setMode}></hcc-mode-bar>`, "modes");
    }

    const select = (key: string, attr: string, list: string, feature: number, labelKey: string, icon: string, service: string, enabled: boolean) => {
      const options = a[list] as string[] | undefined;
      if (!enabled || !supports(a, feature) || !options?.length) return;
      parts.push(html`<hcc-attribute-select .label=${this._t(labelKey)} .icon=${icon} .selected=${a[attr]}
        .options=${options.map((o) => ({ value: o, label: formatAttribute(hass, st, attr, o) }))}
        .dropdownThreshold=${this._config!.dropdown_threshold ?? 6}
        @option-selected=${(e: CustomEvent) => this._call(service, { [attr]: e.detail.value })}>
      </hcc-attribute-select>`, key);
    };
    select("fan", "fan_mode", "fan_modes", ClimateFeature.FAN_MODE, "card.fan", "mdi:fan", "set_fan_mode", show.fan);
    select("swing", "swing_mode", "swing_modes", ClimateFeature.SWING_MODE, "card.swing", "mdi:arrow-oscillating", "set_swing_mode", show.swing);
    select("swing", "swing_horizontal_mode", "swing_horizontal_modes", ClimateFeature.SWING_HORIZONTAL_MODE,
      "card.swing_horizontal", "mdi:arrow-left-right", "set_swing_horizontal_mode", show.swing);
    select("presets", "preset_mode", "preset_modes", ClimateFeature.PRESET_MODE, "card.preset", "mdi:star-outline", "set_preset_mode", show.presets);

    if (show.shortcuts) {
      const items = this._shortcutItems(st);
      if (items.length) parts.push(html`<hcc-shortcut-row .hass=${hass} .items=${items}></hcc-shortcut-row>`, "shortcuts");
    }

    if (show.humidity && supports(a, ClimateFeature.TARGET_HUMIDITY) && a.humidity != null) {
      const hum = this._pendingHumidity ?? Number(a.humidity);
      parts.push(html`<div class="humidity-row">
        <span class="row-label"><ha-icon icon="mdi:water-percent"></ha-icon>${this._t("card.target_humidity")}</span>
        <div class="stepper">
          <button aria-label="-" @click=${() => this._stepHumidity(-1)}><ha-icon icon="mdi:minus"></ha-icon></button>
          <span class="stepper-value">${hum}<small>%</small></span>
          <button aria-label="+" @click=${() => this._stepHumidity(1)}><ha-icon icon="mdi:plus"></ha-icon></button>
        </div>
      </div>`, "humidity");
    }

    if (show.sensors) {
      const items = this._sensorItems(st);
      if (items.length) parts.push(html`<hcc-sensor-row .items=${items}></hcc-sensor-row>`, "sensors");
    }

    if (show.graph) {
      parts.push(html`<div class="graph-wrap">
        <span class="row-label"><ha-icon icon="mdi:chart-line"></ha-icon>${this._t("card.history")}</span>
        <hcc-history-graph .hass=${hass} .entity=${st.entity_id}
          .sensor=${this._config!.use_sensor_for_current ? this._config!.temperature_sensor : undefined}
          .hours=${this._config!.graph_hours ?? 24} .unit=${this._unit} .emptyText=${this._t("card.no_history")}
          style="--hcc-accent:${color}"></hcc-history-graph>
      </div>`, "graph");
    }
    return sections;
  }

  private _renderSections(sections: Section[], color: string) {
    if (!sections.length) return nothing;
    return html`<div class="controls" style="--hcc-accent:${color}">${sections.map((s) => s.tpl)}</div>`;
  }

  private _renderExpandButton() {
    return html`<button class="expand" @click=${() => { this._expanded = !this._expanded; }} aria-expanded=${this._expanded}>
      <span>${this._t(this._expanded ? "card.less" : "card.more")}</span>
      <ha-icon icon=${this._expanded ? "mdi:chevron-up" : "mdi:chevron-down"}></ha-icon>
    </button>`;
  }

  /** Volles Layout: Hauptbereiche immer sichtbar, Details optional ausklappbar. */
  private _renderFullControls(st: HassEntity, color: string) {
    const sections = this._sections(st, color);
    if (this._config!.expandable === false) return this._renderSections(sections, color);
    const primary = sections.filter((s) => PRIMARY_SECTIONS.includes(s.key));
    const details = sections.filter((s) => !PRIMARY_SECTIONS.includes(s.key));
    return html`
      ${this._renderSections(primary, color)}
      ${details.length ? html`
        ${this._expanded ? this._renderSections(details, color) : nothing}
        ${this._renderExpandButton()}` : nothing}`;
  }

  private _sensorItems(st: HassEntity): SensorItem[] {
    const c = this._config!;
    const items: SensorItem[] = [];
    const add = (entity: string | undefined, icon: string, labelKey: string, warning = false) => {
      const value = this._sensorState(entity);
      if (value != null) items.push({ entity, icon, label: this._t(labelKey), value, warning });
    };
    if (!c.use_sensor_for_current) add(c.temperature_sensor, "mdi:home-thermometer-outline", "card.current");
    if (c.humidity_sensor == null && st.attributes.current_humidity != null && this._config?.layout === "compact") {
      items.push({ icon: "mdi:water-percent", label: this._t("card.humidity"), value: `${st.attributes.current_humidity}%` });
    }
    if (this._config?.layout === "compact") add(c.humidity_sensor, "mdi:water-percent", "card.humidity");
    add(c.outdoor_sensor, "mdi:thermometer", "card.outdoor");
    add(c.power_sensor, "mdi:flash", "card.power");
    add(c.energy_sensor, "mdi:lightning-bolt", "card.energy");
    if (c.window_sensor && this.hass!.states[c.window_sensor]) {
      const open = this._windowOpen();
      items.push({
        entity: c.window_sensor,
        icon: open ? "mdi:window-open-variant" : "mdi:window-closed-variant",
        label: this.hass!.states[c.window_sensor].attributes.friendly_name ?? "Window",
        value: this._sensorState(c.window_sensor) ?? "",
        warning: open,
      });
    }
    return items;
  }

  private _renderCompact(st: HassEntity, name: string, color: string): TemplateResult {
    const step = this._step(st);
    const dual = this._isDual(st);
    const t = this._targets(st);
    const off = st.state === "off";
    const hasTarget = dual || (t.value != null && supports(st.attributes, ClimateFeature.TARGET_TEMPERATURE));
    const cur = this._currentTemp(st);
    return html`
      <div class="compact-top">
        ${this._renderHeader(st, name, color)}
      </div>
      <div class="compact-row">
        <div class="compact-current">
          <span class="big">${this._fmt(cur, step)}<sup>${this._unit}</sup></span>
          <span class="dial-label">${this._t("card.current")}</span>
        </div>
        ${!off && hasTarget
          ? dual
            ? html`<div class="compact-steppers">
                ${this._renderStepper("low", t.low, step, "var(--state-climate-heat-color,#ff6d00)")}
                ${this._renderStepper("high", t.high, step, "var(--state-climate-cool-color,#2196f3)")}
              </div>`
            : this._renderStepper("value", t.value, step, color)
          : nothing}
      </div>
      ${this._renderWindowWarning()}
      ${this._renderExpandButton()}
      ${this._expanded ? this._renderSections(this._sections(st, color), color) : nothing}`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const st = this._stateObj;
    if (!st) {
      return html`<ha-card><div class="warning">${this._t("card.entity_not_found")}: ${this._config.entity}</div></ha-card>`;
    }
    const name = this._config.name ?? st.attributes.friendly_name ?? st.entity_id;
    if (UNAVAILABLE.includes(st.state)) {
      return html`<ha-card class="unavailable">
        ${this._renderHeader(st, name, MODE_COLORS.off)}
        <div class="warning">${this._t("card.unavailable")}</div>
      </ha-card>`;
    }
    const color = this._modeColor(st);
    const compact = this._config.layout === "compact";
    return html`<ha-card class=${compact ? "compact" : "full"} style="--accent:${color}">
      <div class="glow"></div>
      ${compact
        ? this._renderCompact(st, name, color)
        : html`
          ${this._renderHeader(st, name, color)}
          ${this._renderWindowWarning()}
          ${this._renderDial(st, color)}
          ${this._renderFullControls(st, color)}`}
    </ha-card>`;
  }

  static styles = cardStyles;
}

declare global {
  interface HTMLElementTagNameMap { "ha-climate-card": HaClimateCard; }
}
