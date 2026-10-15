import { LitElement, css, html, nothing, svg, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant, SolarForecastCardConfig } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import {
  daylightRange, forecastAccuracy, forecastAt, forecastDay, forecastEnergy, forecastPeak, forecastStep, solarForecastEntities, UNAVAILABLE, ymdLocal,
  type ForecastDay, type ForecastPoint,
} from "./utils";
import "./solar-forecast-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-solar-forecast-card",
  name: "Modern Solar Forecast Card",
  description: "Solarprognose (Solcast): Ertrag heute/morgen mit Spanne, Fortschritt Ist gegen Prognose, Tageskurve mit P10/P90-Band und Ist-Leistung, Tagesleiste, Trefferquote gestern (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const HISTORY_REFRESH_MS = 5 * 60_000;
const SUN = "#f9a825";
const ACTUAL = "#42a5f5";
const H = 3_600_000;

interface Pt { t: number; v: number }

@customElement("ha-solar-forecast-card")
export class HaSolarForecastCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: SolarForecastCardConfig;
  @state() private _sel = 0;
  @state() private _actual: Pt[] = [];
  @state() private _yesterday: { forecast?: number; actual?: number } = {};
  @state() private _hover?: number;
  private _cache?: { key: unknown; anchor: string; f: ReturnType<typeof solarForecastEntities> };
  private _historyKey = "";
  private _historyAt = 0;
  private _yesterdayKey = "";
  private _timer?: number;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-solar-forecast-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<SolarForecastCardConfig> {
    const ids = Object.keys(hass.states);
    const fc = ids.filter((id) => id.startsWith("sensor.") && Array.isArray(hass.states[id]!.attributes.detailedForecast));
    const today = fc.find((id) => /today|heute/.test(id)) ?? fc[0] ?? "";
    const power = (id: string) => id.startsWith("sensor.") && /^k?W$/.test(String(hass.states[id]!.attributes.unit_of_measurement ?? ""));
    const solar = ids.find((id) => power(id) && /solarleistung|solar_power|pv_power/.test(id) && !/pv_?\d|_sb_|solcast/.test(id));
    const solarToday = ids.find((id) => id.startsWith("sensor.") && /solarerzeugung_tag|solar.*(today|heute|tag)$|teges_ertrag/.test(id) && !/solcast|kosten/.test(id));
    return { entity: today, ...(solar ? { solar } : {}), ...(solarToday ? { solar_today: solarToday } : {}) };
  }

  public setConfig(config: SolarForecastCardConfig): void {
    if (!config?.entity) throw new Error("ha-solar-forecast-card: 'entity' (Solcast-Prognose heute) angeben");
    this._config = { ...config };
    this._cache = undefined;
    this._historyKey = "";
    this._yesterdayKey = "";
  }

  public getCardSize(): number {
    return 8;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._timer = window.setInterval(() => this._loadHistory(true), HISTORY_REFRESH_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._timer);
    this._historyKey = "";
  }

  private _t(key: string, vars: Record<string, string> = {}): string {
    let s = localize(this.hass, `solar_forecast.${key}`);
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
    return s;
  }

  // ---------- Entitäten ----------

  private _f() {
    const hass = this.hass!;
    const c = this._config!;
    if (!this._cache || this._cache.key !== hass.entities || this._cache.anchor !== c.entity) {
      this._cache = { key: hass.entities, anchor: c.entity, f: solarForecastEntities(hass.states, hass.entities, c.entity) };
    }
    const f = { ...this._cache.f };
    for (const k of ["power_now", "remaining", "api_used", "api_limit", "last_update"] as const) if (typeof c[k] === "string") f[k] = c[k] as string;
    if (!f.days.includes(c.entity)) f.days = [c.entity, ...f.days];
    return f;
  }

  private _ids(): string[] {
    const f = this._f();
    const c = this._config!;
    return [...f.days, f.power_now, f.remaining, f.api_used, f.api_limit, f.last_update, c.solar, c.solar_today].filter(Boolean) as string[];
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this._config) return true;
    return this._ids().some((id) => old.states[id] !== this.hass!.states[id]) || old.locale !== this.hass!.locale || old.entities !== this.hass!.entities;
  }

  protected updated(): void {
    this._loadHistory();
  }

  private _st(id?: string): HassEntity | undefined {
    const st = id ? this.hass!.states[id] : undefined;
    return st && !UNAVAILABLE.includes(st.state) ? st : undefined;
  }

  private _num(id?: string): number | undefined {
    const st = this._st(id);
    if (!st) return undefined;
    const v = Number(st.state);
    return Number.isFinite(v) ? v : undefined;
  }

  private _kw(id?: string): number | undefined {
    const v = this._num(id);
    if (v == null) return undefined;
    return String(this._st(id)!.attributes.unit_of_measurement ?? "W") === "kW" ? v : v / 1000;
  }

  private _kwh(id?: string): number | undefined {
    const v = this._num(id);
    if (v == null) return undefined;
    return /^Wh$/i.test(String(this._st(id)!.attributes.unit_of_measurement ?? "kWh")) ? v / 1000 : v;
  }

  private _fmt(v: number, digits = 0): string {
    return v.toLocaleString(getLanguage(this.hass), { maximumFractionDigits: digits, minimumFractionDigits: digits });
  }

  private _energy(kwh: number): string {
    return `${this._fmt(kwh, kwh >= 100 ? 0 : 1)} kWh`;
  }

  private _power(kw: number): string {
    return kw >= 1 ? `${this._fmt(kw, 2)} kW` : `${this._fmt(kw * 1000)} W`;
  }

  private _time(t: number): string {
    return new Date(t).toLocaleTimeString(getLanguage(this.hass), { hour: "2-digit", minute: "2-digit" });
  }

  private _moreInfo(id?: string): void {
    if (!id) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  // ---------- Verlauf ----------

  private async _loadHistory(force = false): Promise<void> {
    const c = this._config;
    if (!c || !this.hass?.callWS) return;
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const today = ymdLocal(midnight);
    if (c.solar && c.show?.chart !== false) {
      const key = `${c.solar}|${today}`;
      if (force || key !== this._historyKey || Date.now() - this._historyAt >= HISTORY_REFRESH_MS) {
        this._historyKey = key;
        this._historyAt = Date.now();
        try {
          const res = await this.hass.callWS<Record<string, { s?: string; lu?: number; lc?: number }[]>>({
            type: "history/history_during_period", start_time: midnight.toISOString(), end_time: new Date().toISOString(),
            entity_ids: [c.solar], minimal_response: true, no_attributes: true, significant_changes_only: false,
          });
          const kw = String(this.hass.states[c.solar]?.attributes.unit_of_measurement ?? "W") === "kW" ? 1 : 1 / 1000;
          this._actual = (res?.[c.solar] ?? []).map((p) => ({ t: Math.max((p.lu ?? p.lc ?? 0) * 1000, midnight.getTime()), v: Number(p.s) * kw }))
            .filter((p) => Number.isFinite(p.v));
        } catch {
          /* Verlauf nicht verfügbar */
        }
      }
    }
    if (c.show?.stats !== false && this._yesterdayKey !== `${c.entity}|${c.solar_today ?? ""}|${today}`) {
      this._yesterdayKey = `${c.entity}|${c.solar_today ?? ""}|${today}`;
      const start = new Date(midnight.getTime() - 24 * H);
      const ids = [c.entity, c.solar_today].filter(Boolean) as string[];
      try {
        const res = await this.hass.callWS<Record<string, { s?: string }[]>>({
          type: "history/history_during_period", start_time: start.toISOString(), end_time: midnight.toISOString(),
          entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false,
        });
        const vals = (id?: string) => (id ? (res?.[id] ?? []).map((p) => Number(p.s)).filter(Number.isFinite) : []);
        const fc = vals(c.entity);
        const act = vals(c.solar_today);
        this._yesterday = { forecast: fc.length ? fc[fc.length - 1] : undefined, actual: act.length ? Math.max(...act) : undefined };
      } catch {
        this._yesterday = {};
      }
    }
  }

  // ---------- Darstellung ----------

  private _dayLabel(d: ForecastDay): string {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    if (d.date === ymdLocal(now)) return this._t("today");
    if (d.date === ymdLocal(tomorrow)) return this._t("tomorrow");
    return new Date(d.t0).toLocaleDateString(getLanguage(this.hass), { weekday: "short" });
  }

  private _ring(p: number) {
    const r = 52, c = 2 * Math.PI * r;
    const v = Math.min(1, Math.max(0, p));
    return svg`<svg class="ring-svg" viewBox="0 0 120 120" aria-hidden="true">
      <circle class="r-track" cx="60" cy="60" r=${r}></circle>
      <circle class="r-fill" cx="60" cy="60" r=${r} stroke-dasharray=${`${(c * v).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 60 60)"></circle>
    </svg>`;
  }

  private _renderDays(days: ForecastDay[]) {
    if (days.length < 2) return nothing;
    const max = Math.max(...days.map((d) => d.total), 0.1);
    return html`<div class="days" style="--n:${days.length}">${days.map((d, i) => html`<button class="day ${i === this._sel ? "sel" : ""}" data-day=${i}
      @click=${() => { this._sel = i; this._hover = undefined; }}>
      <span class="d-name">${this._dayLabel(d)}</span>
      <span class="d-bar"><span style="height:${Math.max(4, (d.total / max) * 100)}%"></span></span>
      <b>${this._fmt(d.total, d.total >= 100 ? 0 : 1)}</b><small>kWh</small>
    </button>`)}</div>`;
  }

  private _renderChart(day: ForecastDay, isToday: boolean) {
    const now = Date.now();
    const step = forecastStep(day.points);
    const range = daylightRange(day.points) ?? [day.t0 + 6 * H, day.t0 + 20 * H];
    const [r0, r1] = range;
    const W = 300, HH = 120, TOP = 14, BASE = HH - 2;
    const actual = isToday ? this._actual.filter((p) => p.t <= now) : [];
    const ymax = Math.max(0.1, ...day.points.map((p) => Math.max(p.kw, p.p90 ?? 0)), ...actual.map((p) => p.v)) * 1.08;
    const x = (t: number) => ((Math.min(r1, Math.max(r0, t)) - r0) / (r1 - r0)) * W;
    const y = (kw: number) => BASE - (Math.max(0, kw) / ymax) * (BASE - TOP);
    const mid = (p: ForecastPoint) => p.t + step / 2;
    const vis = day.points.filter((p) => mid(p) >= r0 - step && mid(p) <= r1 + step);
    // Geglättete Prognosekurve (Catmull-Rom → Bézier), Kontrollpunkte nie unter die Grundlinie
    const pts: [number, number][] = [[x(r0), BASE], ...vis.map((p) => [x(mid(p)), y(p.kw)] as [number, number]), [x(r1), BASE]];
    let line = `M${pts[0]![0].toFixed(1)},${pts[0]![1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[Math.min(pts.length - 1, i + 2)]!;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, Math.min(BASE, p1[1] + (p2[1] - p0[1]) / 6)];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, Math.min(BASE, p2[1] - (p3[1] - p1[1]) / 6)];
      line += `C${c1[0]!.toFixed(1)},${c1[1]!.toFixed(1)} ${c2[0]!.toFixed(1)},${c2[1]!.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    const band = vis.filter((p) => (p.p90 ?? 0) > 0.001 && p.p10 != null);
    const bandPath = band.length > 1
      ? `M${band.map((p) => `${x(mid(p)).toFixed(1)},${y(p.p90!).toFixed(1)}`).join("L")}L${[...band].reverse().map((p) => `${x(mid(p)).toFixed(1)},${y(p.p10!).toFixed(1)}`).join("L")}Z`
      : "";
    let actualPath = "";
    if (actual.length) {
      // Ab Kurvenbeginn: letzter Wert davor als Startwert, damit links keine Zacken entstehen
      const before = actual.filter((p) => p.t < r0);
      const a = [...(before.length ? [{ t: r0, v: before[before.length - 1]!.v }] : []), ...actual.filter((p) => p.t >= r0 && p.t <= r1)];
      if (a.length) {
        actualPath = `M${x(a[0]!.t).toFixed(1)},${y(a[0]!.v).toFixed(1)}`;
        for (let i = 1; i < a.length; i++) actualPath += `H${x(a[i]!.t).toFixed(1)}V${y(a[i]!.v).toFixed(1)}`;
        actualPath += `H${x(Math.min(now, r1)).toFixed(1)}`;
      }
    }
    const peak = forecastPeak(day.points);
    const showNow = isToday && now >= r0 && now <= r1;
    const hoverP = this._hover != null ? forecastAt(day.points, this._hover) : undefined;
    const hoverActual = this._hover != null && isToday ? [...actual].reverse().find((p) => p.t <= this._hover!) : undefined;
    const span = (r1 - r0) / H;
    const every = span > 10 ? 3 : 2;
    const ticks: number[] = [];
    for (let t = Math.ceil(r0 / (every * H)) * every * H; t <= r1; t += every * H) ticks.push(t);
    const move = (ev: PointerEvent) => {
      const box = (ev.currentTarget as SVGElement).getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (ev.clientX - box.left) / box.width));
      this._hover = r0 + f * (r1 - r0);
    };
    return html`<div class="chart">
      <div class="sec-title"><ha-icon icon="mdi:chart-bell-curve"></ha-icon><span>${this._t("chart")} · ${this._dayLabel(day)}</span>
        <span class="legend"><i class="l-fc"></i>${this._t("forecast")}${band.length > 1 ? html`<i class="l-band"></i>${this._t("range")}` : nothing}${actualPath ? html`<i class="l-act"></i>${this._t("actual")}` : nothing}</span></div>
      <div class="c-wrap">
        <span class="ymax">${this._power(ymax / 1.08)}</span>
        <svg class="c-svg" viewBox="0 0 ${W} ${HH}" preserveAspectRatio="none" role="img" aria-label=${`${this._t("chart")} ${this._dayLabel(day)}`}
          @pointermove=${move} @pointerdown=${move} @pointerleave=${() => { this._hover = undefined; }}>
          <defs><linearGradient id="sf-fc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color=${SUN} stop-opacity="0.42"></stop>
            <stop offset="1" stop-color=${SUN} stop-opacity="0.03"></stop></linearGradient></defs>
          ${[0.25, 0.5, 0.75].map((f) => svg`<line class="c-grid" x1="0" x2=${W} y1=${y(ymax * f)} y2=${y(ymax * f)}></line>`)}
          ${bandPath ? svg`<path class="c-band" d=${bandPath}></path>` : nothing}
          <path class="c-area" d=${`${line}Z`}></path>
          <path class="c-fc" d=${line}></path>
          ${actualPath ? svg`<path class="c-act" d=${actualPath}></path>` : nothing}
          ${showNow ? svg`<line class="c-now" x1=${x(now)} x2=${x(now)} y1=${TOP - 6} y2=${BASE}></line>` : nothing}
          ${this._hover != null ? svg`<line class="c-hover" x1=${x(this._hover)} x2=${x(this._hover)} y1=${TOP - 6} y2=${BASE}></line>` : nothing}
        </svg>
        ${peak && peak.kw > 0.01 ? html`<span class="peak" style="left:${(x(mid(peak)) / W) * 100}%; top:${16 + (y(peak.kw) / HH) * 130 - 4}px"></span>
          <span class="peak-l" style="left:${Math.min(84, Math.max(16, (x(mid(peak)) / W) * 100))}%">${this._power(peak.kw)} · ${this._time(mid(peak))}</span>` : nothing}
        ${showNow ? html`<span class="now-l" style="left:${Math.min(92, Math.max(8, (x(now) / W) * 100))}%">${this._t("now")}</span>` : nothing}
      </div>
      <div class="c-axis">${ticks.map((t) => html`<span style="left:${(x(t) / W) * 100}%">${new Date(t).getHours()}</span>`)}</div>
      <div class="readout ${this._hover != null ? "on" : ""}">${this._hover != null ? html`<b>${this._time(this._hover)}</b>
        <span><i class="l-fc"></i>${hoverP ? this._power(hoverP.kw) : "–"}${hoverP && (hoverP.p90 ?? 0) > 0.001 ? html`<small>(${this._power(hoverP.p10 ?? 0)}–${this._power(hoverP.p90!)})</small>` : nothing}</span>
        ${isToday && actual.length && this._hover <= now ? html`<span><i class="l-act"></i>${hoverActual ? this._power(hoverActual.v) : "–"}</span>` : nothing}`
        : html`<span class="hint">${this._t("touch_hint")}</span>`}</div>
    </div>`;
  }

  private _renderStats(f: ReturnType<HaSolarForecastCard["_f"]>) {
    const y = this._yesterday;
    const acc = forecastAccuracy(y.actual, y.forecast, 0.1);
    const upd = this._st(f.last_update);
    const updT = upd ? Date.parse(upd.state) : NaN;
    const used = this._num(f.api_used), limit = this._num(f.api_limit);
    const items = [
      acc != null ? html`<button class="chip ${acc >= 85 && acc <= 115 ? "good" : "off"}" data-chip="yesterday" @click=${() => this._moreInfo(this._config!.solar_today)}>
        <ha-icon icon="mdi:calendar-check-outline"></ha-icon><span>${this._t("yesterday")}</span><b>${this._fmt(acc)} %</b>
        <small>${this._t("yesterday_detail", { a: this._fmt(y.actual!, 1), f: this._fmt(y.forecast!, 1) })}</small></button>` : nothing,
      Number.isFinite(updT) ? html`<button class="chip" data-chip="updated" @click=${() => this._moreInfo(f.last_update)}>
        <ha-icon icon="mdi:update"></ha-icon><span>${this._t("updated")}</span><b>${this._time(updT)}</b></button>` : nothing,
      used != null ? html`<button class="chip ${limit != null && used >= limit ? "off" : ""}" data-chip="api" @click=${() => this._moreInfo(f.api_used)}>
        <ha-icon icon="mdi:api"></ha-icon><span>API</span><b>${this._fmt(used)}${limit != null ? ` / ${this._fmt(limit)}` : ""}</b></button>` : nothing,
    ].filter((x) => x !== nothing);
    return items.length ? html`<div class="chips">${items}</div>` : nothing;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    if (!this.hass.states[c.entity]) return html`<ha-card class="sfc"><div class="missing">${this._t("missing")}: ${c.entity}</div></ha-card>`;
    const f = this._f();
    const show = { chart: true, days: true, stats: true, ...c.show };
    const now = Date.now();
    const todayStr = ymdLocal(new Date());
    const days = f.days.map((id) => forecastDay(this.hass!.states[id])).filter((d): d is ForecastDay => !!d && d.date >= todayStr)
      .slice(0, Math.max(1, c.days ?? 7));
    if (!days.length) return html`<ha-card class="sfc"><div class="missing">${this._t("no_data")}: ${c.entity}</div></ha-card>`;
    const today = days[0]!.date === todayStr ? days[0] : undefined;
    const tomorrow = days.find((d) => d.date !== todayStr);
    if (this._sel >= days.length) this._sel = 0;
    const sel = days[this._sel]!;

    const fcSoFar = today ? forecastEnergy(today.points, now) : undefined;
    const remaining = this._kwh(f.remaining) ?? (today && fcSoFar != null ? Math.max(0, today.total - fcSoFar) : undefined);
    const actualToday = this._kwh(c.solar_today);
    const actualNow = this._kw(c.solar);
    const fcNow = this._kw(f.power_now) ?? (today ? forecastAt(today.points, now)?.kw : undefined);
    const accNow = forecastAccuracy(actualToday, fcSoFar);
    const range = today ? daylightRange(today.points) : undefined;
    const peak = today ? forecastPeak(today.points) : undefined;
    const step = today ? forecastStep(today.points) : 0;

    // Kopfzeile: was als Nächstes wichtig ist
    let sub: string;
    if (today && range && now < range[0]) sub = this._t("expected_today", { x: this._energy(today.total) });
    else if (today && remaining != null && remaining > 0.01 && (!range || now < range[1])) {
      sub = this._t("remaining_today", { x: this._energy(remaining) });
      if (peak && peak.t + step / 2 > now) sub += ` · ${this._t("peak_at", { t: this._time(peak.t + step / 2) })}`;
    } else if (tomorrow) sub = this._t("expected_tomorrow", { x: this._energy(tomorrow.total) });
    else sub = this._t("expected_today", { x: this._energy(days[0]!.total) });
    const daytime = !!(today && range && now >= range[0] && now < range[1]);

    const ringBase = today?.total ?? 0;
    const ringVal = actualToday ?? fcSoFar ?? 0;
    const accColor = accNow == null ? "var(--secondary-text-color)" : accNow >= 85 ? "var(--success-color, #43a047)" : accNow >= 60 ? SUN : "#fb8c00";
    const title = c.name ?? this._t("title");

    return html`<ha-card class="sfc anim-${c.animations ?? "full"} ${daytime ? "sunup" : "idle"}" style="--hcc-accent-c:${SUN}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <span class="h-icon ${daytime ? "sun" : ""}"><ha-icon .icon=${daytime ? "mdi:white-balance-sunny" : "mdi:weather-sunset"}></ha-icon></span>
        <button class="head-text" @click=${() => this._moreInfo(c.entity)}>
          <span class="h-title">${title}</span>
          <span class="h-sub">${sub}</span>
        </button>
      </div>
      ${today ? html`<div class="main">
        <button class="ring" data-ring @click=${() => this._moreInfo(c.solar_today ?? c.entity)}
          aria-label=${`${this._fmt(ringVal, 1)} / ${this._energy(ringBase)}`}>
          ${this._ring(ringBase > 0 ? ringVal / ringBase : 0)}
          <span class="r-in"><b>${this._fmt(ringVal, 1)}<small>kWh</small></b>
            <span>${actualToday != null ? this._t("of", { x: this._energy(ringBase) }) : this._t("expected_so_far")}</span>
            <span class="cap">${actualToday != null ? this._t("day_forecast") : this._t("of", { x: this._energy(ringBase) })}</span></span>
        </button>
        <div class="facts">
          <button class="fact" data-fact="now" @click=${() => this._moreInfo(c.solar ?? f.power_now)}>
            <ha-icon icon="mdi:solar-power-variant" style="color:${actualNow != null ? ACTUAL : SUN}"></ha-icon>
            <span><b>${actualNow != null ? this._power(actualNow) : fcNow != null ? this._power(fcNow) : "–"}</b>
              <small>${actualNow != null ? `${this._t("now")}${fcNow != null ? ` · ${this._t("forecast")} ${this._power(fcNow)}` : ""}` : this._t("forecast_now")}</small></span>
          </button>
          ${accNow != null ? html`<button class="fact" data-fact="accuracy" @click=${() => this._moreInfo(c.solar_today)}>
            <ha-icon .icon=${accNow >= 100 ? "mdi:trending-up" : "mdi:trending-down"} style="color:${accColor}"></ha-icon>
            <span><b style="color:${accColor}">${this._fmt(accNow)} %</b><small>${this._t("so_far", { a: this._fmt(actualToday!, 1), f: this._fmt(fcSoFar!, 1) })}</small></span>
          </button>` : nothing}
          ${tomorrow ? html`<button class="fact" data-fact="tomorrow" @click=${() => this._moreInfo(tomorrow.id)}>
            <ha-icon icon="mdi:weather-partly-cloudy" style="color:${SUN}"></ha-icon>
            <span><b>${this._energy(tomorrow.total)}</b><small>${this._dayLabel(tomorrow)}${tomorrow.p10 != null && tomorrow.p90 != null
              ? ` · ${this._fmt(tomorrow.p10, 1)}–${this._fmt(tomorrow.p90, 1)} kWh` : ""}</small></span>
          </button>` : nothing}
        </div>
      </div>` : nothing}
      ${show.days ? this._renderDays(days) : nothing}
      ${show.chart ? this._renderChart(sel, sel === today) : nothing}
      ${show.stats ? this._renderStats(f) : nothing}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.sfc { --accent: var(--hcc-accent-c); gap: 12px; container-type: inline-size; }
    ha-card.sfc.idle .blob { opacity: 0.45; animation-play-state: paused; }
    .missing { padding: 8px; color: var(--error-color, #e53935); }
    .header { display: flex; align-items: center; gap: 10px; }
    .h-icon { flex: none; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; color: var(--accent);
      background: color-mix(in srgb, var(--accent) 16%, transparent); }
    .h-icon ha-icon { --mdc-icon-size: 24px; }
    .h-icon.sun ha-icon { animation: spin 40s linear infinite; }
    ha-card.anim-reduced .h-icon ha-icon, ha-card.anim-off .h-icon ha-icon { animation: none; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; border: none; background: none; padding: 0; text-align: left; cursor: pointer; }
    .h-title { font-size: 17px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .h-sub { font-size: 13px; font-weight: 600; color: var(--accent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* Ring + Fakten */
    .main { display: flex; align-items: center; gap: 16px; }
    .ring { position: relative; flex: none; width: clamp(110px, 34cqi, 150px); aspect-ratio: 1; border: none; padding: 0; background: none; cursor: pointer; }
    .ring-svg { width: 100%; height: 100%; display: block; }
    .r-track { fill: none; stroke: rgba(127,127,127,0.16); stroke-width: 10; }
    .r-fill { fill: none; stroke: var(--accent); stroke-width: 10; stroke-linecap: round; transition: stroke-dasharray 0.8s var(--ease-out); }
    .r-in { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
    .r-in b { font-size: clamp(24px, 8cqi, 32px); font-weight: 700; line-height: 1; letter-spacing: -0.02em; }
    .r-in b small { font-size: 0.45em; font-weight: 600; margin-left: 2px; color: var(--secondary-text-color); }
    .r-in span { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; }
    .r-in span.cap { font-size: 10px; opacity: 0.75; margin-top: -2px; }
    .facts { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
    .fact { display: flex; align-items: center; gap: 10px; min-width: 0; border: none; background: none; padding: 0; cursor: pointer; text-align: left; }
    .fact > ha-icon { --mdc-icon-size: 26px; flex: none; }
    .fact span { display: flex; flex-direction: column; min-width: 0; }
    .fact b { font-size: clamp(15px, 4.6cqi, 19px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .fact small { font-size: 12px; line-height: 1.3; color: var(--secondary-text-color); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

    /* Tagesleiste */
    .days { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 6px; }
    .day { display: flex; flex-direction: column; align-items: center; gap: 3px; min-width: 0; padding: 8px 2px 7px; border: none; cursor: pointer;
      border-radius: var(--hcc-inner-radius, 14px); background: rgba(127,127,127,0.07); transition: background 0.3s, box-shadow 0.3s; }
    .day.sel { background: color-mix(in srgb, var(--accent) 16%, transparent); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 55%, transparent); }
    .d-name { font-size: 11.5px; font-weight: 600; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .day.sel .d-name { color: var(--primary-text-color); }
    .d-bar { width: 8px; height: 34px; border-radius: 4px; background: rgba(127,127,127,0.14); display: flex; align-items: flex-end; overflow: hidden; }
    .d-bar span { display: block; width: 100%; border-radius: inherit; background: linear-gradient(0deg, #f57f17, #fbc02d); transition: height 0.8s var(--ease-out); }
    .day b { font-size: 14px; line-height: 1.1; white-space: nowrap; }
    .day small { font-size: 10px; color: var(--secondary-text-color); margin-top: -2px; }
    @container (max-width: 360px) { .day small { display: none; } .day b { font-size: 12.5px; } }

    /* Tageskurve */
    .sec-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--secondary-text-color); flex-wrap: wrap; }
    .sec-title ha-icon { --mdc-icon-size: 16px; }
    .chart { display: flex; flex-direction: column; gap: 4px; }
    .legend { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; text-transform: none; letter-spacing: 0; font-weight: 500; white-space: nowrap; }
    .legend i, .readout i { width: 10px; height: 3px; border-radius: 2px; display: inline-block; }
    .legend i:not(:first-child) { margin-left: 6px; }
    .l-fc { background: #f9a825; }
    .l-band { background: color-mix(in srgb, #f9a825 35%, transparent); height: 8px !important; }
    .l-act { background: #42a5f5; }
    .c-wrap { position: relative; padding-top: 16px; }
    .c-svg { width: 100%; height: 130px; display: block; touch-action: pan-y; cursor: crosshair; }
    .c-grid { stroke: rgba(127,127,127,0.15); stroke-width: 1; vector-effect: non-scaling-stroke; stroke-dasharray: 3 4; }
    .c-band { fill: color-mix(in srgb, #f9a825 22%, transparent); }
    .c-area { fill: url(#sf-fc); }
    .c-fc { fill: none; stroke: #f9a825; stroke-width: 2.2; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
    .c-act { fill: none; stroke: #42a5f5; stroke-width: 1.8; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
    .c-now { stroke: var(--primary-text-color); stroke-opacity: 0.45; stroke-width: 1; vector-effect: non-scaling-stroke; stroke-dasharray: 2 3; }
    .c-hover { stroke: var(--primary-text-color); stroke-opacity: 0.7; stroke-width: 1; vector-effect: non-scaling-stroke; }
    .ymax { position: absolute; left: 0; top: 0; font-size: 10.5px; color: var(--secondary-text-color); }
    .peak { position: absolute; width: 8px; height: 8px; margin-left: -4px; border-radius: 50%; background: #f9a825;
      box-shadow: 0 0 0 3px color-mix(in srgb, #f9a825 30%, transparent); pointer-events: none; }
    .peak-l { position: absolute; top: 0; transform: translateX(-50%); font-size: 10.5px; font-weight: 700; color: #f57f17; white-space: nowrap; pointer-events: none; }
    .now-l { position: absolute; bottom: -2px; transform: translateX(-50%); font-size: 10px; color: var(--secondary-text-color); background: var(--ha-card-background, var(--card-background-color, #fff));
      padding: 0 3px; border-radius: 4px; pointer-events: none; }
    .c-axis { position: relative; height: 14px; font-size: 10.5px; color: var(--secondary-text-color); }
    .c-axis span { position: absolute; transform: translateX(-50%); }
    .readout { display: flex; align-items: center; gap: 12px; min-height: 18px; font-size: 12.5px; }
    .readout span { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
    .readout small { color: var(--secondary-text-color); margin-left: 3px; }
    .readout .hint { font-size: 11px; color: var(--secondary-text-color); opacity: 0.8; }

    /* Chips */
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { --cc: var(--secondary-text-color); display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px 6px 8px; border: none; border-radius: 999px; cursor: pointer;
      font-size: 12.5px; background: rgba(127,127,127,0.09); white-space: nowrap; }
    .chip ha-icon { --mdc-icon-size: 16px; color: var(--cc); }
    .chip span { color: var(--secondary-text-color); }
    .chip b { color: var(--cc); }
    .chip small { color: var(--secondary-text-color); }
    .chip.good { --cc: var(--success-color, #43a047); }
    .chip.off { --cc: #fb8c00; }
    @container (max-width: 380px) { .chip small { display: none; } }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-solar-forecast-card": HaSolarForecastCard;
  }
}
