import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { MODE_COLORS, MODE_ICONS } from "../const";

export interface ModeOption { value: string; label: string; }

/** Reihe von Icon-Buttons für die HVAC-Modi. Feuert `mode-selected` mit `{ mode }`. */
@customElement("hcc-mode-bar")
export class ModeBar extends LitElement {
  @property({ attribute: false }) modes: ModeOption[] = [];
  @property() selected?: string;
  @property({ type: Boolean }) disabled = false;

  private _select(mode: string): void {
    if (this.disabled || mode === this.selected) return;
    this.dispatchEvent(new CustomEvent("mode-selected", { detail: { mode }, bubbles: true, composed: true }));
  }

  protected render() {
    return html`<div class="bar" role="radiogroup">
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
    .bar { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
    .mode {
      flex: 1 1 0; min-width: 40px; max-width: 64px; height: 44px; border: none; border-radius: 14px;
      background: var(--hcc-chip-bg, rgba(127,127,127,0.12)); color: var(--secondary-text-color);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: background 0.25s, color 0.25s, transform 0.1s;
    }
    .mode:hover { background: rgba(127,127,127,0.2); }
    .mode:active { transform: scale(0.94); }
    .mode.on { background: color-mix(in srgb, var(--mode-color) 22%, transparent); color: var(--mode-color); }
    .mode:focus-visible { outline: 2px solid var(--mode-color); outline-offset: 2px; }
    .mode:disabled { cursor: default; opacity: 0.5; }
    ha-icon { --mdc-icon-size: 22px; }
  `;
}
