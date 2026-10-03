import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant, RoomCardConfig } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import {
  activityLabel, brightnessPct, clockMinutes, detectDeviceType, lightColor, modeColor, resolveContacts, temperatureOf, UNAVAILABLE,
  upcomingPickups, type CalendarEventLike,
} from "./utils";
import { fallbackIcon } from "./components/shortcut-row";
import "./room-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-room-card",
  name: "Modern Room Header",
  description: "Raum-Kopf mit Status-Chips (Licht, Fenster, Temperatur, Feuchte, Klima, TV) und Hinweis „Fenster offen – Klima läuft“ (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

interface Chip { key: string; icon: string; text: string; color: string; entity?: string; toggle?: boolean; alert?: boolean; active?: boolean; }

/** Kalender alle 30 min neu laden */
const TRASH_REFRESH = 30 * 60_000;
/** Lange drücken auf eine Raumkachel schaltet das Licht */
const HOLD_MS = 500;

const GREEN = "var(--success-color, #43a047)";
const RED = "var(--error-color, #e53935)";
const ORANGE = "var(--warning-color, #fb8c00)";
const GREY = "var(--state-inactive-color, #8a8a8a)";
const TOGGLE_DOMAINS = ["light", "switch", "input_boolean", "fan", "automation"];

@customElement("ha-room-card")
export class HaRoomCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: RoomCardConfig;
  /** „Klima aus“ wartet auf Bestätigung (zweites Tippen) */
  @state() private _confirm = false;
  private _confirmTimer?: number;
  /** Termine des Müllkalenders */
  @state() private _events?: CalendarEventLike[];
  @state() private _now = Date.now();
  private _fetchedFor?: unknown;
  private _fetchedAt = 0;
  private _tick?: number;
  private _holdTimer?: number;
  private _held = false;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-room-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<RoomCardConfig> {
    const ids = Object.keys(hass.states);
    return { title: "Raum", light: ids.find((id) => id.startsWith("light.")), climate: ids.find((id) => id.startsWith("climate.")) };
  }

  public setConfig(config: RoomCardConfig): void {
    if (!config) throw new Error("ha-room-card: Konfiguration fehlt");
    this._config = { ...config };
  }

  public getCardSize(): number {
    return 2;
  }

  public getGridOptions() {
    return this._config?.layout === "tile" ? { columns: 4, min_columns: 3, rows: "auto" } : { columns: 12, min_columns: 4, rows: "auto" };
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._tick = window.setInterval(() => (this._now = Date.now()), 5 * 60_000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._confirmTimer);
    clearTimeout(this._holdTimer);
    clearInterval(this._tick);
  }

  protected updated(): void {
    this._maybeFetchTrash();
  }

  /** Termine über die Kalender-API laden (bei Änderung des Kalenders und alle 30 min). */
  private _maybeFetchTrash(): void {
    const id = this._config?.trash;
    const st = id ? this.hass?.states[id] : undefined;
    if (!id || !st || !id.startsWith("calendar.") || !this.hass?.callApi) return;
    if (this._fetchedFor === st && Date.now() - this._fetchedAt < TRASH_REFRESH) return;
    this._fetchedFor = st;
    this._fetchedAt = Date.now();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + ((this._config!.trash_days ?? 1) + 2) * 86_400_000);
    this.hass.callApi<CalendarEventLike[]>("GET", `calendars/${id}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`)
      .then((events) => { this._events = Array.isArray(events) ? events : undefined; })
      .catch(() => { this._events = undefined; });
  }

  private _t(key: string): string {
    return localize(this.hass, key);
  }

  private _watched(): string[] {
    const c = this._config;
    if (!c) return [];
    return [c.light, c.temperature, c.humidity, c.climate, c.media, c.trash,
      ...(c.contacts ?? []).map((x) => (typeof x === "string" ? x : x.entity)),
      ...(c.chips ?? []).map((x) => (typeof x === "string" ? x : x.entity))].filter(Boolean) as string[];
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this._config) return true;
    return this._watched().some((id) => old.states[id] !== this.hass!.states[id]) || old.locale !== this.hass!.locale;
  }

  private _num(v: number, digits = 1): string {
    return v.toLocaleString(getLanguage(this.hass), { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  }

  private _humidityOf(st?: HassEntity): number | undefined {
    if (!st || UNAVAILABLE.includes(st.state)) return undefined;
    const v = st.entity_id.startsWith("climate.") ? Number(st.attributes.current_humidity) : Number(st.state);
    return Number.isFinite(v) ? v : undefined;
  }

  private _chips(): Chip[] {
    const c = this._config!;
    const s = this.hass!.states;
    const out: Chip[] = [];
    const light = c.light ? s[c.light] : undefined;
    if (light) {
      const on = light.state === "on";
      out.push({ key: "light", entity: light.entity_id, toggle: true, icon: on ? "mdi:lightbulb-group" : "mdi:lightbulb-group-outline",
        color: on ? (lightColor(light) ?? "#ffb300") : GREY,
        text: on ? `${this._t("room.light_on")}${light.attributes.brightness != null ? ` · ${brightnessPct(light)} %` : ""}` : this._t("room.light_off") });
    }
    const contacts = resolveContacts(s, { contact_sensors: c.contacts });
    if (contacts.length) {
      const open = contacts.filter((x) => x.open);
      const unknown = contacts.every((x) => UNAVAILABLE.includes(s[x.entity]?.state ?? "unavailable"));
      const doors = open.every((x) => x.type === "door");
      out.push({ key: "contacts", entity: (open[0] ?? contacts[0]).entity, alert: open.length > 0,
        icon: open.length ? (doors ? "mdi:door-open" : "mdi:window-open-variant") : "mdi:window-closed-variant",
        color: open.length ? RED : unknown ? GREY : GREEN,
        text: open.length ? `${open.map((x) => x.name).join(" + ")} ${this._t("room.open")}` : unknown ? `${this._t("room.windows")} ?` : this._t("room.all_closed") });
    }
    const temp = c.temperature ? temperatureOf(s[c.temperature]) : undefined;
    if (temp != null) out.push({ key: "temperature", entity: c.temperature, icon: "mdi:home-thermometer", color: "var(--state-climate-cool-color, #2196f3)", text: `${this._num(temp)} °C` });
    const hum = this._humidityOf(c.humidity ? s[c.humidity] : undefined);
    if (hum != null) {
      const warn = hum >= (c.humidity_warning ?? 65);
      out.push({ key: "humidity", entity: c.humidity, icon: "mdi:water-percent", alert: warn, color: warn ? ORANGE : "var(--state-climate-dry-color, #00bcd4)", text: `${Math.round(hum)} %` });
    }
    const climate = c.climate ? s[c.climate] : undefined;
    if (climate) {
      const heating = detectDeviceType(climate) === "heating";
      const name = this._t(heating ? "room.heating" : "room.climate");
      const off = climate.state === "off" || UNAVAILABLE.includes(climate.state);
      const target = climate.attributes.temperature;
      out.push({ key: "climate", entity: climate.entity_id, icon: heating ? "mdi:radiator" : "mdi:air-conditioner", color: off ? GREY : modeColor(climate),
        text: off ? `${name} ${this._t("room.off")}` : `${name}${target != null ? ` ${this._num(Number(target))} °C` : ""}` });
    }
    const media = c.media ? s[c.media] : undefined;
    if (media) {
      let on: boolean;
      let text: string;
      if (media.entity_id.startsWith("remote.")) {
        const act = media.attributes.current_activity as string | undefined;
        on = media.state === "on" && !!act && !/power.?off/i.test(act);
        text = on ? activityLabel(act!) : this._t("room.tv_off");
      } else {
        on = !["off", "standby", "unavailable", "unknown"].includes(media.state);
        text = on ? String(media.attributes.media_title ?? media.attributes.app_name ?? media.attributes.friendly_name) : this._t("room.tv_off");
      }
      out.push({ key: "media", entity: media.entity_id, icon: on ? "mdi:television-play" : "mdi:television-off", color: on ? "#7c4dff" : GREY, text });
    }
    for (const p of this._pickups()) {
      out.push({ key: `trash-${p.name}-${p.days}`, entity: c.trash, icon: p.icon, color: p.color, alert: p.days === 0, active: true,
        text: `${p.name} · ${p.days === 0 ? this._t("room.today") : p.days === 1 ? this._t("room.tomorrow") : `${this._t("room.in_days").replace("{n}", String(p.days))}`}` });
    }
    for (const x of c.chips ?? []) {
      const cfg = typeof x === "string" ? { entity: x } : x;
      const st = s[cfg.entity];
      if (!st) continue;
      const domain = cfg.entity.split(".")[0];
      const on = st.state === "on";
      const value = this.hass!.formatEntityState?.(st) ?? st.state;
      out.push({ key: cfg.entity, entity: cfg.entity, toggle: TOGGLE_DOMAINS.includes(domain),
        icon: cfg.icon ?? fallbackIcon(st, cfg.entity, cfg.name ?? ""), color: on ? "var(--primary-color)" : GREY,
        text: cfg.name ? `${cfg.name}${TOGGLE_DOMAINS.includes(domain) || domain === "binary_sensor" ? ` · ${value}` : `: ${value}`}` : value });
    }
    return out;
  }

  private _pickups() {
    const c = this._config!;
    const st = c.trash ? this.hass!.states[c.trash] : undefined;
    if (!st || UNAVAILABLE.includes(st.state)) return [];
    // Ohne Kalender-API: nächster Termin aus den Attributen
    const events = this._events ?? (st.attributes.start_time ? [{ message: st.attributes.message, start: String(st.attributes.start_time) }] : []);
    return upcomingPickups(events, new Date(this._now), c.trash_days ?? 1, clockMinutes(c.trash_today_until, 600));
  }

  private _tap(chip: Chip): void {
    if (!chip.entity || !this.hass) return;
    if (chip.toggle) {
      window.dispatchEvent(new CustomEvent("haptic", { detail: "light" }));
      this.hass.callService("homeassistant", "toggle", { entity_id: chip.entity });
      return;
    }
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: chip.entity }, bubbles: true, composed: true }));
  }

  private _climateOff(): void {
    const id = this._config?.climate;
    if (!id || !this.hass) return;
    if (!this._confirm) {
      this._confirm = true;
      clearTimeout(this._confirmTimer);
      this._confirmTimer = window.setTimeout(() => (this._confirm = false), 4000);
      return;
    }
    this._confirm = false;
    window.dispatchEvent(new CustomEvent("haptic", { detail: "success" }));
    this.hass.callService("climate", "turn_off", { entity_id: id });
  }

  private _navigate(): void {
    const path = this._config?.navigation_path;
    if (!path) return;
    window.history.pushState(null, "", path);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  // ---------- Kachel ----------

  private _tileTap(): void {
    if (this._held) { this._held = false; return; }
    const c = this._config!;
    if (c.navigation_path) this._navigate();
    else if (c.light) this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: c.light }, bubbles: true, composed: true }));
  }

  private _holdStart(ev: PointerEvent): void {
    if (ev.button !== 0 || !this._config?.light) return;
    this._held = false;
    clearTimeout(this._holdTimer);
    this._holdTimer = window.setTimeout(() => {
      this._held = true;
      window.dispatchEvent(new CustomEvent("haptic", { detail: "medium" }));
      this.hass!.callService("homeassistant", "toggle", { entity_id: this._config!.light });
    }, HOLD_MS);
  }

  private _holdEnd = (): void => clearTimeout(this._holdTimer);

  private _renderTile(chips: Chip[]) {
    const c = this._config!;
    const light = chips.find((x) => x.key === "light");
    const lightOn = !!light && light.color !== GREY;
    const accent = lightOn ? light!.color : c.color ?? "var(--primary-color)";
    const temp = chips.find((x) => x.key === "temperature");
    const hum = chips.find((x) => x.key === "humidity");
    const extra = chips.find((x) => !["light", "contacts", "temperature", "humidity", "climate", "media"].includes(x.key) && !x.key.startsWith("trash-"));
    const sub = temp || hum ? [temp?.text, hum?.text].filter(Boolean).join(" · ") : extra?.text ?? "";
    // Kleine Symbole nur für das, was gerade „los“ ist
    const marks = chips.filter((x) => (x.key === "light" && lightOn) || (x.key === "contacts" && x.alert) || (x.key === "humidity" && x.alert)
      || (x.key === "climate" && x.color !== GREY) || (x.key === "media" && x.color !== GREY) || x.key.startsWith("trash-"));
    const label = [c.title ?? this._t("room.title"), sub, ...marks.map((x) => x.text)].filter(Boolean).join(", ");
    // Feste Ecke je Art (wiedererkennbar), sonst nächste freie Ecke
    const CORNERS = ["tl", "tr", "bl", "br"] as const;
    const home = (x: Chip): (typeof CORNERS)[number] => x.key === "light" ? "tl" : x.key === "contacts" ? "tr"
      : x.key === "climate" || x.key === "humidity" ? "bl" : "br";
    const placed = new Map<(typeof CORNERS)[number], Chip>();
    const order = [...marks].sort((a, b) => Number(!!b.alert) - Number(!!a.alert));
    for (const x of order) {
      const want = home(x);
      const spot = !placed.has(want) ? want : CORNERS.find((k) => !placed.has(k));
      if (spot) placed.set(spot, x);
    }
    return html`<ha-card class="room tile anim-${c.animations ?? "full"} ${lightOn ? "lit" : ""} ${c.navigation_path || c.light ? "clickable" : ""}"
      style="--hcc-accent-c:${accent}" role="button" tabindex="0" aria-label=${label} lang=${getLanguage(this.hass)}
      @click=${this._tileTap} @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._tileTap(); } }}
      @pointerdown=${(e: PointerEvent) => this._holdStart(e)} @pointerup=${this._holdEnd} @pointerleave=${this._holdEnd} @pointercancel=${this._holdEnd}
      @contextmenu=${(e: Event) => { if (c.light) e.preventDefault(); }}>
      <div class="glow"><span class="blob b1"></span><span class="blob b2"></span></div>
      ${[...placed].map(([corner, x]) => html`<span class="mark ${corner} ${x.alert ? "alert" : ""}" style="--cc:${x.color}" title=${x.text}
        data-key=${x.key} data-corner=${corner}><ha-icon .icon=${x.icon}></ha-icon></span>`)}
      <span class="icon-badge"><ha-icon .icon=${c.icon ?? "mdi:home"}></ha-icon></span>
      <div class="tile-text">
        <span class="tile-name">${c.title ?? this._t("room.title")}</span>
        <span class="tile-sub">${sub || "\u00a0"}</span>
      </div>
    </ha-card>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const chips = this._chips();
    if (c.layout === "tile") return this._renderTile(chips);
    const climate = c.climate ? this.hass.states[c.climate] : undefined;
    const openContacts = resolveContacts(this.hass.states, { contact_sensors: c.contacts }).filter((x) => x.open);
    const climateRunning = !!climate && climate.state !== "off" && !UNAVAILABLE.includes(climate.state);
    const warn = c.window_warning !== false && climateRunning && openContacts.length > 0;
    const heating = climate ? detectDeviceType(climate) === "heating" : false;
    const lightChip = chips.find((x) => x.key === "light");
    const accent = warn ? ORANGE : lightChip && lightChip.color !== GREY ? lightChip.color : "var(--primary-color)";
    return html`<ha-card class="room anim-${c.animations ?? "full"} ${warn ? "warn" : ""}" style="--hcc-accent-c:${accent}">
      <div class="glow"><span class="blob b1"></span><span class="blob b2"></span></div>
      <div class="head ${c.navigation_path ? "nav" : ""}" @click=${() => this._navigate()}>
        <span class="icon-badge" style=${c.color ? `--accent:${c.color}` : ""}><ha-icon .icon=${c.icon ?? "mdi:home"}></ha-icon></span>
        <span class="room-title">${c.title ?? this._t("room.title")}</span>
        ${c.navigation_path ? html`<ha-icon class="nav-chevron" icon="mdi:chevron-right"></ha-icon>` : nothing}
      </div>
      ${warn ? html`<div class="banner">
        <ha-icon icon="mdi:window-open-variant"></ha-icon>
        <div><strong>${this._t(heating ? "room.warn_heating" : "room.warn_climate")}</strong>
          <span>${openContacts.map((x) => x.name).join(", ")} – ${this._t("room.warn_hint")}</span></div>
        <button class="banner-action ${this._confirm ? "confirm" : ""}" @click=${this._climateOff}>
          ${this._confirm ? this._t("room.confirm") : this._t(heating ? "room.heating_off" : "room.climate_off")}</button>
      </div>` : nothing}
      ${chips.length ? html`<div class="chips">
        ${chips.map((x) => html`<button class="chip ${x.alert ? "alert" : ""}" style="--cc:${x.color}" data-key=${x.key} title=${x.text} @click=${() => this._tap(x)}>
          <ha-icon .icon=${x.icon}></ha-icon><span>${x.text}</span>
        </button>`)}
      </div>` : nothing}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.room { gap: 12px; padding: 14px 16px; }
    ha-card.room .blob { opacity: 0.4; animation-play-state: paused; }
    .head { display: flex; align-items: center; gap: 12px; }
    .room-title { font-size: 24px; font-weight: 600; letter-spacing: -0.01em; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px 7px 9px; border: none; border-radius: 999px; cursor: pointer;
      font: inherit; font-size: 13px; font-weight: 500; color: var(--primary-text-color); max-width: 100%;
      background: color-mix(in srgb, var(--cc) 14%, rgba(127,127,127,0.08)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--cc) 26%, transparent);
      transition: background 0.4s, box-shadow 0.4s, transform 0.2s var(--ease-spring); animation: slide-in 0.4s var(--ease-out) both; }
    .chip span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .chip ha-icon { --mdc-icon-size: 18px; color: var(--cc); flex: none; transition: color 0.4s; }
    .chip:hover { background: color-mix(in srgb, var(--cc) 22%, transparent); }
    .chip:active { transform: scale(0.95); }
    .chip.alert { box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--cc) 60%, transparent); }
    .chip:focus-visible { outline: 2px solid var(--cc); outline-offset: 2px; }
    .head.nav { cursor: pointer; }
    .nav-chevron { margin-left: auto; color: var(--secondary-text-color); --mdc-icon-size: 22px; transition: transform 0.25s var(--ease-out); }
    .head.nav:hover .nav-chevron { transform: translateX(3px); }
    .banner-action { background: var(--warning-color, #fb8c00); white-space: nowrap; }

    /* Raumkachel */
    ha-card.tile { gap: 6px; padding: 24px 8px; min-height: 128px; container-type: inline-size; align-items: center; justify-content: center; text-align: center; user-select: none; -webkit-user-select: none;
      -webkit-touch-callout: none; transition: --hcc-accent-c 0.7s ease, transform 0.25s var(--ease-spring), box-shadow 0.3s; }
    ha-card.tile.clickable { cursor: pointer; }
    ha-card.tile.clickable:hover { box-shadow: 0 4px 18px color-mix(in srgb, var(--accent) 22%, transparent); }
    ha-card.tile:active { transform: scale(0.97); }
    ha-card.tile:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    ha-card.tile .blob { opacity: 0.18; }
    ha-card.tile.lit .blob { opacity: 0.55; animation-play-state: running; }
    ha-card.tile .b1 { width: 140%; left: -40%; top: -70%; }
    ha-card.tile .icon-badge { width: 46px; height: 46px; flex: none; }
    ha-card.tile .icon-badge ha-icon { --mdc-icon-size: 25px; }
    ha-card.tile.lit .icon-badge { background: color-mix(in srgb, var(--accent) 30%, transparent); box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 45%, transparent); }
    .mark { position: absolute; z-index: 1; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; color: var(--cc);
      background: color-mix(in srgb, var(--cc) 18%, transparent); animation: slide-in 0.4s var(--ease-out) both; }
    .mark ha-icon { --mdc-icon-size: 13px; }
    /* Info-Symbole in den vier Ecken – oben/unten hält die Kachel 24 px frei */
    .mark.tl { top: 6px; left: 6px; } .mark.tr { top: 6px; right: 6px; }
    .mark.bl { bottom: 6px; left: 6px; } .mark.br { bottom: 6px; right: 6px; }
    .mark.alert { box-shadow: inset 0 0 0 1.5px var(--cc); animation: slide-in 0.4s var(--ease-out) both, mark-pulse 2s ease-in-out infinite; }
    @keyframes mark-pulse { 50% { background: color-mix(in srgb, var(--cc) 34%, transparent); } }
    ha-card.anim-reduced .mark.alert, ha-card.anim-off .mark.alert { animation: none; }
    .tile-text { display: flex; flex-direction: column; align-items: center; min-width: 0; max-width: 100%; }
    .tile-name { font-size: clamp(13px, 12.5cqi, 15px); font-weight: 700; line-height: 1.2; overflow: hidden; hyphens: auto; -webkit-hyphens: auto;
      overflow-wrap: break-word; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .tile-sub { font-size: clamp(11.5px, 10.5cqi, 12.5px); color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .banner-action.confirm { background: var(--error-color, #e53935); }
  `];
}
