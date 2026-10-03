import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

export interface AttributeOption { value: string; label: string; }

/**
 * Beschriftete Chip-Reihe für fan_mode / swing_mode / preset_mode o.ä.
 * Feuert `option-selected` mit `{ value }`.
 */
@customElement("hcc-attribute-select")
export class AttributeSelect extends LitElement {
  @property() label = "";
  @property() icon?: string;
  @property() selected?: string;
  @property({ attribute: false }) options: AttributeOption[] = [];
  @property({ type: Boolean }) disabled = false;

  private _select(value: string): void {
    if (this.disabled || value === this.selected) return;
    this.dispatchEvent(new CustomEvent("option-selected", { detail: { value }, bubbles: true, composed: true }));
  }

  protected render() {
    return html`
      <div class="head">
        ${this.icon ? html`<ha-icon .icon=${this.icon}></ha-icon>` : nothing}
        <span>${this.label}</span>
      </div>
      <div class="chips" role="radiogroup" aria-label=${this.label}>
        ${this.options.map((o) => html`
          <button class="chip ${o.value === this.selected ? "on" : ""}" role="radio"
            aria-checked=${o.value === this.selected} ?disabled=${this.disabled}
            @click=${() => this._select(o.value)}>${o.label}</button>`)}
      </div>`;
  }

  static styles = css`
    :host { display: block; }
    .head { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500;
      color: var(--secondary-text-color); margin: 0 2px 6px; text-transform: uppercase; letter-spacing: 0.04em; }
    .head ha-icon { --mdc-icon-size: 16px; }
    .chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
    .chips::-webkit-scrollbar { display: none; }
    .chip {
      flex: 0 0 auto; border: none; border-radius: 999px; padding: 7px 14px; font: inherit; font-size: 13px;
      background: var(--hcc-chip-bg, rgba(127,127,127,0.12)); color: var(--primary-text-color);
      cursor: pointer; transition: background 0.2s, color 0.2s;
    }
    .chip:hover { background: rgba(127,127,127,0.2); }
    .chip.on { background: var(--hcc-accent, var(--primary-color)); color: var(--text-primary-color, #fff); }
    .chip:focus-visible { outline: 2px solid var(--hcc-accent, var(--primary-color)); outline-offset: 2px; }
    .chip:disabled { opacity: 0.5; cursor: default; }
  `;
}
