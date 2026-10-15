import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CameraCardConfig, HomeAssistant } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

/** Visueller Editor: Kamera, Name, weitere Linsen, Ansicht; alles andere wird über das Gerät erkannt. */
@customElement("ha-camera-card-editor")
export class HaCameraCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: CameraCardConfig;

  public setConfig(config: CameraCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `camera_editor.${key}`);
  }

  private _schema() {
    return [
      { name: "entity", required: true, selector: { entity: { filter: { domain: "camera" } } } },
      { type: "grid", name: "", schema: [
        { name: "name", selector: { text: {} } },
        { name: "camera_view", selector: { select: { mode: "dropdown", options: ["auto", "live", "snapshot"].map((v) => ({ value: v, label: this._t(`view_${v}`) })) } } },
      ] },
      { name: "lenses", selector: { entity: { multiple: true, filter: { domain: "camera" } } } },
      { name: "patrol", selector: { entity: { filter: { domain: "script" } } } },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const config = { ...ev.detail.value } as CameraCardConfig;
    const prev = this._config?.lenses ?? [];
    if (Array.isArray(config.lenses)) config.lenses = config.lenses.map((l) => prev.find((p) => typeof p !== "string" && p.entity === l) ?? l);
    for (const k of Object.keys(config)) {
      const v = (config as any)[k];
      if (v === "" || v == null || (Array.isArray(v) && !v.length) || (k === "camera_view" && v === "auto")) delete (config as any)[k];
    }
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const data = { camera_view: "auto", ...this._config, lenses: this._config.lenses?.map((l) => (typeof l === "string" ? l : l.entity)) };
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
