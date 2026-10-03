import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";

const TICKS = 24;

/**
 * Waagerechter Regler mit Farbverlauf (Helligkeit, Farbtemperatur, Farbton). Feuert
 * `value-changing` beim Ziehen und `value-changed` beim Loslassen bzw. per Tastatur.
 * Mit `fill` wird er zum leuchtenden Füllbalken (Helligkeit). Glow, Lauflicht und Skala
 * spielen nur kurz nach einer Änderung (heller → Lauflicht nach rechts, dunkler → nach links,
 * neue Farbe → Aufleuchten) und ruhen sonst.
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
  /** Füllbalken statt Verlauf über die ganze Breite */
  @property({ type: Boolean }) fill = false;
  /** Leuchtet/animiert (z.B. Licht an) */
  @property({ type: Boolean }) active = false;
  /** Füllfarbe im `fill`-Modus */
  @property() color = "var(--hcc-accent, var(--primary-color))";
  /** Kleine Ausführung (Einzellampen) */
  @property({ type: Boolean, reflect: true }) small = false;
  @property({ type: Boolean }) disabled = false;

  @state() private _drag = false;
  /** Kurze Animation nach einer Änderung */
  @state() private _flash?: "up" | "down" | "color";
  private _flashTimer?: number;
  private _flashAt = 0;
  private _dragStart?: number;

  private _trigger(kind: "up" | "down" | "color"): void {
    const now = Date.now();
    // Bestätigung der eigenen Änderung durch HA (gleiche Richtung) nicht erneut abspielen
    if (this._flash === kind && now - this._flashAt < 1500) return;
    this._flashAt = now;
    clearTimeout(this._flashTimer);
    this._flash = undefined;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this._flash = kind;
      this._flashTimer = window.setTimeout(() => (this._flash = undefined), 1900);
    }));
  }

  protected willUpdate(changed: PropertyValues): void {
    if (!this.fill || !this.hasUpdated || this._drag) return;
    const oldValue = changed.get("value") as number | undefined;
    if (changed.has("value") && oldValue != null && oldValue !== this.value && this.active) {
      this._trigger(this.value > oldValue ? "up" : "down");
    } else if (changed.has("active") && changed.get("active") === false && this.active) {
      this._trigger("up");
    } else if (changed.has("color") && changed.get("color") && this.active) {
      this._trigger("color");
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._flashTimer);
  }

  private _fromEvent(ev: PointerEvent): number {
    const r = this.shadowRoot!.querySelector(".track")!.getBoundingClientRect();
    const inset = this.fill ? (this.small ? 11 : 14) : 0; // Knopf-Mitte bleibt im Füllmodus innerhalb der Leiste
    const pct = Math.min(1, Math.max(0, (ev.clientX - r.left - inset) / (r.width - 2 * inset)));
    const raw = this.min + pct * (this.max - this.min);
    return Math.min(this.max, Math.max(this.min, Math.round(raw / this.step) * this.step));
  }

  private _emit(type: string): void {
    this.dispatchEvent(new CustomEvent(type, { detail: { value: this.value }, bubbles: true, composed: true }));
  }

  private _down(ev: PointerEvent): void {
    if (ev.button !== 0 || this.disabled) return;
    this._drag = true;
    this._dragStart = this.value;
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
    if (this.fill && this._dragStart != null && this._dragStart !== this.value) this._trigger(this.value > this._dragStart ? "up" : "down");
    this._emit("value-changed");
  }

  private _key(ev: KeyboardEvent): void {
    const d: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
    if (!(ev.key in d) || this.disabled) return;
    ev.preventDefault();
    const before = this.value;
    this.value = Math.min(this.max, Math.max(this.min, this.value + d[ev.key] * this.step));
    if (this.fill && before !== this.value) this._trigger(this.value > before ? "up" : "down");
    this._emit("value-changed");
  }

  protected render() {
    const pct = Math.min(100, Math.max(0, ((this.value - this.min) / (this.max - this.min || 1)) * 100));
    return html`
      ${this.label ? html`<div class="head">
        <span class="label">${this.icon ? html`<ha-icon .icon=${this.icon}></ha-icon>` : nothing}${this.label}</span>
        <span class="display">${this.display}</span>
      </div>` : nothing}
      <div class="track ${this._drag ? "drag" : ""} ${this.fill ? "filled" : ""} ${this.active ? "is-active" : ""} ${this._flash ? `flash ${this._flash}` : ""}"
        style=${this.fill ? `--c:${this.color};--p:${pct}%;--f:${pct / 100}` : `background:${this.gradient}`} role="slider"
        tabindex=${this.disabled ? -1 : 0} aria-disabled=${this.disabled}
        aria-label=${this.label} aria-valuemin=${this.min} aria-valuemax=${this.max} aria-valuenow=${this.value}
        @pointerdown=${this._down} @pointermove=${this._move} @pointerup=${this._up} @pointercancel=${this._up}
        @keydown=${this._key}>
        ${this.fill ? html`<span class="glow-bar"></span><span class="bar"><span class="shine"></span></span>` : nothing}
        <span class="knob" style="${this.fill ? "" : `left:${pct}%;`}--k:${this.knob}"></span>
      </div>
      ${this.fill && !this.small ? html`<div class="ticks ${this.active ? "is-active" : ""} ${this._flash ? "flash" : ""}" style="--c:${this.color}">
        ${Array.from({ length: TICKS + 1 }, (_, i) => {
          const lit = this.active && (i / TICKS) * 100 <= pct + 0.01;
          const order = this._flash === "down" ? TICKS - i : i;
          return html`<span class="tick ${lit ? "lit" : ""}" style=${lit ? `animation-delay:${(order * 0.03).toFixed(2)}s` : ""}></span>`;
        })}
      </div>` : nothing}`;
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
    :host([small]) .track { height: 22px; }
    :host([small]) .knob { width: 18px; height: 18px; margin: -9px 0 0 -9px; box-shadow: 0 0 0 2px #fff, 0 2px 6px rgba(0,0,0,0.3); }
    :host([disabled]) .track { cursor: default; opacity: 0.5; }

    /* Füllbalken: leuchtet in der Lichtfarbe, Lauflicht und Glow wie beim Drehregler */
    .track.filled { background: var(--hcc-track, rgba(127,127,127,0.16)); isolation: isolate; --ks: 28px; }
    :host([small]) .track.filled { --ks: 22px; }
    /* Knopf bleibt innerhalb der Leiste: Mitte wandert von ks/2 bis 100% − ks/2 */
    .track.filled .knob { left: calc(var(--p) + (0.5 - var(--f)) * var(--ks)); }
    .bar, .glow-bar { position: absolute; left: 0; top: 0; bottom: 0; border-radius: inherit; pointer-events: none;
      width: calc(var(--p) + (1 - var(--f)) * var(--ks)); transition: width 0.25s var(--ease-out, ease), opacity 0.4s, background 0.6s; }
    .track.drag .bar, .track.drag .glow-bar { transition: opacity 0.4s, background 0.6s; }
    .bar { overflow: hidden; z-index: 1;
      background: linear-gradient(90deg, color-mix(in srgb, var(--c) 30%, transparent), var(--c)); }
    .glow-bar { z-index: 0; background: var(--c); filter: blur(12px); opacity: 0; }
    .track.is-active .glow-bar { opacity: 0.3; }
    .track.is-active.flash .glow-bar { animation: glow-burst 1.6s ease-out; }
    .track:not(.is-active) .bar { background: linear-gradient(90deg, rgba(127,127,127,0.18), rgba(127,127,127,0.32)); }
    .shine { position: absolute; inset: 0; opacity: 0;
      background: linear-gradient(100deg, transparent 20%, rgba(255,255,255,0.45) 50%, transparent 80%);
      background-size: 60% 100%; background-repeat: no-repeat; }
    .track.is-active.flash .shine { opacity: 1; animation: shine-up 1.1s ease-in-out both; }
    .track.is-active.flash.down .shine { animation-name: shine-down; }
    .track.is-active.flash.color .shine { animation-duration: 1.4s; }
    .track.filled .knob { z-index: 2; background: #fff; box-shadow: 0 0 0 3px var(--c), 0 2px 8px rgba(0,0,0,0.35); }
    .track.filled.is-active.flash .knob { animation: halo 1.2s ease-out; }
    :host([small]) .track.filled .knob { box-shadow: 0 0 0 2px var(--c), 0 2px 6px rgba(0,0,0,0.3); }
    .ticks { display: flex; justify-content: space-between; padding: 6px 12px 0; pointer-events: none; }
    .tick { width: 2px; height: 6px; border-radius: 1px; background: var(--secondary-text-color); opacity: 0.22;
      transition: opacity 0.3s, background 0.4s; }
    .tick.lit { background: var(--c); opacity: 0.9; box-shadow: 0 0 4px var(--c); }
    .ticks.is-active.flash .tick.lit { animation: pulse 0.7s ease-in-out both; }
    .glow-bar, .shine, .knob, .tick.lit { animation-play-state: var(--hcc-anim-state, running) !important; }
    @keyframes glow-burst { 0% { opacity: 0.3; } 30% { opacity: 0.75; } 100% { opacity: 0.3; } }
    @keyframes shine-up { from { background-position: -80% 0; } to { background-position: 180% 0; } }
    @keyframes shine-down { from { background-position: 180% 0; } to { background-position: -80% 0; } }
    @keyframes pulse { 0%, 100% { opacity: 0.9; transform: none; } 45% { opacity: 1; transform: scaleY(1.6); } }
    @keyframes halo { 0% { box-shadow: 0 0 0 3px var(--c), 0 0 0 3px color-mix(in srgb, var(--c) 50%, transparent), 0 2px 8px rgba(0,0,0,0.35); }
      100% { box-shadow: 0 0 0 3px var(--c), 0 0 0 12px transparent, 0 2px 8px rgba(0,0,0,0.35); } }
    @media (prefers-reduced-motion: reduce) {
      .glow-bar, .shine, .knob, .tick { animation: none !important; }
    }
  `;
}
