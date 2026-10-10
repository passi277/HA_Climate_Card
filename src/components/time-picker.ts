import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

export const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Stunden-/Minuten-Auswahl mit −/+ (gedrückt halten wiederholt). Bewusst kein <input type="time">,
 * das in der HA-App nicht überall bedienbar ist. Optional ein Tag-Schalter (‹ Datum ›).
 * Feuert `time-changed` mit `{ minutes }` bzw. `date-changed` mit `{ days }` (Verschiebung in Tagen).
 */
@customElement("hcc-time-picker")
export class TimePicker extends LitElement {
  /** Minuten seit Mitternacht */
  @property({ type: Number }) minutes = 0;
  @property({ type: Number }) minuteStep = 5;
  @property() hourText = "Hour";
  @property() minuteText = "Minute";
  /** Datum anzeigen (z.B. „Sa., 04.10.“) – leer = kein Datum */
  @property() dateText = "";
  @property() dateLabel = "";
  /** Nur Datum (input_datetime ohne Uhrzeit) */
  @property({ type: Boolean }) timeHidden = false;
  private _holdDelay?: number;
  private _holdRepeat?: number;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._holdEnd();
  }

  private _emit(minutes: number): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: "selection" }));
    // sofort übernehmen, damit schnelles Tippen/Halten auf dem neuen Wert weiterzählt
    this.minutes = ((Math.round(minutes) % 1440) + 1440) % 1440;
    this.dispatchEvent(new CustomEvent("time-changed", { detail: { minutes: this.minutes } }));
  }

  private _shiftDay(days: number): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: "selection" }));
    this.dispatchEvent(new CustomEvent("date-changed", { detail: { days } }));
  }

  private _holdStart(ev: PointerEvent, fn: () => void): void {
    if (ev.button !== 0) return;
    this._holdEnd();
    fn();
    this._holdDelay = window.setTimeout(() => (this._holdRepeat = window.setInterval(fn, 120)), 420);
  }

  private _holdEnd = (): void => {
    clearTimeout(this._holdDelay);
    clearInterval(this._holdRepeat);
  };

  private _step(label: string, icon: string, fn: () => void) {
    return html`<button class="step" aria-label=${label}
      @pointerdown=${(e: PointerEvent) => this._holdStart(e, fn)} @pointerup=${this._holdEnd}
      @pointerleave=${this._holdEnd} @pointercancel=${this._holdEnd} @contextmenu=${(e: Event) => e.preventDefault()}
      @click=${(e: MouseEvent) => { if (e.detail === 0) fn(); }}><ha-icon icon=${icon}></ha-icon></button>`;
  }

  protected render() {
    const h = Math.floor(this.minutes / 60);
    const m = this.minutes % 60;
    const s = Math.max(1, this.minuteStep);
    return html`
      ${this.dateText ? html`<div class="picker date">
        <span class="picker-label">${this.dateLabel}</span>
        <div class="picker-row">
          ${this._step(`${this.dateLabel} -`, "mdi:chevron-left", () => this._shiftDay(-1))}
          <span class="picker-value small">${this.dateText}</span>
          ${this._step(`${this.dateLabel} +`, "mdi:chevron-right", () => this._shiftDay(1))}
        </div>
      </div>` : nothing}
      ${this.timeHidden ? nothing : html`<div class="pickers">
        <div class="picker">
          <span class="picker-label">${this.hourText}</span>
          <div class="picker-row">
            ${this._step(`${this.hourText} -`, "mdi:minus", () => this._emit(this.minutes - 60))}
            <span class="picker-value">${pad(h)}</span>
            ${this._step(`${this.hourText} +`, "mdi:plus", () => this._emit(this.minutes + 60))}
          </div>
        </div>
        <span class="colon">:</span>
        <div class="picker">
          <span class="picker-label">${this.minuteText}</span>
          <div class="picker-row">
            ${this._step(`${this.minuteText} -`, "mdi:minus", () => this._emit(Math.ceil(this.minutes / s) * s - s))}
            <span class="picker-value">${pad(m)}</span>
            ${this._step(`${this.minuteText} +`, "mdi:plus", () => this._emit(Math.floor(this.minutes / s) * s + s))}
          </div>
        </div>
      </div>`}`;
  }

  static styles = css`
    :host { display: flex; flex-direction: column; align-items: center; gap: 10px; --tp-color: var(--hcc-timer-color, var(--hcc-accent, #7e57c2)); }
    .pickers { display: flex; align-items: flex-end; justify-content: center; gap: 8px; }
    .picker { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .picker-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--secondary-text-color); }
    .picker-row { display: flex; align-items: center; gap: 4px; padding: 3px; border-radius: 999px; background: var(--card-background-color, #fff); }
    .picker-value { min-width: 42px; text-align: center; font-size: 26px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--primary-text-color); }
    .picker-value.small { min-width: 120px; font-size: 16px; }
    .colon { font-size: 26px; font-weight: 600; padding-bottom: 8px; color: var(--secondary-text-color); }
    .step { width: 38px; height: 38px; border-radius: 50%; border: none; cursor: pointer; background: transparent;
      color: var(--tp-color); display: flex; align-items: center; justify-content: center; padding: 0;
      touch-action: manipulation; user-select: none; -webkit-user-select: none; transition: background 0.2s, transform 0.2s; }
    .step:hover { background: color-mix(in srgb, var(--tp-color) 18%, transparent); }
    .step:active { transform: scale(0.88); }
    .step:focus-visible { outline: 2px solid var(--tp-color); outline-offset: 1px; }
  `;
}
