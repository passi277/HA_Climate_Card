import { LitElement, css, html, svg } from "lit";
import { customElement, property } from "lit/decorators.js";

/**
 * Dezente Luftstrom-Animation hinter dem Kartenkopf: Geschwindigkeit folgt der Lüfterstufe,
 * vertikale/horizontale Lamellenbewegung lässt den Luftstrom pendeln.
 */
@customElement("hcc-airflow")
export class Airflow extends LitElement {
  /** 0 (langsam) … 1 (schnell) */
  @property({ type: Number }) speed = 0.5;
  @property({ type: Boolean }) swingVertical = false;
  @property({ type: Boolean }) swingHorizontal = false;
  @property() color = "var(--primary-color)";

  protected render() {
    const duration = (2.8 - this.speed * 2).toFixed(2);
    const lines = [-75, -50, -25, 0, 25, 50, 75];
    return html`<svg viewBox="0 0 300 110" preserveAspectRatio="none"
      class="${this.swingVertical ? "sv" : ""} ${this.swingHorizontal ? "sh" : ""}"
      style="--d:${duration}s;--c:${this.color}">
      <g class="fan">
        ${lines.map((dx, i) => {
          const x0 = 150 + dx;
          const x1 = 150 + dx * 1.5;
          const d = `M ${x0} 0 C ${x0 + dx * 0.15} 40, ${x1 - dx * 0.1} 75, ${x1} 110`;
          return svg`<path d=${d} style="animation-delay:-${(i * 0.37).toFixed(2)}s"></path>`;
        })}
      </g>
    </svg>`;
  }

  static styles = css`
    :host { position: absolute; inset: 0 0 auto 0; height: 34%; pointer-events: none; z-index: -1; overflow: hidden;
      -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, transparent 90%); mask-image: linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, transparent 90%); }
    svg { width: 100%; height: 100%; display: block; }
    path { fill: none; stroke: var(--c); stroke-opacity: 0.22; stroke-width: 1.5; stroke-linecap: round;
      vector-effect: non-scaling-stroke; stroke-dasharray: 6 34; animation: flow var(--d) linear infinite; }
    .fan { transform-origin: 150px 0; transform-box: view-box; }
    path { transform: translateZ(0); }
    .sv .fan { animation: sv 6s ease-in-out infinite; }
    .sh .fan { animation: sh 7s ease-in-out infinite; }
    .sv.sh .fan { animation: sv 6s ease-in-out infinite, sh 7s ease-in-out infinite; }
    @keyframes flow { from { stroke-dashoffset: 40; } to { stroke-dashoffset: 0; } }
    @keyframes sv { 0%, 100% { scale: 1 0.75; } 50% { scale: 1 1.15; } }
    @keyframes sh { 0%, 100% { rotate: -8deg; } 50% { rotate: 8deg; } }
    @media (prefers-reduced-motion: reduce) { path, .fan { animation: none !important; } }
  `;
}
