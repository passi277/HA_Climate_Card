import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CameraCardConfig, CameraFeatures, CameraGroupCardConfig, HomeAssistant } from "./types";
import { localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { cameraName, DETECTIONS, isActive, resolveCamera, snapshotUrl } from "./components/camera-view";
import { UNAVAILABLE, wifiQuality } from "./utils";
import "./components/camera-view";
import "./camera-group-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-camera-group-card",
  name: "Modern Camera Group Card",
  description: "Mehrere Kameras als Raster mit Bewegung, Akku und WLAN, Scharf/Unscharf und Bewegungserkennung je Kamera – antippen öffnet die Kamera groß (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

interface Cam {
  cfg: CameraCardConfig;
  name: string;
  f: CameraFeatures;
  motion: boolean;
  lowBattery: boolean;
  unavailable: boolean;
}

@customElement("ha-camera-group-card")
export class HaCameraGroupCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: CameraGroupCardConfig;
  @state() private _open?: string;
  @state() private _tick = Date.now();
  @state() private _healthOpen = false;
  @state() private _confirm?: string;
  private _visible = false;
  private _io?: IntersectionObserver;
  private _timer?: number;
  private _confirmTimer?: number;
  private _watched: string[] = [];

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-camera-group-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<CameraGroupCardConfig> {
    return { cameras: Object.keys(hass.states).filter((id) => id.startsWith("camera.")).slice(0, 4) };
  }

  public setConfig(config: CameraGroupCardConfig): void {
    if (!config?.cameras?.length) throw new Error("ha-camera-group-card: 'cameras' angeben");
    this._config = { ...config };
  }

  public getCardSize(): number {
    return 3 + Math.ceil((this._config?.cameras.length ?? 0) / 2) * 2;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._io = new IntersectionObserver((e) => { this._visible = e.some((x) => x.isIntersecting); this._schedule(); });
    this._io.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._io?.disconnect();
    clearInterval(this._timer);
    clearTimeout(this._confirmTimer);
  }

  /** Vorschaubilder seltener auffrischen als die große Ansicht */
  private _schedule(): void {
    clearInterval(this._timer);
    if (this._visible) this._timer = window.setInterval(() => (this._tick = Date.now()), Math.max(10, (this._config?.refresh_interval ?? 10) * 3) * 1000);
  }

  private _t(key: string): string {
    return localize(this.hass, `camera.${key}`);
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1 || !this._watched.length) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    return !old || this._watched.some((id) => old.states[id] !== this.hass!.states[id]);
  }

  private _cams(): Cam[] {
    const s = this.hass!.states;
    return this._config!.cameras.map((c) => {
      const cfg = { type: "", camera_view: this._config!.camera_view, refresh_interval: this._config!.refresh_interval, ...(typeof c === "string" ? { entity: c } : c) } as CameraCardConfig;
      const f = resolveCamera(this.hass!, cfg);
      const bat = f.battery ? Number(s[f.battery]?.state) : NaN;
      return {
        cfg, f, name: cameraName(this.hass!, cfg),
        motion: DETECTIONS.some((d) => isActive(s[f[d.key] ?? ""])),
        lowBattery: isActive(s[f.battery_low ?? ""]) || (Number.isFinite(bat) && bat <= 20),
        unavailable: !s[cfg.entity] || UNAVAILABLE.includes(s[cfg.entity]!.state),
      };
    });
  }

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
    }
  }

  private _confirmed(key: string): boolean {
    if (this._confirm === key) { this._confirm = undefined; clearTimeout(this._confirmTimer); return true; }
    this._haptic("warning");
    this._confirm = key;
    clearTimeout(this._confirmTimer);
    this._confirmTimer = window.setTimeout(() => (this._confirm = undefined), 4000);
    return false;
  }

  private _arm(armed: boolean): void {
    const id = this._config!.alarm!;
    if (armed) {
      if (!this._confirmed("disarm")) return;
      this._haptic("medium");
      this._call("alarm_control_panel", "alarm_disarm", { entity_id: id });
    } else {
      this._haptic("medium");
      this._call("alarm_control_panel", "alarm_arm_away", { entity_id: id });
    }
  }

  private _toggleOpen(id: string): void {
    this._haptic("selection");
    this._open = this._open === id ? undefined : id;
  }

  private _renderTile(c: Cam) {
    const url = snapshotUrl(this.hass!.states[c.cfg.entity], this._tick);
    const s = this.hass!.states;
    const active = DETECTIONS.filter((d) => isActive(s[c.f[d.key] ?? ""]));
    const ms = c.f.motion_switch ? s[c.f.motion_switch] : undefined;
    return html`<button class="tile ${c.motion ? "motion" : ""} ${this._open === c.cfg.entity ? "sel" : ""}" data-cam=${c.cfg.entity} @click=${() => this._toggleOpen(c.cfg.entity)}>
      ${c.unavailable ? html`<span class="t-empty"><ha-icon icon="mdi:cctv-off"></ha-icon></span>` : url ? html`<img src=${url} alt=${c.name} loading="lazy" />` : html`<span class="t-empty"><ha-icon icon="mdi:cctv"></ha-icon></span>`}
      <span class="t-shade"></span>
      <span class="t-icons">
        ${active.map((d) => html`<span class="t-det" style="--dc:${d.color}"><ha-icon .icon=${d.icon}></ha-icon></span>`)}
        ${c.lowBattery ? html`<span class="t-warn"><ha-icon icon="mdi:battery-alert"></ha-icon></span>` : nothing}
        ${ms && ms.state !== "on" ? html`<span class="t-off" title=${this._t("detection_off")}><ha-icon icon="mdi:motion-sensor-off"></ha-icon></span>` : nothing}
      </span>
      <span class="t-name">${c.name}</span>
    </button>`;
  }

  private _renderHealth(cams: Cam[]) {
    const s = this.hass!.states;
    const rows = cams.filter((c) => c.f.wifi || c.f.temperature || c.f.battery || c.f.battery_low);
    if (!rows.length) return nothing;
    const issues = rows.filter((c) => {
      const w = c.f.wifi ? s[c.f.wifi] : undefined;
      return c.lowBattery || (w && Number.isFinite(Number(w.state)) && wifiQuality(Number(w.state), w.attributes.unit_of_measurement) === "weak");
    }).length;
    return html`<div class="health ${this._healthOpen ? "open" : ""}">
      <button class="sec-head" aria-expanded=${this._healthOpen} @click=${() => { this._haptic("selection"); this._healthOpen = !this._healthOpen; }}>
        <ha-icon icon="mdi:heart-pulse"></ha-icon><span>${this._t("health")}</span>
        ${issues ? html`<span class="count">${issues}</span>` : html`<ha-icon class="ok-mark" icon="mdi:check"></ha-icon>`}
        <ha-icon class="chev ${this._healthOpen ? "up" : ""}" icon="mdi:chevron-down"></ha-icon>
      </button>
      ${this._healthOpen ? html`<div class="h-rows">${rows.map((c) => {
        const w = c.f.wifi ? s[c.f.wifi] : undefined;
        const wv = Number(w?.state);
        const q = w && Number.isFinite(wv) ? wifiQuality(wv, w.attributes.unit_of_measurement) : undefined;
        const tv = c.f.temperature ? Number(s[c.f.temperature]?.state) : NaN;
        const bv = c.f.battery ? Number(s[c.f.battery]?.state) : NaN;
        return html`<div class="h-row">
          <span class="h-name">${c.name}</span>
          ${q ? html`<span class="h-chip ${q}"><ha-icon icon="mdi:wifi"></ha-icon>${this._t(`wifi_${q}`)}</span>` : nothing}
          ${Number.isFinite(tv) ? html`<span class="h-chip"><ha-icon icon="mdi:thermometer"></ha-icon>${Math.round(tv)} °C</span>` : nothing}
          ${Number.isFinite(bv) ? html`<span class="h-chip ${bv <= 20 ? "weak" : ""}"><ha-icon icon="mdi:battery"></ha-icon>${Math.round(bv)} %</span>`
            : c.f.battery_low ? html`<span class="h-chip ${c.lowBattery ? "weak" : ""}"><ha-icon .icon=${c.lowBattery ? "mdi:battery-alert" : "mdi:battery-check"}></ha-icon>${this._t(c.lowBattery ? "battery_low" : "battery_ok")}</span>` : nothing}
        </div>`;
      })}</div>` : nothing}
    </div>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const s = this.hass.states;
    let cams = this._cams();
    this._watched = [...cams.flatMap((x) => [x.cfg.entity, ...Object.values(x.f)]), c.alarm].filter(Boolean) as string[];
    if (c.sort_motion !== false) cams = [...cams].sort((a, b) => Number(b.motion) - Number(a.motion));
    const motion = cams.filter((x) => x.motion);
    const low = cams.filter((x) => x.lowBattery).length;
    const alarm = c.alarm ? s[c.alarm] : undefined;
    const armed = !!alarm && alarm.state.startsWith("armed");
    const online = alarm?.attributes.status;
    const open = cams.find((x) => x.cfg.entity === this._open);
    const switches = cams.filter((x) => x.f.motion_switch);
    const summary = [`${cams.length} ${this._t(cams.length === 1 ? "camera" : "cameras")}`, alarm ? this._t(armed ? "armed" : "disarmed") : "",
      motion.length ? `${motion.length}× ${this._t("motion")}` : this._t("quiet"), low ? `${low}× ${this._t("battery_low")}` : ""].filter(Boolean).join(" · ");
    return html`<ha-card class="camgroup anim-${c.animations ?? "full"} ${motion.length ? "alert" : ""}">
      <div class="header">
        <span class="h-icon ${motion.length ? "alert" : armed ? "armed" : ""}"><ha-icon .icon=${motion.length ? "mdi:cctv" : armed ? "mdi:shield-lock" : "mdi:cctv"}></ha-icon></span>
        <span class="head-text"><span class="h-title">${c.title ?? this._t("title")}</span>
          <span class="h-sub">${summary}${motion.length ? html` · <b>${motion.map((x) => x.name).join(", ")}</b>` : nothing}</span></span>
        ${online && online !== "online" ? html`<span class="offline"><ha-icon icon="mdi:cloud-off-outline"></ha-icon>${this._t("offline")}</span>` : nothing}
      </div>
      ${alarm ? html`<div class="arm">
        <button class="arm-btn ${armed ? "sel armed" : ""}" @click=${() => !armed && this._arm(false)} aria-pressed=${armed}>
          <ha-icon icon="mdi:shield-lock"></ha-icon>${this._t("arm")}</button>
        <button class="arm-btn ${!armed ? "sel disarmed" : ""} ${this._confirm === "disarm" ? "ask" : ""}" @click=${() => armed && this._arm(true)} aria-pressed=${!armed}>
          <ha-icon icon="mdi:shield-off-outline"></ha-icon>${this._confirm === "disarm" ? this._t("confirm") : this._t("disarm")}</button>
      </div>` : nothing}
      ${open ? html`<div class="open-view">
        <div class="ov-head"><span>${open.name}</span><button class="close" aria-label=${this._t("close")} @click=${() => this._toggleOpen(open.cfg.entity)}><ha-icon icon="mdi:close"></ha-icon></button></div>
        <hcc-camera-view embedded .hass=${this.hass} .config=${open.cfg}></hcc-camera-view>
      </div>` : nothing}
      <div class="grid" style="--cols:${c.columns ?? 2}">${cams.map((x) => this._renderTile(x))}</div>
      ${switches.length ? html`<div class="switches"><span class="sw-title"><ha-icon icon="mdi:motion-sensor"></ha-icon>${this._t("detection")}</span>
        <div class="sw-chips">${switches.map((x) => {
          const on = s[x.f.motion_switch!]?.state === "on";
          return html`<button class="sw-chip ${on ? "on" : ""}" aria-pressed=${on} @click=${() => { this._haptic("selection"); this._call("homeassistant", "toggle", { entity_id: x.f.motion_switch }); }}>
            <ha-icon .icon=${on ? "mdi:motion-sensor" : "mdi:motion-sensor-off"}></ha-icon>${x.name}</button>`;
        })}</div></div>` : nothing}
      ${this._renderHealth(cams)}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.camgroup { gap: 12px; }
    .header { display: flex; align-items: center; gap: 12px; }
    .h-icon { flex: none; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; color: var(--secondary-text-color); background: rgba(127,127,127,0.14); }
    .h-icon ha-icon { --mdc-icon-size: 24px; }
    .h-icon.armed { color: var(--success-color, #43a047); background: color-mix(in srgb, var(--success-color, #43a047) 16%, transparent); }
    .h-icon.alert { color: #fff; background: #e53935; animation: pulse 1.6s ease-in-out infinite; }
    @keyframes pulse { 50% { box-shadow: 0 0 0 6px rgba(229,57,53,0.25); } }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .h-title { font-size: 17px; font-weight: 600; }
    .h-sub { font-size: 13px; color: var(--secondary-text-color); }
    .h-sub b { color: #e53935; }
    .offline { flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 4px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; color: #fff; background: #e53935; }
    .offline ha-icon { --mdc-icon-size: 15px; }
    .arm { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 4px; border-radius: 999px; background: rgba(127,127,127,0.1); }
    .arm-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; border: none; border-radius: 999px; cursor: pointer; font-size: 13.5px;
      font-weight: 600; color: var(--secondary-text-color); background: none; transition: background 0.3s, color 0.3s; }
    .arm-btn ha-icon { --mdc-icon-size: 18px; }
    .arm-btn.sel.armed { color: #fff; background: var(--success-color, #43a047); }
    .arm-btn.sel.disarmed { color: #fff; background: #fb8c00; }
    .arm-btn.ask { color: #fff; background: #e53935; }
    .open-view { display: flex; flex-direction: column; gap: 8px; padding: 10px; border-radius: var(--hcc-inner-radius, 14px); background: rgba(127,127,127,0.07);
      animation: fade-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) both; }
    @keyframes fade-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
    .ov-head { display: flex; align-items: center; justify-content: space-between; font-size: 15px; font-weight: 600; }
    .close { width: 30px; height: 30px; border-radius: 50%; border: none; padding: 0; display: grid; place-items: center; cursor: pointer; background: none; color: var(--secondary-text-color); }
    .close ha-icon { --mdc-icon-size: 20px; }
    .grid { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 8px; }
    .tile { position: relative; aspect-ratio: 16 / 10; border: none; padding: 0; border-radius: 12px; overflow: hidden; cursor: pointer; background: #1b1b1b; isolation: isolate;
      transition: transform 0.2s, box-shadow 0.3s; }
    .tile:active { transform: scale(0.97); }
    .tile img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .tile.sel { box-shadow: 0 0 0 2.5px var(--primary-color); }
    .tile.motion { box-shadow: 0 0 0 2.5px #e53935; animation: tile-alert 1.6s ease-in-out infinite; }
    @keyframes tile-alert { 50% { box-shadow: 0 0 0 4px rgba(229,57,53,0.35); } }
    .t-empty { position: absolute; inset: 0; display: grid; place-items: center; color: rgba(255,255,255,0.45); }
    .t-empty ha-icon { --mdc-icon-size: 30px; }
    .t-shade { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.65)); }
    .t-name { position: absolute; left: 8px; right: 8px; bottom: 6px; color: #fff; font-size: 13px; font-weight: 700; text-align: left; text-shadow: 0 1px 4px rgba(0,0,0,0.6);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .t-icons { position: absolute; top: 6px; right: 6px; display: flex; gap: 4px; }
    .t-det, .t-warn, .t-off { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: var(--dc, rgba(0,0,0,0.5)); }
    .t-warn { background: #e53935; }
    .t-off { background: rgba(0,0,0,0.5); color: rgba(255,255,255,0.8); }
    .t-det ha-icon, .t-warn ha-icon, .t-off ha-icon { --mdc-icon-size: 15px; }
    .switches { display: flex; flex-direction: column; gap: 6px; }
    .sw-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--secondary-text-color); }
    .sw-title ha-icon { --mdc-icon-size: 16px; }
    .sw-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .sw-chip { display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px 6px 8px; border: none; border-radius: 999px; cursor: pointer; font-size: 12.5px; font-weight: 600;
      color: var(--secondary-text-color); background: rgba(127,127,127,0.1); transition: background 0.3s, color 0.3s; }
    .sw-chip ha-icon { --mdc-icon-size: 16px; }
    .sw-chip.on { color: var(--success-color, #43a047); background: color-mix(in srgb, var(--success-color, #43a047) 14%, transparent); }
    .health { border-radius: var(--hcc-inner-radius, 14px); background: rgba(127,127,127,0.07); overflow: hidden; }
    .sec-head { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border: none; background: none; cursor: pointer; text-align: left; }
    .sec-head > ha-icon:first-child { --mdc-icon-size: 20px; color: #ec407a; }
    .sec-head span:not(.count) { flex: 1; font-size: 14px; font-weight: 600; }
    .count { min-width: 20px; height: 20px; padding: 0 6px; box-sizing: border-box; border-radius: 10px; display: grid; place-items: center; font-size: 12px; font-weight: 700; color: #fff; background: #fb8c00; }
    .ok-mark { --mdc-icon-size: 18px; color: var(--success-color, #43a047); }
    .chev { --mdc-icon-size: 20px; color: var(--secondary-text-color); transition: transform 0.3s; }
    .chev.up { transform: rotate(180deg); }
    .h-rows { display: flex; flex-direction: column; gap: 6px; padding: 0 12px 12px; }
    .h-row { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
    .h-name { flex: 1 1 90px; font-size: 13.5px; font-weight: 600; min-width: 0; }
    .h-chip { display: inline-flex; align-items: center; gap: 3px; padding: 3px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; background: var(--card-background-color, #fff); }
    .h-chip ha-icon { --mdc-icon-size: 14px; color: var(--secondary-text-color); }
    .h-chip.very_good ha-icon, .h-chip.good ha-icon { color: var(--success-color, #43a047); }
    .h-chip.fair ha-icon { color: #fb8c00; }
    .h-chip.weak { color: #e53935; }
    .h-chip.weak ha-icon { color: #e53935; }
    ha-card.anim-reduced .tile.motion, ha-card.anim-off .tile.motion, ha-card.anim-reduced .h-icon.alert, ha-card.anim-off .h-icon.alert { animation: none; }
  `];
}
