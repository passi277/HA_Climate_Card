import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, HomeBatteryCardConfig, HomeBatteryShowConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

const SHOW: (keyof HomeBatteryShowConfig)[] = ["flow", "strings", "stats", "history"];

/** Visueller Editor: Ladestand-Sensor, Name, Bereiche, Verlaufsdauer; alles Weitere wird über das Gerät erkannt. */
@customElement("ha-home-battery-card-editor")
export class HaHomeBatteryCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: HomeBatteryCardConfig;

  public setConfig(config: HomeBatteryCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `home_battery_editor.${key}`);
  }

  private _schema() {
    return [
      { name: "entity", required: true, selector: { entity: { filter: { domain: "sensor", device_class: "battery" } } } },
      { name: "name", selector: { text: {} } },
      { type: "grid", name: "", schema: SHOW.map((k) => ({ name: `show_${k}`, selector: { boolean: {} } })) },
      { name: "hours_to_show", selector: { number: { min: 6, max: 168, mode: "box", unit_of_measurement: "h" } } },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, unknown>;
    const config: HomeBatteryCardConfig = { ...this._config!, entity: String(v.entity ?? "") };
    if (v.name) config.name = String(v.name); else delete config.name;
    const h = Number(v.hours_to_show);
    if (Number.isFinite(h) && h > 0 && h !== 48) config.hours_to_show = h; else delete config.hours_to_show;
    const show: HomeBatteryShowConfig = {};
    for (const k of SHOW) if (v[`show_${k}`] === false) show[k] = false;
    if (Object.keys(show).length) config.show = show; else delete config.show;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const data: Record<string, unknown> = { entity: this._config.entity, name: this._config.name, hours_to_show: this._config.hours_to_show ?? 48 };
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
