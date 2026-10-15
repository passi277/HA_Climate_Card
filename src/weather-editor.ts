import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, WeatherCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

const SHOW = ["details", "hourly", "daily"] as const;

/** Visueller Editor: Wetter-Entität, Name, Bereiche, Tage und Stunden. */
@customElement("ha-weather-card-editor")
export class HaWeatherCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: WeatherCardConfig;

  public setConfig(config: WeatherCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `weather_editor.${key}`);
  }

  private _schema() {
    return [
      { name: "entity", required: true, selector: { entity: { filter: { domain: "weather" } } } },
      { name: "name", selector: { text: {} } },
      { type: "grid", name: "", schema: [...SHOW.map((k) => ({ name: `show_${k}`, selector: { boolean: {} } })), { name: "collapsed", selector: { boolean: {} } }] },
      { type: "grid", name: "", schema: [
        { name: "days", selector: { number: { min: 3, max: 10, mode: "box" } } },
        { name: "hours", selector: { number: { min: 6, max: 48, mode: "box", unit_of_measurement: "h" } } },
      ] },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, unknown>;
    const config: WeatherCardConfig = { ...this._config!, entity: String(v.entity ?? "") };
    if (v.name) config.name = String(v.name); else delete config.name;
    for (const k of SHOW) { if (v[`show_${k}`] === false) config[`show_${k}`] = false; else delete config[`show_${k}`]; }
    if (v.collapsed) config.collapsed = true; else delete config.collapsed;
    const d = Number(v.days), h = Number(v.hours);
    if (Number.isFinite(d) && d > 0 && d !== 7) config.days = d; else delete config.days;
    if (Number.isFinite(h) && h > 0 && h !== 24) config.hours = h; else delete config.hours;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const c = this._config;
    const data: Record<string, unknown> = { entity: c.entity, name: c.name, days: c.days ?? 7, hours: c.hours ?? 24, collapsed: !!c.collapsed };
    for (const k of SHOW) data[`show_${k}`] = c[`show_${k}`] !== false;
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
