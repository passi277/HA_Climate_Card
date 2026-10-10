import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, PoolCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

const KEYS = ["title", "pump", "pump_power", "mode", "start_time", "temperature", "ph", "orp", "guidance", "quality", "runtime_today", "target_runtime",
  "recommended_runtime", "energy_today", "cost_today", "auto_off"] as const;

/** Visueller Editor für die Hauptentitäten; Wartung, Grenzen und Pflege per YAML. */
@customElement("ha-pool-card-editor")
export class HaPoolCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: PoolCardConfig;

  public setConfig(config: PoolCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `pool_editor.${key}`);
  }

  private _schema() {
    const sensor = { entity: { filter: { domain: "sensor" } } };
    return [
      { name: "title", selector: { text: {} } },
      { type: "grid", name: "", schema: [
        { name: "pump", selector: { entity: { filter: { domain: "switch" } } } },
        { name: "pump_power", selector: { entity: { filter: { domain: "sensor", device_class: "power" } } } },
      ] },
      { type: "grid", name: "", schema: [
        { name: "mode", selector: { entity: { filter: [{ domain: "input_select" }, { domain: "select" }] } } },
        { name: "start_time", selector: { entity: { filter: [{ domain: "input_datetime" }, { domain: "time" }] } } },
      ] },
      { type: "grid", name: "", schema: [
        { name: "temperature", selector: sensor },
        { name: "ph", selector: sensor },
        { name: "orp", selector: sensor },
        { name: "quality", selector: sensor },
      ] },
      { name: "guidance", selector: sensor },
      { type: "grid", name: "", schema: [
        { name: "runtime_today", selector: sensor },
        { name: "recommended_runtime", selector: sensor },
        { name: "target_runtime", selector: { entity: { filter: [{ domain: "input_number" }, { domain: "number" }] } } },
        { name: "auto_off", selector: { entity: { filter: [{ domain: "input_boolean" }, { domain: "switch" }] } } },
      ] },
      { type: "grid", name: "", schema: [
        { name: "energy_today", selector: sensor },
        { name: "cost_today", selector: sensor },
      ] },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const f = ev.detail.value as Record<string, string | undefined>;
    const config: PoolCardConfig = { ...this._config! };
    for (const k of KEYS) {
      if (f[k]) config[k] = f[k];
      else delete config[k];
    }
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const data: Record<string, unknown> = {};
    for (const k of KEYS) data[k] = this._config[k];
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <p class="hint">${this._t("hint")}</p>
      <pre class="example">backwash:
  hours: sensor.pool_pumpenstunden_seit_ruckspulen
  script: script.pool_ruckspulen_start
  timer: timer.pool_ruckspulen
rinse:
  script: script.pool_nachspulen_start
  timer: timer.pool_nachspulen</pre>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .hint { font-size: 12px; color: var(--secondary-text-color); margin: 8px 2px 4px; }
    .example { font-size: 11px; margin: 0; padding: 8px 10px; border-radius: 8px; background: rgba(127,127,127,0.1); overflow-x: auto; }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
