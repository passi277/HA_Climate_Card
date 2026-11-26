import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, StarlinkAlignmentCardConfig, StarlinkAlignmentShowConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

const SHOW: (keyof StarlinkAlignmentShowConfig)[] = ["compass", "stats", "tip"];

/** Visueller Editor: Starlink-Entität, Soll-Azimut (Helfer), Toleranz, Bereiche; Ist-Werte kommen über das Gerät. */
@customElement("ha-starlink-alignment-card-editor")
export class HaStarlinkAlignmentCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: StarlinkAlignmentCardConfig;

  public setConfig(config: StarlinkAlignmentCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `starlink_align_editor.${key}`);
  }

  private _schema() {
    return [
      { name: "entity", selector: { entity: { filter: { integration: "starlink" } } } },
      { name: "desired_azimuth", selector: { entity: { filter: { domain: ["input_number", "number", "sensor"] } } } },
      { name: "name", selector: { text: {} } },
      { type: "grid", name: "", schema: [
        { name: "tolerance", selector: { number: { min: 1, max: 45, mode: "box", unit_of_measurement: "°" } } },
        { name: "warn", selector: { number: { min: 1, max: 90, mode: "box", unit_of_measurement: "°" } } },
        { name: "history_days", selector: { number: { min: 1, max: 30, mode: "box", unit_of_measurement: "d" } } },
      ] },
      { type: "grid", name: "", schema: SHOW.map((k) => ({ name: `show_${k}`, selector: { boolean: {} } })) },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, unknown>;
    const config: StarlinkAlignmentCardConfig = { ...this._config! };
    config.entity = String(v.entity ?? "");
    // Feste Zahl aus YAML bleibt erhalten, solange im Editor keine Entität gewählt wird
    if (v.desired_azimuth) config.desired_azimuth = String(v.desired_azimuth);
    else if (typeof this._config?.desired_azimuth !== "number") delete config.desired_azimuth;
    if (v.name) config.name = String(v.name); else delete config.name;
    for (const [k, def] of [["tolerance", 5], ["warn", 15], ["history_days", 7]] as const) {
      const n = Number(v[k]);
      if (Number.isFinite(n) && n > 0 && n !== def) config[k] = n; else delete config[k];
    }
    const show: StarlinkAlignmentShowConfig = {};
    for (const k of SHOW) if (v[`show_${k}`] === false) show[k] = false;
    if (Object.keys(show).length) config.show = show; else delete config.show;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const c = this._config;
    const data: Record<string, unknown> = {
      entity: c.entity, desired_azimuth: typeof c.desired_azimuth === "string" ? c.desired_azimuth : undefined, name: c.name,
      tolerance: c.tolerance ?? 5, warn: c.warn ?? 15, history_days: c.history_days ?? 7,
    };
    for (const k of SHOW) data[`show_${k}`] = c.show?.[k] !== false;
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
