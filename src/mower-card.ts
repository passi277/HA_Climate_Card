import { LitElement, css, html, nothing, svg, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant, MowerCardConfig, MowerFeatures } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { extendTrail, mapGeometry, mowerAreas, mowerFeatures, mowerPhase, UNAVAILABLE, wifiQuality, type MapPoint, type MowerArea, type MowerMap, type MowerPhase } from "./utils";
import "./mower-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-mower-card",
  name: "Modern Mower Card",
  description: "Mähroboter mit animiertem Rasen bzw. Live-Karte, Start/Pause/Station, aktuellem Lauf, Statistik, Messer-Verschleiß und Einstellungen – Zusatz-Entitäten werden über das Gerät erkannt (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

/** LawnMowerEntityFeature */
const START = 1;
const PAUSE = 2;
const DOCK = 4;

const PHASE_COLOR: Record<MowerPhase, string> = {
  mowing: "var(--success-color, #43a047)",
  paused: "#fb8c00",
  returning: "#1e88e5",
  docked: "#26a69a",
  error: "var(--error-color, #e53935)",
  unknown: "var(--state-inactive-color, #8a8a8a)",
};
const PHASE_ICON: Record<MowerPhase, string> = {
  mowing: "mdi:robot-mower", paused: "mdi:pause-circle", returning: "mdi:home-import-outline",
  docked: "mdi:home-lightning-bolt-outline", error: "mdi:alert-circle", unknown: "mdi:help-circle-outline",
};
const FEATURE_KEYS: (keyof MowerFeatures)[] = ["battery", "error", "progress", "area", "session_area", "duration", "total_area", "total_duration",
  "total_count", "blade", "brush", "wifi", "stop", "refresh", "efficiency", "obstacle", "rain_delay", "rain_sensor", "ai", "animal",
  "animal_start", "animal_end", "border", "safe", "update", "map"];
/** Live-Positions-Stream (z.B. Ecovacs GOAT): so lange anfordern, wie die Karte sichtbar ist und der Mäher fährt */
const STREAM_SERVICE = "request_live_position_stream";
const STREAM_SECONDS = 120;
const STREAM_RENEW_MS = 100_000;
/** Bereichsmähen (z.B. ECOVACS GOAT `goat_mower.mow_areas`, Ziel ist der lawn_mower) */
const AREA_SERVICE = "mow_areas";

const SWITCHES: (keyof MowerFeatures)[] = ["rain_sensor", "ai", "animal", "border", "safe"];
const SWITCH_ICON: Record<string, string> = {
  rain_sensor: "mdi:weather-rainy", ai: "mdi:eye-outline", animal: "mdi:paw", border: "mdi:vector-square", safe: "mdi:shield-check-outline",
};

