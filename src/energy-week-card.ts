import { LitElement, css, html, nothing, svg, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { EnergyWeekCardConfig, EnergyWeekEntity, HomeAssistant } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { dailyTotals, kwhFactor, monthStart, percentChange, weekStart } from "./utils";
import "./energy-week-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-energy-week-card",
  name: "Modern Energy Week Card",
  description: "Wochenrückblick Energie: Verbrauch dieser Woche gegen die Vorwoche (Balken Mo–So), Kosten, Spitzentag und Anteil je Verbraucher – auch als Monat (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const PALETTE = ["#26a69a", "#42a5f5", "#ab47bc", "#ffa726", "#ec407a", "#7e57c2", "#66bb6a", "#8d6e63"];

interface Series { entity: string; name: string; color: string; now: number[]; before: number[] }

@customElement("ha-energy-week-card")
export class HaEnergyWeekCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: EnergyWeekCardConfig;
  @state() private _range: "week" | "month" = "week";
  @state() private _series?: Series[];
  @state() private _error?: string;
  @state() private _sel?: number;
  private _loadedFor?: string;
  private _prefs?: EnergyWeekEntity[];

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-energy-week-card-editor");
  }

  public static getStubConfig(): Partial<EnergyWeekCardConfig> {
    return {};
  }

  public setConfig(config: EnergyWeekCardConfig): void {
    this._config = { ...(config ?? { type: "custom:ha-energy-week-card" }) };
    this._loadedFor = undefined;
  }

  public getCardSize(): number {
    return 6;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  private _t(key: string): string {
    return localize(this.hass, `energy_week.${key}`);
  }

  /** Statistiken nur beim Start, bei Umschalten und alle 30 min laden – nicht bei jedem Zustandswechsel */
  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    return !old || old.locale !== this.hass!.locale || !this._series || this._loadedFor !== this._key();
  }

  private _key(): string {
    return `${this._range}|${Math.floor(Date.now() / 1_800_000)}`;
  }

  protected updated(): void {
    if (!this.hass) return;
    const key = this._key();
    if (this._loadedFor !== key) {
      this._loadedFor = key;
      this._load();
    }
  }

  private async _entities(): Promise<EnergyWeekEntity[]> {
    const c = this._config!;
    if (c.entities?.length) return c.entities.map((e) => (typeof e === "string" ? { entity: e } : e));
    if (this._prefs) return this._prefs;
    // Ohne Angabe: Netzbezug, Solar und Geräte aus den Energie-Einstellungen
    const prefs: any = await this.hass!.callWS({ type: "energy/get_prefs" }).catch(() => undefined);
    const out: EnergyWeekEntity[] = [];
    const seen = new Set<string>();
    const add = (id?: string, name?: string) => { if (id && !seen.has(id)) { seen.add(id); out.push({ entity: id, name }); } };
    for (const d of prefs?.device_consumption ?? []) add(d.stat_consumption, d.name?.trim() || undefined);
    if (!out.length) for (const s of prefs?.energy_sources ?? []) {
      if (s.type === "grid") for (const f of s.flow_from ?? [s]) add(f.stat_energy_from);
    }
    this._prefs = out;
    return out;
  }

  private _bounds(): { start: Date; prev: Date; days: number; prevDays: number } {
    const now = new Date();
    if (this._range === "month") {
      const start = monthStart(now), prev = monthStart(now, -1);
      return { start, prev, days: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), prevDays: Math.round((start.getTime() - prev.getTime()) / 86_400_000) };
    }
    return { start: weekStart(now), prev: weekStart(now, -1), days: 7, prevDays: 7 };
  }

  private async _load(): Promise<void> {
    try {
      const ents = await this._entities();
      if (!ents.length) { this._series = []; return; }
      const { start, prev, days, prevDays } = this._bounds();
      const end = new Date(start.getTime() + days * 86_400_000 + 3_600_000);
      const res: any = await this.hass!.callWS({
        type: "recorder/statistics_during_period", start_time: prev.toISOString(), end_time: end.toISOString(),
        statistic_ids: ents.map((e) => e.entity), period: "day", types: ["change"], units: { energy: "kWh" },
      });
      this._series = ents.map((e, i) => {
        const st = this.hass!.states[e.entity];
        const rows = res?.[e.entity] ?? [];
        // units: energy=kWh rechnet der Recorder um; ohne Geräteklasse „energy“ bleibt die Sensor-Einheit
        const f = st?.attributes.device_class === "energy" ? 1 : kwhFactor(st?.attributes.unit_of_measurement);
        return {
          entity: e.entity, name: e.name ?? String(st?.attributes.friendly_name ?? e.entity),
          color: e.color ?? PALETTE[i % PALETTE.length]!, now: dailyTotals(rows, start, days, f), before: dailyTotals(rows, prev, prevDays, f),
        };
      });
      this._error = undefined;
    } catch (err: any) {
      this._error = err?.message ?? String(err);
    }
  }

  private _fmt(kwh: number, d = 1): string {
    return kwh.toLocaleString(getLanguage(this.hass), { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  private _money(v: number): string {
    return v.toLocaleString(getLanguage(this.hass), { style: "currency", currency: this._config?.currency ?? "EUR", maximumFractionDigits: 2 });
  }

  private _chart(series: Series[], days: number, start: Date) {
    const sum = (arr: "now" | "before", i: number) => series.reduce((a, s) => a + (s[arr][i] ?? 0), 0);
    const now = Array.from({ length: days }, (_, i) => sum("now", i));
    const before = Array.from({ length: days }, (_, i) => sum("before", i));
    const max = Math.max(0.1, ...now, ...before);
    const W = 320, H = 120, pad = 18, bw = (W / days) * (this._range === "week" ? 0.3 : 0.36);
    const today = Math.floor((Date.now() - start.getTime()) / 86_400_000);
    const lang = getLanguage(this.hass);
    return html`<svg class="chart" viewBox="0 0 ${W} ${H + pad}" preserveAspectRatio="none" role="img" aria-label=${this._t("chart")}>
      ${now.map((v, i) => {
        const x = (i + 0.5) * (W / days);
        const hb = (before[i]! / max) * H, hn = (v / max) * H;
        const d = new Date(start.getTime() + i * 86_400_000);
        const label = this._range === "week" ? d.toLocaleDateString(lang, { weekday: "short" }).slice(0, 2) : (i % 5 === 0 ? String(d.getDate()) : "");
        return svg`<g class="col ${this._sel === i ? "sel" : ""} ${i > today ? "future" : ""} ${i === today ? "today" : ""}" data-day=${i} @click=${() => { this._sel = this._sel === i ? undefined : i; }}>
          <rect class="hit" x=${x - W / days / 2} y="0" width=${W / days} height=${H + pad}></rect>
          <rect class="prev" x=${x - bw - 0.5} y=${H - hb} width=${bw} height=${Math.max(hb, 0.5)} rx="2"></rect>
          <rect class="now" x=${x + 0.5} y=${H - hn} width=${bw} height=${Math.max(hn, i > today ? 0 : 0.5)} rx="2"></rect>
          ${label ? svg`<text x=${x} y=${H + 13}>${label}</text>` : nothing}
        </g>`;
      })}
    </svg>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const series = this._series;
    const price = c.price ?? 0.3;
    const { start, days } = this._bounds();
    const today = Math.min(days - 1, Math.floor((Date.now() - start.getTime()) / 86_400_000));
    const total = series?.reduce((a, s) => a + s.now.reduce((x, y) => x + y, 0), 0) ?? 0;
    // Vergleich fair: Vorperiode nur bis zum gleichen Tag
    const prevSame = series?.reduce((a, s) => a + s.before.slice(0, today + 1).reduce((x, y) => x + y, 0), 0) ?? 0;
    const prevAll = series?.reduce((a, s) => a + s.before.reduce((x, y) => x + y, 0), 0) ?? 0;
    const delta = percentChange(total, prevSame);
    const daily = Array.from({ length: days }, (_, i) => series?.reduce((a, s) => a + (s.now[i] ?? 0), 0) ?? 0);
    const peak = daily.slice(0, today + 1).reduce((best, v, i) => (v > daily[best]! ? i : best), 0);
    const avg = total / (today + 1);
    const lang = getLanguage(this.hass);
    const accent = delta == null ? "#26a69a" : delta > 5 ? "#ef6c00" : delta < -5 ? "#43a047" : "#26a69a";
    const sel = this._sel != null && this._sel < days ? this._sel : undefined;
    const selDate = sel != null ? new Date(start.getTime() + sel * 86_400_000) : undefined;
    const shares = (series ?? []).map((s) => ({ s, v: sel != null ? s.now[sel] ?? 0 : s.now.reduce((a, b) => a + b, 0) })).sort((a, b) => b.v - a.v);
    const shareTotal = shares.reduce((a, x) => a + x.v, 0);
    return html`<ha-card class="ew anim-${c.animations ?? "full"}" style="--hcc-accent-c:${accent}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <span class="h-icon"><ha-icon icon="mdi:chart-bar"></ha-icon></span>
        <span class="head-text"><span class="h-title">${c.name ?? this._t("title")}</span>
          <span class="h-sub">${this._t(this._range === "week" ? "this_week" : "this_month")}</span></span>
        <span class="seg">
          <button class=${this._range === "week" ? "on" : ""} data-range="week" @click=${() => { this._range = "week"; this._sel = undefined; this._series = undefined; }}>${this._t("week")}</button>
          <button class=${this._range === "month" ? "on" : ""} data-range="month" @click=${() => { this._range = "month"; this._sel = undefined; this._series = undefined; }}>${this._t("month")}</button>
        </span>
      </div>
      ${this._error ? html`<div class="empty">${this._error}</div>` : !series ? html`<div class="graph-placeholder"></div>`
        : !series.length ? html`<div class="empty">${this._t("no_entities")}</div>` : html`
        <div class="kpis">
          <div class="kpi main"><span class="k-v">${this._fmt(total)}<small> kWh</small></span>
            <span class="k-l">${delta != null ? html`<b class=${delta > 0 ? "up" : "down"}><ha-icon .icon=${delta > 0 ? "mdi:arrow-up" : "mdi:arrow-down"}></ha-icon>${Math.abs(delta)} %</b> ${this._t("vs_prev")}` : this._t("no_compare")}</span></div>
          <div class="kpi"><span class="k-v">${this._money(total * price)}</span><span class="k-l">${this._t("cost")}</span></div>
          <div class="kpi"><span class="k-v">${this._fmt(avg)}<small> kWh</small></span><span class="k-l">${this._t("per_day")}</span></div>
          <div class="kpi"><span class="k-v">${new Date(start.getTime() + peak * 86_400_000).toLocaleDateString(lang, this._range === "week" ? { weekday: "short" } : { day: "numeric", month: "short" })}</span>
            <span class="k-l">${this._t("peak")} · ${this._fmt(daily[peak] ?? 0)} kWh</span></div>
        </div>
        ${this._chart(series, days, start)}
        <div class="legend"><span><i class="now"></i>${this._t(this._range === "week" ? "this_week" : "this_month")}</span>
          <span><i class="prev"></i>${this._t(this._range === "week" ? "last_week" : "last_month")} · ${this._fmt(prevAll)} kWh</span></div>
        <div class="shares">
          <div class="s-head">${selDate ? selDate.toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" }) : this._t("by_consumer")}
            ${sel != null ? html`<b>${this._fmt(shareTotal, 2)} kWh</b>` : nothing}</div>
          ${shares.map(({ s, v }) => html`<div class="share" style="--sc:${s.color}" data-share=${s.entity}>
            <span class="s-name"><i></i>${s.name}</span>
            <span class="s-bar"><i style="width:${shareTotal ? (v / shareTotal) * 100 : 0}%"></i></span>
            <span class="s-v">${this._fmt(v, v < 10 ? 2 : 1)} kWh</span>
          </div>`)}
        </div>`}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.ew { gap: 12px; container-type: inline-size; }
    .header { display: flex; align-items: center; gap: 10px; }
    .h-icon { flex: none; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; color: var(--accent);
      background: color-mix(in srgb, var(--accent) 18%, transparent); }
    .h-icon ha-icon { --mdc-icon-size: 24px; }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .h-title { font-size: 17px; font-weight: 600; line-height: 1.2; }
    .h-sub { font-size: 12.5px; color: var(--secondary-text-color); }
    .seg { flex: none; display: inline-flex; padding: 3px; border-radius: 999px; background: rgba(127,127,127,0.12); }
    .seg button { border: none; background: none; padding: 5px 10px; border-radius: 999px; cursor: pointer; font-size: 12px; font-weight: 700; color: var(--secondary-text-color); }
    .seg button.on { background: var(--card-background-color, #fff); color: var(--primary-text-color); box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
    .kpis { display: grid; grid-template-columns: 1.4fr repeat(3, 1fr); gap: 8px; }
    @container (max-width: 420px) { .kpis { grid-template-columns: 1fr 1fr; } }
    .kpi { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border-radius: 12px; background: rgba(127,127,127,0.07); min-width: 0; }
    .kpi.main { background: color-mix(in srgb, var(--accent) 12%, transparent); }
    .k-v { font-size: 17px; font-weight: 700; white-space: nowrap; }
    .kpi.main .k-v { font-size: 22px; }
    .k-v small { font-size: 12px; font-weight: 600; color: var(--secondary-text-color); }
    .k-l { font-size: 11.5px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .k-l b { display: inline-flex; align-items: center; font-weight: 800; }
    .k-l b ha-icon { --mdc-icon-size: 14px; }
    .k-l b.up { color: #ef6c00; } .k-l b.down { color: #43a047; }
    .chart { width: 100%; height: 140px; overflow: visible; }
    .chart .hit { fill: transparent; cursor: pointer; }
    .chart .prev { fill: rgba(127,127,127,0.35); }
    .chart .now { fill: var(--accent); transition: opacity 0.2s; }
    .chart .col.future .now { opacity: 0.25; }
    .chart .col.sel .hit { fill: rgba(127,127,127,0.1); }
    .chart text { font-size: 10px; fill: var(--secondary-text-color); text-anchor: middle; }
    .chart .col.today text { font-weight: 800; fill: var(--primary-text-color); }
    .legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 11.5px; color: var(--secondary-text-color); margin-top: -6px; }
    .legend span { display: inline-flex; align-items: center; gap: 5px; }
    .legend i { width: 10px; height: 10px; border-radius: 3px; }
    .legend i.now { background: var(--accent); } .legend i.prev { background: rgba(127,127,127,0.35); }
    .shares { display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: 12px; background: rgba(127,127,127,0.06); }
    .s-head { display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 700; color: var(--secondary-text-color); }
    .s-head b { color: var(--primary-text-color); }
    .share { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(50px, 1fr) auto; align-items: center; gap: 8px; font-size: 12.5px; }
    .s-name { display: flex; align-items: center; gap: 6px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .s-name i { flex: none; width: 9px; height: 9px; border-radius: 50%; background: var(--sc); }
    .s-bar { height: 6px; border-radius: 3px; background: rgba(127,127,127,0.15); overflow: hidden; }
    .s-bar i { display: block; height: 100%; border-radius: 3px; background: var(--sc); transition: width 0.5s var(--ease-out); }
    .s-v { font-weight: 700; white-space: nowrap; }
    .empty { padding: 14px; text-align: center; font-size: 13px; color: var(--secondary-text-color); }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-energy-week-card": HaEnergyWeekCard;
  }
}
