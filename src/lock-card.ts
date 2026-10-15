import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant, LockCardConfig } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { relTime } from "./components/camera-view";
import { batteryIcon, doorKind, lockFeatures, lockHistory, UNAVAILABLE, type LockEvent, type LockEventKind, type LockFeatures } from "./utils";
import "./lock-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-lock-card",
  name: "Modern Lock Card",
  description: "Türschloss und Nuki Opener: Auf-/Abschließen, Tür öffnen mit Rückfrage, Ring to Open, Klingel, Türsensor, Akku und Verlauf, wer wann aufgeschlossen hat (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const EVENT_STYLE: Record<LockEventKind, [string, string]> = {
  locked: ["mdi:lock", "#43a047"],
  unlocked: ["mdi:lock-open-variant", "#fb8c00"],
  open: ["mdi:door-open", "#1e88e5"],
  jammed: ["mdi:lock-alert", "#e53935"],
  ring: ["mdi:bell-ring", "#fbc02d"],
  rto_on: ["mdi:bell-check", "#fb8c00"],
  rto_off: ["mdi:bell-off-outline", "#78909c"],
  door_open: ["mdi:door-open", "#1e88e5"],
  door_closed: ["mdi:door-closed", "#78909c"],
  buzz: ["mdi:door-open", "#00897b"],
};

