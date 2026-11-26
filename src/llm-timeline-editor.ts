import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, LlmTimelineCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

/** Visueller Editor: Kalender, Name, Zeitraum, Anzahl, Bereiche und Kamera-Filter. */
@customElement("ha-llm-timeline-card-editor")
export class HaLlmTimelineCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: LlmTimelineCardConfig;

  public setConfig(config: LlmTimelineCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `llm_editor.${key}`);
  }

  private _schema() {
    return [
      { name: "entity", required: true, selector: { entity: { filter: { domain: "calendar" } } } },
      { name: "name", selector: { text: {} } },
      { type: "grid", name: "", schema: [
        { name: "days", selector: { number: { min: 1, max: 60, mode: "box", unit_of_measurement: "d" } } },
        { name: "limit", selector: { number: { min: 5, max: 200, mode: "box" } } },
      ] },
      { type: "grid", name: "", schema: [
        { name: "show_latest", selector: { boolean: {} } },
        { name: "show_filters", selector: { boolean: {} } },
        { name: "show_no_activity", selector: { boolean: {} } },
      ] },
      { name: "cameras", selector: { entity: { multiple: true, filter: { domain: "camera" } } } },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, unknown>;
    const config: LlmTimelineCardConfig = { ...this._config!, entity: String(v.entity ?? "") };
    if (v.name) config.name = String(v.name); else delete config.name;
    const days = Number(v.days), limit = Number(v.limit);
    if (Number.isFinite(days) && days > 0 && days !== 7) config.days = days; else delete config.days;
    if (Number.isFinite(limit) && limit > 0 && limit !== 20) config.limit = limit; else delete config.limit;
    if (v.show_latest === false) config.show_latest = false; else delete config.show_latest;
    if (v.show_filters === false) config.show_filters = false; else delete config.show_filters;
    if (v.show_no_activity) config.show_no_activity = true; else delete config.show_no_activity;
    const cams = Array.isArray(v.cameras) ? (v.cameras as string[]).filter(Boolean) : [];
    if (cams.length) config.cameras = cams; else delete config.cameras;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const c = this._config;
    const data = { entity: c.entity, name: c.name, days: c.days ?? 7, limit: c.limit ?? 20, show_latest: c.show_latest !== false,
      show_filters: c.show_filters !== false, show_no_activity: !!c.show_no_activity, cameras: c.cameras ?? [] };
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
