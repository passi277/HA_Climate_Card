import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { AgendaCalendar, AgendaCardConfig, HomeAssistant } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { clockMinutes, daysUntil, eventStart, nextPickups, wasteStyle, type CalendarEventLike, type WastePickup } from "./utils";
import "./agenda-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-agenda-card",
  name: "Modern Agenda Card",
  description: "Termine & Abfall: nächste Abholung je Tonne mit Countdown und Erinnerung am Vorabend, dazu eine Terminliste aus mehreren Kalendern, gruppiert nach Tagen (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const PALETTE = ["#42a5f5", "#ab47bc", "#26a69a", "#ef5350", "#ffa726", "#66bb6a", "#ec407a", "#8d6e63"];
const REFRESH_MS = 15 * 60_000;

interface RawEvent extends CalendarEventLike { end?: string | { date?: string; dateTime?: string }; location?: string; uid?: string }
interface AgendaItem { cal: AgendaCalendar & { color: string }; summary: string; date: Date; end?: Date; allDay: boolean; location?: string; waste?: boolean }

@customElement("ha-agenda-card")
export class HaAgendaCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: AgendaCardConfig;
  @state() private _waste: RawEvent[] = [];
  @state() private _items: AgendaItem[] = [];
  @state() private _loaded = false;
  private _key = "";
  private _timer?: number;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-agenda-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<AgendaCardConfig> {
    const cals = Object.keys(hass.states).filter((id) => id.startsWith("calendar."));
    const waste = cals.find((id) => /abfall|muell|müll|waste|trash/.test(id));
    return { waste, calendars: cals.filter((id) => id !== waste).slice(0, 2) };
  }

  public setConfig(config: AgendaCardConfig): void {
    if (!config || (!config.waste && !config.calendars?.length)) throw new Error("ha-agenda-card: 'waste' und/oder 'calendars' angeben");
    this._config = { ...config };
    this._key = "";
  }

  public getCardSize(): number {
    return 5;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._timer = window.setInterval(() => this._load(true), REFRESH_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._timer);
    this._key = "";
  }

  private _t(key: string): string {
    return localize(this.hass, `agenda.${key}`);
  }

  private _wasteIds(): string[] {
    const w = this._config?.waste;
    return !w ? [] : Array.isArray(w) ? w : [w];
  }

  private _cals(): (AgendaCalendar & { color: string })[] {
    return (this._config?.calendars ?? []).map((c, i) => {
      const o = typeof c === "string" ? { entity: c } : c;
      return { ...o, color: o.color ?? PALETTE[i % PALETTE.length]! };
    });
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old) return true;
    return [...this._wasteIds(), ...this._cals().map((c) => c.entity)].some((id) => old.states[id] !== this.hass!.states[id]) || old.locale !== this.hass!.locale;
  }

  protected updated(): void {
    this._load();
  }

  // ---------- Daten ----------

  private async _fetch(id: string, start: Date, end: Date): Promise<RawEvent[]> {
    try {
      return await this.hass!.callApi!<RawEvent[]>("GET", `calendars/${id}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`) ?? [];
    } catch {
      return [];
    }
  }

  private async _load(force = false): Promise<void> {
    const c = this._config;
    if (!c || !this.hass?.callApi) return;
    const ids = [...this._wasteIds(), ...this._cals().map((x) => x.entity)];
    const key = ids.map((id) => this.hass!.states[id]?.last_updated ?? "").join("|") + `|${c.days ?? 14}`;
    if (!force && key === this._key) return;
    this._key = key;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + (Math.max(1, c.days ?? 14) + 1) * 86400_000);
    const [waste, ...cals] = await Promise.all([
      Promise.all(this._wasteIds().map((id) => this._fetch(id, start, end))).then((l) => l.flat()),
      ...this._cals().map((cal) => this._fetch(cal.entity, start, end).then((evs) => ({ cal, evs }))),
    ]);
    const now = Date.now();
    const items: AgendaItem[] = [];
    for (const { cal, evs } of cals as { cal: AgendaCalendar & { color: string }; evs: RawEvent[] }[]) {
      for (const ev of evs) {
        const s = eventStart(ev.start);
        if (!s.date) continue;
        const e = ev.end ? eventStart(ev.end).date : undefined;
        if ((e ?? s.date).getTime() < now && !s.allDay) continue;
        items.push({ cal, summary: String(ev.summary ?? ""), date: s.date, end: e, allDay: s.allDay, location: ev.location || undefined });
      }
    }
    if (c.waste_in_agenda) {
      for (const ev of waste as RawEvent[]) {
        const s = eventStart(ev.start);
        if (!s.date) continue;
        const name = String(ev.summary ?? "");
        items.push({ cal: { entity: this._wasteIds()[0]!, color: wasteStyle(name).color, icon: wasteStyle(name).icon }, summary: name, date: s.date, allDay: true, waste: true });
      }
    }
    items.sort((a, b) => a.date.getTime() - b.date.getTime() || Number(b.allDay) - Number(a.allDay));
    this._waste = waste as RawEvent[];
    this._items = items;
    this._loaded = true;
  }

  // ---------- Darstellung ----------

  private _dayLabel(d: Date): string {
    const n = daysUntil(d);
    if (n === 0) return this._t("today");
    if (n === 1) return this._t("tomorrow");
    return d.toLocaleDateString(getLanguage(this.hass), { weekday: "short", day: "numeric", month: "short" });
  }

  private _when(p: WastePickup): string {
    if (p.days === 0) return this._t("today");
    if (p.days === 1) return this._t("tomorrow");
    if (p.days < 7) return p.date.toLocaleDateString(getLanguage(this.hass), { weekday: "long" });
    return this._t("in_days").replace("{n}", String(p.days));
  }

  private _time(d: Date): string {
    return d.toLocaleTimeString(getLanguage(this.hass), { hour: "2-digit", minute: "2-digit" });
  }

  private _renderWaste(pickups: WastePickup[]) {
    if (!this._wasteIds().length) return nothing;
    if (!pickups.length) return html`<div class="w-empty"><ha-icon icon="mdi:trash-can-outline"></ha-icon>${this._loaded ? this._t("no_pickups") : this._t("loading")}</div>`;
    const lang = getLanguage(this.hass);
    return html`<div class="bins" style="--n:${Math.min(pickups.length, 4)}">${pickups.slice(0, 4).map((p) => html`<div class="bin ${p.days <= 1 ? "soon" : ""} ${p.days === 0 ? "today" : ""}" style="--bc:${p.color}" data-days=${p.days}>
      <span class="b-ic"><ha-icon .icon=${p.icon}></ha-icon></span>
      <span class="b-name">${p.name}</span>
      <b class="b-when">${this._when(p)}</b>
      <small>${p.date.toLocaleDateString(lang, { day: "numeric", month: "short" })}</small>
    </div>`)}</div>`;
  }

  private _renderReminder(pickups: WastePickup[]) {
    const c = this._config!;
    const now = new Date();
    const after = clockMinutes(c.reminder_time, 16 * 60);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const tomorrow = pickups.filter((p) => p.days === 1);
    const today = pickups.filter((p) => p.days === 0);
    if (tomorrow.length && nowMin >= after) {
      return html`<div class="remind" style="--rc:${tomorrow[0]!.color}"><ha-icon icon="mdi:bell-ring-outline"></ha-icon>
        <span>${this._t("put_out").replace("{bins}", tomorrow.map((p) => p.name).join(" & "))}</span></div>`;
    }
    if (today.length && nowMin < 10 * 60) {
      return html`<div class="remind" style="--rc:${today[0]!.color}"><ha-icon icon="mdi:truck-outline"></ha-icon>
        <span>${this._t("today_pickup").replace("{bins}", today.map((p) => p.name).join(" & "))}</span></div>`;
    }
    return nothing;
  }

  private _renderAgenda() {
    if (!this._cals().length && !this._config!.waste_in_agenda) return nothing;
    const items = this._items.slice(0, this._config!.max_events ?? 12);
    if (!items.length) {
      return html`<div class="a-empty"><ha-icon icon="mdi:calendar-check-outline"></ha-icon>${this._loaded ? this._t("no_events").replace("{n}", String(this._config!.days ?? 14)) : this._t("loading")}</div>`;
    }
    const groups: { label: string; today: boolean; items: AgendaItem[] }[] = [];
    for (const it of items) {
      const label = this._dayLabel(it.date);
      const last = groups[groups.length - 1];
      if (last?.label === label) last.items.push(it);
      else groups.push({ label, today: daysUntil(it.date) === 0, items: [it] });
    }
    return html`<div class="agenda">${groups.map((g) => html`<div class="day ${g.today ? "today" : ""}">
      <div class="d-label">${g.label}</div>
      <div class="d-items">${g.items.map((it) => html`<button class="ev" style="--ec:${it.cal.color}" @click=${() => this._moreInfo(it.cal.entity)}>
        <span class="e-bar"></span>
        ${it.waste || it.cal.icon ? html`<ha-icon class="e-ic" .icon=${it.cal.icon ?? "mdi:calendar"}></ha-icon>` : nothing}
        <span class="e-text"><b>${it.summary || this._t("untitled")}</b>
          <small>${it.allDay ? this._t("all_day") : `${this._time(it.date)}${it.end ? `–${this._time(it.end)}` : ""}`}${it.location ? ` · ${it.location}` : ""}${!it.waste && this._cals().length > 1 ? ` · ${it.cal.name ?? this.hass!.states[it.cal.entity]?.attributes.friendly_name ?? ""}` : ""}</small></span>
      </button>`)}</div>
    </div>`)}</div>`;
  }

  private _moreInfo(id?: string): void {
    if (!id) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const pickups = nextPickups(this._waste, new Date(), c.days ?? 14);
    const soon = pickups.find((p) => p.days <= 1);
    const color = soon?.color ?? "var(--primary-color)";
    const next = pickups[0];
    const nextNames = next ? pickups.filter((p) => p.days === next.days).map((p) => p.name).join(" & ") : "";
    const todayEvents = this._items.filter((i) => !i.waste && daysUntil(i.date) === 0).length;
    const sub = [next ? `${nextNames} ${this._when(next).toLowerCase()}` : "", todayEvents ? this._t("events_today").replace("{n}", String(todayEvents)) : ""].filter(Boolean).join(" · ")
      || (this._loaded ? this._t("nothing") : this._t("loading"));
    return html`<ha-card class="agenda-card anim-${c.animations ?? "full"}" style="--hcc-accent-c:${color}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <span class="h-icon"><ha-icon icon="mdi:calendar-month-outline"></ha-icon></span>
        <span class="head-text"><span class="h-title">${c.name ?? this._t("title")}</span><span class="h-sub">${sub}</span></span>
      </div>
      ${this._renderReminder(pickups)}
      ${this._renderWaste(pickups)}
      ${this._renderAgenda()}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.agenda-card { --accent: var(--hcc-accent-c); gap: 12px; container-type: inline-size; }
    .header { display: flex; align-items: center; gap: 10px; }
    .h-icon { flex: none; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; color: var(--accent);
      background: color-mix(in srgb, var(--accent) 16%, transparent); }
    .h-icon ha-icon { --mdc-icon-size: 24px; }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .h-title { font-size: 17px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .h-sub { font-size: 13px; font-weight: 600; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .remind { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--hcc-inner-radius, 14px); font-size: 14px; font-weight: 700;
      background: color-mix(in srgb, var(--rc) 18%, transparent); }
    .remind ha-icon { --mdc-icon-size: 22px; color: var(--rc); animation: ring 2.4s ease-in-out infinite; transform-origin: 50% 10%; }
    @keyframes ring { 0%, 70%, 100% { transform: rotate(0); } 75% { transform: rotate(14deg); } 85% { transform: rotate(-12deg); } 92% { transform: rotate(6deg); } }
    ha-card.anim-reduced .remind ha-icon, ha-card.anim-off .remind ha-icon { animation: none; }

    /* Tonnen */
    .bins { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 8px; }
    @container (max-width: 380px) { .bins { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .bin { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 0; padding: 12px 6px 10px; border-radius: var(--hcc-inner-radius, 14px);
      background: color-mix(in srgb, var(--bc) 9%, rgba(127,127,127,0.05)); text-align: center; }
    .bin.soon { background: color-mix(in srgb, var(--bc) 22%, transparent); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--bc) 60%, transparent); }
    .b-ic { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; color: #fff; background: var(--bc); margin-bottom: 4px;
      box-shadow: 0 4px 10px color-mix(in srgb, var(--bc) 35%, transparent); }
    .b-ic ha-icon { --mdc-icon-size: 24px; }
    .bin.today .b-ic { animation: bob 1.6s ease-in-out infinite; }
    @keyframes bob { 50% { transform: translateY(-3px); } }
    .b-name { font-size: 12.5px; font-weight: 600; color: var(--secondary-text-color); max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .b-when { font-size: 15px; text-transform: capitalize; }
    .bin.soon .b-when { color: var(--bc); }
    .bin small { font-size: 11px; color: var(--secondary-text-color); }
    .w-empty, .a-empty { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; font-size: 13px; color: var(--secondary-text-color); }
    .w-empty ha-icon, .a-empty ha-icon { --mdc-icon-size: 20px; }

    /* Termine */
    .agenda { display: flex; flex-direction: column; gap: 10px; }
    .day { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 8px; }
    .d-label { padding-top: 8px; font-size: 12.5px; font-weight: 700; color: var(--secondary-text-color); text-transform: capitalize; }
    .day.today .d-label { color: var(--primary-color); }
    .d-items { display: flex; flex-direction: column; gap: 6px; }
    .ev { position: relative; display: flex; align-items: center; gap: 8px; padding: 8px 10px 8px 14px; border: none; border-radius: 12px; cursor: pointer; text-align: left;
      background: color-mix(in srgb, var(--ec) 9%, rgba(127,127,127,0.05)); overflow: hidden; }
    .e-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--ec); }
    .e-ic { --mdc-icon-size: 18px; color: var(--ec); flex: none; }
    .e-text { display: flex; flex-direction: column; min-width: 0; }
    .e-text b { font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .e-text small { font-size: 11.5px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    @container (max-width: 340px) { .day { grid-template-columns: 1fr; gap: 4px; } .d-label { padding-top: 0; } }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-agenda-card": HaAgendaCard;
  }
}
