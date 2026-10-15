import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, SleepCardConfig, SleepPersonConfig, SleepTimerConfig } from "./types";
import { localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { datetimeParts, formatShortDuration, minutesUntil, nextOccurrence, shiftTime, UNAVAILABLE } from "./utils";
import "./sleep-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-sleep-card",
  name: "Modern Sleep Card",
  description: "Schlafen: Schlafmodus je Person, Sleep-Timer mit Countdown und ±15 min, Klima, Wecker und „Gute Nacht“ (Licht + Medien aus) (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const fmtClock = (min?: number): string =>
  min == null ? "--:--" : `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

@customElement("ha-sleep-card")
export class HaSleepCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: SleepCardConfig;
  @state() private _confirm?: string;
  @state() private _now = Date.now();
  private _tick?: number;
  private _confirmTimer?: number;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-sleep-card-editor");
  }

  public static getStubConfig(): Partial<SleepCardConfig> {
    return { persons: [{ name: "Schlafzimmer", timers: [] }] };
  }

  public setConfig(config: SleepCardConfig): void {
    if (!config || !Array.isArray(config.persons)) throw new Error("persons: Liste mit mindestens einer Person");
    this._config = { ...config };
  }

  public connectedCallback(): void {
    super.connectedCallback();
    this._tick = window.setInterval(() => { this._now = Date.now(); }, 30_000);
  }

  public disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this._tick);
    window.clearTimeout(this._confirmTimer);
  }

  public getCardSize(): number {
    return 3 + (this._config?.persons.length ?? 1) * 3;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  private _t(key: string): string {
    return localize(this.hass, `sleep.${key}`);
  }

  private _ids(): string[] {
    return (this._config?.persons ?? []).flatMap((p) => [p.sleep, p.climate, p.alarm, ...(p.lights ?? []), ...(p.media ?? []),
      ...(p.timers ?? []).flatMap((t) => [t.switch, t.time])]).filter((x): x is string => !!x);
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || old.locale !== this.hass!.locale) return true;
    return this._ids().some((id) => old.states[id] !== this.hass!.states[id]);
  }

  private _haptic(kind = "light"): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: kind }));
  }

  private async _call(domain: string, service: string, data: Record<string, unknown>): Promise<void> {
    try {
      await this.hass!.callService(domain, service, data);
    } catch (err: any) {
      this.dispatchEvent(new CustomEvent("hass-notification", {
        detail: { message: `${localize(this.hass, "card.error")}: ${err?.message ?? err}` }, bubbles: true, composed: true,
      }));
    }
  }

  /** Erst beim zweiten Tippen innerhalb von 4 s ausführen */
  private _confirmed(key: string): boolean {
    if (this._confirm === key) {
      this._confirm = undefined;
      window.clearTimeout(this._confirmTimer);
      return true;
    }
    this._confirm = key;
    window.clearTimeout(this._confirmTimer);
    this._confirmTimer = window.setTimeout(() => { this._confirm = undefined; }, 4000);
    this._haptic();
    return false;
  }

  private _toggle(id: string): void {
    this._haptic();
    this._call(id.split(".")[0]!, "toggle", { entity_id: id });
  }

  private _shift(t: SleepTimerConfig, delta: number): void {
    const st = this.hass!.states[t.time];
    const { minutes } = datetimeParts(st);
    const time = shiftTime(minutes ?? 22 * 60, delta);
    this._haptic();
    if (t.time.startsWith("time.")) this._call("time", "set_value", { entity_id: t.time, time });
    else this._call("input_datetime", "set_datetime", { entity_id: t.time, time });
  }

  private _goodNight(p: SleepPersonConfig, key: string): void {
    if (!this._confirmed(key)) return;
    this._haptic("success");
    const lights = (p.lights ?? []).filter((id) => this.hass!.states[id]?.state === "on");
    if (lights.length) this._call("light", "turn_off", { entity_id: lights });
    for (const id of p.media ?? []) {
      const st = this.hass!.states[id];
      if (st && !["off", "standby", ...UNAVAILABLE].includes(st.state)) this._call(id.split(".")[0]!, "turn_off", { entity_id: id });
    }
    if (p.sleep && this.hass!.states[p.sleep]?.state !== "on") this._call(p.sleep.split(".")[0]!, "turn_on", { entity_id: p.sleep });
  }

  private _renderTimer(t: SleepTimerConfig) {
    const st = this.hass!.states[t.time];
    if (!st) return nothing;
    const sw = t.switch ? this.hass!.states[t.switch] : undefined;
    const active = sw ? sw.state === "on" : true;
    const { minutes, date } = datetimeParts(st);
    const left = active ? minutesUntil(nextOccurrence(minutes, date, this._now), this._now) : undefined;
    const icon = t.icon ?? (/tv|fernseh/i.test(t.name ?? "") ? "mdi:television-off" : /klima|ac/i.test(t.name ?? "") ? "mdi:air-conditioner" : "mdi:timer-sand");
    return html`<div class="timer ${active ? "on" : ""}" data-timer=${t.time}>
      <button class="t-sw" ?disabled=${!sw} @click=${() => t.switch && this._toggle(t.switch)} aria-pressed=${active} title=${this._t(active ? "timer_on" : "timer_off")}>
        <ha-icon .icon=${icon}></ha-icon></button>
      <span class="t-text"><b>${t.name ?? String(st.attributes.friendly_name ?? t.time)}</b>
        <small>${active && left != null ? this._t("off_in").replace("{t}", formatShortDuration(left)) : this._t("inactive")}</small></span>
      <span class="t-time">
        <button class="step" @click=${() => this._shift(t, -15)} aria-label="-15 min"><ha-icon icon="mdi:minus"></ha-icon></button>
        <b>${fmtClock(minutes)}</b>
        <button class="step" @click=${() => this._shift(t, 15)} aria-label="+15 min"><ha-icon icon="mdi:plus"></ha-icon></button>
      </span>
    </div>`;
  }

  private _renderClimate(id: string) {
    const st = this.hass!.states[id];
    if (!st) return nothing;
    const on = !["off", ...UNAVAILABLE].includes(st.state);
    const target = Number(st.attributes.temperature);
    const step = Number(st.attributes.target_temp_step) || 1;
    const cur = st.attributes.current_temperature;
    return html`<div class="clim ${on ? "on" : ""}">
      <button class="t-sw" @click=${() => { this._haptic(); this._call("climate", on ? "turn_off" : "turn_on", { entity_id: id }); }} aria-pressed=${on}>
        <ha-icon icon="mdi:air-conditioner"></ha-icon></button>
      <span class="t-text"><b>${String(st.attributes.friendly_name ?? id)}</b>
        <small>${on ? this.hass!.formatEntityState?.(st) ?? st.state : this._t("off")}${cur != null ? ` · ${this._t("room")} ${cur}°` : ""}</small></span>
      ${on && Number.isFinite(target) ? html`<span class="t-time">
        <button class="step" @click=${() => this._call("climate", "set_temperature", { entity_id: id, temperature: target - step })}><ha-icon icon="mdi:minus"></ha-icon></button>
        <b>${target}°</b>
        <button class="step" @click=${() => this._call("climate", "set_temperature", { entity_id: id, temperature: target + step })}><ha-icon icon="mdi:plus"></ha-icon></button>
      </span>` : nothing}
    </div>`;
  }

  private _renderPerson(p: SleepPersonConfig, i: number) {
    const hass = this.hass!;
    const sleepSt = p.sleep ? hass.states[p.sleep] : undefined;
    const asleep = sleepSt?.state === "on";
    const since = asleep && sleepSt?.last_changed ? new Date(sleepSt.last_changed) : undefined;
    const lightsOn = (p.lights ?? []).filter((id) => hass.states[id]?.state === "on");
    const mediaOn = (p.media ?? []).filter((id) => { const s = hass.states[id]?.state; return s && !["off", "standby", ...UNAVAILABLE].includes(s); });
    const alarmSt = p.alarm ? hass.states[p.alarm] : undefined;
    const alarmAt = alarmSt && !UNAVAILABLE.includes(alarmSt.state) ? new Date(alarmSt.state) : undefined;
    const alarmOk = alarmAt && Number.isFinite(alarmAt.getTime());
    const color = p.color ?? "#5c6bc0";
    const key = `gn${i}`;
    return html`<div class="person ${asleep ? "asleep" : ""}" style="--pc:${color}" data-person=${i}>
      ${asleep ? html`<div class="stars"></div>` : nothing}
      <div class="p-head">
        <span class="p-av"><ha-icon .icon=${p.icon ?? (asleep ? "mdi:sleep" : "mdi:bed-outline")}></ha-icon></span>
        <span class="p-text"><b>${p.name}</b>
          <small>${asleep ? (since ? this._t("asleep_since").replace("{t}", since.toLocaleTimeString(this.hass!.locale?.language ?? "de", { hour: "2-digit", minute: "2-digit" })) : this._t("asleep"))
            : this._t("awake")}</small></span>
        ${p.sleep ? html`<button class="sleep-sw ${asleep ? "on" : ""}" @click=${() => this._toggle(p.sleep!)} aria-pressed=${asleep}>
          <ha-icon .icon=${asleep ? "mdi:weather-night" : "mdi:white-balance-sunny"}></ha-icon>${this._t(asleep ? "sleep_on" : "sleep_off")}</button>` : nothing}
      </div>
      ${alarmOk ? html`<div class="alarm"><ha-icon icon="mdi:alarm"></ha-icon>${this._t("alarm")} ${alarmAt!.toLocaleTimeString(this.hass!.locale?.language ?? "de", { hour: "2-digit", minute: "2-digit" })}
        <small>${this._t("in").replace("{t}", formatShortDuration(minutesUntil(alarmAt, this._now) ?? 0))}</small></div>` : nothing}
      ${(p.timers ?? []).length || p.climate ? html`<div class="rows">
        ${(p.timers ?? []).map((t) => this._renderTimer(t))}
        ${p.climate ? this._renderClimate(p.climate) : nothing}
      </div>` : nothing}
      ${(p.lights ?? []).length || (p.media ?? []).length ? html`<div class="p-foot">
        <span class="still">${lightsOn.length || mediaOn.length ? html`<ha-icon icon="mdi:lightbulb-on-outline"></ha-icon>${this._t("still_on").replace("{n}", String(lightsOn.length + mediaOn.length))}`
          : html`<ha-icon icon="mdi:check"></ha-icon>${this._t("all_dark")}`}</span>
        <button class="gn ${this._confirm === key ? "confirm" : ""}" @click=${() => this._goodNight(p, key)}>
          <ha-icon icon="mdi:weather-night"></ha-icon>${this._confirm === key ? this._t("confirm") : this._t("good_night")}</button>
      </div>` : nothing}
    </div>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const asleep = c.persons.filter((p) => p.sleep && this.hass!.states[p.sleep]?.state === "on");
    const sub = asleep.length === c.persons.length && asleep.length ? this._t("all_asleep")
      : asleep.length ? this._t("n_asleep").replace("{names}", asleep.map((p) => p.name).join(" & ")) : this._t("nobody");
    return html`<ha-card class="sleep anim-${c.animations ?? "full"} ${asleep.length ? "night" : ""}" style="--hcc-accent-c:#5c6bc0">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <span class="h-icon"><ha-icon icon="mdi:power-sleep"></ha-icon></span>
        <span class="head-text"><span class="h-title">${c.name ?? this._t("title")}</span><span class="h-sub">${sub}</span></span>
      </div>
      ${c.persons.map((p, i) => this._renderPerson(p, i))}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.sleep { gap: 12px; container-type: inline-size; }
    .header { display: flex; align-items: center; gap: 10px; }
    .h-icon { flex: none; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; color: var(--accent);
      background: color-mix(in srgb, var(--accent) 18%, transparent); }
    .h-icon ha-icon { --mdc-icon-size: 24px; }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .h-title { font-size: 17px; font-weight: 600; }
    .h-sub { font-size: 12.5px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .person { position: relative; display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: var(--hcc-inner-radius, 14px);
      background: rgba(127,127,127,0.07); overflow: hidden; isolation: isolate; transition: background 0.6s, color 0.6s; }
    .person.asleep { color: #e8eaf6; background: linear-gradient(160deg, #1a237e, #0d1033 75%); }
    .person.asleep small, .person.asleep .still { color: rgba(232,234,246,0.72); }
    .stars { position: absolute; inset: 0; z-index: -1; pointer-events: none; opacity: 0.8;
      background-image: radial-gradient(1.5px 1.5px at 12% 22%, #fff, transparent), radial-gradient(1px 1px at 32% 70%, #fff, transparent),
        radial-gradient(1.5px 1.5px at 58% 18%, #fff, transparent), radial-gradient(1px 1px at 76% 52%, #fff, transparent),
        radial-gradient(2px 2px at 90% 14%, #fff8, transparent), radial-gradient(1px 1px at 46% 40%, #fff, transparent);
      animation: twinkle 4s ease-in-out infinite; }
    @keyframes twinkle { 50% { opacity: 0.4; } }
    ha-card.anim-reduced .stars, ha-card.anim-off .stars { animation: none; }
    .p-head { display: flex; align-items: center; gap: 10px; }
    .p-av { flex: none; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: var(--pc); }
    .p-av ha-icon { --mdc-icon-size: 20px; }
    .p-text, .t-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .p-text b { font-size: 15px; }
    .p-text small, .t-text small { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .p-text small { white-space: normal; }
    .sleep-sw { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border: none; border-radius: 999px; cursor: pointer;
      font-size: 12.5px; font-weight: 700; background: rgba(127,127,127,0.16); }
    .sleep-sw ha-icon { --mdc-icon-size: 17px; }
    .sleep-sw.on { color: #1a237e; background: #e8eaf6; }
    .alarm { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; }
    .alarm ha-icon { --mdc-icon-size: 18px; color: #ffca28; }
    .alarm small { font-weight: 500; opacity: 0.75; }

    .rows { display: flex; flex-direction: column; gap: 6px; }
    .timer, .clim { display: flex; align-items: center; gap: 10px; padding: 6px; border-radius: 12px; background: rgba(127,127,127,0.08); }
    .person.asleep .timer, .person.asleep .clim { background: rgba(255,255,255,0.08); }
    .t-sw { flex: none; width: 36px; height: 36px; border: none; border-radius: 50%; display: grid; place-items: center; cursor: pointer;
      color: var(--secondary-text-color); background: rgba(127,127,127,0.14); transition: background 0.3s, color 0.3s; }
    .t-sw:disabled { cursor: default; }
    .timer.on .t-sw, .clim.on .t-sw { color: #fff; background: var(--pc); }
    .t-sw ha-icon { --mdc-icon-size: 19px; }
    .t-text b { font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .timer.on .t-text small { color: var(--pc); font-weight: 700; }
    .person.asleep .timer.on .t-text small { color: #9fa8da; }
    .t-time { flex: none; display: flex; align-items: center; gap: 4px; }
    .t-time b { min-width: 46px; text-align: center; font-size: 15px; font-weight: 700; }
    .step { width: 30px; height: 30px; border: none; border-radius: 50%; display: grid; place-items: center; cursor: pointer; background: rgba(127,127,127,0.14); }
    .step ha-icon { --mdc-icon-size: 16px; }
    .step:active { transform: scale(0.9); }

    .p-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .still { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; color: var(--secondary-text-color); }
    .still ha-icon { --mdc-icon-size: 16px; }
    .gn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border: none; border-radius: 999px; cursor: pointer; font-size: 13px; font-weight: 700;
      color: #fff; background: linear-gradient(135deg, #3949ab, #5e35b1); box-shadow: 0 3px 12px rgba(63,81,181,0.35); transition: transform 0.2s var(--ease-spring); }
    .gn:active { transform: scale(0.95); }
    .gn.confirm { background: #fb8c00; }
    .gn ha-icon { --mdc-icon-size: 17px; }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-sleep-card": HaSleepCard;
  }
}
