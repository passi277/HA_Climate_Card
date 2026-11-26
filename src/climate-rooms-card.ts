import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { ClimateRoomConfig, ClimateRoomsCardConfig, HassEntity, HomeAssistant } from "./types";
import { localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { nextSwitch, roomIcon, UNAVAILABLE } from "./utils";
import "./climate-rooms-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-climate-rooms-card",
  name: "Modern Climate Rooms Card",
  description: "Klima-Übersicht 2.0: alle Räume mit Ist/Soll, Luftfeuchte, Heizung (inkl. Wochenprogramm „ab 17:00 → 21°“), Klimaanlage, offenen Fenstern, Boost und ±0,5° (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return v == null || v === "" || !Number.isFinite(n) ? undefined : n;
};
const fmt = (v: number, d = 1): string => v.toFixed(d).replace(".", ",");

interface RoomInfo {
  cfg: ClimateRoomConfig; temp?: number; hum?: number; heat?: HassEntity; ac?: HassEntity;
  heating: boolean; acOn: boolean; acMode?: string; windowOpen: boolean; target?: number;
}

@customElement("ha-climate-rooms-card")
export class HaClimateRoomsCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: ClimateRoomsCardConfig;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-climate-rooms-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<ClimateRoomsCardConfig> {
    const climates = Object.keys(hass?.states ?? {}).filter((id) => id.startsWith("climate.")).slice(0, 3);
    return { rooms: climates.map((id) => ({ name: String(hass.states[id]!.attributes.friendly_name ?? id), heating: id })) };
  }

  public setConfig(config: ClimateRoomsCardConfig): void {
    if (!config || !Array.isArray(config.rooms) || !config.rooms.length) throw new Error("rooms: Liste mit mindestens einem Raum");
    this._config = { ...config };
  }

  public getCardSize(): number {
    return 2 + (this._config?.rooms.length ?? 1) * 2;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  private _t(key: string): string {
    return localize(this.hass, `climate_rooms.${key}`);
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || old.locale !== this.hass!.locale) return true;
    return this._config!.rooms.some((r) => [r.temperature, r.humidity, r.heating, r.ac, r.window]
      .some((id) => id && old.states[id] !== this.hass!.states[id]));
  }

  private _info(r: ClimateRoomConfig): RoomInfo {
    const s = this.hass!.states;
    const heat = r.heating ? s[r.heating] : undefined;
    const ac = r.ac ? s[r.ac] : undefined;
    const tSt = r.temperature ? s[r.temperature] : undefined;
    const hSt = r.humidity ? s[r.humidity] : undefined;
    const temp = (tSt?.entity_id.startsWith("climate.") ? num(tSt.attributes.current_temperature) : num(tSt?.state))
      ?? num(heat?.attributes.current_temperature) ?? num(ac?.attributes.current_temperature);
    const hum = (hSt?.entity_id.startsWith("climate.") ? num(hSt.attributes.current_humidity) : num(hSt?.state))
      ?? num(heat?.attributes.current_humidity) ?? num(tSt?.attributes.current_humidity) ?? num(ac?.attributes.current_humidity);
    const acOn = !!ac && !["off", ...UNAVAILABLE].includes(ac.state);
    const win = r.window ? s[r.window] : undefined;
    return {
      cfg: r, temp, hum, heat, ac, acOn, acMode: acOn ? ac!.state : undefined,
      heating: !!heat && (heat.attributes.hvac_action === "heating" || heat.attributes.hvac_action === "preheating"),
      windowOpen: win?.state === "on" || win?.state === "open",
      target: num(heat?.attributes.temperature),
    };
  }

  private _haptic(kind = "light"): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: kind }));
  }

  private async _call(domain: string, service: string, data: Record<string, unknown>): Promise<void> {
    this._haptic();
    try {
      await this.hass!.callService(domain, service, data);
    } catch (err: any) {
      this.dispatchEvent(new CustomEvent("hass-notification", {
        detail: { message: `${localize(this.hass, "card.error")}: ${err?.message ?? err}` }, bubbles: true, composed: true,
      }));
    }
  }

  private _open(r: ClimateRoomConfig, id?: string): void {
    if (r.navigation_path) {
      history.pushState(null, "", r.navigation_path);
      window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
    } else if (id) {
      this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
    }
  }

  private _status(i: RoomInfo): string {
    const lang = this.hass!.locale?.language ?? "de";
    const parts: string[] = [];
    const h = i.heat;
    if (h && !UNAVAILABLE.includes(h.state)) {
      if (h.state === "off") parts.push(this._t("heating_off"));
      else if (h.attributes.preset_mode === "boost") parts.push(this._t("boost"));
      else if (i.target != null) parts.push((i.heating ? this._t("heats_to") : this._t("target")).replace("{t}", fmt(i.target)));
      const next = h.state !== "off" ? nextSwitch(h.attributes, new Date()) : undefined;
      if (next) parts.push(this._t("next").replace("{time}", next.at.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })).replace("{t}", fmt(next.temp)));
    }
    if (i.acOn) parts.push(`${this._t("ac")}: ${this.hass!.formatEntityState?.(i.ac!) ?? i.acMode}${num(i.ac!.attributes.temperature) != null ? ` ${i.ac!.attributes.temperature}°` : ""}`);
    return parts.join(" · ") || (i.heat || i.ac ? "" : this._t("sensor_only"));
  }

  private _renderRoom(i: RoomInfo) {
    const r = i.cfg;
    const [lo, hi] = this._config!.humidity_range ?? [40, 60];
    const humOk = i.hum == null || (i.hum >= lo && i.hum <= hi);
    const color = i.windowOpen ? "#ef6c00" : i.acOn ? (i.acMode === "heat" ? "#ff7043" : "#29b6f6") : i.heating ? "#ff7043" : "var(--secondary-text-color)";
    const h = i.heat;
    const step = num(h?.attributes.target_temp_step) ?? 0.5;
    const boostable = !!h && ((h.attributes.preset_modes ?? []) as string[]).includes("boost");
    const boost = h?.attributes.preset_mode === "boost";
    const heatOff = h?.state === "off";
    return html`<div class="room ${i.heating ? "heating" : ""} ${i.acOn ? "ac" : ""} ${i.windowOpen ? "win" : ""}" style="--rc:${color}" data-room=${r.name}>
      <button class="r-main" @click=${() => this._open(r, r.heating ?? r.ac ?? r.temperature)}>
        <span class="r-ic"><ha-icon .icon=${r.icon ?? roomIcon(r.name)}></ha-icon>
          ${i.heating ? html`<ha-icon class="badge flame" icon="mdi:fire"></ha-icon>` : i.acOn ? html`<ha-icon class="badge" icon="mdi:snowflake"></ha-icon>` : nothing}</span>
        <span class="r-text"><b>${r.name}</b><small>${this._status(i)}</small></span>
        <span class="r-temp">${i.temp != null ? html`${fmt(i.temp)}<small>°</small>` : "–"}</span>
      </button>
      ${i.windowOpen ? html`<div class="warn"><ha-icon icon="mdi:window-open-variant"></ha-icon>${i.heating || i.acOn ? this._t("window_running") : this._t("window_open")}</div>` : nothing}
      <div class="r-foot">
        ${i.hum != null ? html`<span class="hum ${humOk ? "" : "bad"}" title=${this._t("humidity")}>
          <ha-icon icon="mdi:water-percent"></ha-icon><span class="bar"><i style="width:${Math.min(100, i.hum)}%"></i></span>${Math.round(i.hum)} %</span>` : html`<span></span>`}
        <span class="ctl">
          ${h && !heatOff && i.target != null ? html`
            <button class="step" @click=${() => this._call("climate", "set_temperature", { entity_id: h.entity_id, temperature: i.target! - step })} aria-label="−"><ha-icon icon="mdi:minus"></ha-icon></button>
            <b class="tgt">${fmt(i.target)}°</b>
            <button class="step" @click=${() => this._call("climate", "set_temperature", { entity_id: h.entity_id, temperature: i.target! + step })} aria-label="+"><ha-icon icon="mdi:plus"></ha-icon></button>` : nothing}
          ${boostable && !heatOff ? html`<button class="pill ${boost ? "on" : ""}" data-act="boost"
            @click=${() => this._call("climate", "set_preset_mode", { entity_id: h!.entity_id, preset_mode: boost ? "none" : "boost" })}>
            <ha-icon icon="mdi:rocket-launch"></ha-icon>${this._t("boost_btn")}</button>` : nothing}
          ${h ? html`<button class="pill ${heatOff ? "" : "on-soft"}" data-act="heat" title=${this._t(heatOff ? "turn_on" : "turn_off")}
            @click=${() => this._call("climate", "set_hvac_mode", { entity_id: h.entity_id, hvac_mode: heatOff ? (((h.attributes.hvac_modes ?? []) as string[]).includes("auto") ? "auto" : "heat") : "off" })}>
            <ha-icon .icon=${heatOff ? "mdi:radiator-off" : "mdi:radiator"}></ha-icon></button>` : nothing}
          ${i.ac ? html`<button class="pill ${i.acOn ? "on" : ""}" data-act="ac" @click=${() => this._call("climate", i.acOn ? "turn_off" : "turn_on", { entity_id: i.ac!.entity_id })}>
            <ha-icon icon="mdi:air-conditioner"></ha-icon></button>` : nothing}
        </span>
      </div>
    </div>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const rooms = c.rooms.map((r) => this._info(r));
    const temps = rooms.map((r) => r.temp).filter((t): t is number => t != null);
    const avg = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : undefined;
    const heating = rooms.filter((r) => r.heating).length;
    const ac = rooms.filter((r) => r.acOn).length;
    const win = rooms.filter((r) => r.windowOpen).length;
    const accent = win ? "#ef6c00" : heating ? "#ff7043" : ac ? "#29b6f6" : "#26a69a";
    return html`<ha-card class="crooms anim-${c.animations ?? "full"}" style="--hcc-accent-c:${accent}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <span class="h-icon"><ha-icon icon="mdi:home-thermometer-outline"></ha-icon></span>
        <span class="head-text"><span class="h-title">${c.name ?? this._t("title")}</span>
          <span class="h-sub">${avg != null ? this._t("avg").replace("{t}", fmt(avg)) : ""}</span></span>
        ${temps.length > 1 ? html`<span class="range">${fmt(Math.min(...temps))}–${fmt(Math.max(...temps))}°</span>` : nothing}
      </div>
      <div class="sum">
        <span class="sc ${heating ? "on heat" : ""}"><ha-icon icon="mdi:radiator"></ha-icon>${this._t("n_heating").replace("{n}", String(heating))}</span>
        <span class="sc ${ac ? "on cool" : ""}"><ha-icon icon="mdi:air-conditioner"></ha-icon>${this._t("n_ac").replace("{n}", String(ac))}</span>
        <span class="sc ${win ? "on warn-c" : ""}"><ha-icon icon="mdi:window-open-variant"></ha-icon>${this._t("n_windows").replace("{n}", String(win))}</span>
      </div>
      <div class="rooms">${rooms.map((r) => this._renderRoom(r))}</div>
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.crooms { gap: 12px; container-type: inline-size; }
    .header { display: flex; align-items: center; gap: 10px; }
    .h-icon { flex: none; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; color: var(--accent);
      background: color-mix(in srgb, var(--accent) 18%, transparent); }
    .h-icon ha-icon { --mdc-icon-size: 24px; }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .h-title { font-size: 17px; font-weight: 600; }
    .h-sub { font-size: 12.5px; color: var(--secondary-text-color); }
    .range { flex: none; font-size: 13px; font-weight: 700; padding: 5px 10px; border-radius: 999px; background: rgba(127,127,127,0.1); }
    .sum { display: flex; gap: 6px; flex-wrap: wrap; }
    .sc { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 999px; font-size: 12px; font-weight: 600;
      color: var(--secondary-text-color); background: rgba(127,127,127,0.08); }
    .sc ha-icon { --mdc-icon-size: 15px; }
    .sc.on { color: #fff; }
    .sc.heat { background: #ff7043; } .sc.cool { background: #29b6f6; } .sc.warn-c { background: #ef6c00; }

    .rooms { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; }
    .room { display: flex; flex-direction: column; gap: 8px; padding: 10px; border-radius: var(--hcc-inner-radius, 14px);
      background: rgba(127,127,127,0.07); transition: background 0.4s; }
    .room.heating { background: linear-gradient(135deg, color-mix(in srgb, #ff7043 14%, transparent), rgba(127,127,127,0.05)); }
    .room.ac { background: linear-gradient(135deg, color-mix(in srgb, #29b6f6 14%, transparent), rgba(127,127,127,0.05)); }
    .room.win { box-shadow: inset 0 0 0 1.5px #ef6c00; }
    .r-main { display: flex; align-items: center; gap: 10px; border: none; background: none; padding: 0; cursor: pointer; text-align: left; }
    .r-ic { position: relative; flex: none; width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; color: var(--rc);
      background: color-mix(in srgb, var(--rc) 14%, transparent); }
    .r-ic ha-icon { --mdc-icon-size: 21px; }
    .r-ic .badge { position: absolute; right: -4px; bottom: -4px; --mdc-icon-size: 15px; padding: 2px; border-radius: 50%; color: #fff; background: var(--rc); }
    .flame { animation: flicker 1.8s ease-in-out infinite; }
    ha-card.anim-reduced .flame, ha-card.anim-off .flame { animation: none; }
    .r-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .r-text b { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .r-text small { font-size: 11.5px; color: var(--secondary-text-color); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .r-temp { flex: none; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .r-temp small { font-size: 14px; font-weight: 600; color: var(--secondary-text-color); }
    .warn { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 10px; font-size: 12px; font-weight: 600; color: #ef6c00;
      background: color-mix(in srgb, #ef6c00 12%, transparent); }
    .warn ha-icon { --mdc-icon-size: 16px; }
    .r-foot { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px 8px; }
    .hum { white-space: nowrap; display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; color: var(--secondary-text-color); }
    .hum ha-icon { --mdc-icon-size: 15px; color: #29b6f6; }
    .hum .bar { width: 46px; height: 5px; border-radius: 3px; background: rgba(127,127,127,0.18); overflow: hidden; }
    .hum .bar i { display: block; height: 100%; border-radius: 3px; background: #43a047; }
    .hum.bad .bar i { background: #fb8c00; }
    .hum.bad { color: #fb8c00; }
    .ctl { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 4px; margin-left: auto; }
    .tgt { min-width: 38px; text-align: center; font-size: 13.5px; }
    .step, .pill { height: 30px; border: none; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; gap: 4px;
      cursor: pointer; background: rgba(127,127,127,0.14); font-size: 11.5px; font-weight: 700; }
    .step { width: 30px; }
    .pill { padding: 0 9px; }
    .step ha-icon, .pill ha-icon { --mdc-icon-size: 16px; }
    .pill.on { color: #fff; background: var(--rc); }
    .pill.on[data-act="boost"] { background: #ff7043; }
    .pill.on-soft { color: #ff7043; }
    .step:active, .pill:active { transform: scale(0.92); }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-climate-rooms-card": HaClimateRoomsCard;
  }
}
