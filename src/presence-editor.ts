import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, PresenceCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

@customElement("ha-presence-card-editor")
export class HaPresenceCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: PresenceCardConfig;

  public setConfig(config: PresenceCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `presence_editor.${key}`);
  }

  private _schema() {
    const door = !!this._config?.lock || !!this._config?.open_action;
    return [
      { name: "persons", selector: { entity: { multiple: true, filter: { domain: "person" } } } },
      { name: "show_battery", selector: { boolean: {} } },
      { name: "lock", selector: { entity: { filter: { domain: "lock" } } } },
      ...(door ? [
        { type: "grid", name: "", schema: [
          { name: "door_name", selector: { text: {} } },
          { name: "door_icon", selector: { icon: {} } },
        ] },
        { name: "door_type", selector: { select: { mode: "dropdown", options: ["auto", "opener", "lock"].map((v) => ({ value: v, label: this._t(`type_${v}`) })) } } },
        { name: "open_confirm", selector: { select: { mode: "dropdown", options: ["hold", "tap"].map((v) => ({ value: v, label: this._t(`confirm_${v}`) })) } } },
        { name: "open_action", selector: { entity: { filter: [{ domain: "script" }, { domain: "button" }, { domain: "input_button" }] } } },
        { name: "doorbell", selector: { entity: { filter: [{ domain: "binary_sensor" }, { domain: "event" }] } } },
      ] : []),
      { name: "columns", selector: { number: { min: 1, max: 6, step: 1, mode: "box" } } },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const config = { ...ev.detail.value } as PresenceCardConfig;
    if (Array.isArray(config.persons)) {
      const previous = this._config?.persons ?? [];
      config.persons = config.persons.map((e) => {
        const id = typeof e === "string" ? e : e.entity;
        return previous.find((p) => typeof p !== "string" && p.entity === id) ?? id;
      });
    }
    for (const key of Object.keys(config) as (keyof PresenceCardConfig)[]) {
      const v = config[key];
      if (v === "" || v == null || (Array.isArray(v) && !v.length)) delete config[key];
    }
    if (config.show_battery === true) delete config.show_battery;
    if (config.door_type === "auto") delete config.door_type;
    if (config.open_confirm === "hold") delete config.open_confirm;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const data = { show_battery: true, door_type: "auto", open_confirm: "hold", ...this._config,
      persons: this._config.persons?.map((e) => (typeof e === "string" ? e : e.entity)) };
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
