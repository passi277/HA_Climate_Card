import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, TemperatureCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

/** Visueller Editor: Titel, Sensoren, Stunden, Verlauf, Spalten; Grenzwerte je Sensor per YAML. */
@customElement("ha-temperature-card-editor")
export class HaTemperatureCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: TemperatureCardConfig;

  public setConfig(config: TemperatureCardConfig): void {
    this._config = config;
  }

  private _schema() {
    return [
      { name: "title", selector: { text: {} } },
      { name: "entities", selector: { entity: { multiple: true, filter: [{ domain: "sensor", device_class: "temperature" }, { domain: "weather" }, { domain: "climate" }] } } },
      { type: "grid", name: "", schema: [
        { name: "hours", selector: { number: { min: 1, max: 168, mode: "box" } } },
        { name: "columns", selector: { number: { min: 1, max: 4, mode: "box" } } },
        { name: "show_graph", selector: { boolean: {} } },
      ] },
    ];
  }

  private _computeLabel = (s: { name: string }): string => localize(this.hass, `temperature_editor.${s.name}`);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, any>;
    const prev = this._config?.entities ?? [];
    // Neue Entitäten: weather/climate über ihr Temperatur-Attribut
    const entities = ((v.entities ?? []) as string[]).map((id) => prev.find((p) => typeof p !== "string" && p.entity === id)
      ?? (id.startsWith("weather.") ? { entity: id, attribute: "temperature" } : id.startsWith("climate.") ? { entity: id, attribute: "current_temperature" } : id));
    const config: TemperatureCardConfig = { ...this._config!, entities };
    if (v.title) config.title = String(v.title); else delete config.title;
    const h = Number(v.hours);
    if (Number.isFinite(h) && h > 0 && h !== 24) config.hours = h; else delete config.hours;
    const cols = Number(v.columns);
    if (Number.isFinite(cols) && cols > 0 && cols !== 2) config.columns = cols; else delete config.columns;
    if (v.show_graph === false) config.show_graph = false; else delete config.show_graph;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const c = this._config;
    const data = { title: c.title ?? "", entities: (c.entities ?? []).map((e) => (typeof e === "string" ? e : e.entity)), hours: c.hours ?? 24,
      columns: c.columns ?? 2, show_graph: c.show_graph !== false };
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <p class="hint">${localize(this.hass, "temperature_editor.hint")}</p>
      <pre class="example">entities:
  - entity: sensor.kuehlschrank_temperatur
    name: Kühlschrank
    warn_high: 8
    alarm_high: 12
  - entity: weather.forecast_home
    attribute: temperature</pre>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .hint { font-size: 12.5px; color: var(--secondary-text-color); }
    .example { font-size: 11px; margin: 0; padding: 8px 10px; border-radius: 8px; background: rgba(127,127,127,0.1); overflow-x: auto; }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
