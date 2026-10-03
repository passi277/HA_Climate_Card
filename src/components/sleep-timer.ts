import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant } from "../types";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Sleeptimer-Zeile für das klassische Helfer-Muster: ein Schalter (input_boolean/switch) schaltet
 * den Timer scharf, ein input_datetime legt die Ausschaltzeit fest. Die eigentliche Abschaltung
 * erledigt eine Automation (siehe Blueprint im Repository).
 */
@customElement("hcc-sleep-timer")
export class SleepTimer extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property() switchEntity?: string;
  @property() timeEntity?: string;
  @property() label = "Sleeptimer";
  @property() offText = "Off";
  @property() atText = "Off at";
  @property() inText = "in";

  @state() private _now = Date.now();
  private _tick?: number;

  connectedCallback(): void {
    super.connectedCallback();
    this._tick = window.setInterval(() => (this._now = Date.now()), 30_000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._tick);
  }

  private get _switch(): HassEntity | undefined {
    return this.switchEntity ? this.hass?.states[this.switchEntity] : undefined;
  }

  private get _time(): HassEntity | undefined {
    return this.timeEntity ? this.hass?.states[this.timeEntity] : undefined;
  }

  /** Nächster Ausschaltzeitpunkt (heute oder morgen bzw. fester Zeitpunkt bei Datum+Zeit). */
  private _nextOff(): Date | undefined {
    const t = this._time;
    if (!t) return undefined;
    const a = t.attributes;
    if (a.has_date && a.timestamp) return new Date(a.timestamp * 1000);
    if (a.hour == null || a.minute == null) return undefined;
    const d = new Date(this._now);
    d.setHours(a.hour, a.minute, a.second ?? 0, 0);
    if (d.getTime() <= this._now) d.setDate(d.getDate() + 1);
    return d;
  }

  private _timeValue(): string {
    const a = this._time?.attributes;
    return a?.hour != null ? `${pad(a.hour)}:${pad(a.minute ?? 0)}` : "";
  }

  private _remaining(target: Date): string {
    const mins = Math.max(0, Math.round((target.getTime() - this._now) / 60000));
    const h = Math.floor(mins / 60);
    return h ? `${h}:${pad(mins % 60)} h` : `${mins} min`;
  }

  private _toggle(): void {
    const sw = this._switch;
    if (!sw || !this.hass) return;
    this.hass.callService("homeassistant", sw.state === "on" ? "turn_off" : "turn_on", { entity_id: sw.entity_id });
  }

  private _setTime(ev: Event): void {
    const value = (ev.target as HTMLInputElement).value;
    const t = this._time;
    if (!value || !t || !this.hass) return;
    const data: Record<string, unknown> = { entity_id: t.entity_id };
    if (t.attributes.has_date) {
      const [h, m] = value.split(":").map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
      data.datetime = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(h)}:${pad(m)}:00`;
    } else {
      data.time = `${value}:00`;
    }
    this.hass.callService("input_datetime", "set_datetime", data);
  }

  private _moreInfo(entityId?: string): void {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || (!this._switch && !this._time)) return nothing;
    const armed = this._switch ? this._switch.state === "on" : true;
    const next = this._nextOff();
    const input = this._time
      ? html`<input class="time" type="time" .value=${this._timeValue()} aria-label=${this.label} @change=${this._setTime} />`
      : nothing;
    return html`<div class="timer ${armed ? "armed" : ""}">
      <button class="badge" @click=${() => this._moreInfo(this.switchEntity ?? this.timeEntity)} aria-label=${this.label}>
        <ha-icon icon=${armed ? "mdi:sleep" : "mdi:sleep-off"}></ha-icon>
      </button>
      <div class="text">
        <span class="label">${this.label}</span>
        <span class="status">
          ${armed ? html`${this.atText} ${input}${next ? html`<span class="remaining">· ${this.inText} ${this._remaining(next)}</span>` : nothing}`
                  : html`${this.offText}${this._time ? html` · ${input}` : nothing}`}
        </span>
      </div>
      ${this._switch ? html`<button class="switch ${armed ? "on" : ""}" role="switch" aria-checked=${armed}
        aria-label=${this.label} @click=${this._toggle}><span class="thumb"></span></button>` : nothing}
    </div>`;
  }

  static styles = css`
    .timer {
      display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 14px;
      background: var(--hcc-chip-bg, rgba(127,127,127,0.12)); transition: background 0.3s;
      --timer-color: var(--hcc-timer-color, #7e57c2);
    }
    .timer.armed { background: color-mix(in srgb, var(--timer-color) 16%, transparent); }
    .badge { border: none; padding: 0; cursor: pointer; flex: none; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      background: rgba(127,127,127,0.15); color: var(--secondary-text-color); }
    .armed .badge { background: var(--timer-color); color: #fff; }
    .badge ha-icon { --mdc-icon-size: 20px; }
    .text { display: flex; flex-direction: column; min-width: 0; flex: 1; gap: 2px; }
    .label { font-size: 14px; font-weight: 600; color: var(--primary-text-color); }
    .status { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; font-size: 12px; color: var(--secondary-text-color); }
    .remaining { white-space: nowrap; }
    .time {
      font: inherit; font-size: 13px; font-weight: 600; color: var(--primary-text-color); cursor: pointer;
      background: var(--card-background-color, #fff); border: 1px solid var(--divider-color, rgba(127,127,127,0.3));
      border-radius: 8px; padding: 1px 4px; color-scheme: light dark;
    }
    .time::-webkit-calendar-picker-indicator { display: none; }
    .time:focus-visible { outline: 2px solid var(--timer-color); outline-offset: 1px; }
    .switch { flex: none; position: relative; width: 44px; height: 26px; border-radius: 13px; border: none; cursor: pointer;
      background: rgba(127,127,127,0.35); transition: background 0.2s; padding: 0; }
    .switch.on { background: var(--timer-color); }
    .thumb { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff;
      box-shadow: 0 1px 2px rgba(0,0,0,0.3); transition: transform 0.2s; }
    .switch.on .thumb { transform: translateX(18px); }
    .switch:focus-visible { outline: 2px solid var(--timer-color); outline-offset: 2px; }
  `;
}
