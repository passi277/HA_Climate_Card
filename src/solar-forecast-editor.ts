import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, SolarForecastCardConfig, SolarForecastShowConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

const SHOW: (keyof SolarForecastShowConfig)[] = ["days", "chart", "stats"];

/** Visueller Editor: Solcast-Prognose, Ist-Leistung, Ist-Ertrag, Bereiche, Anzahl Tage. */
@customElement("ha-solar-forecast-card-editor")
export class HaSolarForecastCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: SolarForecastCardConfig;

  public setConfig(config: SolarForecastCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `solar_forecast_editor.${key}`);
  }

  private _schema() {
    return [
      { name: "entity", required: true, selector: { entity: { filter: { domain: "sensor", integration: "solcast_solar" } } } },
      { name: "name", selector: { text: {} } },
      { name: "solar", selector: { entity: { filter: { domain: "sensor", device_class: "power" } } } },
      { name: "solar_today", selector: { entity: { filter: { domain: "sensor", device_class: "energy" } } } },
      { type: "grid", name: "", schema: SHOW.map((k) => ({ name: `show_${k}`, selector: { boolean: {} } })) },
      { name: "days", selector: { number: { min: 1, max: 7, mode: "box" } } },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, unknown>;
    const config: SolarForecastCardConfig = { ...this._config!, entity: String(v.entity ?? "") };
    for (const k of ["name", "solar", "solar_today"] as const) if (v[k]) config[k] = String(v[k]); else delete config[k];
    const d = Number(v.days);
    if (Number.isFinite(d) && d > 0 && d !== 7) config.days = d; else delete config.days;
    const show: SolarForecastShowConfig = {};
    for (const k of SHOW) if (v[`show_${k}`] === false) show[k] = false;
    if (Object.keys(show).length) config.show = show; else delete config.show;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const c = this._config;
    const data: Record<string, unknown> = { entity: c.entity, name: c.name, solar: c.solar, solar_today: c.solar_today, days: c.days ?? 7 };
    for (const k of SHOW) data[`show_${k}`] = c.show?.[k] !== false;
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
