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

/** Seitenverhältnis der Kartenszene: breite Gärten flach (max. 2,6:1), schmale/hohe Gärten höher (min. 1,1:1) */
const mapAspect = (map: MowerMap): number => Math.min(2.6, Math.max(1.1, map.box.w / Math.max(map.box.h, 1)));

/** Füllfarben der Mähbereiche (Grüntöne, gut unterscheidbar auf dem Rasen) */
const ZONE_COLORS = ["#8bc34a", "#26a69a", "#cddc39", "#66bb6a", "#4dd0e1", "#aed581", "#81c784", "#4db6ac"];

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
  /** Bereich, dessen Einstellungen (Mähhöhe …) offen sind – per langem Drücken */
  @state() private _areaPanel?: string;
  /** Karte im Vollbild mit Zoom (Mittelpunkt und Faktor in Karteneinheiten) */
  @state() private _full = false;
  @state() private _zoom = { cx: 0, cy: 0, s: 1 };
  @state() private _pendingNum: Record<string, number> = {};
  private _numTimers: Record<string, number> = {};
  private _holdTimer?: number;
  private _held = false;
  private _pointers = new Map<number, { x: number; y: number }>();
  private _drag?: { x: number; y: number; d: number; cx: number; cy: number; s: number; moved: boolean };
  private _heading?: number;
  private _areaIdsCache?: { key: unknown; ids: string[] };
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
    return [this._config!.entity, ...FEATURE_KEYS.map((k) => f[k]), ...this._areaSettingIds()].filter(Boolean) as string[];
  }

  /** Einstellungen pro Bereich am selben Gerät (Attribut `area_id`, z.B. goat_mower) */
  private _areaSettingIds(): string[] {
    const hass = this.hass!;
    if (this._areaIdsCache && this._areaIdsCache.key === hass.entities) return this._areaIdsCache.ids;
    const device = hass.entities?.[this._config!.entity]?.device_id;
    const ids = device ? Object.values(hass.entities!).filter((e) => e.device_id === device && /^(number|select)\./.test(e.entity_id)
      && hass.states[e.entity_id]?.attributes.area_id != null).map((e) => e.entity_id) : [];
    this._areaIdsCache = { key: hass.entities, ids };
    return ids;
  }

  private _areaSettings(areaId: string): { height?: HassEntity; speed?: HassEntity; avoidance?: HassEntity } {
    const sts = this._areaSettingIds().map((id) => this.hass!.states[id]).filter((st): st is HassEntity => !!st && String(st.attributes.area_id) === areaId);
    const key = (st: HassEntity) => String(this.hass!.entities?.[st.entity_id]?.translation_key ?? "");
    const unit = (st: HassEntity) => String(st.attributes.unit_of_measurement ?? "");
    return {
      height: sts.find((st) => st.entity_id.startsWith("number.") && (/height/.test(key(st)) || unit(st) === "cm")),
      speed: sts.find((st) => st.entity_id.startsWith("number.") && (/speed/.test(key(st)) || unit(st) === "m/s")),
      avoidance: sts.find((st) => st.entity_id.startsWith("select.")),
    };
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
    const dlg = this.shadowRoot?.querySelector("dialog.full") as HTMLDialogElement | null;
    if (dlg && this._full && !dlg.open) dlg.showModal?.();
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
    if (this._held || this._drag?.moved) { this._held = false; return; }
    this._haptic("selection");
    this._confirm = undefined;
    const was = this._selected.includes(id);
    this._selected = was ? this._selected.filter((x) => x !== id) : [...this._selected, id];
    // Einstellungen folgen dem zuletzt angetippten Bereich
    if (this._areaSettingIds().length) {
      if (!was) this._areaPanel = id;
      else if (this._areaPanel === id) this._areaPanel = this._selected[this._selected.length - 1];
    }
  }

  private async _mowAreas(areas: MowerArea[]): Promise<void> {
    const domain = this._areaDomain();
    const ids = areas.map((a) => a.id);
    if (!domain || !ids.length || !this._confirmed("areas")) return;
    this._haptic("medium");
    await this._call(domain, AREA_SERVICE, { entity_id: this._config!.entity, area_ids: ids });
    this._selected = [];
  }

  /** Langes Drücken auf einen Bereich (Karte oder Liste) öffnet seine Einstellungen */
  private _holdStart(id: string, ev: PointerEvent): void {
    this._held = false;
    clearTimeout(this._holdTimer);
    const x = ev.clientX, y = ev.clientY;
    const cancel = (e: PointerEvent) => { if (Math.hypot(e.clientX - x, e.clientY - y) > 8) clearTimeout(this._holdTimer); };
    window.addEventListener("pointermove", cancel);
    window.addEventListener("pointerup", () => { clearTimeout(this._holdTimer); window.removeEventListener("pointermove", cancel); }, { once: true });
    this._holdTimer = window.setTimeout(() => {
      this._held = true;
      this._haptic("medium");
      this._areaPanel = id;
    }, 500);
  }

  /** Zahl −/+ kurz gesammelt senden (Mähhöhe, Geschwindigkeit) */
  private _stepNumber(st: HassEntity, dir: number): void {
    const a = st.attributes;
    const step = Number(a.step) || 1;
    const cur = this._pendingNum[st.entity_id] ?? Number(st.state);
    const v = Math.round(Math.min(Number(a.max ?? Infinity), Math.max(Number(a.min ?? -Infinity), cur + dir * step)) / step) * step;
    const value = Number(v.toFixed(4));
    this._haptic("selection");
    this._pendingNum = { ...this._pendingNum, [st.entity_id]: value };
    clearTimeout(this._numTimers[st.entity_id]);
    this._numTimers[st.entity_id] = window.setTimeout(() => this._call("number", "set_value", { entity_id: st.entity_id, value })
      .finally(() => {
        if (this._pendingNum[st.entity_id] === value) { const { [st.entity_id]: _, ...rest } = this._pendingNum; this._pendingNum = rest; }
      }), 700);
  }

  // ---------- Vollbild & Zoom ----------

  private _openFull(): void {
    this._haptic("selection");
    this._zoom = { cx: 0, cy: 0, s: 1 };
    this._full = true;
  }

  private _closeFull(): void {
    (this.shadowRoot?.querySelector("dialog.full") as HTMLDialogElement | null)?.close?.();
    this._full = false;
  }

  private _zoomBy(f: number, at?: { x: number; y: number }): void {
    const z = this._zoom;
    const s = Math.min(8, Math.max(1, z.s * f));
    // Punkt unter dem Finger/Mauszeiger bleibt stehen
    const cx = at ? at.x + (z.cx - at.x) * (z.s / s) : z.cx;
    const cy = at ? at.y + (z.cy - at.y) * (z.s / s) : z.cy;
    this._zoom = s === 1 ? { cx: 0, cy: 0, s: 1 } : { cx, cy, s };
  }

  /** Bildschirmpunkt → Kartenkoordinate (Ansicht = viewBox) */
  private _toMap(svgEl: SVGSVGElement, x: number, y: number): { x: number; y: number } {
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(x, y).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  private _onPointerDown(ev: PointerEvent): void {
    this._pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const pts = [...this._pointers.values()];
    const mid = pts.length > 1 ? { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 } : pts[0]!;
    const d = pts.length > 1 ? Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y) : 0;
    const z = this._zoom.cx ? this._zoom : { ...this._zoom, cx: this._viewCenter.x, cy: this._viewCenter.y };
    this._zoom = z;
    this._drag = { x: mid.x, y: mid.y, d, cx: z.cx, cy: z.cy, s: z.s, moved: pts.length > 1 || !!this._drag?.moved };
  }

  private _onPointerMove(ev: PointerEvent): void {
    if (!this._pointers.has(ev.pointerId) || !this._drag) return;
    const svgEl = ev.currentTarget as SVGSVGElement;
    this._pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const pts = [...this._pointers.values()];
    const g = this._drag;
    const mid = pts.length > 1 ? { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 } : pts[0]!;
    if (!g.moved && pts.length < 2 && Math.hypot(mid.x - g.x, mid.y - g.y) < 8) return;
    g.moved = true;
    clearTimeout(this._holdTimer);
    let s = g.s;
    if (pts.length > 1 && g.d > 0) s = Math.min(8, Math.max(1, g.s * (Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y) / g.d)));
    const rect = svgEl.getBoundingClientRect();
    const upp = Math.max(this._viewSize.w / s / rect.width, this._viewSize.h / s / rect.height);
    this._zoom = s === 1 && pts.length > 1 ? { cx: 0, cy: 0, s: 1 } : { s, cx: g.cx - (mid.x - g.x) * upp, cy: g.cy - (mid.y - g.y) * upp };
  }

  private _onPointerUp(ev: PointerEvent): void {
    this._pointers.delete(ev.pointerId);
    if (!this._pointers.size) window.setTimeout(() => { this._drag = undefined; }, 0);
    else if (this._drag) {
      const p = [...this._pointers.values()][0]!;
      this._drag = { ...this._drag, x: p.x, y: p.y, d: 0, cx: this._zoom.cx, cy: this._zoom.cy, s: this._zoom.s };
    }
  }

  private _onWheel(ev: WheelEvent): void {
    ev.preventDefault();
    const at = this._toMap(ev.currentTarget as SVGSVGElement, ev.clientX, ev.clientY);
    if (!this._zoom.cx) this._zoom = { ...this._zoom, cx: this._viewCenter.x, cy: this._viewCenter.y };
    this._zoomBy(Math.pow(1.0015, -ev.deltaY), at);
  }

  /** Mitte und Größe der ungezoomten Ansicht (für Zoom) */
  private _viewCenter = { x: 0, y: 0 };
  private _viewSize = { w: 1, h: 1 };

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

  private _renderMap(map: MowerMap, phase: MowerPhase, job: string[], zoomable = false) {
    // Marker in Bildschirm-Pixeln bemessen (Szene ca. 350 px breit, Seitenverhältnis siehe mapAspect) und genug Rand lassen
    const ar = mapAspect(map);
    const base = Math.max(map.box.w / ar, map.box.h) / Math.min(340, Math.max(150, 350 / ar));
    const z = zoomable ? this._zoom : { cx: 0, cy: 0, s: 1 };
    // im Vollbild ist die Karte größer und gezoomt – Marker und Schrift bleiben gleich groß auf dem Bildschirm
    const px = zoomable ? base * 0.55 / z.s : base;
    const r = px * 6;
    const m = base * 24;
    const box = { x: map.box.x - m, y: map.box.y - m, w: map.box.w + 2 * m, h: map.box.h + 2 * m };
    const X = (p: MapPoint) => (p.x - box.x).toFixed(1);
    const Y = (p: MapPoint) => (box.h - (p.y - box.y)).toFixed(1);
    const P = (p: MapPoint) => `${X(p)},${Y(p)}`;
    const pts = (l: MapPoint[]) => l.map(P).join(" ");
    const tappable = !!this._areaDomain();
    const n = (v: number) => v.toFixed(2);
    let vb = `0 0 ${n(box.w)} ${n(box.h)}`;
    if (zoomable) {
      this._viewCenter = { x: box.w / 2, y: box.h / 2 };
      this._viewSize = { w: box.w, h: box.h };
      if (z.s > 1) {
        const w = box.w / z.s, h = box.h / z.s;
        const cx = Math.min(box.w - w / 2, Math.max(w / 2, z.cx)), cy = Math.min(box.h - h / 2, Math.max(h / 2, z.cy));
        vb = `${n(cx - w / 2)} ${n(cy - h / 2)} ${n(w)} ${n(h)}`;
      }
    }
    // Beschriftung nur, wenn der Bereich auf dem Bildschirm breit genug ist (ausgewählte und laufende immer)
    const fits = (a: MowerArea) => {
      const xs = a.points.map((p) => p.x);
      return (Math.max(...xs) - Math.min(...xs)) / px >= Math.max(34, a.name.length * 5.6);
    };
    const progress = job.length === 1 ? this._num(this._f().progress) : undefined;
    const order = this._selected.length > 1 ? this._selected : [];
    const pos = map.position;
    const heading = pos?.a != null ? this._smoothHeading(pos.a) : undefined;
    const moving = phase === "mowing" || phase === "returning";
    const id = zoomable ? "f" : "c";
    return html`<svg class="map ${zoomable ? "zoomable" : ""}" viewBox=${vb} preserveAspectRatio="xMidYMid meet" role="img" aria-label=${this._t("map")}
      @pointerdown=${zoomable ? (e: PointerEvent) => this._onPointerDown(e) : nothing}
      @pointermove=${zoomable ? (e: PointerEvent) => this._onPointerMove(e) : nothing}
      @pointerup=${zoomable ? (e: PointerEvent) => this._onPointerUp(e) : nothing}
      @pointercancel=${zoomable ? (e: PointerEvent) => this._onPointerUp(e) : nothing}
      @wheel=${zoomable ? (e: WheelEvent) => this._onWheel(e) : nothing}>
      <defs>
        <pattern id="mw-grass-${id}" patternUnits="userSpaceOnUse" width=${n(base * 7)} height=${n(base * 7)} patternTransform="rotate(35)">
          <rect width=${n(base * 7)} height=${n(base * 7)} fill="#4f9a3e"></rect>
          <rect width=${n(base * 3.5)} height=${n(base * 7)} fill="#58a646"></rect>
        </pattern>
        <filter id="mw-shadow-${id}" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy=${n(base * 1.5)} stdDeviation=${n(base * 2.5)} flood-color="#000" flood-opacity="0.45"></feDropShadow>
        </filter>
      </defs>
      <g filter="url(#mw-shadow-${id})">${map.outline.map((l) => svg`<polygon class="m-area m-lawn" style="fill:url(#mw-grass-${id})" points=${pts(l)}></polygon>`)}</g>
      ${map.channels.map((l) => svg`<polyline class="m-channel" points=${pts(l)}></polyline>`)}
      ${map.areas.map((a, i) => {
        const sel = this._selected.includes(a.id);
        return svg`<polygon class="m-zone ${sel ? "sel" : ""} ${job.includes(a.id) ? "job" : ""} ${tappable ? "tap" : ""} ${this._areaPanel === a.id ? "open" : ""}"
          style="--zc:${ZONE_COLORS[i % ZONE_COLORS.length]}" data-area=${a.id} points=${pts(a.points)}
          @click=${tappable ? () => this._toggleArea(a.id) : nothing}
          @pointerdown=${(e: PointerEvent) => this._holdStart(a.id, e)}
          @contextmenu=${(e: Event) => e.preventDefault()}><title>${a.name}${a.m2 ? ` · ${this._fmt(a.m2, 0)}\u00a0m²` : ""}</title></polygon>`;
      })}
      ${map.segments.length ? svg`<g class="m-mowed" style="stroke-width:${n(base * 3)}">${map.segments.map((l) => svg`<polyline points=${pts(l)}></polyline>`)}</g>` : nothing}
      ${map.obstacles.map((l) => svg`<polygon class="m-obstacle" points=${pts(l)}></polygon>`)}
      ${map.path.length > 1 ? svg`<polyline class="m-path" style="stroke-width:${n(r * 0.45)}" points=${pts(map.path)}></polyline>` : nothing}
      ${map.areas.filter((a) => this._selected.includes(a.id) || job.includes(a.id) || fits(a)).map((a) => {
        const pct = progress != null && job.includes(a.id) ? ` · ${Math.round(progress)} %` : "";
        const no = order.indexOf(a.id);
        return svg`<text class="m-label ${this._selected.includes(a.id) ? "sel" : ""}" x=${X(a.label)} y=${Y(a.label)}
          style="font-size:${n(px * 10.5)}px; stroke-width:${n(px * 3)}px">${a.name}${pct}</text>
          ${no >= 0 ? svg`<g class="m-order" transform="translate(${X(a.label)},${(Number(Y(a.label)) - px * 17).toFixed(1)})">
            <circle r=${n(px * 8)}></circle><text style="font-size:${n(px * 10)}px">${no + 1}</text></g>` : nothing}`;
      })}
      ${map.dock ? svg`<g class="m-dock" transform="translate(${P(map.dock)})">
        <circle r=${n(r * 1.35)}></circle>
        <path transform="scale(${n(r * 0.085)}) translate(-12,-12.5)" d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z"></path>
      </g>` : nothing}
      ${pos ? svg`<g class="m-pos ${phase} ${moving ? "glide" : ""}" style="transform:translate(${X(pos)}px,${Y(pos)}px)">
        <circle class="m-pulse" r=${n(r * 2.2)}></circle>
        <circle class="m-dot" r=${n(r * 1.5)}></circle>
        ${heading != null ? svg`<g class="m-head" style="transform:rotate(${(-heading).toFixed(1)}deg)"><path class="m-arrow" transform="scale(${n(r * 0.85)})" d="M1.4,0 L-0.9,-1 L-0.4,0 L-0.9,1 Z"></path></g>` : nothing}
      </g>` : nothing}
    </svg>`;
  }

  /** Fahrtrichtung ohne Sprung über 0°/360° (die Drehung wird animiert) */
  private _smoothHeading(a: number): number {
    const prev = this._heading;
    if (prev == null) { this._heading = a; return a; }
    const next = prev + ((((a - prev) % 360) + 540) % 360) - 180;
    this._heading = next;
    return next;
  }

  private _renderScene(phase: MowerPhase, charging: boolean) {
    const f = this._f();
    const map = mapGeometry(this.hass!.states[f.map ?? ""]?.attributes, this._trail);
    const job = (this.hass!.states[this._config!.entity]?.attributes.job_area_ids as string[] | undefined)?.map(String) ?? [];
    return html`<div class="scene p-${phase} ${map ? "has-map" : ""}" style=${map ? `--ar:${mapAspect(map).toFixed(3)}` : ""}>
      ${this._streaming ? html`<span class="live" title=${this._t("live_hint")}><span class="live-dot"></span>${this._t("live")}</span>` : nothing}
      ${map ? html`${this._renderMap(map, phase, job)}
        <button class="full-btn" aria-label=${this._t("fullscreen")} title=${this._t("fullscreen")} @click=${() => this._openFull()}><ha-icon icon="mdi:arrow-expand"></ha-icon></button>
        ${this._renderFull(map, phase, job)}` : html`
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
          <button class="a-clear" aria-label=${this._t("areas_clear")} title=${this._t("areas_clear")} @click=${() => { this._selected = []; this._confirm = undefined; this._areaPanel = undefined; }}><ha-icon icon="mdi:close"></ha-icon></button>` : html`<span class="a-sum">${this._t(this._areaSettingIds().length ? "areas_hint_hold" : "areas_hint")}</span>`}
      </div>
      <div class="a-chips" role="group" aria-label=${this._t("areas")}>${areas.map((a) => {
        const sel = this._selected.includes(a.id);
        return html`<button class="a-chip ${sel ? "sel" : ""} ${this._areaPanel === a.id ? "open" : ""}" aria-pressed=${sel} data-area=${a.id}
          @click=${() => this._toggleArea(a.id)} @pointerdown=${(e: PointerEvent) => this._holdStart(a.id, e)} @contextmenu=${(e: Event) => e.preventDefault()}>
          <ha-icon .icon=${sel ? "mdi:check-circle" : "mdi:checkbox-blank-circle-outline"}></ha-icon><span>${a.name}</span>${a.m2 ? html`<small>${this._fmt(a.m2, 0)}\u00a0m²</small>` : nothing}</button>`;
      })}</div>
      ${this._areaPanel ? this._renderAreaPanel(areas.find((a) => a.id === this._areaPanel)) : nothing}
      ${chosen.length ? html`<button class="a-start ${asking ? "ask" : ""}" ?disabled=${!ready} @click=${() => this._mowAreas(chosen)}>
          <ha-icon icon=${asking ? "mdi:alert" : "mdi:play"}></ha-icon><span>${label}</span></button>
        ${!ready ? html`<small class="a-note">${this._t("areas_not_ready")}</small>` : chosen.length > 1 ? html`<small class="a-note">${this._t("areas_multi_hint")}</small>` : nothing}` : nothing}
    </div>`;
  }

  /** Einstellungen eines Bereichs: Mähhöhe, Geschwindigkeit (−/+), Vermeidungsmodus */
  private _renderAreaPanel(area?: MowerArea) {
    if (!area) return nothing;
    const { height, speed, avoidance } = this._areaSettings(area.id);
    const num = (key: string, icon: string, st?: HassEntity) => {
      if (!st || UNAVAILABLE.includes(st.state)) return nothing;
      const a = st.attributes;
      const v = this._pendingNum[st.entity_id] ?? Number(st.state);
      const digits = String(a.step ?? "1").split(".")[1]?.length ?? 0;
      return html`<div class="p-row" data-key=${key}>
        <ha-icon .icon=${icon}></ha-icon><span class="p-label">${this._t(key)}</span>
        <button class="step" aria-label="−" ?disabled=${v <= Number(a.min ?? -Infinity)} @click=${() => this._stepNumber(st, -1)}><ha-icon icon="mdi:minus"></ha-icon></button>
        <span class="p-val">${this._fmt(v, digits)}\u00a0${a.unit_of_measurement ?? ""}</span>
        <button class="step" aria-label="+" ?disabled=${v >= Number(a.max ?? Infinity)} @click=${() => this._stepNumber(st, 1)}><ha-icon icon="mdi:plus"></ha-icon></button>
      </div>`;
    };
    const opts = (avoidance?.attributes.options as string[] | undefined) ?? [];
    const label = (o: string) => (this.hass as any).formatEntityState?.(avoidance, o) ?? o;
    return html`<div class="a-panel">
      <div class="p-head"><ha-icon icon="mdi:tune-variant"></ha-icon><b>${area.name}</b>${area.m2 ? html`<small>${this._fmt(area.m2, 0)}\u00a0m²</small>` : nothing}
        <button class="a-clear" aria-label=${this._t("close")} @click=${() => { this._areaPanel = undefined; }}><ha-icon icon="mdi:close"></ha-icon></button></div>
      ${num("area_height", "mdi:arrow-collapse-vertical", height)}
      ${num("area_speed", "mdi:speedometer", speed)}
      ${avoidance && opts.length && !UNAVAILABLE.includes(avoidance.state) ? html`<div class="set-group" data-key="area_avoidance">
        <span class="set-label">${this._t("area_avoidance")}</span>
        <div class="segs">${opts.map((o) => html`<button class="seg ${avoidance.state === o ? "sel" : ""}" @click=${() => this._select(avoidance.entity_id, o)}>${label(o)}</button>`)}</div>
      </div>` : nothing}
      ${!height && !speed && !avoidance ? html`<small class="a-note">${this._t("area_no_settings")}</small>` : nothing}
    </div>`;
  }

  /** Karte im Vollbild: groß, zoom- und verschiebbar, mit Bereichsauswahl */
  private _renderFull(map: MowerMap | null, phase: MowerPhase, job: string[]) {
    if (!this._full || !map) return nothing;
    return html`<dialog class="full" @close=${() => { this._full = false; }} @cancel=${() => { this._full = false; }}>
      <div class="f-head">
        <b>${this._config!.name ?? this.hass!.states[this._config!.entity]?.attributes.friendly_name ?? this._t("title")}</b>
        <button class="f-btn" aria-label=${this._t("zoom_out")} ?disabled=${this._zoom.s <= 1} @click=${() => this._zoomBy(1 / 1.5)}><ha-icon icon="mdi:magnify-minus-outline"></ha-icon></button>
        <button class="f-btn" aria-label=${this._t("zoom_in")} ?disabled=${this._zoom.s >= 8} @click=${() => {
          if (!this._zoom.cx) this._zoom = { ...this._zoom, cx: this._viewCenter.x, cy: this._viewCenter.y };
          this._zoomBy(1.5);
        }}><ha-icon icon="mdi:magnify-plus-outline"></ha-icon></button>
        <button class="f-btn" aria-label=${this._t("close")} @click=${() => this._closeFull()}><ha-icon icon="mdi:close"></ha-icon></button>
      </div>
      <div class="f-map scene has-map p-${phase}">${this._renderMap(map, phase, job, true)}</div>
      <div class="f-body">${this._renderAreas(phase)}</div>
    </dialog>`;
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
    .scene.has-map { height: auto; aspect-ratio: var(--ar, 2.6); max-height: 340px; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06);
      background: radial-gradient(120% 90% at 30% 15%, #2f4f34 0%, #1b3022 55%, #122017 100%); }
    .scene.has-map::before { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: 0.5;
      background-image: radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1.2px); background-size: 14px 14px; }
    .m-lawn { fill: url(#mw-grass); stroke: rgba(220,255,200,0.55); stroke-width: 1.2px; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
    .m-channel { fill: none; stroke: rgba(230,255,220,0.45); stroke-width: 2px; stroke-dasharray: 3 4; vector-effect: non-scaling-stroke; stroke-linecap: round; }
    .m-zone { fill: color-mix(in srgb, var(--zc) 30%, transparent); stroke: rgba(10,30,10,0.45); stroke-width: 1px; vector-effect: non-scaling-stroke;
      stroke-linejoin: round; transition: fill 0.25s, stroke 0.25s; -webkit-tap-highlight-color: transparent; }
    .m-zone.tap { cursor: pointer; pointer-events: visiblePainted; }
    .m-zone.tap:hover { fill: color-mix(in srgb, var(--zc) 48%, transparent); }
    .m-zone.job { stroke: #fff; stroke-width: 2px; stroke-dasharray: 6 4; animation: march 1.2s linear infinite; }
    @keyframes march { to { stroke-dashoffset: -10; } }
    .m-zone.sel { fill: color-mix(in srgb, #ffca28 50%, transparent); stroke: #ffca28; stroke-width: 2.5px; stroke-dasharray: none; }
    .m-mowed { fill: none; stroke: rgba(210,255,190,0.28); stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
    .m-obstacle { fill: rgba(20,40,20,0.75); stroke: rgba(255,255,255,0.25); stroke-width: 1px; vector-effect: non-scaling-stroke; pointer-events: none; }
    .m-label { fill: rgba(255,255,255,0.92); stroke: rgba(10,30,12,0.75); paint-order: stroke; stroke-linejoin: round; font-weight: 700;
      text-anchor: middle; dominant-baseline: central; pointer-events: none; letter-spacing: 0.01em; }
    .m-label.sel { fill: #fff8e1; stroke: rgba(90,60,0,0.85); }
    .m-path { fill: none; pointer-events: none; stroke: rgba(255,255,255,0.7); stroke-linecap: round; stroke-linejoin: round; }
    .m-dock circle { fill: #ffca28; stroke: #fff; stroke-width: 1.5px; vector-effect: non-scaling-stroke; }
    .m-dock path { fill: #4e3b00; }
    .m-pos.glide { transition: transform 1.2s linear; }
    .m-head { transition: transform 0.8s ease-out; }
    .m-zone.open { stroke: #fff; stroke-width: 2.5px; }
    .m-order circle { fill: #ffca28; stroke: rgba(60,40,0,0.8); stroke-width: 1px; vector-effect: non-scaling-stroke; }
    .m-order text { fill: #3e2c00; font-weight: 800; text-anchor: middle; dominant-baseline: central; }
    .map.zoomable { touch-action: none; cursor: grab; }
    .full-btn { position: absolute; top: 8px; right: 8px; z-index: 1; width: 32px; height: 32px; border-radius: 50%; border: none; padding: 0;
      display: grid; place-items: center; cursor: pointer; color: #fff; background: rgba(0,0,0,0.35); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
    .full-btn ha-icon { --mdc-icon-size: 18px; }
    dialog.full { width: min(100vw, 920px); max-width: 100vw; height: min(100dvh, 980px); max-height: 100dvh; padding: 0; border: none;
      border-radius: var(--ha-card-border-radius, 16px); overflow: hidden; color: var(--primary-text-color);
      background: var(--card-background-color, var(--ha-card-background, #1c1c1c)); flex-direction: column; }
    dialog.full[open] { display: flex; }
    dialog.full::backdrop { background: rgba(0,0,0,0.6); backdrop-filter: blur(3px); }
    @media (max-width: 600px) { dialog.full { width: 100vw; height: 100dvh; border-radius: 0; } }
    .f-head { display: flex; align-items: center; gap: 6px; padding: 10px 12px; }
    .f-head b { flex: 1; font-size: 16px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .f-btn { width: 38px; height: 38px; border-radius: 50%; border: none; padding: 0; display: grid; place-items: center; cursor: pointer;
      color: var(--primary-text-color); background: rgba(127,127,127,0.14); }
    .f-btn[disabled] { opacity: 0.35; cursor: default; }
    .f-btn ha-icon { --mdc-icon-size: 22px; }
    .f-map.scene.has-map { flex: 1 1 auto; min-height: 0; height: auto; aspect-ratio: auto; max-height: none; margin: 0 12px; }
    .f-body { flex: none; max-height: 45%; overflow-y: auto; padding: 12px; }
    .m-pos .m-dot { fill: #fff; stroke: var(--success-color, #43a047); stroke-width: 2px; vector-effect: non-scaling-stroke; }
    .m-arrow { fill: var(--success-color, #43a047); }
    .m-pos .m-pulse { fill: rgba(255,255,255,0.35); transform-box: fill-box; transform-origin: center; animation: pulse 1.8s ease-out infinite; }
    @keyframes pulse { from { transform: scale(0.4); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }

    /* Bereiche */
    .areas { display: flex; flex-direction: column; gap: 8px; }
    .a-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .a-head .sec-title { flex: none; }
    .a-sum { flex: 1; min-width: 0; font-size: 12px; font-weight: 600; color: var(--secondary-text-color); }
    .a-sum { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .a-clear { flex: none; width: 28px; height: 28px; border-radius: 50%; border: none; padding: 0; display: grid; place-items: center; cursor: pointer;
      color: var(--secondary-text-color); background: rgba(127,127,127,0.12); }
    .a-clear ha-icon { --mdc-icon-size: 16px; }
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
    .a-chip.open { box-shadow: inset 0 0 0 2px var(--primary-text-color); }
    .a-panel { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-radius: var(--hcc-inner-radius, 14px); background: rgba(127,127,127,0.08);
      animation: fade-in 0.25s var(--ease-out) both; }
    .p-head { display: flex; align-items: center; gap: 8px; font-size: 14px; }
    .p-head > ha-icon { --mdc-icon-size: 18px; color: var(--accent); }
    .p-head b { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .p-head small { flex: 1; color: var(--secondary-text-color); font-weight: 600; }
    .p-row { display: flex; align-items: center; gap: 8px; }
    .p-row > ha-icon { --mdc-icon-size: 19px; color: var(--secondary-text-color); flex: none; }
    .p-label { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; }
    .p-val { min-width: 70px; text-align: center; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
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
      .scene:not(.has-map) { height: 130px; }
    }
    ha-card.anim-reduced .blades, ha-card.anim-off .blades, ha-card.anim-reduced .p-mowing .bot-in, ha-card.anim-off .p-mowing .bot-in,
    ha-card.anim-off .p-mowing .bot, ha-card.anim-off .p-returning .bot, ha-card.anim-off .station .bolt, ha-card.anim-off .m-pulse,
    ha-card.anim-off .p-error .bot-in, ha-card.anim-off .m-zone.job { animation: none; }
    ha-card.anim-off .p-mowing .bot-in::after { animation: none; display: none; }
  `];
}
