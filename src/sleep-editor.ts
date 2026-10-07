import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, SleepCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

/** Visueller Editor: Name; Personen (Schlafmodus, Timer, Klima, Lampen, Medien, Wecker) als Liste. */
@customElement("ha-sleep-card-editor")
export class HaSleepCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: SleepCardConfig;

  public setConfig(config: SleepCardConfig): void {
    this._config = config;
  }

  private _schema() {
    return [
      { name: "name", selector: { text: {} } },
      { name: "persons", selector: { object: {} } },
    ];
  }

  private _computeLabel = (s: { name: string }): string => localize(this.hass, `sleep_editor.${s.name}`);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, unknown>;
    const config = { ...this._config! } as Record<string, unknown>;
    for (const [k, val] of Object.entries(v)) {
      if (val === "" || val == null || (Array.isArray(val) && !val.length)) delete config[k];
      else config[k] = val;
    }
    this._config = config as SleepCardConfig;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    return html`<ha-form .hass=${this.hass} .data=${this._config} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <p class="hint">${localize(this.hass, "sleep_editor.hint")}</p>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .hint { font-size: 12.5px; color: var(--secondary-text-color); }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
