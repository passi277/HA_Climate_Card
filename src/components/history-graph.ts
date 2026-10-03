import { LitElement, css, html, svg, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant } from "../types";
import { ACTION_TO_MODE, MODE_COLORS } from "../const";
import { inferAction } from "../utils";

interface CompressedState { s: string; a?: Record<string, any>; lu: number; }
type HistoryResult = Record<string, CompressedState[]>;

interface Point { t: number; v: number; }
interface Band { from: number; to: number; color: string; }

const REFRESH_MS = 5 * 60 * 1000;
const W = 300;
const H = 80;

/**
 * Mini-Verlaufsgraph: Ist-Temperatur (durchgezogen), Zieltemperatur (gestrichelt)
 * und hvac_action als farbige Hintergrundbänder.
 */
@customElement("hcc-history-graph")
export class HistoryGraph extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property() entity?: string;
  @property() sensor?: string;
  @property({ type: Number }) hours = 24;
  @property() emptyText = "";
  @property() unit = "";

  @state() private _current: Point[] = [];
  @state() private _target: Point[] = [];
  @state() private _bands: Band[] = [];
  @state() private _loaded = false;

  private _timer?: number;
  private _key = "";

  connectedCallback(): void {
    super.connectedCallback();
    this._timer = window.setInterval(() => this._fetch(), REFRESH_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._timer);
  }

  protected updated(changed: PropertyValues): void {
    const key = `${this.entity}|${this.sensor}|${this.hours}`;
    if (this.hass && key !== this._key) {
      this._key = key;
      this._fetch();
    }
    super.updated(changed);
  }

  private async _fetch(): Promise<void> {
    if (!this.hass || !this.entity) return;
    const end = new Date();
    const start = new Date(end.getTime() - this.hours * 3600 * 1000);
    const ids = [this.entity, ...(this.sensor ? [this.sensor] : [])];
    try {
      const res = await this.hass.callWS<HistoryResult>({
        type: "history/history_during_period",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        entity_ids: ids,
        minimal_response: false,
        no_attributes: false,
        significant_changes_only: false,
      });
      this._parse(res, start.getTime(), end.getTime());
    } catch (err) {
      console.warn("ha-climate-card: history fetch failed", err);
    }
    this._loaded = true;
  }

  private _parse(res: HistoryResult, start: number, end: number): void {
    const climate = res[this.entity!] ?? [];
    const current: Point[] = [];
    const target: Point[] = [];
    const bands: Band[] = [];
    let lastAttrs: Record<string, any> = {};

    climate.forEach((st, i) => {
      if (st.a) lastAttrs = st.a;
      const t = Math.max(st.lu * 1000, start);
      const cur = Number(lastAttrs.current_temperature);
      const tgt = Number(lastAttrs.temperature ?? lastAttrs.target_temp_high);
      if (!this.sensor && Number.isFinite(cur)) current.push({ t, v: cur });
      if (Number.isFinite(tgt) && st.s !== "off") target.push({ t, v: tgt });
      else target.push({ t, v: NaN });
      // Geräte ohne hvac_action (z.B. Gree): Tätigkeit aus Modus und Temperaturen ableiten
      const action = (lastAttrs.hvac_action as string | undefined) ?? inferAction(st.s, lastAttrs);
      const mode = ACTION_TO_MODE[action ?? ""];
      if (mode && st.s !== "off") {
        const next = climate[i + 1] ? climate[i + 1].lu * 1000 : end;
        bands.push({ from: t, to: next, color: MODE_COLORS[mode] });
      }
    });

    if (this.sensor) {
      const isClimate = this.sensor.startsWith("climate.");
      let sensorAttrs: Record<string, any> = {};
      for (const st of res[this.sensor] ?? []) {
        if (st.a) sensorAttrs = st.a;
        const v = Number(isClimate ? sensorAttrs.current_temperature : st.s);
        if (Number.isFinite(v)) current.push({ t: Math.max(st.lu * 1000, start), v });
      }
    }
    // Werte bis "jetzt" fortschreiben
    if (current.length) current.push({ t: end, v: current[current.length - 1].v });
    if (target.length) target.push({ t: end, v: target[target.length - 1].v });

    this._current = current;
    this._target = target;
    this._bands = bands;
  }

  private _path(points: Point[], x: (t: number) => number, y: (v: number) => number, stepped: boolean): string {
    let d = "";
    let prev: Point | undefined;
    for (const p of points) {
      if (!Number.isFinite(p.v)) { prev = undefined; continue; }
      if (!prev) d += `M ${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)} `;
      else if (stepped) d += `H ${x(p.t).toFixed(1)} V ${y(p.v).toFixed(1)} `;
      else d += `L ${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)} `;
      prev = p;
    }
    return d;
  }

  protected render() {
    if (!this._loaded) return html`<div class="placeholder"></div>`;
    const values = [...this._current, ...this._target].map((p) => p.v).filter(Number.isFinite);
    if (!values.length) return html`<div class="placeholder empty">${this.emptyText}</div>`;

    const end = Date.now();
    const start = end - this.hours * 3600 * 1000;
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    const minV = lo;
    const maxV = hi;
    if (hi - lo < 2) { const mid = (hi + lo) / 2; lo = mid - 1; hi = mid + 1; }
    const pad = (hi - lo) * 0.15;
    lo -= pad; hi += pad;
    const x = (t: number) => ((t - start) / (end - start)) * W;
    const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
    const last = this._current[this._current.length - 1];
    const pts = this._current.filter((p) => Number.isFinite(p.v));
    const area = pts.length > 1
      ? `${this._path(pts, x, y, false)} L ${x(pts[pts.length - 1].t).toFixed(1)} ${H} L ${x(pts[0].t).toFixed(1)} ${H} Z`
      : "";

    return html`
      <div class="graph">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style="stop-color:var(--hcc-accent, var(--primary-color));stop-opacity:0.35"></stop>
              <stop offset="100%" style="stop-color:var(--hcc-accent, var(--primary-color));stop-opacity:0"></stop>
            </linearGradient>
          </defs>
          ${this._bands.map((b) => svg`<rect x=${x(b.from)} y="0" width=${Math.max(0.5, x(b.to) - x(b.from))}
            height=${H} style="fill:${b.color}" class="band"></rect>`)}
          <path class="target" d=${this._path(this._target, x, y, true)}></path>
          ${area ? svg`<path class="area" d=${area}></path>` : nothing}
          <path class="current" d=${this._path(this._current, x, y, false)}></path>
        </svg>
        ${last && Number.isFinite(last.v) ? html`<span class="dot"
          style="left:${((x(last.t) / W) * 100).toFixed(2)}%;top:${((y(last.v) / H) * 80).toFixed(1)}px"></span>` : nothing}
        <div class="labels">
          <span>-${this.hours}h</span>
          <span>${minV.toFixed(1)}–${maxV.toFixed(1)}${this.unit}</span>
          ${last ? html`<span>${last.v.toFixed(1)}${this.unit}</span>` : nothing}
        </div>
      </div>`;
  }

  static styles = css`
    :host { display: block; }
    .graph { position: relative; animation: fade-in 0.6s ease both; }
    .graph svg { width: 100%; height: 80px; display: block; overflow: visible; }
    .area { fill: url(#areaGrad); stroke: none; }
    .dot { position: absolute; width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 50%;
      background: var(--hcc-accent, var(--primary-color)); box-shadow: 0 0 0 0 var(--hcc-accent, var(--primary-color));
      animation: dot-pulse 2.2s ease-out infinite; animation-play-state: var(--hcc-anim-state, running); }
    @keyframes dot-pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--hcc-accent, var(--primary-color)) 60%, transparent); }
      100% { box-shadow: 0 0 0 10px transparent; } }
    @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .dot, .graph { animation: none; } }
    .band { opacity: 0.14; }
    .current { fill: none; stroke: var(--hcc-accent, var(--primary-color)); stroke-width: 2; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
    .target { fill: none; stroke: var(--secondary-text-color); stroke-width: 1.5; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; opacity: 0.7; }
    .labels { display: flex; justify-content: space-between; font-size: 11px; color: var(--secondary-text-color); margin-top: 4px; }
    .placeholder { height: 80px; border-radius: var(--hcc-inner-radius, 12px); background: rgba(127,127,127,0.08); }
    .placeholder.empty { display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--secondary-text-color); }
  `;
}
