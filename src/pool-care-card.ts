import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant, PoolCareCardConfig, PoolCareTab } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { amountStep, formatAmount, maintenanceDue, poolCareEntities, stockLevel, UNAVAILABLE } from "./utils";
import "./pool-care-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-pool-care-card",
  name: "Modern Pool Care Card",
  description: "Pool-Pflege für die Smart-Pool-Integration: Chemie-Tagebuch mit Empfehlung, Vorräte, Metall-Ex mit Nachfüllen und Countdown, Wartung mit Aufgaben, Solar- und Wochenstatistik – alles über das Gerät gefunden (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

export const POOL_CARE_TABS: PoolCareTab[] = ["chemistry", "stock", "metal", "maintenance", "stats"];
const TAB_ICONS: Record<PoolCareTab, string> = {
  chemistry: "mdi:flask-outline", stock: "mdi:package-variant", metal: "mdi:magnet", maintenance: "mdi:wrench-outline", stats: "mdi:chart-donut",
};
const PRODUCTS = ["chlorine", "shock", "ph_minus", "ph_plus", "metal_ex"] as const;
type Product = (typeof PRODUCTS)[number];
const PRODUCT: Record<Product, { icon: string; color: string; unit: string; dose?: string }> = {
  chlorine: { icon: "mdi:shaker-outline", color: "#26c6da", unit: "g", dose: "chlorine_dose" },
  shock: { icon: "mdi:flash", color: "#ffa000", unit: "g" },
  ph_minus: { icon: "mdi:arrow-down-circle-outline", color: "#e53935", unit: "g", dose: "ph_minus_dose" },
  ph_plus: { icon: "mdi:arrow-up-circle-outline", color: "#43a047", unit: "g", dose: "ph_plus_dose" },
  metal_ex: { icon: "mdi:magnet", color: "#8d6e63", unit: "ml", dose: "metal_ex_dose" },
};
const TASKS = [
  { key: "sand", button: "sand_changed", icon: "mdi:grain" },
  { key: "probe", button: "probe_calibrated", icon: "mdi:test-tube" },
  { key: "seals", button: "seals_checked", icon: "mdi:pipe-wrench" },
];
interface TodoItem { uid: string; summary: string; status: string }

