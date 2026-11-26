import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { ClimateCardConfig, HomeAssistant } from "./types";
import { CARD_VERSION, DEFAULT_SHOW } from "./const";
import { editorOptions } from "./utils";
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

  /** Was passt zum eingetragenen Gerät (Heizung/Klima, Features)? */
  private get _options() {
    const c = this._config;
    const st = c?.entity ? this.hass?.states[c.entity] : undefined;
    return editorOptions(st, c?.device_type);
  }

  /** Heizungs-Felder nur zeigen, wenn das Gerät eine Heizung ist (oder so eingestellt). */
  private get _isHeating(): boolean {
    return this._options.type === "heating";
  }

  private _heatingSchema() {
    if (!this._isHeating) return [];
    return [{
      type: "expandable",
      name: "",
      flatten: true,
      title: this._t("heating_section"),
      icon: "mdi:radiator",
      schema: [
        { name: "auto_heating_sensors", selector: { boolean: {} } },
        { name: "valve_sensors", selector: { entity: { multiple: true, filter: { domain: "sensor" } } } },
        { name: "battery_sensors", selector: { entity: { multiple: true, filter: { domain: "sensor" } } } },
        { name: "away_temperature", selector: { number: { min: 4.5, max: 30.5, step: 0.5, mode: "box", unit_of_measurement: "°C" } } },
      ],
    }];
  }

  private _schema() {
    const opts = this._options;
    const ac = opts.type !== "heating";
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
        name: "device_type",
        selector: {
          select: {
            mode: "dropdown",
            options: ["auto", "ac", "heating"].map((v) => ({ value: v, label: this._t(`device_${v}`) })),
          },
        },
      },
      ...this._heatingSchema(),
      {
        type: "expandable",
        name: "show",
        title: this._t("sections"),
        icon: "mdi:eye-outline",
        schema: [
          {
            type: "grid",
            name: "",
            schema: opts.show.map((k) => ({ name: k, selector: { boolean: {} } })),
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
          { name: "outdoor_sensor", selector: { entity: { filter: [{ domain: "sensor", device_class: "temperature" }, { domain: "weather" }] } } },
          sensor("power_sensor", { domain: "sensor", device_class: "power" }),
          // Tätigkeit aus der Leistung ableiten (z.B. Gree) – nur Klima mit Leistungssensor
          ...(ac && this._config?.power_sensor
            ? [{ name: "power_threshold", selector: { number: { min: 0, max: 500, step: 1, mode: "box", unit_of_measurement: "W" } } }]
            : []),
          sensor("energy_sensor", { domain: "sensor", device_class: "energy" }),
          {
            name: "contact_sensors",
            selector: {
              entity: {
                multiple: true,
                // bewusst alle binary_sensoren: Gruppen/Template-Kontakte haben oft keine device_class
                filter: { domain: "binary_sensor" },
              },
            },
          },
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
          {
            name: "animations",
            selector: { select: { mode: "dropdown", options: ["full", "reduced", "off"].map((v) => ({ value: v, label: this._t(`anim_${v}`) })) } },
          },
          { name: "expandable", selector: { boolean: {} } },
          { name: "start_expanded", selector: { boolean: {} } },
          ...(opts.selects ? [{ name: "dropdown_threshold", selector: { number: { min: 0, max: 20, step: 1, mode: "box" } } }] : []),
          { name: "graph_hours", selector: { number: { min: 1, max: 168, step: 1, mode: "box", unit_of_measurement: "h" } } },
        ],
      },
    ];
  }

  private _computeLabel = (schema: { name: string }): string => {
    if (schema.name === "airflow" && this._isHeating) return this._t("show_airflow_heating");
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
    // Fenster/Türen: Namen/Typen aus YAML erhalten; der alte `window_sensor` geht in der Liste auf.
    if (Array.isArray(config.contact_sensors)) {
      const previous = this._config?.contact_sensors ?? [];
      config.contact_sensors = config.contact_sensors.map((c) => {
        const id = typeof c === "string" ? c : c.entity;
        return previous.find((p) => typeof p !== "string" && p.entity === id) ?? id;
      });
      delete config.window_sensor;
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
      animations: "full",
      device_type: "auto",
      auto_heating_sensors: true,
      away_temperature: 17,
      power_threshold: 25,
      ventilation_delta: 3,
      humidity_warning: 70,
      ...this._config,
      shortcuts: this._config.shortcuts?.map((s) => (typeof s === "string" ? s : s.entity)),
      contact_sensors: [
        ...(this._config.contact_sensors ?? []).map((c) => (typeof c === "string" ? c : c.entity)),
        ...(this._config.window_sensor && !(this._config.contact_sensors ?? []).some((c) => (typeof c === "string" ? c : c.entity) === this._config!.window_sensor)
          ? [this._config.window_sensor] : []),
      ],
      countdown_durations: this._config.countdown_durations?.join(", "),
      show: { ...DEFAULT_SHOW, ...(this._config.show ?? {}) },
    };
    const opts = this._options;
    return html`${opts.type ? html`<div class="detected">
        <ha-icon icon=${opts.type === "heating" ? "mdi:radiator" : "mdi:air-conditioner"}></ha-icon>
        <span><strong>${this._t(opts.configured ? "configured" : "detected")}: ${this._t(`device_${opts.type}`)}</strong>
          – ${this._t("only_matching")}</span>
      </div>` : nothing}
      <ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .detected { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding: 8px 12px; border-radius: 12px;
      font-size: 13px; color: var(--secondary-text-color); background: rgba(127,127,127,0.1); }
    .detected ha-icon { --mdc-icon-size: 20px; color: var(--primary-color); flex: none; }
    .detected strong { color: var(--primary-text-color); font-weight: 500; }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}

declare global {
  interface HTMLElementTagNameMap { "ha-climate-card-editor": HaClimateCardEditor; }
}
