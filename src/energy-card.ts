import { LitElement, css, html, nothing, svg, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { EnergyCardConfig, EnergyEntity, EnergyIndividualConfig, HomeAssistant } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import {
  batteryHoursLeft, batteryIcon, consumerGrid, energyFlows, formatHours, formatPower, integratePower, powerWatts, UNAVAILABLE, type EnergyFlows,
} from "./utils";
import "./energy-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-energy-card",
  name: "Modern Energy Card",
  description: "Energiefluss zwischen Solar, Batterie, Netz und Haus mit animierten Linien, beliebig vielen Verbrauchern, Tageswerten und Akku-Restzeit – Konfiguration wie power-flow-card-plus (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const COLORS = {
  solar: "#ffa000",
  grid: "#42a5f5",
  gridOut: "#ab47bc",
  battery: "#66bb6a",
  home: "var(--primary-color)",
  other: "#90a4ae",
};
const IND_COLORS = ["#d4e157", "#29b6f6", "#ff7043", "#ab47bc", "#26a69a", "#ec407a", "#ffca28", "#8d6e63"];

/** Hauptdiagramm im Koordinatensystem 300 × 270 (drei Spalten wie power-flow-card-plus) */
const VW = 300;
const MAIN_H = 270;
const R = 30;
const POS = { solar: [150, 50], grid: [50, 135], home: [250, 135], battery: [150, 220] } as const;
const PATHS: Record<string, string> = {
  solarHome: `M150,${50 + R} Q150,135 ${250 - R},135`,
  solarGrid: `M150,${50 + R} Q150,135 ${50 + R},135`,
  solarBattery: `M150,${50 + R} L150,${220 - R}`,
  gridHome: `M${50 + R},135 L${250 - R},135`,
  gridBattery: `M${50 + R},135 Q150,135 150,${220 - R}`,
  batteryHome: `M150,${220 - R} Q150,135 ${250 - R},135`,
};
/** Verbraucher unter dem Haus: Zeilenhöhe, Kreisradius */
const ROW_H = 92;
const CR = 24;
const HOLD_MS = 500;

type LabelPos = "above" | "below" | "none";
interface Flow { key: string; path: string; value: number; color: string; reverse?: boolean; }
interface Consumer { key: string; entity?: string; name: string; icon: string; color: string; w?: number; switchId?: string; other?: boolean; }

