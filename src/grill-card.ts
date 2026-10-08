import { LitElement, css, html, nothing, svg, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { GrillCardConfig, HomeAssistant } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { cookPhase, cookProgress, meatProbes, UNAVAILABLE, type CookPhase, type MeatProbe } from "./utils";
import "./grill-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-grill-card",
  name: "Modern Grill Card",
  description: "Grillthermometer (Meater & Co.): Kerntemperatur gegen Ziel als Ring, Garraum, Restzeit und „fertig um“, Kochstatus mit Hinweis zum Ruhen lassen, Temperaturverlauf – alle Sonden automatisch (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const PHASE_COLOR: Record<CookPhase, string> = { idle: "#9e9e9e", configured: "#1e88e5", cooking: "#fb8c00", ready: "#e53935", resting: "#8e24aa", done: "#43a047", over: "#b71c1c" };
type Pts = { t: number; v: number }[];

@customElement("ha-grill-card")
export class HaGrillCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: GrillCardConfig;
  @state() private _hist: Record<string, Pts> = {};
  private _interval?: number;
  private _loadedFor?: string;
  private _cache?: { key: unknown; probes: MeatProbe[] };

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-grill-card-editor");
  }

  public static getStubConfig(): Partial<GrillCardConfig> {
    return {};
  }

  public setConfig(config: GrillCardConfig): void {
    this._config = { ...(config ?? { type: "custom:ha-grill-card" }) };
    this._cache = undefined;
    this._loadedFor = undefined;
  }

  public connectedCallback(): void {
    super.connectedCallback();
    // Laufende Uhr für Restzeit + Verlauf alle 2 min
    this._interval = window.setInterval(() => { this._loadedFor = undefined; this.requestUpdate(); }, 120_000);
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this._interval);
  }

  public getCardSize(): number {
    return 5;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  private _t(key: string): string {
    return localize(this.hass, `grill.${key}`);
  }

  private _probes(): MeatProbe[] {
    const h = this.hass!;
    if (this._cache && this._cache.key === h.entities) return this._cache.probes;
    const probes = meatProbes(h.states, h.entities, h.devices, this._config?.entities);
    this._cache = { key: h.entities, probes };
    return probes;
  }

  private _num(id?: string): number | undefined {
    const st = id ? this.hass!.states[id] : undefined;
    if (!st || UNAVAILABLE.includes(st.state)) return undefined;
    const n = Number(st.state);
    return Number.isFinite(n) ? n : undefined;
  }

  private _active(p: MeatProbe): boolean {
    return this._num(p.internal) != null;
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || old.locale !== this.hass!.locale || old.entities !== this.hass!.entities) return true;
    return this._probes().some((p) => p.entities.some((id) => old.states[id] !== this.hass!.states[id]));
  }

  protected updated(): void {
    if (!this.hass || this._config?.show_graph === false) return;
    const active = this._probes().filter((p) => this._active(p));
    const key = active.map((p) => p.device).join(",");
    if (!key || this._loadedFor === key) return;
    this._loadedFor = key;
    this._load(active);
  }

  /** Verlauf seit Kochbeginn (höchstens 8 h) für Kern- und Garraumtemperatur */
  private async _load(active: MeatProbe[]): Promise<void> {
    const ids = active.flatMap((p) => [p.internal, p.ambient]).filter((x): x is string => !!x);
    const starts = active.map((p) => this._started(p)).filter((x): x is number => x != null);
    const start = Math.max(Date.now() - 8 * 3_600_000, Math.min(Date.now() - 3_600_000, ...starts));
    try {
      const res = await this.hass!.callWS<Record<string, any[]>>({ type: "history/history_during_period", start_time: new Date(start).toISOString(),
        end_time: new Date().toISOString(), entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false });
      const hist: Record<string, Pts> = {};
      for (const id of ids) hist[id] = (res?.[id] ?? []).map((p) => ({ t: p.lu != null ? p.lu * 1000 : Date.parse(p.last_updated ?? p.last_changed), v: Number(p.s ?? p.state) }))
        .filter((p) => Number.isFinite(p.v) && Number.isFinite(p.t));
      this._hist = hist;
    } catch { /* ohne Verlauf */ }
  }

  /** Zeitpunkt (ms): Zeitstempel-Sensor oder Sekunden ab jetzt (+ = Zukunft) */
  private _when(id: string | undefined, future: boolean): number | undefined {
    const st = id ? this.hass!.states[id] : undefined;
    if (!st || UNAVAILABLE.includes(st.state)) return undefined;
    const ts = Date.parse(st.state);
    if (Number.isFinite(ts) && /\d{4}-\d{2}-\d{2}/.test(st.state)) return ts;
    const n = Number(st.state);
    if (!Number.isFinite(n) || n < 0) return undefined;
    const unit = st.attributes.unit_of_measurement;
    const ms = n * (unit === "min" ? 60_000 : unit === "h" ? 3_600_000 : 1000);
    return future ? Date.now() + ms : Date.now() - ms;
  }

  private _started(p: MeatProbe): number | undefined {
    return this._when(p.elapsed, false);
  }

  private _dur(ms: number): string {
    const m = Math.max(0, Math.round(ms / 60_000));
    return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min` : `${m} min`;
  }

  private _fmt(v: number): string {
    return v.toLocaleString(getLanguage(this.hass), { maximumFractionDigits: v < 100 ? 1 : 0 });
  }

  private _moreInfo(id?: string): void {
    if (id) this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  private _ring(pct: number | undefined, color: string, internal?: number, target?: number) {
    const r = 46, c = 2 * Math.PI * r;
    const p = pct ?? 0;
    return html`<div class="ring">
      <svg viewBox="0 0 110 110" aria-hidden="true">
        <defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ffb74d"></stop><stop offset="1" stop-color=${color}></stop></linearGradient></defs>
        <circle class="track" cx="55" cy="55" r=${r}></circle>
        <circle class="val" cx="55" cy="55" r=${r} stroke="url(#g)" stroke-dasharray=${`${(p / 100) * c} ${c}`}></circle>
      </svg>
      <div class="r-in"><span class="r-v">${internal != null ? this._fmt(internal) : "–"}<small>°</small></span>
        ${target != null ? html`<span class="r-t">${this._t("target")} ${this._fmt(target)}°</span>` : nothing}</div>
    </div>`;
  }

  private _chart(p: MeatProbe, target?: number) {
    const now = Date.now();
    const a = this._hist[p.internal!] ?? [], b = p.ambient ? this._hist[p.ambient] ?? [] : [];
    if (a.length < 2) return nothing;
    const t0 = Math.min(a[0]!.t, b[0]?.t ?? Infinity);
    const vs = [...a, ...b].map((x) => x.v).concat(target != null ? [target] : []);
    const lo = Math.min(0, ...vs), hi = Math.max(...vs) * 1.08 || 1;
    const x = (t: number) => ((t - t0) / Math.max(1, now - t0)) * 300;
    const y = (v: number) => 70 - ((v - lo) / (hi - lo)) * 66;
    const path = (pts: Pts) => pts.map((q, i) => `${i ? "L" : "M"}${x(q.t).toFixed(1)},${y(q.v).toFixed(1)}`).join(" ");
    return html`<svg class="chart" viewBox="0 0 300 72" preserveAspectRatio="none" aria-hidden="true">
      ${target != null ? svg`<line class="tgt" x1="0" x2="300" y1=${y(target)} y2=${y(target)}></line>` : nothing}
      ${b.length > 1 ? svg`<path class="amb" d=${path(b)}></path>` : nothing}
      <path class="int-area" d=${`${path(a)} L${x(a[a.length - 1]!.t).toFixed(1)},72 L${x(a[0]!.t).toFixed(1)},72 Z`}></path>
      <path class="int" d=${path(a)}></path>
    </svg>
    <div class="legend"><span><i class="int"></i>${this._t("internal")}</span>${b.length > 1 ? html`<span><i class="amb"></i>${this._t("ambient")}</span>` : nothing}
      ${target != null ? html`<span><i class="tgt"></i>${this._t("target")}</span>` : nothing}</div>`;
  }

  private _probe(p: MeatProbe) {
    const s = this.hass!.states;
    const lang = getLanguage(this.hass);
    const internal = this._num(p.internal), ambient = this._num(p.ambient), target = this._num(p.target), peak = this._num(p.peak);
    const phase = cookPhase(p.state ? s[p.state]?.state : undefined);
    const color = PHASE_COLOR[phase];
    const pct = cookProgress(internal, target);
    const doneAt = this._when(p.remaining, true);
    const started = this._started(p);
    const cook = p.cook ? s[p.cook]?.state : undefined;
    const cookName = cook && !UNAVAILABLE.includes(cook) && !/^(none|keine?|-)$/i.test(cook) ? cook : undefined;
    const stateText = p.state ? s[p.state]?.state : undefined;
    return html`<div class="probe ${phase}" style="--pc:${color}" data-probe=${p.device}>
      ${phase === "ready" ? html`<div class="banner"><ha-icon icon="mdi:bell-ring"></ha-icon>${this._t("take_out")}</div>` : nothing}
      ${phase === "over" ? html`<div class="banner"><ha-icon icon="mdi:fire-alert"></ha-icon>${this._t("overcooked")}</div>` : nothing}
      <div class="p-main">
        <button class="p-ring" @click=${() => this._moreInfo(p.internal)}>${this._ring(pct, color, internal, target)}</button>
        <div class="p-info">
          <span class="p-name">${cookName ?? p.name}</span>
          ${cookName ? html`<span class="p-sub">${p.name}</span>` : nothing}
          <button class="phase" @click=${() => this._moreInfo(p.state)}>${this._t(`phase_${phase}`)}${stateText && phase === "idle" && !UNAVAILABLE.includes(stateText) ? ` · ${stateText}` : ""}</button>
          ${doneAt != null && doneAt > Date.now() ? html`<span class="p-time" data-left><ha-icon icon="mdi:timer-sand"></ha-icon><span>${this._t("left")} <b>${this._dur(doneAt - Date.now())}</b>
            · ${this._t("ready_at")} ${new Date(doneAt).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })}</span></span>` : nothing}
          ${started != null ? html`<span class="p-time"><ha-icon icon="mdi:clock-outline"></ha-icon><span>${this._t("running")} ${this._dur(Date.now() - started)}</span></span>` : nothing}
          <span class="p-meta">
            ${ambient != null ? html`<button class="m" @click=${() => this._moreInfo(p.ambient)}><ha-icon icon="mdi:fire"></ha-icon>${this._fmt(ambient)}°</button>` : nothing}
            ${peak != null ? html`<button class="m" @click=${() => this._moreInfo(p.peak)}><ha-icon icon="mdi:arrow-collapse-up"></ha-icon>${this._fmt(peak)}°</button>` : nothing}
            ${pct != null ? html`<span class="m"><ha-icon icon="mdi:progress-check"></ha-icon>${pct} %</span>` : nothing}
          </span>
        </div>
      </div>
      ${this._config?.show_graph === false ? nothing : this._chart(p, target)}
    </div>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const probes = this._probes();
    const active = probes.filter((p) => this._active(p));
    const idle = probes.filter((p) => !this._active(p));
    const phases = active.map((p) => cookPhase(p.state ? this.hass!.states[p.state]?.state : undefined));
    const accent = phases.includes("ready") || phases.includes("over") ? "#e53935" : active.length ? "#fb8c00" : "#9e9e9e";
    const sub = !probes.length ? this._t("no_probes") : active.length ? `${active.length} ${this._t(active.length === 1 ? "probe_active" : "probes_active")}` : this._t("all_idle");
    return html`<ha-card class="grill anim-${(c as any).animations ?? "full"} ${active.length ? "hot" : ""}" style="--hcc-accent-c:${accent}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <span class="h-icon"><ha-icon .icon=${active.length ? "mdi:grill" : "mdi:grill-outline"}></ha-icon></span>
        <span class="head-text"><span class="h-title">${c.title ?? this._t("title")}</span><span class="h-sub">${sub}</span></span>
      </div>
      ${active.map((p) => this._probe(p))}
      ${c.hide_idle || !idle.length ? nothing : html`<div class="idle">
        ${idle.map((p) => html`<button class="i-row" data-probe=${p.device} @click=${() => this._moreInfo(p.internal)}>
          <ha-icon icon="mdi:thermometer-probe-off"></ha-icon><span>${p.name}</span><small>${this._t("in_charger")}</small></button>`)}
      </div>`}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.grill { gap: 12px; container-type: inline-size; }
    .header { display: flex; align-items: center; gap: 10px; }
    .h-icon { flex: none; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); }
    .h-icon ha-icon { --mdc-icon-size: 24px; }
    ha-card.hot .h-icon ha-icon { animation: flicker 1.8s ease-in-out infinite; }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .h-title { font-size: 17px; font-weight: 600; line-height: 1.2; }
    .h-sub { font-size: 12.5px; font-weight: 600; color: var(--accent); }
    .probe { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 18px;
      background: linear-gradient(160deg, color-mix(in srgb, var(--pc) 12%, transparent), rgba(127,127,127,0.05) 70%); }
    .banner { display: flex; align-items: center; gap: 6px; padding: 7px 10px; border-radius: 12px; font-size: 13px; font-weight: 700; color: #fff; background: var(--pc);
      animation: blink 1.4s ease-in-out infinite; }
    .banner ha-icon { --mdc-icon-size: 18px; }
    @keyframes blink { 50% { opacity: 0.75; } }
    .p-main { display: flex; align-items: center; gap: 14px; }
    .p-ring { flex: none; padding: 0; border: none; background: none; cursor: pointer; color: inherit; }
    .ring { position: relative; width: 116px; height: 116px; }
    .ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .ring circle { fill: none; stroke-width: 9; stroke-linecap: round; }
    .ring .track { stroke: rgba(127,127,127,0.16); }
    .ring .val { transition: stroke-dasharray 0.8s var(--ease-out); }
    .r-in { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .r-v { font-size: 30px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
    .r-v small { font-size: 16px; font-weight: 700; color: var(--secondary-text-color); }
    .r-t { margin-top: 3px; font-size: 11.5px; font-weight: 600; color: var(--secondary-text-color); }
    .p-info { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 3px; }
    .p-name { max-width: 100%; font-size: 16px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .p-sub { font-size: 11.5px; color: var(--secondary-text-color); margin-top: -2px; }
    .phase { padding: 3px 10px; border: none; border-radius: 999px; cursor: pointer; font-size: 12px; font-weight: 700; color: #fff; background: var(--pc); }
    .p-time { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; color: var(--secondary-text-color); }
    .p-time b { color: var(--primary-text-color); white-space: nowrap; }
    .p-time ha-icon { flex: none; }
    .p-time ha-icon { --mdc-icon-size: 15px; }
    .p-meta { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
    .m { display: inline-flex; align-items: center; gap: 3px; padding: 3px 8px; border: none; border-radius: 999px; cursor: pointer; font-size: 12px; font-weight: 700;
      color: var(--primary-text-color); background: rgba(127,127,127,0.12); }
    .m ha-icon { --mdc-icon-size: 14px; color: var(--pc); }
    @container (max-width: 330px) { .ring { width: 96px; height: 96px; } .r-v { font-size: 25px; } }
    .chart { width: 100%; height: 72px; overflow: visible; }
    .chart .int { fill: none; stroke: var(--pc); stroke-width: 2.4; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
    .chart .int-area { fill: color-mix(in srgb, var(--pc) 14%, transparent); }
    .chart .amb { fill: none; stroke: #ffb74d; stroke-width: 1.6; vector-effect: non-scaling-stroke; opacity: 0.85; }
    .chart .tgt { stroke: #43a047; stroke-width: 1.2; stroke-dasharray: 5 4; vector-effect: non-scaling-stroke; }
    .legend { display: flex; gap: 12px; font-size: 11px; color: var(--secondary-text-color); margin-top: -4px; }
    .legend span { display: inline-flex; align-items: center; gap: 4px; }
    .legend i { width: 12px; height: 3px; border-radius: 2px; }
    .legend i.int { background: var(--pc); } .legend i.amb { background: #ffb74d; } .legend i.tgt { background: #43a047; }
    .idle { display: flex; flex-direction: column; gap: 4px; }
    .i-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: none; border-radius: 12px; cursor: pointer; text-align: left; color: var(--secondary-text-color);
      background: rgba(127,127,127,0.06); font-size: 13px; font-weight: 600; }
    .i-row span { flex: 1; color: var(--primary-text-color); }
    .i-row small { font-size: 11.5px; font-weight: 500; }
    .i-row ha-icon { --mdc-icon-size: 18px; }
    ha-card.anim-reduced *, ha-card.anim-off * { animation: none !important; }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-grill-card": HaGrillCard;
  }
}
