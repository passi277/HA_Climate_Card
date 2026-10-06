import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, StarlinkCardConfig, StarlinkShowConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

const SHOW: (keyof StarlinkShowConfig)[] = ["live", "speedtest", "history", "usage", "controls"];

/** Visueller Editor: Starlink-Entität, Speedtest-Sensor, Name, Bereiche; alles Weitere wird über das Gerät erkannt. */
@customElement("ha-starlink-card-editor")
export class HaStarlinkCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: StarlinkCardConfig;

  public setConfig(config: StarlinkCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `starlink_editor.${key}`);
  }

  private _schema() {
    return [
      { name: "entity", selector: { entity: { filter: { integration: "starlink" } } } },
      { name: "speedtest", selector: { entity: { filter: { integration: "speedtestdotnet" } } } },
      { name: "name", selector: { text: {} } },
      { type: "grid", name: "", schema: SHOW.map((k) => ({ name: `show_${k}`, selector: { boolean: {} } })) },
      { name: "history_days", selector: { number: { min: 1, max: 30, mode: "box", unit_of_measurement: "d" } } },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, unknown>;
    const config: StarlinkCardConfig = { ...this._config! };
    for (const k of ["entity", "speedtest", "name"] as const) {
      if (v[k]) config[k] = String(v[k]); else delete config[k];
    }
    const days = Number(v.history_days);
    if (Number.isFinite(days) && days > 0 && days !== 7) config.history_days = days; else delete config.history_days;
    const show: StarlinkShowConfig = {};
    for (const k of SHOW) if (v[`show_${k}`] === false) show[k] = false;
    if (Object.keys(show).length) config.show = show; else delete config.show;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const data: Record<string, unknown> = { entity: this._config.entity, speedtest: this._config.speedtest, name: this._config.name,
      history_days: this._config.history_days ?? 7 };
    for (const k of SHOW) data[`show_${k}`] = this._config.show?.[k] !== false;
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
