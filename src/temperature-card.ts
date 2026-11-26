import { LitElement, css, html, nothing, svg, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant, TemperatureCardConfig, TemperatureEntityConfig } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { tempDefaults, tempLevel, tempStats, UNAVAILABLE, type TempLevel } from "./utils";
import "./temperature-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-temperature-card",
  name: "Modern Temperature Card",
  description: "Temperatur-Überwachung: Sensoren als Kacheln mit Trend, Min/Max, Grenzwert-Warnung (z. B. Gerätetemperatur ab 60 °C) und gemeinsamem 24-h-Verlauf (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const PALETTE = ["#1e88e5", "#fb8c00", "#43a047", "#8e24aa", "#00acc1", "#e53935", "#6d4c41", "#3949ab"];
const LEVEL_COLOR: Record<TempLevel, string | undefined> = { ok: undefined, warn_high: "#fb8c00", alarm_high: "#e53935", warn_low: "#29b6f6", alarm_low: "#1565c0" };

interface Row {
  cfg: TemperatureEntityConfig;
  name: string;
  value?: number;
  unit: string;
  color: string;
  icon: string;
  level: TempLevel;
  limits: ReturnType<typeof tempDefaults>;
}

type Pts = { t: number; v: number }[];

@customElement("ha-temperature-card")
export class HaTemperatureCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: TemperatureCardConfig;
  @state() private _hist: Record<string, Pts> = {};
  @state() private _loaded = false;
  private _interval?: number;
  private _loadedKey?: string;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-temperature-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<TemperatureCardConfig> {
    return { entities: Object.values(hass.states).filter((s) => s.attributes.device_class === "temperature" && s.entity_id.startsWith("sensor.")).slice(0, 4).map((s) => s.entity_id) };
  }

  public setConfig(config: TemperatureCardConfig): void {
    if (!config?.entities?.length) throw new Error("ha-temperature-card: 'entities' angeben");
    this._config = { ...config };
    this._loadedKey = undefined;
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this._interval = window.setInterval(() => this._load(), 10 * 60_000);
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this._interval);
  }

  public getCardSize(): number {
    return 3 + Math.ceil(this._entities().length / 2) * 2;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  private _t(key: string): string {
    return localize(this.hass, `temperature.${key}`);
  }

  private _entities(): TemperatureEntityConfig[] {
    return (this._config?.entities ?? []).map((e) => (typeof e === "string" ? { entity: e } : e));
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    return !old || old.locale !== this.hass!.locale || this._entities().some((e) => old.states[e.entity] !== this.hass!.states[e.entity]);
  }

  protected updated(): void {
    const key = JSON.stringify([this._entities(), this._config?.hours]);
    if (this.hass && this._loadedKey !== key) {
      this._loadedKey = key;
      this._load();
    }
  }

  private _valueOf(st: HassEntity | undefined, attr?: string): number | undefined {
    if (!st || UNAVAILABLE.includes(st.state)) return undefined;
    const n = Number(attr ? st.attributes[attr] : st.state);
    return Number.isFinite(n) ? n : undefined;
  }

  private async _load(): Promise<void> {
    if (!this.hass?.callWS) return;
    const ents = this._entities();
    const hours = this._config?.hours ?? 24;
    const start = new Date(Date.now() - hours * 3_600_000).toISOString(), end = new Date().toISOString();
    const plain = ents.filter((e) => !e.attribute).map((e) => e.entity);
    const withAttr = ents.filter((e) => e.attribute);
    const parse = (rows: any[] | undefined, attr?: string): Pts => (rows ?? [])
      .map((p) => ({ t: p.lu != null ? p.lu * 1000 : Date.parse(p.last_updated ?? p.last_changed ?? 0), v: Number(attr ? p.a?.[attr] ?? p.attributes?.[attr] : p.s ?? p.state) }))
      .filter((p) => Number.isFinite(p.v) && Number.isFinite(p.t));
    const hist: Record<string, Pts> = {};
    try {
      if (plain.length) {
        const res = await this.hass.callWS<Record<string, any[]>>({ type: "history/history_during_period", start_time: start, end_time: end,
          entity_ids: plain, minimal_response: true, no_attributes: true, significant_changes_only: false });
        for (const id of plain) hist[id] = parse(res?.[id]);
      }
      if (withAttr.length) {
        const res = await this.hass.callWS<Record<string, any[]>>({ type: "history/history_during_period", start_time: start, end_time: end,
          entity_ids: [...new Set(withAttr.map((e) => e.entity))], significant_changes_only: false });
        for (const e of withAttr) hist[`${e.entity}|${e.attribute}`] = parse(res?.[e.entity], e.attribute);
      }
    } catch {
      /* ohne Verlauf weiter */
    }
    this._hist = hist;
    this._loaded = true;
  }

  private _rows(): Row[] {
    const s = this.hass!.states;
    return this._entities().map((cfg, i) => {
      const st = s[cfg.entity];
      const name = cfg.name ?? st?.attributes.friendly_name ?? cfg.entity;
      const value = this._valueOf(st, cfg.attribute);
      const auto = tempDefaults(cfg.entity, String(st?.attributes.friendly_name ?? ""));
      const limits = { warn_high: cfg.warn_high ?? auto.warn_high, alarm_high: cfg.alarm_high ?? auto.alarm_high, warn_low: cfg.warn_low, alarm_low: cfg.alarm_low };
      const unit = (cfg.attribute ? st?.attributes.temperature_unit : st?.attributes.unit_of_measurement) ?? "°C";
      const isDevice = auto.warn_high != null;
      const icon = cfg.icon ?? (cfg.entity.startsWith("weather.") ? "mdi:weather-partly-cloudy" : isDevice ? "mdi:thermometer-lines" : st?.attributes.icon ?? "mdi:thermometer");
      return { cfg, name, value, unit, color: cfg.color ?? PALETTE[i % PALETTE.length]!, icon, level: value == null ? "ok" : tempLevel(value, limits), limits };
    });
  }

  private _key(r: Row): string {
    return r.cfg.attribute ? `${r.cfg.entity}|${r.cfg.attribute}` : r.cfg.entity;
  }

  private _fmt(v: number, d = 1): string {
    return v.toLocaleString(getLanguage(this.hass), { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  private _moreInfo(id: string): void {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  private _spark(pts: Pts, r: Row) {
    const now = Date.now();
    const all = [...pts, ...(r.value != null ? [{ t: now, v: r.value }] : [])];
    if (all.length < 2) return nothing;
    const t0 = now - (this._config?.hours ?? 24) * 3_600_000;
    const vs = all.map((p) => p.v);
    const limit = r.limits.warn_high;
    let lo = Math.min(...vs), hi = Math.max(...vs);
    if (limit != null && limit - hi < (hi - lo) * 1.5 + 5) hi = Math.max(hi, limit);
    const pad = (hi - lo) * 0.12 || 0.5;
    lo -= pad; hi += pad;
    const x = (t: number) => ((Math.max(t, t0) - t0) / (now - t0)) * 200;
    const y = (v: number) => 40 - ((v - lo) / (hi - lo)) * 40;
    const d = all.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    return html`<svg class="spark" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
      ${limit != null && limit <= hi ? svg`<line class="limit" x1="0" x2="200" y1=${y(limit)} y2=${y(limit)}></line>` : nothing}
      <path d=${`${d} L200,40 L0,40 Z`} class="area"></path><path d=${d} class="line"></path></svg>`;
  }

  private _chart(rows: Row[]) {
    const now = Date.now();
    const hours = this._config?.hours ?? 24;
    const t0 = now - hours * 3_600_000;
    const series = rows.map((r) => ({ r, pts: [...(this._hist[this._key(r)] ?? []).filter((p) => p.t >= t0), ...(r.value != null ? [{ t: now, v: r.value }] : [])] }))
      .filter((x) => x.pts.length > 1);
    if (!series.length) return nothing;
    const vs = series.flatMap((x) => x.pts.map((p) => p.v));
    let lo = Math.floor(Math.min(...vs)), hi = Math.ceil(Math.max(...vs));
    if (hi - lo < 4) { lo -= 2; hi += 2; }
    const W = 320, H = 110;
    const x = (t: number) => ((t - t0) / (now - t0)) * W;
    const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
    const lang = getLanguage(this.hass);
    const ticks = [0, 0.25, 0.5, 0.75].map((f) => t0 + f * (now - t0));
    return html`<div class="chart-wrap">
      <svg class="chart" viewBox="0 0 ${W} ${H + 14}" preserveAspectRatio="none" role="img" aria-label=${this._t("chart")}>
        ${[lo, (lo + hi) / 2, hi].map((v) => svg`<line class="grid" x1="0" x2=${W} y1=${y(v)} y2=${y(v)}></line>`)}
        ${series.map(({ r, pts }) => svg`<path class="ln" style="stroke:${r.color}" d=${pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")}></path>`)}
        ${ticks.map((t) => svg`<text x=${x(t) + 2} y=${H + 12}>${new Date(t).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })}</text>`)}
      </svg>
      <span class="axis hi">${this._fmt(hi, 0)}°</span><span class="axis lo">${this._fmt(lo, 0)}°</span>
      <div class="legend">${series.map(({ r }) => html`<span><i style="background:${r.color}"></i>${r.name}</span>`)}</div>
    </div>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const rows = this._rows();
    const bad = rows.filter((r) => r.level !== "ok");
    const worst = bad.find((r) => r.level.startsWith("alarm")) ?? bad[0];
    const accent = worst ? LEVEL_COLOR[worst.level]! : "#43a047";
    const sub = worst ? `${worst.name}: ${this._t(`level_${worst.level}`)} (${this._fmt(worst.value!)} ${worst.unit})${bad.length > 1 ? ` +${bad.length - 1}` : ""}` : this._t("all_ok");
    const cols = c.columns ?? Math.min(2, rows.length);
    const now = Date.now();
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    return html`<ha-card class="temps anim-${(c as any).animations ?? "full"}" style="--hcc-accent-c:${accent}">
      <div class="header">
        <span class="h-icon"><ha-icon .icon=${worst ? "mdi:thermometer-alert" : "mdi:thermometer-check"}></ha-icon></span>
        <span class="head-text"><span class="h-title">${c.title ?? this._t("title")}</span><span class="h-sub">${sub}</span></span>
      </div>
      <div class="tiles" style="--cols:${cols}">
        ${rows.map((r) => {
          const pts = this._hist[this._key(r)] ?? [];
          const st = tempStats([...pts, ...(r.value != null ? [{ t: now, v: r.value }] : [])], now, Math.min(dayStart.getTime(), now - 6 * 3_600_000));
          const col = LEVEL_COLOR[r.level] ?? r.color;
          const trend = st.trend;
          return html`<button class="tile ${r.level !== "ok" ? "alert" : ""} ${r.level.startsWith("alarm") ? "alarm" : ""}" style="--tc:${col}" data-entity=${r.cfg.entity}
            @click=${() => this._moreInfo(r.cfg.entity)}>
            <span class="t-top"><span class="t-icon"><ha-icon .icon=${r.level === "ok" ? r.icon : "mdi:thermometer-alert"}></ha-icon></span>
              <span class="t-name">${r.name}</span></span>
            <span class="t-val">${r.value != null ? html`${this._fmt(r.value)}<small> ${r.unit}</small>` : html`<small>${this._t("unavailable")}</small>`}
              ${trend != null && Math.abs(trend) >= 0.2 ? html`<span class="trend ${trend > 0 ? "up" : "down"}"><ha-icon .icon=${trend > 0 ? "mdi:arrow-top-right" : "mdi:arrow-bottom-right"}></ha-icon>${trend > 0 ? "+" : ""}${this._fmt(trend)}/h</span>` : nothing}</span>
            <span class="t-sub">${r.level !== "ok" ? html`<b>${this._t(`level_${r.level}`)}</b>` : st.min != null ? html`<span class="mm">↓ ${this._fmt(st.min)}</span><span class="mm">↑ ${this._fmt(st.max!)}</span>` : nothing}</span>
            ${c.show_graph === false ? nothing : this._spark(pts, r)}
          </button>`;
        })}
      </div>
      ${c.show_graph === false || rows.length < 2 ? nothing : this._loaded ? this._chart(rows) : html`<div class="graph-placeholder"></div>`}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.temps { gap: 12px; container-type: inline-size; }
    .header { display: flex; align-items: center; gap: 10px; }
    .h-icon { flex: none; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); }
    .h-icon ha-icon { --mdc-icon-size: 24px; }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .h-title { font-size: 17px; font-weight: 600; line-height: 1.2; }
    .h-sub { font-size: 12.5px; font-weight: 600; color: var(--accent); }
    .tiles { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 8px; }
    @container (max-width: 300px) { .tiles { grid-template-columns: minmax(0, 1fr); } }
    .tile { position: relative; display: flex; flex-direction: column; gap: 2px; padding: 10px 10px 0; border: none; border-radius: 16px; cursor: pointer; text-align: left; min-width: 0;
      overflow: hidden; color: var(--primary-text-color); background: rgba(127,127,127,0.07); transition: background 0.3s; }
    .tile.alert { background: color-mix(in srgb, var(--tc) 13%, transparent); }
    .tile.alarm { box-shadow: inset 0 0 0 2px var(--tc); animation: alarm 1.6s ease-in-out infinite; }
    @keyframes alarm { 50% { box-shadow: inset 0 0 0 2px transparent; } }
    ha-card.anim-reduced *, ha-card.anim-off * { animation: none !important; }
    .t-top { display: flex; align-items: center; gap: 6px; min-width: 0; }
    .t-icon { flex: none; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; color: var(--tc); background: color-mix(in srgb, var(--tc) 16%, transparent); }
    .t-icon ha-icon { --mdc-icon-size: 16px; }
    .t-name { flex: 1; min-width: 0; font-size: 12.5px; font-weight: 600; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .t-val { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0 6px; font-size: 24px; font-weight: 700; line-height: 1.2; margin-top: 4px; }
    .t-val small { font-size: 13px; font-weight: 600; color: var(--secondary-text-color); }
    .trend { display: inline-flex; align-items: center; font-size: 11.5px; font-weight: 700; }
    .trend ha-icon { --mdc-icon-size: 14px; }
    .trend.up { color: #ef6c00; } .trend.down { color: #1e88e5; }
    .t-sub { display: flex; gap: 8px; min-height: 16px; font-size: 11.5px; color: var(--secondary-text-color); }
    .t-sub b { color: var(--tc); }
    .mm { font-variant-numeric: tabular-nums; }
    .spark { display: block; width: calc(100% + 20px); height: 34px; margin: 4px -10px 0; }
    .spark .line { fill: none; stroke: var(--tc); stroke-width: 2; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
    .spark .area { fill: color-mix(in srgb, var(--tc) 14%, transparent); stroke: none; }
    .spark .limit { stroke: #e53935; stroke-width: 1; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; opacity: 0.7; }
    .chart-wrap { position: relative; padding-left: 26px; }
    .chart { width: 100%; height: 130px; overflow: visible; }
    .chart .grid { stroke: rgba(127,127,127,0.2); stroke-width: 1; vector-effect: non-scaling-stroke; }
    .chart .ln { fill: none; stroke-width: 2.2; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
    .chart text { font-size: 9.5px; fill: var(--secondary-text-color); }
    .axis { position: absolute; left: 0; font-size: 10.5px; color: var(--secondary-text-color); }
    .axis.hi { top: -6px; } .axis.lo { top: 108px; }
    .legend { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 4px; font-size: 11.5px; color: var(--secondary-text-color); }
    .legend span { display: inline-flex; align-items: center; gap: 5px; }
    .legend i { width: 10px; height: 3px; border-radius: 2px; }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-temperature-card": HaTemperatureCard;
  }
}
