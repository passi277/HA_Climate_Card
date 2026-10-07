import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant, SceneCardConfig } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { relTime } from "./components/camera-view";
import { brightnessPct, lightColor, sceneActivated, sceneGroups, sceneLabel, sceneStyle, supportsBrightness, type SceneGroup } from "./utils";
import "./scene-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-scene-card",
  name: "Modern Scene Card",
  description: "Ambiente & Szenen: Szenen nach Raum (Hue-Räume automatisch), Symbol und Farbe aus dem Namen, zuletzt aktivierte Szene, Lampen mit Helligkeit und „Alles aus“ (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const STORE = "hcc-scene-room:";

@customElement("ha-scene-card")
export class HaSceneCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: SceneCardConfig;
  @state() private _room?: string;
  @state() private _flash?: string;
  private _cache?: { key: unknown; groups: SceneGroup[] };

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-scene-card-editor");
  }

  public static getStubConfig(): Partial<SceneCardConfig> {
    return {};
  }

  public setConfig(config: SceneCardConfig): void {
    this._config = { ...(config ?? { type: "custom:ha-scene-card" }) };
    this._cache = undefined;
    try { this._room = localStorage.getItem(STORE + (this._config.name ?? "")) ?? undefined; } catch { /* privat */ }
  }

  public getCardSize(): number {
    return 5;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  private _t(key: string): string {
    return localize(this.hass, `scene.${key}`);
  }

  /** Nur bei Änderungen an Szenen oder den eingetragenen Lampen neu zeichnen */
  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || old.locale !== this.hass!.locale) return true;
    const ids = this._watched();
    return ids.some((id) => old.states[id] !== this.hass!.states[id]);
  }

  private _watched(): string[] {
    const groups = this._groups();
    return [...groups.flatMap((g) => [...g.scenes.map((s) => s.entity_id), ...g.lights]), ...(this._config?.favorites ?? [])];
  }

  private _groups(): SceneGroup[] {
    const hass = this.hass!;
    // Szenenliste nur neu bilden, wenn eine Szene dazukommt oder wegfällt
    const key = Object.keys(hass.states).filter((id) => id.startsWith("scene.")).join();
    if (this._cache?.key === key) {
      return this._cache.groups.map((g) => ({ ...g, scenes: g.scenes.map((s) => hass.states[s.entity_id] ?? s) }));
    }
    const c = this._config!;
    const groups = sceneGroups(hass.states, { groups: c.groups, include: c.include, exclude: c.exclude });
    this._cache = { key, groups };
    return groups;
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

  private _activate(s: HassEntity): void {
    this._haptic("medium");
    this._flash = s.entity_id;
    window.setTimeout(() => { if (this._flash === s.entity_id) this._flash = undefined; }, 900);
    this._call("scene", "turn_on", { entity_id: s.entity_id });
  }

  private _selectRoom(key: string): void {
    this._room = key;
    try { localStorage.setItem(STORE + (this._config?.name ?? ""), key); } catch { /* privat */ }
  }

  private _moreInfo(id: string): void {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  private _renderScene(s: HassEntity, last: boolean, big = false) {
    const label = sceneLabel(s);
    const { icon, color } = sceneStyle(`${label} ${s.attributes.friendly_name ?? ""}`);
    return html`<button class="scene ${big ? "big" : ""} ${last ? "last" : ""} ${this._flash === s.entity_id ? "flash" : ""}" style="--sc:${color}"
      data-scene=${s.entity_id} @click=${() => this._activate(s)} @contextmenu=${(e: Event) => { e.preventDefault(); this._moreInfo(s.entity_id); }}>
      <span class="s-ic"><ha-icon .icon=${icon}></ha-icon></span>
      <span class="s-name">${label}</span>
      ${last ? html`<span class="s-last" title=${this._t("last")}><ha-icon icon="mdi:check"></ha-icon></span>` : nothing}
    </button>`;
  }

  private _renderLight(id: string) {
    const st = this.hass!.states[id];
    if (!st) return nothing;
    const on = st.state === "on";
    const color = (on && lightColor(st)) || "var(--accent)";
    const pct = brightnessPct(st);
    const dim = on && supportsBrightness(st);
    return html`<div class="light ${on ? "on" : ""} ${st.state === "unavailable" ? "na" : ""}" style="--lc:${color}" data-light=${id}>
      <button class="l-tog" @click=${() => { this._haptic(); this._call("light", "toggle", { entity_id: id }); }} aria-pressed=${on}>
        <ha-icon .icon=${st.attributes.icon ?? (on ? "mdi:lightbulb-on" : "mdi:lightbulb-outline")}></ha-icon></button>
      <button class="l-name" @click=${() => this._moreInfo(id)}>${String(st.attributes.friendly_name ?? id)}</button>
      ${dim ? html`<input class="l-dim" type="range" min="1" max="100" .value=${String(pct)} aria-label=${this._t("brightness")}
          @change=${(e: Event) => this._call("light", "turn_on", { entity_id: id, brightness_pct: Number((e.target as HTMLInputElement).value) })}>
        <span class="l-pct">${pct}%</span>` : html`<span class="l-pct">${on ? this._t("on") : st.state === "unavailable" ? "–" : this._t("off")}</span>`}
    </div>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const lang = getLanguage(this.hass);
    const groups = this._groups();
    const sel = groups.find((g) => g.key === this._room) ?? groups[0];
    const allLights = [...new Set(groups.flatMap((g) => g.lights))];
    const onLights = allLights.filter((id) => this.hass!.states[id]?.state === "on");
    const allScenes = groups.flatMap((g) => g.scenes);
    const latest = allScenes.reduce<HassEntity | undefined>((a, s) => (sceneActivated(s) > sceneActivated(a) ? s : a), undefined);
    const groupLast = sel?.scenes.reduce<HassEntity | undefined>((a, s) => (sceneActivated(s) > sceneActivated(a) ? s : a), undefined);
    const favs = (c.favorites ?? []).map((id) => this.hass!.states[id]).filter((s): s is HassEntity => !!s);
    const latestColor = latest ? sceneStyle(sceneLabel(latest)).color : "#ab47bc";
    const sub = latest && sceneActivated(latest)
      ? `${this._t("last")}: ${sceneLabel(latest)} · ${relTime(new Date(sceneActivated(latest)).toISOString(), lang)}`
      : this._t("n_scenes").replace("{n}", String(allScenes.length));
    const cols = c.columns ?? 3;
    return html`<ha-card class="scenes anim-${c.animations ?? "full"}" style="--hcc-accent-c:${latestColor};--cols:${cols}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <span class="h-icon"><ha-icon icon="mdi:palette"></ha-icon></span>
        <span class="head-text"><span class="h-title">${c.name ?? this._t("title")}</span><span class="h-sub">${sub}</span></span>
        ${allLights.length ? html`<button class="all-off ${onLights.length ? "" : "dim"}" ?disabled=${!onLights.length}
          @click=${() => { this._haptic("medium"); this._call("light", "turn_off", { entity_id: onLights }); }}>
          <ha-icon icon="mdi:lightbulb-group-off-outline"></ha-icon><span class="txt">${this._t("all_off")}</span>${onLights.length ? html`<small>${onLights.length}</small>` : nothing}</button>` : nothing}
      </div>
      ${favs.length ? html`<div class="grid favs">${favs.map((s) => this._renderScene(s, s === latest, true))}</div>` : nothing}
      ${groups.length > 1 ? html`<div class="chips">${groups.map((g) => {
        const on = g.lights.filter((id) => this.hass!.states[id]?.state === "on").length;
        return html`<button class="chip ${g === sel ? "sel" : ""}" data-room=${g.key} @click=${() => this._selectRoom(g.key)}>
          ${g.icon ? html`<ha-icon .icon=${g.icon}></ha-icon>` : nothing}${g.name || this._t("other")}${on ? html`<span class="dot"></span>` : nothing}</button>`;
      })}</div>` : nothing}
      ${sel ? html`
        ${sel.lights.length ? html`<div class="lights">
          ${sel.lights.map((id) => this._renderLight(id))}
          ${sel.lights.length > 1 ? html`<button class="room-off" @click=${() => { this._haptic(); this._call("light", "turn_off", { entity_id: sel.lights }); }}>
            <ha-icon icon="mdi:power"></ha-icon>${this._t("room_off")}</button>` : nothing}
        </div>` : nothing}
        ${sel.scenes.length ? html`<div class="grid">${sel.scenes.map((s) => this._renderScene(s, s === groupLast && !!sceneActivated(s)))}</div>`
          : html`<div class="empty">${this._t("no_scenes")}</div>`}` : html`<div class="empty">${this._t("no_scenes")}</div>`}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.scenes { gap: 12px; container-type: inline-size; }
    .header { display: flex; align-items: center; gap: 10px; }
    .h-icon { flex: none; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; color: var(--accent);
      background: color-mix(in srgb, var(--accent) 18%, transparent); }
    .h-icon ha-icon { --mdc-icon-size: 24px; }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .h-title { font-size: 17px; font-weight: 600; line-height: 1.2; }
    .h-sub { font-size: 12.5px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .all-off { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border: none; border-radius: 999px; cursor: pointer;
      font-size: 12.5px; font-weight: 700; background: rgba(127,127,127,0.14); }
    .all-off ha-icon { --mdc-icon-size: 18px; }
    .all-off small { padding: 1px 6px; border-radius: 999px; background: var(--accent); color: #fff; font-weight: 800; }
    .all-off.dim { opacity: 0.5; cursor: default; }
    @container (max-width: 360px) { .all-off .txt { display: none; } }

    .chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin: 0 -2px; padding: 0 2px; }
    .chips::-webkit-scrollbar { display: none; }
    .chip { position: relative; flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border: none; border-radius: 999px;
      cursor: pointer; font-size: 13px; font-weight: 600; background: rgba(127,127,127,0.1); transition: background 0.25s, color 0.25s; }
    .chip ha-icon { --mdc-icon-size: 16px; }
    .chip.sel { color: #fff; background: var(--accent); }
    .chip .dot { width: 7px; height: 7px; border-radius: 50%; background: #fbc02d; box-shadow: 0 0 6px #fbc02d; }

    .grid { display: grid; grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr)); gap: 8px; }
    @container (max-width: 340px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .scene { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; min-height: 78px; padding: 10px; border: none;
      border-radius: var(--hcc-inner-radius, 14px); cursor: pointer; text-align: left; overflow: hidden;
      background: linear-gradient(140deg, color-mix(in srgb, var(--sc) 30%, transparent), color-mix(in srgb, var(--sc) 8%, transparent));
      transition: transform 0.25s var(--ease-spring), box-shadow 0.25s; }
    .scene:active { transform: scale(0.96); }
    .scene.big { min-height: 64px; flex-direction: row; align-items: center; }
    .s-ic { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; color: #fff; flex: none;
      background: var(--sc); box-shadow: 0 2px 10px color-mix(in srgb, var(--sc) 55%, transparent); }
    .s-ic ha-icon { --mdc-icon-size: 18px; }
    .s-name { font-size: 13px; font-weight: 600; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .scene.last { box-shadow: inset 0 0 0 2px var(--sc); }
    .s-last { position: absolute; top: 8px; right: 8px; width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; background: var(--sc); color: #fff; }
    .s-last ha-icon { --mdc-icon-size: 13px; }
    .scene.flash::after { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 25% 30%, color-mix(in srgb, var(--sc) 70%, #fff), transparent 70%);
      animation: flash 0.9s ease-out both; pointer-events: none; }
    @keyframes flash { from { opacity: 0.9; transform: scale(0.6); } to { opacity: 0; transform: scale(1.6); } }

    .lights { display: flex; flex-direction: column; gap: 4px; padding: 6px; border-radius: var(--hcc-inner-radius, 14px); background: rgba(127,127,127,0.06); }
    .light { display: grid; grid-template-columns: 34px minmax(0, 1.3fr) minmax(60px, 1fr) 36px; align-items: center; gap: 8px; }
    .l-tog { width: 34px; height: 34px; border: none; border-radius: 50%; cursor: pointer; display: grid; place-items: center;
      color: var(--secondary-text-color); background: rgba(127,127,127,0.12); transition: background 0.3s, color 0.3s; }
    .light.on .l-tog { color: #fff; background: var(--lc); box-shadow: 0 0 12px color-mix(in srgb, var(--lc) 50%, transparent); }
    .l-tog ha-icon { --mdc-icon-size: 18px; }
    .l-name { border: none; background: none; padding: 0; cursor: pointer; text-align: left; font-size: 13px; font-weight: 600;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .light:not(:has(.l-dim)) .l-name { grid-column: span 2; }
    .l-dim { width: 100%; accent-color: var(--lc); }
    .l-pct { font-size: 12px; font-weight: 700; text-align: right; color: var(--secondary-text-color); }
    .light.na { opacity: 0.45; }
    .room-off { align-self: flex-end; display: inline-flex; align-items: center; gap: 5px; margin-top: 2px; padding: 5px 10px; border: none; border-radius: 999px;
      cursor: pointer; font-size: 12px; font-weight: 700; background: rgba(127,127,127,0.14); }
    .room-off ha-icon { --mdc-icon-size: 15px; }
    .empty { padding: 14px; text-align: center; font-size: 13px; color: var(--secondary-text-color); }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-scene-card": HaSceneCard;
  }
}
