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
  @property() hourText = "Hour";
  @property() minuteText = "Minute";
  @property() doneText = "Done";

  @state() private _now = Date.now();
  /** Zeitwahl geöffnet (eigene Auswahl statt <input type="time">, das in der HA-App nicht überall bedienbar ist). */
  @state() private _editing = false;
  /** Noch nicht übertragene Auswahl in Minuten seit Mitternacht. */
  @state() private _pending?: number;
  private _tick?: number;
  private _commitTimer?: number;
  private _holdDelay?: number;
  private _holdRepeat?: number;

  connectedCallback(): void {
    super.connectedCallback();
    this._tick = window.setInterval(() => (this._now = Date.now()), 30_000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._tick);
    clearTimeout(this._commitTimer);
    this._holdEnd();
  }

  protected updated(): void {
    // Auswahl verwerfen, sobald Home Assistant den neuen Wert meldet
    if (this._pending != null && this._pending === this._stateMinutes()) this._pending = undefined;
  }

  private _stateMinutes(): number | undefined {
    const a = this._time?.attributes;
    return a?.hour != null ? a.hour * 60 + (a.minute ?? 0) : undefined;
  }

  /** Angezeigte Zeit: eigene Auswahl, sonst Wert des Helfers. */
  private get _minutes(): number {
    return this._pending ?? this._stateMinutes() ?? 0;
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
    if (this._pending == null && a.has_date && a.timestamp) return new Date(a.timestamp * 1000);
    if (this._pending == null && (a.hour == null || a.minute == null)) return undefined;
    const d = new Date(this._now);
    d.setHours(Math.floor(this._minutes / 60), this._minutes % 60, 0, 0);
    if (d.getTime() <= this._now) d.setDate(d.getDate() + 1);
    return d;
  }

  private _timeValue(): string {
    return `${pad(Math.floor(this._minutes / 60))}:${pad(this._minutes % 60)}`;
  }

  private _remaining(target: Date): string {
    const mins = Math.max(0, Math.round((target.getTime() - this._now) / 60000));
    const h = Math.floor(mins / 60);
    return h ? `${h}:${pad(mins % 60)} h` : `${mins} min`;
  }

  private _toggle(): void {
    const sw = this._switch;
    if (!sw || !this.hass) return;
    window.dispatchEvent(new CustomEvent("haptic", { detail: "light" }));
    this.hass.callService("homeassistant", sw.state === "on" ? "turn_off" : "turn_on", { entity_id: sw.entity_id });
  }

  /** Auswahl ändern und kurz verzögert an Home Assistant übertragen (sammelt schnelles Tippen). */
  private _select(minutes: number): void {
    this._pending = ((Math.round(minutes) % 1440) + 1440) % 1440;
    window.dispatchEvent(new CustomEvent("haptic", { detail: "selection" }));
    clearTimeout(this._commitTimer);
    this._commitTimer = window.setTimeout(() => this._commit(), 900);
  }

  private _commit(): void {
    clearTimeout(this._commitTimer);
    const t = this._time;
    if (this._pending == null || !t || !this.hass) return;
    const h = Math.floor(this._pending / 60);
    const m = this._pending % 60;
    const data: Record<string, unknown> = { entity_id: t.entity_id };
    if (t.attributes.has_date) {
      const d = new Date();
      d.setHours(h, m, 0, 0);
      if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
      data.datetime = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(h)}:${pad(m)}:00`;
    } else {
      data.time = `${pad(h)}:${pad(m)}:00`;
    }
    this.hass.callService("input_datetime", "set_datetime", data);
  }

  /** Schnellwahl relativ zu jetzt, auf 5 Minuten gerundet. */
  private _inMinutes(delta: number): void {
    const now = new Date();
    this._select(Math.round((now.getHours() * 60 + now.getMinutes() + delta) / 5) * 5);
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

  private _stepButton(label: string, icon: string, fn: () => void) {
    return html`<button class="step" aria-label=${label}
      @pointerdown=${(e: PointerEvent) => this._holdStart(e, fn)} @pointerup=${this._holdEnd}
      @pointerleave=${this._holdEnd} @pointercancel=${this._holdEnd} @contextmenu=${(e: Event) => e.preventDefault()}
      @click=${(e: MouseEvent) => { if (e.detail === 0) fn(); }}><ha-icon icon=${icon}></ha-icon></button>`;
  }

  private _toggleEditor(): void {
    if (this._editing) this._commit();
    this._editing = !this._editing;
  }

  private _renderEditor() {
    const h = Math.floor(this._minutes / 60);
    const m = this._minutes % 60;
    const quick = [30, 60, 120];
    return html`<div class="editor">
      <div class="pickers">
        <div class="picker">
          <span class="picker-label">${this.hourText}</span>
          <div class="picker-row">
            ${this._stepButton(`${this.hourText} -`, "mdi:minus", () => this._select(this._minutes - 60))}
            <span class="picker-value">${pad(h)}</span>
            ${this._stepButton(`${this.hourText} +`, "mdi:plus", () => this._select(this._minutes + 60))}
          </div>
        </div>
        <span class="colon">:</span>
        <div class="picker">
          <span class="picker-label">${this.minuteText}</span>
          <div class="picker-row">
            ${this._stepButton(`${this.minuteText} -`, "mdi:minus", () => this._select(Math.ceil(this._minutes / 5) * 5 - 5))}
            <span class="picker-value">${pad(m)}</span>
            ${this._stepButton(`${this.minuteText} +`, "mdi:plus", () => this._select(Math.floor(this._minutes / 5) * 5 + 5))}
          </div>
        </div>
      </div>
      <div class="quick">
        ${quick.map((q) => html`<button class="chip" @click=${() => this._inMinutes(q)}>${this.inText} ${q < 60 ? `${q} min` : `${q / 60} h`}</button>`)}
        <button class="chip done" @click=${this._toggleEditor}>${this.doneText}</button>
      </div>
    </div>`;
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
      ? html`<button class="time ${this._editing ? "editing" : ""} ${this._pending != null ? "pending" : ""}"
          aria-label=${this.label} aria-expanded=${this._editing} @click=${this._toggleEditor}>${this._timeValue()}</button>`
      : nothing;
    return html`<div class="wrap ${armed ? "armed" : ""}"><div class="timer">
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
    </div>
    ${this._editing && this._time ? this._renderEditor() : nothing}
    </div>`;
  }

  static styles = css`
    .wrap {
      border-radius: var(--hcc-inner-radius, 14px); background: var(--hcc-chip-bg, rgba(127,127,127,0.12));
      transition: background 0.3s; --timer-color: var(--hcc-timer-color, #7e57c2);
    }
    .wrap.armed { background: color-mix(in srgb, var(--timer-color) 16%, transparent); }
    .timer { display: flex; align-items: center; gap: 10px; padding: 8px 10px; }
    .badge { border: none; padding: 0; cursor: pointer; flex: none; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      background: rgba(127,127,127,0.15); color: var(--secondary-text-color); }
    .armed .badge { background: var(--timer-color); color: #fff; }
    .badge ha-icon { --mdc-icon-size: 20px; }
    .text { display: flex; flex-direction: column; min-width: 0; flex: 1; gap: 2px; }
    .label { font-size: 14px; font-weight: 600; color: var(--primary-text-color); }
    .status { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; font-size: 12px; color: var(--secondary-text-color); }
    .remaining { white-space: nowrap; }
    .time {
      font: inherit; font-size: 14px; font-weight: 700; color: var(--primary-text-color); cursor: pointer;
      background: var(--card-background-color, #fff); border: 1px solid var(--divider-color, rgba(127,127,127,0.3));
      border-radius: 8px; padding: 2px 8px; font-variant-numeric: tabular-nums;
    }
    .time.editing { border-color: var(--timer-color); box-shadow: 0 0 0 2px color-mix(in srgb, var(--timer-color) 30%, transparent); }
    .time.pending { color: var(--timer-color); }
    .time:focus-visible { outline: 2px solid var(--timer-color); outline-offset: 1px; }
    .editor { padding: 4px 10px 12px; display: flex; flex-direction: column; gap: 10px; animation: open 0.3s cubic-bezier(0.22, 1, 0.36, 1); }
    @keyframes open { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
    .pickers { display: flex; align-items: flex-end; justify-content: center; gap: 8px; }
    .picker { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .picker-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--secondary-text-color); }
    .picker-row { display: flex; align-items: center; gap: 4px; padding: 3px; border-radius: 999px; background: var(--card-background-color, #fff); }
    .picker-value { min-width: 42px; text-align: center; font-size: 26px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--primary-text-color); }
    .colon { font-size: 26px; font-weight: 600; padding-bottom: 8px; color: var(--secondary-text-color); }
    .step { width: 38px; height: 38px; border-radius: 50%; border: none; cursor: pointer; background: transparent;
      color: var(--timer-color); display: flex; align-items: center; justify-content: center; padding: 0;
      touch-action: manipulation; user-select: none; -webkit-user-select: none; transition: background 0.2s, transform 0.2s; }
    .step:hover { background: color-mix(in srgb, var(--timer-color) 18%, transparent); }
    .step:active { transform: scale(0.88); }
    .quick { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
    .chip { border: none; border-radius: 999px; padding: 7px 12px; font: inherit; font-size: 13px; cursor: pointer;
      background: var(--card-background-color, #fff); color: var(--primary-text-color); }
    .chip:hover { background: color-mix(in srgb, var(--timer-color) 18%, var(--card-background-color, #fff)); }
    .chip.done { background: var(--timer-color); color: #fff; font-weight: 600; }
    .switch { flex: none; position: relative; width: 44px; height: 26px; border-radius: 13px; border: none; cursor: pointer;
      background: rgba(127,127,127,0.35); transition: background 0.2s; padding: 0; }
    .switch.on { background: var(--timer-color); }
    .thumb { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff;
      box-shadow: 0 1px 2px rgba(0,0,0,0.3); transition: transform 0.2s; }
    .switch.on .thumb { transform: translateX(18px); }
    .switch:focus-visible { outline: 2px solid var(--timer-color); outline-offset: 2px; }
  `;
}
