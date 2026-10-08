import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, LockCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

/** Visueller Editor: Schloss, Name, Verlauf, Rückfrage; Klingel und Türsensor optional. */
@customElement("ha-lock-card-editor")
export class HaLockCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: LockCardConfig;

  public setConfig(config: LockCardConfig): void {
    this._config = config;
  }

  private _schema() {
    return [
      { name: "entity", selector: { entity: { filter: { domain: "lock" } } } },
      { name: "name", selector: { text: {} } },
      { type: "grid", name: "", schema: [
        { name: "history", selector: { boolean: {} } },
        { name: "confirm", selector: { boolean: {} } },
        { name: "history_hours", selector: { number: { min: 1, max: 336, mode: "box" } } },
      ] },
      { name: "doorbell", selector: { entity: { filter: [{ domain: "binary_sensor" }, { domain: "event" }] } } },
      { name: "door", selector: { entity: { filter: { domain: "binary_sensor" } } } },
    ];
  }

  private _computeLabel = (s: { name: string }): string => localize(this.hass, `lock_editor.${s.name}`);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, unknown>;
    const config: LockCardConfig = { ...this._config!, entity: String(v.entity ?? "") };
    for (const k of ["name", "doorbell", "door"] as const) { if (v[k]) config[k] = String(v[k]); else delete config[k]; }
    for (const k of ["history", "confirm"] as const) { if (v[k] === false) config[k] = false; else delete config[k]; }
    const h = Number(v.history_hours);
    if (Number.isFinite(h) && h > 0 && h !== 48) config.history_hours = h; else delete config.history_hours;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const c = this._config;
    const data = { entity: c.entity ?? "", name: c.name ?? "", history: c.history !== false, confirm: c.confirm !== false,
      history_hours: c.history_hours ?? 48, doorbell: c.doorbell ?? "", door: c.door ?? "" };
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <p class="hint">${localize(this.hass, "lock_editor.hint")}</p>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .hint { font-size: 12.5px; color: var(--secondary-text-color); }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
