import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { AlertCardConfig, HomeAssistant } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

@customElement("ha-alert-card-editor")
export class HaAlertCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: AlertCardConfig;

  public setConfig(config: AlertCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `alert_editor.${key}`);
  }

  private _schema() {
    return [
      { name: "contacts", selector: { entity: { multiple: true, filter: { domain: "binary_sensor" } } } },
      { type: "grid", name: "", schema: [
        { name: "show_ok", selector: { boolean: {} } },
        { name: "ok_text", selector: { text: {} } },
      ] },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const config = { ...ev.detail.value } as AlertCardConfig;
    if (Array.isArray(config.contacts)) {
      const previous = this._config?.contacts ?? [];
      config.contacts = config.contacts.map((e) => {
        const id = typeof e === "string" ? e : e.entity;
        return previous.find((p) => typeof p !== "string" && p.entity === id) ?? id;
      });
    }
    for (const key of Object.keys(config) as (keyof AlertCardConfig)[]) {
      const v = config[key];
      if (v === "" || v == null || v === false || (Array.isArray(v) && !v.length)) delete config[key];
    }
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const data = { ...this._config, contacts: this._config.contacts?.map((e) => (typeof e === "string" ? e : e.entity)) };
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <p class="hint">${this._t("hint")}</p>
      <pre class="example">alerts:
  - entity: vacuum.roborock
    state: error
    severity: error
    title: Saugroboter hat ein Problem
    navigation_path: /dashboard/roborock</pre>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .hint { font-size: 12px; color: var(--secondary-text-color); margin: 8px 2px 4px; }
    .example { font-size: 11px; margin: 0; padding: 8px 10px; border-radius: 8px; background: rgba(127,127,127,0.1); overflow-x: auto; }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
