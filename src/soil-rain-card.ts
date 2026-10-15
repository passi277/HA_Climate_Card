import { LitElement, css, html, nothing, svg, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, RainSensorConfig, SoilRainCardConfig, SoilSensorConfig } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { isRaining, rainFeatures, soilFeatures, stateSegments, UNAVAILABLE } from "./utils";
import "./soil-rain-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-soil-rain-card",
  name: "Modern Soil & Rain Card",
  description: "Boden & Regen: Bodenfeuchte als Säule mit Warnschwelle (−/+), Temperatur, Luftfeuchte, 7-Tage-Verlauf; Regensensor mit Animation, Bestätigung durch den Wetterdienst, Regenmengen, Regensperre und 48-h-Zeitleiste (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

type Pts = { t: number; v: number }[];
type SPts = { t: number; s: string }[];
interface Soil { cfg: SoilSensorConfig; name: string; f: { temperature?: string; humidity?: string; battery?: string; dry?: string; warning?: string } }

@customElement("ha-soil-rain-card")
export class HaSoilRainCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: SoilRainCardConfig;
  @state() private _hist: Record<string, Pts> = {};
  @state() private _shist: Record<string, SPts> = {};
  private _cache?: { key: unknown; soil: Soil[]; rain?: RainSensorConfig };
  private _interval?: number;
  private _loadedKey?: string;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-soil-rain-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<SoilRainCardConfig> {
    const ids = Object.keys(hass.states);
    const soil = ids.filter((id) => id.startsWith("sensor.") && hass.states[id]?.attributes.device_class === "moisture").slice(0, 2);
    const rain = ids.find((id) => /^(sensor|binary_sensor)\..*(rain|regen)/.test(id) && isRaining(hass.states[id]?.state) !== undefined);
    return { soil, ...(rain ? { rain } : {}) };
  }

  public setConfig(config: SoilRainCardConfig): void {
    if (!config?.soil?.length && !config?.rain) throw new Error("ha-soil-rain-card: 'soil' und/oder 'rain' angeben");
    this._config = { ...config };
    this._cache = undefined;
    this._loadedKey = undefined;
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this._interval = window.setInterval(() => this._load(), 10 * 60_000);
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this._interval);
  }

  public getCardSize(): number {
    return 3 + (this._config?.soil?.length ?? 0) * 3 + (this._config?.rain ? 4 : 0);
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  private _t(key: string): string {
    return localize(this.hass, `soil_rain.${key}`);
  }

  private _resolve(): { soil: Soil[]; rain?: RainSensorConfig } {
    const h = this.hass!;
    if (this._cache && this._cache.key === h.entities) return this._cache;
    const soil = (this._config!.soil ?? []).map((x) => (typeof x === "string" ? { entity: x } : x)).map((cfg) => {
      const auto = soilFeatures(h.states, h.entities, cfg.entity);
      const name = cfg.name ?? String(h.states[cfg.entity]?.attributes.friendly_name ?? cfg.entity);
      return { cfg, name, f: { temperature: cfg.temperature ?? auto.temperature, humidity: cfg.humidity ?? auto.humidity, battery: cfg.battery ?? auto.battery,
        dry: cfg.dry ?? auto.dry, warning: cfg.warning ?? auto.warning } };
    });
    const r = this._config!.rain;
    let rain: RainSensorConfig | undefined;
    if (r) {
      const rc = typeof r === "string" ? { entity: r } : r;
      const auto = rainFeatures(h.states, h.entities, rc.entity);
      rain = { ...rc, illuminance: rc.illuminance ?? auto.illuminance, battery: rc.battery ?? auto.battery, sensitivity: rc.sensitivity ?? auto.sensitivity };
    }
    this._cache = { key: h.entities, soil, rain };
    return this._cache;
  }

  private _ids(): string[] {
    const { soil, rain } = this._resolve();
    return [...soil.flatMap((x) => [x.cfg.entity, ...Object.values(x.f)]), ...(rain ? Object.values(rain).filter((v) => typeof v === "string") : [])]
      .filter((x): x is string => typeof x === "string" && x.includes("."));
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    return !old || old.locale !== this.hass!.locale || old.entities !== this.hass!.entities || this._ids().some((id) => old.states[id] !== this.hass!.states[id]);
  }

  protected updated(): void {
    if (!this.hass) return;
    const key = JSON.stringify([this._config?.soil, this._config?.rain]);
    if (this._loadedKey !== key) {
      this._loadedKey = key;
      this._load();
    }
  }

  /** Bodenfeuchte (Tage) und Regen-Meldungen (Stunden) aus dem Verlauf */
  private async _load(): Promise<void> {
    const h = this.hass;
    if (!h?.callWS) return;
    const { soil, rain } = this._resolve();
    const now = Date.now();
    const num = soil.map((x) => x.cfg.entity);
    if (num.length) {
      try {
        const res = await h.callWS<Record<string, any[]>>({ type: "history/history_during_period", start_time: new Date(now - (this._config!.days ?? 7) * 86_400_000).toISOString(),
          end_time: new Date(now).toISOString(), entity_ids: num, minimal_response: true, no_attributes: true, significant_changes_only: false });
        const out: Record<string, Pts> = {};
        for (const id of num) out[id] = (res?.[id] ?? []).map((p) => ({ t: p.lu != null ? p.lu * 1000 : Date.parse(p.last_updated ?? p.last_changed), v: Number(p.s ?? p.state) }))
          .filter((p) => Number.isFinite(p.v) && Number.isFinite(p.t));
        this._hist = out;
      } catch { /* ohne Verlauf */ }
    }
    if (rain) {
      const ids = [rain.entity, rain.confirmed].filter((x): x is string => !!x);
      try {
        const res = await h.callWS<Record<string, any[]>>({ type: "history/history_during_period", start_time: new Date(now - (this._config!.rain_hours ?? 48) * 3_600_000).toISOString(),
          end_time: new Date(now).toISOString(), entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false });
        const out: Record<string, SPts> = {};
        for (const id of ids) out[id] = (res?.[id] ?? []).map((p) => ({ t: p.lu != null ? p.lu * 1000 : Date.parse(p.last_updated ?? p.last_changed), s: String(p.s ?? p.state) }))
          .filter((p) => Number.isFinite(p.t));
        this._shist = out;
      } catch { /* ohne Zeitleiste */ }
    }
  }

  private _num(id?: string): number | undefined {
    const st = id ? this.hass!.states[id] : undefined;
    if (!st || UNAVAILABLE.includes(st.state)) return undefined;
    const n = Number(st.state);
    return Number.isFinite(n) ? n : undefined;
  }

  private _fmt(v: number, d = 0): string {
    return v.toLocaleString(getLanguage(this.hass), { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  private _moreInfo(id?: string): void {
    if (id) this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  private async _step(id: string | undefined, dir: number): Promise<void> {
    const st = id ? this.hass!.states[id] : undefined;
    if (!st) return;
    const step = Number(st.attributes.step) || 1;
    const min = Number(st.attributes.min ?? -Infinity), max = Number(st.attributes.max ?? Infinity);
    const cur = Number(st.state);
    if (!Number.isFinite(cur)) return;
    const value = Math.min(max, Math.max(min, Math.round((cur + dir * step) / step) * step));
    if (value === cur) return;
    window.dispatchEvent(new CustomEvent("haptic", { detail: "selection" }));
    try {
      await this.hass!.callService(id!.split(".")[0]!, "set_value", { entity_id: id, value });
    } catch (err: any) {
      this.dispatchEvent(new CustomEvent("hass-notification", { detail: { message: `${localize(this.hass, "card.error")}: ${err?.message ?? err}` }, bubbles: true, composed: true }));
    }
  }

  private _since(id: string): string {
    const st = this.hass!.states[id];
    if (!st?.last_changed) return "";
    const d = new Date(st.last_changed), lang = getLanguage(this.hass);
    const today = new Date().toDateString() === d.toDateString();
    return `${this._t("since")} ${today ? "" : `${d.toLocaleDateString(lang, { day: "2-digit", month: "2-digit" })} `}${d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })}`;
  }

  private _stepper(id: string | undefined, label: string, unit: string) {
    const v = this._num(id);
    if (!id || v == null) return nothing;
    return html`<div class="stp" data-step=${id}>
      <span class="st-l">${label}</span>
      <button class="sb" data-dir="-1" @click=${() => this._step(id, -1)} aria-label="−"><ha-icon icon="mdi:minus"></ha-icon></button>
      <b>${this._fmt(v)}${unit}</b>
      <button class="sb" data-dir="1" @click=${() => this._step(id, 1)} aria-label="+"><ha-icon icon="mdi:plus"></ha-icon></button>
    </div>`;
  }

  private _spark(pts: Pts, current: number | undefined, warn: number | undefined) {
    const now = Date.now(), t0 = now - (this._config!.days ?? 7) * 86_400_000;
    const all = [...pts.filter((p) => p.t >= t0), ...(current != null ? [{ t: now, v: current }] : [])];
    if (all.length < 2) return nothing;
    const max = Math.max(warn ?? 0, ...all.map((p) => p.v), 10) * 1.1;
    const x = (t: number) => ((Math.max(t, t0) - t0) / (now - t0)) * 300;
    const y = (v: number) => 54 - (v / max) * 50;
    const d = all.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
    const lo = Math.min(...all.map((p) => p.v)), hi = Math.max(...all.map((p) => p.v));
    return html`<div class="chart">
      <svg viewBox="0 0 300 56" preserveAspectRatio="none" aria-hidden="true">
        ${svg`<path class="area" d=${`${d} L${x(all[all.length - 1]!.t).toFixed(1)},56 L${x(all[0]!.t).toFixed(1)},56 Z`}></path>
        ${warn != null ? svg`<line class="warn" x1="0" x2="300" y1=${y(warn)} y2=${y(warn)}></line>` : nothing}
        <path class="line" d=${d}></path>`}
      </svg>
      <span class="c-lbl">${this._fmt(this._config!.days ?? 7)} ${this._t("days")} · ${this._t("min")} ${this._fmt(lo)} % · ${this._t("max")} ${this._fmt(hi)} %</span>
    </div>`;
  }

  private _renderSoil(x: Soil) {
    const s = this.hass!.states;
    const v = this._num(x.cfg.entity);
    const warn = this._num(x.f.warning) ?? x.cfg.warn_below ?? 20;
    const dry = x.f.dry ? s[x.f.dry]?.state === "on" : v != null && v < warn;
    const level = v == null ? "na" : dry ? "dry" : v >= warn * 3 ? "wet" : "ok";
    const temp = this._num(x.f.temperature), hum = this._num(x.f.humidity), bat = this._num(x.f.battery);
    const pct = Math.max(0, Math.min(100, v ?? 0));
    return html`<div class="soil lvl-${level}" data-soil=${x.cfg.entity}>
      <div class="s-row">
        <button class="column" @click=${() => this._moreInfo(x.cfg.entity)} aria-label=${`${x.name} ${v ?? "–"} %`}>
          <span class="water" style="height:${pct}%"><i></i></span>
          <span class="thr" style="bottom:${Math.min(100, warn)}%"></span>
          <span class="grain"></span>
        </button>
        <div class="s-info">
          <button class="s-name" @click=${() => this._moreInfo(x.cfg.entity)}>${x.name}</button>
          <span class="s-val">${v != null ? html`${this._fmt(v)}<small> %</small>` : "–"}</span>
          <span class="s-pill">${v == null ? this._t("unavailable") : dry ? this._t("too_dry").replace("{w}", this._fmt(warn)) : level === "wet" ? this._t("wet") : this._t("ok")}</span>
          <div class="chips">
            ${temp != null ? html`<button class="chip" @click=${() => this._moreInfo(x.f.temperature)}><ha-icon icon="mdi:thermometer"></ha-icon>${this._fmt(temp, 1)} °C</button>` : nothing}
            ${hum != null ? html`<button class="chip" @click=${() => this._moreInfo(x.f.humidity)}><ha-icon icon="mdi:water"></ha-icon>${this._fmt(hum)} %</button>` : nothing}
            ${bat != null ? html`<button class="chip ${bat < 20 ? "bad" : ""}" @click=${() => this._moreInfo(x.f.battery)}><ha-icon icon=${bat < 20 ? "mdi:battery-alert" : "mdi:battery"}></ha-icon>${this._fmt(bat)} %</button>` : nothing}
          </div>
        </div>
      </div>
      ${this._stepper(x.f.warning, this._t("warn_at"), " %")}
      ${this._spark(this._hist[x.cfg.entity] ?? [], v, warn)}
    </div>`;
  }

  private _renderRain(r: RainSensorConfig) {
    const s = this.hass!.states;
    const st = s[r.entity];
    const raining = isRaining(st?.state);
    const confirmed = r.confirmed ? s[r.confirmed]?.state === "on" : undefined;
    const lock = r.lock ? s[r.lock]?.state === "on" : undefined;
    const reason = r.lock_reason ? s[r.lock_reason]?.state : undefined;
    const mood = raining === undefined ? "na" : raining ? (confirmed === false ? "dew" : "rain") : "dry";
    const title = raining === undefined ? this._t("unavailable") : raining ? this._t("raining") : this._t("dry");
    const detail = raining && confirmed ? this._t("confirmed") : raining && confirmed === false ? this._t("dew") : "";
    const mm = (id?: string) => { const v = this._num(id); return v != null ? `${this._fmt(v, v < 10 ? 1 : 0)} mm` : undefined; };
    const prob = this._num(r.probability);
    const lastRain = r.last_rain ? s[r.last_rain]?.state : undefined;
    const lastDate = lastRain && !UNAVAILABLE.includes(lastRain) ? new Date(lastRain.replace(" ", "T")) : undefined;
    const facts = [
      { id: r.rain_today, label: this._t("today"), v: mm(r.rain_today) },
      { id: r.rain_yesterday, label: this._t("yesterday"), v: mm(r.rain_yesterday) },
      { id: r.forecast, label: this._t("forecast"), v: mm(r.forecast) },
      { id: r.probability, label: this._t("probability"), v: prob != null ? `${this._fmt(prob)} %` : undefined },
    ].filter((f) => f.v);
    const drops = mood === "rain" || mood === "dew" ? Array.from({ length: mood === "rain" ? 26 : 10 }, (_, i) =>
      html`<i style="--x:${((i * 37) % 100).toFixed(0)}%;--d:${(-((i * 13) % 10) / 10).toFixed(2)}s;--t:${(0.75 + ((i * 7) % 4) * 0.08).toFixed(2)}s"></i>`) : nothing;
    // Zeitleiste
    const hours = this._config!.rain_hours ?? 48;
    const end = Date.now(), start = end - hours * 3_600_000;
    const rainSeg = stateSegments(this._shist[r.entity] ?? [], start, end, (x) => isRaining(x) === true);
    const confSeg = r.confirmed ? stateSegments(this._shist[r.confirmed] ?? [], start, end, (x) => x === "on") : [];
    const pos = (t: number) => ((t - start) / (end - start)) * 100;
    const ill = this._num(r.illuminance), bat = this._num(r.battery);
    return html`<div class="rain-box r-${mood}">
      <button class="sky" @click=${() => this._moreInfo(r.entity)} aria-label=${title}>
        ${mood === "dry" ? html`<span class="sun"></span>` : html`<span class="cloud c1"></span><span class="cloud c2"></span>`}
        <span class="drops">${drops}</span>
        <span class="sky-txt"><b>${title}</b><small>${[this._since(r.entity), detail].filter(Boolean).join(" · ")}</small></span>
        ${confirmed ? html`<span class="badge" title=${this._t("confirmed")}><ha-icon icon="mdi:check"></ha-icon></span>`
          : raining && confirmed === false ? html`<span class="badge q" title=${this._t("dew")}><ha-icon icon="mdi:help"></ha-icon></span>` : nothing}
      </button>
      ${facts.length ? html`<div class="facts">${facts.map((f) => html`<button class="fact" @click=${() => this._moreInfo(f.id)}><small>${f.label}</small><b>${f.v}</b></button>`)}</div>` : nothing}
      ${lock !== undefined ? html`<button class="lock ${lock ? "on" : ""}" @click=${() => this._moreInfo(r.lock)}>
        <ha-icon .icon=${lock ? "mdi:water-off" : "mdi:water-check"}></ha-icon>
        <span><b>${lock ? this._t("lock_on") : this._t("lock_off")}</b>${lock && reason && !UNAVAILABLE.includes(reason) && reason !== "–" ? html`<small>${reason}</small>`
          : lastDate && Number.isFinite(lastDate.getTime()) ? html`<small>${this._t("last_rain")} ${lastDate.toLocaleString(getLanguage(this.hass), { weekday: "short", hour: "2-digit", minute: "2-digit" })}</small>` : nothing}</span>
      </button>` : nothing}
      <div class="timeline" data-hours=${hours}>
        <div class="tl-bar">
          ${rainSeg.map((g) => html`<span class="seg" style="left:${pos(g.from)}%;width:${Math.max(0.6, pos(g.to) - pos(g.from))}%"></span>`)}
          ${confSeg.map((g) => html`<span class="seg conf" style="left:${pos(g.from)}%;width:${Math.max(0.6, pos(g.to) - pos(g.from))}%"></span>`)}
          ${Array.from({ length: Math.floor(hours / 24) }, (_, i) => html`<span class="tick" style="left:${pos(end - (i + 1) * 86_400_000)}%"></span>`)}
        </div>
        <div class="tl-lbl"><span>−${hours} h</span><span class="lg"><i></i>${this._t("sensor")}${r.confirmed ? html`<i class="c"></i>${this._t("confirmed_short")}` : nothing}</span><span>${this._t("now")}</span></div>
      </div>
      <div class="r-foot">
        ${this._stepper(r.sensitivity, this._t("sensitivity"), "")}
        <div class="chips">
          ${ill != null ? html`<button class="chip" @click=${() => this._moreInfo(r.illuminance)}><ha-icon icon="mdi:brightness-6"></ha-icon>${this._fmt(ill)} lx</button>` : nothing}
          ${bat != null ? html`<button class="chip ${bat < 20 ? "bad" : ""}" @click=${() => this._moreInfo(r.battery)}><ha-icon icon=${bat < 20 ? "mdi:battery-alert" : "mdi:battery"}></ha-icon>${this._fmt(bat)} %</button>` : nothing}
        </div>
      </div>
    </div>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const { soil, rain } = this._resolve();
    const s = this.hass.states;
    const dryOnes = soil.filter((x) => { const v = this._num(x.cfg.entity); const w = this._num(x.f.warning) ?? x.cfg.warn_below ?? 20;
      return x.f.dry ? s[x.f.dry]?.state === "on" : v != null && v < w; });
    const raining = rain ? isRaining(s[rain.entity]?.state) : undefined;
    const lock = rain?.lock ? s[rain.lock]?.state === "on" : undefined;
    const sub = [
      soil.length ? (dryOnes.length ? `${dryOnes.map((x) => x.name).join(", ")} ${this._t("dry_short")}` : this._t("soil_ok")) : "",
      raining === undefined ? "" : !raining ? this._t("dry") : rain?.confirmed && s[rain.confirmed]?.state !== "on" ? this._t("dew_short") : this._t("raining"),
      lock === undefined ? "" : lock ? this._t("lock_on") : "",
    ].filter(Boolean).join(" · ");
    const accent = dryOnes.length ? "#e53935" : raining && (!rain?.confirmed || s[rain.confirmed]?.state === "on") ? "#1e88e5" : "#43a047";
    return html`<ha-card class="sr anim-${c.animations ?? "full"}" style="--hcc-accent-c:${accent}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <span class="h-icon"><ha-icon icon="mdi:sprout"></ha-icon></span>
        <span class="head-text"><span class="h-title">${c.title ?? this._t("title")}</span><span class="h-sub">${sub}</span></span>
      </div>
      ${soil.map((x) => this._renderSoil(x))}
      ${rain ? this._renderRain(rain) : nothing}
      ${c.note ? html`<div class="note"><ha-icon icon="mdi:information-outline"></ha-icon><span>${c.note}</span></div>` : nothing}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.sr { gap: 12px; container-type: inline-size; }
    .header { display: flex; align-items: center; gap: 10px; }
    .h-icon { flex: none; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); }
    .h-icon ha-icon { --mdc-icon-size: 24px; }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .h-title { font-size: 17px; font-weight: 600; line-height: 1.2; }
    .h-sub { font-size: 12.5px; font-weight: 600; color: var(--accent); }
    button { font: inherit; color: inherit; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border: none; border-radius: 999px; cursor: pointer; font-size: 12px; font-weight: 600;
      background: rgba(127,127,127,0.12); }
    .chip ha-icon { --mdc-icon-size: 14px; color: var(--secondary-text-color); }
    .chip.bad { color: #e53935; background: color-mix(in srgb, #e53935 14%, transparent); }
    .chip.bad ha-icon { color: #e53935; }

    /* Boden */
    .soil { --lc: #43a047; display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 16px; background: rgba(127,127,127,0.07); }
    .soil.lvl-dry { --lc: #e53935; background: color-mix(in srgb, #e53935 7%, rgba(127,127,127,0.05)); }
    .soil.lvl-wet { --lc: #1e88e5; }
    .soil.lvl-na { --lc: #9e9e9e; }
    .s-row { display: flex; gap: 14px; align-items: center; min-width: 0; }
    .column { position: relative; flex: none; width: 46px; height: 104px; padding: 0; border: none; border-radius: 14px; overflow: hidden; cursor: pointer;
      background: linear-gradient(180deg, #8d6e63, #5d4037); box-shadow: inset 0 0 0 1px rgba(0,0,0,0.12); }
    .grain { position: absolute; inset: 0; opacity: 0.35; pointer-events: none;
      background-image: radial-gradient(1.5px 1.5px at 20% 30%, #3e2723 60%, transparent), radial-gradient(1.5px 1.5px at 70% 60%, #3e2723 60%, transparent),
        radial-gradient(1.2px 1.2px at 40% 80%, #d7ccc8 60%, transparent), radial-gradient(1.2px 1.2px at 80% 20%, #d7ccc8 60%, transparent);
      background-size: 18px 18px; }
    .water { position: absolute; left: 0; right: 0; bottom: 0; background: linear-gradient(180deg, rgba(66,165,245,0.85), rgba(21,101,192,0.9)); transition: height 0.8s var(--ease-out); }
    .water i { position: absolute; left: -50%; top: -5px; width: 200%; height: 10px; border-radius: 45%; background: rgba(144,202,249,0.9); animation: wave 4s linear infinite; }
    @keyframes wave { from { transform: translateX(0); } to { transform: translateX(25%); } }
    .lvl-dry .water { background: linear-gradient(180deg, rgba(255,138,101,0.8), rgba(229,57,53,0.85)); }
    .lvl-dry .water i { background: rgba(255,171,145,0.9); }
    .thr { position: absolute; left: 0; right: 0; height: 0; border-top: 2px dashed rgba(255,255,255,0.9); }
    .s-info { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; }
    .s-name { padding: 0; border: none; background: none; cursor: pointer; font-size: 14.5px; font-weight: 600; text-align: left; max-width: 100%;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .s-val { font-size: 30px; font-weight: 700; line-height: 1.05; color: var(--lc); font-variant-numeric: tabular-nums; }
    .s-val small { font-size: 14px; font-weight: 600; color: var(--secondary-text-color); }
    .s-pill { padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; color: var(--lc); background: color-mix(in srgb, var(--lc) 15%, transparent); }
    .stp { display: flex; align-items: center; gap: 8px; }
    .st-l { flex: 1; font-size: 12.5px; font-weight: 600; color: var(--secondary-text-color); }
    .stp b { min-width: 46px; text-align: center; font-size: 14px; font-variant-numeric: tabular-nums; }
    .sb { width: 32px; height: 32px; border: none; border-radius: 50%; display: grid; place-items: center; cursor: pointer; background: rgba(127,127,127,0.14); }
    .sb ha-icon { --mdc-icon-size: 18px; }
    .chart { position: relative; }
    .chart svg { display: block; width: 100%; height: 56px; }
    .chart .line { fill: none; stroke: var(--lc); stroke-width: 2; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
    .chart .area { fill: color-mix(in srgb, var(--lc) 15%, transparent); }
    .chart .warn { stroke: #e53935; stroke-width: 1.2; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; opacity: 0.8; }
    .c-lbl { display: block; margin-top: 2px; font-size: 11px; color: var(--secondary-text-color); }

    /* Regen */
    .rain-box { display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 16px; background: rgba(127,127,127,0.07); }
    .sky { position: relative; display: flex; align-items: flex-end; min-height: 92px; padding: 12px 14px; border: none; border-radius: 14px; overflow: hidden; cursor: pointer;
      text-align: left; color: #fff; isolation: isolate; background: linear-gradient(180deg, #4f9be8, #9fd0f6); }
    .r-rain .sky, .r-dew .sky { background: linear-gradient(180deg, #4b5a6c, #8496a8); }
    .r-na .sky { background: linear-gradient(180deg, #78909c, #b0bec5); }
    .sky-txt { position: relative; z-index: 2; display: flex; flex-direction: column; text-shadow: 0 1px 3px rgba(0,0,0,0.35); }
    .sky-txt b { font-size: 19px; }
    .sky-txt small { font-size: 12px; font-weight: 600; opacity: 0.95; }
    .sun { position: absolute; right: 18px; top: 10px; width: 70px; height: 70px; border-radius: 50%; z-index: -1;
      background: radial-gradient(circle, #fff8d6 0%, #ffd54f 35%, rgba(255,193,7,0.3) 55%, rgba(255,193,7,0) 70%); animation: glow 6s ease-in-out infinite alternate; }
    @keyframes glow { to { transform: scale(1.1); } }
    .cloud { position: absolute; height: 26px; border-radius: 999px; background: rgba(225,230,236,0.85); z-index: -1; animation: drift 40s linear infinite; }
    .cloud::before { content: ""; position: absolute; left: 22%; bottom: 40%; width: 46%; height: 130%; border-radius: 50%; background: inherit; }
    .cloud.c1 { right: 14%; top: 14%; width: 100px; }
    .cloud.c2 { right: 42%; top: 6%; width: 74px; opacity: 0.8; animation-duration: 55s; }
    @keyframes drift { 50% { translate: -24px 0; } }
    .drops { position: absolute; inset: -20% 0 0; z-index: -1; transform: rotate(8deg); }
    .drops i { position: absolute; top: 0; bottom: 0; left: var(--x); width: 2px; animation: drop var(--t) linear var(--d) infinite; }
    .drops i::after { content: ""; position: absolute; top: 0; width: 1.5px; height: 14px; border-radius: 1px; background: linear-gradient(180deg, transparent, rgba(235,244,255,0.95)); }
    .r-dew .drops i { opacity: 0.45; }
    @keyframes drop { from { transform: translateY(-15%); } to { transform: translateY(100%); } }
    .badge { position: absolute; top: 10px; right: 10px; z-index: 2; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: #1e88e5; }
    .badge.q { background: #fb8c00; }
    .badge ha-icon { --mdc-icon-size: 16px; }
    .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(76px, 1fr)); gap: 6px; }
    .fact { display: flex; flex-direction: column; align-items: flex-start; padding: 7px 9px; border: none; border-radius: 12px; cursor: pointer; background: rgba(127,127,127,0.1); text-align: left; }
    .fact small { font-size: 11px; font-weight: 600; color: var(--secondary-text-color); white-space: nowrap; }
    .fact b { font-size: 15px; font-variant-numeric: tabular-nums; }
    .lock { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border: none; border-radius: 12px; cursor: pointer; text-align: left;
      color: #43a047; background: color-mix(in srgb, #43a047 12%, transparent); }
    .lock.on { color: #fb8c00; background: color-mix(in srgb, #fb8c00 14%, transparent); }
    .lock ha-icon { --mdc-icon-size: 22px; }
    .lock span { display: flex; flex-direction: column; min-width: 0; }
    .lock b { font-size: 13.5px; }
    .lock small { font-size: 12px; color: var(--secondary-text-color); }
    .tl-bar { position: relative; height: 14px; border-radius: 7px; overflow: hidden; background: rgba(127,127,127,0.14); }
    .seg { position: absolute; top: 0; bottom: 0; background: rgba(100,181,246,0.55); }
    .seg.conf { top: 4px; bottom: 4px; border-radius: 3px; background: #1e88e5; }
    .tick { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(127,127,127,0.45); }
    .tl-lbl { display: flex; justify-content: space-between; align-items: center; margin-top: 3px; font-size: 11px; color: var(--secondary-text-color); }
    .tl-lbl .lg { display: inline-flex; align-items: center; gap: 4px; }
    .tl-lbl i { display: inline-block; width: 10px; height: 6px; border-radius: 2px; background: rgba(100,181,246,0.55); }
    .tl-lbl i.c { margin-left: 6px; background: #1e88e5; }
    .r-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
    .r-foot .stp { flex: 1 1 200px; }
    .note { display: flex; gap: 8px; align-items: flex-start; font-size: 12px; color: var(--secondary-text-color); }
    .note ha-icon { --mdc-icon-size: 16px; flex: none; }
    ha-card.anim-reduced *, ha-card.anim-off * { animation: none !important; }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-soil-rain-card": HaSoilRainCard;
  }
}
