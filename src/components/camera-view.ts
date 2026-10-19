import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CameraCardConfig, CameraFeatures, HassEntity, HomeAssistant } from "../types";
import { getLanguage, localize } from "../localize/localize";
import { batteryIcon, cameraFeatures, UNAVAILABLE, wifiQuality } from "../utils";

/** Erkennungs-Arten mit Symbol und Farbe */
export const DETECTIONS = [
  { key: "person", icon: "mdi:account-alert", color: "#e53935" },
  { key: "vehicle", icon: "mdi:car", color: "#fb8c00" },
  { key: "animal", icon: "mdi:paw", color: "#f9a825" },
  { key: "motion", icon: "mdi:motion-sensor", color: "#1e88e5" },
] as const;

const FEATURE_KEYS: (keyof CameraFeatures)[] = ["person", "vehicle", "animal", "motion", "battery", "battery_low", "wifi", "temperature", "sleep", "light",
  "siren", "motion_switch", "tracking", "presets", "home_button", "ptz_left", "ptz_right", "ptz_up", "ptz_down", "ptz_stop"];

/** Automatisch gefundene Zuordnungen, überschrieben durch die Konfiguration */
export const resolveCamera = (hass: HomeAssistant, cfg: Partial<CameraCardConfig> & { entity: string }): CameraFeatures => {
  const auto = cfg.auto_detect === false ? {} : cameraFeatures(hass.states, hass.entities as any, cfg.entity);
  const out: CameraFeatures = {};
  for (const k of FEATURE_KEYS) {
    const v = (cfg as any)[k] ?? auto[k];
    if (v && hass.states[v]) out[k] = v;
  }
  return out;
};

export const cameraName = (hass: HomeAssistant, cfg: Partial<CameraCardConfig> & { entity: string }): string => {
  if (cfg.name) return cfg.name;
  const dev = hass.entities?.[cfg.entity]?.device_id;
  const d = dev ? hass.devices?.[dev] : undefined;
  return (d?.name_by_user ?? d?.name ?? hass.states[cfg.entity]?.attributes.friendly_name ?? cfg.entity).trim();
};

/** Bild-URL der Kamera (Standbild), mit Zeitstempel zum Neuladen */
export const snapshotUrl = (st: HassEntity | undefined, tick: number): string | undefined => {
  const pic = st?.attributes.entity_picture as string | undefined;
  if (!pic) return undefined;
  if (pic.startsWith("data:")) return pic;
  return `${pic}${pic.includes("?") ? "&" : "?"}t=${tick}`;
};

export const isActive = (st?: HassEntity): boolean => st?.state === "on";

