import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, RouterCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

/** Visueller Editor: Router-Entität, Name, Geräte im Netz, WLAN, Rückfrage beim Neustart. */
@customElement("ha-router-card-editor")
export class HaRouterCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: RouterCardConfig;

  public setConfig(config: RouterCardConfig): void {
    this._config = config;
  }

  private _schema() {
    return [
      { name: "entity", selector: { entity: {} } },
      { name: "name", selector: { text: {} } },
      { type: "grid", name: "", schema: [
        { name: "clients", selector: { boolean: {} } },
        { name: "show_wifi", selector: { boolean: {} } },
        { name: "confirm_reboot", selector: { boolean: {} } },
        { name: "max_clients", selector: { number: { min: 1, max: 100, mode: "box" } } },
      ] },
    ];
  }

  private _computeLabel = (s: { name: string }): string => localize(this.hass, `router_editor.${s.name}`);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, unknown>;
    const config: RouterCardConfig = { ...this._config! };
    for (const k of ["entity", "name"] as const) { if (v[k]) config[k] = String(v[k]); else delete config[k]; }
    for (const k of ["clients", "show_wifi", "confirm_reboot"] as const) { if (v[k] === false) config[k] = false; else delete config[k]; }
    const m = Number(v.max_clients);
    if (Number.isFinite(m) && m > 0 && m !== 8) config.max_clients = m; else delete config.max_clients;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const c = this._config;
    const data = { entity: c.entity ?? "", name: c.name ?? "", clients: c.clients !== false, show_wifi: c.show_wifi !== false,
      confirm_reboot: c.confirm_reboot !== false, max_clients: c.max_clients ?? 8 };
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <p class="hint">${localize(this.hass, "router_editor.hint")}</p>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .hint { font-size: 12.5px; color: var(--secondary-text-color); }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
