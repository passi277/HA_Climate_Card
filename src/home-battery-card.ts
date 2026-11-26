import { LitElement, css, html, nothing, svg, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant, HomeBatteryCardConfig, HomeBatteryFeatures } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { batteryEta, batteryStatusKey, homeBatteryFeatures, UNAVAILABLE } from "./utils";
import "./home-battery-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-home-battery-card",
  name: "Modern Home Battery Card",
  description: "Hausakku/Balkonkraftwerk (z.B. Anker Solarbank): Ladestand-Ring mit Restzeit, animierter Energiefluss Solar → Akku → Haus, PV-Strings, Ertrag und Ersparnis, 48-h-Verlauf – Entitäten werden über das Gerät erkannt (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const KEYS: (keyof HomeBatteryFeatures)[] = ["soc", "energy", "capacity", "solar", "battery_power", "charge_power", "discharge_power", "home", "grid_charge",
  "socket", "heater", "status", "mode", "error", "cloud", "heating", "solar_today", "savings_today", "savings", "co2", "refresh"];
const HISTORY_REFRESH_MS = 10 * 60_000;
const SUN = "#fbc02d";
const HOME = "#42a5f5";
const GRID = "#ab47bc";
const BATT_ICONS = ["mdi:battery-10", "mdi:battery-20", "mdi:battery-30", "mdi:battery-40", "mdi:battery-50", "mdi:battery-60", "mdi:battery-70", "mdi:battery-80", "mdi:battery-90"];

interface Pt { t: number; v: number }

