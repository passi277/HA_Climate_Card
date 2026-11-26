import { LitElement, css, html, nothing, svg, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, MowerSummaryCardConfig } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { counterSince, mowerMood, mowerPhase, mowerSummaryFeatures, nextRunTime, UNAVAILABLE, type MowerMood } from "./utils";
import "./mower-summary-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-mower-summary-card",
  name: "Modern Mower Summary",
  description: "Mäher-Kurzbericht: Akkuring, animierter Status (mäht, lädt, parkt, Regenpause), heute gemähte Fläche, Messer-Restlaufzeit und nächster geplanter Lauf (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

type Feat = Record<string, string | undefined>;
const MOOD_COLOR: Record<MowerMood, string> = {
  mowing: "#43a047", returning: "#1e88e5", paused: "#fb8c00", charging: "#f9a825", parked: "#78909c", rain: "#42a5f5", error: "#e53935", unknown: "#9e9e9e",
};
const MOOD_ICON: Record<MowerMood, string> = {
  mowing: "mdi:robot-mower", returning: "mdi:home-import-outline", paused: "mdi:pause-circle-outline", charging: "mdi:battery-charging",
  parked: "mdi:home-outline", rain: "mdi:weather-pouring", error: "mdi:alert-circle-outline", unknown: "mdi:help-circle-outline",
};

