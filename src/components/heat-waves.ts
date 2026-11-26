import { LitElement, css, html, svg } from "lit";
import { customElement, property } from "lit/decorators.js";

/**
 * Wärmewellen für Heizungen: weiche, waagerechte Hitzeschlieren, die vom unteren Kartenrand
 * aufsteigen, leicht flimmern und verblassen. Das Tempo folgt der Ventilöffnung (0–1).
 */
@customElement("hcc-heat-waves")
export class HeatWaves extends LitElement {
  @property({ type: Number }) intensity = 0.5;
  @property() color = "var(--state-climate-heat-color, #ff6d00)";

  protected render() {
    const duration = (7 - Math.max(0, Math.min(1, this.intensity)) * 3.5).toFixed(2);
    const wave = (y: number, amp: number) =>
      `M -20 ${y} Q 25 ${y - amp} 70 ${y} T 160 ${y} T 250 ${y} T 340 ${y}`;
    return html`<svg viewBox="0 0 300 120" preserveAspectRatio="none" style="--d:${duration}s;--c:${this.color}">
      ${[0, 1, 2, 3].map((i) => svg`<path d=${wave(112, 7 + (i % 2) * 3)}
        style="animation-delay:-${((Number(duration) / 4) * i).toFixed(2)}s"></path>`)}
    </svg>`;
  }

  static styles = css`
    :host { position: absolute; inset: auto 0 0 0; height: 38%; pointer-events: none; z-index: -1; overflow: hidden; }
    svg { width: 100%; height: 100%; display: block; overflow: visible; }
    path { fill: none; stroke: var(--c); stroke-width: 3; stroke-linecap: round; vector-effect: non-scaling-stroke;
      opacity: 0; filter: blur(1.5px); transform-box: view-box;
      animation: rise var(--d) ease-out infinite; animation-play-state: var(--hcc-anim-state, running); }
    @keyframes rise {
      0% { transform: translate(0, 0) scaleY(1); opacity: 0; }
      15% { opacity: 0.28; }
      50% { transform: translate(-12px, -55px) scaleY(1.4); opacity: 0.18; }
      100% { transform: translate(8px, -110px) scaleY(1.8); opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) { path { animation: none; opacity: 0.12; } }
  `;
}
