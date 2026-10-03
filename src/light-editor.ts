import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, LightCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

const SHOW_KEYS = ["lights", "scenes", "color", "temperature", "effects"];

@customElement("ha-light-card-editor")
export class HaLightCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: LightCardConfig;

  public setConfig(config: LightCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `light_editor.${key}`);
  }

  private _schema() {
    return [
      { name: "entity", required: true, selector: { entity: { domain: "light" } } },
      { type: "grid", name: "", schema: [
        { name: "name", selector: { text: {} } },
        { name: "icon", selector: { icon: {} } },
      ] },
      { name: "layout", selector: { select: { mode: "box", options: [
        { value: "full", label: this._t("layout_full") },
        { value: "compact", label: this._t("layout_compact") },
      ] } } },
      { type: "expandable", name: "show", title: this._t("sections"), icon: "mdi:eye-outline", schema: [
        { type: "grid", name: "", schema: SHOW_KEYS.map((k) => ({ name: k, selector: { boolean: {} } })) },
      ] },
      { type: "expandable", name: "", flatten: true, title: this._t("room"), icon: "mdi:lightbulb-group", schema: [
        { name: "auto_entities", selector: { boolean: {} } },
        { name: "entities", selector: { entity: { multiple: true, filter: { domain: "light" } } } },
        { name: "auto_scenes", selector: { boolean: {} } },
        { name: "scenes", selector: { entity: { multiple: true, filter: { domain: "scene" } } } },
      ] },
      { type: "expandable", name: "", flatten: true, title: this._t("sensors"), icon: "mdi:motion-sensor", schema: [
        { name: "motion_sensor", selector: { entity: { filter: { domain: "binary_sensor" } } } },
        { name: "illuminance_sensor", selector: { entity: { filter: [{ domain: "sensor", device_class: "illuminance" }, { domain: "sensor" }] } } },
      ] },
      { type: "expandable", name: "", flatten: true, title: this._t("appearance"), icon: "mdi:palette-outline", schema: [
        { name: "expandable", selector: { boolean: {} } },
        { name: "start_expanded", selector: { boolean: {} } },
        { name: "animations", selector: { select: { mode: "dropdown", options: ["full", "reduced", "off"].map((v) => ({ value: v, label: localize(this.hass, `editor.anim_${v}`) })) } } },
      ] },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const config = { ...ev.detail.value } as LightCardConfig;
    if (Array.isArray(config.entities)) {
      const previous = this._config?.entities ?? [];
      config.entities = config.entities.map((e) => {
        const id = typeof e === "string" ? e : e.entity;
        return previous.find((p) => typeof p !== "string" && p.entity === id) ?? id;
      });
    }
    for (const key of Object.keys(config) as (keyof LightCardConfig)[]) {
      const v = config[key];
      if (v === "" || v == null || (Array.isArray(v) && !v.length)) delete config[key];
    }
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const data = {
      layout: "full", auto_entities: true, auto_scenes: true, expandable: true, animations: "full",
      ...this._config,
      entities: this._config.entities?.map((e) => (typeof e === "string" ? e : e.entity)),
      show: { lights: true, scenes: true, color: true, temperature: true, effects: true, ...(this._config.show ?? {}) },
    };
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
