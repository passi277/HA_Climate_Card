import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { skyPhase, sunPlacement, weatherOverlay, type SunInfo } from "../utils";

/**
 * Fenster mit Rollladen: Der Panzer fährt entsprechend der Öffnung herunter, durch den offenen
 * Teil sieht man den Himmel nach Sonnenstand (Tag/Dämmerung/Nacht mit Mond) und Wetter.
 * Senkrecht ziehen (oder Pfeiltasten) stellt die Position ein.
 * Während einer Fahrt gleitet der Panzer gleichmäßig zum Ziel (echte Rollläden melden ihre
 * Position meist erst am Ende); Stopp hält ihn sanft an. Feuert `value-changing` beim Ziehen
 * und `value-changed` beim Loslassen.
 */
@customElement("hcc-cover-window")
export class CoverWindow extends LitElement {
  /** Öffnung in % (100 = offen) */
  @property({ type: Number }) position?: number;
  @property() moving?: "opening" | "closing";
  /** Ziel der laufenden Fahrt (sonst ganz auf/zu je nach Richtung) */
  @property({ type: Number }) target?: number;
  /** Fahrzeit 0 → 100 % in Sekunden */
  @property({ type: Number }) travelTime = 20;
  /** Sonnenstand (sonst neutraler Tageshimmel) */
  @property({ attribute: false }) sun?: SunInfo;
  /** Wetterzustand (weather.*), z.B. "rainy" */
  @property() weather?: string;
  /** Position einstellbar (sonst nur Anzeige) */
  @property({ type: Boolean }) settable = true;
  @property({ type: Boolean }) disabled = false;
  @property() label = "";

  @state() private _drag?: number;
  @state() private _flash = false;
  private _flashTimer?: number;

