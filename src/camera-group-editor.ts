import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CameraGroupCardConfig, HomeAssistant } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

/** Visueller Editor: Titel, Kameras, Alarmanlage, Spalten. */
@customElement("ha-camera-group-card-editor")
export class HaCameraGroupCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: CameraGroupCardConfig;

  public setConfig(config: CameraGroupCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `camera_editor.${key}`);
  }

  private _schema() {
    return [
      { name: "title", selector: { text: {} } },
      { name: "cameras", required: true, selector: { entity: { multiple: true, filter: { domain: "camera" } } } },
      { type: "grid", name: "", schema: [
        { name: "alarm", selector: { entity: { filter: { domain: "alarm_control_panel" } } } },
        { name: "columns", selector: { number: { min: 1, max: 4, mode: "box" } } },
      ] },
      { name: "sort_motion", selector: { boolean: {} } },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, any>;
    const prev = this._config?.cameras ?? [];
    const config: CameraGroupCardConfig = { ...this._config!, ...v,
      cameras: (v.cameras ?? []).map((id: string) => prev.find((p) => typeof p !== "string" && p.entity === id) ?? id) };
    for (const k of ["title", "alarm", "columns"]) if (config[k] === "" || config[k] == null) delete config[k];
    if (config.sort_motion !== false) delete config.sort_motion;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const data = { sort_motion: true, ...this._config, cameras: this._config.cameras?.map((c) => (typeof c === "string" ? c : c.entity)) };
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
