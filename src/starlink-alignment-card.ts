import { LitElement, css, html, nothing, svg, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant, StarlinkAlignmentCardConfig, StarlinkFeatures } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { alignmentLevel, angleDelta, circularStats, compassPoint, normDeg, starlinkFeatures, UNAVAILABLE } from "./utils";
import "./starlink-alignment-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-starlink-alignment-card",
  name: "Modern Starlink Alignment",
  description: "Ausrichtung der Starlink-Schüssel: Kompass mit Ist- und Soll-Richtung, Abweichung mit Drehrichtung, Mittelwert und Schwankung über mehrere Tage, Sichtbehinderungen (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

type Level = "good" | "fair" | "bad" | "unknown";

const LEVEL_COLOR: Record<Level, string> = {
  good: "var(--success-color, #43a047)",
  fair: "#fb8c00",
  bad: "var(--error-color, #e53935)",
  unknown: "#049cdb",
};
const HISTORY_REFRESH_MS = 30 * 60_000;
const RAD = Math.PI / 180;

/** Punkt auf dem Kompass: 0° oben, im Uhrzeigersinn */
const pt = (deg: number, r: number, c = 100): [number, number] => [c + r * Math.sin(deg * RAD), c - r * Math.cos(deg * RAD)];
/** Kreisbogen im Uhrzeigersinn von a nach a + sweep (sweep ≥ 0) */
const arc = (a: number, sweep: number, r: number): string => {
  const [x1, y1] = pt(a, r);
  const [x2, y2] = pt(a + sweep, r);
  return `M${x1.toFixed(2)},${y1.toFixed(2)}A${r},${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
};

@customElement("ha-starlink-alignment-card")
export class HaStarlinkAlignmentCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: StarlinkAlignmentCardConfig;
  @state() private _hist?: { mean: number; spread: number; min: number; max: number; hours: number };
  @state() private _obstructions?: number;
  private _historyKey = "";
  private _historyTimer?: number;
  private _cache?: { key: unknown; s: Record<string, string | undefined> };

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-starlink-alignment-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<StarlinkAlignmentCardConfig> {
    const ents = Object.values(hass.entities ?? {});
    const az = ents.find((e) => e.platform === "starlink" && (e.translation_key === "azimuth" || /azimut/.test(e.entity_id)))
      ?? ents.find((e) => e.platform === "starlink");
    const desired = Object.keys(hass.states).find((id) => id.startsWith("input_number.") && /starlink/.test(id) && /azimut/.test(id));
    return { entity: az?.entity_id ?? "", ...(desired ? { desired_azimuth: desired } : {}) };
  }

  public setConfig(config: StarlinkAlignmentCardConfig): void {
    if (!config?.entity) throw new Error("ha-starlink-alignment-card: 'entity' (Starlink) angeben");
    this._config = { ...config };
    this._historyKey = "";
  }

  public getCardSize(): number {
    return 6;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._historyTimer = window.setInterval(() => this._loadHistory(true), HISTORY_REFRESH_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._historyTimer);
    this._historyKey = "";
  }

  private _t(key: string): string {
    return localize(this.hass, `starlink_align.${key}`);
  }

  // ---------- Entitäten ----------

  private _features(): StarlinkFeatures {
    const hass = this.hass!;
    const c = this._config!;
    if (!this._cache || this._cache.key !== hass.entities) {
      this._cache = { key: hass.entities, s: starlinkFeatures(hass.states, hass.entities, c.entity) };
    }
    const s = { ...this._cache.s } as StarlinkFeatures;
    if (c.azimuth) s.azimuth = c.azimuth;
    if (c.elevation) s.elevation = c.elevation;
    // Ohne Gerät: die angegebene Entität als Azimut nutzen
    if (!s.azimuth && c.entity.startsWith("sensor.")) s.azimuth = c.entity;
    return s;
  }

  private _ids(): string[] {
    const s = this._features();
    const c = this._config!;
    return [s.azimuth, s.elevation, s.obstructed, s.online,
      typeof c.desired_azimuth === "string" ? c.desired_azimuth : undefined,
      typeof c.desired_elevation === "string" ? c.desired_elevation : undefined].filter(Boolean) as string[];
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
    const v = Number(this._st(id)?.state);
    return this._st(id) && Number.isFinite(v) ? v : undefined;
  }

  /** Sollwert: Zahl aus der Konfiguration oder Zustand einer Entität */
  private _desired(v?: number | string): number | undefined {
    if (v == null || v === "") return undefined;
    if (typeof v === "number") return v;
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    return this._num(v);
  }

  private _fmt(v: number, digits = 0): string {
    return v.toLocaleString(getLanguage(this.hass), { maximumFractionDigits: digits });
  }

  // ---------- Aktionen ----------

  private _moreInfo(id?: string): void {
    if (!id) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  private async _step(id: string, delta: number): Promise<void> {
    const st = this.hass!.states[id];
    const cur = Number(st?.state);
    if (!st || !Number.isFinite(cur)) return this._moreInfo(id);
    const domain = id.split(".")[0]!;
    if (domain !== "input_number" && domain !== "number") return this._moreInfo(id);
    const min = Number(st.attributes.min ?? 0);
    const max = Number(st.attributes.max ?? 359);
    let next = cur + delta;
    // Azimut läuft über Norden weiter
    if (next > max) next = min;
    if (next < min) next = max;
    window.dispatchEvent(new CustomEvent("haptic", { detail: "selection" }));
    try {
      await this.hass!.callService(domain, "set_value", { entity_id: id, value: next });
    } catch (err: any) {
      this.dispatchEvent(new CustomEvent("hass-notification", {
        detail: { message: `${localize(this.hass, "card.error")}: ${err?.message ?? err}` }, bubbles: true, composed: true,
      }));
    }
  }

  // ---------- Verlauf ----------

  private async _loadHistory(force = false): Promise<void> {
    const c = this._config;
    if (!c || !this.hass?.callWS || c.show?.stats === false) return;
    const s = this._features();
    if (!s.azimuth) return;
    const days = Math.max(1, c.history_days ?? 7);
    const hour = Math.floor(Date.now() / 3600_000);
    const key = `${s.azimuth}|${s.obstructed ?? ""}|${days}|${hour}`;
    if (!force && key === this._historyKey) return;
    this._historyKey = key;
    const start = new Date(Date.now() - days * 86400_000).toISOString();
    try {
      const stats = await this.hass.callWS<Record<string, { mean?: number | null }[]>>({
        type: "recorder/statistics_during_period", start_time: start, statistic_ids: [s.azimuth], period: "hour", types: ["mean"],
      });
      // 0° nach einem Neustart ist kein echter Messwert
      const means = (stats?.[s.azimuth] ?? []).map((r) => Number(r.mean)).filter((v) => Number.isFinite(v) && v > 0);
      const cs = circularStats(means);
      this._hist = cs ? { ...cs, hours: means.length } : undefined;
    } catch {
      this._hist = undefined;
    }
    if (s.obstructed) {
      try {
        const res = await this.hass.callWS<Record<string, { s?: string }[]>>({
          type: "history/history_during_period", start_time: start, end_time: new Date().toISOString(),
          entity_ids: [s.obstructed], minimal_response: true, no_attributes: true,
        });
        const pts = res?.[s.obstructed] ?? [];
        this._obstructions = pts.filter((p, i) => p.s === "on" && (i === 0 || pts[i - 1]!.s !== "on")).length;
      } catch {
        this._obstructions = undefined;
      }
    }
  }

  // ---------- Darstellung ----------

  private _compass(actual: number | undefined, desired: number | undefined, level: Level) {
    const c = this._config!;
    const tol = c.tolerance ?? 5;
    const lang = getLanguage(this.hass);
    const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
    const labels: [number, string][] = [0, 90, 180, 270].map((d) => [d, compassPoint(d, lang)]);
    const delta = actual != null && desired != null ? angleDelta(desired, actual) : undefined;
    const h = this._hist;
    return html`<svg class="compass" viewBox="0 0 200 200" role="img" aria-label=${this._t("compass")}>
      ${svg`<circle class="c-face" cx="100" cy="100" r="92"></circle>`}
      ${ticks.map((d) => {
        const major = d % 90 === 0;
        const mid = d % 30 === 0;
        const [x1, y1] = pt(d, 92);
        const [x2, y2] = pt(d, major ? 80 : mid ? 84 : 88);
        return svg`<line class="tick ${major ? "major" : mid ? "mid" : ""}" x1=${x1} y1=${y1} x2=${x2} y2=${y2}></line>`;
      })}
      ${labels.filter(([d]) => actual == null || Math.abs(angleDelta(d, actual)) > 14).map(([d, l]) => {
        const [x, y] = pt(d, 66);
        return svg`<text class="c-lbl ${d === 0 ? "north" : ""}" x=${x} y=${y}>${l}</text>`;
      })}
      ${desired != null ? svg`<path class="tol" d=${arc(normDeg(desired - tol), Math.min(360, tol * 2), 86)}></path>` : nothing}
      ${h && h.hours > 1 && h.spread >= 0.5 ? svg`<path class="spread" d=${arc(normDeg(h.mean - Math.min(h.spread * 2, 90)), Math.min(h.spread * 4, 180), 54)}></path>` : nothing}
      ${delta != null && Math.abs(delta) >= 1 ? svg`<path class="dev" d=${arc(delta > 0 ? actual! : desired!, Math.abs(delta), 54)}></path>` : nothing}
      ${desired != null ? (() => {
        const [tx, ty] = pt(desired, 99);
        const [lx, ly] = pt(desired - 5, 86);
        const [rx, ry] = pt(desired + 5, 86);
        return svg`<path class="target" d="M${tx},${ty}L${lx},${ly}L${rx},${ry}Z"></path>`;
      })() : nothing}
      ${actual != null ? (() => {
        const [x, y] = pt(actual, 74);
        const [bx, by] = pt(actual + 180, 14);
        return svg`<g class="needle ${level}">
          <line class="n-line" x1=${bx} y1=${by} x2=${x} y2=${y}></line>
          <circle class="n-tip" cx=${x} cy=${y} r="8"></circle>
          <circle class="n-hub" cx="100" cy="100" r="5"></circle></g>`;
      })() : nothing}
      ${actual != null ? svg`<text class="c-val" x="100" y="128">${this._fmt(actual)}°</text>
        <text class="c-sub" x="100" y="144">${compassPoint(actual, lang)}</text>` : nothing}
    </svg>`;
  }

  private _tile(key: string, value: string, sub: string, id?: string, cls = "", stepId?: string) {
    return html`<div class="tile ${cls}" data-key=${key}>
      <button class="t-main" @click=${() => this._moreInfo(id)} ?disabled=${!id}>
        <small>${this._t(key)}</small><b>${value}</b>${sub ? html`<span class="t-sub">${sub}</span>` : nothing}
      </button>
      ${stepId ? html`<div class="steps">
        <button class="step" aria-label="−1°" @click=${() => this._step(stepId, -1)}><ha-icon icon="mdi:minus"></ha-icon></button>
        <button class="step" aria-label="+1°" @click=${() => this._step(stepId, 1)}><ha-icon icon="mdi:plus"></ha-icon></button></div>` : nothing}
    </div>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    if (!this.hass.states[c.entity]) {
      return html`<ha-card class="align"><div class="missing">${this._t("missing")}: ${c.entity}</div></ha-card>`;
    }
    const lang = getLanguage(this.hass);
    const show = { compass: true, stats: true, tip: true, ...c.show };
    const s = this._features();
    const actual = this._num(s.azimuth);
    const desired = this._desired(c.desired_azimuth);
    const desiredId = typeof c.desired_azimuth === "string" && !/^-?\d/.test(c.desired_azimuth) ? c.desired_azimuth : undefined;
    const delta = actual != null && desired != null ? angleDelta(desired, actual) : undefined;
    const tol = c.tolerance ?? 5;
    const warn = Math.max(c.warn ?? 15, tol);
    const level: Level = delta == null ? "unknown" : alignmentLevel(Math.abs(delta), tol, warn);
    const color = LEVEL_COLOR[level];
    const elev = this._num(s.elevation);
    const elevDesired = this._desired(c.desired_elevation);
    const elevDelta = elev != null && elevDesired != null ? elevDesired - elev : undefined;
    const elevDesiredId = typeof c.desired_elevation === "string" && !/^-?\d/.test(c.desired_elevation) ? c.desired_elevation : undefined;
    const title = c.name ?? this._t("title");
    const sub = actual == null ? this._t("no_azimuth")
      : delta == null ? this._t("no_desired")
      : `${this._t(`level_${level}`)}${level !== "good" ? ` · ${this._fmt(Math.abs(delta))}°` : ""}`;
    const h = this._hist;
    const days = c.history_days ?? 7;
    const turn = delta == null || level === "good" ? "" : this._t(delta > 0 ? "turn_cw" : "turn_ccw").replace("{n}", this._fmt(Math.abs(delta)));
    const drift = h && actual != null ? Math.abs(angleDelta(actual, h.mean)) : undefined;

    return html`<ha-card class="align anim-${c.animations ?? "full"} ${level}" style="--hcc-accent-c:${color}; --lc:${color}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <button class="h-icon" @click=${() => this._moreInfo(s.azimuth)} aria-label=${title}><ha-icon icon="mdi:compass-rose"></ha-icon></button>
        <button class="head-text" @click=${() => this._moreInfo(s.azimuth)}>
          <span class="h-title">${title}</span>
          <span class="h-sub">${sub}</span>
        </button>
        ${this._on(s.obstructed) ? html`<button class="pill warn" @click=${() => this._moreInfo(s.obstructed)}><ha-icon icon="mdi:tree-outline"></ha-icon>${this._t("obstructed_now")}</button>` : nothing}
      </div>

      ${show.compass ? html`<div class="dial">${this._compass(actual, desired, level)}
        <div class="legend">
          <span class="lg-ist">${this._t("actual")}</span>
          ${desired != null ? html`<span class="lg-soll">${this._t("desired")} ± ${this._fmt(tol)}°</span>` : nothing}
          ${h && h.hours > 1 && h.spread >= 0.5 ? html`<span class="lg-spread">${this._t("spread_legend").replace("{n}", String(days))}</span>` : nothing}
        </div></div>` : nothing}

      ${turn && show.tip ? html`<div class="turn ${level}"><ha-icon .icon=${delta! > 0 ? "mdi:rotate-right" : "mdi:rotate-left"}></ha-icon><span>${turn}</span></div>` : nothing}
      ${delta == null && actual != null && show.tip ? html`<div class="turn unknown"><ha-icon icon="mdi:information-outline"></ha-icon>
        <span>${this._t("how_desired")}</span></div>` : nothing}

      ${show.stats ? html`<div class="tiles">
        ${this._tile("deviation", delta != null ? `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${this._fmt(Math.abs(delta))}°` : "–",
          delta != null ? this._t(`level_${level}`) : this._t("no_desired_short"), s.azimuth, `lv-${level}`)}
        ${this._tile("actual", actual != null ? `${this._fmt(actual)}°` : "–", actual != null ? compassPoint(actual, lang) : "", s.azimuth)}
        ${this._tile("desired", desired != null ? `${this._fmt(desired)}°` : "–", desired != null ? compassPoint(desired, lang) : this._t("not_set"), desiredId, "", desiredId)}
        ${this._tile("mean", h ? `${this._fmt(h.mean, 1)}°` : "–", h ? this._t("days").replace("{n}", String(days)) : this._t("loading"), s.azimuth)}
        ${this._tile("spread", h ? `± ${this._fmt(h.spread, 1)}°` : "–",
          h ? `${this._fmt(h.min)}–${this._fmt(h.max)}°${drift != null && drift > Math.max(3, h.spread * 3) ? ` · ${this._t("moved")}` : ""}` : "", s.azimuth,
          h && drift != null && drift > Math.max(3, h.spread * 3) ? "lv-fair" : "")}
        ${s.obstructed ? this._tile("obstructions", this._obstructions != null ? `${this._obstructions}×` : "–", this._t("days").replace("{n}", String(days)), s.obstructed,
          (this._obstructions ?? 0) > days * 3 ? "lv-fair" : "") : nothing}
        ${elev != null ? this._tile("elevation", `${this._fmt(elev, 1)}°`, elevDelta != null ? `${this._t("desired")} ${this._fmt(elevDesired!, 1)}° (${elevDelta > 0 ? "+" : "−"}${this._fmt(Math.abs(elevDelta), 1)}°)` : "",
          s.elevation, elevDelta != null ? `lv-${alignmentLevel(Math.abs(elevDelta), tol, warn)}` : "", elevDesiredId) : nothing}
      </div>` : nothing}
    </ha-card>`;
  }

  private _on(id?: string): boolean {
    return this._st(id)?.state === "on";
  }

  static styles = [cardStyles, css`
    ha-card.align { --accent: var(--lc); gap: 12px; container-type: inline-size; }
    .missing { padding: 8px; color: var(--error-color, #e53935); }
    .header { display: flex; align-items: center; gap: 10px; }
    .h-icon { flex: none; width: 42px; height: 42px; border-radius: 50%; border: none; padding: 0; display: grid; place-items: center; cursor: pointer;
      color: var(--lc); background: color-mix(in srgb, var(--lc) 16%, transparent); transition: background 0.4s, color 0.4s; }
    .h-icon ha-icon { --mdc-icon-size: 24px; }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; border: none; background: none; padding: 0; text-align: left; cursor: pointer; }
    .h-title { font-size: 17px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .h-sub { font-size: 13px; font-weight: 600; color: var(--lc); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pill { flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px 6px 7px; border: none; border-radius: 999px; cursor: pointer;
      font-size: 12.5px; font-weight: 700; white-space: nowrap; }
    .pill ha-icon { --mdc-icon-size: 16px; }
    .pill.warn { color: #fb8c00; background: color-mix(in srgb, #fb8c00 14%, transparent); }

    /* Kompass */
    .dial { display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .compass { width: min(100%, 260px); height: auto; display: block; overflow: visible; }
    .c-face { fill: rgba(127,127,127,0.06); stroke: rgba(127,127,127,0.25); stroke-width: 1; }
    .tick { stroke: rgba(127,127,127,0.35); stroke-width: 1; }
    .tick.mid { stroke: rgba(127,127,127,0.55); stroke-width: 1.4; }
    .tick.major { stroke: var(--primary-text-color); stroke-width: 2; }
    .c-lbl { font-size: 13px; font-weight: 700; fill: var(--secondary-text-color); text-anchor: middle; dominant-baseline: central; }
    .c-lbl.north { fill: var(--error-color, #e53935); }
    .tol { fill: none; stroke: var(--success-color, #43a047); stroke-width: 10; stroke-opacity: 0.35; stroke-linecap: round; }
    .spread { fill: none; stroke: #049cdb; stroke-width: 6; stroke-opacity: 0.35; stroke-linecap: round; }
    .dev { fill: none; stroke: var(--lc); stroke-width: 3; stroke-dasharray: 4 4; stroke-linecap: round; }
    ha-card.anim-full .dev { animation: march 1.2s linear infinite; }
    @keyframes march { to { stroke-dashoffset: -16; } }
    .target { fill: var(--success-color, #43a047); }
    .needle { transition: transform 0.6s var(--ease-spring); }
    .n-line { stroke: var(--lc); stroke-width: 3.5; stroke-linecap: round; }
    .n-tip { fill: var(--lc); stroke: var(--card-background-color, #fff); stroke-width: 2; }
    .n-hub { fill: var(--primary-text-color); }
    .c-val { font-size: 20px; font-weight: 700; fill: var(--primary-text-color); text-anchor: middle; }
    .c-sub { font-size: 12px; font-weight: 600; fill: var(--secondary-text-color); text-anchor: middle; }
    .legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 14px; font-size: 11.5px; color: var(--secondary-text-color); }
    .legend span::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 5px; vertical-align: -1px; }
    .lg-ist::before { background: var(--lc); }
    .lg-soll::before { background: var(--success-color, #43a047); }
    .lg-spread::before { background: color-mix(in srgb, #049cdb 50%, transparent); }

    /* Hinweis Drehrichtung */
    .turn { --tc: var(--lc); display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--hcc-inner-radius, 14px);
      font-size: 13.5px; font-weight: 600; line-height: 1.35; color: var(--tc); background: color-mix(in srgb, var(--tc) 12%, transparent); }
    .turn.unknown { --tc: var(--secondary-text-color); font-weight: 500; }
    .turn ha-icon { --mdc-icon-size: 22px; flex: none; }

    /* Kacheln */
    .tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    @container (max-width: 380px) { .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .tile { --qc: var(--primary-text-color); display: flex; flex-direction: column; min-width: 0; border-radius: var(--hcc-inner-radius, 14px); background: rgba(127,127,127,0.08); overflow: hidden; }
    .t-main { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; min-width: 0; padding: 10px; border: none; background: none; cursor: pointer; text-align: left; flex: 1; }
    .t-main[disabled] { cursor: default; }
    .t-main small { font-size: 11.5px; font-weight: 600; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .t-main b { font-size: clamp(17px, 5.5cqi, 22px); color: var(--qc); white-space: nowrap; }
    .t-sub { font-size: 11.5px; color: var(--secondary-text-color); max-width: 100%; overflow-wrap: anywhere; line-height: 1.25; }
    .lv-good { --qc: var(--success-color, #43a047); }
    .lv-fair { --qc: #fb8c00; }
    .lv-bad { --qc: var(--error-color, #e53935); }
    .lv-unknown { --qc: var(--secondary-text-color); }
    .steps { display: flex; border-top: 1px solid rgba(127,127,127,0.15); }
    .step { flex: 1; display: grid; place-items: center; padding: 5px 0; border: none; background: none; cursor: pointer; color: var(--secondary-text-color); }
    .step + .step { border-left: 1px solid rgba(127,127,127,0.15); }
    .step:active { background: rgba(127,127,127,0.15); }
    .step ha-icon { --mdc-icon-size: 18px; }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-starlink-alignment-card": HaStarlinkAlignmentCard;
  }
}
