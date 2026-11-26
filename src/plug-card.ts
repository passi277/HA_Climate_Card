import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, PlugCardConfig, PlugEntityConfig } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { kwhFactor, plugFeatures, plugIcon, UNAVAILABLE, type PlugFeatures } from "./utils";
import "./plug-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-plug-card",
  name: "Modern Plug Card",
  description: "Steckdosen und Verbraucher: An/Aus mit Rückfrage, aktuelle Leistung, Verbrauch und Kosten heute/Monat, 24-h-Verlauf, Warnungen bei Überlast/Überhitzung und „läuft nicht“ (z. B. Kühlschrank) – Messwerte automatisch über das Gerät (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

type Pts = { t: number; v: number }[];
interface Row { cfg: PlugEntityConfig; f: PlugFeatures; name: string; icon: string; on: boolean; na: boolean; power?: number }

@customElement("ha-plug-card")
export class HaPlugCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: PlugCardConfig;
  @state() private _hist: Record<string, Pts> = {};
  @state() private _kwh: Record<string, { today: number; month: number }> = {};
  @state() private _confirm?: string;
  private _confirmTimer?: number;
  private _interval?: number;
  private _loadedKey?: string;
  private _cache?: { key: unknown; f: Record<string, PlugFeatures> };

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-plug-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<PlugCardConfig> {
    const sw = Object.keys(hass.states).filter((id) => id.startsWith("switch.") && plugFeatures(hass.states, hass.entities, id).power).slice(0, 4);
    return { entities: sw };
  }

  public setConfig(config: PlugCardConfig): void {
    if (!config?.entities?.length) throw new Error("ha-plug-card: 'entities' (switch.*) angeben");
    this._config = { ...config };
    this._cache = undefined;
    this._loadedKey = undefined;
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this._interval = window.setInterval(() => this._load(), 5 * 60_000);
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this._interval);
    window.clearTimeout(this._confirmTimer);
  }

  public getCardSize(): number {
    return 2 + Math.ceil(this._entities().length / 2) * 3;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  private _t(key: string): string {
    return localize(this.hass, `plug.${key}`);
  }

  private _entities(): PlugEntityConfig[] {
    return (this._config?.entities ?? []).map((e) => (typeof e === "string" ? { entity: e } : e));
  }

  private _features(): Record<string, PlugFeatures> {
    const h = this.hass!;
    if (this._cache && this._cache.key === h.entities) return this._cache.f;
    const f: Record<string, PlugFeatures> = {};
    for (const e of this._entities()) {
      const auto = plugFeatures(h.states, h.entities, e.entity);
      f[e.entity] = { ...auto, power: e.power ?? auto.power, energy: e.energy ?? auto.energy };
    }
    this._cache = { key: h.entities, f };
    return f;
  }

  private _ids(): string[] {
    const f = this._features();
    return this._entities().flatMap((e) => [e.entity, f[e.entity]!.power, f[e.entity]!.energy, f[e.entity]!.temperature, ...f[e.entity]!.problems])
      .filter((x): x is string => !!x);
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    return !old || old.locale !== this.hass!.locale || old.entities !== this.hass!.entities || this._ids().some((id) => old.states[id] !== this.hass!.states[id]);
  }

  protected updated(): void {
    const key = JSON.stringify(this._entities().map((e) => e.entity));
    if (this.hass && this._loadedKey !== key) {
      this._loadedKey = key;
      this._load();
    }
  }

  /** Leistungsverlauf (24 h) und Verbrauch heute/Monat aus der Langzeitstatistik */
  private async _load(): Promise<void> {
    const h = this.hass;
    if (!h?.callWS) return;
    const f = this._features();
    const power = [...new Set(Object.values(f).map((x) => x.power).filter((x): x is string => !!x))];
    const energy = [...new Set(Object.values(f).map((x) => x.energy).filter((x): x is string => !!x))];
    const now = new Date();
    if (power.length && this._config?.show_graph !== false) {
      try {
        const res = await h.callWS<Record<string, any[]>>({ type: "history/history_during_period", start_time: new Date(now.getTime() - 24 * 3_600_000).toISOString(),
          end_time: now.toISOString(), entity_ids: power, minimal_response: true, no_attributes: true, significant_changes_only: false });
        const hist: Record<string, Pts> = {};
        for (const id of power) hist[id] = (res?.[id] ?? []).map((p) => ({ t: p.lu != null ? p.lu * 1000 : Date.parse(p.last_updated ?? p.last_changed), v: Number(p.s ?? p.state) }))
          .filter((p) => Number.isFinite(p.v) && Number.isFinite(p.t));
        this._hist = hist;
      } catch { /* ohne Verlauf */ }
    }
    if (energy.length) {
      try {
        const month = new Date(now.getFullYear(), now.getMonth(), 1);
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const res = await h.callWS<Record<string, { start: number | string; change?: number | null }[]>>({ type: "recorder/statistics_during_period",
          start_time: month.toISOString(), end_time: now.toISOString(), statistic_ids: energy, period: "day", types: ["change"], units: { energy: "kWh" } });
        const kwh: Record<string, { today: number; month: number }> = {};
        for (const id of energy) {
          const st = h.states[id];
          const fac = st?.attributes.device_class === "energy" ? 1 : kwhFactor(st?.attributes.unit_of_measurement);
          let t = 0, m = 0;
          for (const r of res?.[id] ?? []) {
            const v = Math.max(0, Number(r.change) || 0) * fac;
            m += v;
            if ((typeof r.start === "number" ? r.start : Date.parse(r.start)) >= day.getTime()) t += v;
          }
          kwh[id] = { today: t, month: m };
        }
        this._kwh = kwh;
      } catch { /* ohne Statistik */ }
    }
  }

  private _num(id?: string): number | undefined {
    const st = id ? this.hass!.states[id] : undefined;
    if (!st || UNAVAILABLE.includes(st.state)) return undefined;
    const n = Number(st.state);
    return Number.isFinite(n) ? n : undefined;
  }

  private _fmt(v: number, d = 1): string {
    return v.toLocaleString(getLanguage(this.hass), { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  private _money(v: number): string {
    return v.toLocaleString(getLanguage(this.hass), { style: "currency", currency: this._config?.currency ?? "EUR", maximumFractionDigits: 2 });
  }

  private _haptic(kind = "light"): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: kind }));
  }

  private _moreInfo(id?: string): void {
    if (id) this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  private async _toggle(r: Row): Promise<void> {
    if (r.na) return;
    const confirm = r.cfg.confirm_off ?? this._config?.confirm_off ?? true;
    if (r.on && confirm && this._confirm !== r.cfg.entity) {
      this._haptic("warning");
      this._confirm = r.cfg.entity;
      window.clearTimeout(this._confirmTimer);
      this._confirmTimer = window.setTimeout(() => (this._confirm = undefined), 4000);
      return;
    }
    this._confirm = undefined;
    this._haptic("selection");
    try {
      await this.hass!.callService(r.cfg.entity.split(".")[0]!, r.on ? "turn_off" : "turn_on", { entity_id: r.cfg.entity });
    } catch (err: any) {
      this._haptic("failure");
      this.dispatchEvent(new CustomEvent("hass-notification", {
        detail: { message: `${localize(this.hass, "card.error")}: ${err?.message ?? err}` }, bubbles: true, composed: true,
      }));
    }
  }

  /** „Läuft nicht“: an, aber seit mindestens alert_minutes unter alert_below Watt */
  private _idleSince(r: Row): number | undefined {
    const below = r.cfg.alert_below;
    if (below == null || !r.on || r.power == null || r.power >= below || !r.f.power) return undefined;
    const pts = this._hist[r.f.power] ?? [];
    let lastHigh: number | undefined;
    for (const p of pts) if (p.v >= below) lastHigh = p.t;
    const since = lastHigh ?? pts[0]?.t;
    if (since == null) return undefined;
    return Date.now() - since >= (r.cfg.alert_minutes ?? 30) * 60_000 ? since : undefined;
  }

  private _problemName(id: string): string {
    const k = /overheat|überhitz/i.test(id) ? "overheating" : /overpower|überlast/i.test(id) ? "overpowering" : /overcurrent|überstrom/i.test(id) ? "overcurrent"
      : /overvoltage|überspann/i.test(id) ? "overvoltage" : /restart/i.test(id) ? "restart_required" : undefined;
    return k ? localize(this.hass, `network.p_${k}`) : String(this.hass!.states[id]?.attributes.friendly_name ?? id);
  }

  private _spark(pts: Pts, current?: number) {
    const now = Date.now(), t0 = now - 24 * 3_600_000;
    const all = [...pts.filter((p) => p.t >= t0), ...(current != null ? [{ t: now, v: current }] : [])];
    if (all.length < 2) return nothing;
    const max = Math.max(1, ...all.map((p) => p.v));
    const x = (t: number) => ((Math.max(t, t0) - t0) / (now - t0)) * 200;
    const y = (v: number) => 36 - (v / max) * 34;
    // Stufenlinie: Leistung bleibt bis zum nächsten Messwert gleich
    let d = `M${x(all[0]!.t).toFixed(1)},${y(all[0]!.v).toFixed(1)}`;
    for (let i = 1; i < all.length; i++) d += ` H${x(all[i]!.t).toFixed(1)} V${y(all[i]!.v).toFixed(1)}`;
    return html`<svg class="spark" viewBox="0 0 200 36" preserveAspectRatio="none" aria-hidden="true">
      <path class="area" d=${`${d} V36 H${x(all[0]!.t).toFixed(1)} Z`}></path><path class="line" d=${d}></path></svg>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const s = this.hass.states;
    const lang = getLanguage(this.hass);
    const f = this._features();
    const price = c.price ?? 0.3;
    const rows: Row[] = this._entities().map((cfg) => {
      const st = s[cfg.entity];
      const name = cfg.name ?? st?.attributes.friendly_name ?? cfg.entity;
      return { cfg, f: f[cfg.entity]!, name, icon: cfg.icon ?? st?.attributes.icon ?? plugIcon(name), on: st?.state === "on",
        na: !st || UNAVAILABLE.includes(st.state), power: this._num(f[cfg.entity]!.power) };
    });
    const total = rows.reduce((a, r) => a + (r.power ?? 0), 0);
    const onCount = rows.filter((r) => r.on).length;
    const todayAll = rows.reduce((a, r) => a + (r.f.energy ? this._kwh[r.f.energy]?.today ?? 0 : 0), 0);
    const warn = rows.some((r) => r.f.problems.some((id) => s[id]?.state === "on") || this._idleSince(r) != null);
    const cols = c.columns ?? (rows.length === 1 ? 1 : 2);
    const sub = [`${this._fmt(total, total < 100 ? 1 : 0)} W`, `${onCount}/${rows.length} ${this._t("on")}`,
      todayAll ? `${this._t("today")} ${this._fmt(todayAll, 2)} kWh · ${this._money(todayAll * price)}` : ""].filter(Boolean).join(" · ");
    return html`<ha-card class="plugs anim-${(c as any).animations ?? "full"}" style="--hcc-accent-c:${warn ? "#e53935" : total > 0 ? "#fb8c00" : "#78909c"}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <span class="h-icon"><ha-icon .icon=${warn ? "mdi:power-plug-off-outline" : "mdi:power-plug-outline"}></ha-icon></span>
        <span class="head-text"><span class="h-title">${c.title ?? this._t("title")}</span><span class="h-sub">${sub}</span></span>
      </div>
      <div class="tiles" style="--cols:${cols}">
        ${rows.map((r) => {
          const k = r.f.energy ? this._kwh[r.f.energy] : undefined;
          const problems = r.f.problems.filter((id) => s[id]?.state === "on");
          const idle = this._idleSince(r);
          const temp = this._num(r.f.temperature);
          const ask = this._confirm === r.cfg.entity;
          const flow = r.on && (r.power ?? 0) > 0.5;
          return html`<div class="tile ${r.on ? "on" : ""} ${r.na ? "na" : ""} ${problems.length || idle ? "alert" : ""}" data-entity=${r.cfg.entity}
            style="--speed:${flow ? Math.max(0.6, 3 - Math.log10((r.power ?? 1) + 1)) : 0}s">
            <div class="t-top">
              <button class="t-icon ${flow ? "flow" : ""}" @click=${() => this._moreInfo(r.f.power ?? r.cfg.entity)}><ha-icon .icon=${r.icon}></ha-icon></button>
              <button class="sw ${r.on ? "on" : ""} ${ask ? "ask" : ""}" role="switch" aria-checked=${r.on} ?disabled=${r.na} data-act="toggle"
                @click=${() => this._toggle(r)}>${ask ? html`<span class="ask-t">${this._t("sure")}</span>` : html`<i></i>`}</button>
            </div>
            <button class="t-name" @click=${() => this._moreInfo(r.cfg.entity)}>${r.name}</button>
            <div class="t-val">${r.na ? html`<small>${this._t("unavailable")}</small>` : !r.on ? html`<span class="off">${this._t("off")}</span>`
              : r.power != null ? html`${this._fmt(r.power, r.power < 100 ? 1 : 0)}<small> W</small>` : html`<span class="off">${this._t("on")}</span>`}</div>
            ${k ? html`<div class="t-kwh"><span>${this._t("today")} <b>${this._fmt(k.today, 2)}</b> kWh · ${this._money(k.today * price)}</span>
              <span>${this._t("month")} <b>${this._fmt(k.month, 1)}</b> kWh · ${this._money(k.month * price)}</span></div>` : nothing}
            ${problems.length || idle || (temp != null && temp >= 60) ? html`<div class="t-warn">
              ${problems.map((id) => html`<span class="w bad" @click=${() => this._moreInfo(id)}><ha-icon icon="mdi:alert"></ha-icon>${this._problemName(id)}</span>`)}
              ${idle ? html`<span class="w bad"><ha-icon icon="mdi:alert-circle-outline"></ha-icon>${this._t("idle").replace("{w}", String(r.cfg.alert_below))}
                ${new Date(idle).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })}</span>` : nothing}
              ${temp != null && temp >= 60 ? html`<span class="w"><ha-icon icon="mdi:thermometer-alert"></ha-icon>${this._fmt(temp, 0)} °C</span>` : nothing}
            </div>` : nothing}
            ${c.show_graph === false || !r.f.power ? nothing : this._spark(this._hist[r.f.power] ?? [], r.on ? r.power : 0)}
          </div>`;
        })}
      </div>
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.plugs { gap: 12px; container-type: inline-size; }
    .header { display: flex; align-items: center; gap: 10px; }
    .h-icon { flex: none; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); }
    .h-icon ha-icon { --mdc-icon-size: 24px; }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .h-title { font-size: 17px; font-weight: 600; line-height: 1.2; }
    .h-sub { font-size: 12.5px; font-weight: 600; color: var(--accent); }
    .tiles { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 8px; }
    @container (max-width: 260px) { .tiles { grid-template-columns: minmax(0, 1fr); } }
    .tile { position: relative; display: flex; flex-direction: column; gap: 4px; padding: 10px 10px 0; border-radius: 16px; overflow: hidden; min-width: 0;
      --tc: #fb8c00; background: rgba(127,127,127,0.07); transition: background 0.3s; }
    .tile.on { background: color-mix(in srgb, var(--tc) 10%, rgba(127,127,127,0.05)); }
    .tile.alert { --tc: #e53935; box-shadow: inset 0 0 0 2px #e53935; }
    .tile.na { opacity: 0.55; }
    .t-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
    .t-icon { position: relative; flex: none; width: 34px; height: 34px; border: none; border-radius: 50%; display: grid; place-items: center; cursor: pointer;
      color: var(--secondary-text-color); background: rgba(127,127,127,0.12); transition: color 0.3s, background 0.3s; }
    .tile.on .t-icon { color: #fff; background: var(--tc); }
    .t-icon ha-icon { --mdc-icon-size: 19px; }
    .t-icon.flow::after { content: ""; position: absolute; inset: -3px; border-radius: 50%; border: 2px solid var(--tc); opacity: 0;
      animation: pulse-out var(--speed) ease-out infinite; }
    @keyframes pulse-out { 0% { transform: scale(0.9); opacity: 0.8; } 100% { transform: scale(1.35); opacity: 0; } }
    .t-name { min-width: 0; margin-top: 4px; padding: 0; border: none; background: none; cursor: pointer; text-align: left; color: inherit; font-size: 14px; font-weight: 600;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sw { position: relative; flex: none; width: 44px; height: 26px; padding: 0; border: none; border-radius: 999px; cursor: pointer; background: rgba(127,127,127,0.3); transition: background 0.25s, width 0.25s; }
    .sw i { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.3); transition: transform 0.25s var(--ease-out); }
    .sw.on { background: var(--tc); }
    .sw.on i { transform: translateX(18px); }
    .sw.ask { width: 64px; background: #e53935; }
    .ask-t { font-size: 11px; font-weight: 800; color: #fff; }
    .sw[disabled] { opacity: 0.5; cursor: default; }
    @container (max-width: 400px) { .t-val { font-size: 21px; } .t-kwh { font-size: 11px; } }
    .t-val { font-size: 24px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
    .t-val small { font-size: 13px; font-weight: 600; color: var(--secondary-text-color); }
    .t-val .off { font-size: 15px; font-weight: 600; color: var(--secondary-text-color); }
    .t-kwh { display: flex; flex-direction: column; font-size: 11.5px; color: var(--secondary-text-color); }
    .t-kwh b { color: var(--primary-text-color); font-weight: 700; }
    .t-warn { display: flex; flex-wrap: wrap; gap: 4px; }
    .w { display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; color: #fb8c00;
      background: color-mix(in srgb, #fb8c00 14%, transparent); cursor: default; }
    .w.bad { color: #e53935; background: color-mix(in srgb, #e53935 14%, transparent); }
    .w ha-icon { --mdc-icon-size: 13px; }
    .spark { display: block; width: calc(100% + 20px); height: 34px; margin: auto -10px 0; padding-top: 2px; }
    .spark .line { fill: none; stroke: var(--tc); stroke-width: 1.8; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
    .spark .area { fill: color-mix(in srgb, var(--tc) 16%, transparent); stroke: none; }
    .tile:not(.on) .spark .line { stroke: rgba(127,127,127,0.5); }
    .tile:not(.on) .spark .area { fill: rgba(127,127,127,0.1); }
    ha-card.anim-reduced *, ha-card.anim-off * { animation: none !important; }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-plug-card": HaPlugCard;
  }
}
