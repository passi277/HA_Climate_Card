import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, ParcelCardConfig } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { relTime } from "./components/camera-view";
import { parcelCarrier, parcelStatus, parcelStyle, parcelText, sortParcels, type Parcel, type ParcelKey } from "./utils";
import "./parcel-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-parcel-card",
  name: "Modern Parcel Card",
  description: "Pakete & Post (17TRACK): alle Sendungen mit Status, Versender, letzter Meldung und Ort, Filter, „+ Paket“, Verfolgen und Archivieren (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const FILTERS: ParcelKey[] = ["ready", "problem", "transit", "not_found", "delivered"];

@customElement("ha-parcel-card")
export class HaParcelCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: ParcelCardConfig;
  @state() private _parcels?: Parcel[];
  @state() private _error?: string;
  @state() private _filter?: ParcelKey;
  @state() private _open?: string;
  @state() private _all = false;
  @state() private _adding = false;
  @state() private _busy?: string;
  @state() private _confirm?: string;
  private _entry?: string;
  private _sensorKey?: string;
  private _timer?: number;
  private _confirmTimer?: number;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-parcel-card-editor");
  }

  public static getStubConfig(): Partial<ParcelCardConfig> {
    return {};
  }

  public setConfig(config: ParcelCardConfig): void {
    this._config = { ...(config ?? { type: "custom:ha-parcel-card" }) };
    this._sensorKey = undefined;
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this._timer = window.setInterval(() => this._load(), 15 * 60_000);
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this._timer);
    window.clearTimeout(this._confirmTimer);
  }

  public getCardSize(): number {
    return 4;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  private _t(key: string): string {
    return localize(this.hass, `parcel.${key}`);
  }

  /** Zustände der 17TRACK-Sensoren (Anzahl je Status) – ändern sie sich, gibt es neue Daten */
  private _sensors(): string {
    const hass = this.hass!;
    const ids = Object.keys(hass.states).filter((id) => id.startsWith("sensor.")
      && (hass.entities?.[id]?.platform === "seventeentrack" || id.startsWith("sensor.17track_") || id.startsWith("sensor.seventeentrack_")));
    return ids.map((id) => `${id}=${hass.states[id]!.state}`).join("|");
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    return !old || old.locale !== this.hass!.locale || this._sensorKey !== this._sensors();
  }

  protected updated(): void {
    if (!this.hass) return;
    const key = this._sensors();
    if (key !== this._sensorKey) {
      this._sensorKey = key;
      this._load();
    }
  }

  private async _service(service: string, data: Record<string, unknown> = {}, response = false): Promise<any> {
    if (!this._entry) {
      this._entry = this._config?.config_entry_id;
      if (!this._entry) {
        const entries: any[] = await this.hass!.callWS({ type: "config_entries/get", domain: "seventeentrack" });
        this._entry = entries?.find((e) => e.state === "loaded")?.entry_id ?? entries?.[0]?.entry_id;
      }
      if (!this._entry) throw new Error(this._t("no_integration"));
    }
    const res: any = await (this.hass as any).callService("seventeentrack", service, { config_entry_id: this._entry, ...data }, undefined, false, response);
    return response ? res?.response ?? res : res;
  }

  private async _load(): Promise<void> {
    if (!this.hass) return;
    try {
      const res = await this._service("get_packages", {}, true);
      this._parcels = (res?.packages ?? []) as Parcel[];
      this._error = undefined;
    } catch (err: any) {
      this._error = err?.message ?? String(err);
    }
  }

  private _notify(message: string): void {
    this.dispatchEvent(new CustomEvent("hass-notification", { detail: { message }, bubbles: true, composed: true }));
  }

  private async _add(e: Event): Promise<void> {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const nr = (form.elements.namedItem("nr") as HTMLInputElement).value.replace(/\s+/g, "").trim();
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    if (!nr) return;
    this._busy = "add";
    try {
      await this._service("add_package", { package_tracking_number: nr, package_friendly_name: name || nr });
      window.dispatchEvent(new CustomEvent("haptic", { detail: "success" }));
      this._notify(this._t("added").replace("{name}", name || nr));
      form.reset();
      this._adding = false;
      await this._load();
    } catch (err: any) {
      this._notify(`${localize(this.hass, "card.error")}: ${err?.message ?? err}`);
    }
    this._busy = undefined;
  }

  private async _archive(p: Parcel): Promise<void> {
    const key = `arch:${p.tracking_number}`;
    if (this._confirm !== key) {
      this._confirm = key;
      window.clearTimeout(this._confirmTimer);
      this._confirmTimer = window.setTimeout(() => { this._confirm = undefined; }, 4000);
      window.dispatchEvent(new CustomEvent("haptic", { detail: "light" }));
      return;
    }
    this._confirm = undefined;
    this._busy = key;
    try {
      await this._service("archive_package", { package_tracking_number: p.tracking_number });
      this._parcels = this._parcels?.filter((x) => x.tracking_number !== p.tracking_number);
      this._open = undefined;
    } catch (err: any) {
      this._notify(`${localize(this.hass, "card.error")}: ${err?.message ?? err}`);
    }
    this._busy = undefined;
  }

  private async _copy(nr: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(nr);
      this._notify(this._t("copied"));
    } catch { /* kein Zugriff auf die Zwischenablage */ }
  }

  private _renderParcel(p: Parcel) {
    const lang = getLanguage(this.hass);
    const st = parcelStatus(p.status);
    const carrier = parcelCarrier(p.tracking_number);
    const open = this._open === p.tracking_number;
    const text = parcelText(p.info_text, lang);
    const meta = [carrier, p.location && !/^unknown$/i.test(p.location) ? p.location : "", p.timestamp ? relTime(p.timestamp, lang) : ""].filter(Boolean).join(" · ");
    return html`<div class="pkg ${open ? "open" : ""}" style="--pc:${st.color}" data-nr=${p.tracking_number} data-status=${st.key}>
      <button class="p-main" @click=${() => { this._open = open ? undefined : p.tracking_number; }} aria-expanded=${open}>
        <span class="p-ic"><ha-icon .icon=${st.icon}></ha-icon></span>
        <span class="p-text"><b>${p.friendly_name || p.tracking_number}</b>
          <small class="st">${this._t(`status_${st.key}`)}${text && text !== this._t(`status_${st.key}`) ? html` · <span class="info">${text}</span>` : nothing}</small>
          ${meta ? html`<small>${meta}</small>` : nothing}</span>
        <ha-icon class="chev" icon="mdi:chevron-down"></ha-icon>
      </button>
      ${open ? html`<div class="p-body">
        <button class="nr" @click=${() => this._copy(p.tracking_number)} title=${this._t("copy")}><ha-icon icon="mdi:content-copy"></ha-icon>${p.tracking_number}</button>
        ${p.origin_country && p.origin_country !== "Unknown" ? html`<small class="route">${p.origin_country} → ${p.destination_country ?? "?"}</small>` : nothing}
        ${st.key === "not_found" ? html`<small class="hint">${this._t("not_found_hint")}</small>` : nothing}
        <div class="p-actions">
          <a class="act" href="https://t.17track.net/${lang.startsWith("de") ? "de" : "en"}#nums=${encodeURIComponent(p.tracking_number)}" target="_blank" rel="noopener">
            <ha-icon icon="mdi:open-in-new"></ha-icon>${this._t("track")}</a>
          <button class="act ${this._confirm === `arch:${p.tracking_number}` ? "confirm" : ""}" data-act="archive" ?disabled=${this._busy === `arch:${p.tracking_number}`}
            @click=${() => this._archive(p)}><ha-icon icon="mdi:archive-arrow-down-outline"></ha-icon>
            ${this._confirm === `arch:${p.tracking_number}` ? this._t("confirm") : this._t("archive")}</button>
        </div>
      </div>` : nothing}
    </div>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const list = sortParcels(this._parcels ?? [], c.delivered_days ?? 3);
    const counts = new Map<ParcelKey, number>();
    for (const p of list) { const k = parcelStatus(p.status).key; counts.set(k, (counts.get(k) ?? 0) + 1); }
    const filter = this._filter && counts.has(this._filter) ? this._filter : undefined;
    const shownAll = filter ? list.filter((p) => parcelStatus(p.status).key === filter) : list;
    const max = c.max_items ?? 8;
    const shown = this._all ? shownAll : shownAll.slice(0, max);
    const transit = counts.get("transit") ?? 0, ready = counts.get("ready") ?? 0, problem = counts.get("problem") ?? 0;
    const sub = this._error ? this._error : !this._parcels ? this._t("loading")
      : ready ? this._t("n_ready").replace("{n}", String(ready))
      : problem ? this._t("n_problem").replace("{n}", String(problem))
      : transit ? this._t(transit === 1 ? "one_transit" : "n_transit").replace("{n}", String(transit))
      : list.length ? this._t("nothing_on_way") : this._t("none");
    const accent = ready ? "#8e24aa" : problem ? "#e53935" : transit ? "#1e88e5" : "#795548";
    const busyIcon = transit > 0 && !ready && !problem;
    return html`<ha-card class="parcels anim-${c.animations ?? "full"}" style="--hcc-accent-c:${accent}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <span class="h-icon ${busyIcon ? "drive" : ""}"><ha-icon .icon=${busyIcon ? "mdi:truck-delivery-outline" : "mdi:package-variant-closed"}></ha-icon></span>
        <span class="head-text"><span class="h-title">${c.name ?? this._t("title")}</span><span class="h-sub">${sub}</span></span>
        ${c.show_add !== false ? html`<button class="add-btn ${this._adding ? "on" : ""}" data-act="add" @click=${() => { this._adding = !this._adding; }}
          title=${this._t("add")}><ha-icon .icon=${this._adding ? "mdi:close" : "mdi:plus"}></ha-icon><span class="txt">${this._t("add")}</span></button>` : nothing}
      </div>
      ${this._adding ? html`<form class="add" @submit=${this._add}>
        <input name="nr" required placeholder=${this._t("tracking_number")} autocomplete="off" autocapitalize="characters">
        <input name="name" placeholder=${this._t("name_placeholder")} autocomplete="off">
        <button class="act primary" type="submit" ?disabled=${this._busy === "add"}><ha-icon .icon=${this._busy === "add" ? "mdi:loading" : "mdi:check"}></ha-icon>${this._t("save")}</button>
      </form>` : nothing}
      ${counts.size > 1 ? html`<div class="chips">
        <button class="chip ${!filter ? "sel" : ""}" @click=${() => { this._filter = undefined; }}>${this._t("all")}<small>${list.length}</small></button>
        ${FILTERS.filter((k) => counts.has(k)).map((k) => html`<button class="chip ${filter === k ? "sel" : ""}" data-filter=${k}
          style="--cc:${parcelStyle(k).color}"
          @click=${() => { this._filter = filter === k ? undefined : k; }}>${this._t(`status_${k}`)}<small>${counts.get(k)}</small></button>`)}
      </div>` : nothing}
      ${!this._parcels && !this._error ? html`<div class="graph-placeholder"></div>` : list.length ? html`
        <div class="list">${shown.map((p) => this._renderParcel(p))}</div>
        ${shownAll.length > max ? html`<button class="more" @click=${() => { this._all = !this._all; }}>
          <ha-icon .icon=${this._all ? "mdi:chevron-up" : "mdi:chevron-down"}></ha-icon>${this._all ? this._t("less") : this._t("show_all").replace("{n}", String(shownAll.length))}</button>` : nothing}`
        : this._error ? nothing : html`<div class="empty"><ha-icon icon="mdi:package-variant"></ha-icon>${this._t("empty_hint")}</div>`}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.parcels { gap: 12px; container-type: inline-size; }
    .header { display: flex; align-items: center; gap: 10px; }
    .h-icon { flex: none; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; color: var(--accent);
      background: color-mix(in srgb, var(--accent) 18%, transparent); overflow: hidden; }
    .h-icon ha-icon { --mdc-icon-size: 24px; }
    .h-icon.drive ha-icon { animation: drive 2.4s ease-in-out infinite; }
    @keyframes drive { 0%, 100% { transform: translateX(-2px); } 50% { transform: translateX(3px) translateY(-1px); } }
    ha-card.anim-reduced .h-icon ha-icon, ha-card.anim-off .h-icon ha-icon { animation: none; }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .h-title { font-size: 17px; font-weight: 600; }
    .h-sub { font-size: 13px; font-weight: 600; color: var(--accent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .add-btn { flex: none; display: inline-flex; align-items: center; gap: 5px; padding: 7px 12px; border: none; border-radius: 999px; cursor: pointer;
      font-size: 12.5px; font-weight: 700; background: rgba(127,127,127,0.14); }
    .add-btn.on { color: #fff; background: var(--accent); }
    .add-btn ha-icon { --mdc-icon-size: 17px; }
    @container (max-width: 340px) { .add-btn .txt { display: none; } }
    .add { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) auto; gap: 6px; animation: fade-in 0.25s var(--ease-out) both; }
    @container (max-width: 420px) { .add { grid-template-columns: 1fr 1fr; } .add .act { grid-column: span 2; justify-content: center; } }
    .add input { min-width: 0; padding: 9px 12px; border: none; border-radius: 10px; font: inherit; font-size: 13.5px; color: var(--primary-text-color);
      background: rgba(127,127,127,0.12); outline: none; }
    .add input:focus { box-shadow: inset 0 0 0 1.5px var(--accent); }

    .chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
    .chips::-webkit-scrollbar { display: none; }
    .chip { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border: none; border-radius: 999px; cursor: pointer; font-size: 12.5px; font-weight: 600;
      background: rgba(127,127,127,0.1); }
    .chip small { font-weight: 800; color: var(--cc, var(--secondary-text-color)); }
    .chip.sel { color: #fff; background: var(--cc, var(--accent)); }
    .chip.sel small { color: #fff; }

    .list { display: flex; flex-direction: column; gap: 6px; }
    .pkg { border-radius: 12px; background: rgba(127,127,127,0.07); overflow: hidden; }
    .pkg[data-status="ready"], .pkg[data-status="problem"] { background: color-mix(in srgb, var(--pc) 10%, transparent); }
    .p-main { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border: none; background: none; cursor: pointer; text-align: left; }
    .p-ic { flex: none; width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; color: var(--pc);
      background: color-mix(in srgb, var(--pc) 14%, transparent); }
    .p-ic ha-icon { --mdc-icon-size: 21px; }
    .p-text { flex: 1; display: flex; flex-direction: column; min-width: 0; gap: 1px; }
    .p-text b { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .p-text small { font-size: 11.5px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .p-text small.st { font-weight: 700; color: var(--pc); }
    .p-text .info { font-weight: 500; color: var(--secondary-text-color); }
    .chev { --mdc-icon-size: 20px; color: var(--secondary-text-color); transition: transform 0.3s var(--ease-out); flex: none; }
    .pkg.open .chev { transform: rotate(180deg); }
    .p-body { display: flex; flex-direction: column; gap: 6px; padding: 0 10px 10px 56px; animation: fade-in 0.25s var(--ease-out) both; }
    @keyframes fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
    .nr { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border: none; border-radius: 8px; cursor: pointer;
      font-family: ui-monospace, monospace; font-size: 12.5px; background: rgba(127,127,127,0.12); }
    .nr ha-icon { --mdc-icon-size: 14px; color: var(--secondary-text-color); }
    .route, .hint { font-size: 11.5px; color: var(--secondary-text-color); }
    .p-actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .act { display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; border: none; border-radius: 999px; cursor: pointer; font-size: 12px; font-weight: 700;
      text-decoration: none; color: inherit; background: rgba(127,127,127,0.14); }
    .act.primary { color: #fff; background: var(--accent); padding: 8px 12px; }
    .act.confirm { color: #fff; background: #e53935; }
    .act ha-icon { --mdc-icon-size: 16px; }
    .more { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; border: none; border-radius: 12px; cursor: pointer;
      font-size: 13px; font-weight: 600; background: rgba(127,127,127,0.06); color: var(--secondary-text-color); }
    .more ha-icon { --mdc-icon-size: 18px; }
    .empty { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 12px; font-size: 13px; color: var(--secondary-text-color); background: rgba(127,127,127,0.06); }
    .empty ha-icon { --mdc-icon-size: 24px; }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-parcel-card": HaParcelCard;
  }
}
