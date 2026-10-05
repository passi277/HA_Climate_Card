import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, MowerCardConfig, MowerShowConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

const SHOW: (keyof MowerShowConfig)[] = ["scene", "controls", "session", "stats", "maintenance", "settings"];

/** Visueller Editor: Mähroboter, Name, Bereiche; Zusatz-Entitäten werden über das Gerät erkannt (per YAML überschreibbar). */
@customElement("ha-mower-card-editor")
export class HaMowerCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: MowerCardConfig;

  public setConfig(config: MowerCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `mower_editor.${key}`);
  }

  private _schema() {
    return [
      { name: "entity", required: true, selector: { entity: { filter: { domain: "lawn_mower" } } } },
      { name: "name", selector: { text: {} } },
      { type: "grid", name: "", schema: SHOW.map((k) => ({ name: `show_${k}`, selector: { boolean: {} } })) },
      { type: "grid", name: "", schema: [
        { name: "settings_open", selector: { boolean: {} } },
        { name: "live_stream", selector: { boolean: {} } },
      ] },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, unknown>;
    const config: MowerCardConfig = { ...this._config!, entity: String(v.entity ?? "") };
    if (v.name) config.name = String(v.name); else delete config.name;
    if (v.settings_open) config.settings_open = true; else delete config.settings_open;
    if (v.live_stream === false) config.live_stream = false; else delete config.live_stream;
    const show: MowerShowConfig = {};
    for (const k of SHOW) if (v[`show_${k}`] === false) show[k] = false;
    if (Object.keys(show).length) config.show = show; else delete config.show;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const data: Record<string, unknown> = { entity: this._config.entity, name: this._config.name, settings_open: !!this._config.settings_open,
      live_stream: this._config.live_stream !== false };
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
