import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, MowerSummaryCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

/** Visueller Editor: Mäher, Name, nächster Lauf, Messer-Warnung, Szene; weitere Zuordnungen per YAML. */
@customElement("ha-mower-summary-card-editor")
export class HaMowerSummaryCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: MowerSummaryCardConfig;

  public setConfig(config: MowerSummaryCardConfig): void {
    this._config = config;
  }

  private _schema() {
    return [
      { name: "entity", selector: { entity: { domain: "lawn_mower" } } },
      { name: "name", selector: { text: {} } },
      { name: "next_run", selector: { entity: { filter: [{ domain: "sensor", device_class: "timestamp" }, { domain: "input_datetime" }, { domain: "schedule" }, { domain: "calendar" }, { domain: "time" }] } } },
      { type: "grid", name: "", schema: [
        { name: "blade_warn", selector: { number: { min: 0, max: 100, step: 1, mode: "box", unit_of_measurement: "%" } } },
        { name: "show_scene", selector: { boolean: {} } },
      ] },
    ];
  }

  private _computeLabel = (s: { name: string }): string => localize(this.hass, `mower_summary_editor.${s.name}`);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, any>;
    const config: MowerSummaryCardConfig = { ...this._config!, entity: v.entity ?? "" };
    for (const k of ["name", "next_run"] as const) { if (v[k]) config[k] = String(v[k]); else delete config[k]; }
    const b = Number(v.blade_warn);
    if (Number.isFinite(b) && b !== 15) config.blade_warn = b; else delete config.blade_warn;
    if (v.show_scene === false) config.show_scene = false; else delete config.show_scene;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const c = this._config;
    const data = { entity: c.entity ?? "", name: c.name ?? "", next_run: c.next_run ?? "", blade_warn: c.blade_warn ?? 15, show_scene: c.show_scene !== false };
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <p class="hint">${localize(this.hass, "mower_summary_editor.hint")}</p>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .hint { font-size: 12.5px; color: var(--secondary-text-color); }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
