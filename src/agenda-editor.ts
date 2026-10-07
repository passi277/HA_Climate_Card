import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { AgendaCalendar, AgendaCardConfig, HomeAssistant } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

/** Visueller Editor: Abfallkalender, weitere Kalender, Zeitraum, Anzahl, Erinnerung. */
@customElement("ha-agenda-card-editor")
export class HaAgendaCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: AgendaCardConfig;

  public setConfig(config: AgendaCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `agenda_editor.${key}`);
  }

  private _schema() {
    return [
      { name: "name", selector: { text: {} } },
      { name: "waste", selector: { entity: { multiple: true, filter: { domain: "calendar" } } } },
      { name: "calendars", selector: { entity: { multiple: true, filter: { domain: "calendar" } } } },
      { type: "grid", name: "", schema: [
        { name: "days", selector: { number: { min: 1, max: 60, mode: "box", unit_of_measurement: "d" } } },
        { name: "max_events", selector: { number: { min: 1, max: 50, mode: "box" } } },
        { name: "reminder_time", selector: { time: {} } },
        { name: "waste_in_agenda", selector: { boolean: {} } },
      ] },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, unknown>;
    const config: AgendaCardConfig = { ...this._config! };
    if (v.name) config.name = String(v.name); else delete config.name;
    const waste = Array.isArray(v.waste) ? (v.waste as string[]).filter(Boolean) : [];
    if (waste.length) config.waste = waste.length === 1 ? waste[0] : waste; else delete config.waste;
    const cals = Array.isArray(v.calendars) ? (v.calendars as string[]).filter(Boolean) : [];
    // Farben/Namen vorhandener Einträge behalten
    const old = new Map<string, string | AgendaCalendar>((this._config!.calendars ?? []).map((c): [string, string | AgendaCalendar] => (typeof c === "string" ? [c, c] : [c.entity, c])));
    if (cals.length) config.calendars = cals.map((id) => old.get(id) ?? id); else delete config.calendars;
    const d = Number(v.days), m = Number(v.max_events);
    if (Number.isFinite(d) && d > 0 && d !== 14) config.days = d; else delete config.days;
    if (Number.isFinite(m) && m > 0 && m !== 12) config.max_events = m; else delete config.max_events;
    if (v.reminder_time && String(v.reminder_time).slice(0, 5) !== "16:00") config.reminder_time = String(v.reminder_time).slice(0, 5); else delete config.reminder_time;
    if (v.waste_in_agenda) config.waste_in_agenda = true; else delete config.waste_in_agenda;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const c = this._config;
    const data = { name: c.name, waste: !c.waste ? [] : Array.isArray(c.waste) ? c.waste : [c.waste],
      calendars: (c.calendars ?? []).map((x) => (typeof x === "string" ? x : x.entity)), days: c.days ?? 14, max_events: c.max_events ?? 12,
      reminder_time: c.reminder_time ?? "16:00", waste_in_agenda: !!c.waste_in_agenda };
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
