import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, SwitchTimeCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

@customElement("ha-switch-time-card-editor")
export class HaSwitchTimeCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: SwitchTimeCardConfig;

  public setConfig(config: SwitchTimeCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `switch_time_editor.${key}`);
  }

  private _schema() {
    return [
      { name: "switch_entity", selector: { entity: { filter: { domain: ["input_boolean", "switch", "automation", "light", "fan", "script"] } } } },
      { name: "time_entity", selector: { entity: { filter: { domain: "input_datetime" } } } },
      { type: "grid", name: "", schema: [
        { name: "name", selector: { text: {} } },
        { name: "icon", selector: { icon: {} } },
      ] },
      { type: "grid", name: "", schema: [
        { name: "color", selector: { select: { mode: "dropdown", options: [
          { value: "", label: this._t("color_default") },
          ...[["#ffb300", "amber"], ["#ff7043", "orange"], ["#ef5350", "red"], ["#ec407a", "pink"], ["#7e57c2", "purple"],
            ["#42a5f5", "blue"], ["#26a69a", "teal"], ["#66bb6a", "green"]].map(([value, key]) => ({ value, label: this._t(`color_${key}`) })),
        ] } } },
        { name: "minute_step", selector: { select: { mode: "dropdown", options: ["1", "5", "10", "15"].map((v) => ({ value: v, label: `${v} min` })) } } },
      ] },
      { name: "show_remaining", selector: { boolean: {} } },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const config = { ...ev.detail.value } as SwitchTimeCardConfig & { minute_step?: number | string };
    if (config.minute_step != null) config.minute_step = Number(config.minute_step);
    for (const key of Object.keys(config) as (keyof SwitchTimeCardConfig)[]) {
      const v = config[key];
      if (v === "" || v == null) delete config[key];
    }
    if (config.minute_step === 5) delete config.minute_step;
    if (config.show_remaining === true) delete config.show_remaining;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const data = { show_remaining: true, color: "", ...this._config, minute_step: String(this._config.minute_step ?? 5) };
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
