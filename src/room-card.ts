import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant, RoomCardConfig } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import {
  activityLabel, brightnessPct, detectDeviceType, lightColor, modeColor, resolveContacts, temperatureOf, UNAVAILABLE,
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

interface Chip { key: string; icon: string; text: string; color: string; entity?: string; toggle?: boolean; alert?: boolean; }

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
    return { columns: 12, min_columns: 4, rows: "auto" };
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._confirmTimer);
  }

  private _t(key: string): string {
    return localize(this.hass, key);
  }

  private _watched(): string[] {
    const c = this._config;
    if (!c) return [];
    return [c.light, c.temperature, c.humidity, c.climate, c.media,
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

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const chips = this._chips();
    const climate = c.climate ? this.hass.states[c.climate] : undefined;
    const openContacts = resolveContacts(this.hass.states, { contact_sensors: c.contacts }).filter((x) => x.open);
    const climateRunning = !!climate && climate.state !== "off" && !UNAVAILABLE.includes(climate.state);
    const warn = c.window_warning !== false && climateRunning && openContacts.length > 0;
    const heating = climate ? detectDeviceType(climate) === "heating" : false;
    const lightChip = chips.find((x) => x.key === "light");
    const accent = warn ? ORANGE : lightChip && lightChip.color !== GREY ? lightChip.color : "var(--primary-color)";
    return html`<ha-card class="room anim-${c.animations ?? "full"} ${warn ? "warn" : ""}" style="--hcc-accent-c:${accent}">
      <div class="glow"><span class="blob b1"></span><span class="blob b2"></span></div>
      <div class="head">
        <span class="icon-badge"><ha-icon .icon=${c.icon ?? "mdi:home"}></ha-icon></span>
        <span class="room-title">${c.title ?? this._t("room.title")}</span>
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
    .banner-action { background: var(--warning-color, #fb8c00); white-space: nowrap; }
    .banner-action.confirm { background: var(--error-color, #e53935); }
  `];
}