@customElement("ha-energy-card")
export class HaEnergyCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: EnergyCardConfig;
  /** Tagesenergie in Wh je Entität */
  @state() private _daily: Record<string, number> = {};
  private _dailyAt = 0;
  private _dailyTimer?: number;
  private _holdTimer?: number;
  private _held = false;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-energy-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<EnergyCardConfig> {
    const power = Object.values(hass.states).filter((s) => s.attributes.device_class === "power").map((s) => s.entity_id);
    const find = (re: RegExp) => power.find((id) => re.test(id));
    return { entities: { solar: { entity: find(/solar|pv/) ?? power[0] ?? "" }, grid: { entity: find(/grid|netz/) ?? power[1] ?? "" } } };
  }

  public setConfig(config: EnergyCardConfig): void {
    if (!config?.entities || (!config.entities.solar && !config.entities.grid && !config.entities.battery && !config.entities.home)) {
      throw new Error("ha-energy-card: 'entities' mit solar/grid/battery/home angeben");
    }
    this._config = { ...config };
    this._dailyAt = 0;
  }

  public getCardSize(): number {
    return this._config?.layout === "compact" ? 2 : 6 + Math.ceil((this._config?.entities.individual?.length ?? 0) / 4) * 2;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._dailyTimer = window.setInterval(() => this._loadDaily(), 5 * 60_000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._dailyTimer);
    clearTimeout(this._holdTimer);
  }

  private _t(key: string): string {
    return localize(this.hass, `energy.${key}`);
  }

  private _both(x?: EnergyEntity): string[] {
    return (typeof x === "string" ? [x] : x ? [x.consumption, x.production] : []).filter(Boolean) as string[];
  }

  /** Leistungs-Entitäten (für Tageswerte) */
  private _powerIds(): string[] {
    const e = this._config!.entities;
    return [e.solar?.entity, ...this._both(e.battery?.entity), ...this._both(e.grid?.entity), e.home?.entity,
      ...(e.individual ?? []).map((i) => i.entity)].filter(Boolean) as string[];
  }

  private _ids(): string[] {
    const e = this._config!.entities;
    const cap = typeof e.battery?.capacity === "string" ? e.battery.capacity : undefined;
    return [...this._powerIds(), e.battery?.state_of_charge, cap, ...(e.individual ?? []).map((i) => i.switch)].filter(Boolean) as string[];
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this._config) return true;
    return this._ids().some((id) => old.states[id] !== this.hass!.states[id]) || old.locale !== this.hass!.locale;
  }

  protected updated(): void {
    if (this._config && this.hass && Date.now() - this._dailyAt > 5 * 60_000) this._loadDaily();
  }

  /** Tageswerte: Leistungsverlauf seit Mitternacht integrieren (keine Energie-Sensoren nötig). */
  private async _loadDaily(): Promise<void> {
    if (!this.hass?.callWS || this._config?.show_daily === false || this._config?.layout === "compact") return;
    this._dailyAt = Date.now();
    const ids = [...new Set(this._powerIds())];
    if (!ids.length) return;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    try {
      const res = await this.hass.callWS<Record<string, { s?: string; state?: string; lu?: number; last_updated?: string; lc?: number }[]>>({
        type: "history/history_during_period", start_time: start.toISOString(), end_time: new Date().toISOString(),
        entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false,
      });
      const daily: Record<string, number> = {};
      for (const id of ids) {
        const unit = String(this.hass.states[id]?.attributes.unit_of_measurement ?? "W").toLowerCase();
        const factor = unit === "kw" ? 1000 : 1;
        const pts = (res?.[id] ?? []).map((p) => ({
          t: p.lu != null ? p.lu * 1000 : p.lc != null ? p.lc * 1000 : new Date(p.last_updated ?? 0).getTime(),
          w: Number(p.s ?? p.state) * factor,
        }));
        // Der erste Eintrag kann vor Mitternacht liegen
        if (pts.length && pts[0]!.t < start.getTime()) pts[0]!.t = start.getTime();
        daily[id] = integratePower(pts, Date.now());
      }
      this._daily = daily;
    } catch {
      /* Verlauf nicht verfügbar – Tageswerte bleiben leer */
    }
  }

  private _w(id?: string): number | undefined {
    return id ? powerWatts(this.hass!.states[id]) : undefined;
  }

  /** Richtungsgetrennte Werte: [in Richtung Haus / Bezug, Gegenrichtung] */
  private _split(x: EnergyEntity | undefined, invert = false): [number | undefined, number | undefined] {
    if (!x) return [undefined, undefined];
    if (typeof x === "string") {
      const v = this._w(x);
      if (v == null) return [undefined, undefined];
      const s = invert ? -v : v;
      return [Math.max(0, s), Math.max(0, -s)];
    }
    return [this._w(x.consumption), this._w(x.production)];
  }

  private _fmt(w?: number): string {
    if (w == null) return "–";
    const c = this._config!;
    return formatPower(w, getLanguage(this.hass), c.watt_threshold ?? 1000, c.w_decimals ?? 0, c.kw_decimals ?? 1);
  }

  private _kwh(wh?: number): string {
    if (wh == null) return "";
    const lang = getLanguage(this.hass);
    return wh < 1000 ? `${Math.round(wh).toLocaleString(lang)} Wh` : `${(wh / 1000).toLocaleString(lang, { maximumFractionDigits: wh < 10000 ? 2 : 1 })} kWh`;
  }

  private _moreInfo(id?: string): void {
    if (!id || this._config?.clickable_entities === false) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  private _firstId(x?: EnergyEntity): string | undefined {
    return typeof x === "string" ? x : x?.consumption ?? x?.production;
  }

  private _capacityWh(): number | undefined {
    const cap = this._config!.entities.battery?.capacity;
    if (cap == null) return undefined;
    if (typeof cap === "number") return cap * 1000;
    const st = this.hass!.states[cap];
    const v = Number(st?.state);
    if (!st || !Number.isFinite(v)) return undefined;
    return String(st.attributes.unit_of_measurement ?? "Wh").toLowerCase() === "kwh" ? v * 1000 : v;
  }

  // ---------- Verbraucher ----------

  private _consumers(home: number): Consumer[] {
    const list = (this._config!.entities.individual ?? []) as EnergyIndividualConfig[];
    const hide = this._config!.hide_inactive_consumers !== false;
    const out: Consumer[] = list.map((i, idx) => {
      const st = this.hass!.states[i.entity];
      return { key: `c${idx}`, entity: i.entity, name: i.name ?? st?.attributes.friendly_name ?? i.entity, icon: i.icon ?? st?.attributes.icon ?? "mdi:flash",
        color: i.color ?? IND_COLORS[idx % IND_COLORS.length]!, w: powerWatts(st), switchId: i.switch };
    }).filter((c, idx) => !hide || list[idx]!.display_zero === true || (c.w ?? 0) > 0.5);
    if (list.length && this._config!.show_other !== false && this._config!.entities.home) {
      const rest = home - out.reduce((s, c) => s + (c.w ?? 0), 0);
      if (rest > 5) out.push({ key: "other", name: this._t("other"), icon: "mdi:dots-horizontal-circle-outline", color: COLORS.other, w: rest, other: true });
    }
    return out;
  }

  private _holdStart(ev: PointerEvent, c: Consumer): void {
    if (ev.button !== 0 || !c.switchId) return;
    this._held = false;
    clearTimeout(this._holdTimer);
    this._holdTimer = window.setTimeout(() => {
      this._held = true;
      window.dispatchEvent(new CustomEvent("haptic", { detail: "medium" }));
      this.hass!.callService("homeassistant", "toggle", { entity_id: c.switchId });
    }, HOLD_MS);
  }

  private _holdEnd = (): void => clearTimeout(this._holdTimer);

  private _consumerTap(c: Consumer): void {
    if (this._held) { this._held = false; return; }
    this._moreInfo(c.entity);
  }

  // ---------- Render ----------

  private _renderFlows(flows: Flow[]) {
    const c = this._config!;
    // Geschwindigkeit nach Leistung (wie use_new_flow_rate_model): wenig Watt = langsam
    const maxPower = Number(c.max_expected_power ?? 2000) || 2000;
    const minRate = c.min_flow_rate ?? 0.75;
    const maxRate = c.max_flow_rate ?? 6;
    const anim = (c.animations ?? "full") !== "off";
    const trail = (c.animations ?? "full") === "full";
    return svg`${flows.map((f) => {
      const active = f.value > 0.5;
      if (!active && c.display_zero_lines === false) return nothing;
      const share = Math.min(1, f.value / maxPower);
      const dur = maxRate - (maxRate - minRate) * share;
      const width = active ? 1.8 + share * 2.4 : 1.4;
      const motion = (delay: number) => svg`<animateMotion dur=${`${dur.toFixed(2)}s`} begin=${`${delay.toFixed(2)}s`} repeatCount="indefinite"
        keyPoints=${f.reverse ? "1;0" : "0;1"} keyTimes="0;1" calcMode="linear"><mpath href=${`#p-${f.key}`}></mpath></animateMotion>`;
      return svg`<path id=${`p-${f.key}`} class="line ${active ? "active" : ""}" d=${f.path} style="--fc:${f.color};stroke-width:${width.toFixed(2)}"></path>
        ${active && anim ? svg`
          ${trail ? svg`<circle class="dot trail2" r="2" style="--fc:${f.color}">${motion(-0.2)}</circle>
            <circle class="dot trail1" r="2.6" style="--fc:${f.color}">${motion(-0.1)}</circle>` : nothing}
          <circle class="dot" r=${(3 + share * 1.2).toFixed(1)} style="--fc:${f.color}">${motion(0)}</circle>` : nothing}`;
    })}`;
  }

  private _node(key: string, x: number, y: number, vh: number, opts: { icon: string; value: string; label: string; color: string; entity?: string; sub?: string;
    sub2?: string; ring?: string; dim?: boolean; active?: boolean; labelPos?: LabelPos; small?: boolean; consumer?: Consumer; switchOn?: boolean }) {
    const pos = opts.labelPos ?? "below";
    const c = opts.consumer;
    return html`<button class="node n-${key} ${opts.small ? "small" : ""} ${opts.dim ? "dim" : ""} ${opts.active ? "active" : ""}"
      style="left:${(x / VW) * 100}%;top:${(y / vh) * 100}%;--nc:${opts.color};${opts.ring ? `--ring:${opts.ring}` : ""}"
      title=${opts.label} @click=${() => (c ? this._consumerTap(c) : this._moreInfo(opts.entity))}
      @pointerdown=${(e: PointerEvent) => c && this._holdStart(e, c)} @pointerup=${this._holdEnd} @pointerleave=${this._holdEnd} @pointercancel=${this._holdEnd}
      @contextmenu=${(e: Event) => { if (c?.switchId) e.preventDefault(); }}>
      <span class="ring"></span>
      <ha-icon .icon=${opts.icon}></ha-icon>
      <span class="val">${opts.value}</span>
      ${opts.sub ? html`<span class="sub">${opts.sub}</span>` : nothing}
      ${opts.sub2 ? html`<span class="sub sub2">${opts.sub2}</span>` : nothing}
      ${opts.switchOn != null ? html`<span class="sw ${opts.switchOn ? "on" : ""}" title=${this._t(opts.switchOn ? "switch_on" : "switch_off")}><ha-icon icon="mdi:power"></ha-icon></span>` : nothing}
    </button>
    ${pos !== "none" ? html`<span class="label ${pos} ${opts.small ? "small" : ""}" style="left:${(x / VW) * 100}%;top:${(y / vh) * 100}%">${opts.label}</span>` : nothing}`;
  }

  private _homeRing(f: EnergyFlows): string {
    const total = f.solarToHome + f.batteryToHome + f.gridToHome;
    if (total <= 0) return `conic-gradient(color-mix(in srgb, var(--primary-color) 60%, transparent) 0 100%)`;
    const a = (f.solarToHome / total) * 100;
    const b = a + (f.batteryToHome / total) * 100;
    return `conic-gradient(${COLORS.solar} 0 ${a}%, ${COLORS.battery} ${a}% ${b}%, ${COLORS.grid} ${b}% 100%)`;
  }

  private _renderDaily() {
    const c = this._config!;
    if (c.show_daily === false || !Object.keys(this._daily).length) return nothing;
    const e = c.entities;
    const d = (id?: string) => (id ? this._daily[id] : undefined);
    const grid = e.grid?.entity;
    const bat = e.battery?.entity;
    const [gIn, gOut] = typeof grid === "string" ? [d(grid), undefined] : [d(grid?.consumption), d(grid?.production)];
    const [bOut, bIn] = typeof bat === "string" ? [d(bat), undefined] : [d(bat?.consumption), d(bat?.production)];
    const items = [
      e.solar ? { icon: "mdi:solar-power-variant", color: COLORS.solar, label: this._t("solar"), value: this._kwh(d(e.solar.entity)) } : undefined,
      e.home?.entity ? { icon: "mdi:home-lightning-bolt-outline", color: "var(--primary-color)", label: this._t("home"), value: this._kwh(d(e.home.entity)) } : undefined,
      grid ? { icon: "mdi:transmission-tower", color: COLORS.grid, label: this._t("grid"),
        value: [gIn != null && (gIn >= 1 || !(gOut && gOut >= 1)) ? `↓ ${this._kwh(gIn)}` : "", gOut != null && gOut >= 1 ? `↑ ${this._kwh(gOut)}` : ""].filter(Boolean).join(" · ") } : undefined,
      bat ? { icon: "mdi:home-battery-outline", color: COLORS.battery, label: this._t("battery"),
        value: [bIn != null && (bIn >= 1 || !(bOut && bOut >= 1)) ? `+${this._kwh(bIn)}` : "", bOut != null && bOut >= 1 ? `−${this._kwh(bOut)}` : ""].filter(Boolean).join(" · ") } : undefined,
    ].filter((x): x is { icon: string; color: string; label: string; value: string } => !!x && !!x.value);
    if (!items.length) return nothing;
    return html`<div class="daily">
      <span class="daily-title"><ha-icon icon="mdi:calendar-today"></ha-icon>${this._t("today")}</span>
      <div class="daily-items">${items.map((i) => html`<span class="day-item" style="--ic:${i.color}">
        <ha-icon .icon=${i.icon}></ha-icon><span class="day-label">${i.label}</span><span class="day-val">${i.value}</span></span>`)}</div>
    </div>`;
  }

  private _renderCompact(f: EnergyFlows, v: { solarW?: number; soc?: number; batIn: number; batOut: number; gridIn: number; gridOut: number }) {
    const e = this._config!.entities;
    const tiles = [
      e.solar ? { icon: "mdi:solar-power-variant", color: COLORS.solar, value: this._fmt(v.solarW ?? 0), label: this._t("solar"), entity: e.solar.entity, on: (v.solarW ?? 0) > 0.5 } : undefined,
      e.battery ? { icon: v.soc != null ? batteryIcon(v.soc, v.batIn > 0.5) : "mdi:home-battery-outline", color: COLORS.battery,
        value: v.soc != null ? `${v.soc} %` : this._fmt(v.batOut || v.batIn), label: v.batIn > 0.5 ? `+${this._fmt(v.batIn)}` : v.batOut > 0.5 ? `−${this._fmt(v.batOut)}` : this._t("battery"),
        entity: e.battery.state_of_charge ?? this._firstId(e.battery.entity), on: v.batIn + v.batOut > 0.5 } : undefined,
      e.grid ? { icon: "mdi:transmission-tower", color: v.gridOut > 0.5 ? COLORS.gridOut : COLORS.grid, value: this._fmt(v.gridOut > 0.5 ? v.gridOut : v.gridIn),
        label: v.gridOut > 0.5 ? this._t("export") : this._t("grid"), entity: this._firstId(e.grid.entity), on: v.gridIn + v.gridOut > 0.5 } : undefined,
      { icon: "mdi:home-lightning-bolt-outline", color: "var(--primary-color)", value: this._fmt(f.home), label: this._t("home"), entity: e.home?.entity, on: true },
    ].filter((x): x is NonNullable<typeof x> => !!x);
    return html`<div class="compact-row">${tiles.map((t) => html`<button class="ctile ${t.on ? "on" : ""}" style="--nc:${t.color}" @click=${() => this._moreInfo(t.entity)}>
      <span class="c-icon"><ha-icon .icon=${t.icon}></ha-icon></span><span class="c-val">${t.value}</span><span class="c-label">${t.label}</span></button>`)}</div>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const e = c.entities;
    const solarW = this._w(e.solar?.entity);
    const [batOut, batIn] = this._split(e.battery?.entity, e.battery?.invert_state);
    const [gridIn, gridOut] = this._split(e.grid?.entity, e.grid?.invert_state);
    const homeW = this._w(e.home?.entity);
    const f = energyFlows({ solar: solarW, gridImport: gridIn, gridExport: gridOut, batteryCharge: batIn, batteryDischarge: batOut, home: homeW });
    const socSt = e.battery?.state_of_charge ? this.hass.states[e.battery.state_of_charge] : undefined;
    const soc = socSt && !UNAVAILABLE.includes(socSt.state) ? Math.round(Number(socSt.state)) : undefined;
    const anim = c.animations ?? "full";
    const pill = f.autarky != null ? html`<span class="pill" title=${this._t("autarky")}><ha-icon icon="mdi:leaf"></ha-icon>${this._t("autarky")} ${f.autarky} %</span>` : nothing;

    if (c.layout === "compact") {
      return html`<ha-card class="energy compact anim-${anim}">
        ${c.title || f.autarky != null ? html`<div class="head">${c.title ? html`<span class="title-text">${c.title}</span>` : html`<span></span>`}${pill}</div>` : nothing}
        ${this._renderCompact(f, { solarW, soc, batIn: batIn ?? 0, batOut: batOut ?? 0, gridIn: gridIn ?? 0, gridOut: gridOut ?? 0 })}
      </ha-card>`;
    }

    const has = { solar: !!e.solar, grid: !!e.grid, battery: !!e.battery };
    const consumers = this._consumers(f.home);
    const grid = consumerGrid(consumers.length, Math.max(1, Math.min(6, c.consumer_columns ?? 4)));
    const rows = consumers.length ? Math.max(...grid.map((g) => g.row)) + 1 : 0;
    const vh = MAIN_H + rows * ROW_H;

    const flows: Flow[] = [];
    if (has.solar) flows.push({ key: "sh", path: PATHS.solarHome, value: f.solarToHome, color: COLORS.solar });
    if (has.solar && has.grid) flows.push({ key: "sg", path: PATHS.solarGrid, value: f.solarToGrid, color: COLORS.solar });
    if (has.solar && has.battery) flows.push({ key: "sb", path: PATHS.solarBattery, value: f.solarToBattery, color: COLORS.solar });
    if (has.grid) flows.push({ key: "gh", path: PATHS.gridHome, value: f.gridToHome, color: COLORS.grid });
    if (has.grid && has.battery) {
      flows.push({ key: "gb", path: PATHS.gridBattery, value: f.gridToBattery, color: COLORS.grid });
      if (f.batteryToGrid > 0.5) flows.push({ key: "bg", path: PATHS.gridBattery, value: f.batteryToGrid, color: COLORS.battery, reverse: true });
    }
    if (has.battery) flows.push({ key: "bh", path: PATHS.batteryHome, value: f.batteryToHome, color: COLORS.battery });
    // Verbraucher: vom Haus nach unten zur Sammelleitung der Zeile, dann zum Kreis
    consumers.forEach((cons, i) => {
      const g = grid[i]!;
      const bus0 = MAIN_H + 6;
      const bus = MAIN_H + g.row * ROW_H + 6;
      const top = bus + 16;
      // Weitere Zeilen: am rechten Rand entlang, damit die Leitung keine Kreise kreuzt
      const via = g.row === 0 ? `L250,${bus}` : `L250,${bus0} L${VW - 4},${bus0} L${VW - 4},${bus}`;
      flows.push({ key: cons.key, path: `M250,${135 + R} ${via} L${g.x.toFixed(1)},${bus} L${g.x.toFixed(1)},${top}`, value: cons.w ?? 0, color: cons.color });
    });

    const batState = (batIn ?? 0) > 0.5 ? this._t("charging") : (batOut ?? 0) > 0.5 ? this._t("discharging") : this._t("idle");
    const gridState = (gridOut ?? 0) > 0.5 ? this._t("export") : this._t("import");
    const gridValue = (gridOut ?? 0) > 0.5 ? gridOut : gridIn;
    const hours = batteryHoursLeft(soc, this._capacityWh(), batIn ?? 0, batOut ?? 0, e.battery?.min_soc ?? 0);
    const batTime = hours != null ? ((batOut ?? 0) > 1 ? `${this._t("left")} ${formatHours(hours)}` : `${this._t("full")} ${formatHours(hours)}`) : undefined;
    const P = POS;

    return html`<ha-card class="energy anim-${anim}">
      ${c.title || f.autarky != null ? html`<div class="head">${c.title ? html`<span class="title-text">${c.title}</span>` : html`<span></span>`}${pill}</div>` : nothing}
      <div class="flow" style="aspect-ratio:${VW} / ${vh}">
        <svg viewBox="0 0 ${VW} ${vh}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${this._renderFlows(flows)}</svg>
        ${has.solar ? this._node("solar", P.solar[0], P.solar[1], vh, { icon: e.solar?.icon ?? "mdi:solar-power-variant", value: this._fmt(solarW ?? 0),
          label: e.solar?.name ?? this._t("solar"), color: COLORS.solar, entity: e.solar?.entity, dim: !(solarW && solarW > 0.5),
          active: !!(solarW && solarW > 0.5), labelPos: "above" }) : nothing}
        ${has.grid ? this._node("grid", P.grid[0], P.grid[1], vh, { icon: e.grid?.icon ?? "mdi:transmission-tower", value: this._fmt(gridValue ?? 0),
          label: e.grid?.name ?? this._t("grid"), sub: gridState, color: (gridOut ?? 0) > 0.5 ? COLORS.gridOut : COLORS.grid,
          entity: this._firstId(e.grid?.entity), dim: !((gridValue ?? 0) > 0.5) }) : nothing}
        ${this._node("home", P.home[0], P.home[1], vh, { icon: e.home?.icon ?? "mdi:home-lightning-bolt-outline", value: this._fmt(f.home),
          label: e.home?.name ?? this._t("home"), color: COLORS.home, entity: e.home?.entity, ring: this._homeRing(f), labelPos: "none" })}
        ${has.battery ? this._node("battery", P.battery[0], P.battery[1], vh, {
          icon: soc != null ? batteryIcon(soc, (batIn ?? 0) > 0.5) : e.battery?.icon ?? "mdi:home-battery-outline",
          value: soc != null ? `${soc} %` : this._fmt((batOut ?? 0) || (batIn ?? 0)),
          sub: soc != null ? `${batState} · ${this._fmt((batOut ?? 0) > 0.5 ? batOut : batIn ?? 0)}` : batState, sub2: batTime,
          label: e.battery?.name ?? this._t("battery"), color: COLORS.battery, entity: e.battery?.state_of_charge ?? this._firstId(e.battery?.entity),
          active: (batIn ?? 0) + (batOut ?? 0) > 0.5,
          ring: soc != null ? `conic-gradient(${COLORS.battery} 0 ${soc}%, color-mix(in srgb, ${COLORS.battery} 18%, transparent) ${soc}% 100%)` : undefined }) : nothing}
        ${consumers.map((cons, i) => {
          const g = grid[i]!;
          const cy = MAIN_H + g.row * ROW_H + 22 + CR;
          const sw = cons.switchId ? this.hass!.states[cons.switchId] : undefined;
          const day = cons.entity ? this._daily[cons.entity] : undefined;
          return this._node(cons.key, g.x, cy, vh, { icon: cons.icon, value: cons.w == null ? "–" : this._fmt(cons.w), label: cons.name, color: cons.color,
            entity: cons.entity, dim: !((cons.w ?? 0) > 0.5), small: true, consumer: cons, sub: day != null && day >= 1 ? this._kwh(day) : undefined,
            switchOn: sw && !UNAVAILABLE.includes(sw.state) ? sw.state === "on" : undefined });
        })}
      </div>
      ${this._renderDaily()}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.energy { gap: 10px; padding: 14px 14px 16px; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .title-text { font-size: 17px; font-weight: 600; }
    .pill { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px 4px 8px; border-radius: 999px; font-size: 12.5px; font-weight: 600;
      color: var(--success-color, #43a047); background: color-mix(in srgb, var(--success-color, #43a047) 14%, transparent); }
    .pill ha-icon { --mdc-icon-size: 15px; }
    .flow { position: relative; width: 100%; container-type: inline-size; }
    .flow svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    .line { fill: none; stroke: color-mix(in srgb, var(--secondary-text-color) 22%, transparent); stroke-linecap: round; stroke-linejoin: round;
      transition: stroke 0.6s, stroke-width 0.6s; }
    .line.active { stroke: color-mix(in srgb, var(--fc) 55%, transparent); }
    .dot { fill: var(--fc); filter: drop-shadow(0 0 3px var(--fc)); }
    .dot.trail1 { opacity: 0.45; filter: none; }
    .dot.trail2 { opacity: 0.2; filter: none; }
    .node { position: absolute; width: 20%; aspect-ratio: 1; transform: translate(-50%, -50%); border-radius: 50%; border: none; padding: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; cursor: pointer; font: inherit; color: var(--primary-text-color);
      background: var(--card-background-color, var(--ha-card-background, #fff)); transition: transform 0.25s var(--ease-spring), opacity 0.4s; z-index: 1;
      user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
    .node.small { width: 16%; }
    .node:hover { transform: translate(-50%, -50%) scale(1.05); }
    .node:focus-visible { outline: 2px solid var(--nc); outline-offset: 3px; }
    .node .ring { position: absolute; inset: 0; border-radius: 50%; padding: 3px; pointer-events: none;
      background: var(--ring, var(--nc)); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
    .node::before { content: ""; position: absolute; inset: 3px; border-radius: 50%; background: color-mix(in srgb, var(--nc) 10%, transparent); }
    .node.active::after { content: ""; position: absolute; inset: -2px; border-radius: 50%; border: 2px solid var(--nc); opacity: 0; pointer-events: none;
      animation: pulse 3s ease-out infinite; }
    @keyframes pulse { 0% { transform: scale(1); opacity: 0.55; } 80%, 100% { transform: scale(1.22); opacity: 0; } }
    .node > * { position: relative; }
    .node ha-icon { --mdc-icon-size: clamp(16px, 7cqi, 26px); color: var(--nc); }
    .node.small ha-icon { --mdc-icon-size: clamp(14px, 5.6cqi, 22px); }
    .node .val { font-size: clamp(10px, 4.1cqi, 15px); font-weight: 700; line-height: 1.1; white-space: nowrap; }
    .node.small .val { font-size: clamp(9px, 3.4cqi, 13px); }
    .node .sub { font-size: clamp(8px, 2.6cqi, 11px); color: var(--secondary-text-color); white-space: nowrap; max-width: 92%; overflow: hidden; text-overflow: ellipsis; }
    .node.small .sub { font-size: clamp(7px, 2.3cqi, 10px); }
    .node .sub2 { color: var(--nc); font-weight: 600; }
    .node.dim { opacity: 0.6; }
    .n-home .ring { padding: 4px; }
    .sw { position: absolute; top: -2%; right: -2%; width: 30%; aspect-ratio: 1; border-radius: 50%; display: grid; place-items: center;
      background: var(--card-background-color, #fff); box-shadow: 0 0 0 1.5px rgba(127,127,127,0.35); }
    .sw ha-icon { --mdc-icon-size: clamp(9px, 3cqi, 13px) !important; color: var(--secondary-text-color) !important; }
    .sw.on { box-shadow: 0 0 0 1.5px var(--success-color, #43a047); }
    .sw.on ha-icon { color: var(--success-color, #43a047) !important; }
    .label { position: absolute; font-size: clamp(10px, 3.6cqi, 13px); font-weight: 600; color: var(--secondary-text-color); white-space: nowrap; pointer-events: none; }
    .label.small { font-size: clamp(9px, 3.2cqi, 12px); max-width: 24cqi; overflow: hidden; text-overflow: ellipsis; text-align: center; }
    .label.above { transform: translate(-50%, calc(-100% - 10cqi - 4px)); }
    .label.below { transform: translate(-50%, calc(10cqi + 4px)); }
    .label.small.below { transform: translate(-50%, calc(8cqi + 3px)); }
    .daily { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: var(--hcc-inner-radius, 14px); background: rgba(127,127,127,0.07); }
    .daily-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--secondary-text-color); }
    .daily-title ha-icon { --mdc-icon-size: 15px; }
    .daily-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 6px 12px; }
    .day-item { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 13px; }
    .day-item ha-icon { --mdc-icon-size: 17px; color: var(--ic); flex: none; }
    .day-label { color: var(--secondary-text-color); }
    .day-val { margin-left: auto; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .compact-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); gap: 8px; }
    .ctile { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 10px 6px; border: none; border-radius: var(--hcc-inner-radius, 14px);
      background: rgba(127,127,127,0.08); cursor: pointer; font: inherit; color: inherit; transition: background 0.3s; }
    .ctile.on { background: color-mix(in srgb, var(--nc) 14%, rgba(127,127,127,0.05)); }
    .c-icon { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: var(--nc); background: color-mix(in srgb, var(--nc) 18%, transparent); }
    .c-icon ha-icon { --mdc-icon-size: 20px; }
    .c-val { font-size: 14px; font-weight: 700; white-space: nowrap; }
    .c-label { font-size: 11.5px; color: var(--secondary-text-color); white-space: nowrap; }
    ha-card.anim-reduced .node.active::after, ha-card.anim-off .node.active::after { animation: none; }
    ha-card.anim-off .node, ha-card.anim-off .line { transition: none; }
  `];
}
