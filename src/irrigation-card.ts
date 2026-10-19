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
  description: "Hauswasserwerk / Pumpe mit parallelen Ventilen: Zonen starten, pausieren, stoppen, Ventile direkt schalten, Restzeit und Durchfluss – mit animiertem Verteiler und Strang „Sonstiges“ (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const WATER = "#29b6f6";
const OTHER = "#78909c";
const HOLD_MS = 500;

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
  private _holdTimer?: number;
  private _held = false;
  /** Zone, deren Laufzeit gerade eingestellt wird, und der noch nicht gesendete Wert */
  @state() private _edit?: number;
  @state() private _pending?: { zone: number; value: number };
  private _sendTimer?: number;
  /** Smart-Bereich: aufgeklappte Zone, Wasserkonto-Verlauf, Rückfrage für Aktionen */
  @state() private _smartOpen?: number;
  @state() private _bucketHist: Record<string, { t: number; v: number }[]> = {};
  @state() private _confirm?: string;
  private _confirmTimer?: number;

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
    return 6;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._tick);
    this._tick = undefined;
    clearTimeout(this._holdTimer);
    clearTimeout(this._sendTimer);
    clearTimeout(this._confirmTimer);
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
    return [z.valve, z.timer, z.duration, z.flow ?? this._auto(z.valve, ["flow", "volumenstrom"]), z.volume, z.battery ?? this._auto(z.valve, ["battery", "batterie"]), z.smart_duration];
  }

  private _ids(): string[] {
    const c = this._config!;
    const sm = c.smart ?? {};
    return [c.pump, c.pump_power, c.mode, c.start_time, c.run_all, c.run_all_active, c.last_run, sm.skipped, sm.skipped_reason, sm.season, sm.warning, sm.measured_flow,
      ...c.zones.flatMap((z) => this._zoneIds(z))]
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

  /** Ohne laufende Pumpe kann nichts von Hand gestartet werden (Schließen/Stoppen geht immer). */
  private _canStart(): boolean {
    const c = this._config!;
    return !c.pump || this._isOn(c.pump);
  }

  private async _start(z: Zone): Promise<void> {
    if (!this._canStart()) return;
    this._haptic("medium");
    try {
      // Smart-Modus: berechnete Laufzeit; sonst noch nicht gesendete Laufzeit zuerst speichern – Skripte lesen den Helfer
      const smart = this._smart(z);
      if (smart) {
        const m = Math.max(1, smart.minutes);
        if (z.cfg.start_script) return void (await this._script(z.cfg.start_script, { ...z.cfg.script_data, dauer_min: m }));
        if (z.cfg.timer) await this._call("timer", "start", { entity_id: z.cfg.timer, duration: secondsToDuration(m * 60) });
        return void (await this._valve(z.cfg.valve, true));
      }
      const p = this._pending;
      if (p?.zone === z.idx && z.durationSt) {
        clearTimeout(this._sendTimer);
        await this._call(z.durationSt.entity_id.split(".")[0]!, "set_value", { entity_id: z.durationSt.entity_id, value: p.value });
        this._pending = undefined;
      }
      if (z.cfg.start_script) return void (await this._script(z.cfg.start_script, z.cfg.script_data));
      if (z.cfg.timer) {
        const min = (p?.zone === z.idx ? p.value : z.minutes) ?? (z.timer?.duration ? z.timer.duration / 60 : undefined);
        await this._call("timer", "start", { entity_id: z.cfg.timer, ...(min ? { duration: secondsToDuration(Math.round(min * 60)) } : {}) });
      }
      await this._valve(z.cfg.valve, true);
    } catch { /* gemeldet */ }
  }

  private async _pause(z: Zone): Promise<void> {
    const paused = z.timer?.state === "paused";
    if (paused && !this._canStart()) return;
    this._haptic();
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

  /** Tippen aufs Ventil: nur das Ventil auf/zu – ohne Timer oder Skripte */
  private _toggleValve(z: Zone): void {
    if (this._held) { this._held = false; return; }
    if (z.unavailable || (!z.open && !this._canStart())) return;
    this._haptic("medium");
    this._valve(z.cfg.valve, !z.open).catch(() => undefined);
  }

  /** Lange drücken: Details */
  private _holdStart(ev: PointerEvent, id?: string): void {
    if (ev.button !== 0 || !id) return;
    this._held = false;
    clearTimeout(this._holdTimer);
    this._holdTimer = window.setTimeout(() => { this._held = true; this._haptic("medium"); this._moreInfo(id); }, HOLD_MS);
  }

  private _holdEnd = (): void => clearTimeout(this._holdTimer);

  /** Laufzeit-Grenzen der Zone (input_number/number) */
  private _range(z: Zone): { min: number; max: number; step: number } {
    const a = z.durationSt?.attributes ?? {};
    return { min: Number(a.min ?? 1), max: Number(a.max ?? 120), step: Number(a.step) || 1 };
  }

  private _minutes(z: Zone): number | undefined {
    const smart = this._smart(z);
    if (smart) return smart.minutes;
    return this._pending?.zone === z.idx ? this._pending.value : z.minutes;
  }

  /** Modus „Smart“ aktiv: Laufzeiten werden berechnet und sind gesperrt */
  private _smartActive(): boolean {
    const c = this._config!;
    return !!c.mode && !!c.smart_mode && this.hass!.states[c.mode]?.state === c.smart_mode;
  }

  /** Smart-Vorschlag der Zone: aufgerundete Minuten, gekappt bei smart_max, übersprungen unter smart_min */
  private _smart(z: Zone): { minutes: number; raw: number; capped: boolean; skipped: boolean } | undefined {
    if (!z.cfg.smart_duration || !this._smartActive()) return undefined;
    const st = this.hass!.states[z.cfg.smart_duration];
    const v = Number(st?.state);
    if (!st || UNAVAILABLE.includes(st.state) || !Number.isFinite(v)) return { minutes: 0, raw: NaN, capped: false, skipped: true };
    const unit = String(st.attributes.unit_of_measurement ?? "s").toLowerCase();
    const raw = unit === "min" ? v : unit === "h" ? v * 60 : v / 60;
    const c = this._config!;
    const full = Math.ceil(Math.max(0, raw) - 1e-9);
    const max = c.smart_max ?? Infinity;
    return { minutes: Math.min(full, max), raw, capped: full > max, skipped: full < (c.smart_min ?? 0) };
  }

  private _toggleEdit(z: Zone): void {
    this._haptic("selection");
    this._edit = this._edit === z.idx ? undefined : z.idx;
  }

  /** Laufzeit setzen – bei −/+ kurz gesammelt, bei Schnellwahl sofort */
  private _setMinutes(z: Zone, value: number, now = false): void {
    const st = z.durationSt;
    if (!st) return;
    const r = this._range(z);
    const v = Math.min(r.max, Math.max(r.min, Math.round(value / r.step) * r.step));
    this._haptic("selection");
    this._pending = { zone: z.idx, value: v };
    clearTimeout(this._sendTimer);
    const send = () => {
      this._call(st.entity_id.split(".")[0]!, "set_value", { entity_id: st.entity_id, value: v })
        .catch(() => undefined).finally(() => { if (this._pending?.zone === z.idx && this._pending.value === v) this._pending = undefined; });
    };
    if (now) send();
    else this._sendTimer = window.setTimeout(send, 600);
  }

  private _step(z: Zone, dir: number): void {
    const cur = this._minutes(z) ?? this._range(z).min;
    const r = this._range(z);
    // feiner unter 10 min, darüber in 5er-Schritten
    const step = r.step >= 5 ? r.step : cur + dir * r.step > 10 || (dir < 0 && cur > 10) ? 5 : r.step;
    const next = dir > 0 ? Math.floor(cur / step) * step + step : Math.ceil(cur / step) * step - step;
    this._setMinutes(z, next);
  }

  private _renderSmart(z: Zone, canStart: boolean, smart: NonNullable<ReturnType<HaIrrigationCard["_smart"]>>) {
    const lang = getLanguage(this.hass);
    const running = z.open || (!!z.timer && z.timer.state !== "idle");
    const raw = Number.isFinite(smart.raw) ? smart.raw.toLocaleString(lang, { maximumFractionDigits: 1 }) : "–";
    const note = !Number.isFinite(smart.raw) ? this._t("smart_unavailable")
      : smart.skipped ? this._t("smart_skipped").replace("{raw}", raw)
      : smart.capped ? this._t("smart_capped").replace("{raw}", String(Math.ceil(smart.raw)))
      : this._t("smart_calculated").replace("{raw}", raw);
    const start = Math.max(1, smart.minutes);
    return html`<div class="editor smart" style="--zc:${z.color}">
      <div class="ed-head">
        <span class="ed-title"><ha-icon icon="mdi:auto-fix"></ha-icon>${this._t("smart_title")} · ${z.name}</span>
        <button class="ed-close" aria-label=${this._t("close")} @click=${() => this._toggleEdit(z)}><ha-icon icon="mdi:close"></ha-icon></button>
      </div>
      <div class="ed-main">
        <span class="ed-val ${smart.skipped ? "skip" : ""}">${smart.skipped ? html`<ha-icon icon="mdi:skip-next"></ha-icon>` : html`${smart.minutes}<small> min</small>`}</span>
      </div>
      <span class="ed-note">${note}</span>
      <span class="ed-lock"><ha-icon icon="mdi:lock-outline"></ha-icon>${this._t("smart_locked")}</span>
      ${running ? nothing : html`<button class="ed-start" ?disabled=${!canStart || z.unavailable} @click=${() => { this._edit = undefined; this._start(z); }}>
        <ha-icon icon="mdi:play"></ha-icon>${canStart ? `${this._t("start")} · ${start} min` : this._t("pump_needed")}</button>`}
    </div>`;
  }

  private _renderEditor(z: Zone, canStart: boolean) {
    const smart = this._smart(z);
    if (smart) return this._renderSmart(z, canStart, smart);
    const r = this._range(z);
    const min = this._minutes(z) ?? r.min;
    const presets = (this._config!.durations ?? [5, 10, 15, 20, 30, 45, 60]).filter((m) => m >= r.min && m <= r.max);
    const running = z.open || (!!z.timer && z.timer.state !== "idle");
    return html`<div class="editor" style="--zc:${z.color}">
      <div class="ed-head">
        <span class="ed-title"><ha-icon icon="mdi:timer-cog-outline"></ha-icon>${this._t("duration")} · ${z.name}</span>
        <button class="ed-close" aria-label=${this._t("close")} @click=${() => this._toggleEdit(z)}><ha-icon icon="mdi:close"></ha-icon></button>
      </div>
      <div class="ed-main">
        <button class="ed-step" aria-label="−" ?disabled=${min <= r.min} @click=${() => this._step(z, -1)}><ha-icon icon="mdi:minus"></ha-icon></button>
        <span class="ed-val">${Math.round(min)}<small> min</small></span>
        <button class="ed-step" aria-label="+" ?disabled=${min >= r.max} @click=${() => this._step(z, 1)}><ha-icon icon="mdi:plus"></ha-icon></button>
      </div>
      <div class="ed-chips">${presets.map((m) => html`<button class="ed-chip ${Math.round(min) === m ? "sel" : ""}" @click=${() => this._setMinutes(z, m, true)}>${m}</button>`)}</div>
      ${running ? nothing : html`<button class="ed-start" ?disabled=${!canStart || z.unavailable} @click=${() => { this._edit = undefined; this._start(z); }}>
        <ha-icon icon="mdi:play"></ha-icon>${canStart ? `${this._t("start")} · ${Math.round(min)} min` : this._t("pump_needed")}</button>`}
    </div>`;
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

  private _lines(z: Zone): [string, string] {
    const lang = getLanguage(this.hass);
    const t = z.timer;
    const first = z.unavailable ? this._t("unavailable")
      : t && t.state === "paused" ? `⏸ ${formatRemaining(t.remaining)}`
      : t && t.state === "active" ? formatRemaining(t.remaining)
      : this._t(z.open ? "open" : "closed");
    const second = z.open && z.flow != null && z.flow > 0 ? `${z.flow.toLocaleString(lang, { maximumFractionDigits: z.flow < 10 ? 1 : 0 })} L/min`
      : !z.open && z.volume && !(t && t.state !== "idle") ? `${this._t("last")} ${z.volume}` : "";
    return [first, second];
  }

  private _renderZone(z: Zone, flowing: boolean, canStart: boolean) {
    const t = z.timer;
    const running = z.open || (!!t && t.state !== "idle");
    const progress = t && t.state !== "idle" ? t.progress : z.open ? 1 : 0;
    const lowBat = z.battery != null && z.battery <= 20;
    const [l1, l2] = this._lines(z);
    const locked = !z.open && !canStart;
    return html`<div class="col zone ${z.open ? "open" : ""} ${running ? "running" : ""} ${flowing ? "flowing" : ""} ${locked ? "locked" : ""}" style="--zc:${z.color}" data-zone=${z.idx}>
      <button class="z-badge" style="--p:${(progress * 360).toFixed(1)}deg" ?disabled=${z.unavailable} aria-pressed=${z.open}
        title=${locked ? this._t("pump_needed") : this._t(z.open ? "close_valve" : "open_valve")}
        @click=${() => this._toggleValve(z)} @pointerdown=${(e: PointerEvent) => this._holdStart(e, z.cfg.valve)}
        @pointerup=${this._holdEnd} @pointerleave=${this._holdEnd} @pointercancel=${this._holdEnd} @contextmenu=${(e: Event) => e.preventDefault()}>
        <span class="z-ring"></span><ha-icon .icon=${z.icon}></ha-icon>
        ${lowBat ? html`<span class="z-bat" title="${z.battery} %"><ha-icon .icon=${batteryIcon(z.battery!, false)}></ha-icon></span>` : nothing}
      </button>
      <span class="z-name">${z.name}</span>
      <span class="z-l1">${l1}</span>
      <span class="z-l2">${lowBat && !l2 ? html`<span class="low">${z.battery} %</span>` : l2 || " "}</span>
      <div class="z-ctrl">
        ${running ? html`
          ${t ? html`<button class="ctl" ?disabled=${t.state === "paused" && !canStart} aria-label=${this._t(t.state === "paused" ? "resume" : "pause")} @click=${() => this._pause(z)}>
            <ha-icon .icon=${t.state === "paused" ? "mdi:play" : "mdi:pause"}></ha-icon></button>` : nothing}
          <button class="ctl stop" aria-label=${this._t("stop")} @click=${() => this._stop(z)}><ha-icon icon="mdi:stop"></ha-icon></button>`
        : html`
          ${this._durChip(z)}
          <button class="ctl play" ?disabled=${z.unavailable || !canStart} aria-label=${this._t("start")} @click=${() => this._start(z)}><ha-icon icon="mdi:play"></ha-icon></button>`}
      </div>
    </div>`;
  }

  private _durChip(z: Zone) {
    const smart = this._smart(z);
    if (z.minutes == null && !smart) return nothing;
    const sel = this._edit === z.idx;
    return html`<button class="dur ${sel ? "sel" : ""} ${smart ? "smart" : ""} ${smart?.skipped ? "skip" : ""}" aria-expanded=${sel}
      title=${smart ? this._t("smart_title") : this._t("duration")} @click=${() => this._toggleEdit(z)}>
      ${smart ? html`<ha-icon icon=${smart.skipped ? "mdi:skip-next" : "mdi:auto-fix"}></ha-icon>` : nothing}${smart?.skipped ? nothing : html`${Math.round(this._minutes(z)!)}<small> min</small>`}</button>`;
  }

  // ---------- Smart-Bereich ----------

  /** Aktion mit Rückfrage: erster Tipp fragt, zweiter führt aus */
  private _confirmed(key: string): boolean {
    if (this._confirm === key) { this._confirm = undefined; clearTimeout(this._confirmTimer); return true; }
    this._haptic("warning");
    this._confirm = key;
    clearTimeout(this._confirmTimer);
    this._confirmTimer = window.setTimeout(() => (this._confirm = undefined), 4000);
    return false;
  }

  private _smartAction(kind: "calculate" | "run" | "reset"): void {
    const sm = this._config!.smart ?? {};
    if (kind === "calculate" && sm.calculate) {
      this._haptic("medium");
      const [domain] = sm.calculate.split(".");
      (domain === "automation" ? this._call("automation", "trigger", { entity_id: sm.calculate }) : this._script(sm.calculate)).catch(() => undefined);
    } else if (kind === "run" && sm.run) {
      if (!this._confirmed("run")) return;
      this._haptic("medium");
      this._script(sm.run).catch(() => undefined);
    } else if (kind === "reset") {
      if (!this._confirmed("reset")) return;
      this._haptic("medium");
      this._call("smart_irrigation", "reset_all_buckets", {}).catch(() => undefined);
    }
  }

  private async _toggleSmartZone(z: Zone): Promise<void> {
    this._haptic("selection");
    this._smartOpen = this._smartOpen === z.idx ? undefined : z.idx;
    const id = z.cfg.smart_duration;
    if (this._smartOpen == null || !id || this._bucketHist[id] || !this.hass?.callWS) return;
    try {
      const res = await this.hass.callWS<Record<string, { a?: Record<string, any>; attributes?: Record<string, any>; lu?: number; last_updated?: string }[]>>({
        type: "history/history_during_period", start_time: new Date(Date.now() - 7 * 86400_000).toISOString(), end_time: new Date().toISOString(),
        entity_ids: [id], minimal_response: false, no_attributes: false, significant_changes_only: false,
      });
      let last: number | undefined;
      const pts: { t: number; v: number }[] = [];
      for (const e of res?.[id] ?? []) {
        const b = Number((e.a ?? e.attributes)?.bucket);
        const t = e.lu != null ? e.lu * 1000 : new Date(e.last_updated ?? 0).getTime();
        if (!Number.isFinite(b) || b === last) continue;
        last = b;
        pts.push({ t, v: b });
      }
      this._bucketHist = { ...this._bucketHist, [id]: pts };
    } catch { /* Verlauf nicht verfügbar */ }
  }

  private _fmtNum(v: number, digits = 1): string {
    return v.toLocaleString(getLanguage(this.hass), { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  }

  /** Wasserkonto-Verlauf (7 Tage) als kleine Linie mit Null-Linie */
  private _sparkline(pts: { t: number; v: number }[], now: number, current: number) {
    const all = [...pts, { t: now, v: current }];
    if (all.length < 2) return nothing;
    const t0 = now - 7 * 86400_000;
    const vs = all.map((p) => p.v);
    const lo = Math.min(0, ...vs) - 0.5;
    const hi = Math.max(0, ...vs) + 0.5;
    const x = (t: number) => ((Math.max(t0, t) - t0) / (now - t0)) * 200;
    const y = (v: number) => 4 + (1 - (v - lo) / (hi - lo)) * 40;
    // Treppenlinie: Konto ändert sich sprunghaft
    let d = `M${x(all[0]!.t).toFixed(1)},${y(all[0]!.v).toFixed(1)}`;
    for (let i = 1; i < all.length; i++) d += ` H${x(all[i]!.t).toFixed(1)} V${y(all[i]!.v).toFixed(1)}`;
    return html`<svg class="spark" viewBox="0 0 200 48" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" x2="200" y1=${y(0).toFixed(1)} y2=${y(0).toFixed(1)} class="zero"></line>
      <path d=${d} class=${current < 0 ? "neg" : "pos"}></path></svg>`;
  }

  private _renderSmartZone(z: Zone) {
    const st = z.cfg.smart_duration ? this.hass!.states[z.cfg.smart_duration] : undefined;
    const smart = this._smart(z);
    if (!st || !smart) return nothing;
    const a = st.attributes;
    const bucket = Number(a.bucket);
    const maxB = Math.max(1, Number(a.maximum_bucket) || 20);
    const share = Number.isFinite(bucket) ? Math.max(-1, Math.min(1, bucket / maxB)) : 0;
    const col = !Number.isFinite(bucket) ? "var(--secondary-text-color)" : bucket >= 0 ? WATER : bucket < -10 ? "var(--error-color, #e53935)" : "#fb8c00";
    const open = this._smartOpen === z.idx;
    const size = Number(a.size);
    const tp = Number(a.throughput);
    const mmh = Number.isFinite(size) && size > 0 && Number.isFinite(tp) ? (tp * 60) / size : undefined;
    const hist = z.cfg.smart_duration ? this._bucketHist[z.cfg.smart_duration] : undefined;
    return html`<div class="sz ${open ? "open" : ""}" style="--zc:${z.color};--bc:${col}">
      <button class="sz-row" aria-expanded=${open} @click=${() => this._toggleSmartZone(z)}>
        <span class="sz-icon"><ha-icon .icon=${z.icon}></ha-icon></span>
        <span class="sz-text"><span class="sz-name">${z.name}</span>
          <span class="sz-bucket">${Number.isFinite(bucket) ? `${bucket >= 0 ? "+" : ""}${this._fmtNum(bucket)} mm · ${this._t(bucket >= 0 ? "bucket_ok" : "bucket_low")}` : this._t("unavailable")}</span>
          <span class="sz-bar"><span class="sz-fill" style="${share >= 0 ? `left:50%;width:${share * 50}%` : `right:50%;width:${-share * 50}%`}"></span></span></span>
        <span class="sz-min ${smart.skipped ? "skip" : ""}">${smart.skipped ? html`<ha-icon icon="mdi:skip-next"></ha-icon>${this._t("skip_short")}` : `${smart.minutes} min`}</span>
        <ha-icon class="sz-chev" icon="mdi:chevron-down"></ha-icon>
      </button>
      ${open ? html`<div class="sz-details">
        <div class="sz-facts">
          ${Number.isFinite(size) ? html`<span><ha-icon icon="mdi:texture-box"></ha-icon><b>${this._fmtNum(size, 0)} m²</b><small>${this._t("area")}</small></span>` : nothing}
          ${Number.isFinite(tp) ? html`<span><ha-icon icon="mdi:water-pump"></ha-icon><b>${mmh != null ? `${this._fmtNum(mmh)} mm/h` : `${this._fmtNum(tp, 0)} l/min`}</b><small>${this._fmtNum(tp, 0)} l/min</small></span>` : nothing}
          ${a.multiplier != null ? html`<span><ha-icon icon="mdi:leaf"></ha-icon><b>× ${this._fmtNum(Number(a.multiplier), 2)}</b><small>${this._t("plant_factor")}</small></span>` : nothing}
        </div>
        <div class="sz-graph"><span class="sz-graph-title">${this._t("bucket_7d")}</span>
          ${hist ? this._sparkline(hist, this._now, Number.isFinite(bucket) ? bucket : 0) : html`<span class="sz-loading">…</span>`}</div>
      </div>` : nothing}
    </div>`;
  }

  private _renderSmartPanel(zones: Zone[]) {
    const c = this._config!;
    const sm = c.smart ?? {};
    const s = this.hass!.states;
    const smartZones = zones.filter((z) => z.cfg.smart_duration);
    const ref = smartZones.map((z) => s[z.cfg.smart_duration!]).find((x) => x);
    const lang = getLanguage(this.hass);
    const skipped = sm.skipped ? s[sm.skipped]?.state === "on" : false;
    const reason = sm.skipped_reason ? s[sm.skipped_reason]?.state : undefined;
    const season = sm.season ? s[sm.season]?.state : undefined;
    const warnSt = sm.warning ? s[sm.warning] : undefined;
    const warn = warnSt && !UNAVAILABLE.includes(warnSt.state) ? Number(warnSt.state) : undefined;
    const eto = Number(ref?.attributes.eto);
    const lastCalc = ref?.attributes.last_calculated ? new Date(String(ref.attributes.last_calculated).replace(" ", "T")) : undefined;
    const calcText = lastCalc && !isNaN(lastCalc.getTime())
      ? (lastCalc.toDateString() === new Date().toDateString() ? lastCalc.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })
        : lastCalc.toLocaleString(lang, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })) : undefined;
    const points = ref?.attributes.number_of_data_points;
    const measured = sm.measured_flow ? s[sm.measured_flow]?.state : undefined;
    const plan = smartZones.map((z) => ({ z, sm: this._smart(z)! })).filter((x) => x.sm);
    const toWater = plan.filter((x) => !x.sm.skipped);
    const note = sm.note ?? [c.smart_max ? this._t("note_max").replace("{max}", String(c.smart_max)) : "", c.smart_min ? this._t("note_min").replace("{min}", String(c.smart_min)) : ""].filter(Boolean).join(" · ");
    return html`<div class="smart-panel">
      <div class="sp-head"><ha-icon icon="mdi:auto-fix"></ha-icon><span>${this._t("smart_section")}</span></div>
      ${skipped ? html`<div class="sp-alert"><ha-icon icon="mdi:weather-pouring"></ha-icon>
        <span><b>${this._t("smart_off_title")}</b>${reason && !UNAVAILABLE.includes(reason) ? html`<small>${reason}</small>` : nothing}</span></div>` : nothing}
      <div class="sp-chips">
        ${season ? html`<span class="sp-chip"><ha-icon .icon=${/winter/i.test(season) ? "mdi:snowflake" : "mdi:white-balance-sunny"}></ha-icon>${season}</span>` : nothing}
        ${warn != null ? html`<span class="sp-chip ${warn > 0 ? "bad" : "good"}"><ha-icon icon="mdi:alert-outline"></ha-icon>${warn > 0 ? `${this._t("warning_level")} ${warn}` : this._t("warning_none")}</span>` : nothing}
        ${Number.isFinite(eto) ? html`<span class="sp-chip"><ha-icon icon="mdi:weather-sunny-alert"></ha-icon>ET₀ ${this._fmtNum(eto)} mm</span>` : nothing}
        ${calcText ? html`<span class="sp-chip" title=${this._t("last_calculated")}><ha-icon icon="mdi:calculator"></ha-icon>${calcText}${points != null ? html`<small> · ${points} ${this._t("data_points")}</small>` : nothing}</span>` : nothing}
      </div>
      ${plan.length ? html`<div class="sp-plan"><span class="sp-plan-title">${this._t("plan")}</span>
        <span class="sp-plan-text">${toWater.length ? toWater.map((x) => `${x.z.name} ${x.sm.minutes} min`).join(" · ") : this._t("nothing_to_water")}${plan.length > toWater.length
          ? html`<small> — ${this._t("skipped")}: ${plan.filter((x) => x.sm.skipped).map((x) => x.z.name).join(", ")}</small>` : nothing}</span></div>` : nothing}
      <div class="sp-zones">${smartZones.map((z) => this._renderSmartZone(z))}</div>
      ${sm.calculate || sm.run || sm.reset_buckets ? html`<div class="sp-actions">
        ${sm.calculate ? html`<button class="sp-act" @click=${() => this._smartAction("calculate")}><ha-icon icon="mdi:calculator-variant"></ha-icon>${this._t("recalculate")}</button>` : nothing}
        ${sm.run ? html`<button class="sp-act run ${this._confirm === "run" ? "ask" : ""}" @click=${() => this._smartAction("run")}>
          <ha-icon icon="mdi:play-circle"></ha-icon>${this._confirm === "run" ? this._t("confirm") : this._t("water_now")}</button>` : nothing}
        ${sm.reset_buckets ? html`<button class="sp-act reset ${this._confirm === "reset" ? "ask" : ""}" @click=${() => this._smartAction("reset")}>
          <ha-icon icon="mdi:backup-restore"></ha-icon>${this._confirm === "reset" ? this._t("confirm") : this._t("reset_buckets")}</button>` : nothing}
      </div>` : nothing}
      ${measured && !UNAVAILABLE.includes(measured) ? html`<div class="sp-info"><ha-icon icon="mdi:gauge"></ha-icon><span>${measured}</span></div>` : nothing}
      ${note ? html`<div class="sp-note">${note}</div>` : nothing}
    </div>`;
  }

  private _renderOther(flowing: boolean, watts?: number) {
    const c = this._config!;
    return html`<div class="col other ${flowing ? "flowing open" : ""}" style="--zc:${OTHER}" data-zone="other">
      <button class="z-badge" style="--p:${flowing ? 360 : 0}deg" @click=${() => this._moreInfo(c.pump_power)}>
        <span class="z-ring"></span><ha-icon .icon=${c.other_icon ?? "mdi:faucet"}></ha-icon>
      </button>
      <span class="z-name">${c.other_name ?? this._t("other")}</span>
      <span class="z-l1">${flowing ? this._t("in_use") : "–"}</span>
      <span class="z-l2">${flowing && watts != null ? formatPower(watts, getLanguage(this.hass), 1000, 0, 1) : " "}</span>
    </div>`;
  }

  /** Verteiler: Pumpe → Hauptleitung → waagerechte Verteilung → je Strang eine Leitung nach unten (parallel) */
  private _renderPipes(flows: boolean[]) {
    const n = flows.length;
    const xs = flows.map((_, i) => ((i + 0.5) / n) * 100);
    const any = flows.some(Boolean);
    const pts = [...new Set([...xs, 50])].sort((a, b) => a - b);
    const segs = pts.slice(0, -1).map((a, k) => {
      const b = pts[k + 1]!;
      const left = b <= 50;
      const on = left ? xs.some((x, i) => flows[i] && x <= a) : xs.some((x, i) => flows[i] && x >= b);
      return html`<span class="pipe h ${on ? `flow ${left ? "to-l" : "to-r"}` : ""}" style="left:${a}%;width:${b - a}%"></span>`;
    });
    return html`<span class="pipe trunk ${any ? "flow" : ""}"></span>${segs}
      ${xs.map((x, i) => html`<span class="pipe v ${flows[i] ? "flow" : ""}" style="left:${x}%"></span>`)}`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const s = this.hass.states;
    const zones = this._zones();
    const pumpOn = this._isOn(c.pump);
    const canStart = this._canStart();
    const pumpSt = c.pump ? s[c.pump] : undefined;
    const watts = powerWatts(c.pump_power ? s[c.pump_power] : undefined);
    const pumping = watts != null ? watts > (c.other_threshold ?? 15) : pumpOn;
    const anyOpen = zones.some((z) => z.open);
    const anyRunning = anyOpen || zones.some((z) => z.timer && z.timer.state !== "idle");
    // Wasser fließt durch ein offenes Ventil, solange die Pumpe läuft (oder der Ventil-Sensor Durchfluss misst)
    const zoneFlow = zones.map((z) => z.open && (!c.pump || pumpOn || (z.flow ?? 0) > 0));
    const showOther = c.show_other !== false && !!c.pump_power;
    const otherFlow = showOther && pumping && !anyOpen;
    const flows = [...zoneFlow, ...(showOther ? [otherFlow] : [])];
    const runAllActive = this._isOn(c.run_all_active);
    const modeSt = c.mode ? s[c.mode] : undefined;
    const startSt = c.start_time ? s[c.start_time] : undefined;
    const lastRun = c.last_run ? s[c.last_run]?.state : undefined;
    const openNames = zones.filter((z) => z.open).map((z) => z.name);
    const status = !pumpSt && c.pump ? this._t("unavailable")
      : pumpOn ? this._t(runAllActive ? "run_all_active" : pumping ? "pumping" : "ready")
      : anyOpen ? this._t("pump_off_open") : this._t("off");
    const anim = c.animations ?? "full";
    return html`<ha-card class="irrigation anim-${anim} ${pumpOn ? "on" : "off"}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <button class="head-text" @click=${() => this._moreInfo(c.pump)}>
          <span class="h-title">${c.title ?? this._t("title")}</span>
          <span class="h-sub">${status}${openNames.length ? html` · <span class="h-open">${openNames.join(", ")}</span>` : nothing}</span>
        </button>
        ${startSt && !UNAVAILABLE.includes(startSt.state) ? html`<button class="chip" @click=${() => this._moreInfo(c.start_time)} title=${this._t("start_time")}>
          <ha-icon icon="mdi:clock-outline"></ha-icon>${startSt.attributes.hour != null
            ? `${String(startSt.attributes.hour).padStart(2, "0")}:${String(startSt.attributes.minute ?? 0).padStart(2, "0")}` : startSt.state.slice(0, 5)}</button>` : nothing}
      </div>
      <div class="net" style="--n:${flows.length || 1}">
        <div class="pump-wrap">
          <button class="pump ${pumpOn ? "on" : ""} ${pumping ? "pumping" : ""}" ?disabled=${!c.pump} @click=${() => this._togglePump()}
            aria-pressed=${pumpOn} aria-label=${this._t("pump")} title=${this._t("pump")}>
            <span class="ripple"></span><ha-icon .icon=${c.icon ?? "mdi:water-pump"}></ha-icon>
          </button>
          <span class="pump-val">${watts != null ? formatPower(watts, getLanguage(this.hass), 1000, 0, 1) : this._t(pumpOn ? "on" : "off")}</span>
        </div>
        ${flows.length ? html`<div class="pipes">${this._renderPipes(flows)}</div>
          <div class="cols">${zones.map((z, i) => this._renderZone(z, zoneFlow[i]!, canStart))}${showOther ? this._renderOther(otherFlow, watts) : nothing}</div>` : nothing}
      </div>
      ${this._edit != null && zones[this._edit] && (zones[this._edit]!.durationSt || this._smart(zones[this._edit]!)) ? this._renderEditor(zones[this._edit]!, canStart) : nothing}
      ${c.pump && !pumpOn && zones.length ? html`<div class="hint"><ha-icon icon="mdi:information-outline"></ha-icon>${this._t("pump_needed")}</div>` : nothing}
      ${modeSt && Array.isArray(modeSt.attributes.options) ? html`<div class="modes" role="radiogroup">
        ${(modeSt.attributes.options as string[]).map((o) => html`<button class="mode ${modeSt.state === o ? "sel" : ""}" role="radio" aria-checked=${modeSt.state === o}
          @click=${() => this._selectMode(o)}>${o}</button>`)}</div>` : nothing}
      ${this._smartActive() && c.zones.some((z) => z.smart_duration) ? this._renderSmartPanel(zones) : nothing}
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
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; border: none; background: none; padding: 0; text-align: left; cursor: pointer; }
    .h-title { font-size: 17px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .h-sub { font-size: 13px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .h-open { color: var(--accent); font-weight: 600; }
    .chip { flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px 5px 8px; border-radius: 999px; border: none; cursor: pointer;
      font-size: 13px; font-weight: 600; background: rgba(127,127,127,0.12); }
    .chip ha-icon { --mdc-icon-size: 16px; color: var(--secondary-text-color); }

    /* Verteiler: Pumpe (56) → Hauptleitung bis y=84 → Verteilung → Stränge bis zu den Ventilen (y=104) */
    .net { position: relative; padding-top: 104px; container-type: inline-size; }
    .pump-wrap { position: absolute; top: 0; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; z-index: 1; }
    .pump { position: relative; flex: none; width: 56px; height: 56px; border-radius: 50%; border: none; padding: 0; display: grid; place-items: center; cursor: pointer;
      color: var(--secondary-text-color); background: var(--card-background-color, var(--ha-card-background, #fff));
      box-shadow: inset 0 0 0 3px rgba(127,127,127,0.25); transition: background 0.4s, color 0.4s, box-shadow 0.4s, transform 0.2s var(--ease-spring); }
    .pump:active { transform: scale(0.92); }
    .pump ha-icon { --mdc-icon-size: 30px; }
    .pump.on { color: #fff; background: var(--accent); box-shadow: 0 4px 16px color-mix(in srgb, var(--accent) 45%, transparent); }
    .pump .ripple { position: absolute; inset: 0; border-radius: 50%; pointer-events: none; }
    .pump.pumping .ripple { border: 2px solid var(--accent); animation: ripple 2.2s ease-out infinite; }
    @keyframes ripple { 0% { transform: scale(1); opacity: 0.7; } 80%, 100% { transform: scale(1.45); opacity: 0; } }
    .pump-val { position: absolute; left: calc(100% + 10px); font-size: 13px; font-weight: 700; white-space: nowrap; color: var(--secondary-text-color); }
    .pump.on + .pump-val { color: var(--primary-text-color); }
    .pipes { position: absolute; inset: 0; pointer-events: none; }
    .pipe { position: absolute; background: rgba(127,127,127,0.22); border-radius: 2px; }
    .pipe.trunk { left: calc(50% - 2px); width: 4px; top: 56px; height: 30px; }
    .pipe.h { top: 82px; height: 4px; }
    .pipe.v { width: 4px; top: 82px; height: 24px; transform: translateX(-2px); }
    .pipe.flow { --wc: var(--accent); }
    .pipe.trunk.flow, .pipe.v.flow { background: repeating-linear-gradient(to bottom, var(--wc) 0 7px, color-mix(in srgb, var(--wc) 35%, transparent) 7px 14px);
      background-size: 100% 14px; animation: down 0.7s linear infinite; }
    .pipe.h.flow { background: repeating-linear-gradient(to right, var(--wc) 0 7px, color-mix(in srgb, var(--wc) 35%, transparent) 7px 14px);
      background-size: 14px 100%; animation: right 0.7s linear infinite; }
    .pipe.h.flow.to-l { animation-name: left; }
    @keyframes down { from { background-position: 0 0; } to { background-position: 0 14px; } }
    @keyframes right { from { background-position: 0 0; } to { background-position: 14px 0; } }
    @keyframes left { from { background-position: 0 0; } to { background-position: -14px 0; } }
    .cols { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); }
    .col { position: relative; display: flex; flex-direction: column; align-items: center; gap: 1px; min-width: 0; padding: 0 2px; text-align: center; }
    .z-badge { position: relative; flex: none; width: 48px; height: 48px; border-radius: 50%; border: none; padding: 0; display: grid; place-items: center; cursor: pointer;
      color: var(--secondary-text-color); background: var(--card-background-color, var(--ha-card-background, #fff)); transition: color 0.4s, transform 0.2s var(--ease-spring);
      margin-bottom: 4px; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
    .z-badge:active { transform: scale(0.92); }
    .z-badge::before { content: ""; position: absolute; inset: 0; border-radius: 50%; background: rgba(127,127,127,0.12); box-shadow: inset 0 0 0 3px rgba(127,127,127,0.2); transition: background 0.4s; }
    .z-ring { position: absolute; inset: 0; border-radius: 50%; padding: 3px; pointer-events: none;
      background: conic-gradient(var(--zc) 0 var(--p), transparent var(--p) 360deg);
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; transition: background 0.6s; }
    .z-badge ha-icon { position: relative; --mdc-icon-size: 24px; }
    .col.open .z-badge { color: var(--zc); }
    .col.open .z-badge::before { background: color-mix(in srgb, var(--zc) 22%, transparent); }
    .col.flowing .z-badge ha-icon { animation: bob 2.6s ease-in-out infinite; }
    @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
    .col.locked .z-badge { cursor: not-allowed; opacity: 0.7; }
    .z-bat { position: absolute; right: -4px; top: -4px; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center;
      background: var(--card-background-color, #fff); color: var(--error-color, #e53935); box-shadow: 0 0 0 1.5px var(--error-color, #e53935); }
    .z-bat ha-icon { --mdc-icon-size: 13px !important; animation: none !important; }
    .z-name { max-width: 100%; font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .z-l1 { font-size: 12.5px; color: var(--secondary-text-color); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .col.running .z-l1, .col.flowing .z-l1 { color: var(--zc); font-weight: 700; }
    .z-l2 { max-width: 100%; font-size: 11.5px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .z-l2 .low { color: var(--error-color, #e53935); font-weight: 600; }
    .z-ctrl { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 4px; margin-top: 6px; }
    .ctl { width: 34px; height: 34px; border-radius: 50%; border: none; padding: 0; display: grid; place-items: center; cursor: pointer;
      background: rgba(127,127,127,0.14); transition: transform 0.2s var(--ease-spring), background 0.3s, opacity 0.3s; }
    .ctl:active { transform: scale(0.9); }
    .ctl ha-icon { --mdc-icon-size: 20px; }
    .ctl.play { color: #fff; background: var(--zc); }
    .ctl[disabled] { opacity: 0.3; cursor: not-allowed; }
    .ctl.play[disabled] { background: rgba(127,127,127,0.35); }
    .ctl.stop { color: var(--error-color, #e53935); background: color-mix(in srgb, var(--error-color, #e53935) 14%, transparent); }
    .dur { height: 34px; min-width: 34px; padding: 0 9px; border: none; border-radius: 999px; background: rgba(127,127,127,0.12); cursor: pointer; font-size: 13px; font-weight: 700; white-space: nowrap; }
    .dur small { font-size: 10.5px; font-weight: 500; color: var(--secondary-text-color); }
    @container (max-width: 330px) { .dur small { display: none; } .dur { padding: 0 8px; } .z-ctrl { gap: 3px; } .ctl { width: 30px; height: 30px; } }
    .dur.sel { color: #fff; background: var(--zc); }
    .dur.smart { position: relative; color: #ab47bc; background: color-mix(in srgb, #ab47bc 16%, transparent); }
    .dur.smart:not(.skip) ha-icon { position: absolute; top: -6px; right: -6px; --mdc-icon-size: 12px; width: 18px; height: 18px; border-radius: 50%;
      display: grid; place-items: center; color: #fff; background: #ab47bc; }
    .dur.smart.skip ha-icon { --mdc-icon-size: 18px; }
    .dur.smart.skip { color: var(--secondary-text-color); background: rgba(127,127,127,0.12); }
    .dur.smart.sel { color: #fff; background: #ab47bc; }
    .editor.smart { --zc: #ab47bc !important; }
    .ed-val.skip ha-icon { --mdc-icon-size: 40px; color: var(--secondary-text-color); }
    .ed-note { text-align: center; font-size: 13px; color: var(--secondary-text-color); margin-top: -4px; }
    .ed-lock { display: flex; align-items: center; justify-content: center; gap: 5px; font-size: 12px; color: var(--secondary-text-color); opacity: 0.85; }
    .ed-lock ha-icon { --mdc-icon-size: 14px; }
    .dur.sel small { color: inherit; opacity: 0.85; }
    .editor { display: flex; flex-direction: column; gap: 10px; padding: 10px 12px 12px; border-radius: var(--hcc-inner-radius, 14px);
      background: color-mix(in srgb, var(--zc) 12%, rgba(127,127,127,0.06)); animation: ed-in 0.3s var(--ease-out) both; }
    @keyframes ed-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
    ha-card.anim-off .editor { animation: none; }
    .ed-head { display: flex; align-items: center; gap: 8px; }
    .ed-title { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; font-size: 12px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.04em; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ed-title ha-icon { --mdc-icon-size: 16px; color: var(--zc); flex: none; }
    .ed-close { width: 28px; height: 28px; border-radius: 50%; border: none; padding: 0; display: grid; place-items: center; cursor: pointer; background: none; color: var(--secondary-text-color); }
    .ed-close ha-icon { --mdc-icon-size: 18px; }
    .ed-main { display: flex; align-items: center; justify-content: center; gap: 18px; }
    .ed-step { width: 44px; height: 44px; border-radius: 50%; border: none; padding: 0; display: grid; place-items: center; cursor: pointer; color: var(--zc);
      background: var(--card-background-color, var(--ha-card-background, #fff)); transition: transform 0.2s var(--ease-spring), opacity 0.2s; touch-action: manipulation; }
    .ed-step:active { transform: scale(0.88); }
    .ed-step[disabled] { opacity: 0.35; cursor: default; }
    .ed-step ha-icon { --mdc-icon-size: 24px; }
    .ed-val { min-width: 92px; text-align: center; font-size: 34px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
    .ed-val small { font-size: 15px; font-weight: 500; color: var(--secondary-text-color); }
    .ed-chips { display: flex; gap: 6px; }
    .ed-chip { flex: 1; min-width: 0; border: none; border-radius: 999px; padding: 7px 2px; cursor: pointer; font-size: 13px; font-weight: 600;
      background: var(--card-background-color, var(--ha-card-background, #fff)); transition: background 0.2s, color 0.2s; }
    .ed-chip.sel { color: #fff; background: var(--zc); }
    .ed-start { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 9px; border: none; border-radius: 999px; cursor: pointer;
      font-size: 14px; font-weight: 600; color: #fff; background: var(--zc); }
    .ed-start[disabled] { color: var(--secondary-text-color); background: rgba(127,127,127,0.15); cursor: not-allowed; }
    .ed-start ha-icon { --mdc-icon-size: 20px; }
    .hint { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12.5px; color: var(--secondary-text-color); margin-top: -4px; }
    .hint ha-icon { --mdc-icon-size: 16px; }
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
    .smart-panel { --sc: #ab47bc; display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: var(--hcc-inner-radius, 14px);
      background: color-mix(in srgb, var(--sc) 9%, rgba(127,127,127,0.05)); animation: ed-in 0.35s var(--ease-out) both; }
    ha-card.anim-off .smart-panel { animation: none; }
    .sp-head { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--secondary-text-color); }
    .sp-head ha-icon { --mdc-icon-size: 16px; color: var(--sc); }
    .sp-alert { display: flex; align-items: flex-start; gap: 10px; padding: 10px; border-radius: 12px; color: #fb8c00; background: color-mix(in srgb, #fb8c00 14%, transparent); }
    .sp-alert ha-icon { --mdc-icon-size: 22px; flex: none; }
    .sp-alert span { display: flex; flex-direction: column; gap: 2px; color: var(--primary-text-color); font-size: 14px; }
    .sp-alert small { font-size: 12.5px; color: var(--secondary-text-color); }
    .sp-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .sp-chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px 4px 8px; border-radius: 999px; font-size: 12.5px; font-weight: 600;
      background: var(--card-background-color, var(--ha-card-background, #fff)); }
    .sp-chip ha-icon { --mdc-icon-size: 15px; color: var(--secondary-text-color); }
    .sp-chip small { font-weight: 500; color: var(--secondary-text-color); }
    .sp-chip.good ha-icon { color: var(--success-color, #43a047); }
    .sp-chip.bad { color: var(--error-color, #e53935); }
    .sp-chip.bad ha-icon { color: inherit; }
    .sp-plan { display: flex; flex-direction: column; gap: 2px; }
    .sp-plan-title { font-size: 12px; color: var(--secondary-text-color); }
    .sp-plan-text { font-size: 14.5px; font-weight: 600; }
    .sp-plan-text small { font-size: 12.5px; font-weight: 500; color: var(--secondary-text-color); }
    .sp-zones { display: flex; flex-direction: column; gap: 6px; }
    .sz { border-radius: 12px; background: var(--card-background-color, var(--ha-card-background, #fff)); overflow: hidden; }
    .sz-row { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border: none; background: none; cursor: pointer; text-align: left; }
    .sz-icon { flex: none; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: var(--zc); background: color-mix(in srgb, var(--zc) 16%, transparent); }
    .sz-icon ha-icon { --mdc-icon-size: 19px; }
    .sz-text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
    .sz-name { font-size: 14px; font-weight: 600; }
    .sz-bucket { font-size: 12px; color: var(--bc); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sz-bar { position: relative; height: 4px; border-radius: 2px; background: rgba(127,127,127,0.18); }
    .sz-bar::after { content: ""; position: absolute; left: 50%; top: -2px; bottom: -2px; width: 1.5px; background: var(--secondary-text-color); opacity: 0.5; }
    .sz-fill { position: absolute; top: 0; bottom: 0; border-radius: 2px; background: var(--bc); transition: width 0.6s var(--ease-out); }
    .sz-min { flex: none; display: inline-flex; align-items: center; gap: 2px; padding: 4px 9px; border-radius: 999px; font-size: 13px; font-weight: 700;
      color: var(--sc); background: color-mix(in srgb, var(--sc) 14%, transparent); white-space: nowrap; }
    .sz-min.skip { color: var(--secondary-text-color); background: rgba(127,127,127,0.12); font-weight: 600; }
    .sz-min ha-icon { --mdc-icon-size: 15px; }
    .sz-chev { flex: none; --mdc-icon-size: 20px; color: var(--secondary-text-color); transition: transform 0.3s var(--ease-out); }
    .sz.open .sz-chev { transform: rotate(180deg); }
    .sz-details { display: flex; flex-direction: column; gap: 10px; padding: 2px 12px 12px; animation: ed-in 0.3s var(--ease-out) both; }
    .sz-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
    .sz-facts span { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 8px 4px; border-radius: 10px; background: rgba(127,127,127,0.08); text-align: center; }
    .sz-facts ha-icon { --mdc-icon-size: 18px; color: var(--zc); }
    .sz-facts b { font-size: 13.5px; white-space: nowrap; }
    .sz-facts small { font-size: 11px; color: var(--secondary-text-color); }
    .sz-graph { display: flex; flex-direction: column; gap: 4px; }
    .sz-graph-title { font-size: 11.5px; color: var(--secondary-text-color); }
    .spark { width: 100%; height: 48px; overflow: visible; }
    .spark .zero { stroke: var(--secondary-text-color); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.5; vector-effect: non-scaling-stroke; }
    .spark path { fill: none; stroke-width: 2.5; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
    .spark path.pos { stroke: #29b6f6; }
    .spark path.neg { stroke: #fb8c00; }
    .sz-loading { font-size: 12px; color: var(--secondary-text-color); }
    .sp-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 6px; }
    .sp-act { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 4px; border: none; border-radius: 12px; cursor: pointer;
      font-size: 12.5px; font-weight: 600; background: var(--card-background-color, var(--ha-card-background, #fff)); transition: background 0.3s, color 0.3s; }
    .sp-act ha-icon { --mdc-icon-size: 22px; color: var(--sc); }
    .sp-act.run ha-icon { color: var(--success-color, #43a047); }
    .sp-act.reset ha-icon { color: #fb8c00; }
    .sp-act.ask { color: #fff; background: var(--sc); }
    .sp-act.ask ha-icon { color: #fff; }
    .sp-info { display: flex; align-items: flex-start; gap: 6px; font-size: 12px; color: var(--secondary-text-color); line-height: 1.4; }
    .sp-info ha-icon { --mdc-icon-size: 15px; flex: none; margin-top: 1px; }
    .sp-note { font-size: 11.5px; color: var(--secondary-text-color); line-height: 1.4; opacity: 0.85; }
    .last-run { display: flex; align-items: flex-start; gap: 6px; font-size: 12px; color: var(--secondary-text-color); line-height: 1.4; }
    .last-run ha-icon { --mdc-icon-size: 15px; flex: none; margin-top: 1px; }
    ha-card.anim-reduced .pipe.flow, ha-card.anim-off .pipe.flow, ha-card.anim-reduced .pump .ripple, ha-card.anim-off .pump .ripple,
    ha-card.anim-reduced .col .z-badge ha-icon, ha-card.anim-off .col .z-badge ha-icon, ha-card.anim-off .act.run.active ha-icon { animation: none; }
  `];
}
