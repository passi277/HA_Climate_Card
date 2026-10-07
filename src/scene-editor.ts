import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, SceneCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";
import { hueRooms } from "./utils";

/** Visueller Editor: Name, Favoriten, Filter, Spalten. Räume mit Lampen über YAML (`groups`). */
@customElement("ha-scene-card-editor")
export class HaSceneCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: SceneCardConfig;

  public setConfig(config: SceneCardConfig): void {
    this._config = config;
  }

  private _schema() {
    return [
      { name: "name", selector: { text: {} } },
      { name: "rooms", selector: { select: { multiple: true, mode: "list", options: hueRooms(this.hass?.states ?? {}).map((r) => ({
        value: r.name, label: `${r.name} (${[r.lights ? localize(this.hass, "scene.n_lights").replace("{n}", String(r.lights)) : "", r.scenes ? localize(this.hass, "scene.n_scenes").replace("{n}", String(r.scenes)) : ""].filter(Boolean).join(", ")})` })) } } },
      { name: "favorites", selector: { entity: { multiple: true, filter: { domain: "scene" } } } },
      { name: "include", selector: { text: { multiple: true } } },
      { name: "exclude", selector: { text: { multiple: true } } },
      { name: "columns", selector: { number: { min: 2, max: 5, mode: "box" } } },
    ];
  }

  private _computeLabel = (s: { name: string }): string => localize(this.hass, `scene_editor.${s.name}`);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, unknown>;
    const config: SceneCardConfig = { ...this._config! };
    if (v.name) config.name = String(v.name); else delete config.name;
    for (const k of ["rooms", "favorites", "include", "exclude"] as const) {
      const l = Array.isArray(v[k]) ? (v[k] as string[]).filter(Boolean) : [];
      if (l.length) config[k] = l; else delete config[k];
    }
    const cols = Number(v.columns);
    if (Number.isFinite(cols) && cols >= 2 && cols !== 3) config.columns = cols; else delete config.columns;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const c = this._config;
    const data = { name: c.name, rooms: c.rooms ?? [], favorites: c.favorites ?? [], include: c.include ?? [], exclude: c.exclude ?? [], columns: c.columns ?? 3 };
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <p class="hint">${localize(this.hass, "scene_editor.hint")}</p>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .hint { font-size: 12.5px; color: var(--secondary-text-color); }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
