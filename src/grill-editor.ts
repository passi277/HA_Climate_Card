import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { GrillCardConfig, HomeAssistant } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

/** Visueller Editor: Titel, Sonden (sonst alle Meater), Verlauf, inaktive ausblenden. */
@customElement("ha-grill-card-editor")
export class HaGrillCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: GrillCardConfig;

  public setConfig(config: GrillCardConfig): void {
    this._config = config;
  }

  private _schema() {
    return [
      { name: "title", selector: { text: {} } },
      { name: "entities", selector: { entity: { multiple: true, filter: { domain: "sensor", device_class: "temperature" } } } },
      { type: "grid", name: "", schema: [
        { name: "show_graph", selector: { boolean: {} } },
        { name: "hide_idle", selector: { boolean: {} } },
      ] },
    ];
  }

  private _computeLabel = (s: { name: string }): string => localize(this.hass, `grill_editor.${s.name}`);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, any>;
    const config: GrillCardConfig = { ...this._config! };
    if (v.title) config.title = String(v.title); else delete config.title;
    const ents = Array.isArray(v.entities) ? (v.entities as string[]).filter(Boolean) : [];
    if (ents.length) config.entities = ents; else delete config.entities;
    if (v.show_graph === false) config.show_graph = false; else delete config.show_graph;
    if (v.hide_idle === true) config.hide_idle = true; else delete config.hide_idle;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const c = this._config;
    const data = { title: c.title ?? "", entities: c.entities ?? [], show_graph: c.show_graph !== false, hide_idle: c.hide_idle === true };
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <p class="hint">${localize(this.hass, "grill_editor.hint")}</p>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .hint { font-size: 12.5px; color: var(--secondary-text-color); }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
