import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CoverGroupCardConfig, HassEntity, HomeAssistant } from "./types";
import { localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { coverMoving, coverPosition, CoverFeature, coverSupports, skyPhase, sunInfo, UNAVAILABLE } from "./utils";
import { coverColor, coverTileGridStyles } from "./components/cover-tile";
import { DEFAULT_POSITIONS, positionChipStyles, renderPositionChips } from "./cover-card";
import "./components/cover-tile";
import "./components/gradient-slider";
import "./components/sleep-timer";
import "./cover-group-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-cover-group-card",
  name: "Modern Cover Group Card",
  description: "Mehrere Rollläden frei zusammenstellen: oben alle gemeinsam, darunter jeder einzeln – nur mit den Funktionen, die er kann (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

interface Item { entity: string; name?: string; icon?: string; st: HassEntity; }

@customElement("ha-cover-group-card")
export class HaCoverGroupCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: CoverGroupCardConfig;
  @state() private _pending?: number;
  @state() private _listOpen = true;
  /** Ziele der von hier gestarteten Fahrten (für die gleichmäßige Animation der Zeilen) */
  @state() private _targets: Record<string, number> = {};
  private _sentAt?: string;
  private _timer?: number;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-cover-group-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<CoverGroupCardConfig> {
    return {
      entities: Object.values(hass.states)
        .filter((s) => s.entity_id.startsWith("cover.") && !Array.isArray(s.attributes.entity_id))
        .slice(0, 3).map((s) => s.entity_id),
    };
  }

  public setConfig(config: CoverGroupCardConfig): void {
    if (!config || !Array.isArray(config.entities)) {
      throw new Error("ha-cover-group-card: 'entities' muss eine Liste von Rollläden sein");
    }
    const collapsedChanged = this._config?.collapsed !== config.collapsed;
    this._config = { ...config };
    if (collapsedChanged) this._listOpen = !config.collapsed;
  }

  public getCardSize(): number {
    return 3 + (this._config?.entities.length ?? 0);
  }

  public getGridOptions() {
    return { columns: 6, min_columns: 4, rows: "auto" };
  }

  private _t(key: string): string {
    return localize(this.hass, key);
  }

  private _items(): Item[] {
    const hass = this.hass!;
    return this._config!.entities
      .map((e) => (typeof e === "string" ? { entity: e } : e))
      .filter((e) => e?.entity && hass.states[e.entity])
      .map((e) => ({ ...e, st: hass.states[e.entity] }));
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this._config) return true;
    const timers = [this._config.timer_switch, this._config.timer_time].filter(Boolean) as string[];
    return this._config.entities.some((e) => {
      const id = typeof e === "string" ? e : e.entity;
      return old.states[id] !== this.hass!.states[id];
    }) || timers.some((id) => old.states[id] !== this.hass!.states[id]) || old.locale !== this.hass!.locale;
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!this._sentAt || !changed.has("hass")) return;
    const now = this._items().map((i) => i.st.last_updated).join(",");
    if (now !== this._sentAt) {
      this._sentAt = undefined;
      this._pending = undefined;
    }
    if (!this._sentAt && Object.keys(this._targets).length && !this._items().some((i) => coverMoving(i.st))) this._targets = {};
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._timer);
  }

  private _call(service: string, ids: string[], data: Record<string, unknown> = {}): void {
    if (!this.hass || !ids.length) return;
    window.dispatchEvent(new CustomEvent("haptic", { detail: "light" }));
    this._sentAt = this._items().map((i) => i.st.last_updated).join(",");
    const goal = service === "open_cover" ? 100 : service === "close_cover" ? 0 : service === "set_cover_position" ? Number(data.position) : undefined;
    const next = { ...this._targets };
    for (const id of ids) {
      if (goal == null) delete next[id];
      else next[id] = goal;
    }
    this._targets = next;
    this.hass.callService("cover", service, { entity_id: ids.length === 1 ? ids[0] : ids, ...data }).catch((err) => {
      this._pending = undefined;
      this.dispatchEvent(new CustomEvent("hass-notification", {
        detail: { message: `${this._t("card.error")}: ${err?.message ?? err}` }, bubbles: true, composed: true,
      }));
    });
  }

  private _setPosition(ids: string[], value: number, delay = 150): void {
    this._pending = value;
    clearTimeout(this._timer);
    this._timer = window.setTimeout(() => this._call("set_cover_position", ids, { position: value }), delay);
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const items = this._items();
    const available = items.filter((i) => !UNAVAILABLE.includes(i.st.state));
    const ids = (f: number) => available.filter((i) => coverSupports(i.st, f)).map((i) => i.entity);
    const positioned = available.filter((i) => coverSupports(i.st, CoverFeature.SET_POSITION));
    const known = available.map((i) => coverPosition(i.st)).filter((p): p is number => p != null);
    const avg = known.length ? Math.round(known.reduce((a, b) => a + b, 0) / known.length) : undefined;
    const pos = this._pending ?? avg;
    const openCount = known.filter((p) => p > 0).length;
    const moving = available.map((i) => coverMoving(i.st)).find(Boolean);
    const anim = this._config.animations ?? "full";
    const c = this._config;
    const sky = this._config.show_sky !== false;
    const sun = sky ? sunInfo(this.hass.states[this._config.sun_entity ?? "sun.sun"]) : undefined;
    const weather = sky && this._config.weather_entity ? this.hass.states[this._config.weather_entity]?.state : undefined;
    const night = skyPhase(sun?.elevation) === "night";
    const status = !items.length
      ? this._t("cover_group.no_covers")
      : moving
        ? this._t(`cover.${moving}`)
        : `${openCount} ${this._t("overview.of")} ${items.length} ${this._t("cover.open_short")}${avg != null ? ` · Ø ${avg} %` : ""}`;
    const btn = (f: number, service: string, icon: string, label: string) => ids(f).length
      ? html`<button class="round small" aria-label=${this._t(label)} @click=${() => { this._pending = undefined; this._call(service, ids(f)); }}>
          <ha-icon icon=${icon}></ha-icon></button>`
      : nothing;
    const posIds = positioned.map((i) => i.entity);
    return html`<ha-card class="cover-group-card compact ${(pos ?? 0) > 0 ? "active" : "off"} anim-${anim}"
      style="--hcc-accent-c:${coverColor(pos, night)};--hcc-accent:var(--accent);--glow-strength:${0.25 + ((pos ?? 0) / 100) * 0.6}">
      <div class="glow"><span class="blob b1"></span><span class="blob b2"></span></div>
      <div class="header">
        <div class="title static">
          <span class="icon-badge ${moving ? "active" : ""}" data-moving=${moving ?? nothing}>
            <ha-icon .icon=${this._config.icon ?? ((pos ?? 0) > 0 ? "mdi:window-shutter-open" : "mdi:window-shutter")}></ha-icon>
          </span>
          <span class="names">
            <span class="name">${this._config.title ?? this._t("cover_group.title")}</span>
            <span class="status">${status}</span>
          </span>
        </div>
        <div class="cover-buttons">
          ${btn(CoverFeature.OPEN, "open_cover", "mdi:arrow-up", "cover_group.open_all")}
          ${btn(CoverFeature.STOP, "stop_cover", "mdi:stop", "cover_group.stop_all")}
          ${btn(CoverFeature.CLOSE, "close_cover", "mdi:arrow-down", "cover_group.close_all")}
        </div>
      </div>
      ${posIds.length ? html`<hcc-gradient-slider class="group-slider" .min=${0} .max=${100} .value=${pos ?? 0}
        .label=${this._t("cover_group.all")} .icon=${"mdi:window-shutter-settings"} .display=${pos != null ? `${pos} %` : "–"}
        .fill=${true} .active=${(pos ?? 0) > 0} .color=${coverColor(pos, night)}
        @value-changing=${(e: CustomEvent) => (this._pending = e.detail.value)}
        @value-changed=${(e: CustomEvent) => this._setPosition(posIds, e.detail.value)}></hcc-gradient-slider>` : nothing}
      ${posIds.length && this._config.show_positions !== false
        ? renderPositionChips(this.hass, this._config.positions ?? DEFAULT_POSITIONS, pos, (p) => this._setPosition(posIds, p, 0))
        : nothing}
      ${this._config.show_covers !== false && items.length ? html`
        <button class="list-toggle" aria-expanded=${this._listOpen} @click=${() => { this._listOpen = !this._listOpen; }}>
          <span>${this._t("cover_group.covers")} · ${items.length}</span>
          <ha-icon class="chevron ${this._listOpen ? "open" : ""}" icon="mdi:chevron-down"></ha-icon>
        </button>
        <div class="collapsible ${this._listOpen ? "open" : ""}" ?inert=${!this._listOpen}>
          <div class="collapsible-inner"><div class="cover-tiles">
            ${items.map((i) => html`<hcc-cover-tile .hass=${this.hass} .entity=${i.entity} .name=${i.name} .icon=${i.icon}
              .target=${this._targets[i.entity]} .travelTime=${Number(this._config!.travel_time) || 20} .sun=${sun} .weather=${weather}></hcc-cover-tile>`)}
          </div></div>
        </div>` : nothing}
      ${c.timer_switch || c.timer_time ? html`<hcc-sleep-timer class="cover-timer" .hass=${this.hass} .switchEntity=${c.timer_switch}
        .timeEntity=${c.timer_time} .label=${this._t("cover.timer")} .offText=${this._t("card.timer_off")} .atText=${this._t("cover.timer_at")}
        .inText=${this._t("card.timer_in")} .hourText=${this._t("card.hour")} .minuteText=${this._t("card.minute")}
        .doneText=${this._t("card.done")} .icon=${"mdi:timer-outline"} .iconOff=${"mdi:timer-off-outline"}></hcc-sleep-timer>` : nothing}
    </ha-card>`;
  }

  static styles = [cardStyles, positionChipStyles, coverTileGridStyles, css`
    ha-card.cover-group-card { gap: 12px; }
    ha-card.cover-group-card .collapsible { margin-top: -12px; }
    ha-card.cover-group-card .collapsible.open { margin-top: 0; }
    ha-card.cover-group-card .blob { opacity: var(--glow-strength, 0.5); animation-play-state: paused; }
    .title.static { cursor: default; }
    .icon-badge[data-moving="opening"] ha-icon { animation: nudge-up 0.9s ease-in-out infinite; }
    .icon-badge[data-moving="closing"] ha-icon { animation: nudge-down 0.9s ease-in-out infinite; }
    @keyframes nudge-up { 0%, 100% { transform: translateY(1px); } 50% { transform: translateY(-3px); } }
    @keyframes nudge-down { 0%, 100% { transform: translateY(-1px); } 50% { transform: translateY(3px); } }
    hcc-sleep-timer.cover-timer { --hcc-timer-color: #42a5f5; }
    .cover-buttons { display: flex; gap: 6px; flex: none; }
    .round.small { width: 36px; height: 36px; }
    .round.small ha-icon { --mdc-icon-size: 18px; }
    .list-toggle { display: flex; align-items: center; justify-content: space-between; border: none; background: none; cursor: pointer;
      padding: 4px 2px; font: inherit; font-size: 12px; font-weight: 500; color: var(--secondary-text-color);
      text-transform: uppercase; letter-spacing: 0.04em; }
    .chevron { --mdc-icon-size: 18px; transition: transform 0.3s var(--ease-out); }
    .chevron.open { transform: rotate(180deg); }
  `];
}