@customElement("ha-home-battery-card")
export class HaHomeBatteryCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: HomeBatteryCardConfig;
  @state() private _history: { soc: Pt[]; solar: Pt[] } = { soc: [], solar: [] };
  @state() private _refreshing = false;
  private _cache?: { key: unknown; f: Record<string, string | undefined>; strings: string[] };
  private _historyKey = "";
  private _historyAt = 0;
  private _timer?: number;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-home-battery-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<HomeBatteryCardConfig> {
    const ids = Object.keys(hass.states).filter((id) => id.startsWith("sensor.") && hass.states[id]!.attributes.device_class === "battery");
    return { entity: ids.find((id) => /solarbank|solix|akku|home_battery|powerstream|zendure|ecoflow/.test(id)) ?? ids[0] ?? "" };
  }

  public setConfig(config: HomeBatteryCardConfig): void {
    if (!config?.entity) throw new Error("ha-home-battery-card: 'entity' (Ladestand-Sensor) angeben");
    this._config = { ...config };
    this._cache = undefined;
    this._historyKey = "";
  }

  public getCardSize(): number {
    return 7;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._timer = window.setInterval(() => this._loadHistory(true), HISTORY_REFRESH_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._timer);
    this._historyKey = "";
  }

  private _t(key: string): string {
    return localize(this.hass, `home_battery.${key}`);
  }

  // ---------- Entitäten ----------

  private _features(): { f: HomeBatteryFeatures; strings: string[] } {
    const hass = this.hass!;
    const c = this._config!;
    if (!this._cache || this._cache.key !== hass.entities) {
      const r = homeBatteryFeatures(hass.states, hass.entities, hass.devices, c.entity);
      this._cache = { key: hass.entities, f: r.f, strings: r.strings };
    }
    const f: Record<string, string | undefined> = { ...this._cache.f, soc: c.entity };
    for (const k of KEYS) if (typeof c[k] === "string") f[k] = c[k] as string;
    return { f: f as HomeBatteryFeatures, strings: Array.isArray(c.strings) ? c.strings : this._cache.strings };
  }

  private _ids(): string[] {
    const { f, strings } = this._features();
    return [...Object.values(f), ...strings].filter(Boolean) as string[];
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this._config) return true;
    return this._ids().some((id) => old.states[id] !== this.hass!.states[id]) || old.locale !== this.hass!.locale || old.entities !== this.hass!.entities;
  }

  protected updated(): void {
    this._loadHistory();
  }

  private _st(id?: string): HassEntity | undefined {
    const st = id ? this.hass!.states[id] : undefined;
    return st && !UNAVAILABLE.includes(st.state) ? st : undefined;
  }

  private _num(id?: string): number | undefined {
    const st = this._st(id);
    if (!st) return undefined;
    const v = Number(st.state);
    return Number.isFinite(v) ? v : undefined;
  }

  /** Leistung in W (kW-Sensoren werden umgerechnet) */
  private _w(id?: string): number | undefined {
    const v = this._num(id);
    if (v == null) return undefined;
    return String(this._st(id)!.attributes.unit_of_measurement ?? "W") === "kW" ? v * 1000 : v;
  }

  /** Energie in Wh (kWh-Sensoren werden umgerechnet) */
  private _wh(id?: string): number | undefined {
    const v = this._num(id);
    if (v == null) return undefined;
    return /^kWh$/i.test(String(this._st(id)!.attributes.unit_of_measurement ?? "Wh")) ? v * 1000 : v;
  }

  private _fmt(v: number, digits = 0): string {
    return v.toLocaleString(getLanguage(this.hass), { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  }

  private _power(w: number): string {
    return Math.abs(w) >= 1000 ? `${this._fmt(w / 1000, 2)} kW` : `${this._fmt(w)} W`;
  }

  private _duration(min: number): string {
    if (min >= 48 * 60) return `${this._fmt(min / 1440, 0)} ${this._t("days_short")}`;
    if (min >= 600) return `${this._fmt(min / 60, 0)} h`;
    if (min >= 60) return `${Math.floor(min / 60)} h ${Math.round(min % 60)} min`;
    return `${Math.max(1, Math.round(min))} min`;
  }

  private _moreInfo(id?: string): void {
    if (!id) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  private async _refresh(id?: string): Promise<void> {
    if (!id || this._refreshing) return;
    window.dispatchEvent(new CustomEvent("haptic", { detail: "light" }));
    this._refreshing = true;
    try {
      await this.hass!.callService("button", "press", { entity_id: id });
    } catch (err: any) {
      this.dispatchEvent(new CustomEvent("hass-notification", {
        detail: { message: `${localize(this.hass, "card.error")}: ${err?.message ?? err}` }, bubbles: true, composed: true,
      }));
    }
    window.setTimeout(() => { this._refreshing = false; }, 1500);
  }

  // ---------- Verlauf ----------

  private async _loadHistory(force = false): Promise<void> {
    const c = this._config;
    if (!c || !this.hass?.callWS || c.show?.history === false) return;
    const { f } = this._features();
    const ids = [f.soc, f.solar].filter(Boolean) as string[];
    const hours = Math.max(1, c.hours_to_show ?? 48);
    const key = `${ids.join(",")}|${hours}`;
    if (!force && key === this._historyKey && Date.now() - this._historyAt < HISTORY_REFRESH_MS) return;
    this._historyKey = key;
    this._historyAt = Date.now();
    const start = new Date(Date.now() - hours * 3600_000);
    try {
      const res = await this.hass.callWS<Record<string, { s?: string; lu?: number; lc?: number }[]>>({
        type: "history/history_during_period", start_time: start.toISOString(), end_time: new Date().toISOString(),
        entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false,
      });
      const pts = (id?: string): Pt[] => (id ? (res?.[id] ?? []).map((p) => ({ t: Math.max((p.lu ?? p.lc ?? 0) * 1000, start.getTime()), v: Number(p.s) }))
        .filter((p) => Number.isFinite(p.v)) : []);
      this._history = { soc: pts(f.soc), solar: pts(f.solar) };
    } catch {
      /* Verlauf nicht verfügbar */
    }
  }

  // ---------- Darstellung ----------

  private _ring(soc: number, color: string, dir: string) {
    const r = 52, c = 2 * Math.PI * r;
    const p = Math.min(100, Math.max(0, soc)) / 100;
    return svg`<svg class="ring-svg" viewBox="0 0 120 120" aria-hidden="true">
      <circle class="r-track" cx="60" cy="60" r=${r}></circle>
      <circle class="r-fill ${dir}" cx="60" cy="60" r=${r} stroke=${color}
        stroke-dasharray=${`${(c * p).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 60 60)"></circle>
    </svg>`;
  }

  private _renderFlow(f: HomeBatteryFeatures, batteryW: number | undefined) {
    const solar = this._w(f.solar);
    const home = this._w(f.home);
    const grid = this._w(f.grid_charge);
    const socket = this._w(f.socket);
    if (solar == null && home == null) return nothing;
    const dur = (w?: number) => (w && w > 1 ? `${Math.max(0.5, 2.6 - Math.log10(w) * 0.7).toFixed(2)}s` : "0s");
    const node = (key: string, icon: string, color: string, w: number | undefined, id?: string, cls = "") =>
      html`<button class="node ${cls} ${w && w > 1 ? "on" : ""}" style="--nc:${color}" data-node=${key} @click=${() => this._moreInfo(id)}>
        <span class="n-ic"><ha-icon .icon=${icon}></ha-icon></span>
        <b>${w != null ? this._power(w) : "–"}</b><small>${this._t(`flow_${key}`)}</small></button>`;
    const wire = (w: number | undefined, color: string, key: string) =>
      html`<span class="wire ${w && w > 1 ? "on" : ""}" data-wire=${key} style="--wc:${color}; --dur:${dur(w)}"><i></i></span>`;
    const battDir = batteryW == null ? "" : batteryW > 1 ? "in" : batteryW < -1 ? "out" : "";
    return html`<div class="flow">
      ${node("solar", "mdi:solar-power-variant", SUN, solar, f.solar)}
      ${wire(solar, SUN, "solar")}
      <button class="node bank ${battDir}" style="--nc:var(--accent)" data-node="bank" @click=${() => this._moreInfo(f.battery_power ?? f.soc)}>
        <span class="n-ic"><ha-icon icon="mdi:home-battery-outline"></ha-icon></span>
        <b>${batteryW != null ? this._power(Math.abs(batteryW)) : "–"}</b>
        <small>${this._t(battDir === "in" ? "flow_charging" : battDir === "out" ? "flow_discharging" : "flow_bank")}</small></button>
      ${wire(home, HOME, "home")}
      ${node("home", "mdi:home-lightning-bolt-outline", HOME, home, f.home)}
    </div>
    ${(grid ?? 0) > 1 || (socket ?? 0) > 1 ? html`<div class="extras">
      ${(grid ?? 0) > 1 ? html`<button class="extra" style="--nc:${GRID}" @click=${() => this._moreInfo(f.grid_charge)}>
        <ha-icon icon="mdi:transmission-tower-import"></ha-icon>${this._t("grid_charge")}<b>${this._power(grid!)}</b></button>` : nothing}
      ${(socket ?? 0) > 1 ? html`<button class="extra" style="--nc:#26a69a" @click=${() => this._moreInfo(f.socket)}>
        <ha-icon icon="mdi:power-socket-de"></ha-icon>${this._t("socket")}<b>${this._power(socket!)}</b></button>` : nothing}
    </div>` : nothing}`;
  }

  private _renderStrings(strings: string[], solar?: number) {
    const rows = strings.map((id, i) => ({ id, w: this._w(id), name: String(this._st(id)?.attributes.name ?? `PV ${i + 1}`), named: !!this._st(id)?.attributes.name }))
      .filter((r) => r.w != null && (r.named || (r.w ?? 0) > 0));
    if (!rows.length) return nothing;
    const total = Math.max(solar ?? rows.reduce((a, r) => a + (r.w ?? 0), 0), 1);
    const max = Math.max(...rows.map((r) => r.w ?? 0), 1);
    return html`<div class="strings">
      <div class="sec-title"><ha-icon icon="mdi:solar-panel"></ha-icon><span>${this._t("strings")}</span></div>
      ${rows.map((r) => html`<button class="str" @click=${() => this._moreInfo(r.id)}>
        <span class="s-name">${r.name}</span>
        <span class="s-bar"><span style="width:${Math.min(100, ((r.w ?? 0) / max) * 100)}%"></span></span>
        <span class="s-val">${this._power(r.w ?? 0)}<small>${Math.round(((r.w ?? 0) / total) * 100)} %</small></span>
      </button>`)}
    </div>`;
  }

  private _renderStats(f: HomeBatteryFeatures) {
    const money = (id?: string) => {
      const v = this._num(id);
      if (v == null) return undefined;
      const unit = String(this._st(id)!.attributes.unit_of_measurement ?? "€");
      return `${this._fmt(v, 2)} ${unit}`;
    };
    const today = this._num(f.solar_today);
    const co2 = this._num(f.co2);
    const items = [
      { id: f.solar_today, icon: "mdi:white-balance-sunny", v: today != null ? `${this._fmt(today, today < 10 ? 2 : 1)} ${this._st(f.solar_today)!.attributes.unit_of_measurement ?? "kWh"}` : undefined, l: this._t("solar_today") },
      { id: f.savings_today, icon: "mdi:piggy-bank-outline", v: money(f.savings_today), l: this._t("savings_today") },
      { id: f.savings, icon: "mdi:cash-multiple", v: money(f.savings), l: this._t("savings") },
      { id: f.co2, icon: "mdi:molecule-co2", v: co2 != null ? `${this._fmt(co2, co2 < 100 ? 1 : 0)} ${this._st(f.co2)!.attributes.unit_of_measurement ?? "kg"}` : undefined, l: this._t("co2") },
    ].filter((x) => x.v);
    if (!items.length) return nothing;
    return html`<div class="stats" style="--n:${items.length}">${items.map((x) => html`<button class="stat" @click=${() => this._moreInfo(x.id)}>
      <ha-icon .icon=${x.icon}></ha-icon><b>${x.v}</b><small>${x.l}</small></button>`)}</div>`;
  }

  private _renderHistory() {
    const { soc, solar } = this._history;
    if (soc.length < 2 && solar.length < 2) return nothing;
    const hours = Math.max(1, this._config!.hours_to_show ?? 48);
    const W = 300, H = 70;
    const t1 = Date.now(), t0 = t1 - hours * 3600_000;
    const x = (t: number) => ((t - t0) / (t1 - t0)) * W;
    // Treppenlinie bis „jetzt“
    const step = (pts: Pt[], y: (v: number) => number) => {
      if (!pts.length) return "";
      let d = `M${x(pts[0]!.t).toFixed(1)},${y(pts[0]!.v).toFixed(1)}`;
      for (let i = 1; i < pts.length; i++) d += `H${x(pts[i]!.t).toFixed(1)}V${y(pts[i]!.v).toFixed(1)}`;
      return `${d}H${W}`;
    };
    const ySoc = (v: number) => H - 2 - (Math.min(100, Math.max(0, v)) / 100) * (H - 6);
    const maxSolar = Math.max(...solar.map((p) => p.v), 50);
    const ySolar = (v: number) => H - 2 - (Math.max(0, v) / maxSolar) * (H - 6);
    const socLine = step(soc, ySoc);
    const solarLine = step(solar, ySolar);
    return html`<div class="hist">
      <div class="sec-title"><ha-icon icon="mdi:chart-areaspline"></ha-icon><span>${this._t("history").replace("{n}", String(hours))}</span>
        <span class="legend"><i class="l-soc"></i>${this._t("soc")}${solar.length > 1 ? html`<i class="l-sun"></i>${this._t("flow_solar")}<span class="lmax">(max ${this._power(maxSolar)})</span>` : nothing}</span></div>
      <svg class="h-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label=${this._t("history").replace("{n}", String(hours))}>
        <defs><linearGradient id="hb-soc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity="0.35"></stop>
          <stop offset="1" stop-color="var(--accent)" stop-opacity="0.02"></stop></linearGradient></defs>
        ${[25, 50, 75].map((v) => svg`<line class="h-grid" x1="0" x2=${W} y1=${ySoc(v)} y2=${ySoc(v)}></line>`)}
        ${socLine ? svg`<path class="h-soc-area" d=${`${socLine}V${H}H${x(soc[0]!.t).toFixed(1)}Z`}></path><path class="h-soc" d=${socLine}></path>` : nothing}
        ${solarLine ? svg`<path class="h-sun" d=${solarLine}></path>` : nothing}
      </svg>
      <div class="h-axis"><span>−${hours} h</span><span>−${Math.round(hours / 2)} h</span><span>${this._t("now")}</span></div>
    </div>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const socSt = this.hass.states[c.entity];
    if (!socSt) return html`<ha-card class="hbat"><div class="missing">${this._t("missing")}: ${c.entity}</div></ha-card>`;
    const { f, strings } = this._features();
    const show = { flow: true, strings: true, stats: true, history: true, ...c.show };
    const soc = this._num(f.soc);
    const energy = this._wh(f.energy) ?? (soc != null && this._wh(f.capacity) != null ? (soc / 100) * this._wh(f.capacity)! : undefined);
    const capacity = this._wh(f.capacity);
    const charge = this._w(f.charge_power);
    const discharge = this._w(f.discharge_power);
    let batteryW = this._w(f.battery_power);
    if (batteryW == null && (charge != null || discharge != null)) batteryW = (charge ?? 0) - (discharge ?? 0);
    const status = batteryStatusKey(this._st(f.status)?.state, batteryW);
    const eta = status.dir === "charge" || status.dir === "discharge" ? batteryEta(energy, capacity, batteryW) : undefined;
    const level = soc ?? 0;
    const color = status.dir === "error" ? "var(--error-color, #e53935)" : level < 15 ? "var(--error-color, #e53935)" : level < 30 ? "#fb8c00" : "var(--success-color, #43a047)";
    const errSt = this._st(f.error);
    const errCode = errSt && !["0", "none", "ok", "no_error", "off"].includes(errSt.state.toLowerCase()) ? errSt.state : undefined;
    const cloudOff = this._st(f.cloud)?.state === "offline";
    const heating = this._st(f.heating)?.state === "on" || (this._w(f.heater) ?? 0) > 1;
    const modeSt = this._st(f.mode);
    const modeKey = modeSt ? `mode_${modeSt.state}` : "";
    const modeText = modeSt ? (this._t(modeKey) === `home_battery.${modeKey}` ? modeSt.state : this._t(modeKey)) : "";
    const devName = (() => {
      const dev = this.hass!.entities?.[c.entity]?.device_id;
      const d = dev ? this.hass!.devices?.[dev] : undefined;
      return d?.name_by_user || d?.name || undefined;
    })();
    const title = c.name ?? devName ?? this._t("title");
    const statusText = this._t(`st_${status.key}`);
    const sub = `${statusText}${eta != null ? ` · ${this._t(batteryW! > 0 ? "full_in" : "empty_in").replace("{t}", this._duration(eta))}` : ""}`;
    const battIcon = status.dir === "charge" ? "mdi:battery-charging" : level >= 95 ? "mdi:battery" : level < 10 ? "mdi:battery-alert-variant-outline" : BATT_ICONS[Math.min(8, Math.max(0, Math.round(level / 10) - 1))]!;
    return html`<ha-card class="hbat anim-${c.animations ?? "full"} ${status.dir}" style="--hcc-accent-c:${color}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <span class="h-icon"><ha-icon .icon=${battIcon}></ha-icon></span>
        <button class="head-text" @click=${() => this._moreInfo(f.status ?? f.soc)}>
          <span class="h-title">${title}</span>
          <span class="h-sub">${sub}</span>
        </button>
        ${modeText ? html`<button class="pill" @click=${() => this._moreInfo(f.mode)} title=${this._t("mode")}><ha-icon icon="mdi:tune-variant"></ha-icon>${modeText}</button>` : nothing}
        ${f.refresh ? html`<button class="refresh ${this._refreshing ? "spin" : ""}" aria-label=${this._t("refresh")} title=${this._t("refresh")}
          @click=${() => this._refresh(f.refresh)}><ha-icon icon="mdi:refresh"></ha-icon></button>` : nothing}
      </div>
      ${errCode || cloudOff || (soc != null && soc < 15) ? html`<div class="alerts">
        ${errCode ? html`<button class="alert bad" @click=${() => this._moreInfo(f.error)}><ha-icon icon="mdi:alert-circle"></ha-icon><span>${this._t("error")} ${errCode}</span></button>` : nothing}
        ${cloudOff ? html`<button class="alert warn" @click=${() => this._moreInfo(f.cloud)}><ha-icon icon="mdi:cloud-off-outline"></ha-icon><span>${this._t("cloud_offline")}</span></button>` : nothing}
        ${soc != null && soc < 15 ? html`<button class="alert warn" @click=${() => this._moreInfo(f.soc)}><ha-icon icon="mdi:battery-alert-variant-outline"></ha-icon><span>${this._t("low")}</span></button>` : nothing}
      </div>` : nothing}
      <div class="main">
        <button class="ring" @click=${() => this._moreInfo(f.soc)} aria-label=${`${this._t("soc")} ${soc ?? "–"} %`}>
          ${this._ring(level, color, status.dir)}
          <span class="r-in"><b>${soc != null ? Math.round(soc) : "–"}<small>%</small></b>
            ${energy != null ? html`<span>${this._fmt(energy)} Wh</span>` : nothing}${capacity ? html`<span class="cap">/ ${this._fmt(capacity)} Wh</span>` : nothing}</span>
        </button>
        <div class="facts">
          <div class="fact ${status.dir}">
            <ha-icon .icon=${status.dir === "charge" ? "mdi:arrow-up-bold-circle" : status.dir === "discharge" ? "mdi:arrow-down-bold-circle" : status.dir === "full" ? "mdi:check-circle" : "mdi:pause-circle"}></ha-icon>
            <span><b>${batteryW != null && Math.abs(batteryW) > 1 ? this._power(Math.abs(batteryW)) : statusText}</b>
              <small>${batteryW != null && Math.abs(batteryW) > 1 ? this._t(batteryW > 0 ? "flow_charging" : "flow_discharging") : this._t("battery")}</small></span>
          </div>
          ${eta != null ? html`<div class="fact"><ha-icon icon="mdi:timer-sand"></ha-icon>
            <span><b>${this._duration(eta)}</b><small>${this._t(batteryW! > 0 ? "until_full" : "until_empty")}</small></span></div>` : nothing}
          ${heating ? html`<div class="fact heat"><ha-icon icon="mdi:heat-wave"></ha-icon><span><b>${this._t("heating")}</b><small>${this._t("heating_hint")}</small></span></div>` : nothing}
        </div>
      </div>
      ${show.flow ? this._renderFlow(f, batteryW) : nothing}
      ${show.strings ? this._renderStrings(strings, this._w(f.solar)) : nothing}
      ${show.stats ? this._renderStats(f) : nothing}
      ${show.history ? this._renderHistory() : nothing}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.hbat { --accent: var(--hcc-accent-c); gap: 12px; container-type: inline-size; }
    ha-card.hbat.idle .blob, ha-card.hbat.full .blob { opacity: 0.55; animation-play-state: paused; }
    .missing { padding: 8px; color: var(--error-color, #e53935); }
    .header { display: flex; align-items: center; gap: 10px; }
    .h-icon { flex: none; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; color: var(--accent);
      background: color-mix(in srgb, var(--accent) 16%, transparent); transition: background 0.4s, color 0.4s; }
    .h-icon ha-icon { --mdc-icon-size: 24px; }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; border: none; background: none; padding: 0; text-align: left; cursor: pointer; }
    .h-title { font-size: 17px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .h-sub { font-size: 13px; font-weight: 600; color: var(--accent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pill { flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px 6px 8px; border: none; border-radius: 999px; cursor: pointer;
      font-size: 12.5px; font-weight: 700; background: rgba(127,127,127,0.1); white-space: nowrap; text-transform: capitalize; }
    .pill ha-icon { --mdc-icon-size: 16px; color: var(--secondary-text-color); }
    @container (max-width: 330px) { .pill { display: none; } }
    .refresh { flex: none; width: 34px; height: 34px; border-radius: 50%; border: none; padding: 0; display: grid; place-items: center; cursor: pointer;
      background: rgba(127,127,127,0.1); color: var(--secondary-text-color); }
    .refresh ha-icon { --mdc-icon-size: 18px; }
    .refresh.spin ha-icon { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .alerts { display: flex; flex-direction: column; gap: 6px; }
    .alert { --ac: #fb8c00; display: flex; align-items: center; gap: 10px; padding: 9px 12px; border: none; border-radius: var(--hcc-inner-radius, 14px); cursor: pointer;
      text-align: left; font-size: 13.5px; font-weight: 600; color: var(--ac); background: color-mix(in srgb, var(--ac) 13%, transparent); }
    .alert.bad { --ac: var(--error-color, #e53935); }
    .alert ha-icon { --mdc-icon-size: 20px; flex: none; }

    /* Ring + Fakten */
    .main { display: flex; align-items: center; gap: 16px; }
    .ring { position: relative; flex: none; width: clamp(110px, 34cqi, 150px); aspect-ratio: 1; border: none; padding: 0; background: none; cursor: pointer; }
    .ring-svg { width: 100%; height: 100%; display: block; }
    .r-track { fill: none; stroke: rgba(127,127,127,0.16); stroke-width: 10; }
    .r-fill { fill: none; stroke-width: 10; stroke-linecap: round; transition: stroke-dasharray 0.8s var(--ease-out), stroke 0.6s; }
    .r-fill.charge { animation: pulse-ring 2.4s ease-in-out infinite; }
    @keyframes pulse-ring { 50% { opacity: 0.65; } }
    ha-card.anim-reduced .r-fill, ha-card.anim-off .r-fill { animation: none; }
    .r-in { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
    .r-in b { font-size: clamp(26px, 9cqi, 36px); font-weight: 700; line-height: 1; letter-spacing: -0.02em; }
    .r-in b small { font-size: 0.5em; font-weight: 600; margin-left: 1px; color: var(--secondary-text-color); }
    .r-in span { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; }
    .r-in span.cap { font-size: 10px; opacity: 0.75; margin-top: -2px; }
    .facts { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
    .fact { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .fact > ha-icon { --mdc-icon-size: 26px; flex: none; color: var(--secondary-text-color); }
    .fact.charge > ha-icon { color: var(--success-color, #43a047); }
    .fact.discharge > ha-icon { color: #fb8c00; }
    .fact.full > ha-icon { color: var(--success-color, #43a047); }
    .fact.heat > ha-icon { color: #ff7043; }
    .fact span { display: flex; flex-direction: column; min-width: 0; }
    .fact b { font-size: clamp(15px, 4.6cqi, 19px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .fact small { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* Energiefluss */
    .flow { display: grid; grid-template-columns: minmax(0, 1fr) minmax(18px, 0.6fr) minmax(0, 1fr) minmax(18px, 0.6fr) minmax(0, 1fr); align-items: center;
      padding: 12px 10px; border-radius: var(--hcc-inner-radius, 14px); background: rgba(127,127,127,0.07); }
    .node { --nc: var(--secondary-text-color); display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 0; border: none; background: none; padding: 0; cursor: pointer; }
    .n-ic { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; color: var(--nc); border: 2px solid color-mix(in srgb, var(--nc) 35%, transparent);
      background: color-mix(in srgb, var(--nc) 10%, transparent); transition: border-color 0.4s, background 0.4s, box-shadow 0.4s; }
    .node.on .n-ic, .node.bank.in .n-ic, .node.bank.out .n-ic { border-color: var(--nc); background: color-mix(in srgb, var(--nc) 18%, transparent);
      box-shadow: 0 0 14px color-mix(in srgb, var(--nc) 35%, transparent); }
    .n-ic ha-icon { --mdc-icon-size: 24px; }
    .node b { font-size: 14px; white-space: nowrap; }
    .node small { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .wire { position: relative; height: 4px; border-radius: 2px; background: rgba(127,127,127,0.2); overflow: hidden; margin-bottom: 30px; }
    .wire.on { background: color-mix(in srgb, var(--wc) 30%, transparent); }
    .wire i { position: absolute; inset: 0; opacity: 0; }
    .wire.on i { opacity: 1; background: radial-gradient(circle, var(--wc) 0 2px, transparent 2.5px) 0 50% / 12px 4px repeat-x; animation: flow var(--dur) linear infinite; }
    @keyframes flow { from { background-position: 0 50%; } to { background-position: 12px 50%; } }
    ha-card.anim-reduced .wire i, ha-card.anim-off .wire i { animation: none; }
    .extras { display: flex; flex-wrap: wrap; gap: 6px; }
    .extra { --nc: #26a69a; display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border: none; border-radius: 999px; cursor: pointer;
      font-size: 12.5px; font-weight: 600; background: color-mix(in srgb, var(--nc) 12%, transparent); }
    .extra ha-icon { --mdc-icon-size: 16px; color: var(--nc); }
    .extra b { color: var(--nc); }

    /* PV-Strings */
    .sec-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--secondary-text-color); }
    .sec-title ha-icon { --mdc-icon-size: 16px; }
    .strings { display: flex; flex-direction: column; gap: 6px; }
    .str { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(40px, 1fr) auto; align-items: center; gap: 10px; padding: 4px 2px; border: none; background: none;
      cursor: pointer; text-align: left; }
    .s-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .s-bar { height: 8px; border-radius: 4px; background: rgba(127,127,127,0.16); overflow: hidden; }
    .s-bar span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #f9a825, #fbc02d); transition: width 0.8s var(--ease-out); }
    .s-val { font-size: 13px; font-weight: 700; white-space: nowrap; text-align: right; }
    .s-val small { margin-left: 6px; font-weight: 500; color: var(--secondary-text-color); }
    @container (max-width: 380px) { .str { grid-template-columns: minmax(0, 1fr) auto; row-gap: 4px; } .s-bar { grid-column: 1 / -1; grid-row: 2; } }

    /* Kacheln */
    .stats { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 8px; }
    @container (max-width: 420px) { .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } .stat:last-child:nth-child(odd) { grid-column: span 2; } }
    .stat { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; min-width: 0; padding: 10px; border: none; border-radius: var(--hcc-inner-radius, 14px);
      cursor: pointer; background: rgba(127,127,127,0.07); text-align: left; }
    .stat ha-icon { --mdc-icon-size: 18px; color: var(--secondary-text-color); }
    .stat b { font-size: clamp(14px, 4.4cqi, 17px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .stat small { font-size: 11.5px; line-height: 1.25; color: var(--secondary-text-color); }

    /* Verlauf */
    .hist { display: flex; flex-direction: column; gap: 4px; }
    .legend { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; text-transform: none; letter-spacing: 0; font-weight: 500; white-space: nowrap; overflow: hidden; }
    .hist .sec-title { flex-wrap: wrap; }
    .lmax { margin-left: 3px; }
    @container (max-width: 380px) { .lmax { display: none; } }
    .legend i { width: 10px; height: 3px; border-radius: 2px; display: inline-block; }
    .legend i + * { margin-right: 4px; }
    .l-soc { background: var(--accent); }
    .l-sun { background: #fbc02d; margin-left: 6px; }
    .h-svg { width: 100%; height: 70px; display: block; }
    .h-grid { stroke: rgba(127,127,127,0.15); stroke-width: 1; vector-effect: non-scaling-stroke; stroke-dasharray: 3 4; }
    .h-soc-area { fill: url(#hb-soc); }
    .h-soc { fill: none; stroke: var(--accent); stroke-width: 2; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
    .h-sun { fill: none; stroke: #fbc02d; stroke-width: 1.5; vector-effect: non-scaling-stroke; stroke-linejoin: round; opacity: 0.9; }
    .h-axis { display: flex; justify-content: space-between; font-size: 10.5px; color: var(--secondary-text-color); }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-home-battery-card": HaHomeBatteryCard;
  }
}
