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
          { name: "temperature_sensor", selector: { entity: { filter: [{ domain: "sensor", device_class: "temperature" }, { domain: "climate" }] } } },
          { name: "use_sensor_for_current", selector: { boolean: {} } },
          sensor("humidity_sensor", { domain: "sensor", device_class: "humidity" }),
          sensor("outdoor_sensor", { domain: ["sensor", "weather"] }),
          sensor("power_sensor", { domain: "sensor", device_class: "power" }),
          sensor("energy_sensor", { domain: "sensor", device_class: "energy" }),
          sensor("window_sensor", { domain: "binary_sensor" }),
        ],
      },
      {
        type: "expandable",
        name: "",
        flatten: true,
        title: this._t("hints_section"),
        icon: "mdi:weather-partly-cloudy",
        schema: [
          { name: "weather_entity", selector: { entity: { filter: { domain: "weather" } } } },
          { name: "ventilation_delta", selector: { number: { min: 1, max: 15, step: 0.5, mode: "box", unit_of_measurement: "°" } } },
          { name: "humidity_warning", selector: { number: { min: 0, max: 100, step: 1, mode: "box", unit_of_measurement: "%" } } },
        ],
      },
      {
        type: "expandable",
        name: "",
        flatten: true,
        title: this._t("timer_section"),
        icon: "mdi:sleep",
        schema: [
          { name: "timer_switch", selector: { entity: { filter: { domain: ["input_boolean", "switch"] } } } },
          { name: "timer_time", selector: { entity: { filter: { domain: "input_datetime" } } } },
          { name: "countdown_timer", selector: { entity: { filter: { domain: "timer" } } } },
          { name: "countdown_durations", selector: { text: {} } },
        ],
      },
      {
        type: "expandable",
        name: "",
        flatten: true,
        title: this._t("shortcuts_section"),
        icon: "mdi:gesture-tap-button",
        schema: [
          { name: "auto_shortcuts", selector: { boolean: {} } },
          {
            name: "shortcuts",
            selector: { entity: { multiple: true, filter: { domain: ["switch", "input_boolean", "light", "fan", "script", "scene", "button", "input_button", "automation"] } } },
          },
        ],
      },
      {
        type: "expandable",
        name: "",
        flatten: true,
        title: this._t("appearance"),
        icon: "mdi:palette-outline",
        schema: [
          { name: "expandable", selector: { boolean: {} } },
          { name: "start_expanded", selector: { boolean: {} } },
          { name: "dropdown_threshold", selector: { number: { min: 0, max: 20, step: 1, mode: "box" } } },
          { name: "graph_hours", selector: { number: { min: 1, max: 168, step: 1, mode: "box", unit_of_measurement: "h" } } },
        ],
      },
    ];
  }

  private _computeLabel = (schema: { name: string }): string => {
    if (schema.name in DEFAULT_SHOW) return this._t(`show_${schema.name}`);
    return this._t(schema.name);
  };

  private _valueChanged(ev: CustomEvent): void {
    const value = { ...ev.detail.value };
    // Timer-Dauern werden im Editor als Text "30, 60, 90" bearbeitet
    if (typeof value.countdown_durations === "string") {
      const list = value.countdown_durations.split(/[,; ]+/).map(Number).filter((n: number) => n > 0);
      value.countdown_durations = list.length ? list : undefined;
    }
    const config = value as ClimateCardConfig;
    // Im YAML gesetzte Namen/Icons der Schalter beim Bearbeiten über die Entitätsliste erhalten.
    if (Array.isArray(config.shortcuts)) {
      const previous = this._config?.shortcuts ?? [];
      config.shortcuts = config.shortcuts.map((s) => {
        const id = typeof s === "string" ? s : s.entity;
        return previous.find((p) => typeof p !== "string" && p.entity === id) ?? id;
      });
    }
    for (const key of Object.keys(config) as (keyof ClimateCardConfig)[]) {
      const v = config[key];
      if (v === "" || v == null || (Array.isArray(v) && !v.length)) delete config[key];
    }
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const data = {
      layout: "full",
      graph_hours: 24,
      auto_shortcuts: true,
      use_sensor_for_current: true,
      expandable: true,
      dropdown_threshold: 6,
      ventilation_delta: 3,
      humidity_warning: 70,
      ...this._config,
      shortcuts: this._config.shortcuts?.map((s) => (typeof s === "string" ? s : s.entity)),
      countdown_durations: this._config.countdown_durations?.join(", "),
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
