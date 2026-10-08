import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, NetworkCardConfig } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { relTime } from "./components/camera-view";
import { batteryIcon, netIcon, netIntegration, netSeverity, networkDevices, platformName, UNAVAILABLE, type NetDevice } from "./utils";
import "./network-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-network-card",
  name: "Modern Network Card",
  description: "Funknetz (Zigbee2MQTT, ZHA, Shelly): alle Geräte mit Signal (LQI/WLAN), Akku, zuletzt gesehen, Warnungen und Firmware-Updates – Probleme zuerst, Neustart und Update per Tipp (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const Q_COLOR = { very_good: "#43a047", good: "#7cb342", fair: "#fb8c00", weak: "#e53935" } as const;
const LOW_BATTERY = 20;

@customElement("ha-network-card")
export class HaNetworkCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: NetworkCardConfig;
  @state() private _open?: string;
  @state() private _all = false;
  @state() private _filter: "all" | "attention" = "all";
  @state() private _confirm?: string;
  private _confirmTimer?: number;
  private _cache?: { key: unknown; ids: string[] };

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-network-card-editor");
  }

  public static getStubConfig(): Partial<NetworkCardConfig> {
    return {};
  }

  public setConfig(config: NetworkCardConfig): void {
    this._config = { ...(config ?? { type: "custom:ha-network-card" }) };
    this._cache = undefined;
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this._confirmTimer);
  }

  public getCardSize(): number {
    return 6;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  private _t(key: string): string {
    return localize(this.hass, `network.${key}`);
  }

  private get _integration(): string | undefined {
    const i = this._config?.integration;
    return i && i !== "auto" ? i : netIntegration(this.hass?.entities);
  }

  private _devices(): NetDevice[] {
    const h = this.hass!;
    const integ = this._integration;
    if (!integ) return [];
    return networkDevices(h.states, h.entities, h.devices, integ, h.areas, this._config?.exclude);
  }

  /** Beobachtete Entitäten (alle Entitäten der Geräte + Bridge) – nur bei Registry-Änderungen neu berechnet */
  private _watched(): string[] {
    const h = this.hass!;
    if (this._cache && this._cache.key === h.entities) return this._cache.ids;
    const ids = [...this._devices().flatMap((d) => d.entities), ...this._bridge().ids];
    this._cache = { key: h.entities, ids };
    return ids;
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || old.locale !== this.hass!.locale || old.entities !== this.hass!.entities || old.devices !== this.hass!.devices) return true;
    return this._watched().some((id) => old.states[id] !== this.hass!.states[id]);
  }

  /** Zigbee2MQTT-Bridge: Verbindung, Version, Anlernen */
  private _bridge(): { connected?: string; version?: string; permit?: string; ids: string[] } {
    const h = this.hass!;
    if (this._integration !== "zigbee2mqtt") return { ids: [] };
    const dev = Object.values(h.devices ?? {}).find((d) => d.identifiers?.some(([, x]) => /^zigbee2mqtt_bridge/.test(x)) || d.model === "Bridge");
    const ents = Object.values(h.entities ?? {}).filter((e) => (dev ? e.device_id === dev.id : /^\w+\.zigbee2mqtt_bridge_/.test(e.entity_id)) && h.states[e.entity_id]).map((e) => e.entity_id);
    return {
      connected: ents.find((id) => id.startsWith("binary_sensor.") && /connection_state/.test(id)),
      version: ents.find((id) => id.startsWith("sensor.") && /_version$/.test(id)),
      permit: ents.find((id) => id.startsWith("switch.") && /permit_join/.test(id)),
      ids: ents,
    };
  }

  private _haptic(kind = "light"): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: kind }));
  }

  private async _call(domain: string, service: string, data: Record<string, unknown>): Promise<void> {
    this._haptic("selection");
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
    if (this._config?.confirm === false) return true;
    if (this._confirm === key) { this._confirm = undefined; window.clearTimeout(this._confirmTimer); return true; }
    this._haptic("warning");
    this._confirm = key;
    window.clearTimeout(this._confirmTimer);
    this._confirmTimer = window.setTimeout(() => (this._confirm = undefined), 4000);
    return false;
  }

  private _moreInfo(id?: string): void {
    if (id) this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  private _openDevice(id: string): void {
    history.pushState(null, "", `/config/devices/device/${id}`);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  private _signalIcon(d: NetDevice): string {
    const q = d.quality;
    if (d.signal_unit === "dBm") return q === "very_good" ? "mdi:wifi-strength-4" : q === "good" ? "mdi:wifi-strength-3" : q === "fair" ? "mdi:wifi-strength-2" : "mdi:wifi-strength-1";
    return q === "very_good" || q === "good" ? "mdi:signal-cellular-3" : q === "fair" ? "mdi:signal-cellular-2" : "mdi:signal-cellular-1";
  }

  private _signalText(d: NetDevice): string {
    return d.signal_unit === "lqi" ? `LQI ${Math.round(d.signal!)}` : `${Math.round(d.signal!)} dBm`;
  }

  private _attention(d: NetDevice): boolean {
    return netSeverity(d, LOW_BATTERY) >= 20 || !!d.update;
  }

  private _row(d: NetDevice) {
    const s = this.hass!.states;
    const lang = getLanguage(this.hass);
    const open = this._open === d.id;
    const lowBat = d.battery != null && d.battery <= LOW_BATTERY;
    const status = d.offline ? "#e53935" : d.problems.length ? "#e53935" : d.quality === "weak" || lowBat ? "#fb8c00" : "#43a047";
    const sub = [d.area, d.model].filter(Boolean).join(" · ");
    const ask = (k: string) => this._confirm === k;
    const rows: [string, string, string?][] = [];
    if (d.manufacturer || d.model) rows.push([this._t("model"), [d.manufacturer, d.model].filter(Boolean).join(" ")]);
    if (d.firmware) rows.push([this._t("firmware"), d.firmware.replace(/^\d{8}-\d{6}\//, "")]);
    if (d.signal != null) rows.push([this._t("signal"), `${this._signalText(d)} · ${this._t(`q_${d.quality}`)}`, d.signal_entity]);
    if (d.battery != null) rows.push([this._t("battery"), `${Math.round(d.battery)} %`, d.battery_entity]);
    if (d.temperature != null) rows.push([this._t("temperature"), `${d.temperature.toLocaleString(lang, { maximumFractionDigits: 1 })} °C`]);
    if (d.power != null) rows.push([this._t("power"), `${d.power.toLocaleString(lang, { maximumFractionDigits: 1 })} W`]);
    if (d.uptime_since) rows.push([this._t("online_since"), relTime(new Date(d.uptime_since).toISOString(), lang)]);
    if (d.last_seen) rows.push([this._t("last_seen"), relTime(new Date(d.last_seen).toISOString(), lang)]);
    return html`<div class="dev ${open ? "open" : ""} ${d.offline ? "offline" : ""}" style="--sc:${status}" data-device=${d.id}>
      <button class="d-head" @click=${() => { this._haptic("selection"); this._open = open ? undefined : d.id; }} aria-expanded=${open}>
        <span class="d-icon"><ha-icon .icon=${netIcon(d.name, d.model)}></ha-icon><i class="dot"></i></span>
        <span class="d-text"><span class="d-name">${d.name}</span>
          <span class="d-sub">${d.offline ? html`<b class="bad">${this._t("offline")}</b>` : d.problems.length
            ? html`<b class="bad">${d.problems.map((id) => this._problemName(id)).join(", ")}</b>` : sub}</span></span>
        <span class="d-meta">
          ${d.update ? html`<ha-icon class="upd" icon="mdi:package-up" title=${this._t("update")}></ha-icon>` : nothing}
          ${d.battery != null ? html`<span class="m ${lowBat ? "warn" : ""}"><ha-icon .icon=${batteryIcon(d.battery)}></ha-icon>${Math.round(d.battery)}%</span>` : nothing}
          ${d.signal != null && !d.offline ? html`<span class="m" style="color:${Q_COLOR[d.quality!]}"><ha-icon .icon=${this._signalIcon(d)}></ha-icon>${Math.round(d.signal)}</span>` : nothing}
        </span>
      </button>
      ${open ? html`<div class="d-body">
        ${rows.map(([l, v, id]) => html`<button class="kv" ?disabled=${!id} @click=${() => this._moreInfo(id)}><span>${l}</span><b>${v}</b></button>`)}
        <div class="d-acts">
          ${d.update ? html`<button class="btn upd ${ask(`u:${d.id}`) ? "ask" : ""}" data-act="update"
            @click=${() => { if (this._confirmed(`u:${d.id}`)) this._call("update", "install", { entity_id: d.update }); }}>
            <ha-icon icon="mdi:package-up"></ha-icon>${ask(`u:${d.id}`) ? this._t("sure") : `${this._t("install")} ${s[d.update]?.attributes.latest_version ?? ""}`}</button>` : nothing}
          ${d.reboot ? html`<button class="btn ${ask(`r:${d.id}`) ? "ask" : ""}" data-act="reboot" ?disabled=${UNAVAILABLE.includes(s[d.reboot]?.state ?? "unavailable")}
            @click=${() => { if (this._confirmed(`r:${d.id}`)) this._call("button", "press", { entity_id: d.reboot }); }}>
            <ha-icon icon="mdi:restart"></ha-icon>${ask(`r:${d.id}`) ? this._t("sure") : this._t("reboot")}</button>` : nothing}
          <button class="btn" data-act="device" @click=${() => this._openDevice(d.id)}><ha-icon icon="mdi:open-in-new"></ha-icon>${this._t("open_device")}</button>
        </div>
      </div>` : nothing}
    </div>`;
  }

  private _problemName(id: string): string {
    const k = /overheat|überhitz/i.test(id) ? "overheating" : /overpower|überlast/i.test(id) ? "overpowering" : /overcurrent|überstrom/i.test(id) ? "overcurrent"
      : /overvoltage|überspann/i.test(id) ? "overvoltage" : /restart/i.test(id) ? "restart_required" : undefined;
    return k ? this._t(`p_${k}`) : String(this.hass!.states[id]?.attributes.friendly_name ?? id);
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const s = this.hass.states;
    const integ = this._integration;
    const devices = this._devices().sort((a, b) => netSeverity(b, LOW_BATTERY) - netSeverity(a, LOW_BATTERY) || a.name.localeCompare(b.name));
    const offline = devices.filter((d) => d.offline).length;
    const weak = devices.filter((d) => !d.offline && d.quality === "weak").length;
    const lowBat = devices.filter((d) => d.battery != null && d.battery <= LOW_BATTERY).length;
    const problems = devices.filter((d) => d.problems.length).length;
    const updates = devices.filter((d) => d.update).length;
    const parts = [
      offline ? `${offline} ${this._t("offline")}` : "", problems ? `${problems} ${this._t("warnings")}` : "", weak ? `${weak} ${this._t("weak_signal")}` : "",
      lowBat ? `${lowBat} ${this._t("battery_low")}` : "", updates ? `${updates} ${this._t(updates === 1 ? "update" : "updates")}` : "",
    ].filter(Boolean);
    const b = this._bridge();
    const bridgeDown = b.connected ? s[b.connected]?.state !== "on" : false;
    const accent = offline || problems || bridgeDown ? "#e53935" : weak || lowBat ? "#fb8c00" : "#43a047";
    const sub = bridgeDown ? this._t("bridge_down") : `${devices.length} ${this._t("devices")} · ${parts.length ? parts.join(" · ") : this._t("all_ok")}`;
    const list = this._filter === "attention" ? devices.filter((d) => this._attention(d)) : devices;
    const max = c.max_items ?? 8;
    const shown = this._all ? list : list.slice(0, max);
    const attention = devices.filter((d) => this._attention(d)).length;
    const icon = integ === "shelly" ? "mdi:wifi" : integ === "zigbee2mqtt" || integ === "zha" ? "mdi:zigbee" : "mdi:lan";
    const title = c.title ?? (integ === "zigbee2mqtt" ? "Zigbee" : integ ? platformName(integ) : this._t("title"));
    const version = b.version ? s[b.version]?.state : undefined;
    const permitOn = b.permit ? s[b.permit]?.state === "on" : false;
    return html`<ha-card class="net anim-${(c as any).animations ?? "full"}" style="--hcc-accent-c:${accent}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <span class="h-icon"><ha-icon .icon=${icon}></ha-icon></span>
        <span class="head-text"><span class="h-title">${title}</span><span class="h-sub">${sub}</span></span>
      </div>
      ${b.connected || version || b.permit ? html`<div class="bridge">
        ${b.connected ? html`<button class="inf ${bridgeDown ? "bad" : "ok"}" @click=${() => this._moreInfo(b.connected)}>
          <ha-icon .icon=${bridgeDown ? "mdi:lan-disconnect" : "mdi:lan-connect"}></ha-icon>${this._t(bridgeDown ? "bridge_down" : "bridge_ok")}${version ? ` · ${version}` : ""}</button>` : nothing}
        ${b.permit ? html`<button class="inf ${permitOn ? "on" : ""}" data-act="permit" @click=${() => this._call("switch", permitOn ? "turn_off" : "turn_on", { entity_id: b.permit })}>
          <ha-icon .icon=${permitOn ? "mdi:link-variant-plus" : "mdi:link-variant"}></ha-icon>${this._t(permitOn ? "permit_on" : "permit")}</button>` : nothing}
      </div>` : nothing}
      ${!integ || !devices.length ? html`<div class="empty">${this._t("no_devices")}</div>` : html`
        <div class="filters">
          <button class=${this._filter === "all" ? "on" : ""} data-filter="all" @click=${() => { this._filter = "all"; }}>${this._t("all")} <b>${devices.length}</b></button>
          <button class=${this._filter === "attention" ? "on" : ""} data-filter="attention" @click=${() => { this._filter = "attention"; }}>${this._t("attention")} <b>${attention}</b></button>
        </div>
        <div class="list">${shown.length ? shown.map((d) => this._row(d)) : html`<div class="empty">${this._t("nothing_to_do")}</div>`}</div>
        ${list.length > max ? html`<button class="more" @click=${() => { this._all = !this._all; }}>${this._all ? this._t("less") : `${this._t("show_all")} (${list.length})`}</button>` : nothing}`}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.net { gap: 10px; container-type: inline-size; }
    .header { display: flex; align-items: center; gap: 10px; }
    .h-icon { flex: none; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); }
    .h-icon ha-icon { --mdc-icon-size: 24px; }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .h-title { font-size: 17px; font-weight: 600; line-height: 1.2; }
    .h-sub { font-size: 12.5px; font-weight: 600; color: var(--accent); }
    .bridge { display: flex; flex-wrap: wrap; gap: 6px; }
    .inf { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border: none; border-radius: 999px; cursor: pointer; font-size: 12px; font-weight: 600;
      color: var(--secondary-text-color); background: rgba(127,127,127,0.1); }
    .inf ha-icon { --mdc-icon-size: 15px; }
    .inf.ok ha-icon { color: #43a047; }
    .inf.bad { color: #fff; background: #e53935; }
    .inf.on { color: #fff; background: #fb8c00; }
    .filters { display: inline-flex; align-self: flex-start; padding: 3px; border-radius: 999px; background: rgba(127,127,127,0.12); }
    .filters button { border: none; background: none; padding: 5px 12px; border-radius: 999px; cursor: pointer; font-size: 12px; font-weight: 700; color: var(--secondary-text-color); }
    .filters button.on { background: var(--card-background-color, #fff); color: var(--primary-text-color); box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
    .filters b { margin-left: 2px; opacity: 0.7; }
    .list { display: flex; flex-direction: column; gap: 4px; }
    .dev { border-radius: 14px; background: rgba(127,127,127,0.06); transition: background 0.2s; }
    .dev.open { background: rgba(127,127,127,0.1); }
    .d-head { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border: none; background: none; cursor: pointer; text-align: left; color: inherit; }
    .d-icon { position: relative; flex: none; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: var(--sc); background: color-mix(in srgb, var(--sc) 14%, transparent); }
    .d-icon ha-icon { --mdc-icon-size: 19px; }
    .dot { position: absolute; right: -1px; bottom: -1px; width: 10px; height: 10px; border-radius: 50%; background: var(--sc); box-shadow: 0 0 0 2px var(--card-background-color, #fff); }
    .dev.offline .d-icon { opacity: 0.7; }
    .d-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .d-name { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .d-sub { font-size: 11.5px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .d-sub .bad { color: #e53935; }
    .d-meta { flex: none; display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .m { display: inline-flex; align-items: center; gap: 2px; color: var(--secondary-text-color); }
    .m ha-icon, .d-meta .upd { --mdc-icon-size: 16px; }
    .m.warn { color: #fb8c00; }
    .d-meta .upd { color: #1e88e5; }
    .d-body { display: flex; flex-direction: column; gap: 2px; padding: 0 10px 10px 54px; animation: slide-in 0.25s var(--ease-out) both; }
    .kv { display: flex; justify-content: space-between; gap: 10px; padding: 3px 0; border: none; background: none; cursor: pointer; font-size: 12.5px; color: var(--secondary-text-color); text-align: left; }
    .kv[disabled] { cursor: default; }
    .kv b { color: var(--primary-text-color); font-weight: 600; text-align: right; min-width: 0; overflow-wrap: anywhere; }
    .d-acts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
    .btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 11px; border: none; border-radius: 999px; cursor: pointer; font-size: 12px; font-weight: 700;
      color: var(--primary-text-color); background: rgba(127,127,127,0.14); }
    .btn ha-icon { --mdc-icon-size: 16px; }
    .btn.upd { color: #fff; background: #1e88e5; }
    .btn.ask { color: #fff; background: #e53935; }
    .btn[disabled] { opacity: 0.5; cursor: default; }
    .more { align-self: center; padding: 4px 12px; border: none; border-radius: 999px; background: none; cursor: pointer; font-size: 12.5px; font-weight: 700; color: var(--primary-color); }
    .empty { padding: 10px; text-align: center; font-size: 13px; color: var(--secondary-text-color); }
    ha-card.anim-reduced *, ha-card.anim-off * { animation: none !important; }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-network-card": HaNetworkCard;
  }
}
