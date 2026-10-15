import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { parseSchedule, type ScheduleSegment } from "../utils";

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (mins: number) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;

/**
 * Wochenprogramm eines Thermostats (Homematic `schedule_data`) als Tagesleiste:
 * Zeitfenster farbig nach Temperatur, aktuelle Uhrzeit markiert, Wochentag umschaltbar.
 */
@customElement("hcc-schedule-timeline")
export class ScheduleTimeline extends LitElement {
  @property({ attribute: false }) attrs: Record<string, any> = {};
  @property() lang = "de";
  @property() unit = "°C";
  @property() label = "";
  @property() profile?: string;
  @property({ type: Boolean }) active = true;

  @state() private _day = new Date().getDay();
  @state() private _now = Date.now();
  private _tick?: number;

  connectedCallback(): void {
    super.connectedCallback();
    this._tick = window.setInterval(() => (this._now = Date.now()), 60_000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._tick);
  }

  private _dayName(weekday: number): string {
    // 2023-01-01 war ein Sonntag
    return new Date(2023, 0, 1 + weekday).toLocaleDateString(this.lang, { weekday: "short" }).replace(".", "");
  }

  /** Farbe je Temperatur: niedrig kühl, hoch warm – relativ zur Spanne der Woche. */
  private _color(temp: number, lo: number, hi: number): string {
    const pct = hi > lo ? Math.round(((temp - lo) / (hi - lo)) * 100) : 100;
    return `color-mix(in srgb, var(--state-climate-heat-color, #ff6d00) ${pct}%, var(--state-climate-cool-color, #2196f3))`;
  }

  protected render() {
    const week = [0, 1, 2, 3, 4, 5, 6].map((d) => parseSchedule(this.attrs, d) ?? []);
    const temps = week.flat().map((s) => s.temp);
    if (!temps.length) return nothing;
    const lo = Math.min(...temps);
    const hi = Math.max(...temps);
    const segs: ScheduleSegment[] = week[this._day];
    const now = new Date(this._now);
    const today = now.getDay();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const order = [1, 2, 3, 4, 5, 6, 0]; // Montag zuerst
    return html`
      <div class="head">
        <span class="title"><ha-icon icon="mdi:calendar-clock"></ha-icon>${this.label}</span>
        ${this.profile ? html`<span class="profile">${this.profile}</span>` : nothing}
      </div>
      <div class="days" role="tablist">
        ${order.map((d) => html`<button role="tab" aria-selected=${d === this._day}
          class="day ${d === this._day ? "on" : ""} ${d === today ? "today" : ""}" @click=${() => (this._day = d)}>${this._dayName(d)}</button>`)}
      </div>
      <div class="bar ${this.active ? "" : "inactive"}">
        ${segs.map((s) => html`<div class="seg" style="left:${(s.start / 1440) * 100}%;width:${((s.end - s.start) / 1440) * 100}%;
          --seg:${this._color(s.temp, lo, hi)}" title="${fmt(s.start)}–${fmt(s.end)}: ${s.temp}${this.unit}">
          ${s.end - s.start >= 150 ? html`<span>${s.temp}°</span>` : nothing}
        </div>`)}
        ${this._day === today ? html`<div class="now" style="left:${(nowMins / 1440) * 100}%"></div>` : nothing}
      </div>
      <div class="hours"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>`;
  }

  static styles = css`
    :host { display: block; }
    .head { display: flex; align-items: center; justify-content: space-between; margin: 0 2px 8px; }
    .title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: var(--secondary-text-color);
      text-transform: uppercase; letter-spacing: 0.04em; }
    .title ha-icon { --mdc-icon-size: 16px; }
    .profile { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px;
      background: rgba(127,127,127,0.15); color: var(--secondary-text-color); }
    .days { display: flex; gap: 4px; margin-bottom: 8px; }
    .day { flex: 1; border: none; border-radius: 999px; padding: 5px 0; font: inherit; font-size: 12px; cursor: pointer;
      background: rgba(127,127,127,0.1); color: var(--secondary-text-color); transition: background 0.2s, color 0.2s; }
    .day.today { font-weight: 700; color: var(--primary-text-color); }
    .day.on { background: var(--hcc-accent, var(--primary-color)); color: var(--text-primary-color, #fff); }
    .bar { position: relative; height: 30px; border-radius: 10px; overflow: hidden; background: rgba(127,127,127,0.12); }
    .bar.inactive { opacity: 0.5; }
    .seg { position: absolute; top: 0; bottom: 0; display: flex; align-items: center; justify-content: center;
      background: color-mix(in srgb, var(--seg) 70%, transparent); box-shadow: inset -1px 0 0 rgba(0,0,0,0.12);
      font-size: 11px; font-weight: 600; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.35); }
    .now { position: absolute; top: -2px; bottom: -2px; width: 3px; margin-left: -1.5px; border-radius: 2px;
      background: var(--primary-text-color); box-shadow: 0 0 0 2px var(--card-background-color, #fff); }
    .hours { display: flex; justify-content: space-between; margin-top: 4px; font-size: 10px; color: var(--secondary-text-color); }
  `;
}
