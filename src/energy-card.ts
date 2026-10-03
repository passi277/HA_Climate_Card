import { LitElement, css, html, nothing, svg, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { EnergyCardConfig, EnergyEntity, HomeAssistant } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { batteryIcon, energyFlows, formatPower, powerWatts, UNAVAILABLE, type EnergyFlows } from "./utils";
import "./energy-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-energy-card",
  name: "Modern Energy Card",
  description: "Energiefluss zwischen Solar, Batterie, Netz und Haus mit animierten Linien und einzelnen Verbrauchern – Konfiguration wie power-flow-card-plus (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const COLORS = {
  solar: "#ffa000",
  grid: "#42a5f5",
  gridOut: "#ab47bc",
  battery: "#66bb6a",
  home: "var(--primary-color)",
};

/** Knoten im Koordinatensystem 300 × 240 */
const POS = { solar: [150, 40], grid: [42, 125], home: [258, 125], battery: [150, 205] } as const;
const R = 30;
const PATHS: Record<string, string> = {
  solarHome: `M150,${40 + R} Q150,125 ${258 - R},125`,
  solarGrid: `M150,${40 + R} Q150,125 ${42 + R},125`,
  solarBattery: `M150,${40 + R} L150,${205 - R}`,
  gridHome: `M${42 + R},125 L${258 - R},125`,
  gridBattery: `M${42 + R},125 Q150,125 150,${205 - R}`,
  batteryHome: `M150,${205 - R} Q150,125 ${258 - R},125`,
};

interface Flow { key: string; path: string; value: number; color: string; reverse?: boolean; }

