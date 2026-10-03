import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CoverCardConfig, CoverShowConfig, HassEntity, HomeAssistant } from "./types";
import { localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { coverIcon, coverMoving, coverPosition, CoverFeature, coverSupports, skyPhase, sunInfo, UNAVAILABLE } from "./utils";
import { coverColor, coverGlide, coverStatus, coverTileGridStyles } from "./components/cover-tile";
import "./components/cover-tile";
import "./components/cover-window";
import "./components/gradient-slider";
import "./cover-editor";

const DEFAULT_COVER_SHOW: Required<CoverShowConfig> = { covers: true, positions: true, tilt: true, sky: true };
export const DEFAULT_POSITIONS = [0, 25, 50, 75, 100];

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-cover-card",
  name: "Modern Cover Card",
  description: "Rollläden im Modern-Home-Design: Fenster zum Ziehen, Auf/Stopp/Ab, Schnellwahl, Lamellen und Rollläden einer Gruppe (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

/** Schnellwahl-Chips: „Zu“, „25 %“, …, „Auf“. */
export const renderPositionChips = (
  hass: HomeAssistant, positions: number[], current: number | undefined, onPick: (p: number) => void,
) => html`<div class="positions" role="group" aria-label=${localize(hass, "cover.positions")}>
  ${positions.map((p) => {
    const label = p <= 0 ? localize(hass, "cover.close_short") : p >= 100 ? localize(hass, "cover.open_short_btn") : `${p} %`;
    const on = current != null && Math.abs(current - p) <= 2;
    return html`<button class="pos ${on ? "on" : ""}" aria-pressed=${on} @click=${() => onPick(p)}>${label}</button>`;
  })}
</div>`;

export const positionChipStyles = css`
  .positions { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
  .positions::-webkit-scrollbar { display: none; }
  .pos { flex: 1 0 auto; border: none; border-radius: 999px; padding: 7px 12px; font: inherit; font-size: 13px; cursor: pointer;
    background: rgba(127,127,127,0.12); color: var(--primary-text-color); transition: background 0.3s, color 0.3s, transform 0.2s var(--ease-spring); }
  .pos:hover { background: color-mix(in srgb, var(--accent) 20%, transparent); }
  .pos:active { transform: scale(0.94); }
  .pos.on { background: var(--accent); color: rgba(0,0,0,0.75); font-weight: 600;
    box-shadow: 0 3px 10px color-mix(in srgb, var(--accent) 35%, transparent); }
`;

interface Member { entity: string; name: string; icon?: string; }

@customElement("ha-cover-card")
export class HaCoverCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: CoverCardConfig;
  @state() private _pending?: number;
  @state() private _pendingTilt?: number;
  @state() private _expanded = false;
  @state() private _syncing = false;
  /** Ziel der selbst gestarteten Fahrt (für die gleichmäßige Animation) */
  @state() private _target?: number;
  private _timer?: number;
  private _sentAt?: string;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-cover-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<CoverCardConfig> {
    const covers = Object.keys(hass.states).filter((id) => id.startsWith("cover."));
    return { entity: covers.find((id) => Array.isArray(hass.states[id].attributes.entity_id)) ?? covers[0] ?? "" };
  }

  public setConfig(config: CoverCardConfig): void {
    if (!config?.entity || !config.entity.startsWith("cover.")) {
      throw new Error("ha-cover-card: 'entity' muss eine cover-Entität sein (cover.xyz)");
    }
    const startChanged = this._config?.start_expanded !== config.start_expanded;
    this._config = { layout: "full", ...config };
    if (startChanged) this._expanded = !!config.start_expanded;
  }

  public getCardSize(): number {
    return this._config?.layout === "compact" ? 3 : 7;
  }

  public getGridOptions() {
    return { columns: 6, min_columns: 4, rows: "auto" };
  }

  private get _show(): Required<CoverShowConfig> {
    return { ...DEFAULT_COVER_SHOW, ...(this._config?.show ?? {}) };
  }

  private get _st(): HassEntity | undefined {
    return this._config && this.hass?.states[this._config.entity];
  }

  private _t(key: string): string {
    return localize(this.hass, key);
  }

  private _members(): Member[] {
    const c = this._config!;
    const st = this._st;
    const list = c.entities
      ?? (c.auto_entities !== false && Array.isArray(st?.attributes.entity_id) ? st!.attributes.entity_id as string[] : []);
    const group = String(st?.attributes.friendly_name ?? "").trim();
    return list.map((e) => (typeof e === "string" ? { entity: e } : e))
      .filter((m) => this.hass!.states[m.entity] && m.entity !== c.entity)
      .map((m) => {
        const full = String(this.hass!.states[m.entity].attributes.friendly_name ?? m.entity).trim();
        const short = group && full.toLowerCase().startsWith(group.toLowerCase() + " ") ? full.slice(group.length + 1) : full;
        return { entity: m.entity, icon: (m as Member).icon, name: (m as Member).name ?? short.charAt(0).toUpperCase() + short.slice(1) };
      });
  }

  private get _sunEntity(): string {
    return this._config?.sun_entity ?? "sun.sun";
  }

  private get _travel(): number {
    return Number(this._config?.travel_time) || 20;
  }

  private _openContacts(): HassEntity[] {
    return (this._config?.contact_sensors ?? []).map((id) => this.hass!.states[id]).filter((s): s is HassEntity => s?.state === "on");
  }

  private _watched(): string[] {
    const c = this._config;
    if (!c) return [];
    return [c.entity, ...(c.contact_sensors ?? []), ...this._members().map((m) => m.entity),
      ...(this._show.sky ? [this._sunEntity, c.weather_entity ?? ""] : [])].filter(Boolean);
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this._config) return true;
    return this._watched().some((id) => old.states[id] !== this.hass!.states[id]) || old.locale !== this.hass!.locale;
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    const st = this._st;
    if (st && this._sentAt && st.last_updated !== this._sentAt) {
      this._sentAt = undefined;
      this._pending = undefined;
      this._pendingTilt = undefined;
      this._syncing = false;
    }
    if (st && !this._sentAt && !coverMoving(st) && this._target != null) this._target = undefined;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._timer);
  }

  // ---------- Aktionen ----------

  private _haptic(type = "light"): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: type }));
  }

  private _call(service: string, data: Record<string, unknown> = {}): void {
    const st = this._st;
    if (!this.hass || !st) return;
    if (!service.includes("tilt")) {
      this._target = service === "open_cover" ? 100 : service === "close_cover" ? 0
        : service === "set_cover_position" ? Number(data.position) : undefined;
    }
    this._sentAt = st.last_updated;
    this._syncing = true;
    window.setTimeout(() => (this._syncing = false), 5000);
    this.hass.callService("cover", service, { entity_id: st.entity_id, ...data }).catch((err) => {
      this._syncing = false;
      this._pending = undefined;
      this._haptic("failure");
      this.dispatchEvent(new CustomEvent("hass-notification", {
        detail: { message: `${this._t("card.error")}: ${err?.message ?? err}` }, bubbles: true, composed: true,
      }));
    });
  }

  private _setPosition(value: number, delay = 150): void {
    this._pending = value;
    clearTimeout(this._timer);
    this._timer = window.setTimeout(() => this._call("set_cover_position", { position: value }), delay);
  }

  private _moreInfo(entityId: string): void {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  // ---------- Darstellung ----------

  private _renderButtons(st: HassEntity, pos: number | undefined, small = false) {
    const moving = coverMoving(st);
    const can = (f: number) => !UNAVAILABLE.includes(st.state) && coverSupports(st, f);
    const btn = (f: number, service: string, icon: string, label: string, disabled = false, on = false) => can(f)
      ? html`<button class="round ${small ? "small" : ""} ${on ? "moving" : ""}" aria-label=${this._t(label)} ?disabled=${disabled}
          @click=${() => { this._haptic(); this._pending = undefined; this._call(service); }}><ha-icon icon=${icon}></ha-icon></button>`
      : nothing;
    return html`<div class="cover-buttons ${small ? "small" : ""}">
      ${btn(CoverFeature.OPEN, "open_cover", "mdi:arrow-up", "cover.open_action", pos === 100 && !moving, moving === "opening")}
      ${btn(CoverFeature.STOP, "stop_cover", "mdi:stop", "cover.stop")}
      ${btn(CoverFeature.CLOSE, "close_cover", "mdi:arrow-down", "cover.close_action", pos === 0 && !moving, moving === "closing")}
    </div>`;
  }

  private _renderPills(st: HassEntity) {
    const pills: { icon: string; text: string; warn?: boolean }[] = [];
    const open = this._openContacts();
    if (open.length) {
      pills.push({ icon: "mdi:window-open-variant", warn: true,
        text: `${open.length === 1 ? String(open[0].attributes.friendly_name ?? open[0].entity_id) : `${open.length}`} ${this._t("cover.contact_open")}` });
    }
    const tilt = st.attributes.current_tilt_position;
    if (tilt != null && this._show.tilt) pills.push({ icon: "mdi:angle-acute", text: `${this._t("cover.tilt")} ${Math.round(Number(tilt))} %` });
    if (!pills.length) return nothing;
    return html`<div class="pills">${pills.map((p) => html`<span class="pill ${p.warn ? "warn" : ""}"><ha-icon .icon=${p.icon}></ha-icon>${p.text}</span>`)}</div>`;
  }

  private _renderTilt(st: HassEntity) {
    if (!this._show.tilt || UNAVAILABLE.includes(st.state)) return nothing;
    if (coverSupports(st, CoverFeature.SET_TILT_POSITION)) {
      const value = this._pendingTilt ?? Math.round(Number(st.attributes.current_tilt_position ?? 0));
      return html`<hcc-gradient-slider .min=${0} .max=${100} .value=${value} .label=${this._t("cover.tilt")} .icon=${"mdi:angle-acute"}
        .display=${`${value} %`} .fill=${true} .active=${value > 0} .color=${"var(--accent)"}
        @value-changing=${(e: CustomEvent) => (this._pendingTilt = e.detail.value)}
        @value-changed=${(e: CustomEvent) => { this._pendingTilt = e.detail.value; this._call("set_cover_tilt_position", { tilt_position: e.detail.value }); }}>
      </hcc-gradient-slider>`;
    }
    if (coverSupports(st, CoverFeature.OPEN_TILT) || coverSupports(st, CoverFeature.CLOSE_TILT)) {
      return html`<div class="tilt-row"><span class="row-label"><ha-icon icon="mdi:angle-acute"></ha-icon>${this._t("cover.tilt")}</span>
        <div class="cover-buttons small">
          ${coverSupports(st, CoverFeature.OPEN_TILT) ? html`<button class="round small" aria-label=${this._t("cover.tilt_open")}
            @click=${() => this._call("open_cover_tilt")}><ha-icon icon="mdi:arrow-top-right"></ha-icon></button>` : nothing}
          ${coverSupports(st, CoverFeature.STOP_TILT) ? html`<button class="round small" aria-label=${this._t("cover.stop")}
            @click=${() => this._call("stop_cover_tilt")}><ha-icon icon="mdi:stop"></ha-icon></button>` : nothing}
          ${coverSupports(st, CoverFeature.CLOSE_TILT) ? html`<button class="round small" aria-label=${this._t("cover.tilt_close")}
            @click=${() => this._call("close_cover_tilt")}><ha-icon icon="mdi:arrow-bottom-left"></ha-icon></button>` : nothing}
        </div></div>`;
    }
    return nothing;
  }

  private _renderExpand() {
    return html`<button class="expand" @click=${() => { this._expanded = !this._expanded; }} aria-expanded=${this._expanded}>
      <span>${this._t(this._expanded ? "card.less" : "card.more")}</span>
      <ha-icon class="chevron" icon="mdi:chevron-down"></ha-icon>
    </button>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const st = this._st;
    if (!st) return html`<ha-card><div class="warning">${this._t("card.entity_not_found")}: ${this._config.entity}</div></ha-card>`;
    const c = this._config;
    const name = c.name ?? st.attributes.friendly_name ?? st.entity_id;
    const unavailable = UNAVAILABLE.includes(st.state);
    const pos = this._pending ?? coverPosition(st);
    const moving = coverMoving(st);
    const sun = this._show.sky ? sunInfo(this.hass.states[this._sunEntity]) : undefined;
    const night = skyPhase(sun?.elevation) === "night";
    const weather = this._show.sky && c.weather_entity ? this.hass.states[c.weather_entity]?.state : undefined;
    const glide = this._pending == null ? coverGlide(st, pos, this._target, this._travel) : { value: pos, glide: undefined };
    const settable = coverSupports(st, CoverFeature.SET_POSITION) && !unavailable;
    const members = this._show.covers ? this._members() : [];
    const openMembers = members.filter((m) => (coverPosition(this.hass!.states[m.entity]) ?? 0) > 0).length;
    const compact = c.layout === "compact";
    const anim = c.animations ?? "full";
    const status = `${coverStatus(this.hass, st, pos)}${members.length ? ` · ${openMembers}/${members.length} ${this._t("cover.open_short")}` : ""}`;
    const chips = this._show.positions && settable
      ? renderPositionChips(this.hass, c.positions ?? DEFAULT_POSITIONS, pos, (p) => { this._haptic("selection"); this._setPosition(p, 0); })
      : nothing;
    const tilt = this._renderTilt(st);
    const membersTpl = members.length
      ? html`<div class="cover-tiles">${members.map((m) => html`<hcc-cover-tile .hass=${this.hass} .entity=${m.entity} .name=${m.name} .icon=${m.icon}
          .target=${this._target} .travelTime=${this._travel} .sun=${sun} .weather=${weather}></hcc-cover-tile>`)}</div>`
      : nothing;
    const details = compact ? [chips, tilt, membersTpl] : [tilt];
    const hasDetails = details.some((d) => d !== nothing);
    const expandable = c.expandable !== false && hasDetails;
    return html`<ha-card class="cover-card ${compact ? "compact" : "full"} ${(pos ?? 0) > 0 ? "active" : "off"} ${moving ? "moving" : ""} anim-${anim}"
      style="--hcc-accent-c:${coverColor(pos, night)};--hcc-accent:var(--accent);--glow-strength:${0.25 + ((pos ?? 0) / 100) * 0.6}">
      <div class="glow"><span class="blob b1"></span><span class="blob b2"></span></div>
      <div class="header">
        <button class="title" @click=${() => this._moreInfo(st.entity_id)}>
          <span class="icon-badge ${moving ? "active" : ""}" data-moving=${moving ?? nothing}>
            <ha-icon .icon=${c.icon ?? coverIcon(st)}></ha-icon>
          </span>
          <span class="names">
            <span class="name">${name}</span>
            <span class="status">${this._syncing ? html`<span class="sync"></span>` : nothing}${status}</span>
          </span>
        </button>
        ${compact ? this._renderButtons(st, pos, true) : nothing}
      </div>
      ${this._renderPills(st)}
      ${compact
        ? settable ? html`<hcc-gradient-slider .min=${0} .max=${100} .label=${this._t("cover.position")}
            .icon=${"mdi:window-shutter-settings"} .display=${pos != null ? `${pos} %` : "–"} .fill=${true} .active=${(pos ?? 0) > 0}
            .value=${glide.value ?? 0} .glide=${glide.glide}
            .color=${coverColor(pos, night)}
            @value-changing=${(e: CustomEvent) => (this._pending = e.detail.value)}
            @value-changed=${(e: CustomEvent) => this._setPosition(e.detail.value)}></hcc-gradient-slider>` : nothing
        : html`<div class="stage">
            <hcc-cover-window .position=${pos} .moving=${this._pending == null ? moving : undefined} .target=${this._target}
              .travelTime=${this._travel} .sun=${sun} .weather=${weather} .settable=${settable} .disabled=${unavailable} .label=${name}
              @value-changing=${(e: CustomEvent) => { this._pending = e.detail.value; this._haptic("selection"); }}
              @value-changed=${(e: CustomEvent) => this._setPosition(e.detail.value, 0)}></hcc-cover-window>
            <div class="readout">
              <span class="dial-big" data-pop="position">${pos != null ? pos : "–"}<sup>%</sup></span>
              <span class="dial-label">${this._t("cover.open_short")}</span>
              ${moving && this._target != null ? html`<span class="goal"><ha-icon icon="mdi:arrow-right"></ha-icon>${this._target} %</span>` : nothing}
            </div>
          </div>
          ${this._renderButtons(st, pos)}
          <div class="controls">${chips}${membersTpl}</div>`}
      ${hasDetails ? expandable
        ? html`<div class="collapsible ${this._expanded ? "open" : ""}" ?inert=${!this._expanded}><div class="collapsible-inner"><div class="controls">${details}</div></div></div>
               ${this._renderExpand()}`
        : html`<div class="controls">${details}</div>` : nothing}
    </ha-card>`;
  }

  static styles = [cardStyles, positionChipStyles, coverTileGridStyles, css`
    ha-card.cover-card .blob { opacity: var(--glow-strength, 0.5); }
    ha-card.cover-card:not(.moving) .blob { animation-play-state: paused; }
    .icon-badge[data-moving="opening"] ha-icon { animation: nudge-up 0.9s ease-in-out infinite; }
    .icon-badge[data-moving="closing"] ha-icon { animation: nudge-down 0.9s ease-in-out infinite; }
    @keyframes nudge-up { 0%, 100% { transform: translateY(1px); } 50% { transform: translateY(-3px); } }
    @keyframes nudge-down { 0%, 100% { transform: translateY(-1px); } 50% { transform: translateY(3px); } }
    .stage { position: relative; display: flex; flex-direction: column; align-items: center; gap: 10px; padding-top: 4px; }
    .readout { display: flex; align-items: baseline; gap: 8px; }
    .goal { display: inline-flex; align-items: center; gap: 2px; font-size: 13px; font-weight: 600; color: var(--accent);
      padding: 2px 8px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 14%, transparent); animation: slide-in 0.4s var(--ease-out) both; }
    .goal ha-icon { --mdc-icon-size: 14px; }
    .cover-buttons { display: flex; justify-content: center; gap: 16px; }
    .cover-buttons.small { gap: 6px; flex: none; }
    .round.small { width: 36px; height: 36px; }
    .round.small ha-icon { --mdc-icon-size: 18px; }
    .round:disabled { opacity: 0.35; cursor: default; transform: none; }
    .round.moving { background: var(--accent); color: rgba(0,0,0,0.75);
      box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 45%, transparent); }
    .members { display: flex; flex-direction: column; gap: 8px; }
    .tilt-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .row-label { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: var(--secondary-text-color);
      text-transform: uppercase; letter-spacing: 0.04em; }
    .row-label ha-icon { --mdc-icon-size: 16px; }
  `];
}
