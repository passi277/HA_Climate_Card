import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, NetworkCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

/** Visueller Editor: Integration, Titel, ausgeblendete Geräte, Anzahl, Rückfrage. */
@customElement("ha-network-card-editor")
export class HaNetworkCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: NetworkCardConfig;

  public setConfig(config: NetworkCardConfig): void {
    this._config = config;
  }

  private _schema() {
    const t = (k: string) => localize(this.hass, `network_editor.${k}`);
    return [
      { name: "integration", selector: { select: { mode: "dropdown", custom_value: true, options: ["auto", "wifi", "zigbee2mqtt", "zha", "shelly"].map((v) => ({ value: v, label: t(`i_${v}`) })) } } },
      { name: "title", selector: { text: {} } },
      { name: "exclude", selector: { text: { multiple: true } } },
      { type: "grid", name: "", schema: [
        { name: "max_items", selector: { number: { min: 1, max: 200, mode: "box" } } },
        { name: "confirm", selector: { boolean: {} } },
        { name: "wired", selector: { boolean: {} } },
      ] },
      { name: "z2m_topic", selector: { text: {} } },
    ];
  }

  private _computeLabel = (s: { name: string }): string => localize(this.hass, `network_editor.${s.name}`);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, unknown>;
    const config: NetworkCardConfig = { ...this._config! };
    if (v.integration && v.integration !== "auto") config.integration = String(v.integration); else delete config.integration;
    if (v.title) config.title = String(v.title); else delete config.title;
    const ex = Array.isArray(v.exclude) ? (v.exclude as string[]).filter(Boolean) : [];
    if (ex.length) config.exclude = ex; else delete config.exclude;
    const m = Number(v.max_items);
    if (Number.isFinite(m) && m > 0 && m !== 8) config.max_items = m; else delete config.max_items;
    if (v.confirm === false) config.confirm = false; else delete config.confirm;
    if (v.wired === true) config.wired = true; else delete config.wired;
    if (v.z2m_topic && v.z2m_topic !== "zigbee2mqtt") config.z2m_topic = String(v.z2m_topic); else delete config.z2m_topic;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const c = this._config;
    const data = { integration: c.integration ?? "auto", title: c.title ?? "", exclude: c.exclude ?? [], max_items: c.max_items ?? 8, confirm: c.confirm !== false,
      wired: c.wired === true, z2m_topic: c.z2m_topic ?? "" };
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <p class="hint">${localize(this.hass, "network_editor.hint")}</p>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .hint { font-size: 12.5px; color: var(--secondary-text-color); }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
