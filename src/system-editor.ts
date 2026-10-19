import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, SystemCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

const SHOW = ["resources", "updates", "backup", "actions", "restart"] as const;

/** Visueller Editor: Name, Bereiche, Ressourcen, Dienste, ausgeblendete Updates, Backup-Alter. */
@customElement("ha-system-card-editor")
export class HaSystemCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: SystemCardConfig;

  public setConfig(config: SystemCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `system_editor.${key}`);
  }

  private _schema() {
    return [
      { name: "name", selector: { text: {} } },
      { type: "grid", name: "", schema: SHOW.map((k) => ({ name: `show_${k}`, selector: { boolean: {} } })) },
      { name: "resources", selector: { entity: { multiple: true, filter: { domain: "sensor" } } } },
      { name: "services", selector: { entity: { multiple: true, filter: { domain: ["binary_sensor", "switch", "sensor"] } } } },
      { name: "exclude_updates", selector: { entity: { multiple: true, filter: { domain: "update" } } } },
      { type: "grid", name: "", schema: [
        { name: "max_updates", selector: { number: { min: 1, max: 50, mode: "box" } } },
        { name: "backup_max_age", selector: { number: { min: 1, max: 60, mode: "box", unit_of_measurement: "d" } } },
      ] },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, unknown>;
    const config: SystemCardConfig = { ...this._config! };
    if (v.name) config.name = String(v.name); else delete config.name;
    for (const k of SHOW) { if (v[`show_${k}`] === false) config[`show_${k}`] = false; else delete config[`show_${k}`]; }
    for (const k of ["resources", "services", "exclude_updates"] as const) {
      const list = Array.isArray(v[k]) ? (v[k] as string[]).filter(Boolean) : [];
      if (list.length) (config as any)[k] = list; else delete config[k];
    }
    const mu = Number(v.max_updates), ba = Number(v.backup_max_age);
    if (Number.isFinite(mu) && mu > 0 && mu !== 5) config.max_updates = mu; else delete config.max_updates;
    if (Number.isFinite(ba) && ba > 0 && ba !== 3) config.backup_max_age = ba; else delete config.backup_max_age;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const c = this._config;
    const ids = (l?: (string | { entity: string })[]) => (l ?? []).map((x) => (typeof x === "string" ? x : x.entity));
    const data: Record<string, unknown> = { name: c.name, resources: ids(c.resources), services: ids(c.services), exclude_updates: c.exclude_updates ?? [],
      max_updates: c.max_updates ?? 5, backup_max_age: c.backup_max_age ?? 3 };
    for (const k of SHOW) data[`show_${k}`] = c[`show_${k}`] !== false;
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
