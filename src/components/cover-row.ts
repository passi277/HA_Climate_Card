import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant } from "../types";
import { localize } from "../localize/localize";
import { coverIcon, coverMoving, coverPosition, CoverFeature, coverSupports, UNAVAILABLE } from "../utils";
import "./gradient-slider";

export const COVER_OPEN_COLOR = "#ffb74d";
export const COVER_CLOSED_COLOR = "#6b8bab";

export const COVER_NIGHT_COLOR = "#9fb4ff";

/** Akzentfarbe nach Öffnung: geschlossen kühles Blaugrau → offen warmes Tageslicht (nachts Mondlicht). */
export const coverColor = (pos?: number, night = false): string =>
  pos == null ? "var(--state-cover-off-color, #8a8a8a)"
    : `color-mix(in srgb, ${night ? COVER_NIGHT_COLOR : COVER_OPEN_COLOR} ${Math.round(pos)}%, ${COVER_CLOSED_COLOR})`;

/** Wert und Gleitdauer eines Positionsreglers während der Fahrt (gleichmäßig zum Ziel). */
export const coverGlide = (st: HassEntity, pos: number | undefined, target: number | undefined, travelTime: number) => {
  const moving = coverMoving(st);
  if (!moving || pos == null) return { value: pos, glide: undefined };
  const goal = target ?? (moving === "opening" ? 100 : 0);
  return { value: goal, glide: Math.max(0.6, (Math.abs(goal - pos) / 100) * Math.max(1, travelTime)) };
};

/** Statustext: „Öffnet …“, „Geschlossen“, „29 % offen“, „Offen“. */
export const coverStatus = (hass: HomeAssistant, st: HassEntity, pos = coverPosition(st)): string => {
  const t = (k: string) => localize(hass, k);
  if (UNAVAILABLE.includes(st.state)) return t("card.unavailable");
  const moving = coverMoving(st);
  if (moving) return `${t(`cover.${moving}`)}${pos != null && coverSupports(st, CoverFeature.SET_POSITION) ? ` · ${pos} %` : ""}`;
  if (pos == null) return st.state;
  if (pos <= 0) return t("cover.closed");
  if (pos >= 100) return t("cover.open");
  return `${pos} % ${t("cover.open_short")}`;
};

