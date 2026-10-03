import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, VacuumCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

@customElement("ha-vacuum-card-editor")
export class HaVacuumCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: VacuumCardConfig;

  public setConfig(config: VacuumCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `vacuum_editor.${key}`);
  }

  private _schema() {
    return [
      { name: "entity", required: true, selector: { entity: { domain: "vacuum" } } },
      { type: "grid", name: "", schema: [
        { name: "name", selector: { text: {} } },
        { name: "icon", selector: { icon: {} } },
      ] },
      { name: "map", selector: { entity: { filter: { domain: ["image", "camera"] } } } },
      { type: "expandable", name: "show", title: this._t("sections"), icon: "mdi:eye-outline", schema: [
        { type: "grid", name: "", schema: ["map", "rooms", "controls", "shortcuts", "settings", "maintenance"].map((k) => ({ name: k, selector: { boolean: {} } })) },
      ] },
      { name: "selects", selector: { entity: { multiple: true, filter: { domain: "select" } } } },
      { name: "shortcuts", selector: { entity: { multiple: true, filter: { domain: ["button", "script"] } } } },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const config = { ...ev.detail.value } as VacuumCardConfig;
    for (const key of Object.keys(config) as (keyof VacuumCardConfig)[]) {
      const v = config[key];
      if (v === "" || v == null || (Array.isArray(v) && !v.length)) delete config[key];
    }
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const data = { ...this._config, show: { map: true, rooms: true, controls: true, shortcuts: true, settings: true, maintenance: true, ...(this._config.show ?? {}) } };
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <p class="hint">${this._t("hint")}</p>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .hint { font-size: 12px; color: var(--secondary-text-color); margin: 8px 2px 0; }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
