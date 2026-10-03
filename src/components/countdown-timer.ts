import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant } from "../types";
import { durationToSeconds, secondsToDuration } from "../utils";

/**
 * Schnell-Timer "Aus in 30/60/90 min" auf Basis eines `timer`-Helfers.
 * Die Abschaltung beim Ablauf erledigt eine Automation (Blueprint im Repository).
 */
@customElement("hcc-countdown-timer")
export class CountdownTimer extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property() entity?: string;
  @property({ attribute: false }) durations: number[] = [30, 60, 90, 120];
  @property() label = "Off in";
  @property() cancelText = "Cancel";

  @state() private _now = Date.now();
  private _tick?: number;

  private get _timer(): HassEntity | undefined {
    return this.entity ? this.hass?.states[this.entity] : undefined;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._tick);
    this._tick = undefined;
  }

  protected updated(): void {
    const active = this._timer?.state === "active";
    if (active && !this._tick) this._tick = window.setInterval(() => (this._now = Date.now()), 1000);
    if (!active && this._tick) { clearInterval(this._tick); this._tick = undefined; }
  }

  private _remaining(t: HassEntity): number {
    if (t.state === "active" && t.attributes.finishes_at) {
      return Math.max(0, (new Date(t.attributes.finishes_at).getTime() - this._now) / 1000);
    }
    return durationToSeconds(t.attributes.remaining);
  }

  private _start(minutes: number): void {
    if (!this.hass || !this.entity) return;
    this.hass.callService("timer", "start", { entity_id: this.entity, duration: secondsToDuration(minutes * 60) });
  }

  private _cancel(): void {
    if (!this.hass || !this.entity) return;
    this.hass.callService("timer", "cancel", { entity_id: this.entity });
  }

  private _fmtChip(min: number): string {
    if (min < 60) return `${min} min`;
    const h = min / 60;
    return `${Number.isInteger(h) ? h : h.toFixed(1).replace(".", ",")} h`;
  }

  private _fmtRemaining(sec: number): string {
    const s = Math.round(sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = String(s % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
  }

  protected render() {
    const t = this._timer;
    if (!t) return nothing;
    const running = t.state === "active" || t.state === "paused";
    const remaining = running ? this._remaining(t) : 0;
    const total = durationToSeconds(t.attributes.duration) || 1;
    const progress = running ? Math.min(100, (remaining / total) * 100) : 0;
    return html`<div class="countdown ${running ? "running" : ""}">
      <div class="head">
        <span class="title"><ha-icon icon="mdi:timer-outline"></ha-icon>${running
          ? html`<span class="remaining">${this._fmtRemaining(remaining)}</span>` : this.label}</span>
        ${running ? html`
          <button class="cancel" @click=${this._cancel}>
            <ha-icon icon="mdi:timer-off-outline"></ha-icon><span>${this.cancelText}</span></button>` : nothing}
      </div>
      ${running ? html`<div class="bar"><div style="width:${progress}%"></div></div>` : nothing}
      <div class="chips">
        ${this.durations.map((m) => html`<button class="chip" @click=${() => this._start(m)}>${this._fmtChip(m)}</button>`)}
      </div>
    </div>`;
  }

  static styles = css`
    .countdown { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-radius: 14px;
      background: var(--hcc-chip-bg, rgba(127,127,127,0.12)); --c: var(--hcc-timer-color, #7e57c2); }
    .countdown.running { background: color-mix(in srgb, var(--c) 16%, transparent); }
    .head { display: flex; align-items: center; gap: 8px; min-height: 24px; }
    .title { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; white-space: nowrap; font-size: 12px; font-weight: 500;
      color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: 0.04em; }
    .title ha-icon { --mdc-icon-size: 16px; }
    .remaining { font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--primary-text-color); }
    .cancel { display: flex; align-items: center; gap: 4px; border: none; border-radius: 999px; padding: 5px 12px 5px 9px;
      font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.2s;
      background: color-mix(in srgb, var(--error-color, #db4437) 16%, transparent); color: var(--error-color, #db4437); }
    .cancel:hover { background: color-mix(in srgb, var(--error-color, #db4437) 26%, transparent); }
    .cancel ha-icon { --mdc-icon-size: 16px; }
    .bar { height: 4px; border-radius: 2px; background: rgba(127,127,127,0.2); overflow: hidden; }
    .bar div { height: 100%; background: var(--c); transition: width 1s linear; }
    .chips { display: flex; gap: 6px; }
    .chip { flex: 1; border: none; border-radius: 999px; padding: 6px 4px; font: inherit; font-size: 13px; cursor: pointer;
      background: var(--card-background-color, #fff); color: var(--primary-text-color); transition: background 0.2s; }
    .chip:hover { background: color-mix(in srgb, var(--c) 20%, var(--card-background-color, #fff)); }
    .chip:focus-visible, .cancel:focus-visible { outline: 2px solid var(--c); outline-offset: 2px; }
  `;
}
