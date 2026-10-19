import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, IrrigationCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

interface Flat {
  title?: string;
  pump?: string;
  pump_power?: string;
  mode?: string;
  start_time?: string;
  run_all?: string;
  stop_all?: string;
  valves?: string[];
}

const KEYS = ["title", "pump", "pump_power", "mode", "start_time", "run_all", "stop_all"] as const;

/** Visueller Editor: Pumpe, Modus, Skripte und Ventile; Timer/Dauer je Zone per YAML. */
@customElement("ha-irrigation-card-editor")
export class HaIrrigationCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: IrrigationCardConfig;

  public setConfig(config: IrrigationCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `irrigation_editor.${key}`);
  }

  private _schema() {
    return [
      { name: "title", selector: { text: {} } },
      { type: "grid", name: "", schema: [
        { name: "pump", selector: { entity: { filter: { domain: "switch" } } } },
        { name: "pump_power", selector: { entity: { filter: { domain: "sensor", device_class: "power" } } } },
      ] },
      { name: "valves", selector: { entity: { multiple: true, filter: [{ domain: "switch" }, { domain: "valve" }] } } },
      { type: "grid", name: "", schema: [
        { name: "mode", selector: { entity: { filter: [{ domain: "input_select" }, { domain: "select" }] } } },
        { name: "start_time", selector: { entity: { filter: [{ domain: "input_datetime" }, { domain: "time" }] } } },
      ] },
      { type: "grid", name: "", schema: [
        { name: "run_all", selector: { entity: { filter: { domain: "script" } } } },
        { name: "stop_all", selector: { entity: { filter: { domain: "script" } } } },
      ] },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const f = ev.detail.value as Flat;
    const prev = this._config?.zones ?? [];
    const config: IrrigationCardConfig = { ...this._config!, zones: (f.valves ?? []).map((v) => prev.find((z) => z.valve === v) ?? { valve: v }) };
    for (const k of KEYS) {
      if (f[k]) config[k] = f[k];
      else delete config[k];
    }
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const c = this._config;
    const data: Flat = { valves: c.zones?.map((z) => z.valve) };
    for (const k of KEYS) data[k] = c[k] as string | undefined;
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <p class="hint">${this._t("hint")}</p>
      <pre class="example">zones:
  - valve: switch.ventil_rasen
    name: Rasen
    timer: timer.rasen
    duration: input_number.rasen_dauer</pre>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .hint { font-size: 12px; color: var(--secondary-text-color); margin: 8px 2px 4px; }
    .example { font-size: 11px; margin: 0; padding: 8px 10px; border-radius: 8px; background: rgba(127,127,127,0.1); overflow-x: auto; }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