  protected willUpdate(changed: PropertyValues): void {
    const old = changed.get("position") as number | undefined;
    const wasMoving = changed.has("moving") && changed.get("moving") && !this.moving;
    if (this.hasUpdated && this._drag == null && !this.moving
      && (wasMoving || (changed.has("position") && old != null && old !== this.position))) this._pulse();
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

  /** Angezeigte Öffnung und Übergang: während der Fahrt linear zum Ziel, sonst weich. */
  private _motion(): { value: number; transition: string } {
    if (this._drag != null) return { value: this._drag, transition: "none" };
    const pos = this.position ?? 0;
    if (this.moving) {
      const goal = this.target ?? (this.moving === "opening" ? 100 : 0);
      const secs = (Math.abs(goal - pos) / 100) * Math.max(1, this.travelTime);
      return { value: goal, transition: `height ${Math.max(0.6, secs).toFixed(2)}s linear` };
    }
    return { value: pos, transition: "height 0.9s cubic-bezier(0.22, 1, 0.36, 1)" };
  }

  private _renderSky() {
    const phase = skyPhase(this.sun?.elevation);
    const w = weatherOverlay(this.weather);
    const sunPos = this.sun ? sunPlacement(this.sun) : { x: 74, y: 70 };
    const showSun = phase === "day" || (phase === "twilight" && (this.sun?.elevation ?? 0) > -3);
    return html`<div class="sky ${phase}">
      <div class="stars"></div>
      ${showSun ? html`<span class="sun ${phase}" style="left:${sunPos.x}%;top:${sunPos.y}%"></span>` : nothing}
      ${phase !== "day" && !showSun ? html`<span class="horizon-glow ${this.sun?.rising ? "east" : "west"}"></span>` : nothing}
      ${phase === "night" ? html`<span class="moon" style="left:${Math.min(78, Math.max(22, 100 - sunPos.x))}%"></span>` : nothing}
      ${w.clouds ? html`<span class="cloud c1"></span>${w.clouds > 1 ? html`<span class="cloud c2"></span><span class="cloud c3"></span>` : nothing}` : nothing}
      ${w.rain ? html`<span class="rain"></span>` : nothing}
      ${w.snow ? html`<span class="snow"></span>` : nothing}
      ${w.fog ? html`<span class="fog"></span>` : nothing}
    </div>`;
  }

  protected render() {
    const { value, transition } = this._motion();
    const unknown = this.position == null && this._drag == null;
    const phase = skyPhase(this.sun?.elevation);
    return html`<div class="window ${this.moving ?? ""} ${this._drag != null ? "drag" : ""} ${this._flash ? "flash" : ""} ${phase}
        ${this.settable && !this.disabled ? "settable" : ""} ${this.disabled ? "disabled" : ""}"
      style="--open:${value / 100}" role=${this.settable ? "slider" : "img"} tabindex=${this.settable && !this.disabled ? 0 : -1}
      aria-label=${this.label} aria-valuemin="0" aria-valuemax="100" aria-valuenow=${unknown ? nothing : (this._drag ?? this.position)}
      @pointerdown=${this._down} @pointermove=${this._move} @pointerup=${this._up} @pointercancel=${this._up} @keydown=${this._key}>
      <div class="box"></div>
      <div class="glass">
        ${this._renderSky()}
        <div class="rays"></div>
        <div class="mullion"></div>
        <div class="shutter" style="transition:${transition}"><div class="slats"></div><div class="edge"></div></div>
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

    /* Himmel: Farben mit dem Kartenhintergrund gemischt → passt zu hellem und dunklem Theme.
       Phasen: Tag, Dämmerung (Abend-/Morgenrot), Nacht mit Mond und Sternen. */
    .sky { position: absolute; inset: 0; overflow: hidden; --bg: var(--card-background-color, var(--ha-card-background, #fff)); }
    .sky.day { background: linear-gradient(180deg, color-mix(in srgb, #6fbaff 72%, var(--bg)) 0%,
        color-mix(in srgb, #b5ddff 72%, var(--bg)) 55%, color-mix(in srgb, #ffe2a6 80%, var(--bg)) 100%); }
    .sky.twilight { background: linear-gradient(180deg, color-mix(in srgb, #3a3f78 80%, var(--bg)) 0%,
        color-mix(in srgb, #a05a8c 78%, var(--bg)) 55%, color-mix(in srgb, #ff9a5a 85%, var(--bg)) 100%); }
    .sky.night { background: linear-gradient(180deg, #0b1330 0%, #17244d 60%, #263a6b 100%); }
    .stars { position: absolute; inset: 0; opacity: 0; transition: opacity 1.2s;
      background-image:
        radial-gradient(1.4px 1.4px at 12% 18%, #fff 60%, transparent), radial-gradient(1px 1px at 28% 42%, #fff 60%, transparent),
        radial-gradient(1.2px 1.2px at 44% 12%, #fff 60%, transparent), radial-gradient(1px 1px at 63% 30%, #fff 60%, transparent),
        radial-gradient(1.5px 1.5px at 78% 14%, #fff 60%, transparent), radial-gradient(1px 1px at 86% 48%, #fff 60%, transparent),
        radial-gradient(1.2px 1.2px at 20% 66%, #fff 60%, transparent), radial-gradient(1px 1px at 52% 58%, #fff 60%, transparent),
        radial-gradient(1px 1px at 92% 72%, #fff 60%, transparent), radial-gradient(1.3px 1.3px at 36% 80%, #fff 60%, transparent); }
    .sky.night .stars { opacity: 0.85; }
    .sky.twilight .stars { opacity: 0.25; }
    .sun { position: absolute; width: 34%; aspect-ratio: 1; border-radius: 50%; transform: translate(-50%, -50%);
      background: radial-gradient(circle, #fff6c9 0%, #ffd36b 45%, rgba(255,211,107,0) 70%);
      transition: left 2s ease, top 2s ease, background 1.2s; }
    .sun.twilight { width: 40%; background: radial-gradient(circle, #ffe0b0 0%, #ff8a4c 40%, rgba(255,110,60,0) 70%); }
    .horizon-glow { position: absolute; bottom: -20%; width: 90%; height: 55%; border-radius: 50%;
      background: radial-gradient(closest-side, rgba(255,150,90,0.75), rgba(255,120,80,0)); }
    .horizon-glow.east { left: -25%; }
    .horizon-glow.west { right: -25%; }
    .sky.night .horizon-glow { opacity: 0; }
    /* Mondsichel: heller Kreis, per Maske ausgeschnitten (passt zu jeder Himmelsfarbe) */
    .moon { position: absolute; top: 56%; width: 22%; aspect-ratio: 1; border-radius: 50%; transform: translateX(-50%);
      background: radial-gradient(circle at 40% 40%, #fffbe6, #e9e3c4 70%);
      filter: drop-shadow(0 0 8px rgba(255,250,220,0.45));
      -webkit-mask: radial-gradient(circle at 78% 32%, transparent 46%, #000 47%);
      mask: radial-gradient(circle at 78% 32%, transparent 46%, #000 47%); }
    .cloud { position: absolute; height: 18%; border-radius: 999px; filter: blur(2px);
      background: color-mix(in srgb, #ffffff 85%, var(--bg)); box-shadow: 0 0 0 0 transparent; }
    .sky.night .cloud { background: rgba(120,130,160,0.55); }
    .sky.twilight .cloud { background: rgba(255,210,200,0.6); }
    .cloud::before { content: ""; position: absolute; left: 22%; bottom: 40%; width: 50%; height: 120%; border-radius: 50%; background: inherit; }
    .cloud.c1 { left: 6%; top: 52%; width: 42%; opacity: 0.85; }
    .cloud.c2 { right: -8%; top: 30%; width: 52%; opacity: 0.8; }
    .cloud.c3 { left: 24%; top: 70%; width: 40%; opacity: 0.7; }
    .rain { position: absolute; inset: 30% 0 0; opacity: 0.55;
      background: repeating-linear-gradient(105deg, transparent 0 9px, rgba(200,220,255,0.8) 9px 10px, transparent 10px 18px); }
    .snow { position: absolute; inset: 25% 0 0; opacity: 0.8;
      background-image: radial-gradient(2px 2px at 15% 20%, #fff 60%, transparent), radial-gradient(2px 2px at 45% 50%, #fff 60%, transparent),
        radial-gradient(2px 2px at 75% 30%, #fff 60%, transparent), radial-gradient(2px 2px at 30% 80%, #fff 60%, transparent),
        radial-gradient(2px 2px at 85% 75%, #fff 60%, transparent); }
    .fog { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(220,225,235,0.2), rgba(220,225,235,0.75)); }
    .rays { position: absolute; inset: 0; pointer-events: none; opacity: calc(var(--open) * 0.8);
      background: linear-gradient(160deg, rgba(255,255,255,0.35), transparent 45%); transition: opacity 0.6s; }
    .window.night .rays, .window.twilight .rays { opacity: 0; }
    .mullion { position: absolute; inset: 0; pointer-events: none;
      background: linear-gradient(90deg, transparent calc(50% - 3px), rgba(127,127,127,0.45) calc(50% - 3px), rgba(127,127,127,0.45) calc(50% + 3px), transparent calc(50% + 3px)); }

    /* Panzer: Höhe = geschlossener Anteil. Übergang kommt aus _motion() (linear während der Fahrt). */
    .shutter { position: absolute; left: 0; right: 0; top: 0; height: calc((1 - var(--open)) * 100%); will-change: height; }
    .slats { position: absolute; inset: 0;
      background-color: color-mix(in srgb, #c9ced6 82%, var(--card-background-color, #fff));
      background-image: repeating-linear-gradient(180deg, rgba(255,255,255,0.55) 0 2px, rgba(0,0,0,0) 2px 9px, rgba(0,0,0,0.18) 9px 11px);
      background-position: 0 100%; box-shadow: 0 6px 12px rgba(0,0,0,0.25); }
    .window.night .slats { background-color: color-mix(in srgb, #8d95a3 82%, var(--card-background-color, #fff)); }
    .edge { position: absolute; left: 0; right: 0; bottom: 0; height: 6px; background: #8d939c; border-radius: 0 0 2px 2px;
      box-shadow: 0 0 0 0 transparent; transition: box-shadow 0.6s ease; }
    .window.drag .edge, .window.opening .edge, .window.closing .edge { box-shadow: 0 0 12px 2px color-mix(in srgb, var(--hcc-accent, var(--primary-color)) 80%, transparent); }
    .window.flash .edge { animation: edge-glow 1.4s ease-out; }
    .edge { animation-play-state: var(--hcc-anim-state, running) !important; }
    .sill { height: 10px; margin: 0 -12px; border-radius: 3px; background: rgba(127,127,127,0.35); }
    .dir { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 40px; height: 40px; border-radius: 50%;
      display: grid; place-items: center; background: color-mix(in srgb, var(--hcc-accent, var(--primary-color)) 85%, transparent);
      color: #fff; box-shadow: 0 4px 14px rgba(0,0,0,0.25); animation: dir-in 0.4s ease-out both; }
    .dir ha-icon { --mdc-icon-size: 24px; }
    .opening .dir ha-icon { animation: nudge-up 1.4s ease-in-out infinite; }
    .closing .dir ha-icon { animation: nudge-down 1.4s ease-in-out infinite; }
    @keyframes edge-glow { 0% { box-shadow: 0 0 18px 5px var(--hcc-accent, var(--primary-color)); } 100% { box-shadow: 0 0 0 0 transparent; } }
    @keyframes nudge-up { 0%, 100% { transform: translateY(1px); } 50% { transform: translateY(-2px); } }
    @keyframes nudge-down { 0%, 100% { transform: translateY(-1px); } 50% { transform: translateY(2px); } }
    @keyframes dir-in { from { opacity: 0; transform: translate(-50%, -50%) scale(0.6); } }
    @media (prefers-reduced-motion: reduce) { .edge, .dir ha-icon { animation: none !important; } }
  `;
}