@customElement("ha-pool-care-card")
export class HaPoolCareCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: PoolCareCardConfig;
  @state() private _tab?: PoolCareTab;
  @state() private _ask?: string;
  @state() private _pending: Record<string, number> = {};
  @state() private _todos: TodoItem[] = [];
  private _askTimer?: number;
  private _sendTimers: Record<string, number> = {};
  private _todoState?: string;
  private _cache?: { key: unknown; device?: string; e: Record<string, string> };

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-pool-care-card-editor");
  }

  public static getStubConfig(): Partial<PoolCareCardConfig> {
    return {};
  }

  public setConfig(config: PoolCareCardConfig): void {
    if (!config) throw new Error("ha-pool-care-card: Konfiguration fehlt");
    this._config = { ...config };
    this._cache = undefined;
    const tabs = this._tabs();
    if (!this._tab || !tabs.includes(this._tab)) this._tab = config.default_tab && tabs.includes(config.default_tab) ? config.default_tab : tabs[0];
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this._askTimer);
    Object.values(this._sendTimers).forEach((t) => window.clearTimeout(t));
  }

  public getCardSize(): number {
    return 7;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  private _t(key: string): string {
    return localize(this.hass, `pool_care.${key}`);
  }

  private _tabs(): PoolCareTab[] {
    const t = (this._config?.tabs ?? POOL_CARE_TABS).filter((x) => POOL_CARE_TABS.includes(x));
    return t.length ? t : POOL_CARE_TABS;
  }

  /** translation_key → entity_id */
  private _e(): Record<string, string> {
    const h = this.hass!;
    const c = this._config!;
    if (this._cache && this._cache.key === h.entities && this._cache.device === c.device) return this._cache.e;
    const e = poolCareEntities(h.entities, c.device, c.entities);
    this._cache = { key: h.entities, device: c.device, e };
    return e;
  }

  private _st(key: string): HassEntity | undefined {
    const id = this._e()[key];
    return id ? this.hass!.states[id] : undefined;
  }

  private _num(key: string): number | undefined {
    const st = this._st(key);
    if (!st || UNAVAILABLE.includes(st.state)) return undefined;
    const n = Number(st.state);
    return Number.isFinite(n) ? n : undefined;
  }

  private _on(key: string): boolean {
    return this._st(key)?.state === "on";
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || old.locale !== this.hass!.locale || old.entities !== this.hass!.entities) return true;
    return Object.values(this._e()).some((id) => old.states[id] !== this.hass!.states[id]);
  }

  protected updated(): void {
    const todo = this._e().tasks;
    const st = todo ? this.hass?.states[todo]?.state : undefined;
    if (todo && st !== this._todoState) {
      this._todoState = st;
      this._loadTodos(todo);
    }
  }

  private async _loadTodos(entity: string): Promise<void> {
    try {
      const res = await this.hass!.callWS<{ items: TodoItem[] }>({ type: "todo/item/list", entity_id: entity });
      this._todos = (res?.items ?? []).filter((i) => i.status === "needs_action");
    } catch {
      this._todos = [];
    }
  }

  // ---------- Aktionen ----------

  private _haptic(kind = "light"): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: kind }));
  }

  private _moreInfo(key: string): void {
    const id = this._e()[key];
    if (id) this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
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

  /** Erst „Sicher?“, beim zweiten Tippen ausführen */
  private _confirmed(key: string): boolean {
    if (this._ask === key) {
      this._ask = undefined;
      window.clearTimeout(this._askTimer);
      return true;
    }
    this._haptic("warning");
    this._ask = key;
    window.clearTimeout(this._askTimer);
    this._askTimer = window.setTimeout(() => (this._ask = undefined), 4000);
    return false;
  }

  private _press(key: string, confirm = true): void {
    const id = this._e()[key];
    if (!id || (confirm && !this._confirmed(key))) return;
    this._haptic("medium");
    this._call("button", "press", { entity_id: id });
  }

  private _select(key: string, option: string): void {
    const id = this._e()[key];
    if (!id) return;
    this._haptic("selection");
    this._call(id.split(".")[0]!, "select_option", { entity_id: id, option });
  }

  /** Zahl ändern: −/+ werden kurz gesammelt und dann gesendet */
  private _setNumber(key: string, value: number): void {
    const st = this._st(key);
    if (!st) return;
    const a = st.attributes;
    const v = Math.min(Number(a.max ?? 1e9), Math.max(Number(a.min ?? 0), Math.round(value * 100) / 100));
    this._haptic("selection");
    this._pending = { ...this._pending, [key]: v };
    window.clearTimeout(this._sendTimers[key]);
    this._sendTimers[key] = window.setTimeout(() => {
      this._call("number", "set_value", { entity_id: st.entity_id, value: v }).finally(() => {
        if (this._pending[key] === v) { const p = { ...this._pending }; delete p[key]; this._pending = p; }
      });
    }, 600);
  }

  private _value(key: string): number | undefined {
    return this._pending[key] ?? this._num(key);
  }

  private _completeTodo(uid: string): void {
    const id = this._e().tasks;
    if (!id) return;
    this._haptic("success");
    this._todos = this._todos.filter((t) => t.uid !== uid);
    this._call("todo", "update_item", { entity_id: id, item: uid, status: "completed" });
  }

  // ---------- Formatierung ----------

  private _fmt(v: number, d = 1): string {
    return v.toLocaleString(getLanguage(this.hass), { minimumFractionDigits: 0, maximumFractionDigits: d });
  }

  private _amount(v: number, unit: string): string {
    return formatAmount(v, unit, getLanguage(this.hass));
  }

  private _money(v: number): string {
    return v.toLocaleString(getLanguage(this.hass), { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
  }

  private _ago(iso: string): string {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return "";
    const lang = getLanguage(this.hass);
    const min = Math.round((Date.now() - t) / 60000);
    if (min < 60) return this._t("ago_min").replace("{n}", String(Math.max(1, min)));
    const d = new Date(t);
    const time = d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
    if (d.toDateString() === new Date().toDateString()) return `${this._t("today")} ${time}`;
    if (d.toDateString() === new Date(Date.now() - 86_400_000).toDateString()) return `${this._t("yesterday")} ${time}`;
    return d.toLocaleDateString(lang, { day: "2-digit", month: "2-digit" });
  }

  private _pname(p: string): string {
    return this._t(`p_${p}`);
  }

  // ---------- Darstellung ----------

  private _warnings(): number {
    return ["probe_check", "stock_low", "maintenance_due", "backwash_due"].filter((k) => this._on(k)).length + (this._num("metal_ex_dose") ? 1 : 0);
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const e = this._e();
    if (!Object.keys(e).length) {
      return html`<ha-card class="care"><div class="empty"><ha-icon icon="mdi:pool"></ha-icon>${this._t("not_found")}</div></ha-card>`;
    }
    const tabs = this._tabs();
    const tab = this._tab && tabs.includes(this._tab) ? this._tab : tabs[0]!;
    const warn = this._warnings();
    const season = this._st("season")?.state;
    const metalActive = this._on("metal_ex_active");
    const accent = this._on("probe_check") || this._on("stock_low") ? "#fb8c00" : metalActive ? "#8d6e63" : "#26c6da";
    const sub = [season && !UNAVAILABLE.includes(season) ? this._t(`season_${season}`) : "", warn ? this._t("open_points").replace("{n}", String(warn)) : this._t("all_good")]
      .filter(Boolean).join(" · ");
    return html`<ha-card class="care anim-${this._config.animations ?? "full"}" style="--hcc-accent-c:${accent}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <span class="h-icon ${warn ? "warn" : ""}"><ha-icon icon="mdi:flask-outline"></ha-icon></span>
        <span class="head-text"><span class="h-title">${this._config.title ?? this._t("title")}</span><span class="h-sub ${warn ? "warn" : ""}">${sub}</span></span>
      </div>
      <div class="tabs" role="tablist">
        ${tabs.map((t) => html`<button class="tab ${t === tab ? "sel" : ""}" role="tab" aria-selected=${t === tab} data-tab=${t}
          @click=${() => { this._haptic("selection"); this._tab = t; }}>
          <ha-icon .icon=${TAB_ICONS[t]}></ha-icon><span>${this._t(`tab_${t}`)}</span>${this._tabBadge(t) ? html`<i class="dot"></i>` : nothing}</button>`)}
      </div>
      <div class="body" data-body=${tab}>
        ${tab === "chemistry" ? this._renderChemistry() : tab === "stock" ? this._renderStock() : tab === "metal" ? this._renderMetal()
          : tab === "maintenance" ? this._renderMaintenance() : this._renderStats()}
      </div>
    </ha-card>`;
  }

  private _tabBadge(t: PoolCareTab): boolean {
    if (t === "chemistry") return this._on("probe_check");
    if (t === "stock") return this._on("stock_low");
    if (t === "metal") return !!this._num("metal_ex_dose") || this._on("metal_ex_active");
    if (t === "maintenance") return this._on("maintenance_due") || this._on("backwash_due") || this._todos.length > 0;
    return false;
  }

  private _stepper(key: string, unit: string, opts: { step?: number; label?: string } = {}) {
    const v = this._value(key) ?? 0;
    const step = opts.step ?? amountStep(v);
    return html`<div class="qty" data-num=${key}>
      <button class="st-btn" aria-label="−" ?disabled=${v <= 0} @click=${() => this._setNumber(key, Math.max(0, v - step))}><ha-icon icon="mdi:minus"></ha-icon></button>
      <button class="st-val" @click=${() => this._moreInfo(key)}>${opts.label ?? this._amount(v, unit)}</button>
      <button class="st-btn" aria-label="+" @click=${() => this._setNumber(key, v + step)}><ha-icon icon="mdi:plus"></ha-icon></button>
    </div>`;
  }

  private _action(key: string, icon: string, label: string, color: string, opts: { confirm?: boolean; disabled?: boolean; sub?: string } = {}) {
    const ask = this._ask === key;
    return html`<button class="act ${ask ? "ask" : ""}" style="--ac:${color}" data-act=${key} ?disabled=${opts.disabled || !this._e()[key]}
      @click=${() => this._press(key, opts.confirm ?? true)}>
      <ha-icon .icon=${ask ? "mdi:help-circle-outline" : icon}></ha-icon>
      <span class="act-t"><b>${ask ? this._t("sure") : label}</b>${opts.sub && !ask ? html`<small>${opts.sub}</small>` : nothing}</span>
    </button>`;
  }

  private _renderChemistry() {
    const product = (this._st("dose_product")?.state ?? "chlorine") as Product;
    const meta = PRODUCT[product] ?? PRODUCT.chlorine;
    const amount = this._value("dose_amount") ?? 0;
    const rec = meta.dose ? this._num(meta.dose) : undefined;
    const log = (this._st("last_dose")?.attributes.log ?? []) as { time: string; product: string; amount: number }[];
    const probe = this._on("probe_check");
    const rise = this._st("probe_check")?.attributes.last_redox_rise_mv;
    return html`
      <div class="prods" role="radiogroup">
        ${PRODUCTS.map((p) => html`<button class="prod ${p === product ? "sel" : ""}" role="radio" aria-checked=${p === product} style="--pc:${PRODUCT[p].color}"
          data-product=${p} @click=${() => this._select("dose_product", p)}><span class="pi"><ha-icon .icon=${PRODUCT[p].icon}></ha-icon></span>${this._pname(p)}</button>`)}
      </div>
      <div class="panel" style="--pc:${meta.color}">
        <div class="dose-row">
          ${this._stepper("dose_amount", meta.unit)}
          ${rec ? html`<button class="rec ${rec === amount ? "sel" : ""}" @click=${() => this._setNumber("dose_amount", rec)}>
            <ha-icon icon="mdi:lightbulb-on-outline"></ha-icon>${this._t("recommended")} ${this._amount(rec, meta.unit)}</button>`
            : html`<span class="rec-none">${this._t("no_recommendation")}</span>`}
        </div>
        ${this._action("log_dose", "mdi:notebook-plus-outline", this._t("log"), meta.color, { sub: `${this._amount(amount, meta.unit)} ${this._pname(product)}`, disabled: amount <= 0 })}
      </div>
      ${probe ? html`<div class="note warn"><ha-icon icon="mdi:test-tube"></ha-icon><span><b>${this._t("probe_title")}</b>
        ${this._t("probe_text")}${rise != null ? ` (+${this._fmt(Number(rise), 0)} mV)` : ""}</span>
        <button class="mini" data-act="probe_calibrated" @click=${() => this._press("probe_calibrated")}>${this._ask === "probe_calibrated" ? this._t("sure") : this._t("calibrated")}</button></div>` : nothing}
      <div class="list">
        <div class="l-title">${this._t("recent")}</div>
        ${log.length ? log.slice(0, 5).map((r) => {
          const m = PRODUCT[r.product as Product] ?? PRODUCT.chlorine;
          return html`<div class="l-row" style="--pc:${m.color}"><span class="pi sm"><ha-icon .icon=${m.icon}></ha-icon></span>
            <span class="l-name">${this._pname(r.product)}</span><span class="l-val">${this._amount(r.amount, m.unit)}</span><span class="l-time">${this._ago(r.time)}</span></div>`;
        }) : html`<div class="l-empty">${this._t("none_logged")}</div>`}
      </div>`;
  }

  private _renderStock() {
    const low = this._st("stock_low");
    const tracked = (low?.attributes.stock ?? {}) as Record<string, number>;
    const thresholds = (low?.attributes.thresholds ?? {}) as Record<string, number>;
    const lowList = (low?.attributes.products ?? []) as string[];
    return html`<div class="stock">
      ${PRODUCTS.map((p) => {
        const m = PRODUCT[p];
        const key = `stock_${p}`;
        const v = this._value(key) ?? 0;
        const isTracked = p in tracked || key in this._pending;
        const isLow = lowList.includes(p);
        const use = this._num(`consumption_${p}`);
        return html`<div class="s-row ${isLow ? "low" : ""} ${isTracked ? "" : "untracked"}" style="--pc:${isLow ? "#fb8c00" : m.color}" data-stock=${p}>
          <span class="pi"><ha-icon .icon=${m.icon}></ha-icon></span>
          <div class="s-main">
            <div class="s-head"><b>${this._pname(p)}</b><span class="s-state">${!isTracked ? this._t("untracked") : isLow ? this._t("stock_low") : ""}</span></div>
            <div class="bar"><span style="width:${(isTracked ? stockLevel(v, thresholds[p]) : 0) * 100}%"></span></div>
            <small>${use ? `${this._t("season_use")} ${this._amount(use, m.unit)}` : " "}</small>
          </div>
          ${this._stepper(key, m.unit, { step: 100 })}
        </div>`;
      })}
      ${lowList.length ? html`<div class="note warn"><ha-icon icon="mdi:cart-outline"></ha-icon><span>${this._t("shopping")}</span></div>` : nothing}
    </div>`;
  }

  private _renderMetal() {
    const active = this._on("metal_ex_active");
    const left = this._num("metal_ex_remaining") ?? 0;
    const total = Number(this._st("metal_ex_remaining")?.attributes.total_hours ?? 48) || 48;
    const doseSt = this._st("metal_ex_dose");
    const dose = this._num("metal_ex_dose") ?? 0;
    const a = doseSt?.attributes ?? {};
    const surface = Number(a.surface_m2 ?? 0);
    const cm = this._value("refill_cm") ?? 0;
    const rain = this._num("rain_forecast_24h");
    const rainL = this._st("rain_forecast_24h")?.attributes.liters;
    const rainLast = this._num("rain_last_24h");
    const metal = PRODUCT.metal_ex.color;
    return html`
      <div class="metal ${active ? "active" : ""}">
        <div class="ring" style="--p:${active ? (left / total) * 360 : dose ? 360 : 0}deg">
          <span class="ring-in">${active ? html`<b>${this._fmt(left, 0)}</b><small>h</small>` : html`<ha-icon .icon=${dose ? "mdi:magnet" : "mdi:check"}></ha-icon>`}</span>
        </div>
        <div class="m-text">
          ${active ? html`<b>${this._t("metal_active")}</b><span>${this._t("metal_left").replace("{h}", this._fmt(left, 0))}</span>`
            : dose ? html`<b>${this._amount(dose, "ml")} ${this._t("metal_open")}</b><span>${this._t("fresh").replace("{l}", this._fmt(Number(a.fresh_water_liters ?? 0), 0))}</span>`
            : html`<b>${this._t("metal_none")}</b><span>${this._t("whole_pool").replace("{a}", this._fmt(Number(a.whole_pool_preventive_ml ?? 0), 0))
              .replace("{b}", this._fmt(Number(a.whole_pool_discoloured_ml ?? 0), 0))}</span>`}
        </div>
      </div>
      ${this._action("metal_ex_added", "mdi:magnet-on", this._t("added"), metal, { sub: dose ? this._amount(dose, "ml") : this._t("added_sub") })}
      <div class="panel" style="--pc:#42a5f5">
        <div class="p-title"><ha-icon icon="mdi:water-plus"></ha-icon>${this._t("refill")}</div>
        <div class="dose-row">
          ${this._stepper("refill_cm", "cm", { step: 0.5, label: `${this._fmt(cm, 1)} cm` })}
          <span class="rec-none">${surface ? this._t("liters").replace("{l}", this._fmt(cm * surface * 10, 0)) : ""}</span>
        </div>
        ${this._action("refilled", "mdi:water-check", this._t("refilled"), "#42a5f5")}
      </div>
      ${rain != null || rainLast != null ? html`<div class="chips">
        ${rain != null ? html`<span class="chip" @click=${() => this._moreInfo("rain_forecast_24h")}><ha-icon icon="mdi:weather-rainy"></ha-icon>
          ${this._t("rain_fc")} ${this._fmt(rain, 1)} mm${rainL ? ` · ${this._fmt(Number(rainL), 0)} l` : ""}</span>` : nothing}
        ${rainLast != null ? html`<span class="chip"><ha-icon icon="mdi:weather-pouring"></ha-icon>${this._t("rain_last")} ${this._fmt(rainLast, 1)} mm</span>` : nothing}
      </div>` : nothing}`;
  }

  private _renderMaintenance() {
    const season = this._st("season");
    const lastDone = (this._st("maintenance_due")?.attributes.last_done ?? {}) as Record<string, string>;
    const hours = this._num("backwash_hours");
    const interval = Number(this._st("backwash_hours")?.attributes.interval_hours ?? 0);
    const bwDue = this._on("backwash_due");
    return html`
      <div class="tasks">
        ${hours != null ? html`<div class="t-row ${bwDue ? "due" : ""}" data-task="backwash">
          <span class="pi" style="--pc:#fb8c00"><ha-icon icon="mdi:water-sync"></ha-icon></span>
          <div class="s-main"><div class="s-head"><b>${this._t("backwash")}</b><span class="s-state">${bwDue ? this._t("due_now") : ""}</span></div>
            <div class="bar"><span style="width:${interval ? Math.min(1, hours / interval) * 100 : 0}%"></span></div>
            <small>${interval ? this._t("hours_of").replace("{h}", this._fmt(hours, 1)).replace("{i}", this._fmt(interval, 0)) : `${this._fmt(hours, 1)} h`}</small></div>
          <button class="mini ${this._ask === "backwash_done" ? "ask" : ""}" data-act="backwash_done" @click=${() => this._press("backwash_done")}>
            ${this._ask === "backwash_done" ? this._t("sure") : this._t("done")}</button>
        </div>` : nothing}
        ${TASKS.map((t) => {
          const due = maintenanceDue(lastDone[t.key], season?.attributes[`next_${t.key}`]);
          const isDue = due.days != null && due.days <= 0;
          const text = due.days == null ? "" : due.days < 0 ? this._t("overdue").replace("{d}", String(-due.days)) : due.days === 0 ? this._t("due_now")
            : this._t("due_in").replace("{d}", String(due.days));
          return html`<div class="t-row ${isDue ? "due" : ""}" data-task=${t.key}>
            <span class="pi" style="--pc:${isDue ? "#fb8c00" : "#78909c"}"><ha-icon .icon=${t.icon}></ha-icon></span>
            <div class="s-main"><div class="s-head"><b>${this._t(`task_${t.key}`)}</b><span class="s-state">${isDue ? this._t("due_now") : ""}</span></div>
              <div class="bar"><span style="width:${(due.progress ?? 0) * 100}%"></span></div><small class=${isDue ? "due-t" : ""}>${text}</small></div>
            <button class="mini ${this._ask === t.button ? "ask" : ""}" data-act=${t.button} @click=${() => this._press(t.button)}>
              ${this._ask === t.button ? this._t("sure") : this._t("done")}</button>
          </div>`;
        })}
      </div>
      <div class="list">
        <div class="l-title">${this._t("tasks")}${this._todos.length ? html`<span class="count">${this._todos.length}</span>` : nothing}</div>
        ${this._todos.length ? this._todos.slice(0, 8).map((t) => html`<button class="todo" data-uid=${t.uid} @click=${() => this._completeTodo(t.uid)}>
          <span class="box"></span><span>${t.summary}</span></button>`) : html`<div class="l-empty">${this._t("no_tasks")}</div>`}
      </div>`;
  }

  private _renderStats() {
    const share = this._num("solar_share_today");
    const savings = this._num("solar_savings_today");
    const solarKwh = this._num("solar_energy_today");
    const energy = this._num("energy_today");
    const cost = this._num("cost_today");
    const swim = this._num("swim_score");
    const swimLabel = this._st("swim_score")?.attributes.rating ?? "unknown";
    const outages = this._num("pump_outages_today");
    const report = this._st("weekly_report");
    const ra = report?.attributes ?? {};
    const swimColor = swim == null ? "#78909c" : swim >= 80 ? "#43a047" : swim >= 60 ? "#26c6da" : swim >= 35 ? "#fb8c00" : "#78909c";
    const kpi = (icon: string, color: string, value: string, label: string, key?: string) =>
      html`<button class="kpi" style="--kc:${color}" @click=${() => key && this._moreInfo(key)}><ha-icon .icon=${icon}></ha-icon><b>${value}</b><small>${label}</small></button>`;
    return html`
      <div class="solar">
        <div class="ring" style="--p:${(share ?? 0) * 3.6}deg; --accent:#ffa000">
          <span class="ring-in"><b>${share != null ? this._fmt(share, 0) : "–"}</b><small>%</small></span>
        </div>
        <div class="m-text"><b>${this._t("solar_share")}</b>
          <span>${solarKwh != null ? `${this._fmt(solarKwh, 2)} kWh` : ""}${savings ? ` · ${this._t("savings")} ${this._money(savings)}` : ""}</span></div>
      </div>
      <div class="kpis">
        ${energy != null ? kpi("mdi:lightning-bolt", "#fb8c00", `${this._fmt(energy, 2)} kWh`, this._t("energy"), "energy_today") : nothing}
        ${cost != null ? kpi("mdi:currency-eur", "#78909c", this._money(cost), this._t("cost"), "cost_today") : nothing}
        ${kpi("mdi:swim", swimColor, swim != null ? `${this._fmt(swim, 0)} %` : "–", `${this._t("swim")} · ${this._t(`swim_${swimLabel}`)}`, "swim_score")}
        ${outages != null ? kpi("mdi:wifi-alert", outages ? "#fb8c00" : "#43a047", String(outages), this._t("outages"), "pump_outages_today") : nothing}
      </div>
      <div class="list report">
        <div class="l-title">${this._t("report")}${ra.week ? html`<span class="wk">${this._t("week")} ${ra.week}</span>` : nothing}</div>
        ${report && !UNAVAILABLE.includes(report.state) ? html`<div class="r-grid">
          ${ra.runtime_hours != null ? html`<span><small>${this._t("r_runtime")}</small><b>${this._fmt(ra.runtime_hours, 1)} h</b></span>` : nothing}
          ${ra.energy_kwh != null ? html`<span><small>${this._t("energy")}</small><b>${this._fmt(ra.energy_kwh, 1)} kWh</b></span>` : nothing}
          ${ra.cost != null ? html`<span><small>${this._t("cost")}</small><b>${this._money(ra.cost)}</b></span>` : nothing}
          ${ra.solar_share != null ? html`<span><small>${this._t("r_solar")}</small><b>${this._fmt(ra.solar_share, 0)} %</b></span>` : nothing}
          ${ra.ph_min != null ? html`<span><small>pH</small><b>${this._fmt(ra.ph_min, 1)}–${this._fmt(ra.ph_max, 1)}</b></span>` : nothing}
          ${ra.orp_min != null ? html`<span><small>Redox</small><b>${this._fmt(ra.orp_min, 0)}–${this._fmt(ra.orp_max, 0)}</b></span>` : nothing}
        </div>` : html`<div class="l-empty">${this._t("no_report")}</div>`}
      </div>`;
  }

  static styles = [cardStyles, css`
    ha-card.care { gap: 12px; container-type: inline-size; }
    .empty { display: flex; align-items: center; gap: 10px; color: var(--secondary-text-color); font-size: 14px; }
    .header { display: flex; align-items: center; gap: 10px; }
    .h-icon { flex: none; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); }
    .h-icon ha-icon { --mdc-icon-size: 24px; }
    .h-icon.warn ha-icon { animation: breathe 2.4s ease-in-out infinite; }
    @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .h-title { font-size: 17px; font-weight: 600; line-height: 1.2; }
    .h-sub { font-size: 12.5px; font-weight: 600; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .h-sub.warn { color: #fb8c00; }

    .tabs { display: flex; gap: 4px; padding: 4px; border-radius: 999px; background: rgba(127,127,127,0.1); }
    .tab { position: relative; flex: 1 1 0; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 8px 4px; border: none; border-radius: 999px;
      cursor: pointer; background: none; font-size: 12.5px; font-weight: 600; color: var(--secondary-text-color); transition: background 0.3s, color 0.3s; }
    .tab ha-icon { --mdc-icon-size: 18px; flex: none; }
    .tab span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tab.sel { color: #fff; background: var(--accent); box-shadow: 0 2px 8px color-mix(in srgb, var(--accent) 40%, transparent); }
    .tab .dot { position: absolute; top: 5px; right: 8px; width: 7px; height: 7px; border-radius: 50%; background: #fb8c00; }
    .tab.sel .dot { background: #fff; }
    @container (max-width: 430px) { .tab:not(.sel) span { display: none; } .tab { padding: 9px 4px; } .tab.sel { flex: 2.4 1 0; } }

    .body { display: flex; flex-direction: column; gap: 10px; animation: fade-in 0.3s var(--ease-out) both; }
    @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
    .pi { flex: none; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: var(--pc); background: color-mix(in srgb, var(--pc) 16%, transparent); }
    .pi ha-icon { --mdc-icon-size: 19px; }
    .pi.sm { width: 28px; height: 28px; }
    .pi.sm ha-icon { --mdc-icon-size: 16px; }

    .prods { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin: 0 -2px; padding: 2px; }
    .prods::-webkit-scrollbar { display: none; }
    .prod { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px 4px 4px; border: none; border-radius: 999px; cursor: pointer;
      font-size: 13px; font-weight: 600; background: rgba(127,127,127,0.1); transition: background 0.3s, color 0.3s; }
    .prod .pi { width: 28px; height: 28px; }
    .prod .pi ha-icon { --mdc-icon-size: 16px; }
    .prod.sel { color: #fff; background: var(--pc); }
    .prod.sel .pi { color: var(--pc); background: #fff; }

    .panel { display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: var(--hcc-inner-radius, 14px);
      background: color-mix(in srgb, var(--pc) 8%, rgba(127,127,127,0.06)); }
    .p-title { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--secondary-text-color); }
    .p-title ha-icon { --mdc-icon-size: 18px; color: var(--pc); }
    .dose-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
    .qty { display: flex; align-items: center; gap: 6px; padding: 3px; border-radius: 999px; background: rgba(127,127,127,0.12); }
    .st-btn { width: 38px; height: 38px; border-radius: 50%; border: none; padding: 0; display: grid; place-items: center; cursor: pointer; color: var(--pc, var(--accent));
      background: var(--card-background-color, var(--ha-card-background, #fff)); transition: transform 0.2s var(--ease-spring), opacity 0.2s; touch-action: manipulation; }
    .st-btn:active { transform: scale(0.88); }
    .st-btn[disabled] { opacity: 0.35; cursor: default; }
    .st-btn ha-icon { --mdc-icon-size: 20px; }
    .st-val { min-width: 76px; padding: 0; border: none; background: none; cursor: pointer; color: var(--primary-text-color); font-size: 20px; font-weight: 700; text-align: center; font-variant-numeric: tabular-nums; }
    .rec { display: inline-flex; align-items: center; gap: 5px; padding: 7px 12px; border: none; border-radius: 999px; cursor: pointer; font-size: 12.5px; font-weight: 600;
      color: #f9a825; background: color-mix(in srgb, #f9a825 14%, transparent); }
    .rec ha-icon { --mdc-icon-size: 16px; }
    .rec.sel { color: #fff; background: #f9a825; }
    .rec-none { font-size: 12.5px; color: var(--secondary-text-color); }

    .act { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 11px 14px; border: none; border-radius: 999px; cursor: pointer;
      color: #fff; background: var(--ac); box-shadow: 0 3px 10px color-mix(in srgb, var(--ac) 35%, transparent); transition: transform 0.2s var(--ease-spring), background 0.3s; }
    .act:active { transform: scale(0.97); }
    .act.ask { background: #e53935; box-shadow: 0 3px 10px rgba(229,57,53,0.35); }
    .act[disabled] { opacity: 0.45; cursor: default; box-shadow: none; }
    .act ha-icon { --mdc-icon-size: 22px; flex: none; }
    .act-t { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.2; min-width: 0; }
    .act-t b { font-size: 14.5px; }
    .act-t small { font-size: 12px; opacity: 0.9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }

    .note { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--hcc-inner-radius, 14px); font-size: 13px; color: var(--secondary-text-color);
      --nc: #29b6f6; background: color-mix(in srgb, var(--nc) 12%, transparent); }
    .note.warn { --nc: #fb8c00; }
    .note > ha-icon { --mdc-icon-size: 22px; color: var(--nc); flex: none; }
    .note span { flex: 1; min-width: 0; }
    .note b { display: block; font-size: 14px; color: var(--primary-text-color); }
    .mini { flex: none; padding: 6px 12px; border: none; border-radius: 999px; cursor: pointer; font-size: 12.5px; font-weight: 700; color: var(--accent);
      background: color-mix(in srgb, var(--accent) 14%, transparent); transition: background 0.3s, color 0.3s; }
    .mini.ask { color: #fff; background: #e53935; }
    .note .mini { color: #fb8c00; background: color-mix(in srgb, #fb8c00 16%, transparent); }

    .list { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: var(--hcc-inner-radius, 14px); background: rgba(127,127,127,0.07); }
    .l-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--secondary-text-color); }
    .count { min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box; border-radius: 9px; display: grid; place-items: center; font-size: 11px; color: #fff; background: #fb8c00; letter-spacing: 0; }
    .wk { margin-left: auto; text-transform: none; letter-spacing: 0; }
    .l-row { display: flex; align-items: center; gap: 10px; font-size: 13.5px; }
    .l-name { flex: 1; min-width: 0; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .l-val { font-weight: 700; font-variant-numeric: tabular-nums; }
    .l-time { min-width: 76px; text-align: right; font-size: 12px; color: var(--secondary-text-color); }
    .l-empty { font-size: 13px; color: var(--secondary-text-color); }

    .stock, .tasks { display: flex; flex-direction: column; gap: 8px; }
    .s-row, .t-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--hcc-inner-radius, 14px); background: rgba(127,127,127,0.07); }
    .s-row.low, .t-row.due { background: color-mix(in srgb, #fb8c00 10%, rgba(127,127,127,0.05)); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, #fb8c00 45%, transparent); }
    .s-row.untracked .pi { filter: grayscale(1); opacity: 0.6; }
    .s-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .s-main small { font-size: 11.5px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .s-head { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; font-size: 13.5px; }
    .s-head b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .due-t { color: #fb8c00 !important; font-weight: 600; }
    .s-state { font-size: 11.5px; font-weight: 700; color: #fb8c00; white-space: nowrap; }
    .s-row.untracked .s-state { color: var(--secondary-text-color); font-weight: 600; }
    .bar { height: 6px; border-radius: 3px; background: rgba(127,127,127,0.18); overflow: hidden; }
    .bar span { display: block; height: 100%; border-radius: 3px; background: var(--pc, var(--accent)); transition: width 0.6s var(--ease-out); }
    .t-row .bar span { background: var(--accent); }
    .t-row.due .bar span { background: #fb8c00; }
    .s-row .qty { gap: 2px; }
    .s-row .st-btn { width: 32px; height: 32px; }
    .s-row .st-val { min-width: 58px; font-size: 14.5px; }
    @container (max-width: 380px) { .s-row .st-val { min-width: 48px; font-size: 13px; } .s-row .pi { display: none; } }

    .metal, .solar { display: flex; align-items: center; gap: 14px; }
    .ring { position: relative; flex: none; width: 70px; height: 70px; border-radius: 50%;
      background: conic-gradient(var(--accent) 0 var(--p), rgba(127,127,127,0.18) var(--p) 360deg); transition: --p 0.6s; }
    .metal .ring { --accent: #8d6e63; }
    .metal.active .ring { box-shadow: 0 0 0 4px color-mix(in srgb, #8d6e63 20%, transparent); }
    .ring-in { position: absolute; inset: 7px; border-radius: 50%; display: flex; align-items: center; justify-content: center; gap: 1px; box-sizing: border-box;
      background: var(--card-background-color, var(--ha-card-background, #fff)); }
    .ring-in b { font-size: 19px; font-weight: 700; }
    .ring-in small { font-size: 11px; color: var(--secondary-text-color); align-self: flex-end; margin-bottom: 20px; }
    .ring-in ha-icon { --mdc-icon-size: 26px; color: var(--accent); }
    .metal.active .ring-in ha-icon, .metal.active .ring-in b { animation: breathe 2.4s ease-in-out infinite; }
    .m-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; font-size: 13px; color: var(--secondary-text-color); }
    .m-text b { font-size: 15px; color: var(--primary-text-color); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px 5px 8px; border-radius: 999px; font-size: 12.5px; font-weight: 600; background: rgba(127,127,127,0.1); cursor: pointer; }
    .chip ha-icon { --mdc-icon-size: 16px; color: #42a5f5; }

    .todo { display: flex; align-items: center; gap: 10px; width: 100%; padding: 6px 0; border: none; background: none; cursor: pointer; text-align: left; font-size: 13.5px; }
    .box { flex: none; width: 18px; height: 18px; border-radius: 6px; box-shadow: inset 0 0 0 2px var(--secondary-text-color); transition: background 0.2s, box-shadow 0.2s; }
    .todo:hover .box { box-shadow: inset 0 0 0 2px var(--accent); }

    .kpis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .kpi { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 10px 12px; border: none; border-radius: var(--hcc-inner-radius, 14px); cursor: pointer; text-align: left;
      background: color-mix(in srgb, var(--kc) 9%, rgba(127,127,127,0.06)); }
    .kpi ha-icon { --mdc-icon-size: 20px; color: var(--kc); }
    .kpi b { font-size: 17px; font-variant-numeric: tabular-nums; }
    .kpi small { font-size: 11.5px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .r-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px 10px; }
    .r-grid span { display: flex; flex-direction: column; min-width: 0; }
    .r-grid small { font-size: 11px; color: var(--secondary-text-color); }
    .r-grid b { font-size: 14px; font-variant-numeric: tabular-nums; white-space: nowrap; }
    @container (max-width: 360px) { .r-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    ha-card.anim-reduced *, ha-card.anim-off * { animation: none !important; }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-pool-care-card": HaPoolCareCard;
  }
}
