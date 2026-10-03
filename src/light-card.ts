import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant, LightCardConfig, LightShowConfig } from "./types";
import type { ShortcutItem } from "./components/shortcut-row";
import type { SegmentItem } from "./components/segment-strip";
import { localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import {
  brightnessPct, isNoEffect, kelvinToRgb, lightColor, relatedScenes, segmentIds, supportsBrightness, supportsColor,
  supportsColorTemp, UNAVAILABLE,
} from "./utils";
import "./components/climate-dial";
import "./components/gradient-slider";
import "./components/attribute-select";
import "./components/shortcut-row";
import "./components/segment-strip";
import "./light-editor";

const DEFAULT_LIGHT_SHOW: Required<LightShowConfig> = {
  lights: true, scenes: true, color: true, temperature: true, effects: true, segments: true, shortcuts: true,
};
/** Technische Geräte-Entitäten, die nicht als Schalter angeboten werden (govee2mqtt). */
const SHORTCUT_EXCLUDE = /power.?switch|request|platform.?api|refresh|identify/i;
const NO_EFFECT = "__hcc_no_effect__";
const OFF_COLOR = "var(--state-light-off-color, #8a8a8a)";
const HUE_SWATCHES = [0, 28, 50, 120, 180, 220, 270, 320];
const HUE_GRADIENT = "linear-gradient(90deg, #f00, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00)";
const rgb = (c: [number, number, number]) => `rgb(${c.join(",")})`;

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-light-card",
  name: "Modern Light Card",
  description: "Licht im Modern-Home-Design: Helligkeitsring, Farbe & Weißton, Lampen und Szenen des Raums (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

interface Member { entity: string; name: string; st: HassEntity; }

@customElement("ha-light-card")
export class HaLightCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: LightCardConfig;
  @state() private _pending?: number;
  @state() private _pendingKelvin?: number;
  @state() private _pendingHue?: number;
  @state() private _expanded = false;
  @state() private _syncing = false;
  private _timer?: number;
  private _holdDelay?: number;
  private _holdRepeat?: number;
  private _sentAt?: string;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-light-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<LightCardConfig> {
    const groups = Object.values(hass.states).filter((s) => s.entity_id.startsWith("light.") && Array.isArray(s.attributes.entity_id));
    const any = Object.keys(hass.states).find((id) => id.startsWith("light."));
    return { entity: groups[0]?.entity_id ?? any ?? "" };
  }

  public setConfig(config: LightCardConfig): void {
    if (!config?.entity || !config.entity.startsWith("light.")) {
      throw new Error("ha-light-card: 'entity' muss eine light-Entität sein (light.xyz)");
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

  private get _show(): Required<LightShowConfig> {
    return { ...DEFAULT_LIGHT_SHOW, ...(this._config?.show ?? {}) };
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
    const group = String(st?.attributes.friendly_name ?? "");
    return list.map((e) => (typeof e === "string" ? { entity: e } : e))
      .filter((m) => this.hass!.states[m.entity] && m.entity !== c.entity)
      .map((m) => {
        const s = this.hass!.states[m.entity];
        const full = String(s.attributes.friendly_name ?? m.entity);
        const short = group && full.toLowerCase().startsWith(group.toLowerCase() + " ") ? full.slice(group.length + 1) : full;
        return { entity: m.entity, name: (m as { name?: string }).name ?? short.charAt(0).toUpperCase() + short.slice(1), st: s };
      });
  }

  private _scenes(): HassEntity[] {
    const c = this._config!;
    const st = this._st;
    if (c.scenes) return c.scenes.map((id) => this.hass!.states[id]).filter((s): s is HassEntity => !!s);
    return c.auto_scenes === false || !st ? [] : relatedScenes(this.hass!.states, st);
  }

  private _deviceCache?: { key: unknown; entity: string; ids: string[] };

  /** Alle Entitäten desselben Geräts (ohne versteckte). */
  private _deviceEntities(): string[] {
    const hass = this.hass;
    const entityId = this._config?.entity;
    if (!hass?.entities || !entityId) return [];
    const cache = this._deviceCache;
    if (cache && cache.key === hass.entities && cache.entity === entityId) return cache.ids;
    const deviceId = hass.entities[entityId]?.device_id;
    const ids = deviceId
      ? Object.values(hass.entities)
          .filter((e) => e.device_id === deviceId && e.entity_id !== entityId && !e.hidden)
          .map((e) => e.entity_id)
          .sort()
      : [];
    this._deviceCache = { key: hass.entities, entity: entityId, ids };
    return ids;
  }

  /** Kurzname ohne Geräte-/Lampennamen als Präfix. */
  private _shortName(entityId: string): string {
    const hass = this.hass!;
    const full = String(hass.states[entityId]?.attributes.friendly_name ?? entityId.split(".")[1]);
    const deviceId = hass.entities?.[entityId]?.device_id;
    const device = deviceId ? hass.devices?.[deviceId] : undefined;
    const prefixes = [device?.name_by_user, device?.name, this._st?.attributes.friendly_name, this._config?.name]
      .filter((p): p is string => !!p)
      .sort((x, y) => y.length - x.length);
    for (const prefix of prefixes) {
      if (full.toLowerCase().startsWith(prefix.toLowerCase() + " ")) {
        const rest = full.slice(prefix.length + 1);
        return rest.charAt(0).toUpperCase() + rest.slice(1);
      }
    }
    return full;
  }

  private _segments(): SegmentItem[] {
    const c = this._config!;
    const hass = this.hass!;
    const ids = c.segments ?? (c.auto_segments === false ? [] : [...new Set([
      ...segmentIds(hass.states, c.entity),
      ...this._deviceEntities().filter((id) => id.startsWith("light.") && /segment/i.test(id)),
    ])]);
    return ids.filter((id) => hass.states[id]).map((id) => ({ entity: id, name: this._shortName(id) }));
  }

  private _shortcuts(): ShortcutItem[] {
    const c = this._config!;
    const hass = this.hass!;
    const list = c.shortcuts ?? (c.auto_shortcuts === false ? [] : this._deviceEntities()
      .filter((id) => ["switch", "button"].includes(id.split(".")[0]) && !SHORTCUT_EXCLUDE.test(id)
        && hass.entities?.[id]?.entity_category !== "diagnostic"));
    return list
      .map((s) => (typeof s === "string" ? { entity: s } : s))
      .filter((s) => s?.entity && hass.states[s.entity])
      .map((s) => ({ entity: s.entity, name: s.name ?? this._shortName(s.entity), icon: s.icon }));
  }

  private _watched(): string[] {
    const c = this._config;
    if (!c) return [];
    return [c.entity, c.motion_sensor, c.illuminance_sensor, ...this._members().map((m) => m.entity),
      ...this._segments().map((s) => s.entity), ...this._shortcuts().map((s) => s.entity)].filter(Boolean) as string[];
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
      this._pendingKelvin = undefined;
      this._pendingHue = undefined;
      this._syncing = false;
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._timer);
    this._holdEnd();
  }

  // ---------- Aktionen ----------

  private _haptic(type = "light"): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: type }));
  }

  private _service(domain: string, service: string, data: Record<string, unknown>): void {
    const st = this._st;
    if (!this.hass) return;
    if (st && data.entity_id === st.entity_id) {
      this._sentAt = st.last_updated;
      this._syncing = true;
      window.setTimeout(() => (this._syncing = false), 5000);
    }
    this.hass.callService(domain, service, data).catch((err) => {
      this._syncing = false;
      this._haptic("failure");
      this.dispatchEvent(new CustomEvent("hass-notification", {
        detail: { message: `${this._t("card.error")}: ${err?.message ?? err}` }, bubbles: true, composed: true,
      }));
    });
  }

  private _turnOn(data: Record<string, unknown> = {}): void {
    this._service("light", "turn_on", { entity_id: this._config!.entity, ...data });
  }

  private _togglePower(): void {
    this._haptic();
    const st = this._st;
    this._service("light", st?.state === "on" ? "turn_off" : "turn_on", { entity_id: this._config!.entity });
  }

  private _setBrightness(pct: number, delay = 350): void {
    this._pending = Math.min(100, Math.max(1, Math.round(pct)));
    clearTimeout(this._timer);
    this._timer = window.setTimeout(() => this._turnOn({ brightness_pct: this._pending }), delay);
  }

  private _stepBrightness(dir: 1 | -1): void {
    const st = this._st;
    const base = this._pending ?? brightnessPct(st);
    const next = Math.min(100, Math.max(1, (Math.round(base / 5) + dir * 2) * 5));
    if (next !== base) this._haptic("selection");
    this._setBrightness(next, 700);
  }

  private _holdStart(ev: PointerEvent, fn: () => void): void {
    if (ev.button !== 0) return;
    this._holdEnd();
    fn();
    this._holdDelay = window.setTimeout(() => (this._holdRepeat = window.setInterval(fn, 130)), 420);
  }

  private _holdEnd = (): void => {
    clearTimeout(this._holdDelay);
    clearInterval(this._holdRepeat);
  };

  private _holdButton(label: string, icon: string, fn: () => void) {
    return html`<button class="round" aria-label=${label}
      @pointerdown=${(e: PointerEvent) => this._holdStart(e, fn)} @pointerup=${this._holdEnd}
      @pointerleave=${this._holdEnd} @pointercancel=${this._holdEnd} @contextmenu=${(e: Event) => e.preventDefault()}
      @click=${(e: MouseEvent) => { if (e.detail === 0) fn(); }}><ha-icon icon=${icon}></ha-icon></button>`;
  }

  private _moreInfo(entityId: string): void {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  // ---------- Darstellung ----------

  private _renderHeader(st: HassEntity, name: string, members: Member[]) {
    const on = st.state === "on";
    const pct = this._pending ?? brightnessPct(st);
    const onCount = members.filter((m) => m.st.state === "on").length;
    const status = UNAVAILABLE.includes(st.state)
      ? this._t("card.unavailable")
      : on
        ? `${this._t("light.on")}${supportsBrightness(st) ? ` · ${pct} %` : ""}${members.length ? ` · ${onCount}/${members.length}` : ""}`
        : this._t("light.off");
    return html`<div class="header">
      <button class="title" @click=${() => this._moreInfo(st.entity_id)}>
        <span class="icon-badge ${on ? "active lit" : ""}">
          <ha-icon .icon=${this._config!.icon ?? (on ? "mdi:lightbulb-on" : "mdi:lightbulb-outline")}></ha-icon>
        </span>
        <span class="names">
          <span class="name">${name}</span>
          <span class="status">${this._syncing ? html`<span class="sync"></span>` : nothing}${status}</span>
        </span>
      </button>
      <button class="power ${on ? "on" : ""}" aria-label=${this._t(on ? "card.turn_off" : "card.turn_on")} @click=${this._togglePower}>
        <ha-icon icon="mdi:power"></ha-icon>
      </button>
    </div>`;
  }

  private _renderPills(st: HassEntity) {
    const c = this._config!;
    const hass = this.hass!;
    const pills: { icon: string; text: string; warn?: boolean }[] = [];
    if (st.state === "on" && !isNoEffect(st.attributes.effect)) {
      pills.push({ icon: "mdi:auto-fix", text: String(st.attributes.effect) });
    }
    const motion = c.motion_sensor ? hass.states[c.motion_sensor] : undefined;
    if (motion) {
      if (motion.state === "on") pills.push({ icon: "mdi:motion-sensor", text: this._t("light.motion"), warn: true });
      else {
        const mins = Math.round((Date.now() - new Date(motion.last_changed).getTime()) / 60000);
        if (mins >= 0 && mins < 120) pills.push({ icon: "mdi:motion-sensor-off", text: `${this._t("light.motion_ago")} ${mins} min` });
      }
    }
    const lux = c.illuminance_sensor ? Number(hass.states[c.illuminance_sensor]?.state) : NaN;
    if (Number.isFinite(lux)) pills.push({ icon: "mdi:brightness-5", text: `${Math.round(lux)} lx` });
    if (!pills.length) return nothing;
    return html`<div class="pills">${pills.map((p) => html`<span class="pill ${p.warn ? "warn" : ""}"><ha-icon .icon=${p.icon}></ha-icon>${p.text}</span>`)}</div>`;
  }

  private _colorInfo(st: HassEntity) {
    if (st.state !== "on") return nothing;
    const k = this._pendingKelvin ?? st.attributes.color_temp_kelvin;
    if (st.attributes.color_mode === "color_temp" && k) return html`<ha-icon icon="mdi:thermometer"></ha-icon>${Math.round(Number(k))} K`;
    if (Array.isArray(st.attributes.rgb_color)) {
      return html`<span class="swatch-dot" style="background:${lightColor(st)}"></span>${this._t("light.color")}`;
    }
    return nothing;
  }

  private _renderDial(st: HassEntity) {
    const on = st.state === "on";
    const pct = this._pending ?? (on ? brightnessPct(st) : undefined);
    return html`
      <hcc-climate-dial .min=${1} .max=${100} .step=${1} .value=${pct} .fill=${true} .color=${"var(--accent)"}
        .active=${on} .disabled=${!supportsBrightness(st)} .showCurrentLabel=${false}
        @value-changing=${(e: CustomEvent) => { this._pending = e.detail.value; this._haptic("selection"); }}
        @value-changed=${(e: CustomEvent) => this._setBrightness(e.detail.value, 150)}>
        <div class="dial-center">
          <span class="dial-label">${on ? this._t("light.brightness") : this._t("light.off")}</span>
          <span class="dial-big" data-pop="brightness">${on && pct != null ? pct : "–"}<sup>%</sup></span>
          <span class="dial-sub">${this._colorInfo(st)}</span>
        </div>
      </hcc-climate-dial>
      ${supportsBrightness(st) ? html`<div class="dial-steppers">
        ${this._holdButton("-", "mdi:minus", () => this._stepBrightness(-1))}
        ${this._holdButton("+", "mdi:plus", () => this._stepBrightness(1))}
      </div>` : nothing}`;
  }

  private _renderMembers(members: Member[]) {
    return html`<div class="lights">
      ${members.map((m) => {
        const on = m.st.state === "on";
        const unavailable = UNAVAILABLE.includes(m.st.state);
        const color = lightColor(m.st);
        return html`<button class="light ${on ? "on" : ""}" ?disabled=${unavailable} style=${color ? `--lc:${color}` : ""}
          title=${m.name} @click=${() => { this._haptic(); this._service("light", "toggle", { entity_id: m.entity }); }}
          @contextmenu=${(e: Event) => { e.preventDefault(); this._moreInfo(m.entity); }}>
          <ha-icon icon=${on ? "mdi:lightbulb-on" : "mdi:lightbulb-outline"}></ha-icon>
          <span class="light-text"><span class="light-name">${m.name}</span>
            <span class="light-state">${unavailable ? this._t("card.unavailable") : on ? `${brightnessPct(m.st)} %` : this._t("light.off")}</span></span>
        </button>`;
      })}
    </div>`;
  }

  private _renderScenes(scenes: HassEntity[], st: HassEntity) {
    const group = String(st.attributes.friendly_name ?? "");
    const label = (s: HassEntity) => {
      const n = String(s.attributes.name ?? s.attributes.friendly_name ?? s.entity_id);
      return group && n.toLowerCase().startsWith(group.toLowerCase() + " ") ? n.slice(group.length + 1) : n;
    };
    return html`<div class="scenes-wrap">
      <span class="row-label"><ha-icon icon="mdi:palette-outline"></ha-icon>${this._t("light.scenes")}</span>
      <div class="scenes">
        ${scenes.map((s) => html`<button class="scene" @click=${(e: Event) => {
          this._haptic(); this._service("scene", "turn_on", { entity_id: s.entity_id });
          const el = e.currentTarget as HTMLElement; el.classList.add("fired"); setTimeout(() => el.classList.remove("fired"), 700);
        }}>${label(s)}</button>`)}
      </div>
    </div>`;
  }

  private _renderColor(st: HassEntity) {
    const parts: TemplateResult[] = [];
    const show = this._show;
    const a = st.attributes;
    if (show.temperature && supportsColorTemp(st)) {
      const min = Number(a.min_color_temp_kelvin ?? 2000);
      const max = Number(a.max_color_temp_kelvin ?? 6500);
      const value = this._pendingKelvin ?? Number(a.color_temp_kelvin ?? Math.round((min + max) / 2));
      parts.push(html`<hcc-gradient-slider .min=${min} .max=${max} .step=${50} .value=${value}
        .label=${this._t("light.temperature")} .icon=${"mdi:thermometer"} .display=${`${Math.round(value)} K`}
        .gradient=${`linear-gradient(90deg, ${rgb(kelvinToRgb(min))}, ${rgb(kelvinToRgb((min + max) / 2))}, ${rgb(kelvinToRgb(max))})`}
        .knob=${rgb(kelvinToRgb(value))}
        @value-changing=${(e: CustomEvent) => (this._pendingKelvin = e.detail.value)}
        @value-changed=${(e: CustomEvent) => { this._pendingKelvin = e.detail.value; this._turnOn({ color_temp_kelvin: e.detail.value }); }}>
      </hcc-gradient-slider>`);
    }
    if (show.color && supportsColor(st)) {
      const hue = this._pendingHue ?? (Array.isArray(a.hs_color) ? Math.round(a.hs_color[0]) : 0);
      parts.push(html`<div class="color-wrap">
        <hcc-gradient-slider .min=${0} .max=${359} .step=${1} .value=${hue} .label=${this._t("light.color")}
          .icon=${"mdi:palette"} .display=${`${hue}°`} .gradient=${HUE_GRADIENT} .knob=${`hsl(${hue}, 100%, 50%)`}
          @value-changing=${(e: CustomEvent) => (this._pendingHue = e.detail.value)}
          @value-changed=${(e: CustomEvent) => { this._pendingHue = e.detail.value; this._turnOn({ hs_color: [e.detail.value, 100] }); }}>
        </hcc-gradient-slider>
        <div class="swatches">
          ${HUE_SWATCHES.map((h) => html`<button class="swatch" style="--sw:hsl(${h}, 100%, 50%)" aria-label="${h}°"
            @click=${() => { this._haptic("selection"); this._pendingHue = h; this._turnOn({ hs_color: [h, 100] }); }}></button>`)}
          ${supportsColorTemp(st) ? html`<button class="swatch white" aria-label=${this._t("light.white")}
            @click=${() => { this._haptic("selection"); this._turnOn({ color_temp_kelvin: 2700 }); }}></button>` : nothing}
        </div>
      </div>`);
    }
    const effects = ((a.effect_list ?? []) as unknown[]).map(String);
    const real = [...new Set(effects.filter((e) => !isNoEffect(e)))];
    if (show.effects && real.length) {
      parts.push(html`<hcc-attribute-select .label=${this._t("light.effect")} .icon=${"mdi:auto-fix"}
        .selected=${isNoEffect(a.effect) ? NO_EFFECT : String(a.effect)} .dropdownThreshold=${5}
        .options=${[{ value: NO_EFFECT, label: this._t("light.no_effect") },
          ...real.map((e) => ({ value: e, label: e.charAt(0).toUpperCase() + e.slice(1) }))]}
        @option-selected=${(e: CustomEvent) => this._setEffect(e.detail.value, effects)}></hcc-attribute-select>`);
    }
    return parts;
  }

  /**
   * Effekt setzen. „Kein Effekt“: vorhandenes `off`/`None` der Liste verwenden, sonst (Govee: `""`)
   * die aktuelle Farbe bzw. den Weißton erneut setzen – das beendet die Szene zuverlässig.
   */
  private _setEffect(value: string, list: string[]): void {
    this._haptic("selection");
    if (value !== NO_EFFECT) return this._turnOn({ effect: value });
    const named = list.find((e) => isNoEffect(e) && e.trim() !== "");
    if (named) return this._turnOn({ effect: named });
    const a = this._st!.attributes;
    if (a.color_mode === "color_temp" && a.color_temp_kelvin) return this._turnOn({ color_temp_kelvin: a.color_temp_kelvin });
    if (Array.isArray(a.rgb_color)) return this._turnOn({ rgb_color: a.rgb_color });
    if (supportsColorTemp(this._st!)) return this._turnOn({ color_temp_kelvin: 3000 });
    this._turnOn({ brightness_pct: brightnessPct(this._st) || 100 });
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
    const name = this._config.name ?? st.attributes.friendly_name ?? st.entity_id;
    const on = st.state === "on";
    const color = lightColor(st) ?? OFF_COLOR;
    const members = this._show.lights ? this._members() : [];
    const scenes = this._show.scenes ? this._scenes() : [];
    const segments = this._show.segments ? this._segments() : [];
    const shortcuts = this._show.shortcuts ? this._shortcuts() : [];
    const colorParts = on ? this._renderColor(st) : [];
    const compact = this._config.layout === "compact";
    const primary = [
      members.length ? this._renderMembers(members) : nothing,
      segments.length ? html`<hcc-segment-strip .hass=${this.hass} .items=${segments} .label=${this._t("light.segments")}></hcc-segment-strip>` : nothing,
      scenes.length ? this._renderScenes(scenes, st) : nothing,
      shortcuts.length ? html`<hcc-shortcut-row .hass=${this.hass} .items=${shortcuts}></hcc-shortcut-row>` : nothing,
    ];
    const details = colorParts.length
      ? html`<div class="controls">${colorParts}</div>`
      : nothing;
    const expandable = this._config.expandable !== false && colorParts.length > 0;
    const anim = this._config.animations ?? "full";
    const pct = this._pending ?? brightnessPct(st);
    return html`<ha-card class="light-card ${compact ? "compact" : "full"} ${on ? "active" : "off"} anim-${anim}"
      style="--hcc-accent-c:${color};--glow-strength:${on ? 0.35 + (pct / 100) * 0.65 : 0.25}">
      <div class="glow"><span class="blob b1"></span><span class="blob b2"></span></div>
      ${this._renderHeader(st, name, members)}
      ${this._renderPills(st)}
      ${compact
        ? supportsBrightness(st) ? html`<hcc-gradient-slider .min=${1} .max=${100} .value=${on ? pct : 0}
            .label=${this._t("light.brightness")} .icon=${"mdi:brightness-6"} .display=${on ? `${pct} %` : this._t("light.off")}
            .gradient=${`linear-gradient(90deg, color-mix(in srgb, ${lightColor(st) ?? "rgb(255,196,107)"} 15%, #222), ${lightColor(st) ?? "rgb(255,196,107)"})`}
            .knob=${lightColor(st) ?? "#fff"}
            @value-changing=${(e: CustomEvent) => (this._pending = e.detail.value)}
            @value-changed=${(e: CustomEvent) => this._setBrightness(e.detail.value, 150)}></hcc-gradient-slider>` : nothing
        : this._renderDial(st)}
      <div class="controls">${primary}</div>
      ${expandable
        ? html`<div class="collapsible ${this._expanded ? "open" : ""}" ?inert=${!this._expanded}><div class="collapsible-inner">${details}</div></div>
               ${this._renderExpand()}`
        : details}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.light-card .blob { opacity: var(--glow-strength, 0.5); }
    ha-card.light-card.off .blob { animation-play-state: paused; }
    .icon-badge.lit { box-shadow: 0 0 18px color-mix(in srgb, var(--accent) 60%, transparent); }
    .icon-badge.lit ha-icon { animation: none; }
    .swatch-dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 4px;
      box-shadow: 0 0 0 2px rgba(255,255,255,0.6); }
    .lights { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
    .light { display: flex; align-items: center; gap: 10px; padding: 8px 10px; min-height: 48px; border: none; cursor: pointer;
      text-align: left; border-radius: var(--hcc-inner-radius, 14px); background: rgba(127,127,127,0.12); color: var(--secondary-text-color);
      font: inherit; min-width: 0; transition: background 0.3s, color 0.3s, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .light:active { transform: scale(0.96); }
    .light:disabled { opacity: 0.45; cursor: default; }
    .light ha-icon { --mdc-icon-size: 22px; flex: none; transition: color 0.3s, filter 0.3s; }
    .light.on { background: color-mix(in srgb, var(--lc) 18%, transparent); color: var(--primary-text-color);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--lc) 35%, transparent); }
    .light.on ha-icon { color: var(--lc); filter: drop-shadow(0 0 6px color-mix(in srgb, var(--lc) 70%, transparent)); }
    .light-text { display: flex; flex-direction: column; min-width: 0; }
    .light-name { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .light-state { font-size: 11px; color: var(--secondary-text-color); }
    .scenes-wrap { display: flex; flex-direction: column; gap: 8px; }
    .scenes { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
    .scenes::-webkit-scrollbar { display: none; }
    .scene { flex: none; border: none; border-radius: 999px; padding: 7px 14px; font: inherit; font-size: 13px; cursor: pointer;
      background: rgba(127,127,127,0.12); color: var(--primary-text-color); transition: background 0.25s, transform 0.2s; }
    .scene:hover { background: color-mix(in srgb, var(--accent) 20%, transparent); }
    .scene.fired { background: var(--accent); color: #000; transform: scale(0.96); }
    .color-wrap { display: flex; flex-direction: column; gap: 10px; }
    .swatches { display: flex; flex-wrap: wrap; gap: 8px; }
    .swatch { width: 30px; height: 30px; border-radius: 50%; border: none; cursor: pointer; background: var(--sw);
      box-shadow: 0 0 0 2px rgba(255,255,255,0.15), 0 2px 6px rgba(0,0,0,0.25); transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .swatch:hover { transform: scale(1.12); }
    .swatch.white { background: radial-gradient(circle at 35% 35%, #fff, rgb(255, 214, 160)); }
    ha-card.compact hcc-gradient-slider { margin-top: 2px; }
    hcc-shortcut-row, hcc-segment-strip { --hcc-accent: var(--accent); }
  `];
}
