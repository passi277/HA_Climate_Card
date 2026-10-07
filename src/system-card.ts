import { LitElement, css, html, nothing, svg, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant, SystemCardConfig } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { relTime } from "./components/camera-view";
import { backupHealth, backupSensors, loadLevel, pendingUpdates, resourceSensors, updateKind, updateName, UNAVAILABLE, type UpdateKind } from "./utils";
import "./system-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-system-card",
  name: "Modern System Card",
  description: "System & Updates: CPU/RAM/Speicher als Ringe, Dienste, alle verfügbaren Updates mit Installieren und Fortschritt, letztes/nächstes Backup und Neustart – alles automatisch erkannt (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const KIND_ICON: Record<UpdateKind, string> = {
  core: "mdi:home-assistant", os: "mdi:harddisk", supervisor: "mdi:shield-home-outline", app: "mdi:puzzle-outline",
  integration: "mdi:package-variant-closed", card: "mdi:view-dashboard-variant-outline", firmware: "mdi:chip", other: "mdi:package-up",
};
const RES_ICON = { cpu: "mdi:cpu-64-bit", memory: "mdi:memory", disk: "mdi:harddisk" } as const;
const LEVEL_COLOR = { ok: "var(--success-color, #43a047)", warn: "#fb8c00", high: "var(--error-color, #e53935)" } as const;
/** update.install mit Backup (UpdateEntityFeature.BACKUP = 8) */
const FEAT_BACKUP = 8;

type Item = { entity: string; name?: string; icon?: string };
const asItem = (x: string | Item): Item => (typeof x === "string" ? { entity: x } : x);

