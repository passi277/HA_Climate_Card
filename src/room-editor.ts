import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, RoomCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

@customElement("ha-room-card-editor")
export class HaRoomCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: RoomCardConfig;

  public setConfig(config: RoomCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `room_editor.${key}`);
  }

  private _schema() {
    return [
      { name: "layout", selector: { select: { mode: "dropdown", options: ["full", "tile"].map((v) => ({ value: v, label: this._t(`layout_${v}`) })) } } },
      { type: "grid", name: "", schema: [
        { name: "title", selector: { text: {} } },
        { name: "icon", selector: { icon: {} } },
      ] },
      { type: "grid", name: "", schema: [
        { name: "navigation_path", selector: { navigation: {} } },
        { name: "color", selector: { text: {} } },
      ] },
      { name: "light", selector: { entity: { filter: { domain: "light" } } } },
      { name: "contacts", selector: { entity: { multiple: true, filter: { domain: "binary_sensor" } } } },
      { type: "grid", name: "", schema: [
        { name: "temperature", selector: { entity: { filter: [{ domain: "sensor", device_class: "temperature" }, { domain: "climate" }] } } },
        { name: "humidity", selector: { entity: { filter: [{ domain: "sensor", device_class: "humidity" }, { domain: "climate" }] } } },
      ] },
      { name: "climate", selector: { entity: { filter: { domain: "climate" } } } },
      { name: "media", selector: { entity: { filter: [{ domain: "remote" }, { domain: "media_player" }] } } },
      { name: "trash", selector: { entity: { filter: { domain: "calendar" } } } },
      ...(this._config?.trash ? [{ type: "grid", name: "", schema: [
        { name: "trash_days", selector: { number: { min: 0, max: 14, step: 1, mode: "box" } } },
        { name: "trash_today_until", selector: { text: {} } },
      ] }] : []),
      { name: "chips", selector: { entity: { multiple: true } } },
      { type: "grid", name: "", schema: [
        { name: "window_warning", selector: { boolean: {} } },
        { name: "humidity_warning", selector: { number: { min: 30, max: 100, step: 1, mode: "box", unit_of_measurement: "%" } } },
      ] },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const config = { ...ev.detail.value } as RoomCardConfig;
    for (const key of ["contacts", "chips"] as const) {
      const list = config[key] as unknown[] | undefined;
      if (!Array.isArray(list)) continue;
      const previous = (this._config?.[key] ?? []) as (string | { entity: string })[];
      (config as any)[key] = list.map((e) => {
        const id = typeof e === "string" ? e : (e as { entity: string }).entity;
        return previous.find((p) => typeof p !== "string" && p.entity === id) ?? id;
      });
    }
    for (const key of Object.keys(config) as (keyof RoomCardConfig)[]) {
      const v = config[key];
      if (v === "" || v == null || (Array.isArray(v) && !v.length)) delete config[key];
    }
    if (config.window_warning === true) delete config.window_warning;
    if (config.layout === "full") delete config.layout;
    if (config.trash_days === 1) delete config.trash_days;
    if (config.trash_today_until === "10:00") delete config.trash_today_until;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const ids = (l?: (string | { entity: string })[]) => l?.map((e) => (typeof e === "string" ? e : e.entity));
    const data = { layout: "full", window_warning: true, humidity_warning: 65, trash_days: 1, trash_today_until: "10:00", ...this._config, contacts: ids(this._config.contacts), chips: ids(this._config.chips) };
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      ${this._config.layout === "tile" ? html`<p class="hint">${this._t("hint_tile")}</p>` : nothing}
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .hint { font-size: 12px; color: var(--secondary-text-color); margin: 8px 2px 0; }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
