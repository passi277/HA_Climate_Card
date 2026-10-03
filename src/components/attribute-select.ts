import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

export interface AttributeOption { value: string; label: string; }

/**
 * Beschriftete Auswahl für fan_mode / swing_mode / preset_mode o.ä. – als Chip-Reihe,
 * bei mehr als `dropdownThreshold` Optionen als Dropdown. Feuert `option-selected` mit `{ value }`.
 */
@customElement("hcc-attribute-select")
export class AttributeSelect extends LitElement {
  @property() label = "";
  @property() icon?: string;
  @property() selected?: string;
  @property({ attribute: false }) options: AttributeOption[] = [];
  @property({ type: Boolean }) disabled = false;
  /** Ab dieser Anzahl Optionen wird ein Dropdown statt Chips gezeigt (0 = immer Chips). */
  @property({ type: Number }) dropdownThreshold = 6;

  private _select(value: string): void {
    if (this.disabled || value === this.selected) return;
    this.dispatchEvent(new CustomEvent("option-selected", { detail: { value }, bubbles: true, composed: true }));
  }

  private get _useDropdown(): boolean {
    return this.dropdownThreshold > 0 && this.options.length > this.dropdownThreshold;
  }

  private _renderDropdown() {
    return html`<div class="dropdown-row">
      ${this._renderHead()}
      <label class="select">
        <select aria-label=${this.label} ?disabled=${this.disabled}
          @change=${(e: Event) => this._select((e.target as HTMLSelectElement).value)}>
          ${this.selected != null && !this.options.some((o) => o.value === this.selected)
            ? html`<option value=${this.selected} selected>${this.selected}</option>` : nothing}
          ${this.options.map((o) => html`<option value=${o.value} ?selected=${o.value === this.selected}>${o.label}</option>`)}
        </select>
        <ha-icon icon="mdi:chevron-down"></ha-icon>
      </label>
    </div>`;
  }

  private _renderHead() {
    return html`<div class="head">
      ${this.icon ? html`<ha-icon .icon=${this.icon}></ha-icon>` : nothing}
      <span>${this.label}</span>
    </div>`;
  }

  protected render() {
    if (this._useDropdown) return this._renderDropdown();
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
    .dropdown-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .dropdown-row .head { margin: 0 2px; flex: none; }
    .select { position: relative; display: flex; align-items: center; min-width: 0; flex: 0 1 auto; }
    .select select {
      appearance: none; -webkit-appearance: none; border: none; border-radius: 999px; font: inherit; font-size: 13px;
      padding: 8px 34px 8px 14px; max-width: 100%; text-overflow: ellipsis; cursor: pointer;
      background: var(--hcc-accent, var(--primary-color)); color: var(--text-primary-color, #fff);
    }
    .select select option { color: var(--primary-text-color); background: var(--card-background-color, #fff); }
    .select select:focus-visible { outline: 2px solid var(--hcc-accent, var(--primary-color)); outline-offset: 2px; }
    .select select:disabled { opacity: 0.5; cursor: default; }
    .select ha-icon { position: absolute; right: 10px; pointer-events: none; --mdc-icon-size: 18px; color: var(--text-primary-color, #fff); }
  `;
}
