import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { ClimateCardConfig, HomeAssistant } from "./types";
import { DEFAULT_SHOW } from "./const";
import { localize } from "./localize/localize";

const sensor = (name: string, filter: Record<string, unknown>) => ({
  name,
  selector: { entity: { filter } },
});

@customElement("ha-climate-card-editor")
export class HaClimateCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: ClimateCardConfig;

  public setConfig(config: ClimateCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `editor.${key}`);
  }

  private _schema() {
    return [
      { name: "entity", required: true, selector: { entity: { domain: "climate" } } },
      {
        type: "grid",
        name: "",
        schema: [
          { name: "name", selector: { text: {} } },
          { name: "icon", selector: { icon: {} } },
        ],
      },
      {
        name: "layout",
        selector: {
          select: {
            mode: "box",
            options: [
              { value: "full", label: this._t("layout_full") },
              { value: "compact", label: this._t("layout_compact") },
            ],
          },
        },
      },
      {
        type: "expandable",
        name: "show",
        title: this._t("sections"),
        icon: "mdi:eye-outline",
        schema: [
          {
            type: "grid",
            name: "",
            schema: Object.keys(DEFAULT_SHOW).map((k) => ({ name: k, selector: { boolean: {} } })),
          },
        ],
      },
      {
        type: "expandable",
        name: "",
        flatten: true,
        title: this._t("sensors"),
        icon: "mdi:thermometer-lines",
        schema: [
          sensor("temperature_sensor", { domain: "sensor", device_class: "temperature" }),
          { name: "use_sensor_for_current", selector: { boolean: {} } },
          sensor("humidity_sensor", { domain: "sensor", device_class: "humidity" }),
          sensor("outdoor_sensor", { domain: ["sensor", "weather"] }),
          sensor("power_sensor", { domain: "sensor", device_class: "power" }),
          sensor("energy_sensor", { domain: "sensor", device_class: "energy" }),
          sensor("window_sensor", { domain: "binary_sensor" }),
        ],
      },
      { name: "graph_hours", selector: { number: { min: 1, max: 168, step: 1, mode: "box", unit_of_measurement: "h" } } },
    ];
  }

  private _computeLabel = (schema: { name: string }): string => {
    if (schema.name in DEFAULT_SHOW) return this._t(`show_${schema.name}`);
    return this._t(schema.name);
  };

  private _valueChanged(ev: CustomEvent): void {
    const config = { ...ev.detail.value } as ClimateCardConfig;
    for (const key of Object.keys(config) as (keyof ClimateCardConfig)[]) {
      if (config[key] === "" || config[key] == null) delete config[key];
    }
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const data = {
      layout: "full",
      graph_hours: 24,
      ...this._config,
      show: { ...DEFAULT_SHOW, ...(this._config.show ?? {}) },
    };
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>`;
  }

  static styles = css`:host { display: block; }`;
}

declare global {
  interface HTMLElementTagNameMap { "ha-climate-card-editor": HaClimateCardEditor; }
}