/** Eine Kamera: Bild (live oder Standbild), Erkennung, Aktionen, Positionen, Schwenken */
@customElement("hcc-camera-view")
export class CameraView extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ attribute: false }) config?: CameraCardConfig;
  /** im Gruppen-Panel: kein eigener Name-Kopf nötig */
  @property({ type: Boolean }) embedded = false;
  @state() private _lens = 0;
  @state() private _tick = Date.now();
  @state() private _visible = false;
  @state() private _confirm?: string;
  @state() private _streamReady = !!customElements.get("ha-camera-stream");
  @state() private _refreshing = false;
  private _io?: IntersectionObserver;
  private _timer?: number;
  private _confirmTimer?: number;
  private _swipeX?: number;
  private _watched: string[] = [];

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1 || !this._watched.length) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    return !old || this._watched.some((id) => old.states[id] !== this.hass!.states[id]);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._io = new IntersectionObserver((entries) => { this._visible = entries.some((e) => e.isIntersecting); this._schedule(); });
    this._io.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._io?.disconnect();
    clearInterval(this._timer);
    clearTimeout(this._confirmTimer);
  }

  private _t(key: string): string {
    return localize(this.hass, `camera.${key}`);
  }

  private _lenses(): { entity: string; name?: string }[] {
    const c = this.config!;
    return [{ entity: c.entity }, ...(c.lenses ?? []).map((l) => (typeof l === "string" ? { entity: l } : l))];
  }

  private _current(): HassEntity | undefined {
    const lens = this._lenses()[this._lens] ?? this._lenses()[0]!;
    return this.hass?.states[lens.entity];
  }

  private _live(st?: HassEntity): boolean {
    const mode = this.config?.camera_view ?? "auto";
    if (mode === "snapshot" || !st) return false;
    return mode === "live" || (Number(st.attributes.supported_features) & 2) === 2;
  }

  /** Standbild nur auffrischen, solange die Karte sichtbar ist */
  private _schedule(): void {
    clearInterval(this._timer);
    if (!this._visible || this._live(this._current())) return;
    this._timer = window.setInterval(() => (this._tick = Date.now()), Math.max(3, this.config?.refresh_interval ?? 10) * 1000);
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has("config")) this._schedule();
    // HA lädt den Stream-Baustein erst bei Bedarf – über eine Bildkarte nachladen
    if (!this._streamReady && this._visible && this._live(this._current()) && (window as any).loadCardHelpers) {
      this._streamReady = true;
      (window as any).loadCardHelpers().then((h: any) => h.createCardElement({ type: "picture-entity", entity: this.config!.entity, camera_view: "live" }))
        .catch(() => undefined);
      customElements.whenDefined("ha-camera-stream").then(() => this.requestUpdate());
    }
  }

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

  private _toggle(id?: string): void {
    if (!id) return;
    this._haptic("selection");
    this._call("homeassistant", "toggle", { entity_id: id });
  }

  private _press(id?: string): void {
    if (!id) return;
    this._haptic();
    this._call("button", "press", { entity_id: id });
  }

  private _siren(id: string): void {
    const on = isActive(this.hass!.states[id]);
    if (!on && !this._confirmed("siren")) return;
    this._haptic("heavy");
    this._call("siren", on ? "turn_off" : "turn_on", { entity_id: id });
  }

  private async _refresh(): Promise<void> {
    const st = this._current();
    if (!st) return;
    this._haptic();
    this._refreshing = true;
    if (this.hass!.services?.blink?.trigger_camera) await this._call("blink", "trigger_camera", { entity_id: st.entity_id });
    window.setTimeout(() => { this._tick = Date.now(); this._refreshing = false; }, this.hass!.services?.blink ? 4000 : 300);
  }

  private _setLens(i: number): void {
    const n = this._lenses().length;
    this._lens = (i + n) % n;
    this._haptic("selection");
    this._schedule();
  }

  private _renderImage(st: HassEntity | undefined, f: CameraFeatures, alert: boolean) {
    const live = this._live(st) && this._visible && !!customElements.get("ha-camera-stream");
    const url = snapshotUrl(st, this._tick);
    const lenses = this._lenses();
    const unavailable = !st || UNAVAILABLE.includes(st.state);
    const sleeping = isActive(this.hass!.states[f.sleep ?? ""]);
    const ptz = f.ptz_left || f.ptz_right || f.ptz_up || f.ptz_down;
    const name = cameraName(this.hass!, this.config!);
    return html`<div class="frame ${alert ? "alert" : ""}" style="aspect-ratio:${this.config!.aspect_ratio ?? "16 / 9"}"
      @pointerdown=${(e: PointerEvent) => (this._swipeX = e.clientX)}
      @pointerup=${(e: PointerEvent) => { const dx = e.clientX - (this._swipeX ?? e.clientX); this._swipeX = undefined; if (lenses.length > 1 && Math.abs(dx) > 50) this._setLens(this._lens + (dx < 0 ? 1 : -1)); }}>
      ${unavailable ? html`<div class="empty"><ha-icon icon="mdi:cctv-off"></ha-icon><span>${this._t("unavailable")}</span></div>`
        : live ? html`<ha-camera-stream class="media" .hass=${this.hass} .stateObj=${st} muted allow-exoplayer></ha-camera-stream>`
        : url ? html`<img class="media" src=${url} alt=${name} @click=${() => this._moreInfo(st!.entity_id)} loading="lazy" />`
        : html`<div class="empty"><ha-icon icon="mdi:cctv"></ha-icon></div>`}
      <div class="shade"></div>
      <div class="top">
        ${this.embedded ? nothing : html`<span class="cam-name">${name}</span>`}
        ${live ? html`<span class="badge live"><span class="dot"></span>LIVE</span>` : nothing}
        ${sleeping ? html`<span class="badge"><ha-icon icon="mdi:sleep"></ha-icon>${this._t("sleeping")}</span>` : nothing}
        <span class="spacer"></span>
        ${this._statusBadges(f)}
        ${!this._live(st) && !unavailable ? html`<button class="icon-btn ${this._refreshing ? "spin" : ""}" aria-label=${this._t("refresh")} title=${this._t("refresh")} @click=${() => this._refresh()}>
          <ha-icon icon="mdi:camera-retake-outline"></ha-icon></button>` : nothing}
      </div>
      ${ptz ? html`<div class="ptz" aria-label="PTZ">
        ${f.ptz_up ? html`<button class="p-up" aria-label=${this._t("up")} @click=${() => this._press(f.ptz_up)}><ha-icon icon="mdi:chevron-up"></ha-icon></button>` : nothing}
        ${f.ptz_left ? html`<button class="p-left" aria-label=${this._t("left")} @click=${() => this._press(f.ptz_left)}><ha-icon icon="mdi:chevron-left"></ha-icon></button>` : nothing}
        ${f.ptz_stop ? html`<button class="p-stop" aria-label=${this._t("stop")} @click=${() => this._press(f.ptz_stop)}><ha-icon icon="mdi:stop"></ha-icon></button>` : nothing}
        ${f.ptz_right ? html`<button class="p-right" aria-label=${this._t("right")} @click=${() => this._press(f.ptz_right)}><ha-icon icon="mdi:chevron-right"></ha-icon></button>` : nothing}
        ${f.ptz_down ? html`<button class="p-down" aria-label=${this._t("down")} @click=${() => this._press(f.ptz_down)}><ha-icon icon="mdi:chevron-down"></ha-icon></button>` : nothing}
      </div>` : nothing}
      ${lenses.length > 1 ? html`<div class="lenses">${lenses.map((l, i) => html`<button class="lens ${i === this._lens ? "sel" : ""}" @click=${() => this._setLens(i)}>
        ${l.name ?? (i ? `${this._t("lens")} ${i + 1}` : this._t("wide"))}</button>`)}</div>` : nothing}
    </div>`;
  }

  private _statusBadges(f: CameraFeatures) {
    const s = this.hass!.states;
    const out = [];
    const bat = f.battery ? Number(s[f.battery]?.state) : NaN;
    const low = isActive(s[f.battery_low ?? ""]);
    if (Number.isFinite(bat)) out.push(html`<span class="badge ${bat <= 20 ? "warn" : ""}" title=${this._t("battery")}><ha-icon .icon=${batteryIcon(bat)}></ha-icon>${Math.round(bat)} %</span>`);
    else if (low) out.push(html`<span class="badge warn"><ha-icon icon="mdi:battery-alert"></ha-icon>${this._t("battery_low")}</span>`);
    const w = f.wifi ? s[f.wifi] : undefined;
    const wv = Number(w?.state);
    if (w && Number.isFinite(wv)) {
      const q = wifiQuality(wv, w.attributes.unit_of_measurement);
      out.push(html`<span class="badge ${q === "weak" ? "warn" : ""}" title="${this._t("wifi")}: ${this._t(`wifi_${q}`)}"><ha-icon .icon=${q === "very_good" ? "mdi:wifi-strength-4" : q === "good" ? "mdi:wifi-strength-3" : q === "fair" ? "mdi:wifi-strength-2" : "mdi:wifi-strength-1-alert"}></ha-icon></span>`);
    }
    const tv = f.temperature ? Number(s[f.temperature]?.state) : NaN;
    if (Number.isFinite(tv)) out.push(html`<span class="badge" title=${this._t("temperature")}><ha-icon icon="mdi:thermometer"></ha-icon>${Math.round(tv)}°</span>`);
    return out;
  }

  protected render() {
    if (!this.hass || !this.config) return nothing;
    const c = this.config;
    const s = this.hass.states;
    const f = resolveCamera(this.hass, c);
    const st = this._current();
    this._watched = [...this._lenses().map((l) => l.entity), ...Object.values(f), c.patrol].filter(Boolean) as string[];
    const dets = DETECTIONS.filter((d) => f[d.key]);
    const alert = dets.some((d) => isActive(s[f[d.key]!]));
    const presets = f.presets ? s[f.presets] : undefined;
    const options = (presets?.attributes.options as string[] | undefined) ?? [];
    const light = f.light ? s[f.light] : undefined;
    const siren = f.siren ? s[f.siren] : undefined;
    const mswitch = f.motion_switch ? s[f.motion_switch] : undefined;
    const tracking = f.tracking ? s[f.tracking] : undefined;
    const patrol = c.patrol ? s[c.patrol] : undefined;
    const lang = getLanguage(this.hass);
    const actions = [
      light ? html`<button class="act ${light.state === "on" ? "on" : ""}" style="--ac:#fbc02d" @click=${() => this._toggle(f.light)} aria-pressed=${light.state === "on"}>
        <ha-icon .icon=${light.state === "on" ? "mdi:flashlight" : "mdi:flashlight-off"}></ha-icon><span>${this._t("light")}</span></button>` : nothing,
      siren ? html`<button class="act siren ${siren.state === "on" ? "on" : ""} ${this._confirm === "siren" ? "ask" : ""}" style="--ac:#e53935" @click=${() => this._siren(f.siren!)}>
        <ha-icon icon="mdi:alarm-light"></ha-icon><span>${this._confirm === "siren" ? this._t("confirm") : siren.state === "on" ? this._t("siren_off") : this._t("siren")}</span></button>` : nothing,
      mswitch ? html`<button class="act ${mswitch.state === "on" ? "on" : ""}" style="--ac:#43a047" @click=${() => this._toggle(f.motion_switch)} aria-pressed=${mswitch.state === "on"}>
        <ha-icon .icon=${mswitch.state === "on" ? "mdi:motion-sensor" : "mdi:motion-sensor-off"}></ha-icon><span>${this._t("detection")}</span></button>` : nothing,
      tracking ? html`<button class="act ${tracking.state === "on" ? "on" : ""}" style="--ac:#26a69a" @click=${() => this._toggle(f.tracking)} aria-pressed=${tracking.state === "on"}>
        <ha-icon icon="mdi:radar"></ha-icon><span>${this._t("tracking")}</span></button>` : nothing,
      f.home_button ? html`<button class="act" style="--ac:#1e88e5" @click=${() => this._press(f.home_button)}><ha-icon icon="mdi:home-map-marker"></ha-icon><span>${this._t("home")}</span></button>` : nothing,
      patrol ? html`<button class="act ${patrol.state === "on" ? "on" : ""}" style="--ac:#29b6f6" @click=${() => { this._haptic(); this._call("script", patrol.state === "on" ? "turn_off" : "turn_on", { entity_id: c.patrol }); }}>
        <ha-icon icon="mdi:orbit-variant"></ha-icon><span>${this._t("patrol")}</span></button>` : nothing,
    ].filter((x) => x !== nothing);
    return html`<div class="cv">
      ${this._renderImage(st, f, alert)}
      ${dets.length ? html`<div class="dets" style="--dn:${dets.length}">${dets.map((d) => {
        const ds = s[f[d.key]!];
        const on = isActive(ds);
        const ago = !on && ds?.last_changed ? relTime(ds.last_changed, lang) : "";
        return html`<button class="det ${on ? "on" : ""}" style="--dc:${d.color}" @click=${() => this._moreInfo(f[d.key])} title=${ago}>
          <ha-icon .icon=${d.icon}></ha-icon><span>${this._t(d.key)}</span></button>`;
      })}</div>` : nothing}
      ${actions.length ? html`<div class="acts" style="--n:${Math.min(actions.length, 4)}">${actions}</div>` : nothing}
      ${options.length ? html`<div class="presets"><ha-icon icon="mdi:crosshairs-gps"></ha-icon>${options.map((o) => html`<button class="preset ${presets!.state === o ? "sel" : ""}"
        @click=${() => { this._haptic("selection"); this._call(f.presets!.split(".")[0]!, "select_option", { entity_id: f.presets, option: o }); }}>${o}</button>`)}</div>` : nothing}
    </div>`;
  }

  static styles = css`
    :host { display: block; --ease: cubic-bezier(0.22, 1, 0.36, 1); }
    button { font: inherit; color: inherit; }
    .cv { display: flex; flex-direction: column; gap: 10px; container-type: inline-size; }
    .frame { position: relative; width: 100%; border-radius: var(--hcc-inner-radius, 14px); overflow: hidden; background: #111; isolation: isolate; touch-action: pan-y; }
    .frame.alert { box-shadow: 0 0 0 2px #e53935; animation: alert 1.6s ease-in-out infinite; }
    @keyframes alert { 50% { box-shadow: 0 0 0 4px rgba(229,57,53,0.35); } }
    .media { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; cursor: pointer; }
    ha-camera-stream.media { --video-max-height: 100%; }
    .empty { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: rgba(255,255,255,0.6); font-size: 13px; }
    .empty ha-icon { --mdc-icon-size: 40px; }
    .shade { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, rgba(0,0,0,0.55), transparent 32%, transparent 70%, rgba(0,0,0,0.45)); }
    .top { position: absolute; left: 10px; right: 10px; top: 8px; display: flex; align-items: center; gap: 6px; color: #fff; pointer-events: none; }
    .top > * { pointer-events: auto; }
    .cam-name { font-size: 15px; font-weight: 700; text-shadow: 0 1px 4px rgba(0,0,0,0.5); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
    .spacer { flex: 1; }
    .badge { flex: none; display: inline-flex; align-items: center; gap: 3px; padding: 3px 7px; border-radius: 999px; font-size: 11.5px; font-weight: 700;
      background: rgba(0,0,0,0.42); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
    .badge ha-icon { --mdc-icon-size: 14px; }
    .badge.warn { color: #ffcdd2; background: rgba(229,57,53,0.55); }
    .badge.live { background: rgba(229,57,53,0.85); letter-spacing: 0.04em; }
    .badge.live .dot { width: 6px; height: 6px; border-radius: 50%; background: #fff; animation: blink 1.4s ease-in-out infinite; }
    @keyframes blink { 50% { opacity: 0.3; } }
    .icon-btn { flex: none; width: 30px; height: 30px; border-radius: 50%; border: none; padding: 0; display: grid; place-items: center; cursor: pointer; color: #fff;
      background: rgba(0,0,0,0.42); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
    .icon-btn ha-icon { --mdc-icon-size: 18px; }
    .icon-btn.spin ha-icon { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .ptz { position: absolute; right: 10px; bottom: 10px; display: grid; grid-template-columns: repeat(3, 34px); grid-template-rows: repeat(3, 34px); gap: 2px; }
    .ptz button { width: 34px; height: 34px; border-radius: 50%; border: none; padding: 0; display: grid; place-items: center; cursor: pointer; color: #fff;
      background: rgba(0,0,0,0.42); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); transition: transform 0.15s, background 0.2s; }
    .ptz button:active { transform: scale(0.88); background: rgba(41,182,246,0.8); }
    .ptz ha-icon { --mdc-icon-size: 22px; }
    .p-up { grid-area: 1 / 2; } .p-left { grid-area: 2 / 1; } .p-stop { grid-area: 2 / 2; } .p-right { grid-area: 2 / 3; } .p-down { grid-area: 3 / 2; }
    .p-stop ha-icon { --mdc-icon-size: 16px; }
    .lenses { position: absolute; left: 10px; bottom: 10px; display: flex; gap: 4px; padding: 3px; border-radius: 999px; background: rgba(0,0,0,0.42);
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
    .lens { border: none; border-radius: 999px; padding: 4px 10px; cursor: pointer; font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.8); background: none; }
    .lens.sel { color: #111; background: #fff; }
    .dets { display: grid; grid-template-columns: repeat(var(--dn, 4), minmax(0, 1fr)); gap: 6px; }
    @container (max-width: 420px) { .dets { grid-template-columns: repeat(min(var(--dn, 4), 2), minmax(0, 1fr)); } }
    .det { min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 7px 6px; border: none; border-radius: 999px;
      cursor: pointer; font-size: 12.5px; font-weight: 600; color: var(--secondary-text-color); background: rgba(127,127,127,0.1); transition: background 0.3s, color 0.3s; white-space: nowrap; }
    .det ha-icon { --mdc-icon-size: 16px; }
    .det span { overflow: hidden; text-overflow: ellipsis; }
    .det.on { color: #fff; background: var(--dc); animation: pop 0.4s var(--ease); }
    @keyframes pop { 0% { transform: scale(0.9); } 60% { transform: scale(1.06); } 100% { transform: none; } }
    .acts { display: grid; grid-template-columns: repeat(auto-fit, minmax(86px, 1fr)); gap: 6px; }
    .act { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 9px 4px; border: none; border-radius: var(--hcc-inner-radius, 14px); cursor: pointer;
      font-size: 12px; font-weight: 600; background: rgba(127,127,127,0.1); transition: background 0.3s, color 0.3s, transform 0.2s; min-width: 0; }
    .act span { max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .act:active { transform: scale(0.95); }
    .act ha-icon { --mdc-icon-size: 22px; color: var(--ac); }
    .act.on { background: color-mix(in srgb, var(--ac) 18%, transparent); }
    .act.ask, .act.siren.on { color: #fff; background: var(--ac); }
    .act.ask ha-icon, .act.siren.on ha-icon { color: #fff; }
    .act.siren.on ha-icon { animation: blink 0.8s ease-in-out infinite; }
    .presets { display: flex; align-items: center; gap: 6px; overflow-x: auto; scrollbar-width: none; margin: 0 -4px; padding: 2px 4px; }
    .presets::-webkit-scrollbar { display: none; }
    .presets > ha-icon { flex: none; --mdc-icon-size: 18px; color: var(--secondary-text-color); }
    .preset { flex: none; padding: 6px 11px; border: none; border-radius: 999px; cursor: pointer; font-size: 12.5px; font-weight: 600; white-space: nowrap;
      color: var(--secondary-text-color); background: rgba(127,127,127,0.1); }
    .preset.sel { color: #fff; background: var(--primary-color); }
  `;
}

/** „vor 5 min“ */
export const relTime = (iso: string, lang: string): string => {
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!Number.isFinite(sec)) return "";
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  if (sec < 60) return rtf.format(-Math.round(sec), "second");
  if (sec < 3600) return rtf.format(-Math.round(sec / 60), "minute");
  if (sec < 86400) return rtf.format(-Math.round(sec / 3600), "hour");
  return rtf.format(-Math.round(sec / 86400), "day");
};
