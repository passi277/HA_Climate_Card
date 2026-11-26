import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { GasGrillCardConfig, HomeAssistant } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

const SECTIONS = ["show_scene", "show_modes", "show_probes", "show_session", "show_graph", "show_timer", "show_gas", "show_lights"] as const;

/** Visueller Editor: Titel, Grill-Gerät, Bereiche, Gas-Warnschwelle. */
@customElement("ha-gas-grill-card-editor")
export class HaGasGrillCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: GasGrillCardConfig;

  public setConfig(config: GasGrillCardConfig): void {
    this._config = config;
  }

  private _schema() {
    return [
      { name: "title", selector: { text: {} } },
      { name: "device", selector: { device: { integration: "grillfuerst_p530e" } } },
      { name: "layout", selector: { select: { mode: "dropdown", options: ["full", "compact"].map((value) => ({ value, label: localize(this.hass, `gas_grill_editor.layout_${value}`) })) } } },
      { type: "grid", name: "", schema: SECTIONS.map((name) => ({ name, selector: { boolean: {} } })) },
      { name: "gas_warning", selector: { number: { min: 5, max: 60, step: 5, mode: "slider", unit_of_measurement: "%" } } },
    ];
  }

  private _computeLabel = (s: { name: string }): string => localize(this.hass, `gas_grill_editor.${s.name}`);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, any>;
    const config: GasGrillCardConfig = { ...this._config! };
    for (const k of ["title", "device"] as const) { if (v[k]) config[k] = String(v[k]); else delete config[k]; }
    if (v.layout === "compact") config.layout = "compact"; else delete config.layout;
    for (const k of SECTIONS) { if (v[k] === false) config[k] = false; else delete config[k]; }
    if (v.gas_warning != null && Number(v.gas_warning) !== 20) config.gas_warning = Number(v.gas_warning); else delete config.gas_warning;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const c = this._config;
    const data: Record<string, unknown> = { title: c.title ?? "", device: c.device ?? "", layout: c.layout ?? "full", gas_warning: c.gas_warning ?? 20 };
    for (const k of SECTIONS) data[k] = c[k] !== false;
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <p class="hint">${localize(this.hass, "gas_grill_editor.hint")}</p>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .hint { font-size: 12.5px; color: var(--secondary-text-color); }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
