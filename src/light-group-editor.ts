import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, LightGroupCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

@customElement("ha-light-group-card-editor")
export class HaLightGroupCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: LightGroupCardConfig;

  public setConfig(config: LightGroupCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `light_group_editor.${key}`);
  }

  private _schema() {
    return [
      { name: "entities", required: true, selector: { entity: { multiple: true, filter: { domain: "light" } } } },
      { type: "grid", name: "", schema: [
        { name: "title", selector: { text: {} } },
        { name: "icon", selector: { icon: {} } },
      ] },
      { type: "grid", name: "", schema: [
        { name: "show_lights", selector: { boolean: {} } },
        { name: "collapsed", selector: { boolean: {} } },
        { name: "group_color", selector: { boolean: {} } },
      ] },
      { name: "animations", selector: { select: { mode: "dropdown", options: ["full", "reduced", "off"].map((v) => ({ value: v, label: localize(this.hass, `editor.anim_${v}`) })) } } },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const config = { ...ev.detail.value } as LightGroupCardConfig;
    // Eigene Namen/Symbole einzelner Lampen beim Umsortieren/Ergänzen erhalten
    const previous = this._config?.entities ?? [];
    config.entities = (config.entities ?? []).map((e) => {
      const id = typeof e === "string" ? e : e.entity;
      return previous.find((p) => typeof p !== "string" && p.entity === id) ?? id;
    });
    for (const key of Object.keys(config) as (keyof LightGroupCardConfig)[]) {
      const v = config[key];
      if (key !== "entities" && (v === "" || v == null)) delete config[key];
    }
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const data = {
      show_lights: true, collapsed: false, group_color: true, animations: "full",
      ...this._config,
      entities: (this._config.entities ?? []).map((e) => (typeof e === "string" ? e : e.entity)),
    };
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
