import { LitElement, css, html } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { MODE_COLORS, MODE_ICONS } from "../const";

export interface ModeOption { value: string; label: string; }

/** Reihe von Icon-Buttons für die HVAC-Modi. Feuert `mode-selected` mit `{ mode }`. */
@customElement("hcc-mode-bar")
export class ModeBar extends LitElement {
  @property({ attribute: false }) modes: ModeOption[] = [];
  @property() selected?: string;
  @property({ type: Boolean }) disabled = false;

  @query(".indicator") private _indicator?: HTMLElement;
  private _resizeObserver?: ResizeObserver;
  private _placed = false;

  connectedCallback(): void {
    super.connectedCallback();
    this._resizeObserver = new ResizeObserver(() => this._placeIndicator(false));
    this._resizeObserver.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._resizeObserver?.disconnect();
    this._placed = false;
  }

  protected updated(): void {
    this._placeIndicator(this._placed);
  }

  /** Gleitender Hintergrund unter dem aktiven Modus. */
  private _placeIndicator(animate: boolean): void {
    const ind = this._indicator;
    if (!ind) return;
    const btn = this.shadowRoot!.querySelector<HTMLElement>(".mode.on");
    if (!btn) { ind.style.opacity = "0"; return; }
    ind.style.transition = animate ? "" : "none";
    ind.style.opacity = "1";
    ind.style.width = `${btn.offsetWidth}px`;
    ind.style.height = `${btn.offsetHeight}px`;
    ind.style.transform = `translate(${btn.offsetLeft}px, ${btn.offsetTop}px)`;
    ind.style.setProperty("--mode-color", MODE_COLORS[this.selected ?? ""] ?? "var(--primary-color)");
    if (!animate) { void ind.offsetWidth; ind.style.transition = ""; }
    this._placed = true;
  }

  private _select(mode: string): void {
    if (this.disabled || mode === this.selected) return;
    this.dispatchEvent(new CustomEvent("mode-selected", { detail: { mode }, bubbles: true, composed: true }));
  }

  protected render() {
    return html`<div class="bar" role="radiogroup">
      <span class="indicator" aria-hidden="true"></span>
      ${this.modes.map((m) => html`
        <button class="mode ${m.value === this.selected ? "on" : ""}" role="radio"
          aria-checked=${m.value === this.selected} title=${m.label} aria-label=${m.label}
          ?disabled=${this.disabled} style="--mode-color:${MODE_COLORS[m.value] ?? "var(--primary-color)"}"
          @click=${() => this._select(m.value)}>
          <ha-icon .icon=${MODE_ICONS[m.value] ?? "mdi:thermostat"}></ha-icon>
        </button>`)}
    </div>`;
  }

  static styles = css`
    .bar { position: relative; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
    .indicator {
      position: absolute; left: 0; top: 0; border-radius: 14px; pointer-events: none; opacity: 0;
      background: color-mix(in srgb, var(--mode-color) 24%, transparent);
      box-shadow: 0 4px 14px color-mix(in srgb, var(--mode-color) 28%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--mode-color) 35%, transparent);
      transition: transform 0.45s cubic-bezier(0.34, 1.3, 0.64, 1), width 0.3s, background 0.45s, box-shadow 0.45s, opacity 0.2s;
    }
    .mode {
      flex: 1 1 0; min-width: 40px; max-width: 64px; height: 44px; border: none; border-radius: 14px;
      background: var(--hcc-chip-bg, rgba(127,127,127,0.12)); color: var(--secondary-text-color);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: background 0.25s, color 0.25s, transform 0.1s;
    }
    .mode:hover { background: rgba(127,127,127,0.2); }
    .mode:active { transform: scale(0.94); }
    .mode { position: relative; z-index: 1; }
    .mode.on, .mode.on:hover { background: transparent; color: var(--mode-color); }
    .mode.on ha-icon { animation: pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
    @keyframes pop { 0% { transform: scale(0.7); } 100% { transform: scale(1); } }
    @media (prefers-reduced-motion: reduce) { .indicator { transition: none; } .mode.on ha-icon { animation: none; } }
    .mode:focus-visible { outline: 2px solid var(--mode-color); outline-offset: 2px; }
    .mode:disabled { cursor: default; opacity: 0.5; }
    ha-icon { --mdc-icon-size: 22px; }
  `;
}