@customElement("ha-lock-card")
export class HaLockCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: LockCardConfig;
  @state() private _confirm?: string;
  @state() private _events?: LockEvent[];
  @state() private _all = false;
  private _confirmTimer?: number;
  private _loadTimer?: number;
  private _interval?: number;
  private _cache?: { key: unknown; f: LockFeatures; of: LockFeatures };

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-lock-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<LockCardConfig> {
    return { entity: Object.keys(hass.states).find((id) => id.startsWith("lock.")) ?? "" };
  }

  public setConfig(config: LockCardConfig): void {
    if (!config?.entity) throw new Error("ha-lock-card: 'entity' (lock.*) angeben");
    this._config = { ...config };
    this._cache = undefined;
    this._events = undefined;
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this._interval = window.setInterval(() => this._loadHistory(), 10 * 60_000);
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this._confirmTimer);
    window.clearTimeout(this._loadTimer);
    window.clearInterval(this._interval);
  }

  public getCardSize(): number {
    return 5;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  private _t(key: string): string {
    return localize(this.hass, `lock.${key}`);
  }

  private _f(): LockFeatures {
    return this._feat().f;
  }

  /** Zubehör des Schlosses (f) und des zusätzlichen Openers (of) */
  private _feat(): { f: LockFeatures; of: LockFeatures } {
    const hass = this.hass!;
    if (this._cache && this._cache.key === hass.entities) return this._cache;
    const c = this._config!;
    const auto = lockFeatures(hass.states, hass.entities, c.entity);
    const of = c.opener ? lockFeatures(hass.states, hass.entities, c.opener) : {};
    // Klingel kommt beim Smart Lock meist vom Opener
    const f = { ...auto, doorbell: c.doorbell ?? auto.doorbell ?? of.doorbell, door: c.door ?? auto.door };
    this._cache = { key: hass.entities, f, of };
    return this._cache;
  }

  private _ids(): string[] {
    const { f, of } = this._feat();
    return [this._config!.entity, this._config!.opener, f.doorbell, f.ring_to_open, f.battery_low, f.battery, f.door, f.battery_replaced, of.battery_low]
      .filter((x): x is string => !!x);
  }

  private get _opener(): boolean {
    const dev = this.hass?.entities?.[this._config!.entity]?.device_id;
    return doorKind(dev ? this.hass?.devices?.[dev]?.model : undefined) === "opener";
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || old.locale !== this.hass!.locale || old.entities !== this.hass!.entities) return true;
    return this._ids().some((id) => old.states[id] !== this.hass!.states[id]);
  }

  protected updated(changed: PropertyValues): void {
    if (!changed.has("hass") || !this.hass) return;
    const old = changed.get("hass") as HomeAssistant | undefined;
    const f = this._f();
    const watch = [this._config!.entity, this._config!.opener, f.doorbell, f.ring_to_open, f.door].filter((x): x is string => !!x);
    // Verlauf beim Start und nach jeder Änderung (kurz verzögert, bis das Logbuch geschrieben ist)
    if (!this._events && !this._loadTimer) this._loadHistory();
    else if (old && watch.some((id) => old.states[id] !== this.hass!.states[id])) {
      window.clearTimeout(this._loadTimer);
      this._loadTimer = window.setTimeout(() => this._loadHistory(), 1500);
    }
  }

  private async _loadHistory(): Promise<void> {
    this._loadTimer = undefined;
    const c = this._config;
    if (!this.hass?.callWS || !c || c.history === false) return;
    const f = this._f();
    const ids = [c.entity, c.opener, f.doorbell, f.ring_to_open, f.door].filter((x): x is string => !!x);
    try {
      const rows = await this.hass.callWS<any[]>({
        type: "logbook/get_events", start_time: new Date(Date.now() - (c.history_hours ?? 48) * 3_600_000).toISOString(),
        end_time: new Date().toISOString(), entity_ids: ids,
      });
      const persons: Record<string, string> = {};
      for (const st of Object.values(this.hass.states)) {
        if (st.entity_id.startsWith("person.") && st.attributes.user_id) persons[st.attributes.user_id] = st.attributes.friendly_name ?? st.entity_id;
      }
      this._events = lockHistory(rows ?? [], { lock: c.entity, doorbell: f.doorbell, ring_to_open: f.ring_to_open, door: f.door, opener: c.opener }, persons, this._opener);
    } catch {
      this._events = [];
    }
  }

  private _haptic(kind = "light"): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: kind }));
  }

  private async _call(service: string, entity = this._config!.entity): Promise<void> {
    this._haptic("selection");
    try {
      await this.hass!.callService("lock", service, { entity_id: entity });
    } catch (err: any) {
      this._haptic("failure");
      this.dispatchEvent(new CustomEvent("hass-notification", {
        detail: { message: `${localize(this.hass, "card.error")}: ${err?.message ?? err}` }, bubbles: true, composed: true,
      }));
    }
  }

  /** Erster Tipp fragt nach („Sicher?“), zweiter innerhalb von 4 s führt aus */
  private _confirmed(key: string): boolean {
    if (this._config?.confirm === false) return true;
    if (this._confirm === key) { this._confirm = undefined; window.clearTimeout(this._confirmTimer); return true; }
    this._haptic("warning");
    this._confirm = key;
    window.clearTimeout(this._confirmTimer);
    this._confirmTimer = window.setTimeout(() => (this._confirm = undefined), 4000);
    return false;
  }

  private _moreInfo(id?: string): void {
    if (id) this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  private _stateLabel(st: HassEntity | undefined, opener: boolean): string {
    if (!st || UNAVAILABLE.includes(st.state)) return this._t("unavailable");
    if (opener && (st.state === "locked" || st.state === "unlocked")) return this._t(st.state === "unlocked" ? "rto_active" : "ready");
    return this._t(`state_${st.state}`);
  }

  private _time(ms: number): string {
    const lang = getLanguage(this.hass);
    const d = new Date(ms);
    const today = new Date().toDateString() === d.toDateString();
    const yesterday = new Date(Date.now() - 86_400_000).toDateString() === d.toDateString();
    const hm = d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
    return today ? hm : yesterday ? `${this._t("yesterday")} ${hm}` : `${d.toLocaleDateString(lang, { weekday: "short", day: "numeric", month: "numeric" })} ${hm}`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const s = this.hass.states;
    const lang = getLanguage(this.hass);
    const st = s[c.entity];
    const f = this._f();
    const opener = this._opener;
    const na = !st || UNAVAILABLE.includes(st.state);
    const busy = !!st && /ing$/.test(st.state);
    const locked = st?.state === "locked";
    const ringing = f.doorbell ? s[f.doorbell]?.state === "on" : false;
    const doorOpen = f.door ? s[f.door]?.state === "on" : false;
    const rto = opener ? st?.state === "unlocked" : f.ring_to_open ? s[f.ring_to_open]?.state === "on" : false;
    const canOpen = !!st && ((st.attributes.supported_features ?? 0) & 1) === 1;
    const jammed = st?.state === "jammed";
    const accent = na ? "#9e9e9e" : jammed ? "#e53935" : ringing ? "#fbc02d" : st?.state === "open" || st?.state === "opening" || doorOpen ? "#1e88e5"
      : opener ? (rto ? "#fb8c00" : "#43a047") : locked ? "#43a047" : "#fb8c00";
    const icon = na ? "mdi:lock-off-outline" : busy ? "mdi:lock-clock" : jammed ? "mdi:lock-alert" : ringing ? "mdi:bell-ring"
      : st?.state === "open" ? "mdi:door-open" : opener ? "mdi:door-closed-lock" : locked ? "mdi:lock" : "mdi:lock-open-variant";
    const name = c.name ?? st?.attributes.friendly_name ?? c.entity;
    const since = st && !na ? relTime(st.last_changed, lang) : "";
    const doorTxt = f.door && s[f.door] && !UNAVAILABLE.includes(s[f.door]!.state) ? this._t(doorOpen ? "door_open" : "door_closed") : "";
    const sub = ringing ? this._t("ringing") : [this._stateLabel(st, opener), doorTxt, since].filter(Boolean).join(" · ");
    const { of } = this._feat();
    const batLow = [f.battery_low, of.battery_low].some((id) => id && s[id]?.state === "on");
    const batLowId = f.battery_low && s[f.battery_low]?.state === "on" ? f.battery_low : of.battery_low;
    const op = c.opener ? s[c.opener] : undefined;
    const opNa = !op || UNAVAILABLE.includes(op.state);
    const opRto = op?.state === "unlocked";
    const opName = c.opener_name ?? op?.attributes.friendly_name ?? c.opener;
    const batPct = f.battery ? Number(s[f.battery]?.state) : NaN;
    const lastRing = f.doorbell && s[f.doorbell] && !UNAVAILABLE.includes(s[f.doorbell]!.state) ? s[f.doorbell]!.last_changed : undefined;
    const replaced = f.battery_replaced ? s[f.battery_replaced]?.state : undefined;
    const ask = (k: string) => this._confirm === k;

    const actions = opener
      ? [
        html`<button class="act ${rto ? "on" : ""}" data-act="rto" ?disabled=${na || busy} aria-pressed=${rto}
          @click=${() => this._call(rto ? "lock" : "unlock")}>
          <ha-icon .icon=${rto ? "mdi:bell-check" : "mdi:bell-off-outline"}></ha-icon><span>${this._t("ring_to_open")}</span><small>${this._t(rto ? "on" : "off")}</small></button>`,
        canOpen ? html`<button class="act main ${ask("open") ? "ask" : ""}" data-act="open" ?disabled=${na || busy}
          @click=${() => { if (this._confirmed("open")) this._call("open"); }}>
          <ha-icon .icon=${ask("open") ? "mdi:alert-circle-outline" : "mdi:door-open"}></ha-icon><span>${ask("open") ? this._t("sure") : this._t("open_door")}</span></button>` : nothing,
      ]
      : [
        html`<button class="act ${locked ? "on" : ""}" data-act="lock" ?disabled=${na || busy || locked} @click=${() => this._call("lock")}>
          <ha-icon icon="mdi:lock"></ha-icon><span>${this._t("lock")}</span></button>`,
        html`<button class="act ${ask("unlock") ? "ask" : ""} ${!locked && !na ? "on warn" : ""}" data-act="unlock" ?disabled=${na || busy || (!locked && !jammed)}
          @click=${() => { if (this._confirmed("unlock")) this._call("unlock"); }}>
          <ha-icon .icon=${ask("unlock") ? "mdi:alert-circle-outline" : "mdi:lock-open-variant"}></ha-icon><span>${ask("unlock") ? this._t("sure") : this._t("unlock")}</span></button>`,
        canOpen ? html`<button class="act main ${ask("open") ? "ask" : ""}" data-act="open" ?disabled=${na || busy}
          @click=${() => { if (this._confirmed("open")) this._call("open"); }}>
          <ha-icon .icon=${ask("open") ? "mdi:alert-circle-outline" : "mdi:door-open"}></ha-icon><span>${ask("open") ? this._t("sure") : this._t("open")}</span></button>` : nothing,
      ];

    const events = this._events ?? [];
    const shown = this._all ? events : events.slice(0, 5);
    return html`<ha-card class="lock anim-${(c as any).animations ?? "full"} ${ringing ? "ringing" : ""}" style="--hcc-accent-c:${accent}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <button class="h-icon ${ringing || busy ? "pulse" : ""}" @click=${() => this._moreInfo(c.entity)} aria-label=${name}>
          <ha-icon .icon=${icon}></ha-icon></button>
        <span class="head-text"><span class="h-title">${name}</span><span class="h-sub">${sub}</span></span>
        ${batLow ? html`<button class="chip warn" @click=${() => this._moreInfo(batLowId)}><ha-icon icon="mdi:battery-alert-variant-outline"></ha-icon>${this._t("battery_low")}</button>`
          : Number.isFinite(batPct) ? html`<button class="chip soft" @click=${() => this._moreInfo(f.battery)}><ha-icon .icon=${batteryIcon(batPct)}></ha-icon>${Math.round(batPct)} %</button>` : nothing}
      </div>

      <div class="acts">${actions}</div>

      ${c.opener ? html`<div class="opener ${ringing ? "ring" : ""}" data-opener>
        <span class="o-icon"><ha-icon .icon=${ringing ? "mdi:bell-ring" : opRto ? "mdi:bell-check" : "mdi:door-closed-lock"}></ha-icon></span>
        <button class="o-text" @click=${() => this._moreInfo(c.opener)}><b>${opName}</b>
          <small>${ringing ? this._t("ringing") : opNa ? this._t("unavailable") : this._t(opRto ? "rto_active" : "ready")}</small></button>
        <button class="o-btn ${opRto ? "on" : ""}" data-act="o-rto" ?disabled=${opNa} aria-pressed=${opRto} title=${this._t("ring_to_open")}
          @click=${() => this._call(opRto ? "lock" : "unlock", c.opener)}>
          <ha-icon .icon=${opRto ? "mdi:bell-check" : "mdi:bell-off-outline"}></ha-icon><span>RTO</span></button>
        <button class="o-btn main ${ask("o-open") ? "ask" : ""}" data-act="o-open" ?disabled=${opNa}
          @click=${() => { if (this._confirmed("o-open")) this._call("open", c.opener); }}>
          <ha-icon .icon=${ask("o-open") ? "mdi:alert-circle-outline" : "mdi:door-open"}></ha-icon><span>${ask("o-open") ? this._t("sure") : this._t("open")}</span></button>
      </div>` : nothing}

      ${f.door || lastRing || replaced ? html`<div class="info">
        ${f.door ? html`<button class="inf ${doorOpen ? "hot" : "shut"}" data-door=${doorOpen ? "open" : "closed"} @click=${() => this._moreInfo(f.door)}>
          <ha-icon .icon=${doorOpen ? "mdi:door-open" : "mdi:door-closed"}></ha-icon>${this._t(doorOpen ? "door_open" : "door_closed")}</button>` : nothing}
        ${lastRing ? html`<button class="inf" @click=${() => this._moreInfo(f.doorbell)}><ha-icon icon="mdi:bell-outline"></ha-icon>${this._t("last_ring")} ${relTime(lastRing, lang)}</button>` : nothing}
        ${replaced && !UNAVAILABLE.includes(replaced) ? html`<button class="inf" @click=${() => this._moreInfo(f.battery_replaced)}>
          <ha-icon icon="mdi:battery-sync-outline"></ha-icon>${this._t("battery_changed")} ${relTime(replaced, lang)}</button>` : nothing}
      </div>` : nothing}

      ${c.history === false ? nothing : html`<div class="hist">
        <div class="hist-head"><ha-icon icon="mdi:history"></ha-icon>${this._t("history")}</div>
        ${!this._events ? html`<div class="empty">…</div>` : !events.length ? html`<div class="empty">${this._t("no_history")}</div>`
          : shown.map((e) => {
            const [ic, col] = EVENT_STYLE[e.kind];
            return html`<div class="ev" style="--ec:${col}" data-kind=${e.kind}>
              <span class="ev-icon"><ha-icon .icon=${ic}></ha-icon></span>
              <span class="ev-text">${this._t(`ev_${e.kind}`)}${e.who ? html`<small>${e.who}</small>` : nothing}</span>
              <span class="ev-time">${this._time(e.when)}</span></div>`;
          })}
        ${events.length > 5 ? html`<button class="more" @click=${() => { this._all = !this._all; }}>${this._t(this._all ? "less" : "more")}</button>` : nothing}
      </div>`}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.lock { gap: 12px; container-type: inline-size; }
    .header { display: flex; align-items: center; gap: 10px; }
    .h-icon { position: relative; flex: none; width: 48px; height: 48px; border: none; border-radius: 50%; display: grid; place-items: center; cursor: pointer;
      color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); transition: color 0.4s, background 0.4s; }
    .h-icon ha-icon { --mdc-icon-size: 26px; }
    .h-icon.pulse::after { content: ""; position: absolute; inset: 0; border-radius: 50%; animation: ring 1.6s ease-out infinite; }
    ha-card.ringing .h-icon ha-icon { animation: shake 0.9s ease-in-out infinite; }
    @keyframes shake { 0%, 100% { transform: rotate(0); } 20% { transform: rotate(-14deg); } 40% { transform: rotate(12deg); } 60% { transform: rotate(-8deg); } 80% { transform: rotate(5deg); } }
    ha-card.anim-reduced *, ha-card.anim-off * { animation: none !important; }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .h-title { font-size: 17px; font-weight: 600; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .h-sub { font-size: 12.5px; font-weight: 600; color: var(--accent); }
    .chip { flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px; border: none; border-radius: 999px; cursor: pointer; font-size: 12px; font-weight: 700; }
    .chip ha-icon { --mdc-icon-size: 16px; }
    .chip.warn { color: #fff; background: #fb8c00; }
    .chip.soft { color: var(--secondary-text-color); background: rgba(127,127,127,0.12); }

    .acts { display: flex; gap: 8px; }
    .act { flex: 1 1 0; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 12px 6px 10px; border: none; border-radius: 16px; cursor: pointer; min-width: 0;
      font-size: 13px; font-weight: 700; color: var(--primary-text-color); background: rgba(127,127,127,0.09); transition: background 0.3s, color 0.3s, transform 0.15s; }
    .act:active:not([disabled]) { transform: scale(0.96); }
    .act ha-icon { --mdc-icon-size: 26px; color: var(--secondary-text-color); transition: color 0.3s; }
    .act span { max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .act small { font-size: 11px; font-weight: 600; color: var(--secondary-text-color); }
    .act.on { background: color-mix(in srgb, var(--accent) 16%, transparent); }
    .act.on ha-icon { color: var(--accent); }
    .act.main { color: #fff; background: #1e88e5; }
    .act.main ha-icon { color: #fff; }
    .act.ask { color: #fff !important; background: #e53935 !important; }
    .act.ask ha-icon { color: #fff !important; }
    .act[disabled] { cursor: default; opacity: 0.55; }
    .act.on[disabled] { opacity: 1; }

    .opener { display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 10px; border-radius: 16px; background: rgba(127,127,127,0.07); }
    .opener.ring { background: color-mix(in srgb, #fbc02d 18%, transparent); }
    .o-icon { flex: none; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: #00897b; background: color-mix(in srgb, #00897b 14%, transparent); }
    .opener.ring .o-icon { color: #f9a825; }
    .o-icon ha-icon { --mdc-icon-size: 19px; }
    .o-text { flex: 1; min-width: 0; display: flex; flex-direction: column; padding: 0; border: none; background: none; cursor: pointer; text-align: left; color: inherit; }
    .o-text b { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .o-text small { font-size: 11.5px; color: var(--secondary-text-color); }
    .o-btn { flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 7px 11px; border: none; border-radius: 999px; cursor: pointer; font-size: 12.5px; font-weight: 700;
      color: var(--secondary-text-color); background: rgba(127,127,127,0.12); }
    .o-btn ha-icon { --mdc-icon-size: 17px; }
    .o-btn.on { color: #fff; background: #fb8c00; }
    .o-btn.main { color: #fff; background: #00897b; }
    .o-btn.ask { background: #e53935; }
    .o-btn[disabled] { opacity: 0.5; cursor: default; }
    .info { display: flex; flex-wrap: wrap; gap: 6px; }
    .inf { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border: none; border-radius: 999px; cursor: pointer; font-size: 12px; font-weight: 600;
      color: var(--secondary-text-color); background: rgba(127,127,127,0.1); }
    .inf ha-icon { --mdc-icon-size: 15px; }
    .inf.hot { color: #fff; background: #1e88e5; }
    .inf.shut { color: #2e7d32; background: color-mix(in srgb, #43a047 14%, transparent); }

    .hist { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border-radius: 14px; background: rgba(127,127,127,0.06); }
    .hist-head { display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700; color: var(--secondary-text-color); margin-bottom: 4px; }
    .hist-head ha-icon { --mdc-icon-size: 16px; }
    .ev { display: flex; align-items: center; gap: 10px; padding: 5px 0; }
    .ev-icon { flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; color: var(--ec); background: color-mix(in srgb, var(--ec) 15%, transparent); }
    .ev-icon ha-icon { --mdc-icon-size: 16px; }
    .ev-text { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: 13.5px; font-weight: 600; }
    .ev-text small { font-size: 11.5px; font-weight: 500; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ev-time { flex: none; font-size: 12px; color: var(--secondary-text-color); font-variant-numeric: tabular-nums; }
    .more { align-self: center; margin-top: 2px; padding: 4px 12px; border: none; border-radius: 999px; background: none; cursor: pointer; font-size: 12.5px; font-weight: 700; color: var(--primary-color); }
    .empty { padding: 6px 0; font-size: 12.5px; color: var(--secondary-text-color); }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-lock-card": HaLockCard;
  }
}
