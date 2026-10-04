import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant, IrrigationCardConfig, IrrigationZoneConfig } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { batteryIcon, flowLpm, formatPower, formatRemaining, powerWatts, secondsToDuration, timerInfo, UNAVAILABLE } from "./utils";
import "./irrigation-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-irrigation-card",
  name: "Modern Irrigation Card",
  description: "Hauswasserwerk / Pumpe mit Ventilen: Zonen starten, pausieren, stoppen, Laufzeit einstellen, Restzeit und Durchfluss – mit animierter Wasserleitung (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const WATER = "#29b6f6";

interface Zone {
  cfg: IrrigationZoneConfig;
  idx: number;
  name: string;
  icon: string;
  color: string;
  open: boolean;
  timer?: ReturnType<typeof timerInfo>;
  minutes?: number;
  durationSt?: HassEntity;
  flow?: number;
  volume?: string;
  battery?: number;
  unavailable: boolean;
}

@customElement("ha-irrigation-card")
export class HaIrrigationCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: IrrigationCardConfig;
  @state() private _now = Date.now();
  private _tick?: number;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-irrigation-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<IrrigationCardConfig> {
    const ids = Object.keys(hass.states);
    const valves = ids.filter((id) => id.startsWith("valve.") || (id.startsWith("switch.") && /ventil|valve|zone|sprinkler/i.test(id))).slice(0, 4);
    const pump = ids.find((id) => id.startsWith("switch.") && /pumpe|pump|wasserwerk/i.test(id));
    return { ...(pump ? { pump } : {}), zones: valves.map((valve) => ({ valve })) };
  }

  public setConfig(config: IrrigationCardConfig): void {
    if (!config || (!config.zones?.length && !config.pump)) throw new Error("ha-irrigation-card: 'pump' und/oder 'zones' angeben");
    this._config = { ...config, zones: (config.zones ?? []).map((z) => (typeof z === "string" ? { valve: z } : z)) };
  }

  public getCardSize(): number {
    return 2 + (this._config?.zones.length ?? 0);
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._tick);
    this._tick = undefined;
  }

  private _t(key: string): string {
    return localize(this.hass, `irrigation.${key}`);
  }

  /** Sensor mit gleichem Namen wie das Ventil finden (switch.ventil_haus → sensor.ventil_haus_flow) */
  private _auto(valve: string, suffixes: string[]): string | undefined {
    const obj = valve.split(".")[1];
    return suffixes.map((s) => `sensor.${obj}_${s}`).find((id) => this.hass!.states[id]);
  }

  private _zoneIds(z: IrrigationZoneConfig): (string | undefined)[] {
    return [z.valve, z.timer, z.duration, z.flow ?? this._auto(z.valve, ["flow", "volumenstrom"]), z.volume, z.battery ?? this._auto(z.valve, ["battery", "batterie"])];
  }

  private _ids(): string[] {
    const c = this._config!;
    return [c.pump, c.pump_power, c.mode, c.start_time, c.run_all, c.run_all_active, c.last_run, ...c.zones.flatMap((z) => this._zoneIds(z))]
      .filter(Boolean) as string[];
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this._config) return true;
    return this._ids().some((id) => old.states[id] !== this.hass!.states[id]) || old.locale !== this.hass!.locale;
  }

  protected updated(): void {
    const active = this._config?.zones.some((z) => z.timer && this.hass?.states[z.timer]?.state === "active");
    if (active && !this._tick) this._tick = window.setInterval(() => (this._now = Date.now()), 1000);
    if (!active && this._tick) { clearInterval(this._tick); this._tick = undefined; }
  }

  // ---------- Zustand ----------

  private _isOn(id?: string): boolean {
    const st = id ? this.hass!.states[id] : undefined;
    return st?.state === "on" || st?.state === "open" || st?.state === "opening";
  }

  private _zones(): Zone[] {
    const s = this.hass!.states;
    return this._config!.zones.map((cfg, idx) => {
      const [, , , flowId, , batId] = this._zoneIds(cfg);
      const valve = s[cfg.valve];
      const durationSt = cfg.duration ? s[cfg.duration] : undefined;
      const minutes = durationSt && !UNAVAILABLE.includes(durationSt.state) ? Number(durationSt.state) : undefined;
      const volSt = cfg.volume ? s[cfg.volume] : undefined;
      const bat = batId ? Number(s[batId]?.state) : NaN;
      const name = cfg.name ?? (valve?.attributes.friendly_name ?? cfg.valve).replace(/^(ventil|valve)\s+/i, "");
      return {
        cfg, idx, name, color: cfg.color ?? WATER,
        icon: cfg.icon ?? (cfg.timer ? s[cfg.timer]?.attributes.icon : undefined) ?? valve?.attributes.icon ?? "mdi:sprinkler-variant",
        open: this._isOn(cfg.valve),
        timer: cfg.timer ? timerInfo(s[cfg.timer], this._now) : undefined,
        minutes: Number.isFinite(minutes) ? minutes : undefined, durationSt,
        flow: flowId ? flowLpm(s[flowId]) : undefined,
        volume: volSt && !UNAVAILABLE.includes(volSt.state) && volSt.state !== "" ? `${Number(volSt.state).toLocaleString(getLanguage(this.hass))} ${volSt.attributes.unit_of_measurement ?? "L"}` : undefined,
        battery: Number.isFinite(bat) ? Math.round(bat) : undefined,
        unavailable: !valve || UNAVAILABLE.includes(valve.state),
      };
    });
  }

  // ---------- Aktionen ----------

  private _haptic(type = "light"): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: type }));
  }

  private async _call(domain: string, service: string, data: Record<string, unknown>): Promise<void> {
    try {
      await this.hass!.callService(domain, service, data);
    } catch (err: any) {
      this._haptic("failure");
      this.dispatchEvent(new CustomEvent("hass-notification", {
        detail: { message: `${localize(this.hass, "card.error")}: ${err?.message ?? err}` }, bubbles: true, composed: true,
      }));
      throw err;
    }
  }

  private _script(id: string, data?: Record<string, unknown>): Promise<void> {
    return this._call("script", "turn_on", { entity_id: id, ...(data ? { variables: data } : {}) });
  }

  private _valve(id: string, open: boolean): Promise<void> {
    if (id.startsWith("valve.")) return this._call("valve", open ? "open_valve" : "close_valve", { entity_id: id });
    return this._call("homeassistant", open ? "turn_on" : "turn_off", { entity_id: id });
  }

  private async _start(z: Zone): Promise<void> {
    const c = this._config!;
    this._haptic("medium");
    try {
      if (c.pump && c.pump_on_start !== false && !this._isOn(c.pump)) await this._call("homeassistant", "turn_on", { entity_id: c.pump });
      if (z.cfg.start_script) return void (await this._script(z.cfg.start_script, z.cfg.script_data));
      if (z.cfg.timer) {
        const min = z.minutes ?? (z.timer?.duration ? z.timer.duration / 60 : undefined);
        await this._call("timer", "start", { entity_id: z.cfg.timer, ...(min ? { duration: secondsToDuration(Math.round(min * 60)) } : {}) });
      }
      await this._valve(z.cfg.valve, true);
    } catch { /* gemeldet */ }
  }

  private async _pause(z: Zone): Promise<void> {
    this._haptic();
    const paused = z.timer?.state === "paused";
    try {
      if (z.cfg.pause_script) return void (await this._script(z.cfg.pause_script, z.cfg.script_data));
      if (z.cfg.timer) await this._call("timer", paused ? "start" : "pause", { entity_id: z.cfg.timer });
      await this._valve(z.cfg.valve, paused);
    } catch { /* gemeldet */ }
  }

  private async _stop(z: Zone): Promise<void> {
    this._haptic("medium");
    try {
      if (z.cfg.stop_script) return void (await this._script(z.cfg.stop_script, z.cfg.script_data));
      if (z.cfg.timer && z.timer?.state !== "idle") await this._call("timer", "cancel", { entity_id: z.cfg.timer });
      await this._valve(z.cfg.valve, false);
    } catch { /* gemeldet */ }
  }

  private _setMinutes(z: Zone, dir: number): void {
    const st = z.durationSt;
    if (!st || z.minutes == null) return;
    const a = st.attributes;
    const step = Number(a.step) || 1;
    const big = z.minutes + dir * step >= 30 && step < 5 ? 5 : step;
    const next = Math.min(Number(a.max ?? 120), Math.max(Number(a.min ?? 1), Math.round((z.minutes + dir * big) / big) * big));
    if (next === z.minutes) return;
    this._haptic("selection");
    this._call(st.entity_id.split(".")[0]!, "set_value", { entity_id: st.entity_id, value: next }).catch(() => undefined);
  }

  private _togglePump(): void {
    const c = this._config!;
    if (!c.pump) return;
    this._haptic("medium");
    this._call("homeassistant", this._isOn(c.pump) ? "turn_off" : "turn_on", { entity_id: c.pump }).catch(() => undefined);
  }

  private async _stopAll(zones: Zone[]): Promise<void> {
    const c = this._config!;
    this._haptic("heavy");
    try {
      if (c.stop_all) return void (await this._script(c.stop_all));
      await Promise.all(zones.filter((z) => z.open || (z.timer && z.timer.state !== "idle")).map((z) => this._stop(z)));
      if (c.pump && this._isOn(c.pump)) await this._call("homeassistant", "turn_off", { entity_id: c.pump });
    } catch { /* gemeldet */ }
  }

  private _runAll(): void {
    if (!this._config?.run_all) return;
    this._haptic("medium");
    this._script(this._config.run_all).catch(() => undefined);
  }

  private _selectMode(option: string): void {
    const id = this._config!.mode!;
    this._haptic("selection");
    this._call(id.split(".")[0]!, "select_option", { entity_id: id, option }).catch(() => undefined);
  }

  private _moreInfo(id?: string): void {
    if (!id) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  // ---------- Render ----------

  private _zoneStatus(z: Zone): string {
    const lang = getLanguage(this.hass);
    const parts: string[] = [];
    const t = z.timer;
    if (z.unavailable) parts.push(this._t("unavailable"));
    else if (t && t.state === "paused") parts.push(`${this._t("paused")} · ${this._t("left")} ${formatRemaining(t.remaining)}`);
    else if (t && t.state === "active") parts.push(`${this._t("left")} ${formatRemaining(t.remaining)}`);
    else parts.push(this._t(z.open ? "open" : "closed"));
    if (z.open && z.flow != null && z.flow > 0) parts.push(`${z.flow.toLocaleString(lang, { maximumFractionDigits: z.flow < 10 ? 1 : 0 })} L/min`);
    else if (!z.open && z.volume && !(t && t.state !== "idle")) parts.push(`${this._t("last")} ${z.volume}`);
    return parts.join(" · ");
  }

  private _renderZone(z: Zone, i: number, zones: Zone[]) {
    const t = z.timer;
    const running = z.open || (!!t && t.state !== "idle");
    // Wasser fließt durch die Leitung bis zur letzten offenen Zone
    const feed = zones.slice(i).some((x) => x.open);
    const through = zones.slice(i + 1).some((x) => x.open);
    const last = i === zones.length - 1;
    const progress = t && t.state !== "idle" ? t.progress : z.open ? 1 : 0;
    const lowBat = z.battery != null && z.battery <= 20;
    return html`<div class="zone ${z.open ? "open" : ""} ${running ? "running" : ""} ${last ? "last" : ""}" style="--zc:${z.color}" data-zone=${z.idx}>
      <span class="pipe top ${feed ? "flow" : ""}"></span>${last ? nothing : html`<span class="pipe bot ${through ? "flow" : ""}"></span>`}
      <button class="z-badge" style="--p:${(progress * 360).toFixed(1)}deg" @click=${() => this._moreInfo(z.cfg.valve)} aria-label=${z.name}>
        <span class="z-ring"></span><ha-icon .icon=${z.icon}></ha-icon>
      </button>
      <div class="z-text">
        <span class="z-name">${z.name}${z.battery != null ? html`<span class="z-bat ${lowBat ? "low" : ""}" title="${z.battery} %">
          <ha-icon .icon=${batteryIcon(z.battery, false)}></ha-icon>${lowBat ? html`${z.battery} %` : nothing}</span>` : nothing}</span>
        <span class="z-status">${this._zoneStatus(z)}</span>
      </div>
      <div class="z-ctrl">
        ${running ? html`
          ${t ? html`<button class="ctl" aria-label=${this._t(t.state === "paused" ? "resume" : "pause")} @click=${() => this._pause(z)}>
            <ha-icon .icon=${t.state === "paused" ? "mdi:play" : "mdi:pause"}></ha-icon></button>` : nothing}
          <button class="ctl stop" aria-label=${this._t("stop")} @click=${() => this._stop(z)}><ha-icon icon="mdi:stop"></ha-icon></button>`
        : html`
          ${z.minutes != null ? html`<span class="dur">
            <button class="st" aria-label="−" @click=${() => this._setMinutes(z, -1)}><ha-icon icon="mdi:minus"></ha-icon></button>
            <button class="st-val" title=${this._t("duration")} @click=${() => this._moreInfo(z.durationSt?.entity_id)}>${Math.round(z.minutes)}<small> min</small></button>
            <button class="st" aria-label="+" @click=${() => this._setMinutes(z, 1)}><ha-icon icon="mdi:plus"></ha-icon></button></span>` : nothing}
          <button class="ctl play" ?disabled=${z.unavailable} aria-label=${this._t("start")} @click=${() => this._start(z)}><ha-icon icon="mdi:play"></ha-icon></button>`}
      </div>
    </div>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const s = this.hass.states;
    const zones = this._zones();
    const pumpOn = this._isOn(c.pump);
    const pumpSt = c.pump ? s[c.pump] : undefined;
    const watts = powerWatts(c.pump_power ? s[c.pump_power] : undefined);
    const anyOpen = zones.some((z) => z.open);
    const anyRunning = anyOpen || zones.some((z) => z.timer && z.timer.state !== "idle");
    const runAllActive = this._isOn(c.run_all_active);
    const modeSt = c.mode ? s[c.mode] : undefined;
    const startSt = c.start_time ? s[c.start_time] : undefined;
    const lastRun = c.last_run ? s[c.last_run]?.state : undefined;
    const openNames = zones.filter((z) => z.open).map((z) => z.name);
    const status = !pumpSt && c.pump ? this._t("unavailable")
      : pumpOn ? [this._t(runAllActive ? "run_all_active" : "running"), watts != null ? formatPower(watts, getLanguage(this.hass), 1000, 0, 1) : ""].filter(Boolean).join(" · ")
      : anyOpen ? this._t("pump_off_open") : this._t("off");
    const anim = c.animations ?? "full";
    return html`<ha-card class="irrigation anim-${anim} ${pumpOn ? "on" : "off"}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <button class="pump ${pumpOn ? "on" : ""}" ?disabled=${!c.pump} @click=${() => this._togglePump()} aria-label=${this._t("pump")}>
          <span class="ripple"></span><ha-icon .icon=${c.icon ?? "mdi:water-pump"}></ha-icon>
        </button>
        <button class="head-text" @click=${() => this._moreInfo(c.pump)}>
          <span class="h-title">${c.title ?? this._t("title")}</span>
          <span class="h-sub">${status}${openNames.length ? html` · <span class="h-open">${openNames.join(", ")}</span>` : nothing}</span>
        </button>
        ${startSt && !UNAVAILABLE.includes(startSt.state) ? html`<button class="chip" @click=${() => this._moreInfo(c.start_time)} title=${this._t("start_time")}>
          <ha-icon icon="mdi:clock-outline"></ha-icon>${startSt.attributes.hour != null
            ? `${String(startSt.attributes.hour).padStart(2, "0")}:${String(startSt.attributes.minute ?? 0).padStart(2, "0")}` : startSt.state.slice(0, 5)}</button>` : nothing}
      </div>
      ${zones.length ? html`<div class="zones">${zones.map((z, i) => this._renderZone(z, i, zones))}</div>` : nothing}
      ${modeSt && Array.isArray(modeSt.attributes.options) ? html`<div class="modes" role="radiogroup">
        ${(modeSt.attributes.options as string[]).map((o) => html`<button class="mode ${modeSt.state === o ? "sel" : ""}" role="radio" aria-checked=${modeSt.state === o}
          @click=${() => this._selectMode(o)}>${o}</button>`)}</div>` : nothing}
      ${c.run_all || anyRunning || pumpOn ? html`<div class="actions">
        ${c.run_all ? html`<button class="act run ${runAllActive ? "active" : ""}" ?disabled=${runAllActive} @click=${() => this._runAll()}>
          <ha-icon .icon=${runAllActive ? "mdi:water-sync" : "mdi:play-circle-outline"}></ha-icon>${this._t(runAllActive ? "run_all_active" : "run_all")}</button>` : nothing}
        ${anyRunning || pumpOn || c.stop_all ? html`<button class="act stop" ?disabled=${!anyRunning && !pumpOn} @click=${() => this._stopAll(zones)}>
          <ha-icon icon="mdi:stop-circle-outline"></ha-icon>${this._t("stop_all")}</button>` : nothing}
      </div>` : nothing}
      ${lastRun && !UNAVAILABLE.includes(lastRun) ? html`<div class="last-run"><ha-icon icon="mdi:history"></ha-icon><span>${lastRun}</span></div>` : nothing}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.irrigation { --accent: #29b6f6; gap: 12px; }
    ha-card.irrigation.off .blob { opacity: 0.3; animation-play-state: paused; }
    .header { display: flex; align-items: center; gap: 12px; }
    .pump { position: relative; flex: none; width: 46px; height: 46px; border-radius: 50%; border: none; padding: 0; display: grid; place-items: center; cursor: pointer;
      color: var(--secondary-text-color); background: rgba(127,127,127,0.14); transition: background 0.4s, color 0.4s, transform 0.2s var(--ease-spring); z-index: 1; }
    .pump:active { transform: scale(0.92); }
    .pump ha-icon { --mdc-icon-size: 26px; }
    .pump.on { color: #fff; background: var(--accent); box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 45%, transparent); }
    .pump .ripple { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; }
    .pump.on .ripple { border: 2px solid var(--accent); animation: ripple 2.4s ease-out infinite; }
    @keyframes ripple { 0% { transform: scale(1); opacity: 0.7; } 80%, 100% { transform: scale(1.5); opacity: 0; } }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; border: none; background: none; padding: 0; text-align: left; cursor: pointer; }
    .h-title { font-size: 17px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .h-sub { font-size: 13px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .h-open { color: var(--accent); font-weight: 600; }
    .chip { flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px 5px 8px; border-radius: 999px; border: none; cursor: pointer;
      font-size: 13px; font-weight: 600; background: rgba(127,127,127,0.12); }
    .chip ha-icon { --mdc-icon-size: 16px; color: var(--secondary-text-color); }
    .zones { display: flex; flex-direction: column; margin-top: -4px; container-type: inline-size; }
    .zone { position: relative; display: flex; align-items: center; gap: 12px; padding: 7px 0 7px 1px; min-height: 48px; }
    .pipe { position: absolute; left: 21px; width: 4px; border-radius: 2px; background: rgba(127,127,127,0.2); }
    .pipe.top { top: 0; bottom: 50%; }
    .pipe.bot { top: 50%; bottom: 0; }
    .zone:first-child .pipe.top { top: -12px; }
    .pipe.flow { background: repeating-linear-gradient(to bottom, var(--accent) 0 7px, color-mix(in srgb, var(--accent) 35%, transparent) 7px 14px);
      background-size: 100% 14px; animation: water 0.7s linear infinite; }
    @keyframes water { from { background-position: 0 0; } to { background-position: 0 14px; } }
    .z-badge { position: relative; flex: none; width: 44px; height: 44px; border-radius: 50%; border: none; padding: 0; display: grid; place-items: center; cursor: pointer;
      color: var(--secondary-text-color); background: var(--card-background-color, var(--ha-card-background, #fff)); transition: color 0.4s; }
    .z-badge::before { content: ""; position: absolute; inset: 0; border-radius: 50%; background: rgba(127,127,127,0.12); transition: background 0.4s; }
    .z-ring { position: absolute; inset: 0; border-radius: 50%; padding: 3px; pointer-events: none;
      background: conic-gradient(var(--zc) 0 var(--p), transparent var(--p) 360deg);
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; transition: background 0.6s; }
    .z-badge ha-icon { position: relative; --mdc-icon-size: 22px; }
    .zone.open .z-badge { color: var(--zc); }
    .zone.open .z-badge::before { background: color-mix(in srgb, var(--zc) 22%, transparent); }
    .zone.open .z-badge ha-icon { animation: bob 2.6s ease-in-out infinite; }
    @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
    .z-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .z-name { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .z-bat { display: inline-flex; align-items: center; gap: 1px; font-size: 11px; font-weight: 600; color: var(--secondary-text-color); opacity: 0.75; }
    .z-bat ha-icon { --mdc-icon-size: 14px; }
    .z-bat.low { color: var(--error-color, #e53935); opacity: 1; }
    .z-status { font-size: 13px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .zone.running .z-status { color: var(--zc); font-weight: 600; }
    .z-ctrl { flex: none; display: flex; align-items: center; gap: 6px; }
    .ctl { width: 36px; height: 36px; border-radius: 50%; border: none; padding: 0; display: grid; place-items: center; cursor: pointer;
      background: rgba(127,127,127,0.14); transition: transform 0.2s var(--ease-spring), background 0.3s; }
    .ctl:active { transform: scale(0.9); }
    .ctl ha-icon { --mdc-icon-size: 22px; }
    .ctl.play { color: #fff; background: var(--zc); }
    .ctl.play[disabled] { opacity: 0.35; cursor: default; }
    .ctl.stop { color: var(--error-color, #e53935); background: color-mix(in srgb, var(--error-color, #e53935) 14%, transparent); }
    .dur { display: inline-flex; align-items: center; border-radius: 999px; background: rgba(127,127,127,0.1); }
    .st { width: 26px; height: 30px; border: none; background: none; padding: 0; display: grid; place-items: center; cursor: pointer; color: var(--secondary-text-color); }
    .st ha-icon { --mdc-icon-size: 17px; }
    .st-val { min-width: 34px; padding: 0 2px; border: none; background: none; cursor: pointer; text-align: center; font-size: 13.5px; font-weight: 700; white-space: nowrap; }
    /* schmale Karten: nur die Laufzeit (tippen = Regler), ohne −/+ */
    @container (max-width: 370px) { .st { display: none; } .st-val { padding: 0 10px; height: 30px; } }
    .st-val small { font-size: 10.5px; font-weight: 500; color: var(--secondary-text-color); }
    .modes { display: flex; gap: 4px; padding: 4px; border-radius: 999px; background: rgba(127,127,127,0.1); }
    .mode { flex: 1; padding: 7px 8px; border: none; border-radius: 999px; background: none; cursor: pointer; font-size: 13px; font-weight: 600;
      color: var(--secondary-text-color); transition: background 0.3s, color 0.3s; white-space: nowrap; }
    .mode.sel { color: #fff; background: var(--accent); }
    .actions { display: flex; gap: 8px; }
    .act { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; border: none; border-radius: var(--hcc-inner-radius, 14px);
      cursor: pointer; font-size: 14px; font-weight: 600; background: rgba(127,127,127,0.1); transition: background 0.3s, opacity 0.3s; }
    .act ha-icon { --mdc-icon-size: 20px; }
    .act.run { color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); }
    .act.run.active ha-icon { animation: spin 2s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .act.stop { color: var(--error-color, #e53935); background: color-mix(in srgb, var(--error-color, #e53935) 12%, transparent); }
    .act[disabled] { opacity: 0.4; cursor: default; }
    .last-run { display: flex; align-items: flex-start; gap: 6px; font-size: 12px; color: var(--secondary-text-color); line-height: 1.4; }
    .last-run ha-icon { --mdc-icon-size: 15px; flex: none; margin-top: 1px; }
    ha-card.anim-reduced .pipe.flow, ha-card.anim-off .pipe.flow, ha-card.anim-reduced .pump.on .ripple, ha-card.anim-off .pump.on .ripple,
    ha-card.anim-reduced .zone.open .z-badge ha-icon, ha-card.anim-off .zone.open .z-badge ha-icon, ha-card.anim-off .act.run.active ha-icon { animation: none; }
  `];
}
