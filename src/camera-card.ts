import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CameraCardConfig, HomeAssistant } from "./types";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import "./components/camera-view";
import "./camera-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-camera-card",
  name: "Modern Camera Card",
  description: "Eine Kamera (z.B. Reolink, Blink): Livebild oder Standbild, Erkennung (Person, Fahrzeug, Tier, Bewegung), Licht, Sirene, Schwenken und Positionen – alles automatisch über das Gerät erkannt (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

@customElement("ha-camera-card")
export class HaCameraCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: CameraCardConfig;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-camera-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<CameraCardConfig> {
    return { entity: Object.keys(hass.states).find((id) => id.startsWith("camera.")) ?? "" };
  }

  public setConfig(config: CameraCardConfig): void {
    if (!config?.entity || !config.entity.startsWith("camera.")) throw new Error("ha-camera-card: 'entity' (camera.*) angeben");
    this._config = { ...config };
  }

  public getCardSize(): number {
    return 6;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    return html`<ha-card class="camera anim-${this._config.animations ?? "full"}">
      <hcc-camera-view .hass=${this.hass} .config=${this._config}></hcc-camera-view>
    </ha-card>`;
  }

  static styles = [cardStyles, css`ha-card.camera { padding: 10px; gap: 0; }`];
}
