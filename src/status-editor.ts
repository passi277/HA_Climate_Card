import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, StatusCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

@customElement("ha-status-card-editor")
export class HaStatusCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: StatusCardConfig;

  public setConfig(config: StatusCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `status_editor.${key}`);
  }

  private _schema() {
    return [
      { name: "title", selector: { text: {} } },
      { name: "areas", selector: { area: { multiple: true } } },
      { name: "batteries", selector: { entity: { multiple: true, filter: [{ domain: "sensor", device_class: "battery" }, { domain: "binary_sensor", device_class: "battery" }] } } },
      { name: "threshold", selector: { number: { min: 5, max: 60, step: 5, mode: "box", unit_of_measurement: "%" } } },
      { name: "contacts", selector: { entity: { multiple: true, filter: { domain: "binary_sensor" } } } },
      { name: "navigation_path", selector: { navigation: {} } },
      { name: "expanded", selector: { boolean: {} } },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const config = { ...ev.detail.value } as StatusCardConfig;
    if (Array.isArray(config.contacts)) {
      const previous = this._config?.contacts ?? [];
      config.contacts = config.contacts.map((e) => {
        const id = typeof e === "string" ? e : e.entity;
        return previous.find((p) => typeof p !== "string" && p.entity === id) ?? id;
      });
    }
    for (const key of Object.keys(config) as (keyof StatusCardConfig)[]) {
      const v = config[key];
      if (v === "" || v == null || (Array.isArray(v) && !v.length)) delete config[key];
    }
    if (config.threshold === 20) delete config.threshold;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const data = { threshold: 20, ...this._config, contacts: this._config.contacts?.map((e) => (typeof e === "string" ? e : e.entity)) };
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
