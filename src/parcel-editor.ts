import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, ParcelCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

/** Visueller Editor: Name, zugestellte Pakete (Tage), „+ Paket“, max. Pakete. */
@customElement("ha-parcel-card-editor")
export class HaParcelCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: ParcelCardConfig;

  public setConfig(config: ParcelCardConfig): void {
    this._config = config;
  }

  private _schema() {
    return [
      { name: "name", selector: { text: {} } },
      { type: "grid", name: "", schema: [
        { name: "delivered_days", selector: { number: { min: 0, max: 30, mode: "box" } } },
        { name: "max_items", selector: { number: { min: 1, max: 50, mode: "box" } } },
      ] },
      { name: "show_add", selector: { boolean: {} } },
    ];
  }

  private _computeLabel = (s: { name: string }): string => localize(this.hass, `parcel_editor.${s.name}`);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, unknown>;
    const config: ParcelCardConfig = { ...this._config! };
    if (v.name) config.name = String(v.name); else delete config.name;
    const days = Number(v.delivered_days);
    if (Number.isFinite(days) && days !== 3) config.delivered_days = days; else delete config.delivered_days;
    const max = Number(v.max_items);
    if (Number.isFinite(max) && max > 0 && max !== 8) config.max_items = max; else delete config.max_items;
    if (v.show_add === false) config.show_add = false; else delete config.show_add;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const c = this._config;
    const data = { name: c.name, delivered_days: c.delivered_days ?? 3, max_items: c.max_items ?? 8, show_add: c.show_add !== false };
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <p class="hint">${localize(this.hass, "parcel_editor.hint")}</p>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .hint { font-size: 12.5px; color: var(--secondary-text-color); }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
