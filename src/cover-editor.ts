import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CoverCardConfig, HomeAssistant } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";
import { CoverFeature, coverSupports } from "./utils";

/** Positionsliste wird im Editor als Text „0, 25, 50, 75, 100“ bearbeitet. */
export const parsePositions = (v: unknown): number[] | undefined => {
  if (typeof v !== "string") return Array.isArray(v) ? v : undefined;
  const list = v.split(/[,; ]+/).map(Number).filter((n) => Number.isFinite(n) && n >= 0 && n <= 100);
  return list.length ? [...new Set(list)] : undefined;
};

@customElement("ha-cover-card-editor")
export class HaCoverCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: CoverCardConfig;

  public setConfig(config: CoverCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `cover_editor.${key}`);
  }

  /** Nur Bereiche anbieten, die der Rollladen (bzw. die Gruppe) kann. */
  private _showKeys(): string[] {
    const st = this._config?.entity ? this.hass?.states[this._config.entity] : undefined;
    if (!st) return ["covers", "positions", "tilt", "sky"];
    const members = Array.isArray(st.attributes.entity_id) ? st.attributes.entity_id as string[] : [];
    const all = [st, ...members.map((id) => this.hass!.states[id]).filter(Boolean)];
    const ok: Record<string, boolean> = {
      covers: members.length > 0 || !!this._config?.entities?.length,
      positions: coverSupports(st, CoverFeature.SET_POSITION),
      tilt: all.some((s) => coverSupports(s, CoverFeature.SET_TILT_POSITION) || coverSupports(s, CoverFeature.OPEN_TILT)),
      sky: true,
    };
    return Object.keys(ok).filter((k) => ok[k]);
  }

  private _schema() {
    const keys = this._showKeys();
    return [
      { name: "entity", required: true, selector: { entity: { domain: "cover" } } },
      { type: "grid", name: "", schema: [
        { name: "name", selector: { text: {} } },
        { name: "icon", selector: { icon: {} } },
      ] },
      { name: "layout", selector: { select: { mode: "box", options: [
        { value: "full", label: this._t("layout_full") },
        { value: "compact", label: this._t("layout_compact") },
      ] } } },
      ...(keys.length ? [{ type: "expandable", name: "show", title: this._t("sections"), icon: "mdi:eye-outline", schema: [
        { type: "grid", name: "", schema: keys.map((k) => ({ name: k, selector: { boolean: {} } })) },
      ] }] : []),
      ...(keys.includes("positions") ? [{ name: "positions", selector: { text: {} } }] : []),
      { type: "expandable", name: "", flatten: true, title: this._t("room"), icon: "mdi:window-shutter", schema: [
        { name: "auto_entities", selector: { boolean: {} } },
        { name: "entities", selector: { entity: { multiple: true, filter: { domain: "cover" } } } },
        { name: "contact_sensors", selector: { entity: { multiple: true, filter: { domain: "binary_sensor" } } } },
      ] },
      { type: "expandable", name: "", flatten: true, title: this._t("sky_section"), icon: "mdi:weather-sunset", schema: [
        { name: "sun_entity", selector: { entity: { filter: { domain: "sun" } } } },
        { name: "weather_entity", selector: { entity: { filter: { domain: "weather" } } } },
        { name: "travel_time", selector: { number: { min: 3, max: 120, step: 1, mode: "box", unit_of_measurement: "s" } } },
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
    const config = { ...ev.detail.value } as CoverCardConfig;
    config.positions = parsePositions(config.positions);
    if (Array.isArray(config.entities)) {
      const previous = this._config?.entities ?? [];
      config.entities = config.entities.map((e) => {
        const id = typeof e === "string" ? e : e.entity;
        return previous.find((p) => typeof p !== "string" && p.entity === id) ?? id;
      });
    }
    for (const key of Object.keys(config) as (keyof CoverCardConfig)[]) {
      const v = config[key];
      if (v === "" || v == null || (Array.isArray(v) && !v.length)) delete config[key];
    }
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const data = {
      layout: "full", auto_entities: true, expandable: true, animations: "full", travel_time: 20, sun_entity: "sun.sun",
      ...this._config,
      positions: (this._config.positions ?? [0, 25, 50, 75, 100]).join(", "),
      entities: this._config.entities?.map((e) => (typeof e === "string" ? e : e.entity)),
      show: { covers: true, positions: true, tilt: true, sky: true, ...(this._config.show ?? {}) },
    };
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
