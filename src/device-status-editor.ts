import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { DeviceStatusCardConfig, HomeAssistant } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

/** Visueller Editor: Name, ausgeschlossene Domains/Integrationen/Entitäten, „unbekannt“ mitzählen. */
@customElement("ha-device-status-card-editor")
export class HaDeviceStatusCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: DeviceStatusCardConfig;

  public setConfig(config: DeviceStatusCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `device_status_editor.${key}`);
  }

  private _schema() {
    const domains = ["device_tracker", "button", "switch", "sensor", "binary_sensor", "light", "cover", "media_player", "update", "event"];
    const platforms = [...new Set(Object.values(this.hass?.entities ?? {}).map((e) => e.platform).filter(Boolean) as string[])].sort();
    return [
      { name: "name", selector: { text: {} } },
      { name: "exclude_domains", selector: { select: { multiple: true, mode: "dropdown", options: domains } } },
      { name: "exclude_integrations", selector: { select: { multiple: true, mode: "dropdown", custom_value: true, options: platforms } } },
      { name: "exclude", selector: { entity: { multiple: true } } },
      { type: "grid", name: "", schema: [
        { name: "max_items", selector: { number: { min: 1, max: 100, mode: "box" } } },
        { name: "include_unknown", selector: { boolean: {} } },
      ] },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, unknown>;
    const config: DeviceStatusCardConfig = { ...this._config! };
    if (v.name) config.name = String(v.name); else delete config.name;
    const dom = Array.isArray(v.exclude_domains) ? (v.exclude_domains as string[]) : [];
    if (dom.length === 1 && dom[0] === "device_tracker") delete config.exclude_domains; else config.exclude_domains = dom;
    for (const k of ["exclude_integrations", "exclude"] as const) {
      const l = Array.isArray(v[k]) ? (v[k] as string[]).filter(Boolean) : [];
      if (l.length) config[k] = l; else delete config[k];
    }
    const m = Number(v.max_items);
    if (Number.isFinite(m) && m > 0 && m !== 8) config.max_items = m; else delete config.max_items;
    if (v.include_unknown) config.include_unknown = true; else delete config.include_unknown;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const c = this._config;
    const data = { name: c.name, exclude_domains: c.exclude_domains ?? ["device_tracker"], exclude_integrations: c.exclude_integrations ?? [],
      exclude: c.exclude ?? [], max_items: c.max_items ?? 8, include_unknown: !!c.include_unknown };
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
