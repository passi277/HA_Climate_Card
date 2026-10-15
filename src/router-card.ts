import { LitElement, css, html, nothing, svg, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant, RouterCardConfig } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { relTime } from "./components/camera-view";
import { clientIcon, formatKbit, formatUptime, routerClients, routerFeatures, UNAVAILABLE, type RouterClient, type RouterFeatures } from "./utils";
import "./router-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-router-card",
  name: "Modern Router Card",
  description: "Router (FRITZ!Box, TP-Link …): Online-Status, Durchsatz, Leitung, CPU/RAM, WLAN an/aus mit Gast-QR, Geräte im Netz, Neu verbinden, Neustart und Firmware-Update – automatisch über das Gerät erkannt (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const num = (st?: HassEntity): number | undefined => {
  if (!st || UNAVAILABLE.includes(st.state)) return undefined;
  const n = Number(st.state);
  return Number.isFinite(n) ? n : undefined;
};

@customElement("ha-router-card")
export class HaRouterCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: RouterCardConfig;
  @state() private _line = false;
  @state() private _all = false;
  @state() private _query = "";
  @state() private _confirm?: string;
  @state() private _qr = false;
  private _confirmTimer?: number;
  private _cache?: { key: unknown; f: RouterFeatures };

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-router-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<RouterCardConfig> {
    const f = routerFeatures(hass.states, hass.entities);
    return { entity: f.online ?? f.clients_total ?? f.external_ip ?? "" };
  }

  public setConfig(config: RouterCardConfig): void {
    this._config = { ...(config ?? { type: "custom:ha-router-card" }) };
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
    return localize(this.hass, `router.${key}`);
  }

  private _f(): RouterFeatures {
    const hass = this.hass!;
    if (this._cache && this._cache.key === hass.entities) return this._cache.f;
    const f = routerFeatures(hass.states, hass.entities, this._config?.entity || undefined);
    this._cache = { key: hass.entities, f };
    return f;
  }

  private _ids(f: RouterFeatures): string[] {
    return [...Object.values(f).filter((v): v is string => typeof v === "string" && v.includes(".")), ...(f.wifi ?? []).map((w) => w.entity)];
  }

  /** Router-Werte oder (bei Clients) eine geänderte device_tracker-Liste lösen ein Neuzeichnen aus */
  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || old.locale !== this.hass!.locale || old.entities !== this.hass!.entities) return true;
    const f = this._f();
    if (this._ids(f).some((id) => old.states[id] !== this.hass!.states[id])) return true;
    if (this._config?.clients === false) return false;
    for (const id in this.hass!.states) {
      if (id.startsWith("device_tracker.") && old.states[id] !== this.hass!.states[id] && this.hass!.entities?.[id]?.platform === f.platform) return true;
    }
    return false;
  }

  private _haptic(kind = "light"): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: kind }));
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

  private async _copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.dispatchEvent(new CustomEvent("hass-notification", { detail: { message: this._t("copied") }, bubbles: true, composed: true }));
    } catch { /* keine Zwischenablage */ }
  }

  private _toggleWifi(id: string, guest: boolean): void {
    const st = this.hass!.states[id];
    // Haupt-WLAN ausschalten nur mit Bestätigung – sonst sperrt man sich ggf. selbst aus
    if (st?.state === "on" && !guest && !this._confirmed(id)) return;
    this._haptic();
    this._call("switch", st?.state === "on" ? "turn_off" : "turn_on", { entity_id: id });
  }

  private _ring(pct: number, color: string) {
    const r = 15, c = 2 * Math.PI * r;
    return svg`<svg viewBox="0 0 36 36" class="ring"><circle cx="18" cy="18" r=${r} class="track"></circle>
      <circle cx="18" cy="18" r=${r} class="val" style="stroke:${color};stroke-dasharray:${(Math.min(100, pct) / 100) * c} ${c}"></circle></svg>`;
  }

  private _renderClient(c: RouterClient) {
    const lang = getLanguage(this.hass);
    const meta = [c.ip, c.wired === true ? "LAN" : c.wired === false ? (c.band ? `WLAN ${c.band}` : "WLAN") : undefined,
      c.connectedTo && !/fritz\.box|^router$|tplink/i.test(c.connectedTo) ? this._t("via").replace("{ap}", c.connectedTo) : undefined].filter(Boolean).join(" · ");
    return html`<button class="client ${c.online ? "" : "off"}" data-client=${c.entity} @click=${() => this._moreInfo(c.entity)}>
      <span class="c-ic"><ha-icon .icon=${clientIcon(c.name, c.wired)}></ha-icon></span>
      <span class="c-text"><b>${c.name}</b><small>${c.online ? meta : `${this._t("last_seen")} ${c.lastSeen ? relTime(c.lastSeen, lang) : "–"}`}</small></span>
      <span class="dot ${c.online ? "on" : ""}"></span>
    </button>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const s = this.hass.states;
    const f = this._f();
    const lang = getLanguage(this.hass);
    if (!f.device) return html`<ha-card class="router"><div class="empty">${this._t("not_found")}</div></ha-card>`;
    const onSt = f.online ? s[f.online] : f.wan_switch ? s[f.wan_switch] : undefined;
    const online = onSt ? onSt.state === "on" : true;
    const dev = this.hass.devices?.[f.device];
    const name = c.name ?? (dev?.name_by_user || dev?.name || this._t("title"));
    const uptimeSt = f.uptime ? s[f.uptime] : undefined;
    const upSec = uptimeSt && !UNAVAILABLE.includes(uptimeSt.state) ? (Date.now() - Date.parse(uptimeSt.state)) / 1000 : undefined;
    const clients = c.clients === false ? [] : routerClients(s, this.hass.entities, f.platform, f.device);
    const onlineClients = clients.filter((x) => x.online);
    const total = num(f.clients_total ? s[f.clients_total] : undefined) ?? (clients.length ? onlineClients.length : undefined);
    const upd = f.update ? s[f.update] : undefined;
    const hasUpdate = upd?.state === "on";
    const sub = [online ? (upSec != null && upSec > 0 ? this._t("online_since").replace("{t}", formatUptime(upSec, lang.startsWith("de") ? "T" : "d")) : this._t("online")) : this._t("offline"),
      total != null ? this._t("n_devices").replace("{n}", String(total)) : ""].filter(Boolean).join(" · ");
    const accent = !online ? "#e53935" : hasUpdate ? "#fb8c00" : "#43a047";
    // Live-Werte
    const down = num(f.down_rate ? s[f.down_rate] : undefined), up = num(f.up_rate ? s[f.up_rate] : undefined);
    const linkDown = num(f.link_down ? s[f.link_down] : undefined), linkUp = num(f.link_up ? s[f.link_up] : undefined);
    const cpu = num(f.cpu ? s[f.cpu] : undefined), mem = num(f.memory ? s[f.memory] : undefined);
    const wifiN = num(f.clients_wifi ? s[f.clients_wifi] : undefined) ?? (clients.length ? onlineClients.filter((x) => x.wired === false).length : undefined);
    const wiredN = num(f.clients_wired ? s[f.clients_wired] : undefined) ?? (clients.length ? onlineClients.filter((x) => x.wired === true).length : undefined);
    const guestN = num(f.clients_guest ? s[f.clients_guest] : undefined);
    // Durchsatz kommt in kB/s – ab 125 kB/s (1 Mbit/s) als Mbit/s
    const rate = (v: number) => {
      const [n, ...u] = (v >= 125 ? formatKbit(v * 8, lang) : `${v.toLocaleString(lang, { maximumFractionDigits: v < 10 ? 1 : 0 })} kB/s`).split(" ");
      return html`${n}<small> ${u.join(" ")}</small>`;
    };
    const extIp = f.external_ip ? s[f.external_ip]?.state : undefined;
    const extIp6 = f.external_ipv6 ? s[f.external_ipv6]?.state : undefined;
    const lanIp = f.lan_ip ? s[f.lan_ip]?.state : undefined;
    const lineRows: [string, string, string?][] = [];
    const add = (label: string, id: string | undefined, fmt: (v: number) => string) => { const v = num(id ? s[id] : undefined); if (v != null) lineRows.push([label, fmt(v), id]); };
    add(this._t("link_down"), f.link_down, (v) => formatKbit(v, lang));
    add(this._t("link_up"), f.link_up, (v) => formatKbit(v, lang));
    add(this._t("max_down"), f.max_down, (v) => formatKbit(v, lang));
    add(this._t("max_up"), f.max_up, (v) => formatKbit(v, lang));
    add(this._t("attenuation"), f.attenuation_down, (v) => `${v} / ${num(f.attenuation_up ? s[f.attenuation_up] : undefined) ?? "–"} dB`);
    add(this._t("noise"), f.noise_down, (v) => `${v} / ${num(f.noise_up ? s[f.noise_up] : undefined) ?? "–"} dB`);
    add(this._t("received"), f.gb_received, (v) => `${v.toLocaleString(lang)} GB`);
    add(this._t("sent"), f.gb_sent, (v) => `${v.toLocaleString(lang)} GB`);
    const q = this._query.trim().toLowerCase();
    const filtered = q ? clients.filter((x) => `${x.name} ${x.ip ?? ""} ${x.mac ?? ""}`.toLowerCase().includes(q)) : clients;
    const max = c.max_clients ?? 8;
    const shown = this._all || q ? filtered : filtered.slice(0, max);
    const wifi = c.show_wifi === false ? [] : f.wifi;
    const qr = f.guest_qr ? s[f.guest_qr] : undefined;
    const qrUrl = qr?.attributes.entity_picture as string | undefined;
    return html`<ha-card class="router anim-${c.animations ?? "full"} ${online ? "" : "down"}" style="--hcc-accent-c:${accent}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <button class="h-icon ${online ? "pulse" : ""}" @click=${() => this._moreInfo(f.online ?? f.wan_switch)}>
          <ha-icon .icon=${online ? "mdi:router-wireless" : "mdi:router-wireless-off"}></ha-icon></button>
        <span class="head-text"><span class="h-title">${name}</span><span class="h-sub">${sub}</span></span>
        ${hasUpdate ? html`<button class="chip upd ${this._confirm === f.update ? "confirm" : ""}" data-act="update"
          @click=${() => { if (this._confirmed(f.update!)) this._call("update", "install", { entity_id: f.update }); }}>
          <ha-icon icon="mdi:package-up"></ha-icon>${this._confirm === f.update ? this._t("sure") : `${this._t("update")} ${upd?.attributes.latest_version ?? ""}`}</button>` : nothing}
      </div>

      <div class="tiles">
        ${down != null ? html`<div class="tile" @click=${() => this._moreInfo(f.down_rate)}>
          <ha-icon icon="mdi:download" style="color:#1e88e5"></ha-icon><span class="t-v">${rate(down)}</span><span class="t-l">${this._t("download")}</span>
          ${linkDown ? html`<span class="bar"><i style="width:${Math.min(100, ((down * 8) / linkDown) * 100)}%;background:#1e88e5"></i></span>` : nothing}</div>` : nothing}
        ${up != null ? html`<div class="tile" @click=${() => this._moreInfo(f.up_rate)}>
          <ha-icon icon="mdi:upload" style="color:#43a047"></ha-icon><span class="t-v">${rate(up)}</span><span class="t-l">${this._t("upload")}</span>
          ${linkUp ? html`<span class="bar"><i style="width:${Math.min(100, ((up * 8) / linkUp) * 100)}%;background:#43a047"></i></span>` : nothing}</div>` : nothing}
        ${cpu != null ? html`<div class="tile ringed" @click=${() => this._moreInfo(f.cpu)}>${this._ring(cpu, cpu > 80 ? "#e53935" : "#7e57c2")}
          <span class="t-v">${Math.round(cpu)} %</span><span class="t-l">CPU</span></div>` : nothing}
        ${mem != null ? html`<div class="tile ringed" @click=${() => this._moreInfo(f.memory)}>${this._ring(mem, mem > 85 ? "#e53935" : "#00897b")}
          <span class="t-v">${Math.round(mem)} %</span><span class="t-l">RAM</span></div>` : nothing}
        ${total != null ? html`<div class="tile" @click=${() => this._moreInfo(f.clients_total)}>
          <ha-icon icon="mdi:devices" style="color:#fb8c00"></ha-icon><span class="t-v">${total}</span><span class="t-l">${this._t("devices")}</span>
          <span class="t-split">${[wifiN != null ? html`<span><ha-icon icon="mdi:wifi"></ha-icon>${wifiN}</span>` : "", wiredN != null ? html`<span><ha-icon icon="mdi:lan"></ha-icon>${wiredN}</span>` : "",
            guestN ? html`<span><ha-icon icon="mdi:account-multiple"></ha-icon>${guestN}</span>` : ""]}</span></div>` : nothing}
      </div>

      ${extIp || extIp6 || lanIp || lineRows.length ? html`<div class="line ${this._line ? "open" : ""}">
        <button class="l-head" @click=${() => { this._line = !this._line; }} aria-expanded=${this._line}>
          <ha-icon icon="mdi:web"></ha-icon>
          <span>${extIp && extIp !== "unknown" ? html`${this._t("external_ip")} <b>${extIp}</b>` : lanIp ? html`LAN <b>${lanIp}</b>` : this._t("line")}</span>
          <ha-icon class="chev" icon="mdi:chevron-down"></ha-icon></button>
        ${this._line ? html`<div class="l-body">
          ${extIp && extIp !== "unknown" ? html`<button class="row" @click=${() => this._copy(extIp)}><span>${this._t("external_ip")}</span><b>${extIp}</b></button>` : nothing}
          ${extIp6 && !UNAVAILABLE.includes(extIp6) && extIp6 !== "::" ? html`<button class="row" @click=${() => this._copy(extIp6)}><span>IPv6</span><b class="mono">${extIp6}</b></button>` : nothing}
          ${lanIp && !UNAVAILABLE.includes(lanIp) ? html`<button class="row" @click=${() => this._copy(lanIp)}><span>LAN</span><b>${lanIp}</b></button>` : nothing}
          ${lineRows.map(([l, v, id]) => html`<button class="row" @click=${() => this._moreInfo(id)}><span>${l}</span><b>${v}</b></button>`)}
        </div>` : nothing}
      </div>` : nothing}

      ${wifi.length ? html`<div class="wifi">
        ${wifi.map((w) => {
          const on = s[w.entity]?.state === "on";
          const na = !s[w.entity] || UNAVAILABLE.includes(s[w.entity]!.state);
          return html`<button class="w ${on ? "on" : ""} ${w.guest ? "guest" : ""} ${this._confirm === w.entity ? "confirm" : ""}" ?disabled=${na} data-wifi=${w.entity}
            @click=${() => this._toggleWifi(w.entity, w.guest)}>
            <ha-icon .icon=${on ? (w.guest ? "mdi:wifi-star" : "mdi:wifi") : "mdi:wifi-off"}></ha-icon>${this._confirm === w.entity ? this._t("sure") : w.label}</button>`;
        })}
        ${qrUrl ? html`<button class="w qr" @click=${() => { this._qr = !this._qr; }}><ha-icon icon="mdi:qrcode"></ha-icon>${this._t("guest_qr")}</button>` : nothing}
      </div>
      ${this._qr && qrUrl ? html`<div class="qr-box"><img src=${qrUrl} alt=${this._t("guest_qr")}><small>${this._t("qr_hint")}</small></div>` : nothing}` : nothing}

      ${clients.length ? html`<div class="clients">
        <div class="c-head"><b>${this._t("in_network")}</b><small>${this._t("n_online").replace("{n}", String(onlineClients.length)).replace("{total}", String(clients.length))}</small></div>
        ${clients.length > max ? html`<div class="search"><ha-icon icon="mdi:magnify"></ha-icon>
          <input type="search" .value=${this._query} placeholder=${this._t("search")} @input=${(e: Event) => { this._query = (e.target as HTMLInputElement).value; }}></div>` : nothing}
        <div class="c-list">${shown.map((x) => this._renderClient(x))}</div>
        ${!q && filtered.length > max ? html`<button class="more" @click=${() => { this._all = !this._all; }}>
          <ha-icon .icon=${this._all ? "mdi:chevron-up" : "mdi:chevron-down"}></ha-icon>${this._all ? this._t("less") : this._t("show_all").replace("{n}", String(filtered.length))}</button>` : nothing}
      </div>` : nothing}

      ${f.reboot || f.reconnect ? html`<div class="actions">
        ${f.reconnect ? html`<button class="act ${this._confirm === f.reconnect ? "confirm" : ""}" data-act="reconnect"
          @click=${() => { if (this._confirmed(f.reconnect!)) this._call("button", "press", { entity_id: f.reconnect }); }}>
          <ha-icon icon="mdi:connection"></ha-icon>${this._confirm === f.reconnect ? this._t("sure") : this._t("reconnect")}</button>` : nothing}
        ${f.reboot ? html`<button class="act danger ${this._confirm === f.reboot ? "confirm" : ""}" data-act="reboot"
          @click=${() => { if (c.confirm_reboot === false || this._confirmed(f.reboot!)) this._call("button", "press", { entity_id: f.reboot }); }}>
          <ha-icon icon="mdi:restart"></ha-icon>${this._confirm === f.reboot ? this._t("sure") : this._t("reboot")}</button>` : nothing}
      </div>` : nothing}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.router { gap: 12px; container-type: inline-size; }
    .header { display: flex; align-items: center; gap: 10px; }
    .h-icon { position: relative; flex: none; width: 44px; height: 44px; border: none; border-radius: 50%; display: grid; place-items: center; cursor: pointer;
      color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); }
    .h-icon ha-icon { --mdc-icon-size: 24px; }
    .h-icon.pulse::after { content: ""; position: absolute; inset: 0; border-radius: 50%; box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 45%, transparent);
      animation: ring 2.8s ease-out infinite; }
    ha-card.anim-reduced .h-icon::after, ha-card.anim-off .h-icon::after { animation: none; }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .h-title { font-size: 17px; font-weight: 600; line-height: 1.2; }
    .h-sub { font-size: 12.5px; font-weight: 600; color: var(--accent); }
    .chip { flex: none; display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; border: none; border-radius: 999px; cursor: pointer;
      font-size: 12px; font-weight: 700; color: #fff; background: #fb8c00; }
    .chip ha-icon { --mdc-icon-size: 16px; }
    .chip.confirm { background: #e53935; }

    .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(92px, 1fr)); gap: 8px; }
    @container (max-width: 360px) { .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .tile { position: relative; display: flex; flex-direction: column; gap: 2px; padding: 10px; border-radius: 14px; cursor: pointer; background: rgba(127,127,127,0.07); min-width: 0; }
    .tile > ha-icon { --mdc-icon-size: 20px; }
    .t-v { font-size: 17px; font-weight: 700; white-space: nowrap; }
    .t-v small { font-size: 11px; font-weight: 600; color: var(--secondary-text-color); }
    .t-l { font-size: 11.5px; color: var(--secondary-text-color); }
    .bar { height: 4px; margin-top: 4px; border-radius: 2px; background: rgba(127,127,127,0.15); overflow: hidden; }
    .bar i { display: block; height: 100%; min-width: 2px; border-radius: 2px; transition: width 0.6s var(--ease-out); }
    .tile.ringed { padding-left: 46px; justify-content: center; min-height: 44px; }
    .ring { position: absolute; left: 8px; top: 50%; width: 32px; height: 32px; transform: translateY(-50%) rotate(-90deg); }
    .ring circle { fill: none; stroke-width: 4; }
    .ring .track { stroke: rgba(127,127,127,0.18); }
    .ring .val { stroke-linecap: round; transition: stroke-dasharray 0.6s var(--ease-out); }
    .t-split { display: flex; gap: 8px; margin-top: 2px; font-size: 11.5px; font-weight: 700; color: var(--secondary-text-color); }
    .t-split span { display: inline-flex; align-items: center; gap: 2px; }
    .t-split ha-icon { --mdc-icon-size: 13px; }

    .line { border-radius: 12px; background: rgba(127,127,127,0.06); overflow: hidden; }
    .l-head { display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 10px; border: none; background: none; cursor: pointer; text-align: left; font-size: 13px; }
    .l-head span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .l-head ha-icon { --mdc-icon-size: 18px; color: var(--secondary-text-color); }
    .chev { transition: transform 0.3s var(--ease-out); }
    .line.open .chev { transform: rotate(180deg); }
    .l-body { display: flex; flex-direction: column; padding: 0 10px 8px; animation: fade-in 0.25s var(--ease-out) both; }
    @keyframes fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
    .row { display: flex; justify-content: space-between; gap: 10px; padding: 6px 0; border: none; border-top: 1px solid rgba(127,127,127,0.12); background: none; cursor: pointer;
      font-size: 12.5px; text-align: left; }
    .row span { color: var(--secondary-text-color); }
    .row b { text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mono { font-family: ui-monospace, monospace; font-size: 11px; }

    .wifi { display: flex; flex-wrap: wrap; gap: 6px; }
    .w { display: inline-flex; align-items: center; gap: 6px; padding: 7px 11px; border: none; border-radius: 999px; cursor: pointer; font-size: 12.5px; font-weight: 700;
      color: var(--secondary-text-color); background: rgba(127,127,127,0.1); transition: background 0.3s, color 0.3s; }
    .w ha-icon { --mdc-icon-size: 17px; }
    .w.on { color: #fff; background: #1e88e5; }
    .w.on.guest { background: #8e24aa; }
    .w.confirm { color: #fff; background: #e53935; }
    .w:disabled { opacity: 0.4; cursor: default; }
    .w.qr { color: var(--primary-text-color); }
    .qr-box { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px; border-radius: 14px; background: #fff; animation: fade-in 0.25s var(--ease-out) both; }
    .qr-box img { width: min(220px, 70%); image-rendering: pixelated; }
    .qr-box small { color: #555; font-size: 12px; }

    .clients { display: flex; flex-direction: column; gap: 6px; }
    .c-head { display: flex; justify-content: space-between; align-items: baseline; font-size: 13.5px; }
    .c-head small { color: var(--secondary-text-color); font-size: 12px; }
    .search { display: flex; align-items: center; gap: 6px; padding: 0 10px; border-radius: 999px; background: rgba(127,127,127,0.1); }
    .search ha-icon { --mdc-icon-size: 17px; color: var(--secondary-text-color); }
    .search input { flex: 1; min-width: 0; border: none; outline: none; background: none; padding: 8px 0; font: inherit; font-size: 13px; color: var(--primary-text-color); }
    .c-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 6px; }
    .client { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border: none; border-radius: 12px; cursor: pointer; text-align: left; background: rgba(127,127,127,0.07); min-width: 0; }
    .client.off { opacity: 0.55; }
    .c-ic { flex: none; width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
    .c-ic ha-icon { --mdc-icon-size: 17px; }
    .client.off .c-ic { color: var(--secondary-text-color); background: rgba(127,127,127,0.12); }
    .c-text { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .c-text b { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .c-text small { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: rgba(127,127,127,0.4); }
    .dot.on { background: #43a047; box-shadow: 0 0 6px #43a047; }
    .more { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; border: none; border-radius: 12px; cursor: pointer;
      font-size: 13px; font-weight: 600; background: rgba(127,127,127,0.06); color: var(--secondary-text-color); }
    .more ha-icon { --mdc-icon-size: 18px; }

    .actions { display: flex; gap: 8px; }
    .act { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 9px; border: none; border-radius: 12px; cursor: pointer;
      font-size: 13px; font-weight: 700; background: rgba(127,127,127,0.12); }
    .act ha-icon { --mdc-icon-size: 18px; }
    .act.danger { color: #e53935; }
    .act.confirm { color: #fff; background: #e53935; }
    .empty { padding: 16px; text-align: center; color: var(--secondary-text-color); }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-router-card": HaRouterCard;
  }
}