@customElement("ha-mower-card")
export class HaMowerCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: MowerCardConfig;
  @state() private _settingsOpen = false;
  @state() private _confirm?: string;
  @state() private _pendingDelay?: number;
  private _confirmTimer?: number;
  private _sendTimer?: number;
  private _featCache?: { key: unknown; f: Record<string, string | undefined> };
  @state() private _streaming = false;
  /** Zum Bereichsmähen ausgewählte Bereichs-IDs */
  @state() private _selected: string[] = [];
  /** Selbst gesammelte Fahrspur des aktuellen Laufs (die Integration liefert oft nur die letzten Punkte) */
  private _trail: MapPoint[] = [];
  private _trailFrom?: unknown;
  private _visible = false;
  private _observer?: IntersectionObserver;
  private _streamAt = 0;
  private _streamTimer?: number;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-mower-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<MowerCardConfig> {
    return { entity: Object.keys(hass.states).find((id) => id.startsWith("lawn_mower.")) ?? "" };
  }

  public setConfig(config: MowerCardConfig): void {
    if (!config?.entity) throw new Error("ha-mower-card: 'entity' (lawn_mower.*) angeben");
    const first = !this._config;
    this._config = { ...config };
    if (first) this._settingsOpen = !!config.settings_open;
  }

  public getCardSize(): number {
    return 7;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (typeof IntersectionObserver !== "undefined") {
      this._observer = new IntersectionObserver((entries) => {
        this._visible = entries.some((e) => e.isIntersecting);
        this._syncStream();
      });
      this._observer.observe(this);
    } else {
      this._visible = true;
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._observer?.disconnect();
    this._observer = undefined;
    this._visible = false;
    this._stopStream();
    clearTimeout(this._confirmTimer);
    clearTimeout(this._sendTimer);
  }

  private _t(key: string): string {
    return localize(this.hass, `mower.${key}`);
  }

  /** Automatisch erkannte Zuordnungen, überschrieben durch die Konfiguration */
  private _f(): MowerFeatures {
    const hass = this.hass!;
    if (!this._featCache || this._featCache.key !== hass.entities) {
      this._featCache = { key: hass.entities, f: mowerFeatures(hass.states, hass.entities, this._config!.entity) };
    }
    const out: Record<string, string | undefined> = { ...this._featCache.f };
    for (const k of FEATURE_KEYS) if (typeof this._config![k] === "string") out[k] = this._config![k] as string;
    return out as MowerFeatures;
  }

  private _ids(): string[] {
    const f = this._f();
    return [this._config!.entity, ...FEATURE_KEYS.map((k) => f[k])].filter(Boolean) as string[];
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this._config) return true;
    return this._ids().some((id) => old.states[id] !== this.hass!.states[id]) || old.locale !== this.hass!.locale || old.entities !== this.hass!.entities;
  }

  protected updated(): void {
    this._syncStream();
    this._collectTrail();
  }

  private _collectTrail(): void {
    const c = this._config;
    const mapId = c && this._f().map;
    const st = c && this.hass?.states[c.entity];
    const mapSt = mapId ? this.hass!.states[mapId] : undefined;
    if (!st || !mapSt) return;
    if (st.state === "docked") { this._trail = []; return; }
    if (mapSt === this._trailFrom || !["mowing", "returning", "paused"].includes(st.state)) return;
    this._trailFrom = mapSt;
    const a = mapSt.attributes;
    const pts = [a.position_history, a.trace?.path].flatMap((l: unknown) => (Array.isArray(l) ? l : []))
      .concat(a.current_position ? [a.current_position] : [])
      .map((p: any) => (Array.isArray(p) ? { x: Number(p[0]), y: Number(p[1]) } : p && !p.invalid ? { x: Number(p.x), y: Number(p.y) } : undefined))
      .filter((p: MapPoint | undefined): p is MapPoint => !!p && Number.isFinite(p.x) && Number.isFinite(p.y));
    const next = extendTrail(this._trail, pts);
    if (next.length !== this._trail.length) { this._trail = next; this.requestUpdate(); }
  }

  /** Domain, die den Live-Stream anbietet (z.B. ecovacs_goat_g1) */
  private _streamDomain(): string | undefined {
    const services = this.hass?.services;
    if (!services) return undefined;
    return Object.keys(services).find((d) => services[d]?.[STREAM_SERVICE] != null);
  }

  /** Domain, die das Bereichsmähen anbietet (z.B. goat_mower) */
  private _areaDomain(): string | undefined {
    const services = this.hass?.services;
    if (!services || this._config?.show?.areas === false) return undefined;
    return Object.keys(services).find((d) => services[d]?.[AREA_SERVICE] != null);
  }

  private _wantStream(): boolean {
    const c = this._config;
    const st = c && this.hass?.states[c.entity];
    if (!c || !st || c.live_stream === false || c.show?.scene === false || !this._visible) return false;
    return (st.state === "mowing" || st.state === "returning") && !!this._streamDomain();
  }

  private _syncStream(): void {
    if (!this._wantStream()) { this._stopStream(); return; }
    if (Date.now() - this._streamAt >= STREAM_RENEW_MS) this._requestStream();
    if (!this._streamTimer) this._streamTimer = window.setInterval(() => this._syncStream(), 20_000);
  }

  private async _requestStream(): Promise<void> {
    const domain = this._streamDomain();
    if (!domain) return;
    this._streamAt = Date.now();
    this._streaming = true;
    try {
      await this.hass!.callService(domain, STREAM_SERVICE, { entity_id: this._config!.entity, duration_seconds: STREAM_SECONDS, reason: "ha-mower-card visible" });
    } catch {
      // Ohne Stream bleibt die Karte bei den normalen Aktualisierungen – kein Fehler-Hinweis nötig
      this._streaming = false;
    }
  }

  private _stopStream(): void {
    clearInterval(this._streamTimer);
    this._streamTimer = undefined;
    this._streamAt = 0;
    if (this._streaming) this._streaming = false;
  }

  // ---------- Werte ----------

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

  private _fmt(v: number, digits = 1): string {
    return v.toLocaleString(getLanguage(this.hass), { maximumFractionDigits: digits });
  }

  private _area(id?: string): string | undefined {
    const v = this._num(id);
    if (v == null) return undefined;
    const unit = String(this._st(id)!.attributes.unit_of_measurement ?? "m²");
    if (unit === "m²" && v >= 10000) return `${this._fmt(v / 10000, 2)} ha`;
    return `${this._fmt(v, v < 10 ? 2 : v < 100 ? 1 : 0)} ${unit}`;
  }

  /** Dauer aus Minuten oder Stunden (Einheit des Sensors) */
  private _duration(id?: string): string | undefined {
    const v = this._num(id);
    if (v == null) return undefined;
    const unit = String(this._st(id)!.attributes.unit_of_measurement ?? "min").toLowerCase();
    const mins = unit === "h" ? v * 60 : unit === "s" ? v / 60 : v;
    if (mins >= 600) return `${this._fmt(mins / 60, 0)} h`;
    if (mins >= 60) return `${Math.floor(mins / 60)} h ${Math.round(mins % 60)} min`;
    return `${Math.round(mins)} min`;
  }

  private _timeOf(id?: string): string | undefined {
    const st = this._st(id);
    return st ? st.state.slice(0, 5) : undefined;
  }

  private _option(kind: "efficiency" | "obstacle", o: string): string {
    const key = `opt_${o.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
    const t = this._t(key);
    return t === `mower.${key}` ? o : t;
  }

  // ---------- Aktionen ----------

  private _haptic(type = "light"): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: type }));
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

  private _moreInfo(id?: string): void {
    if (!id) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  private _confirmed(key: string): boolean {
    if (this._confirm === key) { this._confirm = undefined; clearTimeout(this._confirmTimer); return true; }
    this._haptic("warning");
    this._confirm = key;
    clearTimeout(this._confirmTimer);
    this._confirmTimer = window.setTimeout(() => (this._confirm = undefined), 4000);
    return false;
  }

  private _mower(service: "start_mowing" | "pause" | "dock"): void {
    this._haptic("medium");
    this._call("lawn_mower", service, { entity_id: this._config!.entity });
  }

  private _press(id?: string, confirmKey?: string): void {
    if (!id || (confirmKey && !this._confirmed(confirmKey))) return;
    this._haptic("medium");
    this._call("button", "press", { entity_id: id });
  }

  private _toggle(id?: string): void {
    if (!id) return;
    this._haptic("selection");
    this._call("homeassistant", "toggle", { entity_id: id });
  }

  private _select(id: string, option: string): void {
    this._haptic("selection");
    this._call(id.split(".")[0]!, "select_option", { entity_id: id, option });
  }

  private _toggleArea(id: string): void {
    this._haptic("selection");
    this._confirm = undefined;
    this._selected = this._selected.includes(id) ? this._selected.filter((x) => x !== id) : [...this._selected, id];
  }

  private async _mowAreas(areas: MowerArea[]): Promise<void> {
    const domain = this._areaDomain();
    const ids = areas.map((a) => a.id);
    if (!domain || !ids.length || !this._confirmed("areas")) return;
    this._haptic("medium");
    await this._call(domain, AREA_SERVICE, { entity_id: this._config!.entity, area_ids: ids });
    this._selected = [];
  }

  /** Regenverzögerung: −/+ kurz gesammelt senden */
  private _setDelay(value: number): void {
    const st = this._st(this._f().rain_delay);
    if (!st) return;
    const a = st.attributes;
    const v = Math.min(Number(a.max ?? 1440), Math.max(Number(a.min ?? 0), value));
    this._haptic("selection");
    this._pendingDelay = v;
    clearTimeout(this._sendTimer);
    this._sendTimer = window.setTimeout(() => this._call(st.entity_id.split(".")[0]!, "set_value", { entity_id: st.entity_id, value: v })
      .finally(() => { if (this._pendingDelay === v) this._pendingDelay = undefined; }), 700);
  }

  // ---------- Darstellung ----------

  private _renderMap(map: MowerMap, phase: MowerPhase, job: string[]) {
    // Szene ist ca. 2,6:1 und 150 px hoch – Marker in Bildschirm-Pixeln bemessen und genug Rand lassen
    const unitsPerPx = Math.max(map.box.w / 2.6, map.box.h) / 150;
    const r = unitsPerPx * 6;
    const m = r * 4;
    const box = { x: map.box.x - m, y: map.box.y - m, w: map.box.w + 2 * m, h: map.box.h + 2 * m };
    const P = (p: { x: number; y: number }) => `${(p.x - box.x).toFixed(2)},${(box.h - (p.y - box.y)).toFixed(2)}`;
    return html`<svg class="map" viewBox="0 0 ${box.w} ${box.h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label=${this._t("map")}>
      ${map.outline.map((l) => svg`<polygon class="m-area" points=${l.map(P).join(" ")}></polygon>`)}
      ${this._areaDomain() ? map.areas.map((a) => svg`<polygon class="m-zone ${this._selected.includes(a.id) ? "sel" : ""} ${job.includes(a.id) ? "job" : ""}"
        data-area=${a.id} points=${a.points.map(P).join(" ")} @click=${() => this._toggleArea(a.id)}><title>${a.name}${a.m2 ? ` · ${this._fmt(a.m2, 0)}\u00a0m²` : ""}</title></polygon>`) : nothing}
      ${map.path.length > 1 ? svg`<polyline class="m-path" style="stroke-width:${r * 0.55}" points=${map.path.map(P).join(" ")}></polyline>` : nothing}
      ${map.dock ? svg`<circle class="m-dock" cx=${P(map.dock).split(",")[0]} cy=${P(map.dock).split(",")[1]} r=${r}></circle>` : nothing}
      ${map.position ? svg`<g class="m-pos ${phase}" transform="translate(${P(map.position)})">
        <circle class="m-pulse" r=${r * 2.2}></circle>
        <circle class="m-dot" r=${r * 1.5}></circle>
        ${map.position.a != null ? svg`<path class="m-arrow" transform="rotate(${(-map.position.a).toFixed(1)}) scale(${r * 0.85})" d="M1.4,0 L-0.9,-1 L-0.4,0 L-0.9,1 Z"></path>` : nothing}
      </g>` : nothing}
    </svg>`;
  }

  private _renderScene(phase: MowerPhase, charging: boolean) {
    const f = this._f();
    const map = mapGeometry(this.hass!.states[f.map ?? ""]?.attributes, this._trail);
    const job = (this.hass!.states[this._config!.entity]?.attributes.job_area_ids as string[] | undefined)?.map(String) ?? [];
    return html`<div class="scene p-${phase}">
      ${this._streaming ? html`<span class="live" title=${this._t("live_hint")}><span class="live-dot"></span>${this._t("live")}</span>` : nothing}
      ${map ? this._renderMap(map, phase, job) : html`
        <div class="lawn"><div class="cut"></div><div class="blades"></div></div>
        <div class="station ${charging ? "charging" : ""}"><ha-icon icon="mdi:home-variant"></ha-icon>${charging ? html`<ha-icon class="bolt" icon="mdi:lightning-bolt"></ha-icon>` : nothing}</div>
        <div class="bot"><span class="bot-in"><ha-icon icon="mdi:robot-mower"></ha-icon></span></div>`}
    </div>`;
  }

  private _renderControls(phase: MowerPhase, st: HassEntity) {
    const f = this._f();
    const feat = Number(st.attributes.supported_features ?? 7);
    const busy = phase === "mowing" || phase === "returning";
    const btn = (key: string, icon: string, label: string, enabled: boolean, onClick: () => void, cls = "") =>
      html`<button class="ctl ${cls}" ?disabled=${!enabled} @click=${onClick} aria-label=${label}><ha-icon .icon=${icon}></ha-icon><span>${label}</span></button>`;
    return html`<div class="controls">
      ${feat & START ? btn("start", "mdi:play", this._t(phase === "paused" ? "resume" : "start"), phase !== "mowing", () => this._mower("start_mowing"), "start") : nothing}
      ${feat & PAUSE ? btn("pause", "mdi:pause", this._t("pause"), busy, () => this._mower("pause")) : nothing}
      ${feat & DOCK ? btn("dock", "mdi:home-import-outline", this._t("dock"), phase !== "docked" && phase !== "returning", () => this._mower("dock")) : nothing}
      ${f.stop ? btn("stop", "mdi:stop", this._confirm === "stop" ? this._t("confirm") : this._t("stop"), phase === "mowing" || phase === "paused" || phase === "returning",
        () => this._press(f.stop, "stop"), `stop ${this._confirm === "stop" ? "ask" : ""}`) : nothing}
    </div>`;
  }

  /** Bereiche zum Antippen (auch als Liste, damit kleine Flächen erreichbar sind) und „Ausgewählte mähen“ */
  private _renderAreas(phase: MowerPhase) {
    const f = this._f();
    if (!this._areaDomain()) return nothing;
    const areas = mowerAreas(this.hass!.states[f.map ?? ""]?.attributes).sort((a, b) => a.name.localeCompare(b.name, getLanguage(this.hass)));
    if (!areas.length) return nothing;
    // Reihenfolge des Antippens
    const chosen = this._selected.map((id) => areas.find((a) => a.id === id)).filter((a): a is MowerArea => !!a);
    const total = chosen.reduce((sum, a) => sum + (a.m2 ?? 0), 0);
    const ready = phase === "docked" || phase === "paused";
    const asking = this._confirm === "areas";
    const label = asking ? this._t("areas_confirm") : this._t(chosen.length > 1 ? "areas_start_many" : "areas_start");
    return html`<div class="areas">
      <div class="a-head">
        <span class="sec-title"><ha-icon icon="mdi:texture-box"></ha-icon><span>${this._t("areas")}</span></span>
        ${chosen.length ? html`<span class="a-sum">${chosen.length} ${this._t("areas_selected")}${total ? ` · ${this._fmt(total, 0)}\u00a0m²` : ""}</span>
          <button class="a-clear" @click=${() => { this._selected = []; this._confirm = undefined; }}>${this._t("areas_clear")}</button>` : html`<span class="a-sum">${this._t("areas_hint")}</span>`}
      </div>
      <div class="a-chips" role="group" aria-label=${this._t("areas")}>${areas.map((a) => {
        const sel = this._selected.includes(a.id);
        return html`<button class="a-chip ${sel ? "sel" : ""}" aria-pressed=${sel} data-area=${a.id} @click=${() => this._toggleArea(a.id)}>
          <ha-icon .icon=${sel ? "mdi:check-circle" : "mdi:checkbox-blank-circle-outline"}></ha-icon><span>${a.name}</span>${a.m2 ? html`<small>${this._fmt(a.m2, 0)}\u00a0m²</small>` : nothing}</button>`;
      })}</div>
      ${chosen.length ? html`<button class="a-start ${asking ? "ask" : ""}" ?disabled=${!ready} @click=${() => this._mowAreas(chosen)}>
          <ha-icon icon=${asking ? "mdi:alert" : "mdi:play"}></ha-icon><span>${label}</span></button>
        ${!ready ? html`<small class="a-note">${this._t("areas_not_ready")}</small>` : chosen.length > 1 ? html`<small class="a-note">${this._t("areas_multi_hint")}</small>` : nothing}` : nothing}
    </div>`;
  }

  private _renderSession(phase: MowerPhase) {
    const f = this._f();
    if (!["mowing", "paused", "returning"].includes(phase)) return nothing;
    const progress = this._num(f.progress);
    const area = this._area(f.area);
    const target = this._area(f.session_area);
    const dur = this._duration(f.duration);
    if (progress == null && !area && !dur) return nothing;
    return html`<div class="session">
      <div class="s-head"><span>${this._t("current_run")}</span>${progress != null ? html`<b>${Math.round(progress)} %</b>` : nothing}</div>
      ${progress != null ? html`<div class="bar"><span style="width:${Math.min(100, Math.max(0, progress))}%"></span></div>` : nothing}
      <div class="s-stats">
        ${area ? html`<span><ha-icon icon="mdi:texture-box"></ha-icon>${area}${target && target !== area ? html` <small>${this._t("of")} ${target}</small>` : nothing}</span>` : nothing}
        ${dur ? html`<span><ha-icon icon="mdi:timer-outline"></ha-icon>${dur}</span>` : nothing}
      </div>
    </div>`;
  }

  private _renderStats() {
    const f = this._f();
    const items = [
      { id: f.total_area, icon: "mdi:texture-box", v: this._area(f.total_area), l: this._t("total_area") },
      { id: f.total_duration, icon: "mdi:timer-sand", v: this._duration(f.total_duration), l: this._t("total_time") },
      { id: f.total_count, icon: "mdi:counter", v: this._num(f.total_count) != null ? this._fmt(this._num(f.total_count)!, 0) : undefined, l: this._t("total_count") },
    ].filter((x) => x.v);
    if (!items.length) return nothing;
    return html`<div class="stats" style="--n:${items.length}">${items.map((x) => html`<button class="stat" @click=${() => this._moreInfo(x.id)}>
      <ha-icon .icon=${x.icon}></ha-icon><b>${x.v}</b><small>${x.l}</small></button>`)}</div>`;
  }

  private _renderMaintenance() {
    const f = this._f();
    const parts = [
      { key: "blade", id: f.blade, icon: "mdi:saw-blade", v: this._num(f.blade) },
      { key: "brush", id: f.brush, icon: "mdi:brush-outline", v: this._num(f.brush) },
    ].filter((x) => x.v != null);
    const update = this._st(f.update)?.state === "on";
    if (!parts.length && !update) return nothing;
    return html`<div class="maint">
      <div class="sec-title"><ha-icon icon="mdi:wrench-outline"></ha-icon><span>${this._t("maintenance")}</span></div>
      ${parts.map((x) => {
        const level = x.v! < 5 ? "bad" : x.v! < 10 ? "warn" : "ok";
        return html`<button class="wear ${level}" @click=${() => this._moreInfo(x.id)}>
          <ha-icon .icon=${x.icon}></ha-icon>
          <span class="w-text"><b>${this._t(x.key)}</b>${level !== "ok" ? html`<small>${this._t(`${x.key}_replace`)}</small>` : nothing}</span>
          <span class="w-bar"><span style="width:${Math.min(100, Math.max(0, x.v!))}%"></span></span>
          <span class="w-val">${Math.round(x.v!)} %</span>
        </button>`;
      })}
      ${update ? html`<button class="update" @click=${() => this._moreInfo(f.update)}><ha-icon icon="mdi:package-up"></ha-icon>${this._t("update")}</button>` : nothing}
    </div>`;
  }

  private _renderSegments(kind: "efficiency" | "obstacle", id?: string) {
    const st = this._st(id) ?? (id ? this.hass!.states[id] : undefined);
    const opts = st?.attributes.options as string[] | undefined;
    if (!st || !opts?.length) return nothing;
    return html`<div class="set-group">
      <span class="set-label">${this._t(kind)}</span>
      <div class="segs" role="radiogroup" aria-label=${this._t(kind)}>${opts.map((o) => html`<button class="seg ${st.state === o ? "sel" : ""}" role="radio"
        aria-checked=${st.state === o} @click=${() => this._select(st.entity_id, o)}>${this._option(kind, o)}</button>`)}</div>
    </div>`;
  }

  private _renderSettings() {
    const f = this._f();
    const delaySt = this._st(f.rain_delay);
    const switches = SWITCHES.filter((k) => f[k] && this.hass!.states[f[k]!]);
    const hasAny = switches.length || delaySt || this.hass!.states[f.efficiency ?? ""] || this.hass!.states[f.obstacle ?? ""];
    if (!hasAny) return nothing;
    const delay = this._pendingDelay ?? (delaySt ? Number(delaySt.state) : undefined);
    const step = delaySt ? Math.max(Number(delaySt.attributes.step) || 1, 30) : 30;
    const aStart = this._timeOf(f.animal_start);
    const aEnd = this._timeOf(f.animal_end);
    return html`<div class="settings ${this._settingsOpen ? "open" : ""}">
      <button class="sec-head" aria-expanded=${this._settingsOpen} @click=${() => { this._haptic("selection"); this._settingsOpen = !this._settingsOpen; }}>
        <ha-icon icon="mdi:tune-variant"></ha-icon><span>${this._t("settings")}</span>
        <ha-icon class="chev ${this._settingsOpen ? "up" : ""}" icon="mdi:chevron-down"></ha-icon>
      </button>
      ${this._settingsOpen ? html`<div class="set-body">
        ${this._renderSegments("efficiency", f.efficiency)}
        ${this._renderSegments("obstacle", f.obstacle)}
        ${switches.length ? html`<div class="switches">${switches.map((k) => {
          const on = this.hass!.states[f[k]!]?.state === "on";
          return html`<button class="toggle-row ${on ? "on" : ""}" role="switch" aria-checked=${on} data-key=${k} @click=${() => this._toggle(f[k])}>
            <ha-icon .icon=${SWITCH_ICON[k] ?? "mdi:toggle-switch-outline"}></ha-icon>
            <span class="tr-text">${this._t(`sw_${k}`)}${k === "animal" && aStart && aEnd ? html`<small>${aStart}–${aEnd}</small>` : nothing}</span>
            <span class="sw"><span></span></span></button>`;
        })}</div>` : nothing}
        ${delaySt && delay != null && Number.isFinite(delay) ? html`<div class="delay">
          <ha-icon icon="mdi:weather-pouring"></ha-icon>
          <span class="d-label">${this._t("rain_delay")}<small>${this._t("rain_delay_hint")}</small></span>
          <button class="step" aria-label="−" ?disabled=${delay <= Number(delaySt.attributes.min ?? 0)} @click=${() => this._setDelay(delay - step)}><ha-icon icon="mdi:minus"></ha-icon></button>
          <span class="d-val">${delay >= 60 ? `${this._fmt(delay / 60)} h` : `${delay} min`}</span>
          <button class="step" aria-label="+" ?disabled=${delay >= Number(delaySt.attributes.max ?? 1440)} @click=${() => this._setDelay(delay + step)}><ha-icon icon="mdi:plus"></ha-icon></button>
        </div>` : nothing}
      </div>` : nothing}
    </div>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const st = this.hass.states[c.entity];
    if (!st) return html`<ha-card class="mower"><div class="missing">${this._t("missing")}: ${c.entity}</div></ha-card>`;
    const f = this._f();
    const show = { scene: true, areas: true, controls: true, session: true, stats: true, maintenance: true, settings: true, ...c.show };
    const errSt = this._st(f.error);
    const phase = UNAVAILABLE.includes(st.state) ? "unknown" : mowerPhase(st.state, errSt?.state);
    const battery = this._num(f.battery);
    const charging = phase === "docked" && battery != null && battery < 100;
    const wifiSt = this._st(f.wifi);
    const wifiV = wifiSt ? Number(wifiSt.state) : NaN;
    const wifiUnit = wifiSt?.attributes.unit_of_measurement ?? (wifiV > 5 && wifiV <= 100 ? "%" : "dBm");
    const wifi = Number.isFinite(wifiV) ? wifiQuality(wifiV, wifiUnit) : undefined;
    const progress = this._num(f.progress);
    const color = PHASE_COLOR[phase];
    const errText = phase === "error" ? (errSt?.attributes.description ? String(errSt.attributes.description) : `${this._t("error_code")} ${errSt?.state ?? ""}`.trim()) : "";
    return html`<ha-card class="mower anim-${c.animations ?? "full"} ${phase}" style="--hcc-accent-c:${color}; --pc:${color}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <button class="h-icon" @click=${() => this._moreInfo(c.entity)} aria-label=${c.name ?? st.attributes.friendly_name}><ha-icon .icon=${PHASE_ICON[phase]}></ha-icon></button>
        <button class="head-text" @click=${() => this._moreInfo(c.entity)}>
          <span class="h-title">${c.name ?? st.attributes.friendly_name ?? this._t("title")}</span>
          <span class="h-sub">${this._t(`phase_${phase}`)}${phase === "mowing" && progress != null ? ` · ${Math.round(progress)} %` : ""}${charging ? ` · ${this._t("charging")}` : ""}</span>
        </button>
        ${wifi ? html`<button class="chip wifi w-${wifi}" @click=${() => this._moreInfo(f.wifi)} title=${`${this._t("wifi")}: ${localize(this.hass, `camera.wifi_${wifi}`)}`}>
          <ha-icon .icon=${wifi === "weak" ? "mdi:wifi-strength-1" : wifi === "fair" ? "mdi:wifi-strength-2" : wifi === "good" ? "mdi:wifi-strength-3" : "mdi:wifi-strength-4"}></ha-icon></button>` : nothing}
        ${battery != null ? html`<button class="batt ${battery < 20 ? "low" : ""} ${charging ? "charging" : ""}" style="--p:${(Math.min(100, battery) * 3.6).toFixed(1)}deg"
          @click=${() => this._moreInfo(f.battery)} aria-label=${`${this._t("battery")} ${Math.round(battery)} %`}>
          <span class="b-in">${charging ? html`<ha-icon icon="mdi:lightning-bolt"></ha-icon>` : nothing}<b>${Math.round(battery)}</b><small>%</small></span></button>` : nothing}
        ${f.refresh ? html`<button class="refresh" @click=${() => this._press(f.refresh)} aria-label=${this._t("refresh")} title=${this._t("refresh")}><ha-icon icon="mdi:refresh"></ha-icon></button>` : nothing}
      </div>
      ${show.scene ? this._renderScene(phase, charging) : nothing}
      ${errText ? html`<button class="error" @click=${() => this._moreInfo(f.error)}><ha-icon icon="mdi:alert-circle"></ha-icon><span>${errText}</span></button>` : nothing}
      ${show.controls ? this._renderControls(phase, st) : nothing}
      ${show.areas ? this._renderAreas(phase) : nothing}
      ${show.session ? this._renderSession(phase) : nothing}
      ${show.stats ? this._renderStats() : nothing}
      ${show.maintenance ? this._renderMaintenance() : nothing}
      ${show.settings ? this._renderSettings() : nothing}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.mower { --accent: var(--pc); gap: 12px; container-type: inline-size; }
    ha-card.mower.docked .blob, ha-card.mower.unknown .blob { opacity: 0.35; animation-play-state: paused; }
    .missing { padding: 8px; color: var(--error-color, #e53935); }
    .header { display: flex; align-items: center; gap: 10px; }
    .h-icon { flex: none; width: 42px; height: 42px; border-radius: 50%; border: none; padding: 0; display: grid; place-items: center; cursor: pointer;
      color: var(--pc); background: color-mix(in srgb, var(--pc) 16%, transparent); transition: background 0.4s, color 0.4s; }
    .h-icon ha-icon { --mdc-icon-size: 24px; }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; border: none; background: none; padding: 0; text-align: left; cursor: pointer; }
    .h-title { font-size: 17px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .h-sub { font-size: 13px; font-weight: 600; color: var(--pc); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .chip, .refresh { flex: none; width: 34px; height: 34px; border-radius: 50%; border: none; padding: 0; display: grid; place-items: center; cursor: pointer;
      background: rgba(127,127,127,0.1); color: var(--secondary-text-color); }
    .chip ha-icon, .refresh ha-icon { --mdc-icon-size: 18px; }
    .wifi.w-very_good, .wifi.w-good { color: var(--success-color, #43a047); }
    .wifi.w-fair { color: #fb8c00; }
    .wifi.w-weak { color: var(--error-color, #e53935); }
    .batt { position: relative; flex: none; width: 46px; height: 46px; border-radius: 50%; border: none; padding: 0; cursor: pointer;
      background: conic-gradient(var(--success-color, #43a047) 0 var(--p), rgba(127,127,127,0.18) var(--p) 360deg); }
    .batt.low { background: conic-gradient(var(--error-color, #e53935) 0 var(--p), rgba(127,127,127,0.18) var(--p) 360deg); }
    .b-in { position: absolute; inset: 4px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      background: var(--card-background-color, var(--ha-card-background, #fff)); font-variant-numeric: tabular-nums; }
    .b-in b { font-size: 13px; }
    .b-in small { font-size: 9px; color: var(--secondary-text-color); }
    .b-in ha-icon { --mdc-icon-size: 12px; color: #fbc02d; margin-right: -1px; }

    /* Szene */
    .scene { position: relative; height: 150px; border-radius: var(--hcc-inner-radius, 14px); overflow: hidden; isolation: isolate;
      background: linear-gradient(180deg, #7cb342, #558b2f); box-shadow: inset 0 0 0 3px rgba(255,255,255,0.1); }
    .lawn { position: absolute; inset: 0; z-index: -1;
      background: repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0 34px, rgba(0,0,0,0.05) 34px 68px); }
    .cut { position: absolute; inset: 0; opacity: 0; background: repeating-linear-gradient(0deg, rgba(255,255,255,0.12) 0 18px, transparent 18px 36px); transition: opacity 1s; }
    .p-mowing .cut, .p-paused .cut, .p-returning .cut { opacity: 1; }
    .blades { position: absolute; inset: auto 0 0 0; height: 22px; opacity: 0.6;
      background: radial-gradient(circle at 6px 22px, #33691e 0 5px, transparent 6px) 0 0 / 12px 22px repeat-x;
      animation: sway 4s ease-in-out infinite alternate; transform-origin: bottom; }
    @keyframes sway { from { transform: skewX(-3deg); } to { transform: skewX(3deg); } }
    .station { position: absolute; right: 12px; bottom: 14px; width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center;
      color: #fff; background: rgba(0,0,0,0.22); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
    .station ha-icon { --mdc-icon-size: 26px; }
    .station .bolt { position: absolute; top: -6px; right: -6px; --mdc-icon-size: 18px; color: #fdd835; animation: blink 1.6s ease-in-out infinite; }
    @keyframes blink { 50% { opacity: 0.35; } }
    .bot { position: absolute; left: calc(100% - 104px); top: calc(100% - 60px); width: 40px; height: 40px; transition: left 1.2s var(--ease-out), top 1.2s var(--ease-out); }
    .bot-in { width: 100%; height: 100%; border-radius: 50%; display: grid; place-items: center; color: #fff; background: rgba(0,0,0,0.3);
      box-shadow: 0 4px 10px rgba(0,0,0,0.25); }
    .bot-in ha-icon { --mdc-icon-size: 26px; }
    .p-mowing .bot { left: calc(50% - 20px); top: calc(50% - 26px); }
    .p-mowing .bot-in { position: relative; animation: hum 0.5s ease-in-out infinite alternate; background: var(--success-color, #43a047); }
    .p-mowing .bot-in::after { content: ""; position: absolute; inset: -6px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.7); animation: ring 1.8s ease-out infinite; }
    @keyframes ring { from { transform: scale(0.8); opacity: 1; } to { transform: scale(1.6); opacity: 0; } }
    .p-paused .bot { left: 46%; top: 38%; }
    .p-paused .bot-in { background: #fb8c00; }
    .p-returning .bot { animation: home 6s var(--ease-out) forwards; }
    .p-returning .bot-in { background: #1e88e5; }
    .p-error .bot { left: 30%; top: 45%; }
    .p-error .bot-in { background: var(--error-color, #e53935); animation: shake 0.6s ease-in-out infinite; }
    @keyframes hum { from { translate: 0 0; } to { translate: 0 -1.5px; } }
    @keyframes home { from { left: 30%; top: 20%; } to { left: calc(100% - 104px); top: calc(100% - 60px); } }
    @keyframes shake { 0%, 100% { translate: 0 0; } 25% { translate: -2px 0; } 75% { translate: 2px 0; } }
    .map { width: 100%; height: 100%; display: block; }
    .live { position: absolute; top: 8px; left: 8px; z-index: 1; display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 999px;
      font-size: 10.5px; font-weight: 800; letter-spacing: 0.06em; color: #fff; background: rgba(0,0,0,0.35); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
    .live-dot { width: 7px; height: 7px; border-radius: 50%; background: #ff5252; animation: blink 1.4s ease-in-out infinite; }
    .m-area { fill: rgba(255,255,255,0.14); stroke: rgba(255,255,255,0.7); stroke-width: 0.6%; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
    .m-zone { fill: rgba(255,255,255,0.06); stroke: rgba(255,255,255,0.45); stroke-width: 1; vector-effect: non-scaling-stroke; stroke-linejoin: round;
      cursor: pointer; pointer-events: visiblePainted; transition: fill 0.25s; -webkit-tap-highlight-color: transparent; }
    .m-zone:hover { fill: rgba(255,255,255,0.16); }
    .m-zone.job { stroke: #fff; stroke-dasharray: 4 3; stroke-width: 1.5; }
    .m-zone.sel { fill: color-mix(in srgb, #fdd835 40%, transparent); stroke: #fdd835; stroke-width: 2; }
    .m-path { fill: none; pointer-events: none; stroke: rgba(255,255,255,0.55); stroke-linecap: round; stroke-linejoin: round; }
    .m-dock { fill: #fdd835; stroke: #fff; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
    .m-pos .m-dot { fill: #fff; stroke: var(--success-color, #43a047); stroke-width: 2; vector-effect: non-scaling-stroke; }
    .m-arrow { fill: var(--success-color, #43a047); }
    .m-pos .m-pulse { fill: rgba(255,255,255,0.35); transform-box: fill-box; transform-origin: center; animation: pulse 1.8s ease-out infinite; }
    @keyframes pulse { from { transform: scale(0.4); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }

    /* Bereiche */
    .areas { display: flex; flex-direction: column; gap: 8px; }
    .a-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .a-head .sec-title { flex: none; }
    .a-sum { flex: 1; min-width: 0; font-size: 12px; font-weight: 600; color: var(--secondary-text-color); }
    .a-clear { flex: none; border: none; background: none; padding: 4px 6px; cursor: pointer; font-size: 12px; font-weight: 600; color: var(--accent); }
    .a-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .a-chip { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; padding: 6px 10px 6px 7px; border: none; border-radius: 999px; cursor: pointer;
      font-size: 12.5px; font-weight: 600; background: rgba(127,127,127,0.1); transition: background 0.25s, color 0.25s; }
    .a-chip span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .a-chip small { font-weight: 500; color: var(--secondary-text-color); white-space: nowrap; }
    .a-chip ha-icon { --mdc-icon-size: 17px; color: var(--secondary-text-color); flex: none; }
    .a-chip.sel { background: color-mix(in srgb, #f9a825 22%, transparent); }
    .a-chip.sel ha-icon { color: #f9a825; }
    .a-start { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 12px; border: none; border-radius: var(--hcc-inner-radius, 14px); cursor: pointer;
      font-size: 14px; font-weight: 700; color: #fff; background: var(--success-color, #43a047); transition: background 0.3s, opacity 0.3s, transform 0.2s var(--ease-spring); }
    .a-start ha-icon { --mdc-icon-size: 20px; }
    .a-start:active:not([disabled]) { transform: scale(0.98); }
    .a-start.ask { background: #f57c00; }
    .a-start[disabled] { opacity: 0.4; cursor: default; }
    .a-note { font-size: 11.5px; color: var(--secondary-text-color); text-align: center; }

    /* Fehler */
    .error { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: none; border-radius: var(--hcc-inner-radius, 14px); cursor: pointer; text-align: left;
      font-size: 13.5px; font-weight: 600; color: var(--error-color, #e53935); background: color-mix(in srgb, var(--error-color, #e53935) 13%, transparent); }
    .error ha-icon { --mdc-icon-size: 22px; flex: none; }

    /* Steuerung */
    .controls { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); grid-auto-flow: column; gap: 8px; }
    .ctl { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 10px 4px; border: none; border-radius: var(--hcc-inner-radius, 14px); cursor: pointer;
      font-size: 12.5px; font-weight: 600; background: rgba(127,127,127,0.1); transition: background 0.3s, color 0.3s, transform 0.2s var(--ease-spring), opacity 0.3s; min-width: 0; }
    .ctl span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .ctl ha-icon { --mdc-icon-size: 24px; color: var(--accent); }
    .ctl:active:not([disabled]) { transform: scale(0.95); }
    .ctl[disabled] { opacity: 0.38; cursor: default; }
    .ctl.start:not([disabled]) { color: #fff; background: var(--success-color, #43a047); }
    .ctl.start:not([disabled]) ha-icon { color: #fff; }
    .ctl.stop ha-icon { color: var(--error-color, #e53935); }
    .ctl.stop.ask { color: #fff; background: var(--error-color, #e53935); }
    .ctl.stop.ask ha-icon { color: #fff; }

    /* Aktueller Lauf */
    .session { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: var(--hcc-inner-radius, 14px); background: rgba(127,127,127,0.07); }
    .s-head { display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; font-weight: 600; color: var(--secondary-text-color); }
    .s-head b { font-size: 16px; color: var(--primary-text-color); font-variant-numeric: tabular-nums; }
    .bar { height: 8px; border-radius: 4px; background: rgba(127,127,127,0.18); overflow: hidden; }
    .bar span { display: block; height: 100%; border-radius: inherit; background: var(--accent); transition: width 0.8s var(--ease-out); }
    .s-stats { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 13px; font-weight: 600; }
    .s-stats span { display: inline-flex; align-items: center; gap: 4px; }
    .s-stats small { font-weight: 500; color: var(--secondary-text-color); }
    .s-stats ha-icon { --mdc-icon-size: 16px; color: var(--accent); }

    /* Statistik */
    .stats { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 8px; }
    @container (max-width: 300px) { .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } .stat:last-child:nth-child(odd) { grid-column: span 2; } }
    .stat { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; min-width: 0; padding: 10px; border: none; border-radius: var(--hcc-inner-radius, 14px);
      cursor: pointer; background: rgba(127,127,127,0.07); text-align: left; }
    .stat ha-icon { --mdc-icon-size: 18px; color: var(--secondary-text-color); }
    .stat b { font-size: clamp(14px, 4.6cqi, 17px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; font-variant-numeric: tabular-nums; }
    .stat small { font-size: 11.5px; line-height: 1.25; color: var(--secondary-text-color); max-width: 100%; overflow-wrap: anywhere; }

    /* Wartung */
    .maint { display: flex; flex-direction: column; gap: 6px; }
    .sec-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--secondary-text-color); }
    .sec-title ha-icon { --mdc-icon-size: 16px; }
    .wear { display: grid; grid-template-columns: auto minmax(0, 1fr) 80px 44px; align-items: center; gap: 10px; padding: 8px 10px; border: none;
      border-radius: 12px; cursor: pointer; background: rgba(127,127,127,0.07); text-align: left; --wc: var(--success-color, #43a047); }
    .wear.warn { --wc: #fb8c00; }
    .wear.bad { --wc: var(--error-color, #e53935); background: color-mix(in srgb, var(--wc) 11%, transparent); }
    .wear > ha-icon { --mdc-icon-size: 20px; color: var(--wc); }
    .w-text { display: flex; flex-direction: column; min-width: 0; font-size: 13.5px; }
    .w-text small { font-size: 11.5px; font-weight: 600; color: var(--wc); }
    .w-bar { height: 6px; border-radius: 3px; background: rgba(127,127,127,0.2); overflow: hidden; }
    .w-bar span { display: block; height: 100%; border-radius: inherit; background: var(--wc); }
    .w-val { font-size: 13px; font-weight: 700; text-align: right; color: var(--wc); font-variant-numeric: tabular-nums; }
    .update { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: none; border-radius: 12px; cursor: pointer; font-size: 13px; font-weight: 600;
      color: #1e88e5; background: color-mix(in srgb, #1e88e5 12%, transparent); }
    .update ha-icon { --mdc-icon-size: 18px; }

    /* Einstellungen */
    .settings { border-radius: var(--hcc-inner-radius, 14px); background: rgba(127,127,127,0.07); overflow: hidden; }
    .sec-head { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border: none; background: none; cursor: pointer; text-align: left; }
    .sec-head > ha-icon:first-child { --mdc-icon-size: 20px; color: var(--accent); flex: none; }
    .sec-head span { flex: 1; font-size: 14px; font-weight: 600; }
    .chev { --mdc-icon-size: 20px; color: var(--secondary-text-color); transition: transform 0.3s var(--ease-out); flex: none; }
    .chev.up { transform: rotate(180deg); }
    .set-body { display: flex; flex-direction: column; gap: 10px; padding: 0 12px 12px; animation: fade-in 0.3s var(--ease-out) both; }
    @keyframes fade-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
    .set-group { display: flex; flex-direction: column; gap: 5px; }
    .set-label { font-size: 12px; font-weight: 600; color: var(--secondary-text-color); }
    .segs { display: flex; flex-wrap: wrap; gap: 6px; }
    .seg { flex: 1 1 auto; padding: 7px 12px; border: none; border-radius: 999px; background: rgba(127,127,127,0.12); cursor: pointer; font-size: 12.5px; font-weight: 600;
      color: var(--secondary-text-color); white-space: nowrap; transition: background 0.3s, color 0.3s; }
    .seg.sel { color: #fff; background: var(--success-color, #43a047); }
    .switches { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 6px; }
    .toggle-row { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border: none; border-radius: 12px; cursor: pointer; text-align: left;
      font-size: 13px; font-weight: 600; background: var(--card-background-color, var(--ha-card-background, #fff)); min-width: 0; }
    .toggle-row > ha-icon { --mdc-icon-size: 19px; color: var(--secondary-text-color); flex: none; transition: color 0.3s; }
    .toggle-row.on > ha-icon { color: var(--success-color, #43a047); }
    .tr-text { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .tr-text small { font-size: 11px; font-weight: 500; color: var(--secondary-text-color); }
    .sw { position: relative; flex: none; width: 34px; height: 20px; border-radius: 10px; background: rgba(127,127,127,0.35); transition: background 0.3s; }
    .sw span { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 0.3s var(--ease-spring); box-shadow: 0 1px 2px rgba(0,0,0,0.3); }
    .toggle-row.on .sw { background: var(--success-color, #43a047); }
    .toggle-row.on .sw span { transform: translateX(14px); }
    .delay { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 12px; background: var(--card-background-color, var(--ha-card-background, #fff)); }
    .delay > ha-icon { --mdc-icon-size: 20px; color: #1e88e5; flex: none; }
    .d-label { flex: 1; display: flex; flex-direction: column; min-width: 0; font-size: 13px; font-weight: 600; }
    .d-label small { font-size: 11px; font-weight: 500; color: var(--secondary-text-color); }
    .step { width: 34px; height: 34px; border-radius: 50%; border: none; padding: 0; display: grid; place-items: center; cursor: pointer; color: var(--accent);
      background: rgba(127,127,127,0.12); touch-action: manipulation; flex: none; }
    .step[disabled] { opacity: 0.35; cursor: default; }
    .step ha-icon { --mdc-icon-size: 20px; }
    .d-val { min-width: 54px; text-align: center; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }

    @container (max-width: 360px) {
      .refresh { display: none; }
      .header { gap: 8px; }
      .batt { width: 42px; height: 42px; }
      .b-in b { font-size: 12px; }
      .b-in small { display: none; }
      .ctl span { font-size: 11.5px; }
      .wear { grid-template-columns: auto minmax(0, 1fr) 48px 40px; }
      .scene { height: 130px; }
    }
    ha-card.anim-reduced .blades, ha-card.anim-off .blades, ha-card.anim-reduced .p-mowing .bot-in, ha-card.anim-off .p-mowing .bot-in,
    ha-card.anim-off .p-mowing .bot, ha-card.anim-off .p-returning .bot, ha-card.anim-off .station .bolt, ha-card.anim-off .m-pulse,
    ha-card.anim-off .p-error .bot-in { animation: none; }
    ha-card.anim-off .p-mowing .bot-in::after { animation: none; display: none; }
  `];
}
