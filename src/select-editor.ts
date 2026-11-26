import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, SelectCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

/** Visueller Editor: Titel, Auswahlen, Darstellung; Symbole/Farben je Option per YAML. */
@customElement("ha-select-card-editor")
export class HaSelectCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: SelectCardConfig;

  public setConfig(config: SelectCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `select_editor.${key}`);
  }

  private _schema() {
    return [
      { name: "title", selector: { text: {} } },
      { name: "entities", selector: { entity: { multiple: true, filter: [{ domain: "input_select" }, { domain: "select" }] } } },
      { name: "layout", selector: { select: { mode: "dropdown", options: ["auto", "segment", "chips", "tiles", "list", "dropdown"].map((v) => ({ value: v, label: this._t(`layout_${v}`) })) } } },
      ...(this._config?.layout === "dropdown" ? [{ name: "dropdown_direction", selector: { select: { mode: "dropdown", options: ["down", "up", "auto"].map((v) => ({ value: v, label: this._t(`dir_${v}`) })) } } }] : []),
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, any>;
    const prev = this._config?.entities ?? (this._config?.entity ? [this._config.entity] : []);
    const config: SelectCardConfig = { ...this._config!, ...v,
      entities: (v.entities ?? []).map((id: string) => prev.find((p) => typeof p !== "string" && p.entity === id) ?? id) };
    delete config.entity;
    if (!config.title) delete config.title;
    if (!config.layout || config.layout === "auto") delete config.layout;
    if (config.layout !== "dropdown" || !config.dropdown_direction || config.dropdown_direction === "down") delete config.dropdown_direction;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const c = this._config;
    const data = { layout: "auto", dropdown_direction: "down", ...c, entities: (c.entities ?? (c.entity ? [c.entity] : [])).map((e) => (typeof e === "string" ? e : e.entity)) };
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <p class="hint">${this._t("hint")}</p>
      <pre class="example">options:
  Smart: { icon: mdi:auto-fix, color: "#ab47bc" }
  Aus: { hide: true }
confirm: [Aus]</pre>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .hint { font-size: 12px; color: var(--secondary-text-color); margin: 8px 2px 4px; }
    .example { font-size: 11px; margin: 0; padding: 8px 10px; border-radius: 8px; background: rgba(127,127,127,0.1); overflow-x: auto; }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