@customElement("ha-energy-card")
export class HaEnergyCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: EnergyCardConfig;

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
  }

  public getCardSize(): number {
    return 6;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  private _t(key: string): string {
    return localize(this.hass, `energy.${key}`);
  }

  private _ids(): string[] {
    const e = this._config!.entities;
    const fromEntity = (x?: EnergyEntity) => (typeof x === "string" ? [x] : x ? [x.consumption, x.production] : []);
    return [e.solar?.entity, ...fromEntity(e.battery?.entity), e.battery?.state_of_charge, ...fromEntity(e.grid?.entity), e.home?.entity,
      ...(e.individual ?? []).map((i) => i.entity)].filter(Boolean) as string[];
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this._config) return true;
    return this._ids().some((id) => old.states[id] !== this.hass!.states[id]) || old.locale !== this.hass!.locale;
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

  private _moreInfo(id?: string): void {
    if (!id || this._config?.clickable_entities === false) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  private _firstId(x?: EnergyEntity): string | undefined {
    return typeof x === "string" ? x : x?.consumption ?? x?.production;
  }

  // ---------- Render ----------

  private _renderFlows(flows: Flow[]) {
    const c = this._config!;
    const max = Math.max(1, ...flows.map((f) => f.value));
    const minRate = c.min_flow_rate ?? 0.75;
    const maxRate = c.max_flow_rate ?? 6;
    const anim = (c.animations ?? "full") !== "off";
    return svg`${flows.map((f) => {
      const active = f.value > 0.5;
      if (!active && c.display_zero_lines === false) return nothing;
      const dur = maxRate - (maxRate - minRate) * Math.min(1, f.value / max);
      return svg`<path id=${`p-${f.key}`} class="line ${active ? "active" : ""}" d=${f.path} style="--fc:${f.color}"></path>
        ${active && anim ? [0, 0.5].map((offset) => svg`<circle class="dot" r="3.2" style="--fc:${f.color}">
          <animateMotion dur=${`${dur.toFixed(2)}s`} repeatCount="indefinite" begin=${`-${(offset * dur).toFixed(2)}s`}
            keyPoints=${f.reverse ? "1;0" : "0;1"} keyTimes="0;1" calcMode="linear">
            <mpath href=${`#p-${f.key}`}></mpath>
          </animateMotion></circle>`) : nothing}`;
    })}`;
  }

  private _node(key: keyof typeof POS, opts: { icon: string; value: string; label: string; color: string; entity?: string; sub?: string;
    ring?: string; dim?: boolean; extra?: unknown }) {
    const [x, y] = POS[key];
    return html`<button class="node n-${key} ${opts.dim ? "dim" : ""}" style="left:${(x / 300) * 100}%;top:${(y / 240) * 100}%;--nc:${opts.color};${opts.ring ? `--ring:${opts.ring}` : ""}"
      title=${opts.label} @click=${() => this._moreInfo(opts.entity)}>
      <span class="ring"></span>
      <ha-icon .icon=${opts.icon}></ha-icon>
      <span class="val">${opts.value}</span>
      ${opts.sub ? html`<span class="sub">${opts.sub}</span>` : nothing}
      ${opts.extra ?? nothing}
    </button>
    <span class="label l-${key}" style="left:${(x / 300) * 100}%;top:${(y / 240) * 100}%">${opts.label}</span>`;
  }

  private _homeRing(f: EnergyFlows): string {
    const total = f.solarToHome + f.batteryToHome + f.gridToHome;
    if (total <= 0) return `conic-gradient(color-mix(in srgb, var(--primary-color) 60%, transparent) 0 100%)`;
    const a = (f.solarToHome / total) * 100;
    const b = a + (f.batteryToHome / total) * 100;
    return `conic-gradient(${COLORS.solar} 0 ${a}%, ${COLORS.battery} ${a}% ${b}%, ${COLORS.grid} ${b}% 100%)`;
  }

  private _renderIndividual(home: number) {
    const list = this._config!.entities.individual ?? [];
    if (!list.length) return nothing;
    const rows = list.map((i) => {
      const st = this.hass!.states[i.entity];
      return { ...i, st, w: powerWatts(st), name: i.name ?? st?.attributes.friendly_name ?? i.entity };
    }).sort((a, b) => (b.w ?? -1) - (a.w ?? -1));
    const ref = Math.max(home, ...rows.map((r) => r.w ?? 0), 1);
    return html`<div class="devices">
      ${rows.map((r) => {
        const on = (r.w ?? 0) > 0.5;
        const unavailable = r.w == null;
        const color = r.color ?? "var(--primary-color)";
        return html`<button class="device ${on ? "on" : ""} ${unavailable ? "unavailable" : ""}" style="--dc:${color}" @click=${() => this._moreInfo(r.entity)}>
          <span class="d-icon"><ha-icon .icon=${r.icon ?? r.st?.attributes.icon ?? "mdi:flash"}></ha-icon></span>
          <span class="d-main">
            <span class="d-top"><span class="d-name">${r.name}</span>
              <span class="d-val" title=${unavailable ? this._t("unavailable") : ""}>${unavailable ? "–" : this._fmt(r.w)}</span></span>
            <span class="d-bar"><span style="width:${unavailable ? 0 : Math.min(100, ((r.w ?? 0) / ref) * 100)}%"></span></span>
          </span>
        </button>`;
      })}
    </div>`;
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
    const has = { solar: !!e.solar, grid: !!e.grid, battery: !!e.battery };

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

    const batState = (batIn ?? 0) > 0.5 ? this._t("charging") : (batOut ?? 0) > 0.5 ? this._t("discharging") : this._t("idle");
    const gridState = (gridOut ?? 0) > 0.5 ? this._t("export") : this._t("import");
    const gridValue = (gridOut ?? 0) > 0.5 ? gridOut : gridIn;
    const anim = c.animations ?? "full";

    return html`<ha-card class="energy anim-${anim}">
      ${c.title || f.autarky != null ? html`<div class="head">
        ${c.title ? html`<span class="title-text">${c.title}</span>` : html`<span></span>`}
        ${f.autarky != null ? html`<span class="pill" title=${this._t("autarky")}><ha-icon icon="mdi:leaf"></ha-icon>${this._t("autarky")} ${f.autarky} %</span>` : nothing}
      </div>` : nothing}
      <div class="flow">
        <svg viewBox="0 0 300 240" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${this._renderFlows(flows)}</svg>
        ${has.solar ? this._node("solar", { icon: e.solar?.icon ?? "mdi:solar-power-variant", value: this._fmt(solarW ?? 0), label: e.solar?.name ?? this._t("solar"),
          color: COLORS.solar, entity: e.solar?.entity, dim: !(solarW && solarW > 0.5) }) : nothing}
        ${has.grid ? this._node("grid", { icon: e.grid?.icon ?? "mdi:transmission-tower", value: this._fmt(gridValue ?? 0), label: e.grid?.name ?? this._t("grid"),
          sub: gridState, color: (gridOut ?? 0) > 0.5 ? COLORS.gridOut : COLORS.grid, entity: this._firstId(e.grid?.entity), dim: !((gridValue ?? 0) > 0.5) }) : nothing}
        ${this._node("home", { icon: e.home?.icon ?? "mdi:home-lightning-bolt-outline", value: this._fmt(f.home), label: e.home?.name ?? this._t("home"),
          color: COLORS.home, entity: e.home?.entity, ring: this._homeRing(f) })}
        ${has.battery ? this._node("battery", { icon: soc != null ? batteryIcon(soc, (batIn ?? 0) > 0.5) : e.battery?.icon ?? "mdi:home-battery-outline",
          value: soc != null ? `${soc} %` : this._fmt((batOut ?? 0) || (batIn ?? 0)),
          sub: soc != null ? `${batState} · ${this._fmt((batOut ?? 0) > 0.5 ? batOut : batIn ?? 0)}` : batState,
          label: e.battery?.name ?? this._t("battery"), color: COLORS.battery, entity: e.battery?.state_of_charge ?? this._firstId(e.battery?.entity),
          ring: soc != null ? `conic-gradient(${COLORS.battery} 0 ${soc}%, color-mix(in srgb, ${COLORS.battery} 18%, transparent) ${soc}% 100%)` : undefined }) : nothing}
      </div>
      ${this._renderIndividual(f.home)}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.energy { gap: 10px; padding: 14px 14px 16px; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .title-text { font-size: 17px; font-weight: 600; }
    .pill { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px 4px 8px; border-radius: 999px; font-size: 12.5px; font-weight: 600;
      color: var(--success-color, #43a047); background: color-mix(in srgb, var(--success-color, #43a047) 14%, transparent); }
    .pill ha-icon { --mdc-icon-size: 15px; }
    .flow { position: relative; width: 100%; aspect-ratio: 300 / 240; container-type: inline-size; }
    .flow svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    .line { fill: none; stroke: color-mix(in srgb, var(--secondary-text-color) 22%, transparent); stroke-width: 1.6; transition: stroke 0.6s; }
    .line.active { stroke: color-mix(in srgb, var(--fc) 55%, transparent); stroke-width: 2; }
    .dot { fill: var(--fc); filter: drop-shadow(0 0 3px var(--fc)); }
    .node { position: absolute; width: 20%; aspect-ratio: 1; transform: translate(-50%, -50%); border-radius: 50%; border: none; padding: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; cursor: pointer; font: inherit; color: var(--primary-text-color);
      background: var(--card-background-color, var(--ha-card-background, #fff)); transition: transform 0.25s var(--ease-spring), opacity 0.4s; z-index: 1; }
    .node:hover { transform: translate(-50%, -50%) scale(1.05); }
    .node:focus-visible { outline: 2px solid var(--nc); outline-offset: 3px; }
    .node .ring { position: absolute; inset: 0; border-radius: 50%; padding: 3px; pointer-events: none;
      background: var(--ring, var(--nc)); -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; }
    .node::before { content: ""; position: absolute; inset: 3px; border-radius: 50%; background: color-mix(in srgb, var(--nc) 10%, transparent); }
    .node > * { position: relative; }
    .node ha-icon { --mdc-icon-size: clamp(16px, 7cqi, 26px); color: var(--nc); }
    .node .val { font-size: clamp(10px, 4.1cqi, 15px); font-weight: 700; line-height: 1.1; white-space: nowrap; }
    .node .sub { font-size: clamp(8px, 2.7cqi, 11px); color: var(--secondary-text-color); white-space: nowrap; max-width: 92%; overflow: hidden; text-overflow: ellipsis; }
    .node.dim { opacity: 0.6; }
    .n-home .ring { padding: 4px; }
    .label { position: absolute; font-size: clamp(10px, 3.6cqi, 13px); font-weight: 600; color: var(--secondary-text-color); white-space: nowrap; pointer-events: none; }
    .l-solar, .l-battery { transform: translate(calc(10cqi + 8px), -50%); }
    .l-grid, .l-home { transform: translate(-50%, calc(10cqi + 6px)); }
    .devices { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
    .device { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: none; border-radius: var(--hcc-inner-radius, 14px); cursor: pointer;
      font: inherit; color: inherit; text-align: left; background: rgba(127,127,127,0.08); transition: background 0.3s; min-width: 0; }
    .device.on { background: color-mix(in srgb, var(--dc) 12%, rgba(127,127,127,0.06)); }
    .d-icon { width: 32px; height: 32px; flex: none; border-radius: 50%; display: grid; place-items: center; color: var(--secondary-text-color);
      background: rgba(127,127,127,0.12); transition: background 0.3s, color 0.3s; }
    .device.on .d-icon { color: var(--dc); background: color-mix(in srgb, var(--dc) 20%, transparent); }
    .d-icon ha-icon { --mdc-icon-size: 18px; }
    .d-main { display: flex; flex-direction: column; gap: 5px; min-width: 0; flex: 1; }
    .d-top { display: flex; justify-content: space-between; gap: 6px; align-items: baseline; }
    .d-name { flex: 1; min-width: 0; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .d-val { flex: none; font-size: 12.5px; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .device:not(.on) .d-val { color: var(--secondary-text-color); font-weight: 500; }
    .d-bar { height: 4px; border-radius: 2px; background: rgba(127,127,127,0.18); overflow: hidden; }
    .d-bar span { display: block; height: 100%; border-radius: inherit; background: var(--dc); transition: width 0.6s var(--ease-out); }
    .device.unavailable { opacity: 0.55; }
    ha-card.anim-off .node, ha-card.anim-off .d-bar span { transition: none; }
  `];
}
