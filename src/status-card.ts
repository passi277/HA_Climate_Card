import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, StatusCardConfig } from "./types";
import { localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { areaBatteries, batteryInfo, batteryShoppingList, resolveContacts, UNAVAILABLE, type BatteryInfo } from "./utils";
import "./status-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-status-card",
  name: "Modern Status Card",
  description: "Batterien (automatisch je Bereich, Battery Notes) und Tür-/Fensterkontakte auf einen Blick (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const GREEN = "var(--success-color, #43a047)";
const RED = "var(--error-color, #e53935)";
const ORANGE = "var(--warning-color, #fb8c00)";

/** Ampelfarbe für einen Batteriestand. */
const levelColor = (b: BatteryInfo, threshold: number): string =>
  b.low ? RED : b.level != null && b.level < threshold * 2 ? ORANGE : GREEN;

@customElement("ha-status-card")
export class HaStatusCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: StatusCardConfig;
  @state() private _open = false;
  private _cache?: { key: unknown; areas: string; ids: string[] };

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-status-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<StatusCardConfig> {
    return { batteries: Object.values(hass.states).filter((s) => s.attributes.device_class === "battery").slice(0, 4).map((s) => s.entity_id) };
  }

  public setConfig(config: StatusCardConfig): void {
    if (!config) throw new Error("ha-status-card: Konfiguration fehlt");
    const first = !this._config;
    this._config = { ...config };
    if (first) this._open = !!config.expanded;
  }

  public getCardSize(): number {
    return 2;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 4, rows: "auto" };
  }

  private _t(key: string): string {
    return localize(this.hass, key);
  }

  private _batteryIds(): string[] {
    const c = this._config!;
    const hass = this.hass!;
    const manual = c.batteries ?? [];
    if (!c.areas?.length || !hass.entities || !hass.devices) return manual;
    const key = c.areas.join(",");
    if (!this._cache || this._cache.key !== hass.entities || this._cache.areas !== key) {
      this._cache = { key: hass.entities, areas: key, ids: areaBatteries(hass.states, hass.entities, hass.devices, c.areas) };
    }
    return [...new Set([...manual, ...this._cache.ids])];
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this._config) return true;
    const ids = [...this._batteryIds(), ...this._batteryIds().map((id) => id.replace(/^sensor\./, "binary_sensor.") + "_low"),
      ...(this._config.contacts ?? []).map((x) => (typeof x === "string" ? x : x.entity))];
    return ids.some((id) => old.states[id] !== this.hass!.states[id]) || old.locale !== this.hass!.locale;
  }

  private _batteries(): BatteryInfo[] {
    const hass = this.hass!;
    const threshold = this._config!.threshold ?? 20;
    return this._batteryIds()
      .map((id) => hass.states[id])
      .filter((s) => !!s)
      .map((s) => batteryInfo(hass.states, s, threshold, (this._config!.areas ?? []).map((a) => hass.areas?.[a]?.name ?? a.replace(/_/g, " "))))
      .sort((a, b) => Number(b.low) - Number(a.low) || (a.level ?? 101) - (b.level ?? 101) || a.name.localeCompare(b.name));
  }

  /** „gewechselt vor 12 Tagen“ bzw. „gewechselt 03/2025“ */
  private _replaced(d?: Date): string {
    if (!d || this._config?.show_replaced === false) return "";
    const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    if (days <= 0) return this._t("status.replaced_today");
    if (days < 60) return this._t("status.replaced_days").replace("{n}", String(days));
    return this._t("status.replaced_month").replace("{m}", `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`);
  }

  private _renderShopping(batteries: BatteryInfo[]) {
    if (!this._config!.shopping_list) return nothing;
    const items = batteryShoppingList(batteries);
    return html`<div class="shopping">
      <span class="shop-title"><ha-icon icon="mdi:cart-outline"></ha-icon>${this._t("status.shopping_list")}</span>
      ${items.length ? items.map((i) => html`<div class="shop-item">
          <span class="shop-qty">${i.count}× ${i.kind}</span>
          <span class="shop-names">${i.names.join(" · ")}</span>
        </div>`) : html`<span class="shop-empty">${this._t("status.shopping_empty")}</span>`}
    </div>`;
  }

  private _moreInfo(entityId: string): void {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  private _headTap(): void {
    const path = this._config?.navigation_path;
    if (path) {
      window.history.pushState(null, "", path);
      window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
      return;
    }
    this._open = !this._open;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const threshold = c.threshold ?? 20;
    const batteries = this._batteries();
    const low = batteries.filter((b) => b.low);
    const contacts = resolveContacts(this.hass.states, { contact_sensors: c.contacts });
    const ok = !low.length;
    const summary = !batteries.length ? this._t("status.no_batteries")
      : ok ? this._t("status.all_ok")
        : `${this._t("status.low")}: ${low.map((b) => `${b.name}${b.level != null ? ` ${b.level} %` : ""}`).join(" · ")}`;
    return html`<ha-card class="status anim-${c.animations ?? "full"} ${ok ? "ok" : "bad"}" style="--hcc-accent-c:${ok ? GREEN : RED}">
      <div class="glow"><span class="blob b1"></span><span class="blob b2"></span></div>
      ${contacts.map((x) => {
        const st = this.hass!.states[x.entity];
        const unknown = UNAVAILABLE.includes(st?.state ?? "unavailable");
        const icon = x.type === "door" ? (x.open ? "mdi:door-open" : "mdi:door-closed") : (x.open ? "mdi:window-open-variant" : "mdi:window-closed-variant");
        return html`<button class="row contact" style="--rc:${x.open ? ORANGE : unknown ? "var(--state-inactive-color, #8a8a8a)" : GREEN}" @click=${() => this._moreInfo(x.entity)}>
          <span class="row-icon"><ha-icon .icon=${icon}></ha-icon></span>
          <span class="row-text"><span class="row-name">${x.name}</span>
            <span class="row-state">${unknown ? this._t("status.unknown") : this._t(x.open ? "status.open" : "status.closed")}</span></span>
        </button>`;
      })}
      ${batteries.length ? html`
        <button class="row head" aria-expanded=${this._open} @click=${this._headTap}>
          <span class="row-icon"><ha-icon .icon=${ok ? "mdi:battery-check" : "mdi:battery-alert"}></ha-icon></span>
          <span class="row-text"><span class="row-name">${c.title ?? this._t("status.batteries")}</span>
            <span class="row-state multi">${summary}</span></span>
          <ha-icon class="chevron ${this._open ? "open" : ""}" icon=${c.navigation_path ? "mdi:chevron-right" : "mdi:chevron-down"}></ha-icon>
        </button>
        ${c.navigation_path ? html`<button class="list-toggle" aria-expanded=${this._open} @click=${() => { this._open = !this._open; }}>
          ${this._t(this._open ? "status.hide_list" : "status.show_list")} · ${batteries.length}</button>` : nothing}
        <div class="collapsible ${this._open ? "open" : ""}" ?inert=${!this._open}><div class="collapsible-inner"><div class="batteries">
          ${batteries.map((b) => {
            const col = levelColor(b, threshold);
            return html`<button class="battery ${b.low ? "low" : ""}" style="--bc:${col}" @click=${() => this._moreInfo(b.entity)}>
              <span class="b-name"><span>${b.name}</span>${b.type || b.replaced ? html`<small>${[b.type, this._replaced(b.replaced)].filter(Boolean).join(" · ")}</small>` : nothing}</span>
              <span class="b-bar"><span style="width:${b.level ?? (b.low ? 10 : 100)}%"></span></span>
              <span class="b-value">${b.level != null ? `${b.level} %` : this._t(b.low ? "status.low" : "status.ok")}</span>
            </button>`;
          })}
        </div></div></div>` : nothing}
      ${batteries.length ? this._renderShopping(batteries) : nothing}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.status { gap: 8px; padding: 12px; }
    ha-card.status .blob { opacity: 0.3; animation-play-state: paused; }
    .row { display: flex; align-items: center; gap: 12px; width: 100%; padding: 8px; border: none; border-radius: var(--hcc-inner-radius, 14px);
      background: transparent; cursor: pointer; font: inherit; color: inherit; text-align: left; transition: background 0.3s; }
    .row:hover { background: rgba(127,127,127,0.08); }
    .row:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .row-icon { width: 40px; height: 40px; flex: none; border-radius: 50%; display: grid; place-items: center;
      background: color-mix(in srgb, var(--rc, var(--accent)) 18%, transparent); color: var(--rc, var(--accent)); transition: background 0.4s, color 0.4s; }
    .row-icon ha-icon { --mdc-icon-size: 22px; }
    .row-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .row-name { font-size: 15px; font-weight: 600; }
    .row-state { font-size: 13px; color: var(--secondary-text-color); }
    .row-state.multi { white-space: normal; line-height: 1.35; }
    ha-card.bad .head .row-state { color: var(--error-color, #e53935); }
    .chevron { --mdc-icon-size: 20px; color: var(--secondary-text-color); transition: transform 0.3s var(--ease-out); flex: none; }
    .chevron.open:not([icon="mdi:chevron-right"]) { transform: rotate(180deg); }
    .list-toggle { align-self: flex-start; margin: -4px 0 0 60px; border: none; background: none; padding: 2px 0; cursor: pointer; font: inherit;
      font-size: 12px; color: var(--secondary-text-color); text-decoration: underline; text-underline-offset: 3px; }
    ha-card.status .collapsible { margin-top: -8px; }
    ha-card.status .collapsible.open { margin-top: 0; }
    .batteries { display: flex; flex-direction: column; gap: 4px; padding: 2px 4px 4px; }
    .battery { display: grid; grid-template-columns: minmax(0, 1fr) 72px 48px; align-items: center; gap: 10px; padding: 7px 8px; border: none;
      border-radius: 10px; background: rgba(127,127,127,0.07); cursor: pointer; font: inherit; color: inherit; text-align: left; }
    .battery.low { background: color-mix(in srgb, var(--bc) 12%, transparent); }
    .b-name { display: flex; flex-direction: column; min-width: 0; font-size: 13px; line-height: 1.25; }
    .b-name > span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .b-name small { font-size: 11px; color: var(--secondary-text-color); }
    .b-bar { height: 6px; border-radius: 3px; background: rgba(127,127,127,0.2); overflow: hidden; }
    .b-bar span { display: block; height: 100%; border-radius: inherit; background: var(--bc); transition: width 0.6s var(--ease-out); }
    .shopping { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: var(--hcc-inner-radius, 14px);
      background: rgba(127,127,127,0.07); }
    .shop-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
      color: var(--secondary-text-color); }
    .shop-title ha-icon { --mdc-icon-size: 16px; }
    .shop-item { display: flex; flex-direction: column; gap: 1px; }
    .shop-qty { font-size: 15px; font-weight: 700; }
    .shop-names { font-size: 12px; color: var(--secondary-text-color); line-height: 1.35; }
    .shop-empty { font-size: 13px; color: var(--secondary-text-color); }
    .b-value { font-size: 13px; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; color: var(--bc); }
  `];
}
