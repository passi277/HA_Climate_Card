import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";

/**
 * Fenster mit Rollladen: Der Panzer fährt entsprechend der Öffnung herunter, Licht fällt durch
 * den offenen Teil. Senkrecht ziehen (oder Pfeiltasten) stellt die Position ein. Während der
 * Fahrt laufen die Lamellen; nach einer Änderung leuchtet die Unterkante kurz auf.
 * Feuert `value-changing` beim Ziehen und `value-changed` beim Loslassen.
 */
@customElement("hcc-cover-window")
export class CoverWindow extends LitElement {
  /** Öffnung in % (100 = offen) */
  @property({ type: Number }) position?: number;
  @property() moving?: "opening" | "closing";
  /** Position einstellbar (sonst nur Anzeige) */
  @property({ type: Boolean }) settable = true;
  @property({ type: Boolean }) disabled = false;
  @property() label = "";

  @state() private _drag?: number;
  @state() private _flash = false;
  private _flashTimer?: number;

  private get _value(): number {
    return this._drag ?? this.position ?? 0;
  }

  protected willUpdate(changed: PropertyValues): void {
    const old = changed.get("position") as number | undefined;
    if (this.hasUpdated && changed.has("position") && old != null && old !== this.position && this._drag == null) this._pulse();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._flashTimer);
  }

  private _pulse(): void {
    clearTimeout(this._flashTimer);
    this._flash = false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this._flash = true;
      this._flashTimer = window.setTimeout(() => (this._flash = false), 1300);
    }));
  }

  private _fromEvent(ev: PointerEvent): number {
    const r = this.shadowRoot!.querySelector(".glass")!.getBoundingClientRect();
    const closedFraction = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height));
    return Math.round(100 - closedFraction * 100);
  }

  private _emit(type: string, value: number): void {
    this.dispatchEvent(new CustomEvent(type, { detail: { value }, bubbles: true, composed: true }));
  }

  private _down(ev: PointerEvent): void {
    if (!this.settable || this.disabled || ev.button !== 0) return;
    (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
    this._drag = this._fromEvent(ev);
    this._emit("value-changing", this._drag);
  }

  private _move(ev: PointerEvent): void {
    if (this._drag == null) return;
    const v = this._fromEvent(ev);
    if (v !== this._drag) {
      this._drag = v;
      this._emit("value-changing", v);
    }
  }

  private _up(): void {
    if (this._drag == null) return;
    const v = this._drag;
    this._drag = undefined;
    this.position = v;
    this._emit("value-changed", v);
  }

  private _key(ev: KeyboardEvent): void {
    if (!this.settable || this.disabled) return;
    const d: Record<string, number> = { ArrowUp: 5, ArrowRight: 5, ArrowDown: -5, ArrowLeft: -5, PageUp: 25, PageDown: -25, Home: 100, End: -100 };
    if (!(ev.key in d)) return;
    ev.preventDefault();
    const v = Math.min(100, Math.max(0, Math.round(((this.position ?? 0) + d[ev.key]) / 5) * 5));
    this.position = v;
    this._emit("value-changed", v);
  }

  protected render() {
    const v = this._value;
    const unknown = this.position == null && this._drag == null;
    return html`<div class="window ${this.moving ?? ""} ${this._drag != null ? "drag" : ""} ${this._flash ? "flash" : ""}
        ${this.settable && !this.disabled ? "settable" : ""} ${this.disabled ? "disabled" : ""}"
      style="--open:${v / 100}" role=${this.settable ? "slider" : "img"} tabindex=${this.settable && !this.disabled ? 0 : -1}
      aria-label=${this.label} aria-valuemin="0" aria-valuemax="100" aria-valuenow=${unknown ? nothing : v}
      @pointerdown=${this._down} @pointermove=${this._move} @pointerup=${this._up} @pointercancel=${this._up} @keydown=${this._key}>
      <div class="box"></div>
      <div class="glass">
        <div class="sky"><span class="sun"></span></div>
        <div class="rays"></div>
        <div class="mullion"></div>
        <div class="shutter"><div class="slats"></div><div class="edge"></div></div>
      </div>
      <div class="sill"></div>
      ${this.moving ? html`<span class="dir"><ha-icon icon=${this.moving === "opening" ? "mdi:arrow-up" : "mdi:arrow-down"}></ha-icon></span>` : nothing}
    </div>`;
  }

  static styles = css`
    :host { display: block; width: 100%; }
    .window { position: relative; width: min(100%, 230px); margin: 0 auto; touch-action: none; outline: none;
      -webkit-user-select: none; user-select: none; }
    .window:not(.settable) { touch-action: auto; }
    .window.settable { cursor: ns-resize; }
    .window.disabled { opacity: 0.5; }
    .window:focus-visible .glass { box-shadow: 0 0 0 3px var(--hcc-accent, var(--primary-color)); }
    .box { height: 16px; margin: 0 -8px; border-radius: 8px 8px 3px 3px;
      background: linear-gradient(180deg, rgba(127,127,127,0.45), rgba(127,127,127,0.25)); }
    .glass { position: relative; aspect-ratio: 1 / 1.05; overflow: hidden; border-radius: 4px 4px 6px 6px;
      box-shadow: inset 0 0 0 6px rgba(127,127,127,0.35), 0 8px 24px rgba(0,0,0,0.15); }
    /* Farben mit dem Kartenhintergrund gemischt → passt automatisch zu hellem und dunklem Theme */
    .sky { position: absolute; inset: 0; --bg: var(--card-background-color, var(--ha-card-background, #fff));
      background: linear-gradient(180deg, color-mix(in srgb, #6fbaff 72%, var(--bg)) 0%,
        color-mix(in srgb, #b5ddff 72%, var(--bg)) 55%, color-mix(in srgb, #ffe2a6 80%, var(--bg)) 100%); }
    .sun { position: absolute; width: 34%; aspect-ratio: 1; right: 12%; bottom: 14%; border-radius: 50%;
      background: radial-gradient(circle, #fff6c9 0%, #ffd36b 45%, rgba(255,211,107,0) 70%); }
    .rays { position: absolute; inset: 0; pointer-events: none; opacity: calc(var(--open) * 0.8);
      background: linear-gradient(160deg, rgba(255,255,255,0.35), transparent 45%); transition: opacity 0.6s; }
    .mullion { position: absolute; inset: 0; pointer-events: none;
      background: linear-gradient(90deg, transparent calc(50% - 3px), rgba(127,127,127,0.45) calc(50% - 3px), rgba(127,127,127,0.45) calc(50% + 3px), transparent calc(50% + 3px)); }
    .shutter { position: absolute; left: 0; right: 0; top: 0; height: calc((1 - var(--open)) * 100%); min-height: 0;
      transition: height 0.7s cubic-bezier(0.22, 1, 0.36, 1); }
    .window.drag .shutter { transition: none; }
    .slats { position: absolute; inset: 0;
      background-color: color-mix(in srgb, #c9ced6 82%, var(--card-background-color, #fff));
      background-image: repeating-linear-gradient(180deg, rgba(255,255,255,0.55) 0 2px, rgba(0,0,0,0) 2px 9px, rgba(0,0,0,0.18) 9px 11px);
      background-position: 0 100%; box-shadow: 0 6px 12px rgba(0,0,0,0.25); }
    .edge { position: absolute; left: 0; right: 0; bottom: 0; height: 6px; background: #8d939c; border-radius: 0 0 2px 2px;
      box-shadow: 0 0 0 0 transparent; transition: box-shadow 0.4s; }
    .window.flash .edge, .window.drag .edge { box-shadow: 0 0 14px 3px var(--hcc-accent, var(--primary-color)); }
    .window.flash .edge { animation: edge-glow 1.2s ease-out; }
    .opening .slats { animation: slats-up 0.6s linear infinite; }
    .closing .slats { animation: slats-down 0.6s linear infinite; }
    .slats, .edge { animation-play-state: var(--hcc-anim-state, running) !important; }
    .sill { height: 10px; margin: 0 -12px; border-radius: 3px; background: rgba(127,127,127,0.35); }
    .dir { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 40px; height: 40px; border-radius: 50%;
      display: grid; place-items: center; background: color-mix(in srgb, var(--hcc-accent, var(--primary-color)) 85%, transparent);
      color: #fff; box-shadow: 0 4px 14px rgba(0,0,0,0.25); animation: dir-in 0.3s ease-out both; }
    .dir ha-icon { --mdc-icon-size: 24px; }
    .opening .dir ha-icon { animation: nudge-up 0.9s ease-in-out infinite; }
    .closing .dir ha-icon { animation: nudge-down 0.9s ease-in-out infinite; }
    @keyframes slats-up { from { background-position: 0 0; } to { background-position: 0 -11px; } }
    @keyframes slats-down { from { background-position: 0 0; } to { background-position: 0 11px; } }
    @keyframes edge-glow { 0% { box-shadow: 0 0 18px 5px var(--hcc-accent, var(--primary-color)); } 100% { box-shadow: 0 0 0 0 transparent; } }
    @keyframes nudge-up { 0%, 100% { transform: translateY(1px); } 50% { transform: translateY(-3px); } }
    @keyframes nudge-down { 0%, 100% { transform: translateY(-1px); } 50% { transform: translateY(3px); } }
    @keyframes dir-in { from { opacity: 0; transform: translate(-50%, -50%) scale(0.6); } }
    @media (prefers-reduced-motion: reduce) { .slats, .edge, .dir ha-icon { animation: none !important; } }
  `;
}
