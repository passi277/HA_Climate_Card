import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

/**
 * Waagerechter Regler mit Farbverlauf (Helligkeit, Farbtemperatur, Farbton). Feuert
 * `value-changing` beim Ziehen und `value-changed` beim Loslassen bzw. per Tastatur.
 */
@customElement("hcc-gradient-slider")
export class GradientSlider extends LitElement {
  @property({ type: Number }) value = 0;
  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 100;
  @property({ type: Number }) step = 1;
  @property() gradient = "linear-gradient(90deg, #333, #fff)";
  @property() knob = "#fff";
  @property() label = "";
  @property() icon?: string;
  @property() display = "";

  @state() private _drag = false;

  private _fromEvent(ev: PointerEvent): number {
    const r = this.shadowRoot!.querySelector(".track")!.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
    const raw = this.min + pct * (this.max - this.min);
    return Math.min(this.max, Math.max(this.min, Math.round(raw / this.step) * this.step));
  }

  private _emit(type: string): void {
    this.dispatchEvent(new CustomEvent(type, { detail: { value: this.value }, bubbles: true, composed: true }));
  }

  private _down(ev: PointerEvent): void {
    if (ev.button !== 0) return;
    this._drag = true;
    (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
    this.value = this._fromEvent(ev);
    this._emit("value-changing");
  }

  private _move(ev: PointerEvent): void {
    if (!this._drag) return;
    this.value = this._fromEvent(ev);
    this._emit("value-changing");
  }

  private _up(): void {
    if (!this._drag) return;
    this._drag = false;
    this._emit("value-changed");
  }

  private _key(ev: KeyboardEvent): void {
    const d: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
    if (!(ev.key in d)) return;
    ev.preventDefault();
    this.value = Math.min(this.max, Math.max(this.min, this.value + d[ev.key] * this.step));
    this._emit("value-changed");
  }

  protected render() {
    const pct = ((this.value - this.min) / (this.max - this.min || 1)) * 100;
    return html`
      ${this.label ? html`<div class="head">
        <span class="label">${this.icon ? html`<ha-icon .icon=${this.icon}></ha-icon>` : nothing}${this.label}</span>
        <span class="display">${this.display}</span>
      </div>` : nothing}
      <div class="track ${this._drag ? "drag" : ""}" style="background:${this.gradient}" role="slider" tabindex="0"
        aria-label=${this.label} aria-valuemin=${this.min} aria-valuemax=${this.max} aria-valuenow=${this.value}
        @pointerdown=${this._down} @pointermove=${this._move} @pointerup=${this._up} @pointercancel=${this._up}
        @keydown=${this._key}>
        <span class="knob" style="left:${pct}%;--k:${this.knob}"></span>
      </div>`;
  }

  static styles = css`
    :host { display: block; }
    .head { display: flex; align-items: center; justify-content: space-between; margin: 0 2px 8px; }
    .label { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: var(--secondary-text-color);
      text-transform: uppercase; letter-spacing: 0.04em; }
    .label ha-icon { --mdc-icon-size: 16px; }
    .display { font-size: 13px; font-weight: 600; color: var(--primary-text-color); font-variant-numeric: tabular-nums; }
    .track { position: relative; height: 28px; border-radius: 999px; cursor: pointer; touch-action: pan-y;
      box-shadow: inset 0 0 0 1px rgba(127,127,127,0.25); outline: none; }
    .track:focus-visible { box-shadow: inset 0 0 0 1px rgba(127,127,127,0.25), 0 0 0 2px var(--hcc-accent, var(--primary-color)); }
    .knob { position: absolute; top: 50%; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%;
      background: var(--k); box-shadow: 0 0 0 3px #fff, 0 2px 8px rgba(0,0,0,0.35);
      transition: left 0.15s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); pointer-events: none; }
    .track.drag .knob { transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); transform: scale(1.15); }
  `;
}
