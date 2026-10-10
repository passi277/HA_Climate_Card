import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, MediaCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";
import { MediaFeature, mediaSupports } from "./utils";

@customElement("ha-media-card-editor")
export class HaMediaCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: MediaCardConfig;

  public setConfig(config: MediaCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `media_editor.${key}`);
  }

  private _schema() {
    const c = this._config;
    const main = c?.entity ? this.hass?.states[c.entity] : undefined;
    const isRemote = !!c?.entity?.startsWith("remote.");
    const mediaId = c?.media_player ?? (c?.entity?.startsWith("media_player.") ? c.entity : undefined);
    const media = mediaId ? this.hass?.states[mediaId] : undefined;
    const devices = (main?.attributes.devices_list ?? []) as string[];
    const activities = ((main?.attributes.activity_list ?? []) as string[]).filter((a) => !/power.?off/i.test(a));
    // Nur Bereiche, die mit dem Gerät möglich sind
    const show = [
      ...(isRemote ? ["activities", "remote"] : []),
      "volume",
      ...(media ? ["now_playing"] : []),
      ...(media && mediaSupports(media, MediaFeature.SELECT_SOURCE) ? ["source"] : []),
    ];
    const deviceSelect = (name: string) => ({ name, selector: { select: { mode: "dropdown", options: [
      { value: "", label: this._t("auto") }, ...devices.map((d) => ({ value: d, label: d })),
    ] } } });
    return [
      { name: "entity", required: true, selector: { entity: { filter: [{ domain: "remote" }, { domain: "media_player" }] } } },
      ...(isRemote ? [{ name: "media_player", selector: { entity: { filter: { domain: "media_player" } } } }] : []),
      { type: "grid", name: "", schema: [
        { name: "name", selector: { text: {} } },
        { name: "icon", selector: { icon: {} } },
      ] },
      { name: "layout", selector: { select: { mode: "box", options: [
        { value: "full", label: this._t("layout_full") },
        { value: "compact", label: this._t("layout_compact") },
      ] } } },
      { type: "expandable", name: "show", title: this._t("sections"), icon: "mdi:eye-outline", schema: [
        { type: "grid", name: "", schema: show.map((k) => ({ name: k, selector: { boolean: {} } })) },
      ] },
      ...(isRemote && devices.length ? [{ type: "expandable", name: "", flatten: true, title: this._t("harmony"), icon: "mdi:remote", schema: [
        ...(activities.length ? [{ name: "activities", selector: { select: { multiple: true, mode: "list", options: activities.map((a) => ({ value: a, label: a })) } } }] : []),
        deviceSelect("control_device"),
        deviceSelect("volume_device"),
      ] }] : []),
      { type: "expandable", name: "", flatten: true, title: this._t("timer_section"), icon: "mdi:sleep", schema: [
        { name: "timer_switch", selector: { entity: { filter: { domain: ["input_boolean", "switch"] } } } },
        { name: "timer_time", selector: { entity: { filter: { domain: "input_datetime" } } } },
      ] },
      { type: "expandable", name: "", flatten: true, title: this._t("appearance"), icon: "mdi:palette-outline", schema: [
        { name: "expandable", selector: { boolean: {} } },
        { name: "start_expanded", selector: { boolean: {} } },
        { name: "animations", selector: { select: { mode: "dropdown", options: ["full", "reduced", "off"].map((v) => ({ value: v, label: localize(this.hass, `editor.anim_${v}`) })) } } },
      ] },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const config = { ...ev.detail.value } as MediaCardConfig;
    // Eigene Beschriftungen/Symbole von Aktivitäten aus YAML erhalten
    if (Array.isArray(config.activities)) {
      const previous = this._config?.activities ?? [];
      config.activities = config.activities.map((a) => {
        const n = typeof a === "string" ? a : a.name;
        return previous.find((p) => typeof p !== "string" && p.name === n) ?? n;
      });
    }
    for (const key of Object.keys(config) as (keyof MediaCardConfig)[]) {
      const v = config[key];
      if (v === "" || v == null || (Array.isArray(v) && !v.length)) delete config[key];
    }
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const data = {
      layout: "full", expandable: true, animations: "full",
      ...this._config,
      activities: this._config.activities?.map((a) => (typeof a === "string" ? a : a.name)),
      show: { activities: true, remote: true, volume: true, now_playing: true, source: true, ...(this._config.show ?? {}) },
    };
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <p class="hint">${this._t("hint")}</p>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .hint { font-size: 12px; color: var(--secondary-text-color); margin: 8px 2px 0; }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
