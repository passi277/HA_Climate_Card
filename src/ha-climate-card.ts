import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { ClimateCardConfig, HassEntity, HomeAssistant, ShowConfig } from "./types";
import {
  AUTO_SHORTCUT_DOMAINS,
  CARD_VERSION,
  ClimateFeature,
  DEFAULT_SHOW,
  HVAC_MODE_ORDER,
  MODE_COLORS,
  PRIMARY_SECTIONS,
  supports,
} from "./const";
import { formatAttribute, formatMode, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import type { SensorItem } from "./components/sensor-row";
import { fallbackIcon, type ShortcutItem } from "./components/shortcut-row";
import "./components/climate-dial";
import "./components/mode-bar";
import "./components/attribute-select";
import "./components/sensor-row";
import "./components/history-graph";
import "./components/shortcut-row";
import "./components/sleep-timer";
import "./components/countdown-timer";
import "./components/airflow";
import {
  dewPoint, effectiveAction, etaMinutes, inferAction, isActive, modeColor, powerOf, stateIcon, temperatureOf,
  openContactsKey, resolveContacts, temperatureTint, trendSlope, WEATHER_ICONS, type ResolvedContact, type Sample,
} from "./utils";
import "./editor";
import "./overview-card";

interface PendingTarget { value?: number; low?: number; high?: number; }
interface Section { key: string; tpl: TemplateResult; }
/** Kinder erben die (animierte) Modusfarbe der Karte. */
const ACCENT = "var(--accent)";
interface ForecastDay { temperature?: number; templow?: number; condition?: string; precipitation_probability?: number; }

const UNAVAILABLE = ["unavailable", "unknown"];

console.info(
  `%c HA-CLIMATE-CARD %c v${CARD_VERSION} `,
  "color:#fff;background:#2196f3;font-weight:700;border-radius:4px 0 0 4px",
  "color:#2196f3;background:#fff;font-weight:700;border-radius:0 4px 4px 0",
);

// Animierbare Modusfarbe: Farbwechsel werden weich überblendet statt hart umgeschaltet.
try {
  (window as any).CSS?.registerProperty?.({ name: "--hcc-accent-c", syntax: "<color>", inherits: true, initialValue: "transparent" });
} catch {
  /* bereits registriert */
}

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
  @state() private _forecast?: ForecastDay;
  @state() private _syncing = false;
  /** Verlauf erst laden, wenn er das erste Mal sichtbar ist. */
  @state() private _graphLoaded = false;
  @state() private _runtimeToday?: number;
  @state() private _samples: Sample[] = [];
  private _todayTimer?: number;
  private _todayKey?: string;
  @state() private _error?: string;
  private _errorTimer?: number;
  private _holdDelay?: number;
  private _holdRepeat?: number;

  private _weatherUnsub?: Promise<() => void>;
  private _weatherKey?: string;

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
      ...this._contactIds(), this._config.timer_switch, this._config.timer_time, this._config.countdown_timer,
      this._config.weather_entity, ...this._shortcutIds(),
    ].filter(Boolean) as string[];
    return ids.some((id) => old.states[id] !== this.hass!.states[id]) || old.locale !== this.hass!.locale;
  }

  protected willUpdate(): void {
    const c = this._config;
    if (!this._graphLoaded && c && (this._expanded || (c.layout !== "compact" && c.expandable === false))) this._graphLoaded = true;
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has("hass") || changed.has("_config")) {
      this._subscribeWeather();
      this._maybeFetchToday();
      this._recordSample();
    }
    this._popChangedValues();
    // Ausstehende Sollwerte verwerfen, sobald HA einen neuen Zustand meldet.
    const st = this._stateObj;
    if (st && this._sentAt && st.last_updated !== this._sentAt) {
      this._sentAt = undefined;
      this._pending = undefined;
      this._pendingHumidity = undefined;
      this._syncing = false;
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.hass) this._subscribeWeather();
  }

  private _popValues = new Map<string, string | null>();

  /** Kleine Feder-Animation, wenn sich ein angezeigter Wert (Sollwert, Luftfeuchte) ändert. */
  private _popChangedValues(): void {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    this.shadowRoot?.querySelectorAll<HTMLElement>("[data-pop]").forEach((el) => {
      const key = el.dataset.pop!;
      const value = el.textContent;
      const prev = this._popValues.get(key);
      if (!reduced && prev !== undefined && prev !== value) {
        el.animate(
          [{ transform: "translateY(4px) scale(0.94)", opacity: 0.4 }, { transform: "none", opacity: 1 }],
          { duration: 380, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
        );
      }
      this._popValues.set(key, value);
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._holdEnd();
    clearTimeout(this._errorTimer);
    clearInterval(this._todayTimer);
    this._todayTimer = undefined;
    this._todayKey = undefined;
    this._unsubscribeWeather();
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
    return modeColor(st, this._action(st));
  }

  private _isActive(st: HassEntity): boolean {
    return isActive(st, this._action(st));
  }

  /** Tätigkeit des Geräts – gemeldet oder (z.B. bei Gree) aus Temperatur/Leistung abgeleitet. */
  private _action(st: HassEntity): string | undefined {
    const c = this._config;
    return effectiveAction(st, {
      current: this._currentTemp(st),
      power: c?.power_sensor ? powerOf(this.hass?.states[c.power_sensor]) : undefined,
      powerThreshold: c?.power_threshold,
    }).action;
  }

  // ---------- Wetter ----------

  private _unsubscribeWeather(): void {
    this._weatherUnsub?.then((unsub) => unsub()).catch(() => undefined);
    this._weatherUnsub = undefined;
    this._weatherKey = undefined;
  }

  /** Tagesvorhersage abonnieren (weather/subscribe_forecast), Fallback auf altes `forecast`-Attribut. */
  private _subscribeWeather(): void {
    const id = this._config?.weather_entity;
    if (!id || !this.hass || !this.isConnected) {
      if (this._weatherKey) this._unsubscribeWeather();
      return;
    }
    if (this._weatherKey === id) return;
    this._unsubscribeWeather();
    this._weatherKey = id;
    const legacy = this.hass.states[id]?.attributes.forecast as ForecastDay[] | undefined;
    if (legacy?.length) this._forecast = legacy[0];
    if (!this.hass.connection) return;
    this._weatherUnsub = this.hass.connection.subscribeMessage<{ forecast?: ForecastDay[] }>(
      (msg) => { if (msg.forecast?.length) this._forecast = msg.forecast[0]; },
      { type: "weather/subscribe_forecast", forecast_type: "daily", entity_id: id },
    );
    this._weatherUnsub.catch(() => {
      // Integration ohne Tagesvorhersage → stündlich versuchen
      this._weatherUnsub = this.hass?.connection?.subscribeMessage<{ forecast?: ForecastDay[] }>(
        (msg) => {
          if (!msg.forecast?.length) return;
          const today = msg.forecast.slice(0, 24).map((f) => f.temperature).filter((v): v is number => v != null);
          this._forecast = { condition: msg.forecast[0].condition, temperature: Math.max(...today), templow: Math.min(...today) };
        },
        { type: "weather/subscribe_forecast", forecast_type: "hourly", entity_id: id },
      );
      this._weatherUnsub?.catch(() => undefined);
    });
  }

  // ---------- Verlauf heute: Laufzeit & Trend für die Ziel-Prognose ----------

  private _maybeFetchToday(): void {
    const c = this._config;
    if (!c || !this.hass || !this.isConnected) return;
    const key = `${c.entity}|${this._externalTemp?.entity_id ?? ""}`;
    if (key === this._todayKey) return;
    this._todayKey = key;
    clearInterval(this._todayTimer);
    this._fetchToday();
    this._todayTimer = window.setInterval(() => this._fetchToday(), 10 * 60 * 1000);
  }

  private async _fetchToday(): Promise<void> {
    const c = this._config;
    const hass = this.hass;
    if (!c || !hass) return;
    const now = Date.now();
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
    const start = Math.min(midnight.getTime(), now - 45 * 60000);
    const sensor = this._externalTemp?.entity_id;
    try {
      const res = await hass.callWS<Record<string, { s: string; a?: Record<string, any>; lu: number }[]>>({
        type: "history/history_during_period",
        start_time: new Date(start).toISOString(),
        end_time: new Date(now).toISOString(),
        entity_ids: [c.entity, ...(sensor ? [sensor] : [])],
        minimal_response: false, no_attributes: false, significant_changes_only: false,
      });
      // Laufzeit: Summe der Zeiträume, in denen das Gerät gearbeitet hat (seit Mitternacht)
      let runtime = 0;
      let attrs: Record<string, any> = {};
      const rows = res[c.entity] ?? [];
      rows.forEach((row, i) => {
        if (row.a) attrs = row.a;
        const from = Math.max(row.lu * 1000, midnight.getTime());
        const to = rows[i + 1] ? rows[i + 1].lu * 1000 : now;
        if (to <= from) return;
        const action = (attrs.hvac_action as string | undefined) ?? inferAction(row.s, attrs);
        if (action && !["idle", "off"].includes(action)) runtime += to - from;
      });
      this._runtimeToday = runtime / 1000;
      // Messpunkte der letzten 45 Minuten für den Trend
      const samples: Sample[] = [];
      let last: Record<string, any> = {};
      for (const row of res[sensor ?? c.entity] ?? []) {
        if (row.a) last = row.a;
        const v = Number(sensor && !sensor.startsWith("climate.") ? row.s : last.current_temperature);
        if (Number.isFinite(v)) samples.push({ t: Math.max(row.lu * 1000, now - 45 * 60000), v });
      }
      this._samples = samples;
    } catch (err) {
      console.warn("ha-climate-card: history (today) failed", err);
    }
  }

  /** Live-Messpunkte ergänzen, damit der Trend zwischen den Abrufen aktuell bleibt. */
  private _recordSample(): void {
    const st = this._stateObj;
    const v = st ? this._currentTemp(st) : undefined;
    if (v == null) return;
    const now = Date.now();
    const last = this._samples[this._samples.length - 1];
    if (last && last.v === v) return;
    this._samples = [...this._samples.filter((p) => p.t >= now - 45 * 60000), { t: now, v }];
  }

  /** Temperatur, auf die das Gerät gerade hinarbeitet (bei Bereich die nächste Grenze). */
  private _goal(st: HassEntity): number | undefined {
    if (st.state === "off") return undefined;
    const t = this._targets(st);
    if (!this._isDual(st)) return t.value;
    const cur = this._currentTemp(st);
    if (cur == null || t.low == null || t.high == null) return undefined;
    return cur < t.low ? t.low : cur > t.high ? t.high : undefined;
  }

  private _etaText(st: HassEntity): string | undefined {
    const goal = this._goal(st);
    const cur = this._currentTemp(st);
    if (goal == null || cur == null || !this._isActive(st)) return undefined;
    const now = Date.now();
    const recent = this._samples.filter((p) => p.t >= now - 30 * 60000);
    const minutes = etaMinutes(cur, goal, trendSlope(recent));
    if (minutes == null) return undefined;
    const rounded = minutes < 15 ? Math.max(1, Math.round(minutes)) : Math.round(minutes / 5) * 5;
    const text = rounded >= 60
      ? `${Math.floor(rounded / 60)} h ${String(rounded % 60).padStart(2, "0")} min`
      : `${rounded} min`;
    return `${this._t("card.eta")} ${text}`;
  }

  private _fmtDuration(seconds: number): string {
    const lang = this.hass?.locale?.language ?? this.hass?.language ?? "de";
    if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
    return `${(seconds / 3600).toLocaleString(lang, { maximumFractionDigits: 1 })} h`;
  }

  /** Kleine Status-Chips unter dem Kopf: Voreinstellung, aktive Schalter, Timer. */
  private _renderPills(st: HassEntity) {
    const c = this._config!;
    const hass = this.hass!;
    const pills: { icon: string; text: string; warn?: boolean }[] = [];
    const preset = st.attributes.preset_mode as string | undefined;
    if (preset && !["none", "off"].includes(preset)) {
      pills.push({ icon: "mdi:star-four-points-outline", text: formatAttribute(hass, st, "preset_mode", preset) });
    }
    if (c.timer_switch && hass.states[c.timer_switch]?.state === "on") {
      const a = c.timer_time ? hass.states[c.timer_time]?.attributes : undefined;
      const time = a?.hour != null ? `${String(a.hour).padStart(2, "0")}:${String(a.minute ?? 0).padStart(2, "0")}` : "";
      pills.push({ icon: "mdi:sleep", text: time || this._t("card.sleep_timer") });
    }
    const timer = c.countdown_timer ? hass.states[c.countdown_timer] : undefined;
    if (timer?.state === "active" && timer.attributes.finishes_at) {
      const end = new Date(timer.attributes.finishes_at);
      pills.push({ icon: "mdi:timer-outline", text: `${this._t("card.until")} ${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}` });
    }
    const open = this._openContacts();
    if (open.length) {
      pills.push({ icon: this._contactIcon(open[0]), text: `${open.length} ${this._t("card.open")}`, warn: true });
    }
    if (this._show.shortcuts) {
      for (const item of this._shortcutItems(st)) {
        const sh = hass.states[item.entity];
        if (sh?.state === "on" && ["switch", "input_boolean", "light", "fan"].includes(item.entity.split(".")[0])) {
          pills.push({ icon: item.icon ?? fallbackIcon(sh, item.entity, item.name), text: item.name });
        }
      }
    }
    if (!pills.length) return nothing;
    return html`<div class="pills">${pills.slice(0, 5).map((p) => html`<span class="pill ${p.warn ? "warn" : ""}"><ha-icon .icon=${p.icon}></ha-icon>${p.text}</span>`)}</div>`;
  }

  private _outdoorTemp(): number | undefined {
    const c = this._config!;
    const out = c.outdoor_sensor ? temperatureOf(this.hass!.states[c.outdoor_sensor]) : undefined;
    return out ?? (c.weather_entity ? temperatureOf(this.hass!.states[c.weather_entity]) : undefined);
  }

  /** Externer Raumsensor/Thermostat wird als Ist-Temperatur genutzt (Standard, sobald einer eingetragen ist). */
  private get _externalTemp(): HassEntity | undefined {
    const c = this._config;
    if (!c?.temperature_sensor || c.use_sensor_for_current === false) return undefined;
    return this.hass?.states[c.temperature_sensor];
  }

  /** Temperatur einer Sensor- oder Klima-Entität (bei Thermostaten aus `current_temperature`). */
  private _tempOf(entity?: HassEntity): number | undefined {
    if (!entity) return undefined;
    const raw = entity.entity_id.startsWith("climate.") ? entity.attributes.current_temperature : entity.state;
    const v = raw == null || raw === "" ? NaN : Number(raw);
    return Number.isFinite(v) ? v : undefined;
  }

  /** Ist-Temperatur: externer Sensor/Thermostat, sonst automatisch die der Klimaanlage. */
  private _currentTemp(st: HassEntity): number | undefined {
    return this._tempOf(this._externalTemp) ?? this._tempOf(st);
  }

  /** Ist-Luftfeuchte: eigener Sensor, sonst externes Thermostat, sonst Klimaanlage. */
  private _currentHumidity(st: HassEntity): number | undefined {
    const c = this._config;
    const candidates = [
      c?.humidity_sensor ? this.hass?.states[c.humidity_sensor]?.state : undefined,
      this._externalTemp?.attributes.current_humidity,
      st.attributes.current_humidity,
    ];
    for (const raw of candidates) {
      const v = raw == null || raw === "" ? NaN : Number(raw);
      if (Number.isFinite(v)) return v;
    }
    return undefined;
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
    if (entityId.startsWith("weather.") || entityId.startsWith("climate.")) {
      const t = temperatureOf(s);
      return t != null ? `${t} ${s.attributes.temperature_unit ?? this._unit}` : "–";
    }
    if (this.hass.formatEntityState) return this.hass.formatEntityState(s);
    const unit = s.attributes.unit_of_measurement;
    return unit ? `${s.state} ${unit}` : s.state;
  }

  /** Alle konfigurierten Fenster-/Türkontakte (inkl. des älteren `window_sensor`). */
  private _contacts(): ResolvedContact[] {
    return this._config && this.hass ? resolveContacts(this.hass.states, this._config) : [];
  }

  private _contactIds(): string[] {
    const c = this._config;
    if (!c) return [];
    return [...(c.contact_sensors ?? []).map((x) => (typeof x === "string" ? x : x.entity)), ...(c.window_sensor ? [c.window_sensor] : [])];
  }

  private _openContacts(): ResolvedContact[] {
    return this._contacts().filter((c) => c.open);
  }

  /** Irgendein Fenster oder eine Tür ist offen. */
  private _windowOpen(): boolean {
    return this._openContacts().length > 0;
  }

  private _contactIcon(c: ResolvedContact): string {
    if (c.type === "door") return c.open ? "mdi:door-open" : "mdi:door-closed";
    return c.open ? "mdi:window-open-variant" : "mdi:window-closed-variant";
  }

  /** Kompakte Chip-Reihe aller Kontakte: offen hervorgehoben mit Namen, geschlossen dezent. */
  private _renderContacts() {
    const contacts = this._contacts();
    if (!contacts.length) return nothing;
    return html`<div class="contacts" role="list" aria-label=${this._t("card.contacts")}>
      ${contacts.map((c) => html`<button class="contact ${c.open ? "open" : ""}" role="listitem"
        title=${`${c.name}: ${this._t(c.open ? "card.open" : "card.closed")}`} @click=${() => this._moreInfo(c.entity)}>
        <ha-icon .icon=${this._contactIcon(c)}></ha-icon><span>${c.name}</span>
      </button>`)}
    </div>`;
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
    this._syncing = true;
    this.hass.callService("climate", service, { entity_id: st.entity_id, ...data }).catch((err) => {
      console.error("ha-climate-card:", err);
      this._pending = undefined;
      this._pendingHumidity = undefined;
      this._syncing = false;
      this._showError(err?.message ?? String(err));
    });
    clearTimeout(this._clearTimer);
    this._clearTimer = window.setTimeout(() => {
      this._pending = undefined;
      this._pendingHumidity = undefined;
      this._sentAt = undefined;
      this._syncing = false;
    }, 6000);
  }

  /** Fehler in der Karte anzeigen und zusätzlich als HA-Toast melden. */
  private _showError(detail: string): void {
    this._error = `${this._t("card.error")}: ${detail}`;
    this.dispatchEvent(new CustomEvent("hass-notification", { detail: { message: this._error }, bubbles: true, composed: true }));
    this._haptic("failure");
    clearTimeout(this._errorTimer);
    this._errorTimer = window.setTimeout(() => (this._error = undefined), 6000);
  }

  /** Haptisches Feedback in der Home-Assistant-App. */
  private _haptic(type: "light" | "selection" | "success" | "failure" = "light"): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: type }));
  }

  /** +/- gedrückt halten: sofort einmal, nach kurzer Pause fortlaufend wiederholen. */
  private _holdStart(ev: PointerEvent, fn: () => void): void {
    if (ev.button !== 0) return;
    this._holdEnd();
    fn();
    this._holdDelay = window.setTimeout(() => {
      this._holdRepeat = window.setInterval(fn, 110);
    }, 420);
  }

  private _holdEnd = (): void => {
    clearTimeout(this._holdDelay);
    clearInterval(this._holdRepeat);
  };

  private _holdButton(label: string, icon: string, fn: () => void, cls = "") {
    return html`<button class=${cls} aria-label=${label}
      @pointerdown=${(e: PointerEvent) => this._holdStart(e, fn)} @pointerup=${this._holdEnd}
      @pointerleave=${this._holdEnd} @pointercancel=${this._holdEnd}
      @contextmenu=${(e: Event) => e.preventDefault()}
      @click=${(e: MouseEvent) => { if (e.detail === 0) fn(); }}><ha-icon icon=${icon}></ha-icon></button>`;
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
    const prev = this._pending;
    const next = ev.detail as PendingTarget;
    if (!prev || prev.value !== next.value || prev.low !== next.low || prev.high !== next.high) this._haptic("selection");
    this._pending = { ...next };
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
    if (next !== t[which]) this._haptic("selection");
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
    this._haptic("light");
    this._call("set_hvac_mode", { hvac_mode: ev.detail.mode });
  }

  private _togglePower(): void {
    this._haptic("light");
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
    const action = this._action(st);
    const statusText = action
      ? formatAttribute(this.hass!, st, "hvac_action", action)
      : formatMode(this.hass!, st, st.state);
    const canPower = (st.attributes.hvac_modes ?? []).includes("off")
      || supports(st.attributes, ClimateFeature.TURN_OFF);
    return html`
      <div class="header">
        <button class="title" @click=${() => this._moreInfo()}>
          <span class="icon-badge ${this._isActive(st) ? "active" : ""}" data-action=${action ?? ""} data-mode=${st.state}>
            <ha-icon .icon=${this._config!.icon ?? stateIcon(st, action)}></ha-icon>
          </span>
          <span class="names">
            <span class="name">${name}</span>
            <span class="status">${this._syncing ? html`<span class="sync" title=${this._t("card.syncing")}></span>` : nothing}${statusText}</span>
          </span>
        </button>
        ${canPower ? html`
          <button class="power ${st.state !== "off" ? "on" : ""}"
            title=${this._t(st.state === "off" ? "card.turn_on" : "card.turn_off")}
            aria-label=${this._t(st.state === "off" ? "card.turn_on" : "card.turn_off")}
            @click=${this._togglePower}>
            <ha-icon icon="mdi:power"></ha-icon>
          </button>` : nothing}
      </div>
      ${this._renderPills(st)}`;
  }

  /** Hinweise: Fenster offen, Lüften statt Kühlen/Heizen, hohe Luftfeuchte (Schimmelgefahr). */
  private _renderHints(st: HassEntity): TemplateResult | typeof nothing {
    const c = this._config!;
    const banners: TemplateResult[] = [];
    if (this._error) {
      banners.push(html`<div class="banner error" role="alert" @click=${() => (this._error = undefined)}>
        <ha-icon icon="mdi:alert-circle-outline"></ha-icon><div><strong>${this._error}</strong></div>
      </div>`);
    }
    const open = this._openContacts();
    const openKey = openContactsKey(open);
    if (openKey) {
      const title = openKey === "contacts_open" ? `${open.length} ${this._t("card.contacts_open")}` : this._t(`card.${openKey}`);
      banners.push(html`<div class="banner" @click=${() => this._moreInfo(open[0].entity)}>
        <ha-icon .icon=${this._contactIcon(open[0])}></ha-icon>
        <div><strong>${title}</strong><span>${open.map((o) => o.name).join(", ")} – ${this._t("card.window_open_hint")}</span></div>
      </div>`);
    }
    if (this._show.hints) {
      const inside = this._currentTemp(st);
      const outside = this._outdoorTemp();
      const delta = c.ventilation_delta ?? 3;
      const action = this._action(st);
      const cooling = st.state === "cool" || action === "cooling";
      const heating = st.state === "heat" || action === "heating";
      if (!this._windowOpen() && inside != null && outside != null) {
        const fmt = (v: number) => `${v.toFixed(1)}°`;
        if (cooling && inside - outside >= delta) {
          banners.push(html`<div class="banner info">
            <ha-icon icon="mdi:weather-windy"></ha-icon>
            <div><strong>${this._t("card.ventilate_cool")}</strong>
              <span>${this._t("card.outside")} ${fmt(outside)} · ${this._t("card.inside")} ${fmt(inside)} – ${this._t("card.ventilate_hint")}</span></div>
          </div>`);
        } else if (heating && outside - inside >= delta) {
          banners.push(html`<div class="banner info">
            <ha-icon icon="mdi:weather-windy"></ha-icon>
            <div><strong>${this._t("card.ventilate_heat")}</strong>
              <span>${this._t("card.outside")} ${fmt(outside)} · ${this._t("card.inside")} ${fmt(inside)} – ${this._t("card.ventilate_hint")}</span></div>
          </div>`);
        }
      }
      const hum = this._currentHumidity(st);
      const limit = c.humidity_warning ?? 70;
      if (hum != null && limit > 0 && hum >= limit) {
        const dp = inside != null ? dewPoint(inside, hum, this._unit) : undefined;
        const canDry = (st.attributes.hvac_modes ?? []).includes("dry") && st.state !== "dry";
        banners.push(html`<div class="banner humid">
          <ha-icon icon="mdi:water-alert"></ha-icon>
          <div><strong>${this._t("card.humidity_high")} (${Math.round(hum)} %)</strong>
            <span>${this._t("card.mold_hint")}${dp != null ? ` · ${this._t("card.dew_point")} ${dp.toFixed(1)}°` : ""}</span></div>
          ${canDry ? html`<button class="banner-action" @click=${() => this._call("set_hvac_mode", { hvac_mode: "dry" })}>
            ${this._t("card.start_dry")}</button>` : nothing}
        </div>`);
      }
    }
    return banners.length ? html`<div class="hints">${banners}</div>` : nothing;
  }

  private _renderStepper(which: keyof PendingTarget, value: number | undefined, step: number, color?: string) {
    return html`<div class="stepper" style=${color && color !== ACCENT ? `--accent:${color}` : ""}>
      ${this._holdButton("-", "mdi:minus", () => this._stepTarget(which, -1))}
      <span class="stepper-value" data-pop=${`step-${which}`}>${this._fmt(value, step)}<small>${this._unit}</small></span>
      ${this._holdButton("+", "mdi:plus", () => this._stepTarget(which, 1))}
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
    const humidity = this._currentHumidity(st);

    return html`
      <hcc-climate-dial
        .min=${Number(a.min_temp ?? 7)} .max=${Number(a.max_temp ?? 35)} .step=${step}
        .value=${t.value} .low=${t.low} .high=${t.high} .current=${cur}
        .dual=${dual} .disabled=${off || !hasTarget} .color=${color} .active=${this._isActive(st)}
        .fade=${["dry", "fan_only"].includes(st.state)}
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
              : html`<span class="dial-big" data-pop="target">${this._fmt(t.value, step)}<sup>${this._unit}</sup></span>`}
          <span class="dial-sub">
            ${!off && hasTarget ? html`<ha-icon icon="mdi:home-thermometer-outline"></ha-icon><span
              style=${`color:${temperatureTint(cur, this._goal(st)) ?? "inherit"}`}>${this._fmt(cur, step)}${this._unit}</span>` : nothing}
            ${humidity != null ? html`<ha-icon icon="mdi:water-percent"></ha-icon>${Math.round(Number(humidity))}%` : nothing}
          </span>
          ${this._etaText(st) ? html`<span class="eta"><ha-icon icon="mdi:timer-sand"></ha-icon>${this._etaText(st)}</span>` : nothing}
        </div>
      </hcc-climate-dial>
      ${!off && hasTarget ? html`<div class="dial-steppers ${dual ? "dual" : ""}">
        ${dual
          ? html`${this._renderStepper("low", t.low, step, "var(--state-climate-heat-color,#ff6d00)")}
                 ${this._renderStepper("high", t.high, step, "var(--state-climate-cool-color,#2196f3)")}`
          : html`${this._holdButton("-", "mdi:minus", () => this._stepTarget("value", -1), "round")}
                 ${this._holdButton("+", "mdi:plus", () => this._stepTarget("value", 1), "round")}`}
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
        @option-selected=${(e: CustomEvent) => { this._haptic("selection"); this._call(service, { [attr]: e.detail.value }); }}>
      </hcc-attribute-select>`, key);
    };
    select("fan", "fan_mode", "fan_modes", ClimateFeature.FAN_MODE, "card.fan", "mdi:fan", "set_fan_mode", show.fan);
    select("swing", "swing_mode", "swing_modes", ClimateFeature.SWING_MODE, "card.swing", "mdi:arrow-oscillating", "set_swing_mode", show.swing);
    select("swing", "swing_horizontal_mode", "swing_horizontal_modes", ClimateFeature.SWING_HORIZONTAL_MODE,
      "card.swing_horizontal", "mdi:arrow-left-right", "set_swing_horizontal_mode", show.swing);
    select("presets", "preset_mode", "preset_modes", ClimateFeature.PRESET_MODE, "card.preset", "mdi:star-outline", "set_preset_mode", show.presets);

    if (show.timer && (this._config!.timer_switch || this._config!.timer_time)) {
      parts.push(html`<hcc-sleep-timer .hass=${hass} .switchEntity=${this._config!.timer_switch}
        .timeEntity=${this._config!.timer_time} .label=${this._t("card.sleep_timer")} .offText=${this._t("card.timer_off")}
        .atText=${this._t("card.timer_at")} .inText=${this._t("card.timer_in")}></hcc-sleep-timer>`, "timer");
    }

    if (show.timer && this._config!.countdown_timer && hass.states[this._config!.countdown_timer]) {
      parts.push(html`<hcc-countdown-timer .hass=${hass} .entity=${this._config!.countdown_timer}
        .durations=${this._config!.countdown_durations ?? [30, 60, 90, 120]}
        .label=${this._t("card.countdown")} .cancelText=${this._t("card.cancel")}></hcc-countdown-timer>`, "countdown");
    }

    if (show.shortcuts) {
      const items = this._shortcutItems(st);
      if (items.length) parts.push(html`<hcc-shortcut-row .hass=${hass} .items=${items}></hcc-shortcut-row>`, "shortcuts");
    }

    if (show.humidity && supports(a, ClimateFeature.TARGET_HUMIDITY) && a.humidity != null) {
      const hum = this._pendingHumidity ?? Number(a.humidity);
      parts.push(html`<div class="humidity-row">
        <span class="row-label"><ha-icon icon="mdi:water-percent"></ha-icon>${this._t("card.target_humidity")}</span>
        <div class="stepper">
          ${this._holdButton("-", "mdi:minus", () => this._stepHumidity(-1))}
          <span class="stepper-value" data-pop="humidity">${hum}<small>%</small></span>
          ${this._holdButton("+", "mdi:plus", () => this._stepHumidity(1))}
        </div>
      </div>`, "humidity");
    }

    if (show.sensors) {
      const items = this._sensorItems(st);
      if (items.length) parts.push(html`<hcc-sensor-row .items=${items}></hcc-sensor-row>`, "sensors");
      if (this._contacts().length) parts.push(this._renderContacts() as TemplateResult, "contacts");
    }

    const graphVisible = this._expanded || (this._config!.layout !== "compact" && this._config!.expandable === false);
    if (show.graph) {
      parts.push(html`<div class="graph-wrap">
        <span class="row-label"><ha-icon icon="mdi:chart-line"></ha-icon>${this._t("card.history")}</span>
        ${this._graphLoaded || graphVisible ? html`<hcc-history-graph .hass=${hass} .entity=${st.entity_id}
          .sensor=${this._externalTemp?.entity_id}
          .hours=${this._config!.graph_hours ?? 24} .unit=${this._unit} .emptyText=${this._t("card.no_history")}
          style="--hcc-accent:${color}"></hcc-history-graph>` : html`<div class="graph-placeholder"></div>`}
      </div>`, "graph");
    }
    return sections;
  }

  private _renderSections(sections: Section[], color: string) {
    if (!sections.length) return nothing;
    return html`<div class="controls" style="--hcc-accent:${color}">${sections.map((s) => s.tpl)}</div>`;
  }

  /** Ausklappbarer Bereich mit weicher Höhen-Animation (grid-template-rows 0fr → 1fr). */
  private _renderCollapsible(content: unknown) {
    return html`<div class="collapsible ${this._expanded ? "open" : ""}" ?inert=${!this._expanded} aria-hidden=${!this._expanded}>
      <div class="collapsible-inner">${content}</div>
    </div>`;
  }

  private _renderExpandButton() {
    return html`<button class="expand" @click=${() => { this._expanded = !this._expanded; }} aria-expanded=${this._expanded}>
      <span>${this._t(this._expanded ? "card.less" : "card.more")}</span>
      <ha-icon class="chevron" icon="mdi:chevron-down"></ha-icon>
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
        ${this._renderCollapsible(this._renderSections(details, color))}
        ${this._renderExpandButton()}` : nothing}`;
  }

  private _sensorItems(st: HassEntity): SensorItem[] {
    const c = this._config!;
    const items: SensorItem[] = [];
    const add = (entity: string | undefined, icon: string, labelKey: string, warning = false) => {
      const value = this._sensorState(entity);
      if (value != null) items.push({ entity, icon, label: this._t(labelKey), value, warning });
    };
    if (c.temperature_sensor && c.use_sensor_for_current === false) {
      const ext = this.hass!.states[c.temperature_sensor];
      const v = this._tempOf(ext);
      if (ext) items.push({ entity: ext.entity_id, icon: "mdi:home-thermometer-outline", label: this._t("card.current"),
        value: v != null ? `${v} ${this._unit}` : "–" });
    }
    const hum = this._currentHumidity(st);
    if (this._config?.layout === "compact" && hum != null) {
      items.push({ entity: c.humidity_sensor, icon: "mdi:water-percent", label: this._t("card.humidity"), value: `${Math.round(hum)} %` });
    }
    if (this._runtimeToday != null && this._runtimeToday >= 60) {
      items.push({ icon: "mdi:timer-sand", label: this._t("card.runtime_today"), value: this._fmtDuration(this._runtimeToday) });
    }
    if (c.outdoor_sensor) {
      const out = this.hass!.states[c.outdoor_sensor];
      const t = temperatureOf(out);
      // Nur anzeigen, wenn der Sensor wirklich eine Temperatur liefert
      if (t != null) {
        const unit = out.attributes.temperature_unit ?? out.attributes.unit_of_measurement ?? this._unit;
        items.push({ entity: c.outdoor_sensor, icon: "mdi:thermometer", label: this._t("card.outdoor"), value: `${t} ${unit}` });
      }
    }
    if (c.weather_entity && this.hass!.states[c.weather_entity]) {
      const w = this.hass!.states[c.weather_entity];
      const f = this._forecast;
      const cond = f?.condition ?? w.state;
      const value = f?.temperature != null
        ? `${Math.round(f.temperature)}°${f.templow != null ? ` / ${Math.round(f.templow)}°` : ""}`
        : this._sensorState(c.weather_entity) ?? "–";
      const rain = f?.precipitation_probability ? ` · ☂ ${f.precipitation_probability} %` : "";
      items.push({ entity: c.weather_entity, icon: WEATHER_ICONS[cond] ?? "mdi:weather-partly-cloudy",
        label: `${this._t("card.today")}${rain}`, value });
    }
    if (this._show.hints) {
      const t = this._currentTemp(st);
      const h = this._currentHumidity(st);
      const dp = t != null && h != null ? dewPoint(t, h, this._unit) : undefined;
      if (dp != null) {
        items.push({ icon: "mdi:water-thermometer-outline", label: this._t("card.dew_point"),
          value: `${dp.toFixed(1)} ${this._unit}`, warning: h! >= (c.humidity_warning ?? 70) });
      }
    }
    add(c.power_sensor, "mdi:flash", "card.power");
    add(c.energy_sensor, "mdi:lightning-bolt", "card.energy");
    return items;
  }

  /** Schmale Skala für das Kompakt-Layout: Verlauf zwischen Ist und Ziel, wie beim Drehregler. */
  private _renderGauge(st: HassEntity) {
    if (st.state === "off") return nothing;
    const a = st.attributes;
    const min = Number(a.min_temp ?? 7);
    const max = Number(a.max_temp ?? 35);
    const pos = (v: number) => `${(Math.min(1, Math.max(0, (v - min) / (max - min || 1))) * 100).toFixed(2)}%`;
    const cur = this._currentTemp(st);
    const t = this._targets(st);
    const dual = this._isDual(st);
    const heat = "var(--state-climate-heat-color, #ff6d00)";
    const cool = "var(--state-climate-cool-color, #2196f3)";
    let seg: unknown = nothing;
    if (dual && t.low != null && t.high != null) {
      seg = html`<span class="g-zone" style="left:${pos(t.low)};right:calc(100% - ${pos(t.high)});background:linear-gradient(90deg, ${heat}, ${cool})"></span>`;
    } else if (cur != null && t.value != null) {
      const lo = Math.min(cur, t.value);
      const hi = Math.max(cur, t.value);
      const curColor = ["dry", "fan_only"].includes(st.state) ? "color-mix(in srgb, var(--accent) 25%, transparent)" : cur > t.value ? heat : cool;
      const [cFrom, cTo] = cur < t.value ? [curColor, "var(--accent)"] : ["var(--accent)", curColor];
      seg = html`<span class="g-seg ${this._isActive(st) ? "flowing" : ""} ${cur < t.value ? "up" : "down"}"
        style="left:${pos(lo)};right:calc(100% - ${pos(hi)});--c1:${cFrom};--c2:${cTo}"></span>`;
    }
    return html`<div class="gauge" aria-hidden="true">
      <span class="g-track"></span>
      ${seg}
      ${cur != null ? html`<span class="g-cur" style="left:${pos(cur)}"></span>` : nothing}
      ${dual
        ? html`<span class="g-knob" style="left:${pos(t.low ?? min)};--k:${heat}"></span><span class="g-knob" style="left:${pos(t.high ?? max)};--k:${cool}"></span>`
        : t.value != null ? html`<span class="g-knob" style="left:${pos(t.value)};--k:var(--accent)"></span>` : nothing}
    </div>
    ${this._etaText(st) ? html`<span class="eta compact-eta"><ha-icon icon="mdi:timer-sand"></ha-icon>${this._etaText(st)}</span>` : nothing}`;
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
          <span class="big" style=${`color:${off ? "inherit" : temperatureTint(cur, this._goal(st)) ?? "inherit"}`}>${this._fmt(cur, step)}<sup>${this._unit}</sup></span>
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
      ${this._renderGauge(st)}
      ${this._renderHints(st)}
      ${this._renderExpandButton()}
      ${this._renderCollapsible(this._renderSections(this._sections(st, color), color))}`;
  }

  /** Luftstrom-Animation: nur wenn das Gerät läuft; Tempo nach Lüfterstufe, Pendeln nach Lamellen. */
  private _renderAirflow(st: HassEntity, color: string) {
    if (!this._show.airflow || !this._isActive(st) || (this._config!.animations ?? "full") !== "full") return nothing;
    const a = st.attributes;
    const fans = (a.fan_modes ?? []) as string[];
    const idx = fans.indexOf(a.fan_mode);
    const auto = /auto/i.test(a.fan_mode ?? "");
    const speed = idx < 0 || auto ? 0.5 : fans.filter((f) => !/auto/i.test(f)).indexOf(a.fan_mode) / Math.max(1, fans.filter((f) => !/auto/i.test(f)).length - 1);
    const swinging = (v?: string) => !!v && (/swing|^on$|both|vertical|auto/i.test(v)) && !/fixed/i.test(v);
    const sv = swinging(a.swing_mode) && !/^horizontal$/i.test(a.swing_mode);
    const sh = swinging(a.swing_horizontal_mode) || /both|horizontal/i.test(a.swing_mode ?? "");
    const action = this._action(st);
    const variant = action === "heating" || action === "preheating" ? "heat" : action === "cooling" ? "cool" : "neutral";
    return html`<hcc-airflow .speed=${Math.max(0, Math.min(1, speed))} .swingVertical=${sv} .swingHorizontal=${sh}
      .color=${color} .variant=${variant}></hcc-airflow>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const st = this._stateObj;
    if (!st) {
      return html`<ha-card><div class="warning">${this._t("card.entity_not_found")}: ${this._config.entity}</div></ha-card>`;
    }
    const name = this._config.name ?? st.attributes.friendly_name ?? st.entity_id;
    if (UNAVAILABLE.includes(st.state)) {
      return html`<ha-card class="unavailable" style="--hcc-accent-c:${MODE_COLORS.off}">
        ${this._renderHeader(st, name, MODE_COLORS.off)}
        <div class="warning">${this._t("card.unavailable")}</div>
      </ha-card>`;
    }
    const color = ACCENT;
    const compact = this._config.layout === "compact";
    const mood = st.state === "off" ? "off" : this._isActive(st) ? "active" : "idle";
    const anim = this._config.animations ?? "full";
    return html`<ha-card class="${compact ? "compact" : "full"} ${mood} anim-${anim}" style="--hcc-accent-c:${this._modeColor(st)}">
      <div class="glow"><span class="blob b1"></span><span class="blob b2"></span></div>
      ${this._renderAirflow(st, color)}
      ${compact
        ? this._renderCompact(st, name, color)
        : html`
          ${this._renderHeader(st, name, color)}
          ${this._renderHints(st)}
          ${this._renderDial(st, color)}
          ${this._renderFullControls(st, color)}`}
    </ha-card>`;
  }

  static styles = cardStyles;
}

declare global {
  interface HTMLElementTagNameMap { "ha-climate-card": HaClimateCard; }
}
