import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, PoolCareCardConfig, PoolCareTab } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

const TABS: PoolCareTab[] = ["chemistry", "stock", "metal", "maintenance", "stats"];

/** Visueller Editor: Titel, Smart-Pool-Gerät, Reiter und Start-Reiter. */
@customElement("ha-pool-care-card-editor")
export class HaPoolCareCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: PoolCareCardConfig;

  public setConfig(config: PoolCareCardConfig): void {
    this._config = config;
  }

  private _schema() {
    const options = TABS.map((t) => ({ value: t, label: localize(this.hass, `pool_care.tab_${t}`) }));
    return [
      { name: "title", selector: { text: {} } },
      { name: "device", selector: { device: { integration: "smart_pool" } } },
      { name: "tabs", selector: { select: { multiple: true, mode: "list", options } } },
      { name: "default_tab", selector: { select: { mode: "dropdown", options } } },
    ];
  }

  private _computeLabel = (s: { name: string }): string => localize(this.hass, `pool_care_editor.${s.name}`);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, any>;
    const config: PoolCareCardConfig = { ...this._config! };
    for (const k of ["title", "device", "default_tab"] as const) { if (v[k]) (config as any)[k] = String(v[k]); else delete config[k]; }
    const tabs = (v.tabs ?? []) as PoolCareTab[];
    if (tabs.length && tabs.length < TABS.length) config.tabs = TABS.filter((t) => tabs.includes(t)); else delete config.tabs;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const c = this._config;
    const data = { title: c.title ?? "", device: c.device ?? "", tabs: c.tabs ?? TABS, default_tab: c.default_tab ?? "" };
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <p class="hint">${localize(this.hass, "pool_care_editor.hint")}</p>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .hint { font-size: 12.5px; color: var(--secondary-text-color); }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
