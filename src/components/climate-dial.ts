import { LitElement, css, html, svg, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

const START = 135;
const SWEEP = 270;
const CX = 100;
const CY = 100;
const R = 82;

type Handle = "value" | "low" | "high";

const polar = (angle: number, r = R) => {
  const rad = (angle * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
};

const arcPath = (from: number, to: number, r = R): string => {
  if (to - from < 0.01) return "";
  const s = polar(from, r);
  const e = polar(to, r);
  const large = to - from > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
};

/**
 * Runder Thermostat-Regler. Unterstützt einen einzelnen Sollwert (`value`) oder einen
 * Bereich (`low`/`high`). Feuert `value-changing` während des Ziehens und `value-changed`
 * beim Loslassen bzw. nach Tastatureingabe, jeweils mit `{ value }` oder `{ low, high }`.
 */
@customElement("hcc-climate-dial")
export class ClimateDial extends LitElement {
  @property({ type: Number }) min = 16;
  @property({ type: Number }) max = 30;
  @property({ type: Number }) step = 0.5;
  @property({ type: Number }) value?: number;
  @property({ type: Number }) low?: number;
  @property({ type: Number }) high?: number;
  @property({ type: Number }) current?: number;
  @property({ type: Boolean }) dual = false;
  @property({ type: Boolean }) disabled = false;
  @property() color = "var(--primary-color)";
  @property() lowColor = "var(--state-climate-heat-color, #ff6d00)";
  @property() highColor = "var(--state-climate-cool-color, #2196f3)";
  @property({ type: Boolean }) active = false;

  @state() private _dragging?: Handle;

  private _clamp(v: number): number {
    const stepped = Math.round((v - this.min) / this.step) * this.step + this.min;
    const fixed = Number(stepped.toFixed(this.step < 1 ? 1 : 0));
    return Math.min(this.max, Math.max(this.min, fixed));
  }

  private _toAngle(v: number): number {
    const span = this.max - this.min || 1;
    const ratio = Math.min(1, Math.max(0, (v - this.min) / span));
    return START + SWEEP * ratio;
  }

  private _fromPointer(ev: PointerEvent): number {
    const svgEl = this.shadowRoot!.querySelector("svg")!;
    const rect = svgEl.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 200 - CX;
    const y = ((ev.clientY - rect.top) / rect.height) * 200 - CY;
    let rel = ((Math.atan2(y, x) * 180) / Math.PI - START + 720) % 360;
    if (rel > SWEEP) rel = rel > SWEEP + (360 - SWEEP) / 2 ? 0 : SWEEP;
    return this._clamp(this.min + (rel / SWEEP) * (this.max - this.min));
  }

  private _pickHandle(v: number): Handle {
    if (!this.dual) return "value";
    const low = this.low ?? this.min;
    const high = this.high ?? this.max;
    if (v <= low) return "low";
    if (v >= high) return "high";
    return v - low < high - v ? "low" : "high";
  }

  private _apply(handle: Handle, v: number): void {
    if (handle === "value") this.value = v;
    else if (handle === "low") this.low = Math.min(v, this.high ?? this.max);
    else this.high = Math.max(v, this.low ?? this.min);
  }

  private _emit(type: "value-changing" | "value-changed"): void {
    const detail = this.dual ? { low: this.low, high: this.high } : { value: this.value };
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  private _onPointerDown(ev: PointerEvent): void {
    if (this.disabled) return;
    ev.preventDefault();
    const v = this._fromPointer(ev);
    this._dragging = this._pickHandle(v);
    (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
    this._apply(this._dragging, v);
    this._emit("value-changing");
  }

  private _onPointerMove(ev: PointerEvent): void {
    if (!this._dragging) return;
    this._apply(this._dragging, this._fromPointer(ev));
    this._emit("value-changing");
  }

  private _onPointerUp(ev: PointerEvent): void {
    if (!this._dragging) return;
    (ev.currentTarget as Element).releasePointerCapture?.(ev.pointerId);
    this._dragging = undefined;
    this._emit("value-changed");
  }

  private _onKey(handle: Handle, ev: KeyboardEvent): void {
    if (this.disabled) return;
    const delta: Record<string, number> = {
      ArrowUp: this.step, ArrowRight: this.step, ArrowDown: -this.step, ArrowLeft: -this.step,
      PageUp: this.step * 5, PageDown: -this.step * 5,
    };
    if (!(ev.key in delta)) return;
    ev.preventDefault();
    const base = handle === "value" ? this.value : handle === "low" ? this.low : this.high;
    this._apply(handle, this._clamp((base ?? this.min) + delta[ev.key]));
    this._emit("value-changed");
  }

  private _handle(handle: Handle, v: number | undefined, color: string) {
    if (v == null) return nothing;
    const p = polar(this._toAngle(v));
    return svg`
      <g class="handle ${this._dragging === handle ? "dragging" : ""}" tabindex=${this.disabled ? -1 : 0}
        role="slider" aria-valuemin=${this.min} aria-valuemax=${this.max} aria-valuenow=${v}
        aria-label=${handle} @keydown=${(e: KeyboardEvent) => this._onKey(handle, e)}>
        <circle cx=${p.x} cy=${p.y} r="13" class="halo" style="fill:${color}"></circle>
        <circle cx=${p.x} cy=${p.y} r="9" class="knob" style="stroke:${color}"></circle>
      </g>`;
  }

  protected render() {
    const end = START + SWEEP;
    let activeArc = nothing as unknown;
    if (!this.disabled) {
      if (this.dual && this.low != null && this.high != null) {
        activeArc = svg`<path class="active" d=${arcPath(this._toAngle(this.low), this._toAngle(this.high))}
          style="stroke:url(#rangeGrad)"></path>`;
      } else if (this.value != null) {
        activeArc = svg`<path class="active" d=${arcPath(START, this._toAngle(this.value))}
          style="stroke:${this.color}"></path>`;
      }
    }
    const cur = this.current != null && this.current >= this.min && this.current <= this.max
      ? polar(this._toAngle(this.current), R) : undefined;
    const ticks = Array.from({ length: 55 }, (_, i) => START + (SWEEP / 54) * i);

    return html`
      <div class="dial ${this.active ? "is-active" : ""}" style="--dial-color:${this.color}">
        <svg viewBox="0 0 200 200"
          @pointerdown=${this._onPointerDown} @pointermove=${this._onPointerMove}
          @pointerup=${this._onPointerUp} @pointercancel=${this._onPointerUp}>
          <defs>
            <linearGradient id="rangeGrad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stop-color=${this.lowColor}></stop>
              <stop offset="100%" stop-color=${this.highColor}></stop>
            </linearGradient>
          </defs>
          ${ticks.map((a) => {
            const o = polar(a, R + 16);
            const i = polar(a, R + 11);
            return svg`<line class="tick" x1=${o.x} y1=${o.y} x2=${i.x} y2=${i.y}></line>`;
          })}
          <path class="track" d=${arcPath(START, end)}></path>
          ${activeArc}
          ${cur ? svg`<circle class="current" cx=${cur.x} cy=${cur.y} r="3.5"></circle>` : nothing}
          ${this.disabled ? nothing : this.dual
            ? [this._handle("low", this.low, this.lowColor), this._handle("high", this.high, this.highColor)]
            : this._handle("value", this.value, this.color)}
        </svg>
        <div class="center"><slot></slot></div>
      </div>
    `;
  }

  static styles = css`
    :host { display: block; width: 100%; max-width: 320px; margin: 0 auto; }
    .dial { position: relative; width: 100%; aspect-ratio: 1; }
    svg { width: 100%; height: 100%; touch-action: none; user-select: none; overflow: visible; }
    .track { fill: none; stroke: var(--divider-color, rgba(127,127,127,0.25)); stroke-width: 14; stroke-linecap: round; }
    .active { fill: none; stroke-width: 14; stroke-linecap: round; transition: stroke 0.4s; }
    .tick { stroke: var(--secondary-text-color); stroke-opacity: 0.25; stroke-width: 1.2; stroke-linecap: round; }
    .is-active .tick { stroke: var(--dial-color); stroke-opacity: 0.45; animation: pulse 2.4s ease-in-out infinite; }
    .current { fill: var(--primary-text-color); stroke: var(--card-background-color, #fff); stroke-width: 1.5; }
    .handle { cursor: grab; outline: none; }
    .handle .halo { opacity: 0; transition: opacity 0.2s; }
    .handle:hover .halo, .handle:focus-visible .halo, .handle.dragging .halo { opacity: 0.25; }
    .handle.dragging { cursor: grabbing; }
    .knob { fill: var(--card-background-color, #fff); stroke-width: 4; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.35)); }
    .center {
      position: absolute; inset: 22%; display: flex; flex-direction: column;
      align-items: center; justify-content: center; text-align: center; pointer-events: none;
    }
    .center ::slotted(*) { pointer-events: auto; }
    @keyframes pulse { 0%, 100% { stroke-opacity: 0.2; } 50% { stroke-opacity: 0.6; } }
    @media (prefers-reduced-motion: reduce) { .is-active .tick { animation: none; } }
  `;
}

declare global {
  interface HTMLElementTagNameMap { "hcc-climate-dial": ClimateDial; }
}
