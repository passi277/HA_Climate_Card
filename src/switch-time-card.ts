import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant, SwitchTimeCardConfig } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { datetimeParts, nextOccurrence, UNAVAILABLE } from "./utils";
import { pad } from "./components/time-picker";
import "./components/time-picker";
import "./switch-time-editor";

const DEFAULT_COLOR = "#7e57c2";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-switch-time-card",
  name: "Modern Switch & Time",
  description: "Einfache Karte aus Schalter und Uhrzeit (input_datetime) – z.B. Wecker, Zeitschaltung, Sleeptimer (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

@customElement("ha-switch-time-card")
export class HaSwitchTimeCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: SwitchTimeCardConfig;
  @state() private _editing = false;
  @state() private _pendingMinutes?: number;
  @state() private _pendingDate?: Date;
  @state() private _now = Date.now();
  private _tick?: number;
  private _commitTimer?: number;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-switch-time-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<SwitchTimeCardConfig> {
    const ids = Object.keys(hass.states);
    return {
      switch_entity: ids.find((id) => id.startsWith("input_boolean.")),
      time_entity: ids.find((id) => id.startsWith("input_datetime.")),
    };
  }

  public setConfig(config: SwitchTimeCardConfig): void {
    if (!config || (!config.switch_entity && !config.time_entity)) {
      throw new Error("ha-switch-time-card: 'switch_entity' und/oder 'time_entity' angeben");
    }
    this._config = { ...config };
  }

  public getCardSize(): number {
    return 2;
  }

  public getGridOptions() {
    return { columns: 6, min_columns: 3, rows: "auto" };
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._tick = window.setInterval(() => (this._now = Date.now()), 30_000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._tick);
    clearTimeout(this._commitTimer);
  }

  private _t(key: string): string {
    return localize(this.hass, key);
  }

  private get _switch(): HassEntity | undefined {
    return this._config?.switch_entity ? this.hass?.states[this._config.switch_entity] : undefined;
  }

  private get _time(): HassEntity | undefined {
    return this._config?.time_entity ? this.hass?.states[this._config.time_entity] : undefined;
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    const c = this._config;
    if (!old || !c) return true;
    return [c.switch_entity, c.time_entity].some((id) => id && old.states[id] !== this.hass!.states[id]) || old.locale !== this.hass!.locale;
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!changed.has("hass")) return;
    // Auswahl verwerfen, sobald Home Assistant den neuen Wert meldet
    const p = datetimeParts(this._time);
    if (this._pendingMinutes != null && this._pendingMinutes === p.minutes) this._pendingMinutes = undefined;
    if (this._pendingDate && p.date && this._pendingDate.toDateString() === p.date.toDateString()) this._pendingDate = undefined;
  }

  private _toggle(): void {
    const sw = this._switch;
    if (!sw || !this.hass) return;
    window.dispatchEvent(new CustomEvent("haptic", { detail: "light" }));
    this.hass.callService("homeassistant", sw.state === "on" ? "turn_off" : "turn_on", { entity_id: sw.entity_id });
  }

  private _schedule(): void {
    clearTimeout(this._commitTimer);
    this._commitTimer = window.setTimeout(() => this._commit(), 900);
  }

  private _commit(): void {
    clearTimeout(this._commitTimer);
    const t = this._time;
    if (!t || !this.hass || (this._pendingMinutes == null && !this._pendingDate)) return;
    const p = datetimeParts(t);
    const minutes = this._pendingMinutes ?? p.minutes ?? 0;
    const time = `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00`;
    const d = this._pendingDate ?? p.date ?? new Date();
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const data: Record<string, unknown> = { entity_id: t.entity_id };
    if (p.hasDate && p.hasTime) data.datetime = `${date} ${time}`;
    else if (p.hasDate) data.date = date;
    else data.time = time;
    this.hass.callService("input_datetime", "set_datetime", data).catch((err) => {
      this._pendingMinutes = undefined;
      this._pendingDate = undefined;
      this.dispatchEvent(new CustomEvent("hass-notification", {
        detail: { message: `${this._t("card.error")}: ${err?.message ?? err}` }, bubbles: true, composed: true,
      }));
    });
  }

  private _moreInfo(entityId?: string): void {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  private _dateText(d: Date): string {
    const lang = getLanguage(this.hass);
    const today = new Date(this._now);
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - today.getTime()) / 86400000);
    const rel = diff === 0 ? this._t("switch_time.today") : diff === 1 ? this._t("switch_time.tomorrow") : "";
    const txt = d.toLocaleDateString(lang, { weekday: "short", day: "2-digit", month: "2-digit" });
    return rel ? `${rel}, ${txt}` : txt;
  }

  private _remaining(target: Date): string {
    const mins = Math.max(0, Math.round((target.getTime() - this._now) / 60000));
    const days = Math.floor(mins / 1440);
    if (days >= 1) return `${days} ${this._t(days === 1 ? "switch_time.day" : "switch_time.days")}`;
    const h = Math.floor(mins / 60);
    return h ? `${h}:${pad(mins % 60)} h` : `${mins} min`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const sw = this._switch;
    const t = this._time;
    const missing = [c.switch_entity, c.time_entity].filter((id) => id && !this.hass!.states[id]);
    if (missing.length) return html`<ha-card><div class="warning">${this._t("card.entity_not_found")}: ${missing.join(", ")}</div></ha-card>`;
    const unavailable = [sw, t].some((s) => s && UNAVAILABLE.includes(s.state));
    const on = sw ? sw.state === "on" : true;
    const p = datetimeParts(t);
    const minutes = this._pendingMinutes ?? p.minutes;
    const date = this._pendingDate ?? p.date;
    const next = t ? nextOccurrence(p.hasTime ? minutes : 0, p.hasDate ? date : undefined, this._now) : undefined;
    const past = !!next && next.getTime() < this._now;
    const name = c.name ?? sw?.attributes.friendly_name ?? t?.attributes.friendly_name ?? "";
    const color = c.color ?? DEFAULT_COLOR;
    const anim = c.animations ?? "full";
    const statusParts = [sw ? this._t(on ? "switch_time.on" : "switch_time.off") : ""];
    if (on && next && !past && c.show_remaining !== false) statusParts.push(`${this._t("switch_time.in")} ${this._remaining(next)}`);
    if (past) statusParts.push(this._t("switch_time.past"));
    const pending = this._pendingMinutes != null || !!this._pendingDate;
    return html`<ha-card class="switch-time compact ${on ? "active" : "off"} anim-${anim}" style="--hcc-accent-c:${on ? color : "var(--state-inactive-color, #8a8a8a)"};--hcc-timer-color:${color}">
      <div class="glow"><span class="blob b1"></span><span class="blob b2"></span></div>
      <div class="header">
        <button class="title" @click=${() => this._moreInfo(c.switch_entity ?? c.time_entity)}>
          <span class="icon-badge ${on ? "lit" : ""}">
            <ha-icon .icon=${c.icon ?? sw?.attributes.icon ?? (on ? "mdi:alarm" : "mdi:alarm-off")}></ha-icon>
          </span>
          <span class="names">
            <span class="name">${name}</span>
            <span class="status">${unavailable ? this._t("card.unavailable") : statusParts.filter(Boolean).join(" · ")}</span>
          </span>
        </button>
        ${sw ? html`<button class="switch ${on ? "on" : ""}" role="switch" aria-checked=${on} aria-label=${name}
          ?disabled=${UNAVAILABLE.includes(sw.state)} @click=${this._toggle}><span class="thumb"></span></button>` : nothing}
      </div>
      ${t ? html`<button class="clock ${this._editing ? "editing" : ""} ${pending ? "pending" : ""}" aria-expanded=${this._editing}
          ?disabled=${UNAVAILABLE.includes(t.state)} @click=${() => { if (this._editing) this._commit(); this._editing = !this._editing; }}>
          ${p.hasTime ? html`<span class="time">${minutes != null ? `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}` : "--:--"}</span>` : nothing}
          ${p.hasDate && date ? html`<span class="date">${this._dateText(date)}</span>` : nothing}
          <ha-icon class="edit" icon=${this._editing ? "mdi:check" : "mdi:pencil-outline"}></ha-icon>
        </button>` : nothing}
      ${t && this._editing ? html`<div class="editor">
        ${p.hasTime ? html`<hcc-time-picker .minutes=${minutes ?? 0} .minuteStep=${c.minute_step ?? 5}
          .hourText=${this._t("card.hour")} .minuteText=${this._t("card.minute")}
          .dateText=${p.hasDate && date ? this._dateText(date) : ""} .dateLabel=${this._t("switch_time.date")}
          @time-changed=${(e: CustomEvent) => { this._pendingMinutes = e.detail.minutes; this._schedule(); }}
          @date-changed=${(e: CustomEvent) => this._shiftDate(date, e.detail.days)}></hcc-time-picker>`
        : html`<hcc-time-picker .timeHidden=${true} .minutes=${0} .dateText=${date ? this._dateText(date) : ""}
          .dateLabel=${this._t("switch_time.date")} @date-changed=${(e: CustomEvent) => this._shiftDate(date, e.detail.days)}></hcc-time-picker>`}
        <button class="done" @click=${() => { this._commit(); this._editing = false; }}>${this._t("card.done")}</button>
      </div>` : nothing}
    </ha-card>`;
  }

  private _shiftDate(current: Date | undefined, days: number): void {
    const d = new Date(current ?? this._now);
    d.setDate(d.getDate() + days);
    this._pendingDate = d;
    this._schedule();
  }

  static styles = [cardStyles, css`
    ha-card.switch-time { gap: 12px; }
    ha-card.switch-time .blob { opacity: 0.45; animation-play-state: paused; }
    ha-card.switch-time.off .blob { opacity: 0.2; }
    .icon-badge.lit { box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 50%, transparent); }
    .switch { flex: none; position: relative; width: 52px; height: 30px; border-radius: 15px; border: none; cursor: pointer; padding: 0;
      background: rgba(127,127,127,0.35); transition: background 0.3s, box-shadow 0.3s; }
    .switch.on { background: var(--hcc-timer-color); box-shadow: 0 4px 14px color-mix(in srgb, var(--hcc-timer-color) 40%, transparent); }
    .switch:disabled { opacity: 0.4; cursor: default; }
    .thumb { position: absolute; top: 3px; left: 3px; width: 24px; height: 24px; border-radius: 50%; background: #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3); transition: transform 0.3s var(--ease-spring); }
    .switch.on .thumb { transform: translateX(22px); }
    .switch:focus-visible { outline: 2px solid var(--hcc-timer-color); outline-offset: 2px; }
    .clock { position: relative; display: flex; align-items: baseline; justify-content: center; flex-wrap: wrap; gap: 4px 12px;
      border: none; cursor: pointer; font: inherit; color: var(--primary-text-color); padding: 10px 40px; border-radius: var(--hcc-inner-radius, 14px);
      background: rgba(127,127,127,0.1); transition: background 0.3s, box-shadow 0.3s; }
    ha-card.active .clock { background: color-mix(in srgb, var(--accent) 12%, transparent); }
    .clock:hover { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent); }
    .clock.editing { box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--hcc-timer-color) 60%, transparent); }
    .clock:disabled { opacity: 0.5; cursor: default; }
    .time { font-size: clamp(34px, 11vw, 46px); font-weight: 300; line-height: 1.05; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
    ha-card.off .time { color: var(--secondary-text-color); }
    .clock.pending .time { color: var(--hcc-timer-color); }
    .date { font-size: 14px; color: var(--secondary-text-color); }
    .edit { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); --mdc-icon-size: 18px; color: var(--secondary-text-color); }
    .editor { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 12px 8px; border-radius: var(--hcc-inner-radius, 14px);
      background: color-mix(in srgb, var(--hcc-timer-color) 10%, rgba(127,127,127,0.08)); animation: slide-in 0.35s var(--ease-out) both; }
    hcc-time-picker { --tp-color: var(--hcc-timer-color); }
    .done { border: none; border-radius: 999px; padding: 8px 18px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
      background: var(--hcc-timer-color); color: #fff; }
    .warning { padding: 16px; color: var(--error-color, #db4437); }
  `];
}
