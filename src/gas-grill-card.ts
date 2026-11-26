import { LitElement, css, html, nothing, svg, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { GasGrillCardConfig, HassEntity, HomeAssistant } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { GRILL_KNOB_COLORS, gasGrillEntities, gasPercent, probeProgress, UNAVAILABLE, type GasGrillEntities, type GasGrillProbe } from "./utils";
import "./gas-grill-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-gas-grill-card",
  name: "Modern Gas Grill Card",
  description: "Gasgrill (Grillfürst Independence P530E): gezeichneter Grill mit Garraumlicht, Logo und Reglerbeleuchtung, Grillmodus mit Zieltemperatur, Fühler F1–F4 mit Garstufen, Timer und Gasflasche (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const MODES = ["direct", "indirect", "low_slow", "stage", "free"] as const;
const MODE_ICON: Record<string, string> = {
  direct: "mdi:fire", indirect: "mdi:fire-circle", low_slow: "mdi:snail", stage: "mdi:stairs", free: "mdi:tune-variant",
};
/** Zieltemperatur je Modus (Stufen- und freier Modus regeln über die Drehregler) */
const MODE_TARGET: Record<string, string> = { direct: "target_direct", indirect: "target_indirect", low_slow: "target_low_slow" };
const KNOB_MODES = ["off", "individual", "random", "temperature", "magic"] as const;
const KNOB_MODE_ICON: Record<string, string> = {
  off: "mdi:lightbulb-off-outline", individual: "mdi:palette", random: "mdi:dice-multiple", temperature: "mdi:thermometer", magic: "mdi:auto-fix",
};
const TIMER_QUICK = [5, 10, 15, 30, 60];
const KNOB_X = [128, 157, 186, 215, 244, 273];
const PALETTE = Object.values(GRILL_KNOB_COLORS);
const PROBE_COLORS = ["#e53935", "#1e88e5", "#43a047", "#8e24aa"];

/** Farbe nach Temperatur (kalt blau → heiß rot) */
const heatColor = (t?: number): string => {
  if (t == null) return "#9e9e9e";
  if (t < 40) return "#42a5f5";
  if (t < 100) return "#ffb300";
  if (t < 200) return "#fb8c00";
  if (t < 280) return "#f4511e";
  return "#d50000";
};

@customElement("ha-gas-grill-card")
export class HaGasGrillCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: GasGrillCardConfig;
  @state() private _gasOpen = false;
  @state() private _expanded = false;
  @state() private _hist: Record<string, { t: number; v: number }[]> = {};
  private _cache?: { key: unknown; device?: string; r: GasGrillEntities };
  private _interval?: number;
  private _loadedKey?: string;

  public connectedCallback(): void {
    super.connectedCallback();
    this._interval = window.setInterval(() => { this._loadedKey = undefined; this.requestUpdate(); }, 120_000);
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this._interval);
  }

  /** Temperaturen fürs Diagramm: Garraum + eingesteckte Fühler */
  private _graphIds(): string[] {
    const r = this._r();
    const probes = r.probes.filter((p) => (this._numOf(p.temp ? this.hass!.states[p.temp] : undefined) ?? 0) > 0).map((p) => p.temp!);
    return [r.e.chamber_temperature, ...probes].filter((x): x is string => !!x);
  }

  protected updated(): void {
    if (!this.hass?.callWS || this._config?.show_graph === false || (this._config?.layout === "compact" && !this._expanded)) return;
    const ids = this._graphIds();
    const key = ids.join(",");
    if (!ids.length || this._loadedKey === key) return;
    this._loadedKey = key;
    this._loadHistory(ids);
  }

  /** Verlauf seit Beginn der Grillsession (sonst 3 h, höchstens 8 h) */
  private async _loadHistory(ids: string[]): Promise<void> {
    const startSt = this._st("session_start");
    const sessionStart = startSt && !UNAVAILABLE.includes(startSt.state) ? Date.parse(startSt.state) : NaN;
    const now = Date.now();
    const start = Number.isFinite(sessionStart) && this._on("grilling") ? Math.max(now - 8 * 3_600_000, sessionStart - 600_000) : now - 3 * 3_600_000;
    try {
      const res = await this.hass!.callWS<Record<string, any[]>>({ type: "history/history_during_period", start_time: new Date(start).toISOString(),
        end_time: new Date(now).toISOString(), entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false });
      const hist: Record<string, { t: number; v: number }[]> = {};
      for (const id of ids) hist[id] = (res?.[id] ?? []).map((q) => ({ t: q.lu != null ? q.lu * 1000 : Date.parse(q.last_updated ?? q.last_changed), v: Number(q.s ?? q.state) }))
        .filter((q) => Number.isFinite(q.v) && Number.isFinite(q.t) && q.v > 0);
      this._hist = hist;
    } catch { /* ohne Verlauf */ }
  }

  /** Zeitstempel-Sensor → ms (nur Zukunft) */
  private _at(id?: string): number | undefined {
    const st = id ? this.hass!.states[id] : undefined;
    if (!st || UNAVAILABLE.includes(st.state)) return undefined;
    const t = Date.parse(st.state);
    return Number.isFinite(t) && t > Date.now() ? t : undefined;
  }

  private _time(ms: number): string {
    return new Date(ms).toLocaleTimeString(getLanguage(this.hass), { hour: "2-digit", minute: "2-digit" });
  }

  private _dur(min: number): string {
    const m = Math.max(0, Math.round(min));
    return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min` : `${m} min`;
  }

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-gas-grill-card-editor");
  }

  public static getStubConfig(): Partial<GasGrillCardConfig> {
    return {};
  }

  public setConfig(config: GasGrillCardConfig): void {
    this._config = { ...(config ?? { type: "custom:ha-gas-grill-card" }) };
    this._cache = undefined;
  }

  public getCardSize(): number {
    return 10;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  private _t(key: string): string {
    return localize(this.hass, `gas_grill.${key}`);
  }

  private _r(): GasGrillEntities {
    const h = this.hass!;
    const c = this._config!;
    if (this._cache && this._cache.key === h.entities && this._cache.device === c.device) return this._cache.r;
    const r = gasGrillEntities(h.entities, c.device, c.entities);
    this._cache = { key: h.entities, device: c.device, r };
    return r;
  }

  private _ids(): string[] {
    const r = this._r();
    return [...Object.values(r.e), ...r.probes.flatMap((p) => [p.temp, p.target, p.preset])].filter((x): x is string => !!x);
  }

  private _st(key: string): HassEntity | undefined {
    const id = this._r().e[key];
    return id ? this.hass!.states[id] : undefined;
  }

  private _numOf(st?: HassEntity): number | undefined {
    if (!st || UNAVAILABLE.includes(st.state)) return undefined;
    const n = Number(st.state);
    return Number.isFinite(n) ? n : undefined;
  }

  private _num(key: string): number | undefined {
    return this._numOf(this._st(key));
  }

  private _on(key: string): boolean {
    return this._st(key)?.state === "on";
  }

  private _fmt(v: number, digits = 0): string {
    return v.toLocaleString(getLanguage(this.hass), { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  /** Übersetzter Zustand (Optionen von select/sensor), sonst eigener Text */
  private _label(st: HassEntity | undefined, value: string, fallback: string): string {
    if (st && this.hass?.formatEntityState) {
      const s = this.hass.formatEntityState(st, value);
      if (s && s !== value) return s;
    }
    const t = localize(this.hass, fallback);
    return t && t !== fallback ? t : value;
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || old.locale !== this.hass!.locale || old.entities !== this.hass!.entities) return true;
    return this._ids().some((id) => old.states[id] !== this.hass!.states[id]);
  }

  private async _call(domain: string, service: string, data: Record<string, unknown>): Promise<void> {
    window.dispatchEvent(new CustomEvent("haptic", { detail: "selection" }));
    try {
      await this.hass!.callService(domain, service, data);
    } catch (err: any) {
      this.dispatchEvent(new CustomEvent("hass-notification", {
        detail: { message: `${localize(this.hass, "card.error")}: ${err?.message ?? err}` }, bubbles: true, composed: true,
      }));
    }
  }

  private _toggle(key: string): void {
    const id = this._r().e[key];
    if (id) this._call("switch", this._on(key) ? "turn_off" : "turn_on", { entity_id: id });
  }

  private _select(id: string | undefined, option: string): void {
    if (id) this._call("select", "select_option", { entity_id: id, option });
  }

  private _press(key: string): void {
    const id = this._r().e[key];
    if (id) this._call("button", "press", { entity_id: id });
  }

  /** Zahl um delta verstellen, auf min/max der Entität begrenzt */
  private _step(id: string | undefined, delta: number, absolute?: number): void {
    const st = id ? this.hass!.states[id] : undefined;
    const cur = this._numOf(st);
    if (!st || (cur == null && absolute == null)) return;
    const min = Number(st.attributes.min ?? -Infinity), max = Number(st.attributes.max ?? Infinity);
    const raw = absolute ?? cur! + delta;
    const value = Math.round(Math.min(max, Math.max(min, raw)) * 10) / 10;
    if (value !== cur) this._call("number", "set_value", { entity_id: id, value });
  }

  private _moreInfo(id?: string): void {
    if (id) this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  /* ---------------- Grill-Zeichnung ---------------- */

  private _knobColors(mode: string, chamber?: number): string[] {
    const color = GRILL_KNOB_COLORS[this._st("knob_color")?.state ?? ""] ?? GRILL_KNOB_COLORS.red!;
    if (mode === "off") return KNOB_X.map(() => "");
    if (mode === "random") return KNOB_X.map((_, i) => PALETTE[(i * 3) % PALETTE.length]!);
    if (mode === "temperature") return KNOB_X.map(() => heatColor(chamber));
    if (mode === "magic") return KNOB_X.map((_, i) => PALETTE[i % PALETTE.length]!);
    return KNOB_X.map(() => color);
  }

  private _scene() {
    const chamberLight = this._on("chamber_light");
    const logo = this._on("logo_light");
    const chamber = this._num("chamber_temperature");
    const knobMode = this._st("knob_light_mode")?.state ?? (this._on("knob_light") ? "individual" : "off");
    const knobs = this._knobColors(UNAVAILABLE.includes(knobMode) ? "off" : knobMode, chamber);
    const hot = chamber != null && chamber >= 60;
    const pct = gasPercent(this._num("gas_remaining"), this._num("cylinder_size"), this._num("gas_level"));
    const warn = this._config?.gas_warning ?? 20;
    const gasColor = pct == null ? "#9e9e9e" : pct <= warn ? "#e53935" : pct <= 40 ? "#fb8c00" : "#43a047";
    const fillH = ((pct ?? 0) / 100) * 40;
    // Zeiger des Deckelthermometers: 0–400 °C über 240°
    const ang = -120 + (Math.min(400, Math.max(0, chamber ?? 0)) / 400) * 240;
    const rad = (ang - 90) * (Math.PI / 180);
    const has = (k: string) => !!this._r().e[k];
    return html`<div class="scene ${hot ? "hot" : ""} knob-${knobMode}">
      <svg viewBox="0 0 400 200" role="img" aria-label=${this._t("title")}>
        <defs>
          <linearGradient id="hood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b5f66"></stop><stop offset="1" stop-color="#2f3237"></stop></linearGradient>
          <linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3d42"></stop><stop offset="1" stop-color="#25272b"></stop></linearGradient>
          <radialGradient id="lamp" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffe0a3" stop-opacity="0.85"></stop><stop offset="1" stop-color="#ffb74d" stop-opacity="0"></stop></radialGradient>
          <linearGradient id="gas" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color=${gasColor}></stop><stop offset="1" stop-color=${gasColor} stop-opacity="0.65"></stop></linearGradient>
          <clipPath id="cyl"><rect x="323" y="134" width="34" height="44" rx="9"></rect></clipPath>
        </defs>
        <ellipse class="shadow" cx="200" cy="190" rx="190" ry="8"></ellipse>
        <!-- Seitenteile -->
        <rect class="shelf" x="14" y="104" width="90" height="10" rx="3"></rect>
        <rect class="cab" x="22" y="114" width="76" height="68" rx="5"></rect>
        <rect class="shelf" x="296" y="104" width="90" height="10" rx="3"></rect>
        <rect class="cab" x="304" y="114" width="76" height="68" rx="5"></rect>
        <!-- Seitenbrenner-Regler links -->
        ${[44, 76].map((x, i) => svg`<g class="knob ${knobs[i] ? "lit" : ""}" style="--kc:${knobs[i] || "transparent"}" transform="translate(${x} 97)">
          <circle class="k-glow" r="9"></circle><circle class="k-cap" r="6"></circle><line class="k-mark" x1="0" y1="-5" x2="0" y2="-2"></line></g>`)}
        <!-- Display rechts -->
        <rect class="screen" x="320" y="90" width="44" height="14" rx="3"></rect>
        <text class="screen-t" x="342" y="100.5" text-anchor="middle">${chamber != null ? `${Math.round(chamber)}°` : "––"}</text>
        <!-- Gasflasche im Schrank -->
        <g class="cylinder" @click=${() => this._moreInfo(this._r().e.gas_remaining)}>
          <rect class="cyl-body" x="323" y="134" width="34" height="44" rx="9"></rect>
          <rect clip-path="url(#cyl)" fill="url(#gas)" x="323" y=${178 - fillH} width="34" height=${fillH}></rect>
          <rect class="cyl-neck" x="334" y="126" width="12" height="9" rx="2"></rect>
          <text class="cyl-t" x="340" y="160" text-anchor="middle">${pct != null ? `${pct}%` : "–"}</text>
        </g>
        <!-- Korpus mit Bedienleiste -->
        <rect fill="url(#body)" x="100" y="110" width="200" height="74" rx="6"></rect>
        <rect class="panel" x="104" y="112" width="192" height="24" rx="4"></rect>
        <line class="door" x1="200" y1="140" x2="200" y2="180"></line>
        <rect class="handle" x="150" y="146" width="36" height="3" rx="1.5"></rect>
        <rect class="handle" x="214" y="146" width="36" height="3" rx="1.5"></rect>
        <!-- Garraum-Licht unter dem Deckel -->
        ${chamberLight ? svg`<ellipse class="lamp" cx="200" cy="109" rx="112" ry="16" fill="url(#lamp)"></ellipse>` : nothing}
        <!-- Deckel -->
        <g class="hood-g" @click=${() => has("chamber_light") && this._toggle("chamber_light")}>
          <path fill="url(#hood)" d="M104 108 L104 62 Q104 40 128 40 L272 40 Q296 40 296 62 L296 108 Z"></path>
          <rect class="hood-handle" x="138" y="100" width="124" height="5" rx="2.5"></rect>
          <g transform="translate(200 62)">
            <circle class="thermo" r="11"></circle>
            <line class="needle" x1="0" y1="0" x2=${(8 * Math.cos(rad)).toFixed(1)} y2=${(8 * Math.sin(rad)).toFixed(1)}></line>
          </g>
          ${chamberLight ? svg`<rect class="seam" x="106" y="106" width="188" height="3" rx="1.5"></rect>` : nothing}
        </g>
        <!-- Hitzeflimmern über dem heißen Grill -->
        ${hot ? svg`<g class="heat">${[160, 200, 240].map((x, i) => svg`<path style="animation-delay:${i * 0.6}s" d="M${x} 36 q-6 -6 0 -12 q6 -6 0 -12 q-6 -6 0 -12"></path>`)}</g>` : nothing}
        <!-- Logo -->
        <g class="logo ${logo ? "on" : ""}" @click=${() => has("logo_light") && this._toggle("logo_light")}>
          <rect x="150" y="82" width="100" height="11" rx="2"></rect>
          <text x="200" y="90.5" text-anchor="middle">INDEPENDENCE</text>
        </g>
        <!-- Drehregler -->
        <g class="knobs" @click=${() => has("knob_light") && this._toggle("knob_light")}>
          ${KNOB_X.map((x, i) => svg`<g class="knob ${knobs[i] ? "lit" : ""}" style="--kc:${knobs[i] || "transparent"};animation-delay:${i * 0.3}s" transform="translate(${x} 124)">
            <circle class="k-glow" r="10"></circle><circle class="k-cap" r="7"></circle><line class="k-mark" x1="0" y1="-6" x2="0" y2="-2"></line></g>`)}
        </g>
      </svg>
      <div class="scene-hint">${this._t("tap_hint")}</div>
    </div>`;
  }

  /* ---------------- Bereiche ---------------- */

  private _modes() {
    const modeSt = this._st("grill_mode");
    const mode = modeSt?.state;
    const targetKey = mode ? MODE_TARGET[mode] : undefined;
    const target = targetKey ? this._num(targetKey) : undefined;
    const targetId = targetKey ? this._r().e[targetKey] : undefined;
    return html`<section class="sec">
      <div class="sec-h"><ha-icon icon="mdi:grill"></ha-icon><span>${this._t("mode")}</span></div>
      <div class="modes">
        ${MODES.filter((m) => !modeSt || (modeSt.attributes.options ?? MODES).includes(m)).map((m) => html`<button class="mode ${m === mode ? "on" : ""}" data-mode=${m}
          ?disabled=${!modeSt} @click=${() => m !== mode && this._select(modeSt?.entity_id, m)}>
          <ha-icon .icon=${MODE_ICON[m]}></ha-icon><span>${this._label(modeSt, m, `gas_grill.mode_${m}`)}</span></button>`)}
      </div>
      ${targetId ? html`<div class="target">
        <button class="pm" data-act="target-down" @click=${() => this._step(targetId, -5)}><ha-icon icon="mdi:minus"></ha-icon></button>
        <div class="t-val" style="--tc:${heatColor(target)}"><span class="t-big">${target != null ? this._fmt(target) : "–"}<sup>°C</sup></span>
          <span class="t-sub">${this._t("target_temp")}</span></div>
        <button class="pm" data-act="target-up" @click=${() => this._step(targetId, 5)}><ha-icon icon="mdi:plus"></ha-icon></button>
      </div>${this._preheat(target)}` : mode && !UNAVAILABLE.includes(mode) ? html`<div class="hint">${this._t("manual_hint")}</div>` : nothing}
    </section>`;
  }

  /** Aufheizen: Garraum gegen Ziel mit Prognose */
  private _preheat(target?: number) {
    const chamber = this._num("chamber_temperature");
    if (chamber == null || target == null || target <= 0 || chamber < 40) return nothing;
    const ready = this._st("preheated")?.state === "on" || chamber >= target - 5;
    const pct = Math.max(0, Math.min(100, Math.round((chamber / target) * 100)));
    const eta = this._at(this._r().e.preheat_eta);
    return html`<div class="preheat ${ready ? "ready" : ""}" data-preheat>
      <span class="ph-bar"><i style="width:${pct}%"></i></span>
      <span class="ph-text"><ha-icon .icon=${ready ? "mdi:check-circle" : "mdi:fire"}></ha-icon>
        ${ready ? this._t("preheated") : html`${this._t("chamber")} <b>${this._fmt(chamber)} °C</b>${eta ? html` · ${this._t("preheated_at")} <b>${this._time(eta)}</b>` : nothing}`}</span>
    </div>`;
  }

  private _probe(p: GasGrillProbe) {
    const s = this.hass!.states;
    const temp = this._numOf(p.temp ? s[p.temp] : undefined);
    const target = this._numOf(p.target ? s[p.target] : undefined);
    const plugged = temp != null && temp > 0;
    const pct = plugged ? probeProgress(temp, target) : undefined;
    const done = p.done && s[p.done] && !UNAVAILABLE.includes(s[p.done]!.state) ? s[p.done]!.state === "on" : plugged && target != null && target > 0 && temp! >= target;
    const eta = plugged && !done ? this._at(p.eta) : undefined;
    const color = done ? "#e53935" : plugged ? "#fb8c00" : "#9e9e9e";
    const presetSt = p.preset ? s[p.preset] : undefined;
    const r = 30, c = 2 * Math.PI * r;
    return html`<div class="probe ${plugged ? "plugged" : ""} ${done ? "done" : ""}" style="--pc:${color}" data-probe=${p.index}>
      <button class="p-ring" @click=${() => this._moreInfo(p.temp)}>
        <svg viewBox="0 0 72 72" aria-hidden="true"><circle class="track" cx="36" cy="36" r=${r}></circle>
          <circle class="val" cx="36" cy="36" r=${r} stroke-dasharray=${`${((pct ?? 0) / 100) * c} ${c}`}></circle></svg>
        <span class="p-in"><b>${plugged ? `${this._fmt(temp!)}°` : "–"}</b><small>F${p.index}</small></span>
      </button>
      <div class="p-side">
        <span class="p-state">${done ? this._t("probe_done") : plugged ? this._t("probe_cooking") : this._t("probe_unplugged")}
          ${eta ? html`<span class="p-eta" data-eta>· ${this._t("ready_at")} ${this._time(eta)} (${this._dur((eta - Date.now()) / 60000)})</span>` : nothing}</span>
        ${p.target ? html`<span class="p-tgt">
          <button class="mini" data-act="probe-down" @click=${() => this._step(p.target, -1)}><ha-icon icon="mdi:minus"></ha-icon></button>
          <span>${this._t("target")} <b>${target != null ? `${this._fmt(target)}°` : "–"}</b></span>
          <button class="mini" data-act="probe-up" @click=${() => this._step(p.target, 1)}><ha-icon icon="mdi:plus"></ha-icon></button></span>` : nothing}
        ${presetSt ? html`<select class="preset" @change=${(e: Event) => this._select(p.preset, (e.target as HTMLSelectElement).value)}>
          <option value="" ?selected=${UNAVAILABLE.includes(presetSt.state)}>${this._t("preset_pick")}</option>
          ${(presetSt.attributes.options as string[] ?? []).map((o) => html`<option value=${o} ?selected=${o === presetSt.state}>${this._label(presetSt, o, `gas_grill.preset_${o}`)}</option>`)}
        </select>` : nothing}
      </div>
    </div>`;
  }

  private _probes() {
    const probes = this._r().probes;
    if (!probes.length) return nothing;
    const active = probes.filter((p) => (this._numOf(p.temp ? this.hass!.states[p.temp] : undefined) ?? 0) > 0).length;
    return html`<section class="sec">
      <div class="sec-h"><ha-icon icon="mdi:thermometer-probe"></ha-icon><span>${this._t("probes")}</span>
        <small>${active ? `${active} ${this._t(active === 1 ? "probe_active" : "probes_active")}` : this._t("no_probe")}</small></div>
      <div class="probes">${probes.map((p) => this._probe(p))}</div>
    </section>`;
  }

  private _timer() {
    const stSt = this._st("timer_state");
    if (!stSt && !this._r().e.timer_duration) return nothing;
    const status = stSt?.state ?? "idle";
    const left = this._num("timer_remaining") ?? 0;
    const durId = this._r().e.timer_duration;
    const dur = this._num("timer_duration") ?? left;
    const running = status === "running", paused = status === "paused";
    const shown = running || paused ? left : dur;
    const h = Math.floor(shown / 60), m = shown % 60;
    return html`<section class="sec timer ${status}">
      <div class="sec-h"><ha-icon icon="mdi:timer-outline"></ha-icon><span>${this._t("timer")}</span>
        <small class="badge">${this._label(stSt, status, `gas_grill.timer_${status}`)}</small></div>
      <div class="t-row">
        ${!running && !paused && durId ? html`<button class="pm" data-act="timer-down" @click=${() => this._step(durId, -1)}><ha-icon icon="mdi:minus"></ha-icon></button>` : nothing}
        <span class="clock">${h ? html`${h}<small>h</small> ` : nothing}${String(m).padStart(h ? 2 : 1, "0")}<small>min</small></span>
        ${!running && !paused && durId ? html`<button class="pm" data-act="timer-up" @click=${() => this._step(durId, 1)}><ha-icon icon="mdi:plus"></ha-icon></button>` : nothing}
      </div>
      ${!running && !paused && durId ? html`<div class="quick">${TIMER_QUICK.map((q) => html`<button class="chip ${q === dur ? "on" : ""}" @click=${() => this._step(durId, 0, q)}>${q} min</button>`)}</div>` : nothing}
      <div class="t-btns">
        ${!running && this._r().e.timer_start ? html`<button class="act go" data-act="timer-start" ?disabled=${!paused && !(dur > 0)} @click=${() => this._press("timer_start")}>
          <ha-icon icon="mdi:play"></ha-icon>${paused ? this._t("resume") : this._t("start")}</button>` : nothing}
        ${running && this._r().e.timer_pause ? html`<button class="act pause" data-act="timer-pause" @click=${() => this._press("timer_pause")}><ha-icon icon="mdi:pause"></ha-icon>${this._t("pause")}</button>` : nothing}
        ${(running || paused) && this._r().e.timer_stop ? html`<button class="act stop" data-act="timer-stop" @click=${() => this._press("timer_stop")}><ha-icon icon="mdi:stop"></ha-icon>${this._t("stop")}</button>` : nothing}
      </div>
    </section>`;
  }

  private _lights() {
    const e = this._r().e;
    const modeSt = this._st("knob_light_mode");
    const knobMode = modeSt?.state;
    const colorSt = this._st("knob_color");
    const tile = (key: string, icon: string, label: string) => e[key] ? html`<button class="tile ${this._on(key) ? "on" : ""}" data-switch=${key} @click=${() => this._toggle(key)}>
      <ha-icon .icon=${icon}></ha-icon><span>${label}</span></button>` : nothing;
    return html`<section class="sec">
      <div class="sec-h"><ha-icon icon="mdi:lightbulb-group-outline"></ha-icon><span>${this._t("lights")}</span></div>
      <div class="tiles">
        ${tile("chamber_light", "mdi:lightbulb", this._t("chamber_light"))}
        ${tile("logo_light", "mdi:lightbulb-on-outline", this._t("logo_light"))}
        ${tile("sound", this._on("sound") ? "mdi:volume-high" : "mdi:volume-off", this._t("sound"))}
      </div>
      ${modeSt ? html`<div class="knob-modes">${KNOB_MODES.filter((k) => (modeSt.attributes.options ?? KNOB_MODES).includes(k)).map((k) => html`<button class="chip ${k === knobMode ? "on" : ""}"
        data-knob=${k} @click=${() => k !== knobMode && this._select(modeSt.entity_id, k)}><ha-icon .icon=${KNOB_MODE_ICON[k]}></ha-icon>${this._label(modeSt, k, `gas_grill.knob_${k}`)}</button>`)}</div>` : nothing}
      ${colorSt && (!modeSt || knobMode === "individual") ? html`<div class="swatches">${(colorSt.attributes.options as string[] ?? Object.keys(GRILL_KNOB_COLORS)).map((o) => html`<button
        class="sw ${o === colorSt.state ? "on" : ""}" data-color=${o} style="--sw:${GRILL_KNOB_COLORS[o] ?? "#888"}" title=${this._label(colorSt, o, `gas_grill.color_${o}`)}
        @click=${() => o !== colorSt.state && this._select(colorSt.entity_id, o)}></button>`)}</div>` : nothing}
    </section>`;
  }

  private _gas() {
    const e = this._r().e;
    if (!e.gas_remaining) return nothing;
    const kg = this._num("gas_remaining");
    const size = this._num("cylinder_size");
    const pct = gasPercent(kg, size, this._num("gas_level"));
    const warn = this._config?.gas_warning ?? 20;
    const low = pct != null && pct <= warn;
    const color = pct == null ? "#9e9e9e" : low ? "#e53935" : pct <= 40 ? "#fb8c00" : "#43a047";
    const row = (key: string, label: string, step: number) => e[key] ? html`<div class="g-set">
      <span>${label}</span>
      <button class="mini" @click=${() => this._step(e[key], -step)}><ha-icon icon="mdi:minus"></ha-icon></button>
      <b>${this._num(key) != null ? `${this._fmt(this._num(key)!, 1)} kg` : "–"}</b>
      <button class="mini" @click=${() => this._step(e[key], step)}><ha-icon icon="mdi:plus"></ha-icon></button></div>` : nothing;
    return html`<section class="sec gas ${low ? "low" : ""}" style="--gc:${color}">
      <div class="sec-h"><ha-icon icon="mdi:gas-cylinder"></ha-icon><span>${this._t("gas")}</span>
        <button class="more" aria-expanded=${this._gasOpen} @click=${() => { this._gasOpen = !this._gasOpen; }}><ha-icon icon="mdi:cog-outline"></ha-icon></button></div>
      ${low ? html`<div class="banner"><ha-icon icon="mdi:alert"></ha-icon><div>${this._t("gas_low")}</div></div>` : nothing}
      <button class="g-main" @click=${() => this._moreInfo(e.gas_remaining)}>
        <span class="g-kg">${kg != null ? this._fmt(kg, 1) : "–"}<small>kg</small></span>
        <span class="g-bar"><i style="width:${pct ?? 0}%"></i></span>
        <span class="g-pct">${pct != null ? `${pct} %` : "–"}${size != null ? html` <small>${this._t("of")} ${this._fmt(size, 1)} kg</small>` : nothing}</span>
      </button>
      ${this._gasStats(kg)}
      ${this._gasOpen ? html`<div class="g-settings">
        ${row("cylinder_tare", this._t("tare"), 0.1)}
        ${row("cylinder_size", this._t("cylinder_size"), 0.5)}
        ${this._num("scale_weight") != null ? html`<div class="g-set"><span>${this._t("scale")}</span><b>${this._fmt(this._num("scale_weight")!, 1)} kg</b></div>` : nothing}
      </div>` : nothing}
    </section>`;
  }

  private _gasStats(kg?: number) {
    const runtime = this._num("gas_runtime"), rate = this._num("gas_rate"), used = this._num("gas_consumed");
    if (runtime == null && rate == null && used == null) return nothing;
    return html`<div class="g-stats">
      ${runtime != null ? html`<span class="chip" data-runtime><ha-icon icon="mdi:timer-sand"></ha-icon>${this._t("runtime_left")} ${this._dur(runtime * 60)}</span>` : kg != null ? html`<span class="chip muted"><ha-icon icon="mdi:timer-sand"></ha-icon>${this._t("runtime_learning")}</span>` : nothing}
      ${rate != null ? html`<span class="chip"><ha-icon icon="mdi:speedometer"></ha-icon>${this._fmt(rate, 2)} kg/h</span>` : nothing}
      ${used != null ? html`<span class="chip"><ha-icon icon="mdi:sigma"></ha-icon>${this._fmt(used, 1)} kg ${this._t("used_total")}</span>` : nothing}
    </div>`;
  }

  /** Grillsession + Temperaturverlauf */
  private _session() {
    const grilling = this._on("grilling");
    const dur = this._num("session_duration"), gas = this._num("session_gas"), max = this._num("session_max_temp");
    const startSt = this._st("session_start");
    const start = startSt && !UNAVAILABLE.includes(startSt.state) ? Date.parse(startSt.state) : NaN;
    const chart = this._config?.show_graph === false ? nothing : this._chart();
    if (!Number.isFinite(start) && chart === nothing) return nothing;
    const lang = getLanguage(this.hass);
    const when = Number.isFinite(start) ? new Date(start).toLocaleString(lang, { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
    return html`<section class="sec session ${grilling ? "live" : ""}">
      <div class="sec-h"><ha-icon icon="mdi:chart-bell-curve-cumulative"></ha-icon><span>${grilling ? this._t("session_live") : this._t("session_last")}</span>
        ${when ? html`<small>${grilling ? `${this._t("since")} ${this._time(start)}` : when}</small>` : nothing}</div>
      ${Number.isFinite(start) ? html`<div class="s-stats">
        ${dur != null ? html`<span><ha-icon icon="mdi:timer-outline"></ha-icon><b>${this._dur(dur)}</b></span>` : nothing}
        ${gas != null ? html`<span><ha-icon icon="mdi:gas-cylinder"></ha-icon><b>${this._fmt(gas, 1)} kg</b></span>` : nothing}
        ${max != null && max > 0 ? html`<span><ha-icon icon="mdi:thermometer-high"></ha-icon><b>${this._fmt(max)} °C</b></span>` : nothing}
      </div>` : nothing}
      ${chart}
    </section>`;
  }

  private _chart() {
    const r = this._r();
    const ids = this._graphIds();
    const lines = ids.map((id) => ({ id, pts: this._hist[id] ?? [] })).filter((l) => l.pts.length > 1);
    if (!lines.length) return nothing;
    const now = Date.now();
    const t0 = Math.min(...lines.map((l) => l.pts[0]!.t));
    const targets = r.probes.filter((p) => ids.includes(p.temp!)).map((p) => this._numOf(p.target ? this.hass!.states[p.target] : undefined)).filter((x): x is number => x != null && x > 0);
    const vs = lines.flatMap((l) => l.pts.map((q) => q.v)).concat(targets);
    const hi = Math.max(...vs) * 1.08 || 1;
    const x = (t: number) => ((t - t0) / Math.max(1, now - t0)) * 300;
    const y = (v: number) => 80 - (v / hi) * 76;
    const path = (pts: { t: number; v: number }[]) => pts.map((q, i) => `${i ? "L" : "M"}${x(q.t).toFixed(1)},${y(q.v).toFixed(1)}`).join(" ");
    const colorOf = (id: string) => id === r.e.chamber_temperature ? "#fb8c00" : PROBE_COLORS[(r.probes.find((p) => p.temp === id)?.index ?? 1) - 1]!;
    const labelOf = (id: string) => id === r.e.chamber_temperature ? this._t("chamber") : `F${r.probes.find((p) => p.temp === id)?.index ?? ""}`;
    return html`<svg class="chart" viewBox="0 0 300 82" preserveAspectRatio="none" aria-hidden="true">
      ${targets.map((tv) => svg`<line class="tgt" x1="0" x2="300" y1=${y(tv)} y2=${y(tv)}></line>`)}
      ${lines.map((l) => svg`<path class="ln" style="--lc:${colorOf(l.id)}" d=${path(l.pts)}></path>`)}
    </svg>
    <div class="legend">${lines.map((l) => html`<span><i style="background:${colorOf(l.id)}"></i>${labelOf(l.id)}</span>`)}
      ${targets.length ? html`<span><i class="tgt"></i>${this._t("target")}</span>` : nothing}</div>`;
  }

  /** Kompakte Kachel: Garraum, Fühler, Gas, Timer – Antippen klappt die volle Karte auf */
  private _compact() {
    const chamber = this._num("chamber_temperature");
    const r = this._r();
    const probes = r.probes.map((p) => ({ p, t: this._numOf(p.temp ? this.hass!.states[p.temp] : undefined), g: this._numOf(p.target ? this.hass!.states[p.target] : undefined) }))
      .filter((x) => (x.t ?? 0) > 0);
    const pct = gasPercent(this._num("gas_remaining"), this._num("cylinder_size"), this._num("gas_level"));
    const timer = this._st("timer_state")?.state === "running" ? this._num("timer_remaining") : undefined;
    return html`<button class="compact-row" data-compact @click=${() => { this._expanded = !this._expanded; }}>
      ${chamber != null ? html`<span class="cp big" style="--tc:${heatColor(chamber)}"><ha-icon icon="mdi:thermometer"></ha-icon>${this._fmt(chamber)}°</span>` : nothing}
      ${probes.map((x) => html`<span class="cp"><small>F${x.p.index}</small>${this._fmt(x.t!)}°${x.g ? html`<small>/${this._fmt(x.g)}°</small>` : nothing}</span>`)}
      ${timer != null ? html`<span class="cp"><ha-icon icon="mdi:timer-outline"></ha-icon>${timer} min</span>` : nothing}
      ${pct != null ? html`<span class="cp"><ha-icon icon="mdi:gas-cylinder"></ha-icon>${pct} %</span>` : nothing}
      <ha-icon class="chev" .icon=${this._expanded ? "mdi:chevron-up" : "mdi:chevron-down"}></ha-icon>
    </button>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const r = this._r();
    if (!Object.keys(r.e).length) {
      return html`<ha-card class="gas-grill"><div class="empty"><ha-icon icon="mdi:grill-outline"></ha-icon>${this._t("not_found")}</div></ha-card>`;
    }
    const chamber = this._num("chamber_temperature");
    const modeSt = this._st("grill_mode");
    const mode = modeSt?.state;
    const targetKey = mode ? MODE_TARGET[mode] : undefined;
    const target = targetKey ? this._num(targetKey) : undefined;
    const hot = chamber != null && chamber >= 60;
    const accent = hot ? heatColor(chamber) : "#fb8c00";
    const sub = [mode && !UNAVAILABLE.includes(mode) ? this._label(modeSt, mode, `gas_grill.mode_${mode}`) : "",
      chamber != null ? `${this._t("chamber")} ${this._fmt(chamber)} °C` : "", target != null ? `${this._t("target")} ${this._fmt(target)} °C` : ""].filter(Boolean).join(" · ");
    const sound = r.e.sound;
    const offline = this._st("connection")?.state === "off";
    const compact = c.layout === "compact";
    return html`<ha-card class="gas-grill anim-${c.animations ?? "full"} ${hot ? "hot" : ""} ${compact ? "compact-card" : ""}" style="--hcc-accent-c:${accent}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <span class="h-icon"><ha-icon .icon=${hot ? "mdi:grill" : "mdi:grill-outline"}></ha-icon></span>
        <span class="head-text"><span class="h-title">${c.title ?? this._t("title")}</span><span class="h-sub">${offline ? this._t("offline") : sub || this._t("ready")}</span></span>
        ${sound ? html`<button class="snd ${this._on("sound") ? "on" : ""}" data-act="sound" title=${this._t("sound")} @click=${() => this._toggle("sound")}>
          <ha-icon .icon=${this._on("sound") ? "mdi:volume-high" : "mdi:volume-off"}></ha-icon></button>` : nothing}
      </div>
      ${offline ? html`<div class="banner offline" data-offline><ha-icon icon="mdi:power-plug-off-outline"></ha-icon><div>${this._t("offline_hint")}</div></div>` : nothing}
      ${compact ? this._compact() : nothing}
      ${compact && !this._expanded ? nothing : html`
        ${c.show_scene === false ? nothing : this._scene()}
        ${c.show_modes === false ? nothing : this._modes()}
        ${c.show_probes === false ? nothing : this._probes()}
        ${c.show_session === false ? nothing : this._session()}
        ${c.show_timer === false ? nothing : this._timer()}
        ${c.show_gas === false ? nothing : this._gas()}
        ${c.show_lights === false ? nothing : this._lights()}`}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.gas-grill { gap: 12px; container-type: inline-size; }
    .empty { display: flex; align-items: center; gap: 8px; color: var(--secondary-text-color); }
    .header { display: flex; align-items: center; gap: 10px; }
    .h-icon { flex: none; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); }
    .h-icon ha-icon { --mdc-icon-size: 24px; }
    ha-card.hot .h-icon ha-icon { animation: flicker 1.8s ease-in-out infinite; }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .h-title { font-size: 17px; font-weight: 600; line-height: 1.2; }
    .h-sub { font-size: 12.5px; font-weight: 600; color: var(--accent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .snd { flex: none; width: 38px; height: 38px; border: none; border-radius: 50%; cursor: pointer; display: grid; place-items: center;
      color: var(--secondary-text-color); background: rgba(127,127,127,0.12); }
    .snd.on { color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); }

    /* Szene */
    .scene { position: relative; border-radius: 18px; padding: 6px 4px 2px; background: linear-gradient(180deg, rgba(127,127,127,0.06), rgba(127,127,127,0.12)); }
    .scene svg { display: block; width: 100%; height: auto; overflow: visible; }
    .scene-hint { text-align: center; font-size: 11px; color: var(--secondary-text-color); opacity: 0.8; margin-top: -2px; }
    .shadow { fill: rgba(0,0,0,0.18); }
    .shelf { fill: #4a4e55; } .cab { fill: #2d3034; } .panel { fill: #1d1f22; }
    .door { stroke: #1b1d20; stroke-width: 1.5; } .handle { fill: #8d939b; }
    .hood-g, .logo, .knobs, .cylinder { cursor: pointer; }
    .hood-handle { fill: #a7adb5; }
    .thermo { fill: #f5f5f5; stroke: #9aa0a6; stroke-width: 2; } .needle { stroke: #d32f2f; stroke-width: 1.8; stroke-linecap: round; }
    .logo rect { fill: #1c1e21; stroke: #6b7078; stroke-width: 0.6; transition: fill 0.4s, filter 0.4s; }
    .logo text { font-size: 6.4px; font-weight: 700; letter-spacing: 1.2px; fill: #7d838b; transition: fill 0.4s; }
    .logo.on rect { fill: #2a2016; filter: drop-shadow(0 0 4px #ffcc80); }
    .logo.on text { fill: #ffe0b2; }
    .lamp { animation: lamp-in 0.6s ease both; }
    @keyframes lamp-in { from { opacity: 0; } to { opacity: 1; } }
    .screen { fill: #0b1a24; stroke: #4a4e55; } .screen-t { font-size: 9px; font-weight: 700; fill: #4fc3f7; }
    .cyl-body { fill: #d7dadf; stroke: #8d939b; stroke-width: 1; } .cyl-neck { fill: #8d939b; }
    .cyl-t { font-size: 9px; font-weight: 800; fill: #fff; paint-order: stroke; stroke: rgba(0,0,0,0.45); stroke-width: 2px; }
    .knob .k-cap { fill: #c9cdd2; stroke: #5f646b; stroke-width: 1; } .knob .k-mark { stroke: #3b3f45; stroke-width: 1.6; stroke-linecap: round; }
    .knob .k-glow { fill: none; stroke: var(--kc); stroke-width: 3; opacity: 0; transition: opacity 0.4s, stroke 0.4s; }
    .knob.lit .k-glow { opacity: 1; filter: drop-shadow(0 0 3px var(--kc)); }
    .scene.knob-random .knob.lit .k-glow, .scene.knob-magic .knob.lit .k-glow { animation: hue 4s linear infinite; }
    .scene.knob-magic .knob.lit .k-glow { animation-duration: 2.2s; }
    @keyframes hue { to { filter: drop-shadow(0 0 3px var(--kc)) hue-rotate(360deg); } }
    .seam { fill: #ffe0a3; filter: drop-shadow(0 0 4px #ffb74d) drop-shadow(0 0 10px #ffb74d); }
    .heat path { fill: none; stroke: var(--accent); stroke-width: 2.2; stroke-linecap: round; opacity: 0; animation: rise 1.8s ease-in infinite; }
    @keyframes rise { 0% { opacity: 0; transform: translateY(6px); } 30% { opacity: 0.75; } 100% { opacity: 0; transform: translateY(-10px); } }

    /* Bereiche */
    .sec { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 16px; background: rgba(127,127,127,0.06); }
    .sec-h { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; }
    .sec-h ha-icon { --mdc-icon-size: 18px; color: var(--accent); }
    .sec-h span { flex: 1; }
    .sec-h small { font-size: 11.5px; font-weight: 600; color: var(--secondary-text-color); }
    .badge { padding: 2px 8px; border-radius: 999px; background: rgba(127,127,127,0.14); }
    .hint { font-size: 12.5px; color: var(--secondary-text-color); }
    .modes { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
    .mode { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 2px; border: none; border-radius: 12px; cursor: pointer;
      font-size: 11px; font-weight: 600; line-height: 1.15; text-align: center; color: var(--secondary-text-color); background: rgba(127,127,127,0.1);
      transition: background 0.3s, color 0.3s, transform 0.2s var(--ease-spring); }
    .mode ha-icon { --mdc-icon-size: 20px; }
    .mode.on { color: #fff; background: var(--accent); box-shadow: 0 4px 12px color-mix(in srgb, var(--accent) 40%, transparent); }
    .mode:active { transform: scale(0.94); }
    @container (max-width: 360px) { .mode span { font-size: 10px; } }
    .target { display: flex; align-items: center; justify-content: center; gap: 18px; }
    .t-val { display: flex; flex-direction: column; align-items: center; }
    .t-big { font-size: 40px; font-weight: 300; line-height: 1; color: var(--tc); transition: color 0.5s; }
    .t-big sup { font-size: 0.4em; vertical-align: top; position: relative; top: 0.3em; margin-left: 2px; }
    .t-sub { font-size: 11.5px; color: var(--secondary-text-color); }
    .pm { width: 40px; height: 40px; border: none; border-radius: 50%; cursor: pointer; display: grid; place-items: center; color: var(--primary-text-color);
      background: var(--card-background-color, #fff); box-shadow: 0 1px 4px rgba(0,0,0,0.18); transition: transform 0.2s var(--ease-spring); }
    .pm:active, .mini:active { transform: scale(0.9); }
    .mini { width: 26px; height: 26px; border: none; border-radius: 50%; cursor: pointer; display: grid; place-items: center; color: var(--primary-text-color);
      background: var(--card-background-color, #fff); box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
    .mini ha-icon { --mdc-icon-size: 15px; }
    .probes { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
    .probe { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 14px;
      background: linear-gradient(160deg, color-mix(in srgb, var(--pc) 12%, transparent), rgba(127,127,127,0.04) 70%); }
    .probe.done { animation: pulse 1.4s ease-in-out infinite; }
    @keyframes pulse { 50% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--pc) 35%, transparent); } }
    .p-ring { position: relative; flex: none; width: 66px; height: 66px; padding: 0; border: none; background: none; cursor: pointer; }
    .p-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .p-ring circle { fill: none; stroke-width: 6; stroke-linecap: round; }
    .p-ring .track { stroke: rgba(127,127,127,0.18); } .p-ring .val { stroke: var(--pc); transition: stroke-dasharray 0.8s var(--ease-out); }
    .p-in { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.05; }
    .p-in b { font-size: 16px; } .p-in small { font-size: 10.5px; font-weight: 700; color: var(--pc); }
    .p-side { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .p-state { font-size: 11.5px; font-weight: 700; color: var(--pc); }
    .probe:not(.plugged) .p-state { color: var(--secondary-text-color); }
    .p-tgt { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; }
    .preset { width: 100%; padding: 4px 6px; border: none; border-radius: 999px; font: inherit; font-size: 12px; font-weight: 600;
      color: var(--primary-text-color); background: rgba(127,127,127,0.12); cursor: pointer; }
    .preset option { color: #000; }
    .t-row { display: flex; align-items: center; justify-content: center; gap: 18px; }
    .clock { font-size: 36px; font-weight: 300; line-height: 1; }
    .clock small { font-size: 0.4em; margin-left: 2px; color: var(--secondary-text-color); }
    .timer.running .clock { color: var(--accent); }
    .quick, .knob-modes { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
    .chip { display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px; border: none; border-radius: 999px; cursor: pointer; font-size: 12px; font-weight: 600;
      color: var(--primary-text-color); background: rgba(127,127,127,0.12); transition: background 0.3s, color 0.3s; }
    .chip ha-icon { --mdc-icon-size: 15px; }
    .chip.on { color: #fff; background: var(--accent); }
    .t-btns { display: flex; justify-content: center; gap: 8px; }
    .act { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: none; border-radius: 999px; cursor: pointer; font-size: 13px; font-weight: 700; color: #fff; }
    .act ha-icon { --mdc-icon-size: 18px; }
    .act.go { background: #43a047; } .act.pause { background: #fb8c00; } .act.stop { background: #e53935; }
    .act:disabled { opacity: 0.45; cursor: default; }
    .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 6px; }
    .tile { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 4px; border: none; border-radius: 12px; cursor: pointer;
      font-size: 12px; font-weight: 600; color: var(--secondary-text-color); background: rgba(127,127,127,0.1); transition: background 0.3s, color 0.3s; }
    .tile ha-icon { --mdc-icon-size: 22px; }
    .tile.on { color: var(--primary-text-color); background: color-mix(in srgb, #ffb300 22%, transparent); }
    .tile.on ha-icon { color: #ffb300; filter: drop-shadow(0 0 4px #ffcc80); }
    .swatches { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
    .sw { width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; background: var(--sw);
      box-shadow: 0 0 0 1px rgba(127,127,127,0.3); transition: transform 0.2s var(--ease-spring); }
    .sw.on { border-color: var(--card-background-color, #fff); box-shadow: 0 0 0 2px var(--sw), 0 0 10px var(--sw); transform: scale(1.1); }
    .gas .banner { cursor: default; }
    .more { border: none; background: none; cursor: pointer; color: var(--secondary-text-color); padding: 2px; display: grid; place-items: center; }
    .more ha-icon { color: var(--secondary-text-color) !important; }
    .g-main { display: grid; grid-template-columns: auto 1fr; grid-template-areas: "kg bar" "kg pct"; column-gap: 12px; align-items: center;
      padding: 0; border: none; background: none; cursor: pointer; text-align: left; }
    .g-kg { grid-area: kg; font-size: 30px; font-weight: 300; line-height: 1; color: var(--gc); }
    .g-kg small { font-size: 0.45em; margin-left: 2px; color: var(--secondary-text-color); }
    .g-bar { grid-area: bar; height: 10px; border-radius: 5px; background: rgba(127,127,127,0.16); overflow: hidden; }
    .g-bar i { display: block; height: 100%; border-radius: 5px; background: linear-gradient(90deg, color-mix(in srgb, var(--gc) 70%, #fff), var(--gc)); transition: width 0.8s var(--ease-out); }
    .g-pct { grid-area: pct; font-size: 12.5px; font-weight: 700; }
    .g-pct small { font-weight: 500; color: var(--secondary-text-color); }
    .g-settings { display: flex; flex-direction: column; gap: 6px; padding-top: 4px; border-top: 1px solid rgba(127,127,127,0.15); }
    .g-set { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .g-set span { flex: 1; color: var(--secondary-text-color); }
    .g-set b { min-width: 56px; text-align: center; }
    .banner.offline { cursor: default; background: rgba(127,127,127,0.14); }
    .preheat { display: flex; flex-direction: column; gap: 5px; }
    .ph-bar { height: 8px; border-radius: 4px; background: rgba(127,127,127,0.16); overflow: hidden; }
    .ph-bar i { display: block; height: 100%; border-radius: 4px; background: linear-gradient(90deg, #ffb74d, var(--accent)); transition: width 0.8s var(--ease-out); }
    .preheat.ready .ph-bar i { background: #43a047; }
    .ph-text { display: flex; align-items: center; justify-content: center; gap: 5px; font-size: 12.5px; color: var(--secondary-text-color); }
    .ph-text ha-icon { --mdc-icon-size: 16px; color: var(--accent); }
    .preheat.ready .ph-text { color: #43a047; font-weight: 700; } .preheat.ready .ph-text ha-icon { color: #43a047; }
    .p-eta { font-weight: 600; color: var(--secondary-text-color); }
    .g-stats { display: flex; flex-wrap: wrap; gap: 6px; }
    .g-stats .chip { cursor: default; }
    .chip.muted { color: var(--secondary-text-color); font-weight: 500; }
    .s-stats { display: flex; flex-wrap: wrap; gap: 14px; font-size: 13px; }
    .s-stats span { display: inline-flex; align-items: center; gap: 4px; }
    .s-stats ha-icon { --mdc-icon-size: 16px; color: var(--accent); }
    .session.live .sec-h ha-icon { animation: flicker 1.8s ease-in-out infinite; }
    .chart { width: 100%; height: 82px; overflow: visible; }
    .chart .ln { fill: none; stroke: var(--lc); stroke-width: 2.2; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
    .chart .tgt { stroke: #43a047; stroke-width: 1.1; stroke-dasharray: 5 4; vector-effect: non-scaling-stroke; }
    .legend { display: flex; flex-wrap: wrap; gap: 10px; font-size: 11px; color: var(--secondary-text-color); }
    .legend span { display: inline-flex; align-items: center; gap: 4px; }
    .legend i { width: 12px; height: 3px; border-radius: 2px; } .legend i.tgt { background: #43a047; }
    .compact-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 0; border: none; background: none; cursor: pointer; text-align: left; }
    .cp { display: inline-flex; align-items: center; gap: 3px; padding: 5px 10px; border-radius: 999px; font-size: 13px; font-weight: 700; background: rgba(127,127,127,0.12); }
    .cp small { font-size: 10.5px; font-weight: 600; color: var(--secondary-text-color); }
    .cp ha-icon { --mdc-icon-size: 15px; color: var(--accent); }
    .cp.big { font-size: 16px; color: var(--tc); }
    .compact-row .chev { margin-left: auto; color: var(--secondary-text-color); }
    .banner.offline ha-icon { color: var(--secondary-text-color); }
    ha-card.anim-reduced *, ha-card.anim-off * { animation: none !important; }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-gas-grill-card": HaGasGrillCard;
  }
}
