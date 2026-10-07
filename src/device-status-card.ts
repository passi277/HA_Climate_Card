import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { DeviceStatusCardConfig, HomeAssistant } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { relTime } from "./components/camera-view";
import { offlineDevices, platformName, type OfflineDevice } from "./utils";
import "./device-status-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-device-status-card",
  name: "Modern Device Status Card",
  description: "Gerätestatus: alle nicht erreichbaren Geräte, gruppiert nach Gerät und Integration, mit „seit …“, Filter nach Integration, betroffenen Entitäten und „Neu laden“ (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const DOMAIN_ICON: Record<string, string> = {
  light: "mdi:lightbulb-off-outline", switch: "mdi:toggle-switch-off-outline", sensor: "mdi:eye-off-outline", binary_sensor: "mdi:eye-off-outline",
  cover: "mdi:window-shutter-alert", media_player: "mdi:television-off", climate: "mdi:thermostat", button: "mdi:gesture-tap-button", camera: "mdi:cctv-off",
  lock: "mdi:lock-alert-outline", vacuum: "mdi:robot-vacuum-alert", device_tracker: "mdi:cellphone-off", fan: "mdi:fan-off",
};

@customElement("ha-device-status-card")
export class HaDeviceStatusCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: DeviceStatusCardConfig;
  @state() private _filter?: string;
  @state() private _open?: string;
  @state() private _all = false;
  @state() private _reloading?: string;
  private _cache?: { key: unknown; list: OfflineDevice[]; total: number };

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-device-status-card-editor");
  }

  public static getStubConfig(): Partial<DeviceStatusCardConfig> {
    return {};
  }

  public setConfig(config: DeviceStatusCardConfig): void {
    this._config = { ...(config ?? { type: "custom:ha-device-status-card" }) };
    this._cache = undefined;
  }

  public getCardSize(): number {
    return 4;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  private _t(key: string): string {
    return localize(this.hass, `device_status.${key}`);
  }

  /** Nur neu berechnen, wenn sich ein Zustand „verfügbar ↔ nicht verfügbar“ ändert */
  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old) return true;
    if (old.entities !== this.hass!.entities || old.locale !== this.hass!.locale) return true;
    const bad = (s?: string) => s === "unavailable" || (!!this._config?.include_unknown && s === "unknown");
    const now = this.hass!.states;
    if (Object.keys(now).length !== Object.keys(old.states).length) return true;
    for (const id in now) if (old.states[id] !== now[id] && bad(old.states[id]?.state) !== bad(now[id]!.state)) return true;
    return false;
  }

  private _list(): { list: OfflineDevice[]; total: number } {
    const hass = this.hass!;
    if (this._cache?.key === hass.states) return this._cache;
    const c = this._config!;
    const list = offlineDevices(hass.states, hass.entities, hass.devices, {
      excludeDomains: c.exclude_domains, excludeIntegrations: c.exclude_integrations, exclude: c.exclude, includeUnknown: c.include_unknown,
    });
    const total = hass.devices ? Object.keys(hass.devices).length : new Set(Object.values(hass.entities ?? {}).map((e) => e.device_id).filter(Boolean)).size;
    this._cache = { key: hass.states, list, total };
    return this._cache;
  }

  private _moreInfo(id: string): void {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  private _openDevice(d: OfflineDevice): void {
    if (d.id === d.entities[0]) return this._moreInfo(d.id);
    history.pushState(null, "", `/config/devices/device/${d.id}`);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  /** Integration des Geräts neu laden (homeassistant.reload_config_entry über eine Entität) */
  private async _reload(d: OfflineDevice): Promise<void> {
    if (this._reloading) return;
    window.dispatchEvent(new CustomEvent("haptic", { detail: "medium" }));
    this._reloading = d.id;
    try {
      await this.hass!.callService("homeassistant", "reload_config_entry", { entity_id: d.entities[0] });
    } catch (err: any) {
      this.dispatchEvent(new CustomEvent("hass-notification", {
        detail: { message: `${localize(this.hass, "card.error")}: ${err?.message ?? err}` }, bubbles: true, composed: true,
      }));
    }
    window.setTimeout(() => { this._reloading = undefined; }, 1500);
  }

  private _renderDevice(d: OfflineDevice) {
    const lang = getLanguage(this.hass);
    const open = this._open === d.id;
    return html`<div class="dev ${open ? "open" : ""}" data-dev=${d.id}>
      <button class="d-main" @click=${() => { this._open = open ? undefined : d.id; }} aria-expanded=${open}>
        <span class="d-ic"><ha-icon .icon=${DOMAIN_ICON[d.domain] ?? "mdi:power-plug-off-outline"}></ha-icon></span>
        <span class="d-text"><b>${d.name}</b>
          <small><span class="int">${platformName(d.integration)}</span> · ${this._t("since")} ${relTime(d.since, lang).replace(/^vor /, "")}${d.entities.length > 1 ? ` · ${this._t("n_entities").replace("{n}", String(d.entities.length))}` : ""}</small></span>
        <ha-icon class="chev" icon="mdi:chevron-down"></ha-icon>
      </button>
      ${open ? html`<div class="d-body">
        ${d.entities.map((id) => html`<button class="ent" @click=${() => this._moreInfo(id)}>
          <ha-icon .icon=${DOMAIN_ICON[id.split(".")[0]!] ?? "mdi:circle-small"}></ha-icon>
          <span>${String(this.hass!.states[id]?.attributes.friendly_name ?? id)}</span><small>${id}</small></button>`)}
        <div class="d-actions">
          ${d.id !== d.entities[0] ? html`<button class="act" @click=${() => this._openDevice(d)}><ha-icon icon="mdi:devices"></ha-icon>${this._t("open_device")}</button>` : nothing}
          <button class="act ${this._reloading === d.id ? "busy" : ""}" @click=${() => this._reload(d)}>
            <ha-icon class=${this._reloading === d.id ? "spin" : ""} .icon=${this._reloading === d.id ? "mdi:loading" : "mdi:reload"}></ha-icon>${this._t("reload")}</button>
        </div>
      </div>` : nothing}
    </div>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const { list, total } = this._list();
    const counts = new Map<string, number>();
    for (const d of list) counts.set(d.integration, (counts.get(d.integration) ?? 0) + 1);
    const filter = this._filter && counts.has(this._filter) ? this._filter : undefined;
    const shownAll = filter ? list.filter((d) => d.integration === filter) : list;
    const max = c.max_items ?? 8;
    const shown = this._all ? shownAll : shownAll.slice(0, max);
    const ok = !list.length;
    const color = ok ? "var(--success-color, #43a047)" : list.length > 5 ? "var(--error-color, #e53935)" : "#fb8c00";
    return html`<ha-card class="devs anim-${c.animations ?? "full"} ${ok ? "ok" : ""}" style="--hcc-accent-c:${color}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <span class="h-icon"><ha-icon .icon=${ok ? "mdi:check-network-outline" : "mdi:lan-disconnect"}></ha-icon></span>
        <span class="head-text"><span class="h-title">${c.name ?? this._t("title")}</span>
          <span class="h-sub">${ok ? this._t("all_ok") : this._t(list.length === 1 ? "one_offline" : "n_offline").replace("{n}", String(list.length))}</span></span>
        ${total ? html`<span class="badge" title=${this._t("devices_total")}><b>${Math.max(0, total - list.length)}</b>/${total}</span>` : nothing}
      </div>
      ${ok ? html`<div class="all-ok"><ha-icon icon="mdi:check-decagram"></ha-icon><span>${this._t("all_ok_hint").replace("{n}", String(total))}</span></div>` : html`
        ${counts.size > 1 ? html`<div class="chips">
          <button class="chip ${!filter ? "sel" : ""}" @click=${() => { this._filter = undefined; }}>${this._t("all")}<small>${list.length}</small></button>
          ${[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([p, n]) => html`<button class="chip ${filter === p ? "sel" : ""}" data-int=${p}
            @click=${() => { this._filter = filter === p ? undefined : p; }}>${platformName(p)}<small>${n}</small></button>`)}
        </div>` : nothing}
        <div class="list">${shown.map((d) => this._renderDevice(d))}</div>
        ${shownAll.length > max ? html`<button class="more" @click=${() => { this._all = !this._all; }}>
          <ha-icon .icon=${this._all ? "mdi:chevron-up" : "mdi:chevron-down"}></ha-icon>${this._all ? this._t("less") : this._t("show_all").replace("{n}", String(shownAll.length))}</button>` : nothing}`}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.devs { --accent: var(--hcc-accent-c); gap: 12px; container-type: inline-size; }
    ha-card.devs.ok .blob { opacity: 0.5; animation-play-state: paused; }
    .header { display: flex; align-items: center; gap: 10px; }
    .h-icon { flex: none; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; color: var(--accent);
      background: color-mix(in srgb, var(--accent) 16%, transparent); }
    .h-icon ha-icon { --mdc-icon-size: 24px; }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .h-title { font-size: 17px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .h-sub { font-size: 13px; font-weight: 600; color: var(--accent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .badge { flex: none; padding: 5px 10px; border-radius: 999px; font-size: 12.5px; color: var(--secondary-text-color); background: rgba(127,127,127,0.1); }
    .badge b { color: var(--primary-text-color); }
    .all-ok { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: var(--hcc-inner-radius, 14px); font-size: 13.5px; font-weight: 600;
      background: color-mix(in srgb, var(--success-color, #43a047) 10%, transparent); }
    .all-ok ha-icon { --mdc-icon-size: 26px; color: var(--success-color, #43a047); }

    .chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
    .chips::-webkit-scrollbar { display: none; }
    .chip { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border: none; border-radius: 999px; cursor: pointer; font-size: 12.5px; font-weight: 600;
      background: rgba(127,127,127,0.1); }
    .chip small { font-weight: 800; color: var(--secondary-text-color); }
    .chip.sel { color: #fff; background: var(--accent); }
    .chip.sel small { color: #fff; }

    .list { display: flex; flex-direction: column; gap: 6px; }
    .dev { border-radius: 12px; background: rgba(127,127,127,0.07); overflow: hidden; }
    .d-main { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border: none; background: none; cursor: pointer; text-align: left; }
    .d-ic { flex: none; width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; color: var(--accent);
      background: color-mix(in srgb, var(--accent) 12%, transparent); }
    .d-ic ha-icon { --mdc-icon-size: 20px; }
    .d-text { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .d-text b { font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .d-text small { font-size: 11.5px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .int { font-weight: 700; }
    .chev { --mdc-icon-size: 20px; color: var(--secondary-text-color); transition: transform 0.3s var(--ease-out); flex: none; }
    .dev.open .chev { transform: rotate(180deg); }
    .d-body { display: flex; flex-direction: column; gap: 2px; padding: 0 10px 10px 54px; animation: fade-in 0.25s var(--ease-out) both; }
    @keyframes fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
    .ent { display: grid; grid-template-columns: 18px minmax(0, 1fr); column-gap: 8px; align-items: center; padding: 4px 0; border: none; background: none; cursor: pointer; text-align: left; }
    .ent ha-icon { --mdc-icon-size: 16px; color: var(--secondary-text-color); grid-row: span 2; }
    .ent span { font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ent small { font-size: 10.5px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .d-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
    .act { display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; border: none; border-radius: 999px; cursor: pointer; font-size: 12px; font-weight: 700;
      background: rgba(127,127,127,0.14); }
    .act ha-icon { --mdc-icon-size: 16px; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .more { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; border: none; border-radius: 12px; cursor: pointer;
      font-size: 13px; font-weight: 600; background: rgba(127,127,127,0.06); color: var(--secondary-text-color); }
    .more ha-icon { --mdc-icon-size: 18px; }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-device-status-card": HaDeviceStatusCard;
  }
}