@customElement("ha-mower-summary-card")
export class HaMowerSummaryCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: MowerSummaryCardConfig;
  /** Zählerstände ab Mitternacht (Fläche, Dauer, Anzahl) */
  @state() private _day: Record<string, { v: number }[]> = {};
  private _cache?: { key: unknown; f: Feat };
  private _interval?: number;
  private _loadedKey?: string;
  private _lastMood?: MowerMood;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-mower-summary-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<MowerSummaryCardConfig> {
    return { entity: Object.keys(hass.states).find((id) => id.startsWith("lawn_mower.")) ?? "" };
  }

  public setConfig(config: MowerSummaryCardConfig): void {
    if (!config?.entity) throw new Error("ha-mower-summary-card: 'entity' (lawn_mower.*) angeben");
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
  }

  public getCardSize(): number {
    return 5;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  private _t(key: string): string {
    return localize(this.hass, `mower_summary.${key}`);
  }

  private _f(): Feat {
    const h = this.hass!;
    if (this._cache && this._cache.key === h.entities) return this._cache.f;
    const auto = mowerSummaryFeatures(h.states, h.entities, this._config!.entity);
    const c = this._config!;
    const f: Feat = { ...auto };
    for (const k of ["battery", "charging", "rain_pause", "blade", "blade_left", "total_area", "total_duration", "total_count", "progress", "session_area", "error", "next_run"]) {
      if (typeof c[k] === "string" && c[k]) f[k] = c[k] as string;
    }
    this._cache = { key: h.entities, f };
    return f;
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || old.locale !== this.hass!.locale || old.entities !== this.hass!.entities) return true;
    const ids = [this._config!.entity, ...Object.values(this._f())].filter((x): x is string => !!x);
    return ids.some((id) => old.states[id] !== this.hass!.states[id]);
  }

  protected updated(): void {
    if (!this.hass) return;
    const f = this._f();
    const key = [f.total_area, f.total_duration, f.total_count].join("|");
    const mood = this._mood();
    // neu laden bei anderer Konfiguration oder wenn ein Lauf endet/beginnt
    if (this._loadedKey !== key || (this._lastMood && this._lastMood !== mood && (mood === "mowing" || this._lastMood === "mowing" || this._lastMood === "returning"))) {
      this._loadedKey = key;
      this._load();
    }
    this._lastMood = mood;
  }

  /** Verlauf der Gesamtzähler seit Mitternacht → heute gemäht/gelaufen/Läufe */
  private async _load(): Promise<void> {
    const h = this.hass;
    if (!h?.callWS) return;
    const f = this._f();
    const ids = [f.total_area, f.total_duration, f.total_count].filter((x): x is string => !!x);
    if (!ids.length) return;
    const now = new Date();
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    try {
      const res = await h.callWS<Record<string, any[]>>({ type: "history/history_during_period", start_time: day.toISOString(), end_time: now.toISOString(),
        entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false });
      const out: Record<string, { v: number }[]> = {};
      for (const id of ids) out[id] = (res?.[id] ?? []).map((p) => ({ v: Number(p.s ?? p.state) })).filter((p) => Number.isFinite(p.v));
      this._day = out;
    } catch { /* ohne Tageswerte */ }
  }

  private _num(id?: string): number | undefined {
    const st = id ? this.hass!.states[id] : undefined;
    if (!st || UNAVAILABLE.includes(st.state)) return undefined;
    const n = Number(st.state);
    return Number.isFinite(n) ? n : undefined;
  }

  private _on(id?: string): boolean {
    return !!id && this.hass!.states[id]?.state === "on";
  }

  private _mood(): MowerMood {
    const f = this._f();
    const st = this.hass!.states[this._config!.entity];
    const err = f.error ? this.hass!.states[f.error]?.state : undefined;
    return mowerMood(mowerPhase(st?.state, err), this._num(f.battery), this._on(f.charging), this._on(f.rain_pause));
  }

  private _fmt(v: number, d = 0): string {
    return v.toLocaleString(getLanguage(this.hass), { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  /** Dauer-Zähler in Minuten (Einheit h, min oder s) */
  private _minutes(id: string | undefined, v: number): number {
    const u = String((id && this.hass!.states[id]?.attributes.unit_of_measurement) ?? "h").toLowerCase();
    return u === "min" ? v : u === "s" ? v / 60 : u === "d" ? v * 1440 : v * 60;
  }

  private _dur(min: number): string {
    if (min < 1) return "0 min";
    if (min < 60) return `${Math.round(min)} min`;
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return m ? `${h} h ${m} min` : `${h} h`;
  }

  private _when(d: Date): { day: string; time: string; rel: string } {
    const lang = getLanguage(this.hass);
    const now = new Date();
    const time = d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
    const dayDiff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000);
    const day = dayDiff === 0 ? this._t("today_at") : dayDiff === 1 ? this._t("tomorrow")
      : dayDiff < 7 ? d.toLocaleDateString(lang, { weekday: "short" }) : d.toLocaleDateString(lang, { day: "2-digit", month: "2-digit" });
    const mins = Math.max(0, Math.round((d.getTime() - now.getTime()) / 60_000));
    const rel = mins < 60 ? `${this._t("in")} ${mins} min` : mins < 48 * 60 ? `${this._t("in")} ${Math.round(mins / 60)} h` : `${this._t("in")} ${Math.round(mins / 1440)} ${this._t("days")}`;
    return { day, time, rel };
  }

  private _moreInfo(id?: string): void {
    if (id) this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  private _ring(level: number | undefined, mood: MowerMood) {
    const r = 38, c = 2 * Math.PI * r;
    const v = Math.max(0, Math.min(100, level ?? 0));
    const col = mood === "charging" ? "#f9a825" : v > 50 ? "#43a047" : v > 20 ? "#fb8c00" : "#e53935";
    return html`<button class="ring ${mood === "charging" ? "charging" : ""}" style="--rc:${col}" @click=${() => this._moreInfo(this._f().battery)}
      aria-label=${`${this._t("battery")} ${level ?? "–"} %`}>
      <svg viewBox="0 0 92 92" aria-hidden="true">
        <circle class="track" cx="46" cy="46" r=${r}></circle>
        <circle class="val" cx="46" cy="46" r=${r} stroke-dasharray=${`${(v / 100) * c} ${c}`} transform="rotate(-90 46 46)"></circle>
      </svg>
      <span class="r-in">
        ${mood === "charging" ? html`<ha-icon icon="mdi:lightning-bolt"></ha-icon>` : nothing}
        <b>${level != null ? Math.round(level) : "–"}<small>%</small></b>
      </span>
    </button>`;
  }

  /** Mäher in Seitenansicht, Front rechts */
  private _mowerSvg() {
    return html`<svg class="mower" viewBox="0 0 70 44" aria-hidden="true">
      ${svg`<rect class="m-dome" x="25" y="4" width="18" height="8" rx="4"></rect>
      <path class="m-body" d="M5 30 Q5 15 22 12.5 L46 11 Q63 11 65 26 L65 31 Q65 34 62 34 L8 34 Q5 34 5 31 Z"></path>
      <path class="m-stripe" d="M14 22 L58 20"></path>
      <g class="wheel w1"><circle cx="18" cy="34" r="8"></circle><path d="M18 27.5 V40.5 M11.5 34 H24.5"></path></g>
      <g class="wheel w2"><circle cx="55" cy="36" r="5.5"></circle><path d="M55 31.5 V40.5 M50.5 36 H59.5"></path></g>`}
    </svg>`;
  }

  private _scene(mood: MowerMood) {
    const drops = mood === "rain" ? Array.from({ length: 18 }, (_, i) =>
      html`<i style="--x:${((i * 37) % 100).toFixed(0)}%;--d:${(-((i * 13) % 10) / 10).toFixed(2)}s;--t:${(0.7 + ((i * 7) % 4) * 0.08).toFixed(2)}s"></i>`) : nothing;
    const clips = mood === "mowing" ? Array.from({ length: 7 }, (_, i) => html`<i style="--d:${(-i * 0.17).toFixed(2)}s;--dx:${-14 - i * 5}px;--dy:${-10 - (i % 3) * 5}px"></i>`) : nothing;
    return html`<button class="scene m-${mood}" @click=${() => this._moreInfo(this._config!.entity)} aria-label=${this._t(`mood_${mood}`)}>
      <span class="sky"></span>
      ${mood === "rain" ? html`<span class="rain">${drops}</span>` : nothing}
      <span class="lawn"></span>
      <span class="tufts"></span>
      <svg class="dock" viewBox="0 0 60 50" aria-hidden="true">
        ${svg`<path class="d-back" d="M30 6 Q38 6 40 14 L42 40 L18 40 L20 14 Q22 6 30 6 Z"></path>
        <rect class="d-plate" x="2" y="38" width="56" height="7" rx="3.5"></rect>
        <path class="d-bolt" d="M32 13 L25 25 H30 L28 34 L36 21 H31 Z"></path>`}
      </svg>
      <span class="bot">${this._mowerSvg()}<span class="clips">${clips}</span></span>
      ${mood === "parked" ? html`<span class="zz"><i>z</i><i>z</i><i>z</i></span>` : nothing}
      ${mood === "error" ? html`<span class="err-b"><ha-icon icon="mdi:exclamation-thick"></ha-icon></span>` : nothing}
      ${mood === "paused" ? html`<span class="pause-b"><ha-icon icon="mdi:pause"></ha-icon></span>` : nothing}
    </button>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const s = this.hass.states;
    const st = s[c.entity];
    if (!st) return html`<ha-card class="ms"><div class="missing">${localize(this.hass, "card.entity_not_found")}: ${c.entity}</div></ha-card>`;
    const f = this._f();
    const mood = this._mood();
    const color = MOOD_COLOR[mood];
    const battery = this._num(f.battery);
    const name = c.name ?? st.attributes.friendly_name ?? c.entity;

    // Heute
    const areaToday = f.total_area ? counterSince(this._day[f.total_area] ?? [], this._num(f.total_area)) : undefined;
    const durToday = f.total_duration ? counterSince(this._day[f.total_duration] ?? [], this._num(f.total_duration)) : undefined;
    const runsToday = f.total_count ? counterSince(this._day[f.total_count] ?? [], this._num(f.total_count)) : undefined;
    const session = this._num(f.area);
    const shownArea = areaToday ?? (mood === "mowing" && session != null ? session : undefined);
    const todaySub = [durToday ? this._dur(this._minutes(f.total_duration, durToday)) : "",
      runsToday ? `${this._fmt(runsToday)} ${this._t(runsToday === 1 ? "run" : "runs")}` : ""].filter(Boolean).join(" · ");

    // Messer
    const bladePct = this._num(f.blade);
    const bladeLeft = this._num(f.blade_left);
    const warnAt = c.blade_warn ?? 15;
    const bladeWarn = bladePct != null && bladePct < warnAt;
    const leftMin = bladeLeft != null ? this._minutes(f.blade_left, bladeLeft) : undefined;

    // Nächster Lauf
    const nextId = c.next_run ?? f.next_run;
    const next = nextRunTime(nextId ? s[nextId] : undefined);
    const w = next ? this._when(next) : undefined;

    // Fortschritt
    const progress = this._num(f.progress);
    const target = this._num(f.session_area);
    const showProgress = (mood === "mowing" || mood === "paused" || mood === "returning") && (progress != null || (session != null && target));
    const pct = progress ?? (session != null && target ? (session / target) * 100 : 0);

    const errSt = mood === "error" && f.error ? s[f.error] : undefined;
    const errText = errSt && !["0", "", "none", "no_error", "unknown", "unavailable"].includes(errSt.state.toLowerCase())
      ? String(errSt.attributes.description ?? errSt.state) : "";
    const sub = mood === "error" ? errText || this._t("mood_error")
      : mood === "charging" && battery != null ? `${this._t("battery")} ${Math.round(battery)} %`
      : "";

    return html`<ha-card class="ms anim-${c.animations ?? "full"}" style="--hcc-accent-c:${color};--mc:${color}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="top">
        ${this._ring(battery, mood)}
        <div class="info">
          <button class="name" @click=${() => this._moreInfo(c.entity)}>${name}</button>
          <span class="chip"><span class="dot"></span><ha-icon .icon=${MOOD_ICON[mood]}></ha-icon>${this._t(`mood_${mood}`)}</span>
          ${sub ? html`<span class="sub">${sub}</span>` : nothing}
        </div>
      </div>
      ${c.show_scene === false ? nothing : this._scene(mood)}
      ${showProgress ? html`<div class="prog">
        <div class="p-bar"><span style="width:${Math.max(0, Math.min(100, pct)).toFixed(1)}%"></span></div>
        <span class="p-txt">${this._t("progress")} ${this._fmt(pct)} %${session != null && target ? html` · ${this._fmt(session)} ${this._t("of")} ${this._fmt(target)} m²` : nothing}</span>
      </div>` : nothing}
      <div class="stats">
        <button class="stat" data-stat="today" @click=${() => this._moreInfo(f.total_area ?? f.area)}>
          <span class="s-l"><ha-icon icon="mdi:grass"></ha-icon>${this._t("today")}</span>
          <span class="s-v">${shownArea != null ? html`${this._fmt(shownArea)}<small> m²</small>` : "–"}</span>
          <span class="s-s">${shownArea ? todaySub || " " : this._t("not_today")}</span>
        </button>
        <button class="stat ${bladeWarn ? "warn" : ""}" data-stat="blade" @click=${() => this._moreInfo(f.blade_left ?? f.blade)}>
          <span class="s-l"><ha-icon icon="mdi:saw-blade"></ha-icon>${this._t("blade")}</span>
          <span class="s-v">${leftMin != null ? html`${this._fmt(leftMin / 60, leftMin < 600 ? 1 : 0)}<small> h</small>`
            : bladePct != null ? html`${this._fmt(bladePct)}<small> %</small>` : "–"}</span>
          ${bladePct != null ? html`<span class="s-bar"><span style="width:${Math.max(2, Math.min(100, bladePct))}%"></span></span>` : nothing}
          <span class="s-s">${bladeWarn ? this._t("blade_change") : leftMin != null && bladePct != null ? `${this._t("blade_left")} · ${this._fmt(bladePct)} %` : leftMin != null ? this._t("blade_left") : " "}</span>
        </button>
        <button class="stat" data-stat="next" @click=${() => this._moreInfo(nextId)}>
          <span class="s-l"><ha-icon icon="mdi:calendar-clock"></ha-icon>${this._t("next")}</span>
          <span class="s-v ${w ? "" : "sm"}">${w ? w.time : mood === "mowing" ? this._t("running_now") : "–"}</span>
          <span class="s-s">${w ? `${w.day} · ${w.rel}` : mood === "mowing" ? " " : this._t("no_plan")}</span>
        </button>
      </div>
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.ms { gap: 12px; container-type: inline-size; }
    .missing { padding: 8px; color: var(--error-color, #e53935); }
    .top { display: flex; align-items: center; gap: 14px; min-width: 0; }
    .ring { position: relative; flex: none; width: 84px; height: 84px; padding: 0; border: none; background: none; cursor: pointer; color: inherit; }
    .ring svg { width: 100%; height: 100%; display: block; }
    .ring circle { fill: none; stroke-width: 8; stroke-linecap: round; }
    .ring .track { stroke: rgba(127,127,127,0.18); }
    .ring .val { stroke: var(--rc); transition: stroke-dasharray 0.8s var(--ease-out), stroke 0.4s; filter: drop-shadow(0 0 5px color-mix(in srgb, var(--rc) 55%, transparent)); }
    .ring.charging .val { animation: charge 2.2s ease-in-out infinite; }
    @keyframes charge { 50% { filter: drop-shadow(0 0 11px var(--rc)); opacity: 0.75; } }
    .r-in { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; }
    .r-in b { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .r-in small { font-size: 12px; font-weight: 600; color: var(--secondary-text-color); margin-left: 1px; }
    .r-in ha-icon { --mdc-icon-size: 16px; color: var(--rc); margin-bottom: 1px; animation: bolt 1.4s ease-in-out infinite; }
    @keyframes bolt { 50% { opacity: 0.35; } }
    .info { display: flex; flex-direction: column; align-items: flex-start; gap: 5px; min-width: 0; }
    .name { padding: 0; border: none; background: none; color: inherit; cursor: pointer; font-size: 17px; font-weight: 600; text-align: left;
      max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .chip { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px 4px 8px; border-radius: 999px; font-size: 13px; font-weight: 700;
      color: var(--mc); background: color-mix(in srgb, var(--mc) 15%, transparent); }
    .chip ha-icon { --mdc-icon-size: 16px; }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--mc); box-shadow: 0 0 0 0 var(--mc); animation: ping 1.8s ease-out infinite; }
    @keyframes ping { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--mc) 60%, transparent); } 100% { box-shadow: 0 0 0 7px transparent; } }
    .sub { font-size: 12.5px; color: var(--secondary-text-color); }

    /* Szene */
    .scene { position: relative; display: block; width: 100%; height: 92px; padding: 0; border: none; border-radius: var(--hcc-inner-radius, 14px); overflow: hidden; cursor: pointer;
      isolation: isolate; --grass-a: #6cbf4f; --grass-b: #5cae42; }
    .sky { position: absolute; inset: 0; background: linear-gradient(180deg, #8cc8f2 0%, #c6e6fa 70%); z-index: -2; }
    .m-rain .sky, .m-error .sky { background: linear-gradient(180deg, #7d8c9c 0%, #a9b6c2 70%); }
    .m-charging .sky, .m-parked .sky { background: linear-gradient(180deg, #9cc9ec 0%, #d9ecf8 70%); }
    .lawn { position: absolute; left: 0; right: 0; bottom: 0; height: 30px; z-index: -1;
      background: repeating-linear-gradient(90deg, var(--grass-a) 0 28px, var(--grass-b) 28px 56px); }
    .tufts { position: absolute; left: 0; right: 0; bottom: 26px; height: 10px; z-index: -1; opacity: 0.9;
      background: radial-gradient(ellipse 5px 9px at 50% 100%, #4e9d38 60%, transparent 62%) 0 0 / 14px 10px repeat-x; }
    .m-mowing .lawn { animation: lawn 1.6s linear infinite; }
    .m-mowing .tufts { animation: tufts 1.6s linear infinite; }
    .m-returning .lawn, .m-returning .tufts { animation: lawn 2.4s linear infinite reverse; }
    @keyframes lawn { to { background-position: -56px 0; } }
    @keyframes tufts { to { background-position: -56px 0; } }
    .dock { position: absolute; right: 10px; bottom: 6px; width: 60px; height: 50px; }
    .d-back { fill: #eceff1; stroke: rgba(0,0,0,0.12); stroke-width: 1; }
    .d-plate { fill: #cfd8dc; }
    .d-bolt { fill: #b0bec5; }
    .m-charging .d-bolt { fill: #f9a825; animation: bolt 1.4s ease-in-out infinite; }
    .bot { position: absolute; bottom: 4px; left: 38%; width: 70px; height: 44px; transition: left 1.2s var(--ease-out); }
    .m-charging .bot, .m-parked .bot, .m-rain .bot { left: calc(100% - 92px); }
    .m-returning .bot { animation: home 5s ease-in-out infinite; }
    @keyframes home { 0% { left: 18%; } 80%, 100% { left: calc(100% - 100px); } }
    .m-mowing .bot { animation: bob 0.45s ease-in-out infinite alternate, drift 7s ease-in-out infinite; }
    @keyframes bob { to { transform: translateY(-1.5px); } }
    @keyframes drift { 0%, 100% { left: 30%; } 50% { left: 44%; } }
    .m-error .bot { animation: shake 0.5s ease-in-out infinite; }
    @keyframes shake { 25% { transform: translateX(-2px) rotate(-2deg); } 75% { transform: translateX(2px) rotate(2deg); } }
    .mower { width: 70px; height: 44px; display: block; overflow: visible; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.25)); }
    .m-body { fill: #fafafa; stroke: rgba(0,0,0,0.15); stroke-width: 1; }
    .m-dome { fill: #37474f; }
    .m-stripe { stroke: var(--mc); stroke-width: 3; stroke-linecap: round; }
    .wheel circle { fill: #263238; }
    .wheel path { stroke: #78909c; stroke-width: 1.6; }
    .wheel { transform-box: fill-box; transform-origin: center; }
    .m-mowing .wheel, .m-returning .wheel { animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .clips { position: absolute; left: 6px; bottom: 8px; }
    .clips i { position: absolute; width: 3px; height: 5px; border-radius: 2px; background: #7cc95e; opacity: 0;
      animation: clip 1.2s ease-out infinite; animation-delay: var(--d); }
    @keyframes clip { 0% { opacity: 0.9; transform: translate(0, 0) rotate(0); } 100% { opacity: 0; transform: translate(var(--dx), var(--dy)) rotate(160deg); } }
    .rain { position: absolute; inset: -20% 0 0; z-index: -1; transform: rotate(8deg); }
    .rain i { position: absolute; top: 0; bottom: 0; left: var(--x); width: 2px; animation: drop var(--t) linear var(--d) infinite; }
    .rain i::after { content: ""; position: absolute; top: 0; width: 1.5px; height: 12px; border-radius: 1px; background: linear-gradient(180deg, transparent, rgba(235,244,255,0.95)); }
    @keyframes drop { from { transform: translateY(-15%); } to { transform: translateY(100%); } }
    .zz { position: absolute; right: 70px; top: 10px; display: flex; gap: 2px; font-weight: 800; color: rgba(55,71,79,0.7); }
    .zz i { font-style: normal; font-size: 11px; animation: zz 2.4s ease-in-out infinite; opacity: 0; }
    .zz i:nth-child(2) { font-size: 13px; animation-delay: 0.4s; }
    .zz i:nth-child(3) { font-size: 15px; animation-delay: 0.8s; }
    @keyframes zz { 0% { opacity: 0; transform: translateY(6px); } 40% { opacity: 1; } 100% { opacity: 0; transform: translateY(-8px); } }
    .err-b, .pause-b { position: absolute; top: 10px; left: calc(38% + 26px); width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center;
      color: #fff; background: #e53935; animation: bolt 1s ease-in-out infinite; }
    .pause-b { background: #fb8c00; animation: none; }
    .err-b ha-icon, .pause-b ha-icon { --mdc-icon-size: 15px; }

    /* Fortschritt */
    .prog { display: flex; flex-direction: column; gap: 4px; }
    .p-bar { height: 8px; border-radius: 999px; background: rgba(127,127,127,0.16); overflow: hidden; }
    .p-bar span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, color-mix(in srgb, var(--mc) 60%, #fff), var(--mc)); transition: width 0.8s var(--ease-out); }
    .p-txt { font-size: 12px; font-weight: 600; color: var(--secondary-text-color); }

    /* Kacheln */
    .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    @container (max-width: 300px) { .stats { grid-template-columns: minmax(0, 1fr); } }
    .stat { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-width: 0; padding: 10px; border: none; border-radius: 14px; cursor: pointer;
      text-align: left; color: inherit; font: inherit; background: rgba(127,127,127,0.08); }
    .stat.warn { background: color-mix(in srgb, #e53935 12%, transparent); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, #e53935 55%, transparent); }
    .s-l { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 700; color: var(--secondary-text-color); white-space: nowrap; }
    .s-l ha-icon { --mdc-icon-size: 14px; }
    .s-v { font-size: 21px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .s-v.sm { font-size: 16px; line-height: 1.55; }
    .s-v small { font-size: 12px; font-weight: 600; color: var(--secondary-text-color); }
    .s-s { font-size: 11.5px; line-height: 1.3; color: var(--secondary-text-color); overflow: hidden; max-width: 100%;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .stat.warn .s-s { color: #e53935; font-weight: 700; }
    .s-bar { width: 100%; height: 4px; margin: 2px 0; border-radius: 999px; background: rgba(127,127,127,0.18); overflow: hidden; }
    .s-bar span { display: block; height: 100%; border-radius: inherit; background: #43a047; }
    .stat.warn .s-bar span { background: #e53935; }
    @container (max-width: 400px) { .s-v { font-size: 18px; } .s-v.sm { font-size: 14px; } .ring { width: 74px; height: 74px; } .r-in b { font-size: 19px; } }
    ha-card.anim-reduced .scene *, ha-card.anim-off * { animation: none !important; }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-mower-summary-card": HaMowerSummaryCard;
  }
}
