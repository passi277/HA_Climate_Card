import { LitElement, css, html, nothing, svg, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, WeatherCardConfig, WeatherForecast } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { skyPhase, sunInfo, sunPlacement, tempScale, weatherHint, weatherIcon, weatherOverlay, windDir, UNAVAILABLE } from "./utils";
import "./weather-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-weather-card",
  name: "Modern Weather Card",
  description: "Wetter mit animiertem Himmel (Tag/Dämmerung/Nacht, Wolken, Regen, Schnee, Gewitter), Hinweis „Regen ab 14 Uhr“, Stundenkurve und 7-Tage-Vorschau mit Temperaturbalken (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

type Unsub = () => void;

@customElement("ha-weather-card")
export class HaWeatherCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: WeatherCardConfig;
  @state() private _daily: WeatherForecast[] = [];
  @state() private _hourly: WeatherForecast[] = [];
  /** Werte, Stundenverlauf und Tage aufgeklappt (pro Wetter-Entität im Browser gemerkt) */
  @state() private _open = true;
  private _subs: Promise<Unsub>[] = [];
  private _subKey = "";

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-weather-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<WeatherCardConfig> {
    return { entity: Object.keys(hass.states).find((id) => id.startsWith("weather.")) ?? "" };
  }

  public setConfig(config: WeatherCardConfig): void {
    if (!config?.entity) throw new Error("ha-weather-card: 'entity' (weather.*) angeben");
    if (this._config?.entity !== config.entity) {
      this._unsubscribe();
      let saved: string | null = null;
      try { saved = localStorage.getItem(`hcc-weather-open:${config.entity}`); } catch { /* kein Speicher */ }
      this._open = saved != null ? saved === "1" : !config.collapsed;
    }
    this._config = { ...config };
  }

  private _toggle(): void {
    this._open = !this._open;
    window.dispatchEvent(new CustomEvent("haptic", { detail: "selection" }));
    try { localStorage.setItem(`hcc-weather-open:${this._config!.entity}`, this._open ? "1" : "0"); } catch { /* kein Speicher */ }
  }

  public getCardSize(): number {
    return 7;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsubscribe();
  }

  private _t(key: string): string {
    return localize(this.hass, `weather.${key}`);
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this._config) return true;
    return old.states[this._config.entity] !== this.hass!.states[this._config.entity] || old.states["sun.sun"] !== this.hass!.states["sun.sun"]
      || old.locale !== this.hass!.locale;
  }

  protected updated(): void {
    this._subscribe();
  }

  // ---------- Vorhersage ----------

  private _unsubscribe(): void {
    for (const s of this._subs) s.then((u) => u()).catch(() => undefined);
    this._subs = [];
    this._subKey = "";
  }

  private _subscribe(): void {
    const id = this._config?.entity;
    const conn = this.hass?.connection;
    if (!id || !conn || !this.isConnected || this._subKey === id) return;
    this._unsubscribe();
    this._subKey = id;
    const legacy = this.hass!.states[id]?.attributes.forecast as WeatherForecast[] | undefined;
    if (legacy?.length) this._daily = legacy;
    const sub = (type: "daily" | "hourly", set: (f: WeatherForecast[]) => void) => {
      const p = conn.subscribeMessage<{ forecast?: WeatherForecast[] }>((msg) => { if (msg.forecast) set(msg.forecast); },
        { type: "weather/subscribe_forecast", forecast_type: type, entity_id: id }) as Promise<Unsub>;
      p.catch(() => undefined);
      this._subs.push(p);
    };
    const feats = Number(this.hass!.states[id]?.attributes.supported_features ?? 3);
    if (feats & 1) sub("daily", (f) => { this._daily = f; });
    if (feats & 2) sub("hourly", (f) => { this._hourly = f; });
    if (!(feats & 1) && feats & 4) sub("twice_daily" as "daily", (f) => { this._daily = f.filter((x) => x.is_daytime !== false); });
  }

  // ---------- Werte ----------

  private _fmt(v: number, digits = 0): string {
    return v.toLocaleString(getLanguage(this.hass), { maximumFractionDigits: digits });
  }

  private _temp(v?: number): string {
    return v == null || !Number.isFinite(v) ? "–" : `${Math.round(v)}°`;
  }

  private _cond(c?: string): string {
    if (!c) return "";
    const key = `cond_${c.replace(/-/g, "_")}`;
    const t = this._t(key);
    return t === `weather.${key}` ? c : t;
  }

  private _hour(d: Date): string {
    return d.toLocaleTimeString(getLanguage(this.hass), { hour: "2-digit", minute: "2-digit" });
  }

  private _moreInfo(): void {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: this._config!.entity }, bubbles: true, composed: true }));
  }

  // ---------- Darstellung ----------

  private _renderSky(condition: string, phase: string, sun?: ReturnType<typeof sunInfo>) {
    const w = weatherOverlay(condition);
    const pos = sun ? sunPlacement(sun) : { x: 74, y: 40 };
    const showSun = phase === "day" || (phase === "twilight" && (sun?.elevation ?? 0) > -3);
    const thunder = /lightning/.test(condition);
    const clear = /sunny|clear/.test(condition);
    return html`<div class="sky ${phase} ${condition}">
      <div class="stars"></div>
      ${showSun && w.clouds < 2 ? html`<span class="sun ${phase}" style="left:${pos.x}%;top:${Math.min(70, pos.y - 20)}%"></span>` : nothing}
      ${phase === "night" && (clear || w.clouds < 2) ? html`<span class="moon" style="left:${Math.min(80, Math.max(20, 100 - pos.x))}%"></span>` : nothing}
      ${w.clouds ? html`<span class="cloud c1"></span><span class="cloud c2"></span>${w.clouds > 1 ? html`<span class="cloud c3"></span><span class="cloud c4"></span>` : nothing}` : nothing}
      ${w.rain ? html`<span class="rain"></span><span class="rain r2"></span>` : nothing}
      ${w.snow ? html`<span class="snow"></span>` : nothing}
      ${w.fog ? html`<span class="fog"></span>` : nothing}
      ${thunder ? html`<span class="flash"></span>` : nothing}
    </div>`;
  }

  private _renderHint(condition: string) {
    const h = weatherHint(this._hourly, condition);
    if (!h) return nothing;
    const icon = { rain_from: "mdi:weather-rainy", rain_until: "mdi:weather-partly-rainy", dry: "mdi:umbrella-closed-outline", frost: "mdi:snowflake-alert",
      storm: "mdi:weather-windy", thunder: "mdi:weather-lightning" }[h.key];
    const at = h.at ? this._hour(h.at) : "";
    const tomorrow = h.at && h.at.getDate() !== new Date().getDate();
    let text = this._t(`hint_${h.key}${h.key === "rain_until" && !h.at ? "_long" : ""}`).replace("{t}", `${tomorrow ? `${this._t("tomorrow")} ` : ""}${at}`);
    if (h.value != null) text = text.replace("{v}", h.key === "frost" ? `${Math.round(h.value)} °C` : `${Math.round(h.value)} km/h`);
    return html`<div class="hint ${h.key}"><ha-icon .icon=${icon}></ha-icon><span>${text}</span></div>`;
  }

  private _renderDetails(a: Record<string, any>) {
    const lang = getLanguage(this.hass);
    const ws = a.wind_speed_unit ?? "km/h";
    const uv = Number(a.uv_index);
    const items = [
      a.wind_speed != null ? { icon: "mdi:weather-windy", v: `${this._fmt(Number(a.wind_speed))} ${ws}`, s: windDir(Number(a.wind_bearing), lang), rot: Number(a.wind_bearing), k: "wind" } : undefined,
      a.wind_gust_speed != null ? { icon: "mdi:weather-windy-variant", v: `${this._fmt(Number(a.wind_gust_speed))} ${ws}`, s: this._t("gusts"), k: "gust" } : undefined,
      a.humidity != null ? { icon: "mdi:water-percent", v: `${this._fmt(Number(a.humidity))} %`, s: this._t("humidity"), k: "humidity" } : undefined,
      Number.isFinite(uv) ? { icon: "mdi:sun-wireless-outline", v: this._fmt(uv, 1), s: `UV · ${this._t(uv < 3 ? "uv_low" : uv < 6 ? "uv_mid" : uv < 8 ? "uv_high" : "uv_vhigh")}`, k: "uv", lvl: uv < 3 ? "low" : uv < 6 ? "mid" : "high" } : undefined,
      a.pressure != null ? { icon: "mdi:gauge", v: `${this._fmt(Number(a.pressure))} ${a.pressure_unit ?? "hPa"}`, s: this._t("pressure"), k: "pressure" } : undefined,
      a.dew_point != null ? { icon: "mdi:water-thermometer-outline", v: `${this._fmt(Number(a.dew_point), 1)}°`, s: this._t("dew_point"), k: "dew" } : undefined,
      a.cloud_coverage != null ? { icon: "mdi:cloud-percent-outline", v: `${this._fmt(Number(a.cloud_coverage))} %`, s: this._t("clouds"), k: "clouds" } : undefined,
      a.visibility != null ? { icon: "mdi:eye-outline", v: `${this._fmt(Number(a.visibility), 1)} ${a.visibility_unit ?? "km"}`, s: this._t("visibility"), k: "vis" } : undefined,
    ].filter((x): x is NonNullable<typeof x> => !!x);
    if (!items.length) return nothing;
    return html`<div class="details">${items.map((x) => html`<div class="det" data-k=${x.k}>
      ${x.k === "wind" && Number.isFinite(x.rot) ? html`<ha-icon class="arrow" icon="mdi:navigation" style="transform:rotate(${(x.rot! + 180) % 360}deg)"></ha-icon>` : html`<ha-icon .icon=${x.icon} class=${x.lvl ? `uv-${x.lvl}` : ""}></ha-icon>`}
      <span><b>${x.v}</b><small>${x.s}</small></span></div>`)}</div>`;
  }

  private _renderHourly() {
    const hours = Math.max(6, this._config!.hours ?? 24);
    const now = Date.now();
    const list = this._hourly.filter((h) => new Date(h.datetime).getTime() >= now - 45 * 60_000).slice(0, hours);
    if (list.length < 3) return nothing;
    const COL = 46, H = 64, top = 18, bottom = 10;
    const W = COL * list.length;
    const temps = list.map((h) => h.temperature ?? 0);
    const min = Math.min(...temps), max = Math.max(...temps), span = Math.max(max - min, 2);
    const y = (t: number) => top + (1 - (t - min) / span) * (H - top - bottom);
    const pts = list.map((h, i) => [i * COL + COL / 2, y(h.temperature ?? 0)] as const);
    const d = pts.map(([x, yy], i) => (i ? `L${x.toFixed(1)},${yy.toFixed(1)}` : `M${x.toFixed(1)},${yy.toFixed(1)}`)).join("");
    const maxRain = Math.max(...list.map((h) => h.precipitation ?? 0), 2);
    return html`<div class="hourly-wrap"><div class="hourly" style="width:${W}px">
      <svg class="h-curve" viewBox="0 0 ${W} ${H}" width=${W} height=${H} aria-hidden="true">
        <defs><linearGradient id="wt-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb74d" stop-opacity="0.35"></stop><stop offset="1" stop-color="#ffb74d" stop-opacity="0"></stop></linearGradient></defs>
        ${list.map((h, i) => (h.precipitation ?? 0) > 0 ? svg`<rect class="h-rain" x=${i * COL + 10} width=${COL - 20} y=${H - ((h.precipitation ?? 0) / maxRain) * 34} height=${((h.precipitation ?? 0) / maxRain) * 34} rx="3"></rect>` : nothing)}
        ${svg`<path class="h-area" d=${`${d}L${pts[pts.length - 1]![0]},${H}L${pts[0]![0]},${H}Z`}></path><path class="h-line" d=${d}></path>`}
        ${pts.map(([x, yy], i) => svg`<circle class="h-dot" cx=${x} cy=${yy} r="2.5"></circle><text class="hc-temp" x=${x} y=${yy - 7}>${Math.round(list[i]!.temperature ?? 0)}°</text>`)}
      </svg>
      <div class="h-cols">${list.map((h, i) => {
        const t = new Date(h.datetime);
        const night = h.is_daytime === false || t.getHours() < 6 || t.getHours() >= 21;
        return html`<div class="h-col">
          <ha-icon .icon=${weatherIcon(h.condition, night)}></ha-icon>
          ${(h.precipitation_probability ?? 0) >= 20 ? html`<small class="h-prob">${Math.round(h.precipitation_probability!)} %</small>` : (h.precipitation ?? 0) > 0 ? html`<small class="h-prob">${this._fmt(h.precipitation!, 1)}</small>` : html`<small class="h-prob"></small>`}
          <span class="h-time">${i === 0 ? this._t("now") : `${String(t.getHours()).padStart(2, "0")}`}</span>
        </div>`;
      })}</div>
    </div></div>`;
  }

  private _renderDaily() {
    const days = this._daily.slice(0, Math.max(3, this._config!.days ?? 7));
    if (!days.length) return nothing;
    const { min, max } = tempScale(days);
    const span = max - min;
    const lang = getLanguage(this.hass);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return html`<div class="daily">${days.map((d) => {
      const date = new Date(d.datetime);
      const day = new Date(date); day.setHours(0, 0, 0, 0);
      const diff = Math.round((day.getTime() - today.getTime()) / 86400_000);
      const label = diff === 0 ? this._t("today") : diff === 1 ? this._t("tomorrow_short") : date.toLocaleDateString(lang, { weekday: "short" });
      const lo = d.templow ?? d.temperature ?? min, hi = d.temperature ?? lo;
      const left = ((lo - min) / span) * 100, width = Math.max(4, ((hi - lo) / span) * 100);
      const prob = d.precipitation_probability, rain = d.precipitation;
      return html`<div class="day ${diff === 0 ? "today" : ""}" data-day>
        <span class="d-name">${label}</span>
        <ha-icon .icon=${weatherIcon(d.condition)}></ha-icon>
        <span class="d-rain">${prob != null && prob >= 10 ? `${Math.round(prob)} %` : rain != null && rain > 0 ? `${this._fmt(rain, 1)} mm` : ""}</span>
        <span class="d-lo">${this._temp(lo)}</span>
        <span class="d-bar"><span style="left:${left}%;width:${width}%; --lo:${tempColor(lo)}; --hi:${tempColor(hi)}"></span></span>
        <span class="d-hi">${this._temp(hi)}</span>
      </div>`;
    })}</div>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const st = this.hass.states[c.entity];
    if (!st || UNAVAILABLE.includes(st.state)) return html`<ha-card class="wx"><div class="missing">${this._t("missing")}: ${c.entity}</div></ha-card>`;
    const a = st.attributes;
    const sun = sunInfo(this.hass.states["sun.sun"]);
    const phase = skyPhase(sun?.elevation);
    const night = phase === "night" || st.state === "clear-night";
    const today = this._daily[0];
    const feels = a.apparent_temperature;
    const name = c.name ?? (a.friendly_name ? String(a.friendly_name) : this._t("title"));
    return html`<ha-card class="wx anim-${c.animations ?? "full"}">
      <button class="hero" @click=${() => this._moreInfo()} aria-label=${`${name}: ${this._cond(st.state)} ${this._temp(Number(a.temperature))}`}>
        ${this._renderSky(st.state, phase, sun)}
        <span class="h-top"><ha-icon icon="mdi:map-marker-outline"></ha-icon>${name}</span>
        <span class="h-main">
          <span class="h-temp">${this._temp(Number(a.temperature))}</span>
          <span class="h-info">
            <span class="h-cond"><ha-icon .icon=${weatherIcon(st.state, night)}></ha-icon>${this._cond(st.state)}</span>
            ${today ? html`<span class="h-range">↑ ${this._temp(today.temperature)}  ↓ ${this._temp(today.templow)}</span>` : nothing}
            ${feels != null ? html`<span class="h-feels">${this._t("feels")} ${this._temp(Number(feels))}</span>` : nothing}
          </span>
        </span>
      </button>
      ${this._renderHint(st.state)}
      ${c.show_details !== false || c.show_hourly !== false || c.show_daily !== false ? html`
        <button class="fold ${this._open ? "open" : ""}" aria-expanded=${this._open} @click=${() => this._toggle()}>
          <ha-icon icon="mdi:chart-timeline-variant"></ha-icon><span>${this._t(this._open ? "less" : "more")}</span>
          ${!this._open && this._daily.length > 1 ? html`<small>${this._daily.slice(1, 4).map((d) => html`<ha-icon .icon=${weatherIcon(d.condition)}></ha-icon>${this._temp(d.temperature)}`)}</small>` : nothing}
          <ha-icon class="chev" icon="mdi:chevron-down"></ha-icon>
        </button>
        ${this._open ? html`<div class="fold-body">
          ${c.show_details !== false ? this._renderDetails(a) : nothing}
          ${c.show_hourly !== false ? this._renderHourly() : nothing}
          ${c.show_daily !== false ? this._renderDaily() : nothing}
        </div>` : nothing}` : nothing}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.wx { gap: 12px; container-type: inline-size; }
    .missing { padding: 8px; color: var(--error-color, #e53935); }

    /* Hero mit Himmel */
    .hero { position: relative; display: block; width: 100%; min-height: 150px; padding: 0; border: none; cursor: pointer; overflow: hidden; text-align: left;
      border-radius: var(--hcc-inner-radius, 14px); color: #fff; isolation: isolate; }
    .sky { position: absolute; inset: 0; z-index: -1; overflow: hidden; }
    .sky.day { background: linear-gradient(180deg, #3d8fe0 0%, #78b8f0 60%, #b9dcf7 100%); }
    .sky.day.cloudy, .sky.day.rainy, .sky.day.pouring, .sky.day.fog, .sky.day.snowy, .sky.day.hail, .sky.day.snowy-rainy, .sky.day.lightning, .sky.day.lightning-rainy {
      background: linear-gradient(180deg, #5f7184 0%, #8797a8 60%, #aab6c2 100%); }
    .sky.twilight { background: linear-gradient(180deg, #2e3570 0%, #8c4f86 55%, #f08a5a 100%); }
    .sky.night { background: linear-gradient(180deg, #070d24 0%, #121d44 60%, #22345f 100%); }
    .stars { position: absolute; inset: 0; opacity: 0; transition: opacity 1.2s;
      background-image: radial-gradient(1.4px 1.4px at 12% 22%, #fff 60%, transparent), radial-gradient(1px 1px at 28% 48%, #fff 60%, transparent),
        radial-gradient(1.2px 1.2px at 44% 16%, #fff 60%, transparent), radial-gradient(1px 1px at 61% 38%, #fff 60%, transparent),
        radial-gradient(1.5px 1.5px at 77% 14%, #fff 60%, transparent), radial-gradient(1px 1px at 88% 52%, #fff 60%, transparent),
        radial-gradient(1px 1px at 8% 66%, #fff 60%, transparent), radial-gradient(1.2px 1.2px at 52% 70%, #fff 60%, transparent); }
    .sky.night .stars { opacity: 0.9; animation: twinkle 4s ease-in-out infinite alternate; }
    .sky.twilight .stars { opacity: 0.3; }
    @keyframes twinkle { to { opacity: 0.55; } }
    .sun { position: absolute; width: 90px; height: 90px; border-radius: 50%; transform: translate(-50%, -50%);
      background: radial-gradient(circle, #fff8d6 0%, #ffd54f 32%, rgba(255,193,7,0.35) 52%, rgba(255,193,7,0) 70%); animation: glow 6s ease-in-out infinite alternate; }
    .sun.twilight { background: radial-gradient(circle, #ffe0b0 0%, #ff8a4c 40%, rgba(255,110,60,0) 70%); }
    @keyframes glow { to { transform: translate(-50%, -50%) scale(1.08); } }
    .moon { position: absolute; top: 18%; width: 34px; height: 34px; border-radius: 50%; background: #f4f1de; box-shadow: 0 0 22px rgba(244,241,222,0.5);
      -webkit-mask: radial-gradient(circle at 70% 35%, transparent 38%, #000 40%); mask: radial-gradient(circle at 70% 35%, transparent 38%, #000 40%); }
    .cloud { position: absolute; height: 34px; border-radius: 999px; background: rgba(255,255,255,0.85); filter: blur(1px); animation: drift 38s linear infinite; }
    .cloud::before { content: ""; position: absolute; left: 22%; bottom: 40%; width: 46%; height: 130%; border-radius: 50%; background: inherit; }
    .sky.night .cloud { background: rgba(110,125,160,0.6); }
    .sky.twilight .cloud { background: rgba(255,205,195,0.65); }
    .sky.cloudy .cloud, .sky.rainy .cloud, .sky.pouring .cloud, .sky.lightning .cloud, .sky.lightning-rainy .cloud { background: rgba(225,230,236,0.9); }
    .sky.night.cloudy .cloud, .sky.night.rainy .cloud { background: rgba(90,100,125,0.75); }
    .cloud.c1 { left: 52%; top: 18%; width: 120px; opacity: 0.9; animation-duration: 46s; }
    .cloud.c2 { left: 8%; top: 46%; width: 90px; opacity: 0.75; animation-duration: 60s; animation-delay: -20s; }
    .cloud.c3 { left: 30%; top: 8%; width: 150px; opacity: 0.85; animation-duration: 52s; animation-delay: -8s; }
    .cloud.c4 { left: 70%; top: 52%; width: 110px; opacity: 0.7; animation-duration: 70s; animation-delay: -35s; }
    @keyframes drift { from { translate: -30px 0; } 50% { translate: 30px 0; } to { translate: -30px 0; } }
    .rain { position: absolute; inset: 0; opacity: 0.55;
      background: repeating-linear-gradient(105deg, transparent 0 9px, rgba(220,235,255,0.75) 9px 10px, transparent 10px 22px);
      background-size: 100% 60px; animation: fall 0.6s linear infinite; }
    .rain.r2 { opacity: 0.35; background-size: 100% 44px; animation-duration: 0.45s; }
    @keyframes fall { to { background-position: -12px 60px; } }
    .snow { position: absolute; inset: 0; opacity: 0.9;
      background-image: radial-gradient(2px 2px at 10% 20%, #fff 60%, transparent), radial-gradient(2.5px 2.5px at 30% 60%, #fff 60%, transparent),
        radial-gradient(2px 2px at 55% 30%, #fff 60%, transparent), radial-gradient(3px 3px at 75% 70%, #fff 60%, transparent), radial-gradient(2px 2px at 90% 40%, #fff 60%, transparent);
      background-size: 100% 80px; animation: snow 3s linear infinite; }
    @keyframes snow { to { background-position: 10px 80px; } }
    .fog { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.55)); }
    .flash { position: absolute; inset: 0; background: #fff; opacity: 0; animation: flash 7s linear infinite; }
    @keyframes flash { 0%, 91%, 95%, 100% { opacity: 0; } 92% { opacity: 0.7; } 93% { opacity: 0.1; } 94% { opacity: 0.5; } }
    ha-card.anim-reduced .sky *, ha-card.anim-off .sky * { animation: none !important; }
    .h-top { position: absolute; top: 12px; left: 14px; display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600; opacity: 0.92;
      text-shadow: 0 1px 3px rgba(0,0,0,0.35); }
    .h-top ha-icon { --mdc-icon-size: 16px; }
    .h-main { position: relative; display: flex; align-items: flex-end; gap: 14px; padding: 42px 16px 14px; text-shadow: 0 1px 4px rgba(0,0,0,0.35); }
    .h-temp { font-size: clamp(52px, 17cqi, 72px); font-weight: 300; line-height: 0.9; letter-spacing: -0.04em; }
    .h-info { display: flex; flex-direction: column; gap: 2px; padding-bottom: 4px; min-width: 0; }
    .h-cond { display: flex; align-items: center; gap: 5px; font-size: 16px; font-weight: 700; line-height: 1.2; }
    .h-cond ha-icon { --mdc-icon-size: 20px; flex: none; }
    .h-range, .h-feels { font-size: 13px; font-weight: 600; opacity: 0.92; white-space: nowrap; }

    /* Hinweis */
    .hint { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: var(--hcc-inner-radius, 14px); font-size: 13.5px; font-weight: 600;
      --hc: #42a5f5; color: var(--primary-text-color); background: color-mix(in srgb, var(--hc) 13%, transparent); }
    .hint ha-icon { --mdc-icon-size: 20px; color: var(--hc); flex: none; }
    .hint.dry { --hc: var(--success-color, #43a047); }

    /* Auf-/Zuklappen */
    .fold { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px; border: none; border-radius: var(--hcc-inner-radius, 14px); cursor: pointer;
      font-size: 13px; font-weight: 600; color: var(--secondary-text-color); background: rgba(127,127,127,0.07); text-align: left; }
    .fold > ha-icon { --mdc-icon-size: 18px; flex: none; }
    .fold > span { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    @container (max-width: 380px) { .fold small { display: none; } }
    .fold small { display: inline-flex; align-items: center; gap: 2px 8px; flex-wrap: wrap; font-size: 12.5px; font-weight: 700; color: var(--primary-text-color); }
    .fold small ha-icon { --mdc-icon-size: 16px; color: var(--secondary-text-color); margin-right: -5px; }
    .fold .chev { transition: transform 0.3s var(--ease-out); }
    .fold.open .chev { transform: rotate(180deg); }
    .fold-body { display: flex; flex-direction: column; gap: 12px; animation: fold-in 0.3s var(--ease-out) both; }
    @keyframes fold-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
    ha-card.anim-off .fold-body { animation: none; }
    .hint.frost { --hc: #4fc3f7; }
    .hint.storm, .hint.thunder { --hc: #fb8c00; }

    /* Werte */
    .details { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 6px; }
    .det { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 12px; background: rgba(127,127,127,0.07); min-width: 0; }
    .det > ha-icon { --mdc-icon-size: 20px; color: var(--secondary-text-color); flex: none; transition: transform 0.6s; }
    .det .arrow { color: #42a5f5; }
    .uv-low { color: var(--success-color, #43a047) !important; }
    .uv-mid { color: #fb8c00 !important; }
    .uv-high { color: var(--error-color, #e53935) !important; }
    .det span { display: flex; flex-direction: column; min-width: 0; }
    .det b { font-size: 13.5px; white-space: nowrap; }
    .det small { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* Stunden */
    .hourly-wrap { overflow-x: auto; scrollbar-width: thin; margin: 0 -4px; padding: 0 4px 4px; -webkit-overflow-scrolling: touch; }
    .hourly { display: flex; flex-direction: column; }
    .h-curve { display: block; overflow: visible; }
    .h-area { fill: url(#wt-fill); }
    .h-line { fill: none; stroke: #ffb74d; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
    .h-dot { fill: #ffb74d; }
    .hc-temp { fill: var(--primary-text-color); font-size: 11px; font-weight: 700; text-anchor: middle; }
    .h-rain { fill: rgba(66,165,245,0.35); }
    .h-cols { display: flex; }
    .h-col { width: 46px; flex: none; display: flex; flex-direction: column; align-items: center; gap: 1px; }
    .h-col ha-icon { --mdc-icon-size: 20px; color: var(--secondary-text-color); }
    .h-prob { min-height: 14px; font-size: 10.5px; font-weight: 700; color: #42a5f5; }
    .h-time { font-size: 11.5px; font-weight: 600; color: var(--secondary-text-color); }

    /* Tage */
    .daily { display: flex; flex-direction: column; }
    .day { display: grid; grid-template-columns: 52px 24px 44px 34px minmax(40px, 1fr) 34px; align-items: center; gap: 8px; padding: 6px 4px; border-radius: 10px; }
    .day + .day { border-top: 1px solid rgba(127,127,127,0.1); }
    .day.today { background: rgba(127,127,127,0.07); border-top-color: transparent; }
    .day.today + .day { border-top-color: transparent; }
    .d-name { font-size: 14px; font-weight: 600; text-transform: capitalize; }
    .day ha-icon { --mdc-icon-size: 22px; color: var(--secondary-text-color); }
    .d-rain { font-size: 11.5px; font-weight: 700; color: #42a5f5; white-space: nowrap; }
    .d-lo { font-size: 14px; color: var(--secondary-text-color); text-align: right; }
    .d-hi { font-size: 14px; font-weight: 700; }
    .d-bar { position: relative; height: 6px; border-radius: 3px; background: rgba(127,127,127,0.16); }
    .d-bar span { position: absolute; top: 0; bottom: 0; border-radius: inherit; background: linear-gradient(90deg, var(--lo), var(--hi)); }
    @container (max-width: 380px) { .day { grid-template-columns: 58px 22px 30px minmax(30px, 1fr) 30px; gap: 6px; } .d-rain { display: none; } }
  `];
}

/** Farbe zur Temperatur (blau → grün → gelb → orange → rot) */
const tempColor = (t: number): string =>
  t <= -5 ? "#5c6bc0" : t <= 0 ? "#42a5f5" : t <= 8 ? "#26c6da" : t <= 15 ? "#66bb6a" : t <= 20 ? "#d4e157" : t <= 25 ? "#ffca28" : t <= 30 ? "#ffa726" : "#ef5350";

declare global {
  interface HTMLElementTagNameMap {
    "ha-weather-card": HaWeatherCard;
  }
}
