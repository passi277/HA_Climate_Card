import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant, MediaActivityConfig, MediaCardConfig, MediaShowConfig } from "./types";
import { localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import {
  activityIcon, activityLabel, formatMediaTime, guessControlDevice, guessVolumeDevice, MediaFeature, mediaSupports, UNAVAILABLE,
} from "./utils";
import "./components/gradient-slider";
import "./components/attribute-select";
import "./media-editor";

const DEFAULT_MEDIA_SHOW: Required<MediaShowConfig> = { activities: true, remote: true, volume: true, now_playing: true, source: true };

/** Harmony-Befehlsnamen (überschreibbar mit `commands`). */
export const DEFAULT_COMMANDS: Record<string, string> = {
  up: "DirectionUp", down: "DirectionDown", left: "DirectionLeft", right: "DirectionRight", select: "Select",
  back: "Back", home: "Home", menu: "Menu", info: "Info", vol_up: "VolumeUp", vol_down: "VolumeDown", mute: "Mute",
  ch_up: "ChannelUp", ch_down: "ChannelDown", play: "Play", pause: "Pause", rewind: "Rewind", forward: "FastForward",
};

const OFF_ACTIVITIES = ["PowerOff", "power_off", "Power Off"];

/** Akzentfarbe nach Art der Aktivität. */
const activityColor = (name?: string): string => {
  if (!name) return "var(--state-media_player-off-color, #8a8a8a)";
  if (/ps\s?[345]|playstation|xbox|switch|spiel|game|konsole/i.test(name)) return "#7c4dff";
  if (/musik|music|radio|sonos|spotify|atmos|audio|soundbar/i.test(name)) return "#26a69a";
  if (/pc|computer|rechner/i.test(name)) return "#ffa726";
  if (/fire\s?tv|amazon|netflix|apple|chrome|google/i.test(name)) return "#29b6f6";
  return "#42a5f5";
};

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-media-card",
  name: "Modern Media Card",
  description: "Medien im Modern-Home-Design: Harmony-Aktivitäten, Fernbedienung, Lautstärke und „Läuft gerade“ (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

interface Activity { name: string; label: string; icon: string; cfg?: MediaActivityConfig; }

@customElement("ha-media-card")
export class HaMediaCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: MediaCardConfig;
  @state() private _expanded = false;
  /** Aktivität, die gerade gestartet wird (bis der Hub sie meldet) */
  @state() private _starting?: string;
  @state() private _pendingVolume?: number;
  @state() private _now = Date.now();
  private _tick?: number;
  private _holdDelay?: number;
  private _holdRepeat?: number;
  private _volTimer?: number;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-media-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<MediaCardConfig> {
    const ids = Object.keys(hass.states);
    return { entity: ids.find((id) => id.startsWith("remote.") && hass.states[id].attributes.activity_list)
      ?? ids.find((id) => id.startsWith("media_player.")) ?? "" };
  }

  public setConfig(config: MediaCardConfig): void {
    if (!config?.entity || !/^(remote|media_player)\./.test(config.entity)) {
      throw new Error("ha-media-card: 'entity' muss remote.* oder media_player.* sein");
    }
    const first = !this._config;
    const startChanged = this._config?.start_expanded !== config.start_expanded || this._config?.layout !== config.layout;
    this._config = { layout: "full", ...config };
    // Fernbedienung: im vollen Layout anfangs offen, kompakt zugeklappt
    if (first || startChanged) this._expanded = config.start_expanded ?? config.layout !== "compact";
  }

  public getCardSize(): number {
    return this._config?.layout === "compact" ? 3 : 6;
  }

  public getGridOptions() {
    return { columns: 6, min_columns: 4, rows: "auto" };
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._tick);
    clearTimeout(this._volTimer);
    this._holdEnd();
  }

  private get _show(): Required<MediaShowConfig> {
    return { ...DEFAULT_MEDIA_SHOW, ...(this._config?.show ?? {}) };
  }

  private _t(key: string): string {
    return localize(this.hass, key);
  }

  private get _remote(): HassEntity | undefined {
    const id = this._config?.entity;
    return id?.startsWith("remote.") ? this.hass?.states[id] : undefined;
  }

  private get _media(): HassEntity | undefined {
    const c = this._config;
    const id = c?.media_player ?? (c?.entity.startsWith("media_player.") ? c.entity : undefined);
    return id ? this.hass?.states[id] : undefined;
  }

  private _devices(): string[] {
    return (this._remote?.attributes.devices_list ?? []) as string[];
  }

  private _current(): string | undefined {
    const r = this._remote;
    if (!r || r.state !== "on") return undefined;
    const a = r.attributes.current_activity as string | undefined;
    return a && !OFF_ACTIVITIES.includes(a) ? a : undefined;
  }

  private _activities(): Activity[] {
    const r = this._remote;
    if (!r) return [];
    const all = ((r.attributes.activity_list ?? []) as string[]).filter((a) => !OFF_ACTIVITIES.includes(a));
    const cfg = this._config!.activities?.map((a) => (typeof a === "string" ? { name: a } : a));
    const list = cfg ? cfg.filter((a) => all.includes(a.name)) : all.map((name) => ({ name }));
    return list.map((a) => ({ name: a.name, label: (a as MediaActivityConfig).label ?? activityLabel(a.name), icon: (a as MediaActivityConfig).icon ?? activityIcon(a.name), cfg: a as MediaActivityConfig }));
  }

  private _activityCfg(name?: string): MediaActivityConfig | undefined {
    return name ? this._activities().find((a) => a.name === name)?.cfg : undefined;
  }

  private _controlDevice(): string | undefined {
    const cur = this._current();
    return this._activityCfg(cur)?.control_device ?? this._config?.control_device ?? guessControlDevice(this._devices(), cur);
  }

  private _volumeDevice(): string | undefined {
    return this._activityCfg(this._current())?.volume_device ?? this._config?.volume_device ?? guessVolumeDevice(this._devices());
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this._config) return true;
    const ids = [this._config.entity, this._config.media_player].filter(Boolean) as string[];
    return ids.some((id) => old.states[id] !== this.hass!.states[id]) || old.locale !== this.hass!.locale;
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this._starting && this._current() === this._starting) this._starting = undefined;
    const playing = this._media?.state === "playing" && this._media.attributes.media_duration;
    if (playing && !this._tick) this._tick = window.setInterval(() => (this._now = Date.now()), 1000);
    if (!playing && this._tick) { clearInterval(this._tick); this._tick = undefined; }
    if (this._pendingVolume != null && Math.abs(Number(this._media?.attributes.volume_level ?? -1) * 100 - this._pendingVolume) < 1.5) this._pendingVolume = undefined;
  }

  // ---------- Aktionen ----------

  private _haptic(type = "light"): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: type }));
  }

  private _call(domain: string, service: string, data: Record<string, unknown>): void {
    if (!this.hass) return;
    this.hass.callService(domain, service, data).catch((err) => {
      this._starting = undefined;
      this._haptic("failure");
      this.dispatchEvent(new CustomEvent("hass-notification", {
        detail: { message: `${this._t("card.error")}: ${err?.message ?? err}` }, bubbles: true, composed: true,
      }));
    });
  }

  private _startActivity(name: string): void {
    const r = this._remote;
    if (!r) return;
    this._haptic();
    this._starting = name;
    this._call("remote", "turn_on", { entity_id: r.entity_id, activity: name });
    window.setTimeout(() => (this._starting = undefined), 20000);
  }

  private _power(): void {
    this._haptic();
    const r = this._remote;
    const m = this._media;
    if (r) {
      this._starting = undefined;
      this._call("remote", r.state === "on" ? "turn_off" : "turn_on", { entity_id: r.entity_id });
    } else if (m) {
      this._call("media_player", m.state === "off" ? "turn_on" : "turn_off", { entity_id: m.entity_id });
    }
  }

  /** Befehl senden: Harmony → remote.send_command, sonst passender media_player-Dienst. */
  private _send(key: string): void {
    const r = this._remote;
    const m = this._media;
    this._haptic("selection");
    if (r) {
      const device = ["vol_up", "vol_down", "mute"].includes(key) ? this._volumeDevice() : this._controlDevice();
      const command = this._config?.commands?.[key] ?? DEFAULT_COMMANDS[key];
      this._call("remote", "send_command", { entity_id: r.entity_id, command, ...(device ? { device } : {}) });
      return;
    }
    if (!m) return;
    const map: Record<string, [string, Record<string, unknown>?]> = {
      vol_up: ["volume_up"], vol_down: ["volume_down"], mute: ["volume_mute", { is_volume_muted: !m.attributes.is_volume_muted }],
      play: ["media_play"], pause: ["media_pause"], rewind: ["media_previous_track"], forward: ["media_next_track"],
    };
    const s = map[key];
    if (s) this._call("media_player", s[0], { entity_id: m.entity_id, ...(s[1] ?? {}) });
  }

  private _holdStart(ev: PointerEvent, fn: () => void): void {
    if (ev.button !== 0) return;
    this._holdEnd();
    fn();
    this._holdDelay = window.setTimeout(() => (this._holdRepeat = window.setInterval(fn, 220)), 450);
  }

  private _holdEnd = (): void => {
    clearTimeout(this._holdDelay);
    clearInterval(this._holdRepeat);
  };

  private _btn(key: string, icon: string, cls = "key", repeat = false) {
    const label = this._t(`media.cmd_${key}`);
    return repeat
      ? html`<button class=${cls} aria-label=${label} title=${label}
          @pointerdown=${(e: PointerEvent) => this._holdStart(e, () => this._send(key))} @pointerup=${this._holdEnd}
          @pointerleave=${this._holdEnd} @pointercancel=${this._holdEnd} @contextmenu=${(e: Event) => e.preventDefault()}
          @click=${(e: MouseEvent) => { if (e.detail === 0) this._send(key); }}><ha-icon icon=${icon}></ha-icon></button>`
      : html`<button class=${cls} aria-label=${label} title=${label} @click=${() => this._send(key)}><ha-icon icon=${icon}></ha-icon></button>`;
  }

  private _setVolume(pct: number): void {
    const m = this._media;
    if (!m) return;
    this._pendingVolume = pct;
    clearTimeout(this._volTimer);
    this._volTimer = window.setTimeout(() => this._call("media_player", "volume_set", { entity_id: m.entity_id, volume_level: pct / 100 }), 150);
  }

  private _moreInfo(entityId: string): void {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  // ---------- Darstellung ----------

  private _renderNowPlaying(m: HassEntity) {
    const a = m.attributes;
    if (!["playing", "paused", "buffering"].includes(m.state) || !(a.media_title || a.app_name)) return nothing;
    const dur = Number(a.media_duration);
    let pos = Number(a.media_position);
    if (m.state === "playing" && a.media_position_updated_at) pos += (this._now - new Date(a.media_position_updated_at).getTime()) / 1000;
    const pct = dur > 0 && Number.isFinite(pos) ? Math.min(100, (pos / dur) * 100) : undefined;
    const playing = m.state === "playing";
    const can = (f: number) => mediaSupports(m, f);
    return html`<div class="now">
      <div class="art" style=${a.entity_picture ? `background-image:url("${a.entity_picture}")` : ""}>
        ${a.entity_picture ? nothing : html`<ha-icon icon="mdi:music-note"></ha-icon>`}
      </div>
      <div class="meta">
        <span class="np-title">${a.media_title ?? a.app_name}</span>
        <span class="np-artist">${[a.media_artist, a.media_album_name ?? (a.media_title ? a.app_name : undefined)].filter(Boolean).join(" · ")}</span>
        ${pct != null ? html`<div class="progress"><span style="width:${pct}%"></span></div>
          <span class="times"><span>${formatMediaTime(pos)}</span><span>${formatMediaTime(dur)}</span></span>` : nothing}
      </div>
      <div class="transport">
        ${can(MediaFeature.PREVIOUS_TRACK) ? html`<button class="key small" aria-label=${this._t("media.cmd_rewind")}
          @click=${() => this._call("media_player", "media_previous_track", { entity_id: m.entity_id })}><ha-icon icon="mdi:skip-previous"></ha-icon></button>` : nothing}
        ${can(MediaFeature.PAUSE) || can(MediaFeature.PLAY) ? html`<button class="key play" aria-label=${this._t(playing ? "media.cmd_pause" : "media.cmd_play")}
          @click=${() => { this._haptic(); this._call("media_player", "media_play_pause", { entity_id: m.entity_id }); }}>
          <ha-icon icon=${playing ? "mdi:pause" : "mdi:play"}></ha-icon></button>` : nothing}
        ${can(MediaFeature.NEXT_TRACK) ? html`<button class="key small" aria-label=${this._t("media.cmd_forward")}
          @click=${() => this._call("media_player", "media_next_track", { entity_id: m.entity_id })}><ha-icon icon="mdi:skip-next"></ha-icon></button>` : nothing}
      </div>
    </div>`;
  }

  private _renderActivities(list: Activity[], current?: string) {
    return html`<div class="activities" role="group" aria-label=${this._t("media.activities")}>
      ${list.map((a) => {
        const on = a.name === current;
        const starting = a.name === this._starting && !on;
        return html`<button class="activity ${on ? "on" : ""} ${starting ? "starting" : ""}" style="--ac:${activityColor(a.name)}"
          aria-pressed=${on} @click=${() => !on && this._startActivity(a.name)}>
          <ha-icon .icon=${a.icon}></ha-icon><span>${a.label}</span>
        </button>`;
      })}
    </div>`;
  }

  private _renderVolume() {
    const r = this._remote;
    const m = this._media;
    if (m && mediaSupports(m, MediaFeature.VOLUME_SET) && !UNAVAILABLE.includes(m.state) && m.state !== "off") {
      const vol = this._pendingVolume ?? Math.round(Number(m.attributes.volume_level ?? 0) * 100);
      const muted = !!m.attributes.is_volume_muted;
      return html`<div class="volume">
        ${mediaSupports(m, MediaFeature.VOLUME_MUTE) ? html`<button class="key small ${muted ? "active" : ""}" aria-label=${this._t("media.cmd_mute")}
          @click=${() => this._call("media_player", "volume_mute", { entity_id: m.entity_id, is_volume_muted: !muted })}>
          <ha-icon icon=${muted ? "mdi:volume-off" : vol < 35 ? "mdi:volume-low" : vol < 70 ? "mdi:volume-medium" : "mdi:volume-high"}></ha-icon></button>` : nothing}
        <hcc-gradient-slider small .min=${0} .max=${100} .value=${vol} .fill=${true} .active=${!muted} .color=${"var(--accent)"}
          @value-changing=${(e: CustomEvent) => (this._pendingVolume = e.detail.value)}
          @value-changed=${(e: CustomEvent) => this._setVolume(e.detail.value)}></hcc-gradient-slider>
        <span class="vol-value">${muted ? "–" : `${vol} %`}</span>
      </div>`;
    }
    if (r || (m && mediaSupports(m, MediaFeature.VOLUME_STEP))) {
      return html`<div class="volume steps">
        ${this._btn("mute", "mdi:volume-off", "key small")}
        <div class="rocker">
          ${this._btn("vol_down", "mdi:volume-minus", "key", true)}
          <span class="rocker-label">${this._t("media.volume")}</span>
          ${this._btn("vol_up", "mdi:volume-plus", "key", true)}
        </div>
        ${r ? html`<div class="rocker small">
          ${this._btn("ch_down", "mdi:chevron-down", "key", true)}
          <span class="rocker-label">CH</span>
          ${this._btn("ch_up", "mdi:chevron-up", "key", true)}
        </div>` : nothing}
      </div>`;
    }
    return nothing;
  }

  private _renderRemote() {
    if (!this._remote) return nothing;
    const device = this._controlDevice();
    return html`<div class="remote">
      <div class="dpad">
        ${this._btn("up", "mdi:chevron-up", "dir up", true)}
        ${this._btn("left", "mdi:chevron-left", "dir left", true)}
        <button class="ok" aria-label=${this._t("media.cmd_select")} @click=${() => this._send("select")}>OK</button>
        ${this._btn("right", "mdi:chevron-right", "dir right", true)}
        ${this._btn("down", "mdi:chevron-down", "dir down", true)}
      </div>
      <div class="keys">
        ${this._btn("back", "mdi:arrow-u-left-top")}
        ${this._btn("home", "mdi:home-outline")}
        ${this._btn("menu", "mdi:menu")}
      </div>
      <div class="keys">
        ${this._btn("rewind", "mdi:rewind")}
        ${this._btn("play", "mdi:play")}
        ${this._btn("pause", "mdi:pause")}
        ${this._btn("forward", "mdi:fast-forward")}
      </div>
      ${device ? html`<span class="device"><ha-icon icon="mdi:remote"></ha-icon>${device}</span>` : nothing}
    </div>`;
  }

  private _renderSource(m?: HassEntity) {
    if (!m || !this._show.source || !mediaSupports(m, MediaFeature.SELECT_SOURCE) || m.state === "off" || UNAVAILABLE.includes(m.state)) return nothing;
    const list = (m.attributes.source_list ?? []) as string[];
    if (!list.length) return nothing;
    return html`<hcc-attribute-select .label=${this._t("media.source")} .icon=${"mdi:import"} .selected=${m.attributes.source}
      .options=${list.map((s) => ({ value: s, label: s }))} .dropdownThreshold=${4}
      @option-selected=${(e: CustomEvent) => this._call("media_player", "select_source", { entity_id: m.entity_id, source: e.detail.value })}>
    </hcc-attribute-select>`;
  }

  private _renderExpand() {
    return html`<button class="expand" @click=${() => { this._expanded = !this._expanded; }} aria-expanded=${this._expanded}>
      <span>${this._t(this._expanded ? "media.remote_hide" : "media.remote_show")}</span>
      <ha-icon class="chevron" icon="mdi:chevron-down"></ha-icon>
    </button>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const main = this.hass.states[c.entity];
    if (!main) return html`<ha-card><div class="warning">${this._t("card.entity_not_found")}: ${c.entity}</div></ha-card>`;
    const r = this._remote;
    const m = this._media;
    const show = this._show;
    const current = this._current();
    const activities = show.activities ? this._activities() : [];
    const mediaOn = !!m && !["off", "standby", "unavailable", "unknown"].includes(m.state);
    const on = r ? r.state === "on" : mediaOn;
    const unavailable = UNAVAILABLE.includes(main.state);
    const actIcon = current ? (this._activityCfg(current)?.icon ?? activityIcon(current)) : undefined;
    const color = on ? (current ? activityColor(current) : "#42a5f5") : activityColor(undefined);
    const status = unavailable ? this._t("card.unavailable")
      : this._starting ? `${this._t("media.starting")} ${this._starting} …`
        : current ?? (m && mediaOn ? (m.attributes.media_title ? `${this._t(`media.state_${m.state}`)} · ${m.attributes.media_title}` : this._t(`media.state_${m.state}`)) : this._t("media.off"));
    const name = c.name ?? main.attributes.friendly_name ?? c.entity;
    const compact = c.layout === "compact";
    const remote = show.remote && r && on ? this._renderRemote() : nothing;
    const expandable = c.expandable !== false && remote !== nothing;
    return html`<ha-card class="media-card ${compact ? "compact" : "full"} ${on ? "active" : "off"} anim-${c.animations ?? "full"}"
      style="--hcc-accent-c:${color};--hcc-accent:var(--accent)">
      <div class="glow"><span class="blob b1"></span><span class="blob b2"></span></div>
      <div class="header">
        <button class="title" @click=${() => this._moreInfo(c.entity)}>
          <span class="icon-badge ${on ? "lit" : ""} ${this._starting ? "starting" : ""}">
            <ha-icon .icon=${c.icon ?? actIcon ?? (r ? "mdi:remote-tv" : "mdi:television-play")}></ha-icon>
          </span>
          <span class="names">
            <span class="name">${name}</span>
            <span class="status">${status}</span>
          </span>
        </button>
        <button class="power ${on ? "on" : ""}" ?disabled=${unavailable} aria-label=${this._t(on ? "media.all_off" : "card.turn_on")} @click=${this._power}>
          <ha-icon icon="mdi:power"></ha-icon>
        </button>
      </div>
      ${m && show.now_playing ? this._renderNowPlaying(m) : nothing}
      ${activities.length ? this._renderActivities(activities, current) : nothing}
      ${show.volume && on ? this._renderVolume() : nothing}
      ${this._renderSource(m)}
      ${remote === nothing ? nothing : expandable
        ? html`<div class="collapsible ${this._expanded ? "open" : ""}" ?inert=${!this._expanded}><div class="collapsible-inner">${remote}</div></div>
               ${this._renderExpand()}`
        : remote}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.media-card { gap: 12px; }
    ha-card.media-card .blob { opacity: 0.45; animation-play-state: paused; }
    ha-card.media-card.off .blob { opacity: 0.18; }
    .icon-badge.lit { box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 50%, transparent); }
    .icon-badge.starting ha-icon { animation: pulse-icon 1.2s ease-in-out infinite; }
    @keyframes pulse-icon { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.9); } }
    .power:disabled { opacity: 0.4; }

    .now { display: grid; grid-template-columns: 64px 1fr auto; align-items: center; gap: 12px; padding: 10px;
      border-radius: var(--hcc-inner-radius, 14px); background: color-mix(in srgb, var(--accent) 10%, rgba(127,127,127,0.08));
      animation: slide-in 0.4s var(--ease-out) both; }
    .art { width: 64px; height: 64px; border-radius: 10px; background: rgba(127,127,127,0.2) center / cover no-repeat;
      display: grid; place-items: center; color: var(--secondary-text-color); box-shadow: 0 4px 14px rgba(0,0,0,0.2); }
    .meta { display: flex; flex-direction: column; min-width: 0; gap: 2px; }
    .np-title { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .np-artist { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .progress { height: 4px; border-radius: 2px; background: rgba(127,127,127,0.25); overflow: hidden; margin-top: 6px; }
    .progress span { display: block; height: 100%; background: var(--accent); border-radius: inherit; transition: width 1s linear; }
    .times { display: flex; justify-content: space-between; font-size: 11px; color: var(--secondary-text-color); font-variant-numeric: tabular-nums; }
    .transport { display: flex; align-items: center; gap: 4px; }

    .activities { display: grid; grid-template-columns: repeat(auto-fit, minmax(64px, 1fr)); gap: 8px; }
    .activity { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-height: 72px; padding: 10px 4px;
      border: none; border-radius: var(--hcc-inner-radius, 14px); cursor: pointer; font: inherit; font-size: 12px; font-weight: 500;
      background: rgba(127,127,127,0.1); color: var(--primary-text-color); text-align: center;
      transition: background 0.4s, box-shadow 0.4s, transform 0.2s var(--ease-spring), color 0.3s; }
    .activity span { line-height: 1.2; overflow-wrap: anywhere; hyphens: auto; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .activity ha-icon { --mdc-icon-size: 26px; color: var(--ac); transition: filter 0.4s, transform 0.3s var(--ease-spring); }
    .activity:hover { background: color-mix(in srgb, var(--ac) 14%, transparent); }
    .activity:active { transform: scale(0.95); }
    .activity.on { background: color-mix(in srgb, var(--ac) 22%, transparent); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--ac) 55%, transparent),
      0 4px 18px color-mix(in srgb, var(--ac) 25%, transparent); cursor: default; }
    .activity.on ha-icon { filter: drop-shadow(0 0 8px color-mix(in srgb, var(--ac) 70%, transparent)); transform: scale(1.08); }
    .activity.starting { background: color-mix(in srgb, var(--ac) 12%, transparent); }
    .activity.starting ha-icon { animation: pulse-icon 1.2s ease-in-out infinite; }
    .activity:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }

    .key { width: 44px; height: 44px; border-radius: 50%; border: none; cursor: pointer; display: grid; place-items: center; padding: 0;
      background: rgba(127,127,127,0.14); color: var(--primary-text-color); font: inherit; touch-action: manipulation;
      -webkit-user-select: none; user-select: none; transition: background 0.2s, transform 0.15s var(--ease-spring); }
    .key ha-icon { --mdc-icon-size: 22px; }
    .key.small { width: 38px; height: 38px; }
    .key.small ha-icon { --mdc-icon-size: 20px; }
    .key:hover { background: color-mix(in srgb, var(--accent) 22%, transparent); }
    .key:active { transform: scale(0.88); background: color-mix(in srgb, var(--accent) 35%, transparent); }
    .key.active { background: var(--accent); color: #fff; }
    .key.play { width: 46px; height: 46px; background: var(--accent); color: #fff; box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 40%, transparent); }
    .key:focus-visible, .ok:focus-visible, .dir:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

    .volume { display: flex; align-items: center; gap: 10px; }
    .volume hcc-gradient-slider { flex: 1; }
    .vol-value { min-width: 42px; text-align: right; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .volume.steps { justify-content: center; flex-wrap: wrap; }
    .rocker { display: flex; align-items: center; gap: 4px; padding: 3px; border-radius: 999px; background: rgba(127,127,127,0.1); }
    .rocker .key { width: 40px; height: 40px; background: transparent; }
    .rocker .key:hover { background: color-mix(in srgb, var(--accent) 22%, transparent); }
    .rocker-label { min-width: 52px; text-align: center; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--secondary-text-color); }
    .rocker.small .rocker-label { min-width: 28px; }

    .remote { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 4px 0 2px; }
    .dpad { position: relative; width: 184px; height: 184px; border-radius: 50%;
      background: radial-gradient(circle, rgba(127,127,127,0.06) 0 34%, rgba(127,127,127,0.14) 35%);
      box-shadow: inset 0 0 0 1px rgba(127,127,127,0.18); }
    .dir { position: absolute; width: 56px; height: 56px; border: none; border-radius: 50%; background: transparent; cursor: pointer;
      color: var(--primary-text-color); display: grid; place-items: center; padding: 0; touch-action: manipulation;
      -webkit-user-select: none; user-select: none; transition: background 0.2s, transform 0.15s; }
    .dir ha-icon { --mdc-icon-size: 30px; }
    .dir:hover { background: color-mix(in srgb, var(--accent) 18%, transparent); }
    .dir:active { background: color-mix(in srgb, var(--accent) 32%, transparent); transform: scale(0.92); }
    .dir.up { top: 4px; left: 64px; } .dir.down { bottom: 4px; left: 64px; }
    .dir.left { left: 4px; top: 64px; } .dir.right { right: 4px; top: 64px; }
    .ok { position: absolute; left: 50%; top: 50%; width: 64px; height: 64px; margin: -32px 0 0 -32px; border-radius: 50%; border: none; cursor: pointer;
      font: inherit; font-size: 15px; font-weight: 700; letter-spacing: 0.04em; color: #fff; background: var(--accent);
      box-shadow: 0 4px 16px color-mix(in srgb, var(--accent) 45%, transparent); transition: transform 0.15s var(--ease-spring); }
    .ok:active { transform: scale(0.9); }
    .keys { display: flex; gap: 14px; }
    .device { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--secondary-text-color); }
    .device ha-icon { --mdc-icon-size: 14px; }
    .warning { padding: 16px; color: var(--error-color, #db4437); }
    @media (prefers-reduced-motion: reduce) { .icon-badge.starting ha-icon, .activity.starting ha-icon { animation: none; } }
  `];
}