@customElement("ha-system-card")
export class HaSystemCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: SystemCardConfig;
  @state() private _confirm?: string;
  @state() private _all = false;
  private _confirmTimer?: number;
  private _ids: string[] = [];

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-system-card-editor");
  }

  public static getStubConfig(): Partial<SystemCardConfig> {
    return {};
  }

  public setConfig(config: SystemCardConfig): void {
    this._config = { ...(config ?? { type: "custom:ha-system-card" }) };
  }

  public getCardSize(): number {
    return 6;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._confirmTimer);
  }

  private _t(key: string): string {
    return localize(this.hass, `system.${key}`);
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old) return true;
    const s = this.hass!.states;
    // Updates können jederzeit dazukommen – alle update.* vergleichen
    for (const id in s) if (id.startsWith("update.") && old.states[id] !== s[id]) return true;
    return this._ids.some((id) => old.states[id] !== s[id]) || old.locale !== this.hass!.locale;
  }

  private _st(id?: string): HassEntity | undefined {
    const st = id ? this.hass!.states[id] : undefined;
    return st && !UNAVAILABLE.includes(st.state) ? st : undefined;
  }

  private _fmt(v: number, digits = 0): string {
    return v.toLocaleString(getLanguage(this.hass), { maximumFractionDigits: digits });
  }

  private _haptic(type = "light"): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: type }));
  }

  private _moreInfo(id?: string): void {
    if (!id) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
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

  private _install(st: HassEntity): void {
    if (!this._confirmed(st.entity_id)) return;
    this._haptic("medium");
    const feats = Number(st.attributes.supported_features ?? 0);
    const kind = updateKind(st.entity_id, st.attributes);
    const data: Record<string, unknown> = { entity_id: st.entity_id };
    if ((feats & FEAT_BACKUP) && (kind === "core" || kind === "app")) data.backup = true;
    this._call("update", "install", data);
  }

  private _restart(): void {
    if (!this._confirmed("restart")) return;
    this._haptic("heavy");
    this._call("homeassistant", "restart", {});
  }

  // ---------- Darstellung ----------

  private _ring(pct: number, color: string) {
    const r = 26, c = 2 * Math.PI * r, p = Math.min(100, Math.max(0, pct)) / 100;
    return svg`<svg class="ring-svg" viewBox="0 0 64 64" aria-hidden="true">
      <circle class="r-track" cx="32" cy="32" r=${r}></circle>
      <circle class="r-fill" cx="32" cy="32" r=${r} stroke=${color} stroke-dasharray=${`${(c * p).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 32 32)"></circle>
    </svg>`;
  }

  private _renderResources() {
    const c = this._config!;
    const auto = resourceSensors(this.hass!.states).map((r) => ({ entity: r.entity, icon: RES_ICON[r.kind], name: this._t(`res_${r.kind}`) }));
    const list: Item[] = c.resources?.length ? c.resources.map(asItem) : auto;
    const items = list.map((r) => ({ ...r, st: this._st(r.entity) })).filter((r) => r.st && Number.isFinite(Number(r.st.state)));
    if (!items.length) return nothing;
    return html`<div class="res" style="--n:${items.length}">${items.map((r) => {
      const v = Number(r.st!.state);
      const lvl = loadLevel(v);
      const name = r.name ?? String(r.st!.attributes.friendly_name ?? r.entity).replace(/^home assistant core\s*/i, "");
      return html`<button class="res-item" @click=${() => this._moreInfo(r.entity)} title=${String(r.st!.attributes.friendly_name ?? r.entity)}>
        <span class="ring">${this._ring(v, LEVEL_COLOR[lvl])}<span class="r-val">${this._fmt(v, v < 10 ? 1 : 0)}<small>%</small></span></span>
        <span class="res-name"><ha-icon .icon=${r.icon ?? "mdi:gauge"}></ha-icon>${name}</span>
      </button>`;
    })}</div>`;
  }

  private _renderServices() {
    const list = (this._config!.services ?? []).map(asItem);
    if (!list.length) return nothing;
    return html`<div class="services">${list.map((s) => {
      const st = this.hass!.states[s.entity];
      const ok = !!st && ["on", "home", "connected", "online", "running", "true"].includes(st.state);
      const name = s.name ?? String(st?.attributes.friendly_name ?? s.entity);
      return html`<button class="svc ${ok ? "ok" : "bad"}" @click=${() => this._moreInfo(s.entity)}>
        <span class="dot"></span>${s.icon ? html`<ha-icon .icon=${s.icon}></ha-icon>` : nothing}<span>${name}</span></button>`;
    })}</div>`;
  }

  private _renderUpdates(updates: HassEntity[]) {
    const c = this._config!;
    const total = Object.keys(this.hass!.states).filter((id) => id.startsWith("update.")).length;
    if (!updates.length) {
      return html`<div class="uptodate"><ha-icon icon="mdi:check-decagram"></ha-icon>
        <span><b>${this._t("all_current")}</b><small>${this._t("checked").replace("{n}", String(total))}</small></span></div>`;
    }
    const max = c.max_updates ?? 5;
    const shown = this._all ? updates : updates.slice(0, max);
    return html`<div class="updates">
      <div class="sec-title"><ha-icon icon="mdi:package-up"></ha-icon><span>${this._t("updates")}</span><small class="count">${updates.length}</small></div>
      ${shown.map((st) => {
        const a = st.attributes;
        const kind = updateKind(st.entity_id, a);
        const busy = !!a.in_progress;
        const pct = Number(a.update_percentage ?? (typeof a.in_progress === "number" ? a.in_progress : NaN));
        const asking = this._confirm === st.entity_id;
        const pic = a.entity_picture ? String(a.entity_picture) : "";
        return html`<div class="upd ${busy ? "busy" : ""}" data-kind=${kind}>
          <button class="u-main" @click=${() => this._moreInfo(st.entity_id)}>
            <span class="u-ic">${pic ? html`<img src=${pic} alt="" loading="lazy" @error=${(e: Event) => ((e.target as HTMLElement).style.display = "none")} />` : nothing}
              <ha-icon .icon=${KIND_ICON[kind]}></ha-icon></span>
            <span class="u-text"><b>${updateName(st)}</b>
              <small>${a.installed_version ?? "?"} → <em>${a.latest_version ?? "?"}</em> · ${this._t(`kind_${kind}`)}</small></span>
          </button>
          ${busy ? html`<span class="u-prog"><span style="width:${Number.isFinite(pct) ? Math.min(100, pct) : 30}%" class=${Number.isFinite(pct) ? "" : "indet"}></span></span>`
            : html`<button class="u-btn ${asking ? "ask" : ""}" @click=${() => this._install(st)} title=${this._t("install")}>
              <ha-icon .icon=${asking ? "mdi:alert" : "mdi:download"}></ha-icon><span>${this._t(asking ? "confirm" : "install")}</span></button>`}
        </div>`;
      })}
      ${updates.length > max ? html`<button class="more" @click=${() => { this._all = !this._all; }}>
        <ha-icon .icon=${this._all ? "mdi:chevron-up" : "mdi:chevron-down"}></ha-icon>${this._all ? this._t("less") : this._t("show_all").replace("{n}", String(updates.length))}</button>` : nothing}
    </div>`;
  }

  private _renderBackup(health: string, b: ReturnType<typeof backupSensors>) {
    const lang = getLanguage(this.hass);
    const last = this._st(b.last);
    const next = this._st(b.next);
    const mgr = this._st(b.state);
    if (!last && !next && !mgr) return nothing;
    const running = mgr && !["idle", "unknown"].includes(mgr.state);
    const fmtNext = (iso: string) => {
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? iso : new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(Math.round((d.getTime() - Date.now()) / 3600_000), "hour");
    };
    return html`<div class="backup ${health}">
      <button class="b-main" @click=${() => this._moreInfo(b.last ?? b.state)}>
        <ha-icon .icon=${running ? "mdi:backup-restore" : health === "ok" ? "mdi:cloud-check-outline" : "mdi:cloud-alert-outline"}></ha-icon>
        <span class="b-text"><b>${running ? this._t("backup_running") : this._t(`backup_${health}`)}</b>
          <small>${last ? `${this._t("backup_last")} ${relTime(last.state, lang)}` : ""}${last && next ? " · " : ""}${next ? `${this._t("backup_next")} ${fmtNext(next.state)}` : ""}</small></span>
      </button>
    </div>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const updates = c.show_updates === false ? [] : pendingUpdates(this.hass.states, c.updates, c.exclude_updates);
    const b = backupSensors(this.hass.states);
    const health = backupHealth(this._st(b.last)?.state, this._st(b.attempted)?.state, c.backup_max_age ?? 3);
    const svcDown = (c.services ?? []).map(asItem).filter((s) => !["on", "home", "connected", "online", "running", "true"].includes(this.hass!.states[s.entity]?.state ?? "")).length;
    this._ids = [...(c.resources ?? []).map((r) => asItem(r).entity), ...(c.services ?? []).map((s) => asItem(s).entity),
      ...resourceSensors(this.hass.states).map((r) => r.entity), ...Object.values(b).filter(Boolean) as string[]];
    const problem = svcDown > 0 || health === "failed";
    const warn = updates.length > 0 || health === "stale";
    const color = problem ? "var(--error-color, #e53935)" : warn ? "#fb8c00" : "var(--success-color, #43a047)";
    const sub = svcDown ? this._t("services_down").replace("{n}", String(svcDown))
      : health === "failed" ? this._t("backup_failed")
      : updates.length ? this._t(updates.length === 1 ? "one_update" : "n_updates").replace("{n}", String(updates.length))
      : health === "stale" ? this._t("backup_stale") : this._t("all_good");
    return html`<ha-card class="sys anim-${c.animations ?? "full"}" style="--hcc-accent-c:${color}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <span class="h-icon"><ha-icon icon="mdi:server"></ha-icon></span>
        <span class="head-text"><span class="h-title">${c.name ?? this._t("title")}</span><span class="h-sub">${sub}</span></span>
        ${c.show_restart !== false ? html`<button class="restart ${this._confirm === "restart" ? "ask" : ""}" @click=${() => this._restart()}
          title=${this._t("restart")} aria-label=${this._t("restart")}>
          <ha-icon .icon=${this._confirm === "restart" ? "mdi:alert" : "mdi:restart"}></ha-icon>${this._confirm === "restart" ? html`<span>${this._t("restart_confirm")}</span>` : nothing}</button>` : nothing}
      </div>
      ${c.show_resources !== false ? this._renderResources() : nothing}
      ${this._renderServices()}
      ${c.show_updates !== false ? this._renderUpdates(updates) : nothing}
      ${c.show_backup !== false ? this._renderBackup(health, b) : nothing}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.sys { --accent: var(--hcc-accent-c); gap: 12px; container-type: inline-size; }
    .header { display: flex; align-items: center; gap: 10px; }
    .h-icon { flex: none; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; color: var(--accent);
      background: color-mix(in srgb, var(--accent) 16%, transparent); transition: background 0.4s, color 0.4s; }
    .h-icon ha-icon { --mdc-icon-size: 24px; }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .h-title { font-size: 17px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .h-sub { font-size: 13px; font-weight: 600; color: var(--accent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .restart { flex: none; display: inline-flex; align-items: center; gap: 6px; height: 34px; min-width: 34px; padding: 0 8px; border: none; border-radius: 999px;
      cursor: pointer; justify-content: center; background: rgba(127,127,127,0.1); color: var(--secondary-text-color); font-size: 12.5px; font-weight: 700; transition: background 0.3s, color 0.3s; }
    .restart ha-icon { --mdc-icon-size: 18px; }
    .restart.ask { color: #fff; background: #f57c00; padding: 0 12px; }

    /* Ressourcen */
    .res { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 8px; }
    .res-item { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 4px; border: none; border-radius: var(--hcc-inner-radius, 14px);
      background: rgba(127,127,127,0.07); cursor: pointer; min-width: 0; }
    .ring { position: relative; width: 64px; height: 64px; }
    .ring-svg { width: 100%; height: 100%; display: block; }
    .r-track { fill: none; stroke: rgba(127,127,127,0.18); stroke-width: 6; }
    .r-fill { fill: none; stroke-width: 6; stroke-linecap: round; transition: stroke-dasharray 0.8s var(--ease-out), stroke 0.5s; }
    .r-val { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; }
    .r-val small { font-size: 10px; font-weight: 600; color: var(--secondary-text-color); margin-left: 1px; }
    .res-name { display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: var(--secondary-text-color); max-width: 100%;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .res-name ha-icon { --mdc-icon-size: 15px; flex: none; }

    /* Dienste */
    .services { display: flex; flex-wrap: wrap; gap: 6px; }
    .svc { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border: none; border-radius: 999px; cursor: pointer; font-size: 12.5px; font-weight: 600;
      background: rgba(127,127,127,0.1); }
    .svc ha-icon { --mdc-icon-size: 16px; color: var(--secondary-text-color); }
    .svc .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success-color, #43a047); box-shadow: 0 0 6px var(--success-color, #43a047); }
    .svc.bad { color: var(--error-color, #e53935); background: color-mix(in srgb, var(--error-color, #e53935) 12%, transparent); }
    .svc.bad .dot { background: var(--error-color, #e53935); box-shadow: none; animation: blink 1.2s ease-in-out infinite; }
    @keyframes blink { 50% { opacity: 0.3; } }

    /* Updates */
    .sec-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--secondary-text-color); }
    .sec-title ha-icon { --mdc-icon-size: 16px; }
    .count { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; display: inline-grid; place-items: center; font-size: 11px; font-weight: 800;
      color: #fff; background: #fb8c00; letter-spacing: 0; }
    .updates { display: flex; flex-direction: column; gap: 6px; }
    .upd { display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 8px; border-radius: 12px; background: rgba(127,127,127,0.07); }
    .u-main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; border: none; background: none; padding: 0; cursor: pointer; text-align: left; }
    .u-ic { position: relative; flex: none; width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; overflow: hidden;
      background: rgba(127,127,127,0.12); color: var(--secondary-text-color); }
    .u-ic ha-icon { --mdc-icon-size: 20px; }
    .u-ic img { position: absolute; inset: 4px; width: calc(100% - 8px); height: calc(100% - 8px); object-fit: contain; z-index: 1;
      background: var(--card-background-color, var(--ha-card-background, #fff)); border-radius: 6px; }
    .upd[data-kind="core"] .u-ic, .upd[data-kind="os"] .u-ic, .upd[data-kind="supervisor"] .u-ic { color: #03a9f4; background: color-mix(in srgb, #03a9f4 14%, transparent); }
    .u-text { display: flex; flex-direction: column; min-width: 0; }
    .u-text b { font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .u-text small { font-size: 11.5px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .u-text em { font-style: normal; font-weight: 700; color: var(--primary-text-color); }
    .u-btn { flex: none; display: inline-flex; align-items: center; gap: 5px; height: 32px; padding: 0 12px 0 9px; border: none; border-radius: 999px; cursor: pointer;
      font-size: 12.5px; font-weight: 700; color: #fff; background: var(--primary-color, #03a9f4); transition: background 0.3s, transform 0.2s var(--ease-spring); }
    .u-btn:active { transform: scale(0.96); }
    .u-btn ha-icon { --mdc-icon-size: 16px; }
    .u-btn.ask { background: #f57c00; }
    @container (max-width: 360px) { .u-btn span { display: none; } .u-btn { padding: 0; width: 32px; justify-content: center; } }
    .u-prog { flex: none; width: 72px; height: 6px; border-radius: 3px; background: rgba(127,127,127,0.2); overflow: hidden; margin-right: 6px; }
    .u-prog span { display: block; height: 100%; border-radius: inherit; background: var(--primary-color, #03a9f4); transition: width 0.6s; }
    .u-prog span.indet { animation: indet 1.4s ease-in-out infinite; }
    @keyframes indet { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }
    .more { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; border: none; border-radius: 12px; cursor: pointer;
      font-size: 13px; font-weight: 600; background: rgba(127,127,127,0.06); color: var(--secondary-text-color); }
    .more ha-icon { --mdc-icon-size: 18px; }
    .uptodate { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: var(--hcc-inner-radius, 14px);
      background: color-mix(in srgb, var(--success-color, #43a047) 10%, transparent); }
    .uptodate ha-icon { --mdc-icon-size: 28px; color: var(--success-color, #43a047); }
    .uptodate span { display: flex; flex-direction: column; }
    .uptodate b { font-size: 14px; }
    .uptodate small { font-size: 12px; color: var(--secondary-text-color); }

    /* Backup */
    .backup { --bc: var(--success-color, #43a047); }
    .backup.stale, .backup.none { --bc: #fb8c00; }
    .backup.failed { --bc: var(--error-color, #e53935); }
    .b-main { width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: none; border-radius: var(--hcc-inner-radius, 14px); cursor: pointer;
      text-align: left; background: color-mix(in srgb, var(--bc) 10%, transparent); }
    .b-main > ha-icon { --mdc-icon-size: 26px; color: var(--bc); flex: none; }
    .b-text { display: flex; flex-direction: column; min-width: 0; }
    .b-text b { font-size: 14px; }
    .b-text small { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-system-card": HaSystemCard;
  }
}
