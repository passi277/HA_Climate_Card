import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant, PresenceCardConfig, PresencePersonConfig } from "./types";
import { localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { batteryIcon, doorDevices, doorKind, initials, isCharging, phoneSensors, UNAVAILABLE } from "./utils";
import "./presence-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-presence-card",
  name: "Modern Presence Card",
  description: "Personen mit Foto, Zuhause/Unterwegs und Handy-Akku plus Haustür (Nuki Opener: Halten zum Öffnen, Ring to Open, Klingel) (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

/** So lange muss zum Öffnen gehalten werden. */
export const HOLD_MS = 900;
/** So lange bleibt „Geklingelt“ sichtbar. */
const RANG_MS = 15 * 60_000;
const GREEN = "var(--success-color, #43a047)";
const AMBER = "var(--warning-color, #ffa000)";

interface PersonView {
  entity: string;
  st?: HassEntity;
  name: string;
  battery?: HassEntity;
  charging?: HassEntity;
}

@customElement("ha-presence-card")
export class HaPresenceCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: PresenceCardConfig;
  @state() private _holding = false;
  @state() private _tooShort = false;
  @state() private _openedAt?: number;
  @state() private _rangAt?: number;
  @state() private _now = Date.now();
  private _holdTimer?: number;
  private _hintTimer?: number;
  private _tick?: number;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-presence-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<PresenceCardConfig> {
    const ids = Object.keys(hass.states);
    return { persons: ids.filter((id) => id.startsWith("person.")).slice(0, 3), lock: ids.find((id) => id.startsWith("lock.")) };
  }

  public setConfig(config: PresenceCardConfig): void {
    if (!config || (!config.persons?.length && !config.lock)) {
      throw new Error("ha-presence-card: 'persons' und/oder 'lock' angeben");
    }
    this._config = { ...config };
  }

  public getCardSize(): number {
    return 3;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 4, rows: "auto" };
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._tick = window.setInterval(() => (this._now = Date.now()), 30_000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._tick);
    this._cancelHold();
    clearTimeout(this._hintTimer);
  }

  private _t(key: string): string {
    return localize(this.hass, `presence.${key}`);
  }

  private _persons(): PersonView[] {
    const hass = this.hass!;
    return (this._config!.persons ?? []).map((p) => {
      const cfg: PresencePersonConfig = typeof p === "string" ? { entity: p } : p;
      const st = hass.states[cfg.entity];
      const auto = cfg.battery && cfg.charging ? {} : phoneSensors(hass.states, hass.entities, st?.attributes.device_trackers ?? []);
      const battery = cfg.battery ?? auto.battery;
      const charging = cfg.charging ?? auto.charging;
      return {
        entity: cfg.entity, st,
        name: cfg.name ?? st?.attributes.friendly_name ?? cfg.entity.split(".")[1],
        battery: battery ? hass.states[battery] : undefined,
        charging: charging ? hass.states[charging] : undefined,
      };
    });
  }

  private get _lock(): HassEntity | undefined {
    return this._config?.lock ? this.hass?.states[this._config.lock] : undefined;
  }

  private _door() {
    const c = this._config!;
    const hass = this.hass!;
    const auto = c.lock ? doorDevices(hass.states, hass.entities, c.lock) : {};
    const device = c.lock ? hass.entities?.[c.lock]?.device_id : undefined;
    const kind = c.door_type && c.door_type !== "auto" ? c.door_type : doorKind(device ? hass.devices?.[device]?.model : undefined);
    const bell = c.doorbell ?? auto.doorbell;
    return { kind, doorbell: bell ? hass.states[bell] : undefined, battery: auto.battery ? hass.states[auto.battery] : undefined };
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this._config) return true;
    const ids = this._persons().flatMap((p) => [p.entity, p.battery?.entity_id, p.charging?.entity_id]);
    if (this._config.lock) {
      const d = this._door();
      ids.push(this._config.lock, d.doorbell?.entity_id, d.battery?.entity_id);
    }
    return ids.some((id) => id && old.states[id] !== this.hass!.states[id]) || old.locale !== this.hass!.locale;
  }

  protected willUpdate(changed: PropertyValues): void {
    if (!changed.has("hass") || !this._config?.lock) return;
    const old = changed.get("hass") as HomeAssistant | undefined;
    const bell = this._door().doorbell;
    if (!bell || !old) return;
    const before = old.states[bell.entity_id];
    // Klingeln merken: binary_sensor geht an bzw. Event-Entität bekommt einen neuen Zeitstempel
    if (before && before !== bell && ((bell.entity_id.startsWith("event.") && before.state !== bell.state && !UNAVAILABLE.includes(bell.state))
      || (bell.state === "on" && before.state !== "on"))) {
      this._rangAt = Date.now();
      this._now = Date.now();
    }
  }

  private _haptic(type = "light"): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: type }));
  }

  private _moreInfo(entityId: string): void {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  private _notifyError(err: any): void {
    this._haptic("failure");
    this.dispatchEvent(new CustomEvent("hass-notification", {
      detail: { message: `${localize(this.hass, "card.error")}: ${err?.message ?? err}` }, bubbles: true, composed: true,
    }));
  }

  private _since(st?: HassEntity): string {
    if (!st?.last_changed) return "";
    const min = Math.max(0, Math.floor((this._now - new Date(st.last_changed).getTime()) / 60_000));
    if (min < 1) return this._t("just_now");
    if (min < 60) return `${min} ${this._t("min")}`;
    if (min < 1440) return `${Math.floor(min / 60)} ${this._t("hours")}`;
    return `${Math.floor(min / 1440)} ${this._t("days")}`;
  }

  // ---------- Öffnen (Halten) ----------

  private _startHold(ev: PointerEvent | KeyboardEvent): void {
    if (this._config?.open_confirm === "tap" || this._holding || !this._canOpen()) return;
    if (ev instanceof PointerEvent) {
      if (ev.button !== 0) return;
      (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
    }
    this._haptic("selection");
    this._holding = true;
    this._tooShort = false;
    this._holdTimer = window.setTimeout(() => {
      this._holding = false;
      this._open();
    }, HOLD_MS);
  }

  private _endHold = (): void => {
    if (!this._holding) return;
    this._cancelHold();
    this._tooShort = true;
    clearTimeout(this._hintTimer);
    this._hintTimer = window.setTimeout(() => (this._tooShort = false), 1800);
  };

  private _cancelHold(): void {
    clearTimeout(this._holdTimer);
    this._holding = false;
  }

  private _onKey(ev: KeyboardEvent, down: boolean): void {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    if (this._config?.open_confirm === "tap") return;
    ev.preventDefault();
    if (down && !ev.repeat) this._startHold(ev);
    if (!down) this._endHold();
  }

  private _canOpen(): boolean {
    if (this._config?.open_action) return !!this.hass?.states[this._config.open_action];
    const lock = this._lock;
    return !!lock && !UNAVAILABLE.includes(lock.state);
  }

  private _open(): void {
    const c = this._config!;
    const lock = this._lock;
    let call: Promise<unknown>;
    if (c.open_action) {
      const domain = c.open_action.split(".")[0];
      call = domain === "button" || domain === "input_button"
        ? this.hass!.callService(domain, "press", { entity_id: c.open_action })
        : this.hass!.callService(domain === "scene" ? "scene" : "script", "turn_on", { entity_id: c.open_action });
    } else if (lock && ((lock.attributes.supported_features ?? 0) & 1)) {
      call = this.hass!.callService("lock", "open", { entity_id: lock.entity_id });
    } else {
      call = this.hass!.callService("lock", "unlock", { entity_id: c.lock });
    }
    this._haptic("success");
    this._openedAt = Date.now();
    this._now = Date.now();
    window.setTimeout(() => (this._now = Date.now()), 4100);
    call.catch((err) => {
      this._openedAt = undefined;
      this._notifyError(err);
    });
  }

  private _toggleLock(kind: "opener" | "lock"): void {
    const lock = this._lock;
    if (!lock || UNAVAILABLE.includes(lock.state)) return;
    this._haptic();
    // Opener: „unlocked“ = Ring to Open aktiv. Schloss: nur Abschließen per Tippen (Öffnen nur per Halten).
    const service = kind === "opener" ? (lock.state === "unlocked" ? "lock" : "unlock") : "lock";
    if (kind === "lock" && lock.state === "locked") return;
    this.hass!.callService("lock", service, { entity_id: lock.entity_id }).catch((err) => this._notifyError(err));
  }

  // ---------- Render ----------

  private _renderPerson(p: PersonView) {
    const st = p.st;
    const stateValue = st?.state ?? "unavailable";
    const home = stateValue === "home";
    const unknown = UNAVAILABLE.includes(stateValue);
    const where = home ? this._t("home") : stateValue === "not_home" ? this._t("away") : unknown ? this._t("unknown") : stateValue;
    const pic: string | undefined = st?.attributes.entity_picture;
    const showBattery = this._config!.show_battery !== false && p.battery && !UNAVAILABLE.includes(p.battery.state);
    const level = showBattery ? Math.round(Number(p.battery!.state)) : NaN;
    const charging = isCharging(p.charging) || p.battery?.attributes.is_charging === true;
    const since = this._since(st);
    return html`<button class="tile person ${home ? "home" : unknown ? "unknown" : "away"} ${pic ? "" : "no-pic"}"
      title=${`${p.name}: ${where}`} @click=${() => this._moreInfo(p.entity)}>
      ${pic ? html`<img class="photo" src=${pic} alt="" loading="lazy" draggable="false">`
        : html`<span class="avatar">${initials(p.name)}</span>`}
      <span class="shade"></span>
      ${Number.isFinite(level) ? html`<span class="battery ${level <= 20 ? "low" : ""} ${charging ? "charging" : ""}"
          title=${charging ? this._t("charging") : ""}>
          <ha-icon .icon=${batteryIcon(level, charging)}></ha-icon>${level} %</span>` : nothing}
      <span class="info">
        <span class="name">${p.name}</span>
        <span class="where"><span class="dot"></span><span class="where-text">${where}</span>${since && !unknown ? html`<span class="since">· ${since}</span>` : nothing}</span>
      </span>
    </button>`;
  }

  private _renderDoor() {
    const c = this._config!;
    const lock = this._lock;
    const { kind, doorbell, battery } = this._door();
    const unavailable = !this._canOpen();
    const opened = this._openedAt != null && this._now - this._openedAt < 4000;
    const ringing = doorbell?.state === "on";
    const rang = !ringing && this._rangAt != null && this._now - this._rangAt < RANG_MS;
    const rto = kind === "opener" && lock?.state === "unlocked";
    const tap = c.open_confirm === "tap";
    const status = opened ? this._t("opened")
      : this._holding ? this._t("keep_holding")
        : ringing ? this._t("ringing")
          : this._tooShort ? this._t("hold_longer")
            : unavailable ? this._t("unknown")
              : rang ? `${this._t("rang")} · ${Math.max(1, Math.round((this._now - this._rangAt!) / 60_000))} ${this._t("min")}`
                : this._t(tap ? "tap_to_open" : "hold_to_open");
    const color = opened ? GREEN : ringing ? AMBER : unavailable ? "var(--state-inactive-color, #8a8a8a)" : rto ? AMBER : "var(--hcc-door-color, var(--primary-color))";
    const icon = opened ? "mdi:door-open" : c.door_icon ?? (ringing ? "mdi:bell-ring" : kind === "opener" ? "mdi:door-closed-lock" : lock?.state === "unlocked" ? "mdi:lock-open-variant" : "mdi:lock");
    const lowBattery = battery?.state === "on";
    const chipLabel = kind === "opener" ? this._t("ring_to_open")
      : lock?.state === "locked" ? this._t("locked") : this._t("lock_now");
    const chipOn = kind === "opener" ? rto : lock?.state === "locked";
    return html`<div class="tile door ${opened ? "opened" : ""} ${ringing ? "ringing" : ""} ${unavailable ? "unavailable" : ""} ${this._holding ? "holding" : ""}"
      style="--dc:${color}">
      ${lowBattery ? html`<span class="door-battery" title=${this._t("battery_low")}><ha-icon icon="mdi:battery-alert-variant-outline"></ha-icon></span>` : nothing}
      <button class="door-main" ?disabled=${unavailable} aria-label=${`${c.door_name ?? this._t("door")}: ${this._t(tap ? "tap_to_open" : "hold_to_open")}`}
        @pointerdown=${(e: PointerEvent) => this._startHold(e)} @pointerup=${this._endHold} @pointercancel=${() => this._cancelHold()}
        @lostpointercapture=${this._endHold} @contextmenu=${(e: Event) => e.preventDefault()}
        @keydown=${(e: KeyboardEvent) => this._onKey(e, true)} @keyup=${(e: KeyboardEvent) => this._onKey(e, false)}
        @click=${() => { if (tap && !unavailable) this._open(); }}>
        <span class="door-ring">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle class="track" cx="50" cy="50" r="46"></circle>
            <circle class="progress" cx="50" cy="50" r="46" pathLength="100" style="transition-duration:${this._holding ? HOLD_MS : 250}ms"></circle>
          </svg>
          <ha-icon .icon=${icon}></ha-icon>
        </span>
        <span class="door-name">${c.door_name ?? this._t("door")}</span>
        <span class="door-status">${status}</span>
      </button>
      ${lock ? html`<button class="door-chip ${chipOn ? "on" : ""}" ?disabled=${UNAVAILABLE.includes(lock.state)} aria-pressed=${chipOn}
          title=${kind === "opener" ? `${this._t("ring_to_open")}: ${this._t(rto ? "on" : "off")}` : chipLabel}
          @click=${() => this._toggleLock(kind)}
          @contextmenu=${(e: Event) => { e.preventDefault(); this._moreInfo(lock.entity_id); }}>
          <ha-icon .icon=${kind === "opener" ? (rto ? "mdi:bell-check" : "mdi:bell-off-outline") : chipOn ? "mdi:lock" : "mdi:lock-outline"}></ha-icon>
          ${kind === "opener" ? html`<span class="long">${chipLabel}</span><span class="short">RTO</span>` : html`<span>${chipLabel}</span>`}
          ${kind === "opener" ? html`<span class="pill">${this._t(rto ? "on" : "off")}</span>` : nothing}
        </button>` : nothing}
    </div>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const persons = this._persons();
    const tiles = persons.length + (c.lock || c.open_action ? 1 : 0);
    const cols = Math.max(1, Math.min(c.columns ?? Math.min(tiles, 4), 6));
    return html`<ha-card class="presence anim-${c.animations ?? "full"}" style="--cols:${cols}">
      <div class="tiles">
        ${persons.map((p) => this._renderPerson(p))}
        ${c.lock || c.open_action ? this._renderDoor() : nothing}
      </div>
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.presence { padding: 10px; gap: 0; }
    .tiles { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 10px; }
    .tile { position: relative; width: 100%; height: 100%; min-height: 100px; border-radius: var(--hcc-inner-radius, 14px); overflow: hidden; container-type: inline-size;
      border: none; padding: 0; margin: 0; font: inherit; color: inherit; text-align: left; isolation: isolate; }
    button.tile { cursor: pointer; }
    button.tile:focus-visible, .door-main:focus-visible, .door-chip:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }

    /* Personen */
    .person { aspect-ratio: 4 / 5; background: color-mix(in srgb, var(--primary-color) 14%, var(--card-background-color, #fff)); }
    .photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: filter 0.6s ease, transform 0.6s var(--ease-out); }
    .person:hover .photo { transform: scale(1.04); }
    .person.away .photo, .person.unknown .photo { filter: grayscale(0.85) brightness(0.8); }
    .avatar { position: absolute; inset: 0; display: grid; place-items: center; font-size: clamp(22px, 30cqi, 44px); font-weight: 700; letter-spacing: 1px;
      color: #fff; background: linear-gradient(135deg, color-mix(in srgb, var(--primary-color) 85%, #000), color-mix(in srgb, var(--primary-color) 45%, #fff)); }
    .person.away .avatar { filter: grayscale(0.8); opacity: 0.8; }
    .shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.38) 0%, transparent 28%, transparent 48%, rgba(0,0,0,0.72) 100%); pointer-events: none; }
    .info { position: absolute; left: 0; right: 0; bottom: 0; padding: 8px 10px 9px; display: flex; flex-direction: column; gap: 1px; color: #fff;
      text-shadow: 0 1px 3px rgba(0,0,0,0.6); }
    .name { font-size: 15px; font-weight: 700; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .where { display: flex; align-items: center; gap: 5px; font-size: 12px; opacity: 0.95; min-width: 0; white-space: nowrap; }
    .where-text { overflow: hidden; text-overflow: ellipsis; }
    .since { opacity: 0.8; flex: none; }
    @container (max-width: 125px) { .since { display: none; } }
    .dot { position: relative; width: 8px; height: 8px; border-radius: 50%; flex: none; background: #9e9e9e; box-shadow: 0 0 0 1.5px rgba(255,255,255,0.7); }
    .person.home .dot { background: var(--success-color, #43a047); }
    .person.home .dot::after { content: ""; position: absolute; inset: -1.5px; border-radius: 50%; border: 2px solid var(--success-color, #43a047); animation: ping 2.4s ease-out infinite; }
    @keyframes ping { 0% { transform: scale(1); opacity: 0.9; } 70%, 100% { transform: scale(2.6); opacity: 0; } }
    .battery { position: absolute; top: 7px; right: 7px; display: inline-flex; align-items: center; gap: 2px; padding: 2px 7px 2px 4px; border-radius: 999px;
      font-size: 11.5px; font-weight: 700; color: #fff; background: rgba(0,0,0,0.42); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
    .battery ha-icon { --mdc-icon-size: 15px; }
    .battery.low { background: color-mix(in srgb, var(--error-color, #e53935) 78%, transparent); }
    .battery.charging ha-icon { color: #9cff8f; animation: charge 1.6s ease-in-out infinite; }
    @keyframes charge { 50% { opacity: 0.45; } }

    /* Haustür */
    .door { display: flex; flex-direction: column; background: color-mix(in srgb, var(--dc) 13%, var(--card-background-color, #fff));
      transition: background 0.5s; --hcc-door-color: var(--primary-color); }
    .door-main { flex: 1 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; width: 100%;
      padding: 8px 6px 2px; border: none; background: none; cursor: pointer; font: inherit; color: inherit; text-align: center;
      user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: manipulation; }
    .door-main:disabled { cursor: default; }
    .door-ring { position: relative; flex: none; width: clamp(38px, 40cqi, 60px); aspect-ratio: 1; display: grid; place-items: center; margin-bottom: 3px;
      transition: transform 0.25s var(--ease-out); }
    .holding .door-ring { transform: scale(0.94); }
    .door-ring svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
    .door-ring .track { fill: color-mix(in srgb, var(--dc) 18%, transparent); stroke: color-mix(in srgb, var(--dc) 22%, transparent); stroke-width: 5; transition: fill 0.5s, stroke 0.5s; }
    .door-ring .progress { fill: none; stroke: var(--dc); stroke-width: 6; stroke-linecap: round; stroke-dasharray: 100; stroke-dashoffset: 100;
      transition-property: stroke-dashoffset; transition-timing-function: linear; }
    .holding .door-ring .progress { stroke-dashoffset: 0; }
    .opened .door-ring .progress { stroke-dashoffset: 0; transition: none; }
    .door-ring ha-icon { --mdc-icon-size: clamp(20px, 20cqi, 28px); color: var(--dc); transition: color 0.5s; }
    .opened .door-ring ha-icon { animation: pop 0.5s var(--ease-spring); }
    @keyframes pop { 0% { transform: scale(0.6); } 100% { transform: scale(1); } }
    .ringing .door-ring::after { content: ""; position: absolute; inset: 0; border-radius: 50%; border: 3px solid var(--dc); animation: ping 1.2s ease-out infinite; }
    .ringing .door-ring ha-icon { animation: ring 0.9s ease-in-out infinite; transform-origin: 50% 15%; }
    @keyframes ring { 0%, 100% { transform: rotate(0); } 15% { transform: rotate(14deg); } 30% { transform: rotate(-12deg); } 45% { transform: rotate(8deg); } 60% { transform: rotate(-4deg); } }
    .door-name { flex: none; font-size: 14px; font-weight: 700; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .door-status { flex: none; font-size: 11px; color: var(--secondary-text-color); line-height: 1.25; max-width: 100%;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .opened .door-status, .ringing .door-status { color: var(--dc); font-weight: 600; }
    .door-chip { display: flex; align-items: center; justify-content: center; gap: 4px; margin: 0 6px 6px; padding: 4px 6px; flex: none; border: none; border-radius: 999px;
      background: rgba(127,127,127,0.14); cursor: pointer; font: inherit; font-size: 11px; font-weight: 600; color: var(--secondary-text-color);
      transition: background 0.3s, color 0.3s; min-width: 0; }
    .door-chip span:not(.pill) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .door-chip ha-icon { --mdc-icon-size: 15px; flex: none; }
    .door-chip.on { background: color-mix(in srgb, var(--dc) 22%, transparent); color: var(--primary-text-color); }
    .door-chip.on ha-icon { color: var(--dc); }
    .door-chip:disabled { opacity: 0.5; cursor: default; }
    .pill { flex: none; padding: 0 5px; border-radius: 999px; font-size: 10px; background: rgba(127,127,127,0.2); }
    .door-chip.on .pill { background: var(--dc); color: #fff; }
    .door-chip .short { display: none; }
    @container (max-width: 135px) { .door-chip .pill, .door-chip .long { display: none; } .door-chip .short { display: inline; } }
    .door-battery { position: absolute; top: 6px; right: 6px; z-index: 1; color: var(--error-color, #e53935); }
    .door-battery ha-icon { --mdc-icon-size: 18px; }

    ha-card.anim-reduced .dot::after, ha-card.anim-off .dot::after, ha-card.anim-reduced .battery ha-icon, ha-card.anim-off .battery ha-icon,
    ha-card.anim-off .door-ring ha-icon, ha-card.anim-off .door-ring::after { animation: none !important; }
    ha-card.anim-off .photo, ha-card.anim-off .door { transition: none; }
  `];
}
