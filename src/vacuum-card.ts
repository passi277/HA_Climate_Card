import { LitElement, css, html, nothing, svg, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant, VacuumCardConfig } from "./types";
import { localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { calibrationTransform, roomIcon, roomsFromMap, UNAVAILABLE, type VacuumRoom } from "./utils";
import type { ShortcutItem } from "./components/shortcut-row";
import "./components/attribute-select";
import "./components/shortcut-row";
import "./vacuum-editor";

/** vacuum supported_features */
const VF = { PAUSE: 4, STOP: 8, RETURN_HOME: 16, FAN_SPEED: 32, LOCATE: 512, START: 8192 } as const;
const vs = (st: HassEntity | undefined, f: number) => !!st && ((Number(st.attributes.supported_features) || 0) & f) !== 0;

const STATE_COLORS: Record<string, string> = {
  cleaning: "#26a69a", returning: "#42a5f5", paused: "#ffa726", error: "var(--error-color, #e53935)",
  docked: "#7e57c2", idle: "#78909c",
};

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-vacuum-card",
  name: "Modern Vacuum Card",
  description: "Saugroboter mit Live-Karte, Raumauswahl auf der Karte, Steuerung, Modi und Wartung (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

@customElement("ha-vacuum-card")
export class HaVacuumCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: VacuumCardConfig;
  @state() private _selected: number[] = [];
  @state() private _repeat = 1;
  @state() private _mapSize?: [number, number];
  @state() private _maintOpen = false;
  @state() private _sent = false;
  private _deviceCache?: { key: unknown; entity: string; ids: string[] };

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-vacuum-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<VacuumCardConfig> {
    return { entity: Object.keys(hass.states).find((id) => id.startsWith("vacuum.")) ?? "" };
  }

  public setConfig(config: VacuumCardConfig): void {
    if (!config?.entity || !config.entity.startsWith("vacuum.")) throw new Error("ha-vacuum-card: 'entity' muss vacuum.* sein");
    this._config = { ...config };
  }

  public getCardSize(): number {
    return 8;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  private _t(key: string): string {
    return localize(this.hass, key);
  }

  private get _st(): HassEntity | undefined {
    return this._config && this.hass?.states[this._config.entity];
  }

  private get _show() {
    return { map: true, rooms: true, controls: true, settings: true, shortcuts: true, maintenance: true, ...(this._config?.show ?? {}) };
  }

  /** Entitäten desselben Geräts */
  private _device(): string[] {
    const hass = this.hass;
    const id = this._config?.entity;
    if (!hass?.entities || !id) return [];
    const c = this._deviceCache;
    if (c && c.key === hass.entities && c.entity === id) return c.ids;
    const dev = hass.entities[id]?.device_id;
    const ids = dev ? Object.values(hass.entities).filter((e) => e.device_id === dev && !e.hidden).map((e) => e.entity_id).sort() : [];
    this._deviceCache = { key: hass.entities, entity: id, ids };
    return ids;
  }

  /** Kartenbild: konfiguriert, sonst eines mit Kalibrierung + Räumen (Gerät oder gleicher Name), sonst Bild des Geräts */
  private _mapEntity(): HassEntity | undefined {
    const s = this.hass!.states;
    if (this._config!.map) return s[this._config!.map];
    const name = String(this._st?.attributes.friendly_name ?? "").toLowerCase();
    const images = Object.values(s).filter((x) => x.entity_id.startsWith("image."));
    const device = new Set(this._device());
    const score = (x: HassEntity) => (x.attributes.calibration_points ? 4 : 0) + (x.attributes.rooms ? 2 : 0)
      + (device.has(x.entity_id) ? 1 : 0) + (name && String(x.attributes.friendly_name ?? "").toLowerCase().startsWith(name) ? 1 : 0);
    return images.filter((x) => score(x) >= 2 || device.has(x.entity_id)).sort((a, b) => score(b) - score(a))[0];
  }

  private _rooms(map?: HassEntity): VacuumRoom[] {
    const fromMap = roomsFromMap(map);
    const cfg = this._config!.rooms;
    if (!cfg?.length) return fromMap.map((r) => ({ ...r, icon: roomIcon(r.name) }));
    return cfg.map((r) => {
      const m = fromMap.find((x) => x.id === r.id);
      const name = r.name ?? m?.name ?? `#${r.id}`;
      return { id: r.id, name, icon: r.icon ?? roomIcon(name), box: m?.box };
    });
  }

  private _sensor(re: RegExp): HassEntity | undefined {
    return this._device().filter((id) => id.startsWith("sensor.")).map((id) => this.hass!.states[id]).find((x) => x && re.test(`${x.entity_id} ${x.attributes.friendly_name ?? ""}`));
  }

  private _battery(): number | undefined {
    const st = this._st;
    const attr = Number(st?.attributes.battery_level);
    if (Number.isFinite(attr)) return attr;
    const b = this._device().map((id) => this.hass!.states[id]).find((x) => x?.attributes.device_class === "battery" && x.entity_id.startsWith("sensor."));
    const v = Number(b?.state);
    return Number.isFinite(v) ? v : undefined;
  }

  private _selects(): HassEntity[] {
    const ids = this._config!.selects ?? this._device().filter((id) => id.startsWith("select.") && !/karte|map|rotation/i.test(id));
    return ids.map((id) => this.hass!.states[id]).filter((x): x is HassEntity => !!x && Array.isArray(x.attributes.options));
  }

  private _shortcuts(): ShortcutItem[] {
    const ids = this._config!.shortcuts ?? this._device().filter((id) => id.startsWith("button.") && !/reset|zurücksetzen|request/i.test(id));
    const prefix = String(this._st?.attributes.friendly_name ?? "");
    return ids.filter((id) => this.hass!.states[id]).map((id) => {
      const full = String(this.hass!.states[id].attributes.friendly_name ?? id);
      const name = prefix && full.startsWith(prefix + " ") ? full.slice(prefix.length + 1) : full;
      return { entity: id, name: name.charAt(0).toUpperCase() + name.slice(1), icon: /kante|edge/i.test(name) ? "mdi:border-outside" : "mdi:play-circle-outline" };
    });
  }

  /** Verbrauchsteile („verbleibend …“ in Stunden) */
  private _maintenance(): { entity: string; name: string; value: number; unit: string }[] {
    const prefix = String(this._st?.attributes.friendly_name ?? "");
    return this._device().filter((id) => id.startsWith("sensor.")).map((id) => this.hass!.states[id])
      .filter((x) => x && /verbleibend|remaining|time_left/i.test(`${x.entity_id} ${x.attributes.friendly_name ?? ""}`) && Number.isFinite(Number(x.state)))
      .map((x) => {
        let name = String(x.attributes.friendly_name ?? x.entity_id);
        if (prefix && name.startsWith(prefix + " ")) name = name.slice(prefix.length + 1);
        name = name.replace(/^(dock\s+)?verbleibende(\s+zeit)?(\s+(der|des|zum))?\s*/i, "").replace(/\s*verbleibend$/i, "").trim();
        return { entity: x.entity_id, name: name.charAt(0).toUpperCase() + name.slice(1), value: Number(x.state), unit: String(x.attributes.unit_of_measurement ?? "") };
      })
      .sort((a, b) => a.value - b.value);
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this._config) return true;
    const map = this._mapEntity()?.entity_id;
    const ids = [this._config.entity, map, ...this._device(), ...(this._config.selects ?? []), ...(this._config.shortcuts ?? [])].filter(Boolean) as string[];
    return ids.some((id) => old.states[id] !== this.hass!.states[id]) || old.locale !== this.hass!.locale;
  }

  // ---------- Aktionen ----------

  private _haptic(type = "light"): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: type }));
  }

  private _call(domain: string, service: string, data: Record<string, unknown> = {}): void {
    if (!this.hass || !this._config) return;
    this._haptic();
    this.hass.callService(domain, service, { entity_id: this._config.entity, ...data }).catch((err) => {
      this._haptic("failure");
      this.dispatchEvent(new CustomEvent("hass-notification", {
        detail: { message: `${this._t("card.error")}: ${err?.message ?? err}` }, bubbles: true, composed: true,
      }));
    });
  }

  private _toggleRoom(id: number): void {
    this._haptic("selection");
    this._selected = this._selected.includes(id) ? this._selected.filter((x) => x !== id) : [...this._selected, id];
  }

  private _cleanRooms(): void {
    if (!this._selected.length) return;
    this._call("vacuum", "send_command", { command: "app_segment_clean", params: [{ segments: this._selected, repeat: this._repeat }] });
    this._sent = true;
    window.setTimeout(() => { this._sent = false; this._selected = []; }, 2500);
  }

  private _moreInfo(entityId: string): void {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  // ---------- Darstellung ----------

  private _renderMap(map: HassEntity, rooms: VacuumRoom[]) {
    // Bild bei jeder Aktualisierung neu laden (Zustand = Zeitstempel des Bildes); data:-URLs unverändert
    const pic = map.attributes.entity_picture as string | undefined;
    const url = !pic ? undefined : pic.startsWith("data:") ? pic : `${pic}${pic.includes("?") ? "&" : "?"}v=${encodeURIComponent(map.state)}`;
    if (!url) return nothing;
    const tf = calibrationTransform(map.attributes.calibration_points);
    const size = this._mapSize;
    const boxes = tf && size ? rooms.filter((r) => r.box).map((r) => {
      const [x0, y0, x1, y1] = r.box!;
      const pts = [tf(x0, y0), tf(x1, y0), tf(x1, y1), tf(x0, y1)];
      const cx = pts.reduce((a, p) => a + p[0], 0) / 4;
      const cy = pts.reduce((a, p) => a + p[1], 0) / 4;
      const area = Math.abs((pts[1][0] - pts[0][0]) * (pts[3][1] - pts[0][1]));
      return { r, pts, cx, cy, area };
    }).sort((a, b) => b.area - a.area) : [];
    // Auf die Wohnung zuschneiden: Rahmen um alle Räume (+ Rand), sonst ganzes Bild
    let view: [number, number, number, number] | undefined;
    if (size && boxes.length) {
      const xs = boxes.flatMap((b) => b.pts.map((p) => p[0]));
      const ys = boxes.flatMap((b) => b.pts.map((p) => p[1]));
      const pad = Math.max(size[0], size[1]) * 0.03;
      const x0 = Math.max(0, Math.min(...xs) - pad);
      const y0 = Math.max(0, Math.min(...ys) - pad);
      view = [x0, y0, Math.min(size[0], Math.max(...xs) + pad) - x0, Math.min(size[1], Math.max(...ys) + pad) - y0];
    }
    return html`<div class="map">
      <img class=${view ? "probe" : ""} src=${url} alt=${map.attributes.friendly_name ?? ""} draggable="false"
        @load=${(e: Event) => { const i = e.target as HTMLImageElement; if (i.naturalWidth) this._mapSize = [i.naturalWidth, i.naturalHeight]; }} />
      ${view && size ? html`<svg class="map-svg" viewBox=${view.join(" ")} preserveAspectRatio="xMidYMid meet">
        <image href=${url} x="0" y="0" width=${size[0]} height=${size[1]}></image>
        ${boxes.map((b) => svg`<g class="room ${this._selected.includes(b.r.id) ? "sel" : ""}" data-room=${b.r.id} @click=${() => this._toggleRoom(b.r.id)}>
          <polygon points=${b.pts.map((p) => p.join(",")).join(" ")}></polygon>
          ${this._selected.includes(b.r.id) ? svg`<text x=${b.cx} y=${b.cy} font-size=${Math.max(16, view![2] / 22)}>${b.r.name}</text>` : nothing}
        </g>`)}
      </svg>` : nothing}
    </div>`;
  }

  private _renderRooms(rooms: VacuumRoom[]) {
    const n = this._selected.length;
    return html`<div class="room-chips" role="group" aria-label=${this._t("vacuum.rooms")}>
        ${rooms.map((r) => {
          const on = this._selected.includes(r.id);
          return html`<button class="room-chip ${on ? "on" : ""}" aria-pressed=${on} @click=${() => this._toggleRoom(r.id)}>
            <ha-icon .icon=${r.icon ?? "mdi:floor-plan"}></ha-icon><span>${r.name}</span></button>`;
        })}
      </div>
      ${n ? html`<div class="room-action">
        <div class="repeat" role="group" aria-label=${this._t("vacuum.repeat")}>
          ${[1, 2, 3].map((x) => html`<button class=${this._repeat === x ? "on" : ""} @click=${() => { this._repeat = x; }}>${x}×</button>`)}
        </div>
        <button class="clean ${this._sent ? "sent" : ""}" @click=${this._cleanRooms}>
          <ha-icon icon=${this._sent ? "mdi:check" : "mdi:broom"}></ha-icon>
          ${this._sent ? this._t("vacuum.started") : `${n === 1 ? this._t("vacuum.clean_room") : `${n} ${this._t("vacuum.clean_rooms")}`}`}
        </button>
        <button class="clear" aria-label=${this._t("vacuum.clear")} @click=${() => { this._selected = []; }}><ha-icon icon="mdi:close"></ha-icon></button>
      </div>` : nothing}`;
  }

  private _renderControls(st: HassEntity) {
    const cleaning = st.state === "cleaning";
    const btn = (show: boolean, icon: string, label: string, fn: () => void, cls = "") => show
      ? html`<button class="ctl ${cls}" aria-label=${this._t(label)} title=${this._t(label)} @click=${fn}><ha-icon icon=${icon}></ha-icon>
          <span>${this._t(label)}</span></button>` : nothing;
    return html`<div class="controls-row">
      ${cleaning
        ? btn(vs(st, VF.PAUSE), "mdi:pause", "vacuum.pause", () => this._call("vacuum", "pause"), "main")
        : btn(vs(st, VF.START), "mdi:play", "vacuum.start", () => this._call("vacuum", "start"), "main")}
      ${btn(vs(st, VF.STOP) && st.state !== "docked", "mdi:stop", "vacuum.stop", () => this._call("vacuum", "stop"))}
      ${btn(vs(st, VF.RETURN_HOME), "mdi:home-import-outline", "vacuum.dock", () => this._call("vacuum", "return_to_base"))}
      ${btn(vs(st, VF.LOCATE), "mdi:map-marker-radius", "vacuum.locate", () => this._call("vacuum", "locate"))}
    </div>`;
  }

  private _renderSettings(st: HassEntity) {
    const parts = [];
    const fans = (st.attributes.fan_speed_list ?? []) as string[];
    if (vs(st, VF.FAN_SPEED) && fans.length) {
      parts.push(html`<hcc-attribute-select .label=${this._t("vacuum.fan_speed")} .icon=${"mdi:fan"} .selected=${st.attributes.fan_speed}
        .dropdownThreshold=${4} .options=${fans.map((f) => ({ value: f, label: this._fmt(st, "fan_speed", f) }))}
        @option-selected=${(e: CustomEvent) => this._call("vacuum", "set_fan_speed", { fan_speed: e.detail.value })}></hcc-attribute-select>`);
    }
    for (const sel of this._selects()) {
      const prefix = String(st.attributes.friendly_name ?? "");
      const full = String(sel.attributes.friendly_name ?? sel.entity_id);
      const label = prefix && full.startsWith(prefix + " ") ? full.slice(prefix.length + 1) : full;
      parts.push(html`<hcc-attribute-select .label=${label} .icon=${sel.attributes.icon ?? "mdi:tune-variant"} .selected=${sel.state}
        .dropdownThreshold=${4} .options=${(sel.attributes.options as string[]).map((o) => ({ value: o, label: this.hass!.formatEntityState?.(sel, o) ?? o }))}
        @option-selected=${(e: CustomEvent) => { this._haptic("selection"); this.hass!.callService("select", "select_option", { entity_id: sel.entity_id, option: e.detail.value }); }}>
      </hcc-attribute-select>`);
    }
    return parts;
  }

  private _fmt(st: HassEntity, attr: string, value: string): string {
    const v = this.hass!.formatEntityAttributeValue?.(st, attr, value);
    return v && v !== value ? v : value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  }

  private _renderMaintenance() {
    const items = this._maintenance();
    if (!items.length) return nothing;
    const due = items.filter((i) => i.value <= 0);
    return html`<button class="maint-toggle ${due.length ? "due" : ""}" aria-expanded=${this._maintOpen} @click=${() => { this._maintOpen = !this._maintOpen; }}>
        <ha-icon icon=${due.length ? "mdi:wrench-clock" : "mdi:wrench-check-outline"}></ha-icon>
        <span>${due.length ? `${this._t("vacuum.maintenance_due")}: ${due.map((d) => d.name).join(", ")}` : this._t("vacuum.maintenance_ok")}</span>
        <ha-icon class="chevron ${this._maintOpen ? "open" : ""}" icon="mdi:chevron-down"></ha-icon>
      </button>
      <div class="collapsible ${this._maintOpen ? "open" : ""}" ?inert=${!this._maintOpen}><div class="collapsible-inner"><div class="maint">
        ${items.map((i) => html`<button class="maint-row ${i.value <= 0 ? "due" : ""}" @click=${() => this._moreInfo(i.entity)}>
          <span>${i.name}</span><strong>${i.value <= 0 ? this._t("vacuum.due") : `${Math.round(i.value)} ${i.unit}`}</strong></button>`)}
      </div></div></div>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const st = this._st;
    if (!st) return html`<ha-card><div class="warning">${this._t("card.entity_not_found")}: ${this._config.entity}</div></ha-card>`;
    const show = this._show;
    const map = show.map || show.rooms ? this._mapEntity() : undefined;
    const rooms = this._rooms(map);
    const battery = this._battery();
    const room = this._sensor(/aktueller_raum|current_room/i);
    const progress = this._sensor(/fortschritt|progress/i);
    const error = this._sensor(/fehler|error/i);
    const color = STATE_COLORS[st.state] ?? STATE_COLORS.idle;
    const cleaning = st.state === "cleaning";
    const status = UNAVAILABLE.includes(st.state) ? this._t("card.unavailable")
      : `${this._t(`vacuum.state_${st.state}`)}${cleaning && room && !UNAVAILABLE.includes(room.state) ? ` · ${room.state}` : ""}`;
    const pills: { icon: string; text: string; warn?: boolean }[] = [];
    if (battery != null) pills.push({ icon: battery > 80 ? "mdi:battery" : battery > 30 ? "mdi:battery-50" : "mdi:battery-alert", text: `${Math.round(battery)} %`, warn: battery < 20 });
    if (cleaning && progress && Number(progress.state) > 0) pills.push({ icon: "mdi:progress-check", text: `${Math.round(Number(progress.state))} %` });
    if (error && !/^(none|ok|unknown|unavailable|kein)/i.test(error.state)) pills.push({ icon: "mdi:alert-circle-outline", text: this.hass.formatEntityState?.(error) ?? error.state, warn: true });
    const shortcuts = show.shortcuts ? this._shortcuts() : [];
    const settings = show.settings ? this._renderSettings(st) : [];
    return html`<ha-card class="vacuum ${cleaning ? "active cleaning" : ""} anim-${this._config.animations ?? "full"}" style="--hcc-accent-c:${color};--hcc-accent:var(--accent)">
      <div class="glow"><span class="blob b1"></span><span class="blob b2"></span></div>
      <div class="header">
        <button class="title" @click=${() => this._moreInfo(st.entity_id)}>
          <span class="icon-badge ${cleaning ? "active" : ""}"><ha-icon .icon=${this._config.icon ?? (cleaning ? "mdi:robot-vacuum-variant" : "mdi:robot-vacuum")}></ha-icon></span>
          <span class="names"><span class="name">${this._config.name ?? st.attributes.friendly_name ?? st.entity_id}</span>
            <span class="status">${status}</span></span>
        </button>
      </div>
      ${pills.length ? html`<div class="pills">${pills.map((p) => html`<span class="pill ${p.warn ? "warn" : ""}"><ha-icon .icon=${p.icon}></ha-icon>${p.text}</span>`)}</div>` : nothing}
      ${show.map && map ? this._renderMap(map, rooms) : nothing}
      ${show.rooms && rooms.length ? this._renderRooms(rooms) : nothing}
      ${show.controls ? this._renderControls(st) : nothing}
      ${shortcuts.length ? html`<hcc-shortcut-row .hass=${this.hass} .items=${shortcuts}></hcc-shortcut-row>` : nothing}
      ${settings.length ? html`<div class="settings">${settings}</div>` : nothing}
      ${show.maintenance ? this._renderMaintenance() : nothing}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.vacuum { gap: 12px; }
    ha-card.vacuum .blob { opacity: 0.4; animation-play-state: paused; }
    ha-card.vacuum.cleaning .blob { animation-play-state: running; }
    ha-card.vacuum.cleaning .icon-badge ha-icon { animation: wiggle 1.6s ease-in-out infinite; }
    @keyframes wiggle { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(-8deg); } 75% { transform: rotate(8deg); } }
    .map { position: relative; border-radius: var(--hcc-inner-radius, 14px); overflow: hidden; background: rgba(127,127,127,0.08); line-height: 0; }
    .map img { width: 100%; height: auto; display: block; -webkit-user-select: none; user-select: none; }
    .map img.probe { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
    .map-svg { display: block; width: 100%; height: auto; max-height: 420px; }
    .room { cursor: pointer; }
    .room polygon { fill: transparent; stroke: transparent; stroke-width: 3; transition: fill 0.25s, stroke 0.25s; }
    .room:hover polygon { fill: color-mix(in srgb, var(--accent) 12%, transparent); stroke: color-mix(in srgb, var(--accent) 50%, transparent); }
    .room.sel polygon { fill: color-mix(in srgb, var(--accent) 30%, transparent); stroke: var(--accent); }
    .room text { fill: #fff; font-weight: 700; text-anchor: middle; dominant-baseline: central; paint-order: stroke; stroke: rgba(0,0,0,0.6); stroke-width: 4px; pointer-events: none; }
    .room-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .room-chip { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px 7px 9px; border: none; border-radius: 999px; cursor: pointer;
      font: inherit; font-size: 13px; background: rgba(127,127,127,0.12); color: var(--primary-text-color); transition: background 0.25s, box-shadow 0.25s, transform 0.2s var(--ease-spring); }
    .room-chip ha-icon { --mdc-icon-size: 16px; color: var(--secondary-text-color); }
    .room-chip:active { transform: scale(0.95); }
    .room-chip.on { background: color-mix(in srgb, var(--accent) 22%, transparent); box-shadow: inset 0 0 0 1.5px var(--accent); }
    .room-chip.on ha-icon { color: var(--accent); }
    .room-action { display: flex; align-items: center; gap: 8px; animation: slide-in 0.3s var(--ease-out) both; }
    .repeat { display: flex; padding: 3px; gap: 2px; border-radius: 999px; background: rgba(127,127,127,0.12); }
    .repeat button { border: none; background: none; border-radius: 999px; padding: 6px 10px; cursor: pointer; font: inherit; font-size: 13px; color: var(--secondary-text-color); }
    .repeat button.on { background: var(--card-background-color, #fff); color: var(--primary-text-color); font-weight: 600; }
    .clean { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: none; border-radius: 999px; padding: 10px 14px;
      cursor: pointer; font: inherit; font-size: 14px; font-weight: 600; color: #fff; background: var(--accent);
      box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 40%, transparent); transition: transform 0.2s var(--ease-spring), background 0.3s; }
    .clean:active { transform: scale(0.96); }
    .clean.sent { background: var(--success-color, #43a047); }
    .clean ha-icon { --mdc-icon-size: 18px; }
    .clear { width: 38px; height: 38px; border-radius: 50%; border: none; cursor: pointer; display: grid; place-items: center; background: rgba(127,127,127,0.14); color: var(--secondary-text-color); }
    .controls-row { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 8px; }
    .ctl { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 4px; border: none; border-radius: var(--hcc-inner-radius, 14px);
      cursor: pointer; font: inherit; font-size: 12px; color: var(--primary-text-color); background: rgba(127,127,127,0.1);
      transition: background 0.25s, transform 0.2s var(--ease-spring); }
    .ctl ha-icon { --mdc-icon-size: 22px; color: var(--accent); }
    .ctl:hover { background: color-mix(in srgb, var(--accent) 14%, transparent); }
    .ctl:active { transform: scale(0.95); }
    .ctl.main { background: var(--accent); color: #fff; box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 40%, transparent); }
    .ctl.main ha-icon { color: #fff; }
    .settings { display: flex; flex-direction: column; gap: 10px; }
    .maint-toggle { display: flex; align-items: center; gap: 8px; border: none; background: rgba(127,127,127,0.08); border-radius: var(--hcc-inner-radius, 14px);
      padding: 9px 12px; cursor: pointer; font: inherit; font-size: 13px; color: var(--secondary-text-color); text-align: left; }
    .maint-toggle span { flex: 1; }
    .maint-toggle.due { color: var(--warning-color, #fb8c00); background: color-mix(in srgb, var(--warning-color, #fb8c00) 12%, transparent); }
    .maint-toggle ha-icon { --mdc-icon-size: 18px; }
    .chevron { transition: transform 0.3s var(--ease-out); }
    .chevron.open { transform: rotate(180deg); }
    ha-card.vacuum .collapsible { margin-top: -12px; }
    ha-card.vacuum .collapsible.open { margin-top: 0; }
    .maint { display: flex; flex-direction: column; gap: 4px; }
    .maint-row { display: flex; justify-content: space-between; gap: 8px; padding: 7px 10px; border: none; border-radius: 10px; cursor: pointer;
      font: inherit; font-size: 13px; color: var(--primary-text-color); background: rgba(127,127,127,0.07); text-align: left; }
    .maint-row strong { font-variant-numeric: tabular-nums; }
    .maint-row.due strong { color: var(--warning-color, #fb8c00); }
    .warning { padding: 16px; color: var(--error-color, #db4437); }
    @media (prefers-reduced-motion: reduce) { ha-card.vacuum.cleaning .icon-badge ha-icon { animation: none; } }
  `];
}