/** Eine Rollladen-Zeile: Symbol, Name, Status, Positionsregler (falls möglich) und Auf/Stopp/Ab (falls möglich). */
@customElement("hcc-cover-row")
export class CoverRow extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property() entity = "";
  @property() name?: string;
  @property() icon?: string;
  /** Ziel einer von außen (z.B. Gruppenkarte) gestarteten Fahrt */
  @property({ type: Number }) target?: number;
  /** Fahrzeit 0 → 100 % in Sekunden */
  @property({ type: Number }) travelTime = 20;
  @state() private _pending?: number;
  /** Ziel der selbst gestarteten Fahrt */
  private _target?: number;
  private _sentAt?: string;
  private _timer?: number;

  private get _st(): HassEntity | undefined {
    return this.hass?.states[this.entity];
  }

  protected updated(changed: PropertyValues): void {
    const st = this._st;
    if (changed.has("hass") && st && this._sentAt && st.last_updated !== this._sentAt) {
      this._sentAt = undefined;
      this._pending = undefined;
    }
    if (changed.has("hass") && st && !coverMoving(st) && this._target != null && !this._sentAt) this._target = undefined;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._timer);
  }

  private _call(service: string, data: Record<string, unknown> = {}): void {
    if (!this.hass) return;
    this._target = service === "open_cover" ? 100 : service === "close_cover" ? 0
      : service === "set_cover_position" ? Number(data.position) : undefined;
    this._sentAt ??= this._st?.last_updated;
    window.dispatchEvent(new CustomEvent("haptic", { detail: "light" }));
    this.hass.callService("cover", service, { entity_id: this.entity, ...data }).catch((err) => {
      this._pending = undefined;
      this.dispatchEvent(new CustomEvent("hass-notification", {
        detail: { message: `${localize(this.hass, "card.error")}: ${err?.message ?? err}` }, bubbles: true, composed: true,
      }));
    });
  }

  private _setPosition(value: number): void {
    this._pending = value;
    clearTimeout(this._timer);
    this._timer = window.setTimeout(() => {
      this._sentAt = this._st?.last_updated;
      this._call("set_cover_position", { position: value });
    }, 150);
  }

  private _moreInfo(): void {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: this.entity }, bubbles: true, composed: true }));
  }

  protected render() {
    const st = this._st;
    if (!st || !this.hass) return nothing;
    const t = (k: string) => localize(this.hass, k);
    const unavailable = UNAVAILABLE.includes(st.state);
    const pos = this._pending ?? coverPosition(st);
    const moving = coverMoving(st);
    const color = coverColor(pos);
    const glide = this._pending == null ? coverGlide(st, pos, this._target ?? this.target, this.travelTime) : { value: pos, glide: undefined };
    const can = (f: number) => !unavailable && coverSupports(st, f);
    const open = (pos ?? 0) > 0;
    return html`<div class="row ${open ? "open" : ""} ${unavailable ? "unavailable" : ""} ${moving ?? ""}" style="--cc:${color}">
      <div class="head">
        <button class="title" @click=${this._moreInfo}>
          <span class="icon"><ha-icon .icon=${this.icon ?? coverIcon(st)}></ha-icon></span>
          <span class="text">
            <span class="name">${this.name ?? st.attributes.friendly_name ?? this.entity}</span>
            <span class="state">${coverStatus(this.hass, st, pos)}</span>
          </span>
        </button>
        <div class="buttons">
          ${can(CoverFeature.OPEN) ? html`<button class="btn ${moving === "opening" ? "on" : ""}" aria-label=${t("cover.open_action")}
            ?disabled=${pos === 100 && !moving} @click=${() => this._call("open_cover")}><ha-icon icon="mdi:arrow-up"></ha-icon></button>` : nothing}
          ${can(CoverFeature.STOP) ? html`<button class="btn" aria-label=${t("cover.stop")} @click=${() => this._call("stop_cover")}>
            <ha-icon icon="mdi:stop"></ha-icon></button>` : nothing}
          ${can(CoverFeature.CLOSE) ? html`<button class="btn ${moving === "closing" ? "on" : ""}" aria-label=${t("cover.close_action")}
            ?disabled=${pos === 0 && !moving} @click=${() => this._call("close_cover")}><ha-icon icon="mdi:arrow-down"></ha-icon></button>` : nothing}
        </div>
      </div>
      ${can(CoverFeature.SET_POSITION) ? html`<hcc-gradient-slider small .min=${0} .max=${100} .step=${1} .value=${glide.value ?? 0} .glide=${glide.glide}
        .fill=${true} .active=${open} .color=${color}
        @value-changing=${(e: CustomEvent) => (this._pending = e.detail.value)}
        @value-changed=${(e: CustomEvent) => this._setPosition(e.detail.value)}></hcc-gradient-slider>` : nothing}
    </div>`;
  }

  static styles = css`
    :host { display: block; }
    .row { display: flex; flex-direction: column; gap: 8px; padding: 8px 10px 10px; border-radius: var(--hcc-inner-radius, 14px);
      background: rgba(127,127,127,0.1); transition: background 0.5s, box-shadow 0.5s; animation: slide-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both; }
    .row.open { background: color-mix(in srgb, var(--cc) 12%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--cc) 24%, transparent); }
    .row.unavailable { opacity: 0.5; }
    .head { display: flex; align-items: center; gap: 8px; }
    .title { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; border: none; background: none; padding: 0;
      cursor: pointer; text-align: left; font: inherit; color: inherit; }
    .icon { width: 34px; height: 34px; flex: none; border-radius: 50%; display: grid; place-items: center;
      background: color-mix(in srgb, var(--cc) 22%, transparent); color: var(--cc); transition: background 0.5s, color 0.5s; }
    .icon ha-icon { --mdc-icon-size: 20px; }
    .opening .icon ha-icon { animation: nudge-up 0.9s ease-in-out infinite; }
    .closing .icon ha-icon { animation: nudge-down 0.9s ease-in-out infinite; }
    .text { display: flex; flex-direction: column; min-width: 0; }
    .name { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .state { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .buttons { display: flex; gap: 6px; flex: none; }
    .btn { width: 34px; height: 34px; border-radius: 50%; border: none; cursor: pointer; display: grid; place-items: center;
      background: rgba(127,127,127,0.14); color: var(--primary-text-color); font: inherit; touch-action: manipulation;
      transition: background 0.3s, color 0.3s, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s; }
    .btn ha-icon { --mdc-icon-size: 18px; }
    .btn:hover { background: color-mix(in srgb, var(--cc) 24%, transparent); }
    .btn:active { transform: scale(0.88); }
    .btn:disabled { opacity: 0.35; cursor: default; }
    .btn.on { background: var(--cc); color: rgba(0,0,0,0.7); box-shadow: 0 0 12px color-mix(in srgb, var(--cc) 50%, transparent); }
    .btn:focus-visible, .title:focus-visible { outline: 2px solid var(--cc); outline-offset: 2px; }
    @keyframes nudge-up { 0%, 100% { transform: translateY(1px); } 50% { transform: translateY(-3px); } }
    @keyframes nudge-down { 0%, 100% { transform: translateY(-1px); } 50% { transform: translateY(3px); } }
    @keyframes slide-in { from { opacity: 0; transform: translateY(-6px) scale(0.98); } to { opacity: 1; transform: none; } }
    .icon ha-icon { animation-play-state: var(--hcc-anim-state, running) !important; }
    @media (prefers-reduced-motion: reduce) { .icon ha-icon, .row { animation: none !important; } }
  `;
}
