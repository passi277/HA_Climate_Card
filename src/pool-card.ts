import { LitElement, css, html, nothing, svg, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant, PoolCardConfig } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { formatPower, formatRemaining, phDose, poolRuntimeRecommendation, powerWatts, rangeStatus, timerInfo, UNAVAILABLE } from "./utils";
import "./pool-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-pool-card",
  name: "Modern Pool Card",
  description: "Pool mit Filterpumpe, Wasserwerten (Temperatur, pH, Redox) samt Verlauf, Filterlaufzeit, Betriebsmodus, Pflege-Empfehlung und Wartung (Rückspülen) – mit animiertem Becken (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const HOLD_MS = 500;
const PH: [number, number, number, number] = [6.8, 7.0, 7.2, 7.4];
const ORP: [number, number, number, number] = [550, 650, 750, 800];
const TEMP: [number, number] = [20, 28];
const STATUS_COLOR = { optimal: "var(--success-color, #43a047)", ok: "#fb8c00", bad: "var(--error-color, #e53935)" };
const OK_GUIDANCE = ["ok", "", "unknown", "unavailable", "None", "Unbekannt"];

type Metric = "temperature" | "ph" | "orp";

@customElement("ha-pool-card")
export class HaPoolCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: PoolCardConfig;
  @state() private _now = Date.now();
  @state() private _open?: Metric;
  @state() private _hist: Partial<Record<Metric, { t: number; v: number }[]>> = {};
  @state() private _editTarget = false;
  @state() private _careOpen = false;
  @state() private _confirm?: string;
  @state() private _pending?: number;
  private _tick?: number;
  private _holdTimer?: number;
  private _held = false;
  private _confirmTimer?: number;
  private _sendTimer?: number;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-pool-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<PoolCardConfig> {
    const ids = Object.keys(hass.states);
    const find = (re: RegExp, domain = "sensor") => ids.find((id) => id.startsWith(`${domain}.`) && re.test(id));
    return { pump: find(/pool/, "switch"), temperature: find(/pool.*temp/), ph: find(/pool.*ph/), orp: find(/pool.*(orp|redox)/) };
  }

  public setConfig(config: PoolCardConfig): void {
    if (!config || (!config.pump && !config.temperature && !config.ph && !config.orp)) throw new Error("ha-pool-card: 'pump' oder Wasserwerte (temperature/ph/orp) angeben");
    this._config = { ...config };
  }

  public getCardSize(): number {
    return 8;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._tick);
    this._tick = undefined;
    clearTimeout(this._holdTimer);
    clearTimeout(this._confirmTimer);
    clearTimeout(this._sendTimer);
  }

  private _t(key: string): string {
    return localize(this.hass, `pool.${key}`);
  }

  private _ids(): string[] {
    const c = this._config!;
    return [c.pump, c.pump_power, c.mode, c.start_time, c.target_runtime, c.recommended_runtime, c.runtime_today, c.temperature, c.ph, c.orp, c.guidance,
      c.last_measurement, c.measurement_stale, c.quality, c.energy_today, c.cost_today, c.solar_power, c.solar_savings, c.auto_off,
      c.backwash?.due, c.backwash?.hours, c.backwash?.last, c.backwash?.timer, c.rinse?.timer].filter(Boolean) as string[];
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this._config) return true;
    return this._ids().some((id) => old.states[id] !== this.hass!.states[id]) || old.locale !== this.hass!.locale;
  }

  protected updated(): void {
    const c = this._config;
    const active = [c?.backwash?.timer, c?.rinse?.timer].some((id) => id && this.hass?.states[id]?.state === "active");
    if (active && !this._tick) {
      this._now = Date.now(); // sonst startet der Countdown mit veralteter Uhrzeit
      this._tick = window.setInterval(() => (this._now = Date.now()), 1000);
    }
    if (!active && this._tick) { clearInterval(this._tick); this._tick = undefined; }
  }

  // ---------- Werte ----------

  private _st(id?: string): HassEntity | undefined {
    return id ? this.hass!.states[id] : undefined;
  }

  private _num(id?: string): number | undefined {
    const st = this._st(id);
    if (!st || UNAVAILABLE.includes(st.state)) return undefined;
    const v = Number(st.state);
    return Number.isFinite(v) ? v : undefined;
  }

  private _fmt(v: number, digits = 1, min = 0): string {
    return v.toLocaleString(getLanguage(this.hass), { maximumFractionDigits: digits, minimumFractionDigits: min });
  }

  private _isOn(id?: string): boolean {
    return this._st(id)?.state === "on";
  }

  private _ranges() {
    const r = this._config!.ranges ?? {};
    return { ph: r.ph ?? PH, orp: r.orp ?? ORP, temperature: r.temperature ?? TEMP };
  }

  private _timeOf(id?: string): string | undefined {
    const st = this._st(id);
    if (!st || UNAVAILABLE.includes(st.state)) return undefined;
    if (st.attributes.hour != null) return `${String(st.attributes.hour).padStart(2, "0")}:${String(st.attributes.minute ?? 0).padStart(2, "0")}`;
    return st.state.slice(0, 5);
  }

  private _dateTime(iso?: string): string | undefined {
    if (!iso || UNAVAILABLE.includes(iso)) return undefined;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return undefined;
    const lang = getLanguage(this.hass);
    return d.toDateString() === new Date().toDateString()
      ? `${this._t("today")} ${d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })}`
      : d.toLocaleString(lang, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  // ---------- Aktionen ----------

  private _haptic(type = "light"): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: type }));
  }

  private async _call(domain: string, service: string, data: Record<string, unknown>): Promise<void> {
    try {
      await this.hass!.callService(domain, service, data);
    } catch (err: any) {
      this._haptic("failure");
      this.dispatchEvent(new CustomEvent("hass-notification", {
        detail: { message: `${localize(this.hass, "card.error")}: ${err?.message ?? err}` }, bubbles: true, composed: true,
      }));
    }
  }

  private _moreInfo(id?: string): void {
    if (!id) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  private _togglePump(): void {
    if (this._held) { this._held = false; return; }
    const c = this._config!;
    const st = this._st(c.pump);
    if (!st || UNAVAILABLE.includes(st.state)) return;
    this._haptic("medium");
    this._call("homeassistant", st.state === "on" ? "turn_off" : "turn_on", { entity_id: c.pump });
  }

  private _holdStart(ev: PointerEvent, id?: string): void {
    if (ev.button !== 0 || !id) return;
    this._held = false;
    clearTimeout(this._holdTimer);
    this._holdTimer = window.setTimeout(() => { this._held = true; this._haptic("medium"); this._moreInfo(id); }, HOLD_MS);
  }

  private _holdEnd = (): void => clearTimeout(this._holdTimer);

  private _confirmed(key: string): boolean {
    if (this._confirm === key) { this._confirm = undefined; clearTimeout(this._confirmTimer); return true; }
    this._haptic("warning");
    this._confirm = key;
    clearTimeout(this._confirmTimer);
    this._confirmTimer = window.setTimeout(() => (this._confirm = undefined), 4000);
    return false;
  }

  private _selectMode(option: string): void {
    const id = this._config!.mode!;
    this._haptic("selection");
    this._call(id.split(".")[0]!, "select_option", { entity_id: id, option });
  }

  private _script(id?: string): void {
    if (!id) return;
    this._haptic("medium");
    this._call("script", "turn_on", { entity_id: id });
  }

  private _backwashDone(): void {
    const id = this._config!.backwash?.done_button;
    if (!id || !this._confirmed("done")) return;
    this._haptic("medium");
    this._call(id.split(".")[0]!, "press", { entity_id: id });
  }

  private _toggle(id?: string): void {
    if (!id) return;
    this._haptic("selection");
    this._call("homeassistant", "toggle", { entity_id: id });
  }

  /** Ziel-Laufzeit: −/+ kurz gesammelt, Schnellwahl sofort */
  private _setTarget(value: number, now = false): void {
    const st = this._st(this._config!.target_runtime);
    if (!st) return;
    const a = st.attributes;
    const step = Number(a.step) || 0.5;
    const v = Math.min(Number(a.max ?? 24), Math.max(Number(a.min ?? 0), Math.round(value / step) * step));
    this._haptic("selection");
    this._pending = v;
    clearTimeout(this._sendTimer);
    const send = () => this._call(st.entity_id.split(".")[0]!, "set_value", { entity_id: st.entity_id, value: v })
      .finally(() => { if (this._pending === v) this._pending = undefined; });
    if (now) send();
    else this._sendTimer = window.setTimeout(send, 600);
  }

  private async _toggleMetric(m: Metric): Promise<void> {
    this._haptic("selection");
    this._open = this._open === m ? undefined : m;
    const id = this._config![m];
    if (!this._open || !id || this._hist[m] || !this.hass?.callWS) return;
    try {
      const res = await this.hass.callWS<Record<string, { s?: string; state?: string; lu?: number; last_updated?: string }[]>>({
        type: "history/history_during_period", start_time: new Date(Date.now() - 48 * 3600_000).toISOString(), end_time: new Date().toISOString(),
        entity_ids: [id], minimal_response: true, no_attributes: true, significant_changes_only: false,
      });
      const pts = (res?.[id] ?? []).map((p) => ({ t: p.lu != null ? p.lu * 1000 : new Date(p.last_updated ?? 0).getTime(), v: Number(p.s ?? p.state) }))
        .filter((p) => Number.isFinite(p.v) && Number.isFinite(p.t));
      this._hist = { ...this._hist, [m]: pts };
    } catch {
      this._hist = { ...this._hist, [m]: [] };
    }
  }

  // ---------- Render ----------

  private _bar(v: number, r: [number, number, number, number]) {
    const lo = r[0] - (r[1] - r[0]);
    const hi = r[3] + (r[3] - r[2]);
    const pos = (x: number) => ((x - lo) / (hi - lo)) * 100;
    const at = Math.max(0, Math.min(100, pos(v)));
    return html`<span class="rbar" style="--a:${pos(r[0])}%;--b:${pos(r[1])}%;--c:${pos(r[2])}%;--d:${pos(r[3])}%"><span class="rmark" style="left:${at}%"></span></span>`;
  }

  private _spark(pts: { t: number; v: number }[], band?: [number, number], current?: number) {
    const now = this._now;
    const t0 = now - 48 * 3600_000;
    const all = [...pts.filter((p) => p.t >= t0 - 3600_000), ...(current != null ? [{ t: now, v: current }] : [])];
    if (all.length < 2) return html`<span class="no-hist">${this._t("no_history")}</span>`;
    const vs = all.map((p) => p.v);
    let lo = Math.min(...vs, ...(band ?? []));
    let hi = Math.max(...vs, ...(band ?? []));
    const pad = (hi - lo) * 0.12 || 0.5;
    lo -= pad; hi += pad;
    const x = (t: number) => ((Math.max(t0, t) - t0) / (now - t0)) * 200;
    const y = (v: number) => 2 + (1 - (v - lo) / (hi - lo)) * 52;
    const d = all.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    return html`<svg class="spark" viewBox="0 0 200 56" preserveAspectRatio="none" aria-hidden="true">
      ${band ? svg`<rect x="0" width="200" y=${y(band[1]).toFixed(1)} height=${Math.max(0, y(band[0]) - y(band[1])).toFixed(1)} class="band"></rect>` : nothing}
      <path d=${d}></path></svg>
      <span class="spark-axis"><span>−48 h</span><span>−24 h</span><span>${this._t("now")}</span></span>`;
  }

  private _metric(m: Metric) {
    const c = this._config!;
    const v = this._num(c[m]);
    if (!c[m]) return nothing;
    const r = this._ranges();
    let status: "optimal" | "ok" | "bad" = "ok";
    let label = "–";
    let value = "–";
    let bar: unknown = nothing;
    if (v != null) {
      if (m === "temperature") {
        const [cold, warm] = r.temperature;
        status = v < cold ? "ok" : v <= warm ? "optimal" : "ok";
        label = this._t(v < cold ? "cold" : v <= warm ? "perfect" : "warm");
        value = `${this._fmt(v)} °C`;
        bar = this._bar(v, [cold - 5, cold, warm, warm + 4]);
      } else {
        const rr = m === "ph" ? r.ph : r.orp;
        status = rangeStatus(v, rr);
        label = this._t(m === "ph" ? `ph_${status}` : `orp_${status}`);
        value = m === "ph" ? this._fmt(v, 2) : `${Math.round(v)} mV`;
        bar = this._bar(v, rr);
      }
    }
    const icon = m === "temperature" ? "mdi:thermometer-water" : m === "ph" ? "mdi:ph" : "mdi:flash-triangle";
    const color = m === "temperature" && v != null && v < r.temperature[0] ? "#29b6f6" : STATUS_COLOR[status];
    return html`<button class="metric ${this._open === m ? "open" : ""} m-${m}" style="--mc:${color}" aria-expanded=${this._open === m} @click=${() => this._toggleMetric(m)}>
      <span class="m-head"><ha-icon .icon=${icon}></ha-icon><span>${this._t(m === "temperature" ? "temp_short" : m)}</span></span>
      <span class="m-val">${value}</span>
      <span class="m-status">${label}</span>
      ${bar}
    </button>`;
  }

  private _renderHistory(m: Metric) {
    const c = this._config!;
    const r = this._ranges();
    const pts = this._hist[m];
    const band: [number, number] = m === "temperature" ? r.temperature : m === "ph" ? [r.ph[1], r.ph[2]] : [r.orp[1], r.orp[2]];
    return html`<div class="hist">
      <div class="hist-head"><span>${this._t(m)} · 48 h</span>
        <button class="link" @click=${() => this._moreInfo(c[m])}>${this._t("details")}<ha-icon icon="mdi:chevron-right"></ha-icon></button></div>
      ${pts ? this._spark(pts, band, this._num(c[m])) : html`<span class="no-hist">…</span>`}
    </div>`;
  }

  private _renderBasin(pumpOn: boolean, pumpUnavailable: boolean, watts?: number) {
    const c = this._config!;
    const temp = this._num(c.temperature);
    const quality = this._st(c.quality)?.state;
    const r = this._ranges();
    const water = quality === "critical" ? "critical" : quality === "check" ? "check" : "ok";
    return html`<div class="basin w-${water} ${pumpOn ? "running" : ""}">
      <div class="caustics"></div>
      <svg class="waves" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true">
        <path class="wave w1" d="M0,20 Q50,8 100,20 T200,20 T300,20 T400,20 T500,20 T600,20 T700,20 T800,20 V40 H0 Z"></path>
        <path class="wave w2" d="M0,24 Q50,34 100,24 T200,24 T300,24 T400,24 T500,24 T600,24 T700,24 T800,24 V40 H0 Z"></path>
      </svg>
      ${pumpOn ? html`<div class="bubbles">${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => html`<span style="--i:${i}"></span>`)}</div>` : nothing}
      <button class="b-temp" @click=${() => this._moreInfo(c.temperature)} ?disabled=${!c.temperature}>
        <span class="b-val">${temp != null ? html`${this._fmt(temp)}<small>°C</small>` : "–"}</span>
        <span class="b-label">${temp == null ? this._t("water") : this._t(temp < r.temperature[0] ? "cold" : temp <= r.temperature[1] ? "perfect" : "warm")}</span>
      </button>
      ${c.pump ? html`<button class="b-pump ${pumpOn ? "on" : ""}" ?disabled=${pumpUnavailable} aria-pressed=${pumpOn} aria-label=${this._t("pump")}
        title=${pumpUnavailable ? this._t("pump_unavailable") : this._t("pump")}
        @click=${() => this._togglePump()} @pointerdown=${(e: PointerEvent) => this._holdStart(e, c.pump)}
        @pointerup=${this._holdEnd} @pointerleave=${this._holdEnd} @pointercancel=${this._holdEnd} @contextmenu=${(e: Event) => e.preventDefault()}>
        <ha-icon .icon=${pumpUnavailable ? "mdi:power-plug-off" : "mdi:pump"}></ha-icon>
        <span>${pumpUnavailable ? this._t("unavailable_short") : pumpOn ? (watts != null ? formatPower(watts, getLanguage(this.hass), 1000, 0, 1) : this._t("on")) : this._t("off")}</span>
      </button>` : nothing}
    </div>`;
  }

  private _renderGuidance() {
    const c = this._config!;
    const g = this._st(c.guidance)?.state;
    if (!c.guidance && !c.quality) return nothing;
    const quality = this._st(c.quality)?.state;
    const bad = g != null ? !OK_GUIDANCE.includes(g) : quality != null && quality !== "ok";
    const when = this._dateTime(this._st(c.last_measurement)?.state);
    const stale = this._isOn(c.measurement_stale);
    return html`<div class="guide ${bad ? "bad" : "good"}">
      <ha-icon .icon=${bad ? "mdi:flask-outline" : "mdi:check-decagram"}></ha-icon>
      <span class="g-text"><b>${this._t(bad ? "action_needed" : "all_good")}</b>
        <span>${bad ? g ?? this._t(`quality_${quality}`) : this._t("all_good_sub")}${when ? html` · ${this._t("measured")} ${when}` : nothing}</span>
        ${stale ? html`<span class="stale"><ha-icon icon="mdi:clock-alert-outline"></ha-icon>${this._t("stale")}</span>` : nothing}</span>
    </div>`;
  }

  private _renderRuntime(pumpOn: boolean) {
    const c = this._config!;
    const today = this._num(c.runtime_today);
    const targetMode = c.target_mode ?? "Automatik";
    const mode = this._st(c.mode)?.state;
    const target = this._pending ?? this._num(c.target_runtime);
    const rec = this._num(c.recommended_runtime);
    const goal = mode === targetMode && target != null ? target : rec ?? target;
    if (today == null && goal == null) return nothing;
    const share = goal ? Math.min(1, (today ?? 0) / goal) : 0;
    const solar = this._num(c.solar_power);
    const savings = this._num(c.solar_savings);
    const energy = this._num(c.energy_today);
    const cost = this._num(c.cost_today);
    const stats = [
      pumpOn && solar != null ? { icon: "mdi:solar-power", color: "#ffa000", v: `${Math.round(solar)} W`, l: this._t("solar") } : undefined,
      pumpOn && savings != null ? { icon: "mdi:cash-check", color: "#43a047", v: `${this._fmt(savings, 2)} €/h`, l: this._t("savings") } : undefined,
      energy != null ? { icon: "mdi:lightning-bolt", color: "#fb8c00", v: `${this._fmt(energy, 2)} kWh`, l: this._t("energy_today") } : undefined,
      cost != null ? { icon: "mdi:currency-eur", color: "var(--secondary-text-color)", v: `${this._fmt(cost, 2)} €`, l: this._t("cost_today") } : undefined,
    ].filter((x): x is NonNullable<typeof x> => !!x);
    return html`<div class="runtime">
      <button class="ring ${pumpOn ? "on" : ""}" style="--p:${(share * 360).toFixed(1)}deg" @click=${() => this._moreInfo(c.runtime_today)}>
        <span class="ring-in"><b>${today != null ? this._fmt(today) : "–"}</b><small>h</small></span>
      </button>
      <div class="rt-text">
        <span class="rt-title">${this._t("filter_today")}</span>
        <span class="rt-goal">${goal != null ? html`${this._t("of")} ${this._fmt(goal)} h <small>(${this._t(mode === targetMode && target != null ? "goal_set" : "goal_recommended")})</small>` : nothing}</span>
        ${stats.length ? html`<span class="rt-stats">${stats.map((s) => html`<span class="rt-stat" style="--sc:${s.color}" title=${s.l}><ha-icon .icon=${s.icon}></ha-icon>${s.v}</span>`)}</span>` : nothing}
      </div>
    </div>`;
  }

  private _renderTarget() {
    const c = this._config!;
    const st = this._st(c.target_runtime);
    if (!st) return nothing;
    const a = st.attributes;
    const min = Number(a.min ?? 0);
    const max = Number(a.max ?? 24);
    const step = Number(a.step) || 0.5;
    const cur = this._pending ?? this._num(c.target_runtime) ?? min;
    const rec = this._num(c.recommended_runtime);
    const recRounded = rec != null ? Math.min(max, Math.max(min, Math.round(rec / step) * step)) : undefined;
    const presets = (c.runtimes ?? [2, 4, 6, 8, 10, 12]).filter((h) => h >= min && h <= max);
    const big = (dir: number) => this._setTarget(cur + dir * step);
    return html`<div class="target">
      <button class="t-row" aria-expanded=${this._editTarget} @click=${() => { this._haptic("selection"); this._editTarget = !this._editTarget; }}>
        <ha-icon icon="mdi:clock-check-outline"></ha-icon>
        <span class="t-label">${this._t("target")}<small>${c.target_mode ?? "Automatik"}</small></span>
        <span class="t-val">${this._fmt(cur)} h</span>
        <ha-icon class="chev ${this._editTarget ? "up" : ""}" icon="mdi:chevron-down"></ha-icon>
      </button>
      ${this._editTarget ? html`<div class="t-edit">
        <div class="ed-main">
          <button class="ed-step" aria-label="−" ?disabled=${cur <= min} @click=${() => big(-1)}><ha-icon icon="mdi:minus"></ha-icon></button>
          <span class="ed-val">${this._fmt(cur)}<small> h</small></span>
          <button class="ed-step" aria-label="+" ?disabled=${cur >= max} @click=${() => big(1)}><ha-icon icon="mdi:plus"></ha-icon></button>
        </div>
        <div class="ed-chips">${presets.map((h) => html`<button class="ed-chip ${cur === h ? "sel" : ""}" @click=${() => this._setTarget(h, true)}>${h}</button>`)}</div>
        ${recRounded != null ? html`<button class="rec ${cur === recRounded ? "sel" : ""}" @click=${() => this._setTarget(recRounded, true)}>
          <ha-icon icon="mdi:lightbulb-on-outline"></ha-icon>${this._t("use_recommended")} · ${this._fmt(rec!)} h</button>` : nothing}
      </div>` : nothing}
    </div>`;
  }

  private _renderCare() {
    const c = this._config!;
    if (c.care === false) return nothing;
    const care = c.care || {};
    const ph = this._num(c.ph);
    const orp = this._num(c.orp);
    const temp = this._num(c.temperature);
    if (ph == null && orp == null) return nothing;
    const r = this._ranges();
    const rows: { icon: string; title: string; text: string; status: "optimal" | "ok" | "bad" }[] = [];
    if (ph != null) {
      const dose = phDose(ph, care.ph_target ?? (r.ph[1] + r.ph[2]) / 2, care.ph_dose ?? 172, r.ph[1], r.ph[2]);
      rows.push({ icon: "mdi:ph", title: this._t("ph"), status: rangeStatus(ph, r.ph),
        text: dose ? this._t(dose.kind === "minus" ? "ph_high" : "ph_low").replace("{g}", String(dose.grams)) : this._t("ph_fine").replace("{a}", this._fmt(r.ph[1])).replace("{b}", this._fmt(r.ph[2])) });
    }
    if (orp != null) {
      rows.push({ icon: "mdi:bottle-tonic-plus", title: this._t("chlorine"), status: rangeStatus(orp, r.orp),
        text: orp < r.orp[0] ? this._t("cl_critical").replace("{g}", String(care.chlorine_critical ?? 150))
          : orp < r.orp[1] ? this._t("cl_low").replace("{g}", String(care.chlorine_low ?? 50)) : this._t("cl_fine") });
    }
    if (temp != null) {
      const rec = poolRuntimeRecommendation(temp, ph != null && rangeStatus(ph, r.ph) !== "optimal", orp != null && orp < (r.orp[0] + r.orp[1]) / 2);
      rows.push({ icon: "mdi:timer-cog-outline", title: this._t("pump_recommendation"), status: "optimal",
        text: this._t("pump_rec_text").replace("{h}", String(rec.total)).replace("{b}", String(rec.base)).replace("{t}", this._fmt(temp))
          + (rec.extra ? this._t("pump_rec_extra").replace("{x}", String(rec.extra)) : "") + ")" });
    }
    const todo = rows.filter((x) => x.status !== "optimal").length;
    return html`<div class="care ${this._careOpen ? "open" : ""}">
      <button class="sec-head" aria-expanded=${this._careOpen} @click=${() => { this._haptic("selection"); this._careOpen = !this._careOpen; }}>
        <ha-icon icon="mdi:clipboard-check-outline"></ha-icon><span>${this._t("care")}</span>
        ${todo ? html`<span class="count">${todo}</span>` : html`<ha-icon class="ok-mark" icon="mdi:check"></ha-icon>`}
        <ha-icon class="chev ${this._careOpen ? "up" : ""}" icon="mdi:chevron-down"></ha-icon>
      </button>
      ${this._careOpen ? html`<div class="care-rows">${rows.map((x) => html`<div class="care-row" style="--cc:${STATUS_COLOR[x.status]}">
        <span class="cr-icon"><ha-icon .icon=${x.icon}></ha-icon></span><span class="cr-text"><b>${x.title}</b><span>${x.text}</span></span></div>`)}</div>` : nothing}
    </div>`;
  }

  private _timerButton(kind: "backwash" | "rinse", script?: string, timer?: string) {
    const t = timer ? timerInfo(this._st(timer), this._now) : undefined;
    const active = !!t && t.state !== "idle";
    const mins = t?.duration ? Math.round(t.duration / 60) : undefined;
    return html`<button class="mt-btn ${kind} ${active ? "active" : ""}" style="--tp:${active ? t!.progress * 100 : 0}%" ?disabled=${!script || active}
      @click=${() => this._script(script)}>
      <span class="mt-fill"></span>
      <ha-icon .icon=${kind === "backwash" ? "mdi:water-sync" : "mdi:water-check"}></ha-icon>
      <span class="mt-text"><b>${this._t(kind)}</b><small>${active ? `${this._t("left")} ${formatRemaining(t!.remaining)}` : mins ? `${mins} min ${this._t("start_short")}` : this._t("start_short")}</small></span>
    </button>`;
  }

  private _renderMaintenance() {
    const c = this._config!;
    const b = c.backwash ?? {};
    const r = c.rinse ?? {};
    if (!b.hours && !b.script && !r.script && !c.auto_off && !b.done_button) return nothing;
    const hours = this._num(b.hours);
    const interval = b.interval ?? Number(this._st(b.hours)?.attributes.interval_hours) ?? undefined;
    const due = this._isOn(b.due) || (hours != null && !!interval && hours >= interval);
    const last = this._dateTime(this._st(b.last)?.state);
    const dueAttr = (this._st(b.due)?.attributes ?? {}) as Record<string, any>;
    const autoOff = this._st(c.auto_off);
    return html`<div class="maint">
      <div class="sec-title"><ha-icon icon="mdi:wrench-outline"></ha-icon><span>${this._t("maintenance")}</span>
        ${due ? html`<span class="due-badge">${this._t("backwash_due")}</span>` : nothing}</div>
      ${hours != null ? html`<div class="bw ${due ? "due" : ""}">
        <span class="bw-text">${this._fmt(hours)} h${interval ? html` <small>${this._t("of")} ${this._fmt(interval, 0)} h ${this._t("since_backwash")}</small>` : nothing}</span>
        ${interval ? html`<span class="bw-bar"><span style="width:${Math.min(100, (hours / interval) * 100)}%"></span></span>` : nothing}
        ${last ? html`<span class="bw-last">${this._t("last_backwash")} ${last}</span>` : nothing}
        ${dueAttr.reason === "days" && dueAttr.days_since != null ? html`<span class="bw-last bw-why">${this._t("backwash_days")
          .replace("{d}", String(dueAttr.days_since)).replace("{m}", String(dueAttr.max_days ?? ""))}</span>` : nothing}
      </div>` : nothing}
      ${b.script || r.script ? html`<div class="mt-btns">${b.script ? this._timerButton("backwash", b.script, b.timer) : nothing}${r.script ? this._timerButton("rinse", r.script, r.timer) : nothing}</div>` : nothing}
      <div class="mt-row">
        ${b.done_button ? html`<button class="done ${this._confirm === "done" ? "ask" : ""}" @click=${() => this._backwashDone()}>
          <ha-icon icon="mdi:check-circle-outline"></ha-icon>${this._confirm === "done" ? this._t("confirm") : this._t("backwash_done")}</button>` : nothing}
        ${autoOff ? html`<button class="toggle-row ${autoOff.state === "on" ? "on" : ""}" role="switch" aria-checked=${autoOff.state === "on"} @click=${() => this._toggle(c.auto_off)}
          title=${this._t("auto_off_hint")}>
          <ha-icon icon="mdi:power-plug-off-outline"></ha-icon><span>${this._t("auto_off")}</span><span class="sw"><span></span></span></button>` : nothing}
      </div>
    </div>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const pumpSt = this._st(c.pump);
    const pumpUnavailable = !!c.pump && (!pumpSt || UNAVAILABLE.includes(pumpSt.state));
    const pumpOn = pumpSt?.state === "on";
    const watts = powerWatts(this._st(c.pump_power));
    const quality = this._st(c.quality)?.state;
    const modeSt = this._st(c.mode);
    const start = this._timeOf(c.start_time);
    const status = !c.pump ? "" : pumpUnavailable ? this._t("pump_unavailable")
      : pumpOn ? `${this._t("filter_running")}${watts != null ? ` · ${formatPower(watts, getLanguage(this.hass), 1000, 0, 1)}` : ""}` : this._t("filter_off");
    const anim = c.animations ?? "full";
    const metrics: Metric[] = (["temperature", "ph", "orp"] as Metric[]).filter((m) => c[m]);
    return html`<ha-card class="pool anim-${anim} ${pumpOn ? "on" : "off"}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <button class="head-text" @click=${() => this._moreInfo(c.pump)}>
          <span class="h-title">${c.title ?? this._t("title")}</span>
          ${status ? html`<span class="h-sub ${pumpUnavailable ? "warn" : ""}">${status}${modeSt && !UNAVAILABLE.includes(modeSt.state) ? ` · ${modeSt.state}` : ""}</span>` : nothing}
        </button>
        ${quality && !UNAVAILABLE.includes(quality) ? html`<span class="q q-${quality}" title=${this._t(`quality_${quality}`)}>
          <ha-icon .icon=${quality === "ok" ? "mdi:check-circle" : quality === "critical" ? "mdi:close-circle" : "mdi:alert-circle"}></ha-icon>${this._t(`quality_short_${quality}`)}</span>` : nothing}
        ${start ? html`<button class="chip" @click=${() => this._moreInfo(c.start_time)} title=${this._t("start_time")}><ha-icon icon="mdi:clock-outline"></ha-icon>${start}</button>` : nothing}
      </div>
      ${this._renderBasin(pumpOn, pumpUnavailable, watts)}
      ${metrics.length ? html`<div class="metrics" style="--n:${metrics.length}">${metrics.map((m) => this._metric(m))}</div>` : nothing}
      ${this._open && c[this._open] ? this._renderHistory(this._open) : nothing}
      ${this._renderGuidance()}
      ${this._renderRuntime(pumpOn)}
      ${modeSt && Array.isArray(modeSt.attributes.options) ? html`<div class="modes" role="radiogroup" aria-label=${this._t("mode")}>
        ${(modeSt.attributes.options as string[]).map((o) => html`<button class="mode ${modeSt.state === o ? "sel" : ""}" role="radio" aria-checked=${modeSt.state === o}
          @click=${() => this._selectMode(o)}>${o}</button>`)}</div>` : nothing}
      ${this._renderTarget()}
      ${this._renderCare()}
      ${this._renderMaintenance()}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.pool { --accent: #26c6da; gap: 12px; }
    ha-card.pool.off .blob { opacity: 0.35; animation-play-state: paused; }
    .header { display: flex; align-items: center; gap: 8px; }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; border: none; background: none; padding: 0; text-align: left; cursor: pointer; }
    .h-title { font-size: 17px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .h-sub { font-size: 13px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .h-sub.warn { color: var(--error-color, #e53935); }
    .chip { flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px 5px 8px; border-radius: 999px; border: none; cursor: pointer;
      font-size: 13px; font-weight: 600; background: rgba(127,127,127,0.12); }
    .chip ha-icon { --mdc-icon-size: 16px; color: var(--secondary-text-color); }
    .q { flex: none; display: inline-flex; align-items: center; gap: 3px; padding: 4px 9px 4px 6px; border-radius: 999px; font-size: 12.5px; font-weight: 700; }
    .q ha-icon { --mdc-icon-size: 16px; }
    .q-ok { color: var(--success-color, #43a047); background: color-mix(in srgb, var(--success-color, #43a047) 14%, transparent); }
    .q-check { color: #fb8c00; background: color-mix(in srgb, #fb8c00 14%, transparent); }
    .q-critical { color: var(--error-color, #e53935); background: color-mix(in srgb, var(--error-color, #e53935) 14%, transparent); }

    /* Becken */
    .basin { position: relative; height: 132px; border-radius: var(--hcc-inner-radius, 14px); overflow: hidden; isolation: isolate;
      --w1: #4fc3f7; --w2: #0288d1; background: linear-gradient(180deg, var(--w1), var(--w2)); box-shadow: inset 0 0 0 4px rgba(255,255,255,0.12), inset 0 10px 24px rgba(0,0,0,0.18); }
    .basin.w-check { --w1: #4dd0e1; --w2: #00838f; }
    .basin.w-critical { --w1: #81c784; --w2: #2e7d32; }
    .caustics { position: absolute; inset: -40%; z-index: -1; opacity: 0.35;
      background: radial-gradient(circle at 20% 30%, rgba(255,255,255,0.55) 0 6%, transparent 14%), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.45) 0 5%, transparent 12%),
        radial-gradient(circle at 45% 80%, rgba(255,255,255,0.4) 0 4%, transparent 11%), radial-gradient(circle at 85% 20%, rgba(255,255,255,0.4) 0 5%, transparent 12%);
      background-size: 60% 60%; animation: caustic 14s ease-in-out infinite alternate; }
    .basin.running .caustics { animation-duration: 6s; opacity: 0.5; }
    @keyframes caustic { from { transform: translate(0, 0) rotate(0deg); } to { transform: translate(8%, 6%) rotate(8deg); } }
    .waves { position: absolute; left: 0; top: 0; width: 200%; height: 26px; transform: scaleY(-1); }
    .wave { fill: rgba(255,255,255,0.18); animation: wave 9s linear infinite; }
    .wave.w2 { fill: rgba(255,255,255,0.1); animation-duration: 13s; animation-direction: reverse; }
    .basin.running .wave { animation-duration: 4s; }
    .basin.running .wave.w2 { animation-duration: 6s; }
    @keyframes wave { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    .bubbles span { position: absolute; bottom: -10px; left: calc(8% + var(--i) * 11%); width: calc(5px + (var(--i) * 3px) % 7px); aspect-ratio: 1; border-radius: 50%;
      background: rgba(255,255,255,0.55); animation: bubble calc(2.6s + (var(--i) * 0.37s)) ease-in infinite; animation-delay: calc(var(--i) * -0.45s); }
    @keyframes bubble { 0% { transform: translateY(0) translateX(0); opacity: 0; } 15% { opacity: 0.9; } 100% { transform: translateY(-150px) translateX(8px); opacity: 0; } }
    .b-temp { position: absolute; left: 16px; bottom: 14px; display: flex; flex-direction: column; align-items: flex-start; border: none; background: none; padding: 0; cursor: pointer; color: #fff;
      text-shadow: 0 2px 8px rgba(0,0,0,0.25); text-align: left; }
    .b-val { font-size: 40px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
    .b-val small { font-size: 18px; font-weight: 600; margin-left: 2px; opacity: 0.9; }
    .b-label { font-size: 13px; font-weight: 600; opacity: 0.9; margin-top: 2px; }
    .b-pump { position: absolute; right: 12px; bottom: 12px; display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 64px; padding: 8px 10px; border: none;
      border-radius: 16px; cursor: pointer; color: #fff; background: rgba(255,255,255,0.18); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      font-size: 12px; font-weight: 700; transition: background 0.3s, transform 0.2s var(--ease-spring); user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
    .b-pump:active { transform: scale(0.94); }
    .b-pump ha-icon { --mdc-icon-size: 26px; }
    .b-pump.on { color: #00838f; background: rgba(255,255,255,0.92); }
    .b-pump.on ha-icon { animation: spin 2.4s linear infinite; }
    .b-pump[disabled] { cursor: not-allowed; background: rgba(0,0,0,0.25); }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Wasserwerte */
    .metrics { container-type: inline-size; display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 8px; }
    .metric { display: flex; flex-direction: column; gap: 3px; min-width: 0; padding: 10px 9px; border: none; border-radius: var(--hcc-inner-radius, 14px); cursor: pointer; text-align: left;
      background: rgba(127,127,127,0.08); transition: background 0.3s, box-shadow 0.3s; }
    .metric.open { background: color-mix(in srgb, var(--mc) 12%, rgba(127,127,127,0.05)); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--mc) 55%, transparent); }
    .m-head { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; }
    .m-head span { overflow: hidden; text-overflow: ellipsis; }
    .m-head ha-icon { --mdc-icon-size: 16px; color: var(--mc); flex: none; }
    .m-val { font-size: clamp(15px, 5.4cqi, 19px); font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .m-status { font-size: 12px; font-weight: 600; color: var(--mc); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .rbar { position: relative; height: 6px; margin-top: 4px; border-radius: 3px;
      background: linear-gradient(90deg, #e53935 0 var(--a), #fbc02d var(--a) var(--b), #43a047 var(--b) var(--c), #fbc02d var(--c) var(--d), #e53935 var(--d) 100%); opacity: 0.85; }
    .m-temperature .rbar { background: linear-gradient(90deg, #29b6f6 0 var(--b), #43a047 var(--b) var(--c), #fb8c00 var(--c) 100%); }
    .rmark { position: absolute; top: 50%; width: 12px; height: 12px; border-radius: 50%; transform: translate(-50%, -50%); background: var(--card-background-color, #fff);
      box-shadow: 0 0 0 2.5px var(--primary-text-color), 0 1px 3px rgba(0,0,0,0.3); transition: left 0.6s var(--ease-out); }
    .hist { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: var(--hcc-inner-radius, 14px); background: rgba(127,127,127,0.06); animation: fade-in 0.3s var(--ease-out) both; }
    @keyframes fade-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
    .hist-head { display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: 600; color: var(--secondary-text-color); }
    .link { display: inline-flex; align-items: center; border: none; background: none; padding: 0; cursor: pointer; font-size: 12px; font-weight: 600; color: var(--accent); }
    .link ha-icon { --mdc-icon-size: 16px; }
    .spark { width: 100%; height: 64px; overflow: visible; }
    .spark .band { fill: color-mix(in srgb, var(--success-color, #43a047) 16%, transparent); }
    .spark path { fill: none; stroke: var(--accent); stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
    .spark-axis { display: flex; justify-content: space-between; font-size: 10.5px; color: var(--secondary-text-color); }
    .no-hist { font-size: 12px; color: var(--secondary-text-color); }

    /* Hinweis */
    .guide { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: var(--hcc-inner-radius, 14px); --gc: var(--success-color, #43a047);
      background: color-mix(in srgb, var(--gc) 13%, transparent); }
    .guide.bad { --gc: #fb8c00; }
    .guide > ha-icon { --mdc-icon-size: 24px; color: var(--gc); flex: none; }
    .g-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; font-size: 13px; color: var(--secondary-text-color); }
    .g-text b { font-size: 14.5px; color: var(--primary-text-color); }
    .stale { display: inline-flex; align-items: center; gap: 4px; color: #fb8c00; font-weight: 600; }
    .stale ha-icon { --mdc-icon-size: 15px; }

    /* Laufzeit */
    .runtime { display: flex; align-items: center; gap: 14px; }
    .ring { position: relative; flex: none; width: 70px; height: 70px; border-radius: 50%; border: none; padding: 0; cursor: pointer;
      background: conic-gradient(var(--accent) 0 var(--p), rgba(127,127,127,0.18) var(--p) 360deg); }
    .ring-in { position: absolute; inset: 7px; border-radius: 50%; display: flex; align-items: baseline; justify-content: center; padding-top: 18px; box-sizing: border-box;
      background: var(--card-background-color, var(--ha-card-background, #fff)); }
    .ring-in b { font-size: 19px; font-weight: 700; }
    .ring-in small { font-size: 11px; color: var(--secondary-text-color); margin-left: 1px; }
    .ring.on { box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent); }
    .rt-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .rt-title { font-size: 14.5px; font-weight: 600; }
    .rt-goal { font-size: 13px; color: var(--secondary-text-color); }
    .rt-goal small { font-size: 11.5px; }
    .rt-stats { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 3px; }
    .rt-stat { display: inline-flex; align-items: center; gap: 3px; font-size: 12.5px; font-weight: 600; white-space: nowrap; }
    .rt-stat ha-icon { --mdc-icon-size: 15px; color: var(--sc); }

    /* Modus */
    .modes { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin: 0 -4px; padding: 2px 4px; scroll-snap-type: x proximity; }
    .modes::-webkit-scrollbar { display: none; }
    .mode { flex: none; padding: 7px 12px; border: none; border-radius: 999px; background: rgba(127,127,127,0.1); cursor: pointer; font-size: 13px; font-weight: 600;
      color: var(--secondary-text-color); transition: background 0.3s, color 0.3s; white-space: nowrap; scroll-snap-align: start; }
    .mode.sel { color: #fff; background: var(--accent); }

    /* Ziel-Laufzeit */
    .target { border-radius: var(--hcc-inner-radius, 14px); background: rgba(127,127,127,0.07); overflow: hidden; }
    .t-row, .sec-head { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border: none; background: none; cursor: pointer; text-align: left; }
    .t-row > ha-icon, .sec-head > ha-icon:first-child { --mdc-icon-size: 20px; color: var(--accent); flex: none; }
    .t-label { display: flex; flex-direction: column; flex: 1; min-width: 0; font-size: 14px; font-weight: 600; }
    .t-label small { font-size: 11.5px; font-weight: 500; color: var(--secondary-text-color); }
    .t-val { font-size: 15px; font-weight: 700; }
    .chev { --mdc-icon-size: 20px; color: var(--secondary-text-color); transition: transform 0.3s var(--ease-out); flex: none; }
    .chev.up { transform: rotate(180deg); }
    .t-edit { display: flex; flex-direction: column; gap: 10px; padding: 0 12px 12px; animation: fade-in 0.3s var(--ease-out) both; }
    .ed-main { display: flex; align-items: center; justify-content: center; gap: 18px; }
    .ed-step { width: 44px; height: 44px; border-radius: 50%; border: none; padding: 0; display: grid; place-items: center; cursor: pointer; color: var(--accent);
      background: var(--card-background-color, var(--ha-card-background, #fff)); transition: transform 0.2s var(--ease-spring), opacity 0.2s; touch-action: manipulation; }
    .ed-step:active { transform: scale(0.88); }
    .ed-step[disabled] { opacity: 0.35; cursor: default; }
    .ed-step ha-icon { --mdc-icon-size: 24px; }
    .ed-val { min-width: 92px; text-align: center; font-size: 32px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
    .ed-val small { font-size: 15px; font-weight: 500; color: var(--secondary-text-color); }
    .ed-chips { display: flex; gap: 6px; }
    .ed-chip { flex: 1; min-width: 0; border: none; border-radius: 999px; padding: 7px 2px; cursor: pointer; font-size: 13px; font-weight: 600;
      background: var(--card-background-color, var(--ha-card-background, #fff)); }
    .ed-chip.sel, .rec.sel { color: #fff; background: var(--accent); }
    .rec { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; border: none; border-radius: 999px; cursor: pointer; font-size: 13px; font-weight: 600;
      color: #f9a825; background: color-mix(in srgb, #f9a825 14%, transparent); }
    .rec ha-icon { --mdc-icon-size: 17px; }
    .rec.sel ha-icon { color: #fff; }

    /* Pflege */
    .care { border-radius: var(--hcc-inner-radius, 14px); background: rgba(127,127,127,0.07); overflow: hidden; }
    .sec-head span:not(.count) { flex: 1; font-size: 14px; font-weight: 600; }
    .count { min-width: 20px; height: 20px; padding: 0 6px; box-sizing: border-box; border-radius: 10px; display: grid; place-items: center; font-size: 12px; font-weight: 700;
      color: #fff; background: #fb8c00; }
    .ok-mark { --mdc-icon-size: 18px; color: var(--success-color, #43a047); }
    .care-rows { display: flex; flex-direction: column; gap: 6px; padding: 0 12px 12px; animation: fade-in 0.3s var(--ease-out) both; }
    .care-row { display: flex; align-items: flex-start; gap: 10px; }
    .cr-icon { flex: none; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; color: var(--cc); background: color-mix(in srgb, var(--cc) 15%, transparent); }
    .cr-icon ha-icon { --mdc-icon-size: 18px; }
    .cr-text { display: flex; flex-direction: column; font-size: 13px; color: var(--secondary-text-color); min-width: 0; }
    .cr-text b { font-size: 13.5px; color: var(--primary-text-color); }

    /* Wartung */
    .maint { display: flex; flex-direction: column; gap: 8px; }
    .sec-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--secondary-text-color); }
    .sec-title ha-icon { --mdc-icon-size: 16px; }
    .due-badge { margin-left: auto; padding: 2px 8px; border-radius: 999px; font-size: 11px; text-transform: none; letter-spacing: 0; color: #fff; background: #fb8c00; }
    .bw { display: flex; flex-direction: column; gap: 4px; }
    .bw-text { font-size: 15px; font-weight: 700; }
    .bw-text small { font-size: 12.5px; font-weight: 500; color: var(--secondary-text-color); }
    .bw-bar { height: 6px; border-radius: 3px; background: rgba(127,127,127,0.18); overflow: hidden; }
    .bw-bar span { display: block; height: 100%; border-radius: 3px; background: var(--accent); transition: width 0.6s var(--ease-out); }
    .bw.due .bw-bar span { background: #fb8c00; }
    .bw-last.bw-why { color: #fb8c00; font-weight: 600; }
    .bw-last { font-size: 12px; color: var(--secondary-text-color); }
    .mt-btns { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
    .mt-btn { position: relative; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: none; border-radius: var(--hcc-inner-radius, 14px); cursor: pointer;
      text-align: left; overflow: hidden; background: rgba(127,127,127,0.09); --bc: #fb8c00; }
    .mt-btn.rinse { --bc: #29b6f6; }
    .mt-btn > ha-icon { position: relative; --mdc-icon-size: 24px; color: var(--bc); flex: none; }
    .mt-btn.active > ha-icon { animation: spin 2s linear infinite; }
    .mt-fill { position: absolute; inset: 0 auto 0 0; width: var(--tp); background: color-mix(in srgb, var(--bc) 20%, transparent); transition: width 1s linear; }
    .mt-text { position: relative; display: flex; flex-direction: column; min-width: 0; }
    .mt-text b { font-size: 14px; }
    .mt-text small { font-size: 12px; color: var(--secondary-text-color); font-variant-numeric: tabular-nums; }
    .mt-btn.active .mt-text small { color: var(--bc); font-weight: 700; }
    .mt-btn[disabled]:not(.active) { opacity: 0.45; cursor: default; }
    .mt-btn.active { cursor: default; }
    .mt-row { display: flex; flex-wrap: wrap; gap: 8px; }
    .done, .toggle-row { flex: 1 1 170px; display: flex; align-items: center; gap: 8px; padding: 9px 12px; border: none; border-radius: var(--hcc-inner-radius, 14px); cursor: pointer;
      font-size: 13.5px; font-weight: 600; background: rgba(127,127,127,0.09); text-align: left; transition: background 0.3s, color 0.3s; }
    .done ha-icon, .toggle-row ha-icon { --mdc-icon-size: 20px; color: var(--accent); flex: none; }
    .done { flex: 0 1 auto; }
    .done.ask { color: #fff; background: var(--accent); }
    .done.ask ha-icon { color: #fff; }
    .toggle-row span:not(.sw) { flex: 1; }
    .sw { position: relative; flex: none; width: 36px; height: 20px; border-radius: 10px; background: rgba(127,127,127,0.35); transition: background 0.3s; }
    .sw span { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 0.3s var(--ease-spring); box-shadow: 0 1px 2px rgba(0,0,0,0.3); }
    .toggle-row.on .sw { background: var(--success-color, #43a047); }
    .toggle-row.on .sw span { transform: translateX(16px); }
    ha-card.anim-reduced .wave, ha-card.anim-off .wave, ha-card.anim-reduced .caustics, ha-card.anim-off .caustics, ha-card.anim-reduced .bubbles, ha-card.anim-off .bubbles,
    ha-card.anim-reduced .b-pump.on ha-icon, ha-card.anim-off .b-pump.on ha-icon, ha-card.anim-off .mt-btn.active > ha-icon { animation: none; }
    ha-card.anim-reduced .bubbles, ha-card.anim-off .bubbles { display: none; }
  `];
}
