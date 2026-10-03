import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { EnergyCardConfig, EnergyEntity, HomeAssistant } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

interface Flat {
  title?: string;
  solar?: string;
  battery_discharge?: string;
  battery_charge?: string;
  battery_soc?: string;
  grid_import?: string;
  grid_export?: string;
  home?: string;
  devices?: string[];
}

const split = (x?: EnergyEntity): [string | undefined, string | undefined] =>
  typeof x === "string" ? [x, undefined] : [x?.consumption, x?.production];

const join = (consumption?: string, production?: string): EnergyEntity | undefined =>
  consumption && production ? { consumption, production } : consumption ?? (production ? { production } : undefined);

/** Visueller Editor für die Hauptentitäten; Namen/Farben der Verbraucher per YAML. */
@customElement("ha-energy-card-editor")
export class HaEnergyCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: EnergyCardConfig;

  public setConfig(config: EnergyCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `energy_editor.${key}`);
  }

  private _flat(): Flat {
    const e = this._config?.entities ?? {};
    const [bd, bc] = split(e.battery?.entity);
    const [gi, ge] = split(e.grid?.entity);
    return { title: this._config?.title, solar: e.solar?.entity, battery_discharge: bd, battery_charge: bc, battery_soc: e.battery?.state_of_charge,
      grid_import: gi, grid_export: ge, home: e.home?.entity, devices: e.individual?.map((i) => i.entity) };
  }

  private _schema() {
    const power = { entity: { filter: { domain: "sensor", device_class: "power" } } };
    return [
      { name: "title", selector: { text: {} } },
      { name: "solar", selector: power },
      { type: "grid", name: "", schema: [
        { name: "grid_import", selector: power },
        { name: "grid_export", selector: power },
      ] },
      { type: "grid", name: "", schema: [
        { name: "battery_discharge", selector: power },
        { name: "battery_charge", selector: power },
      ] },
      { name: "battery_soc", selector: { entity: { filter: { domain: "sensor", device_class: "battery" } } } },
      { name: "home", selector: power },
      { name: "devices", selector: { entity: { multiple: true, filter: { domain: "sensor", device_class: "power" } } } },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const f = ev.detail.value as Flat;
    const prev = this._config?.entities ?? {};
    const entities: EnergyCardConfig["entities"] = {};
    if (f.solar) entities.solar = { ...prev.solar, entity: f.solar };
    const bat = join(f.battery_discharge, f.battery_charge);
    if (bat || f.battery_soc) entities.battery = { ...prev.battery, entity: bat, state_of_charge: f.battery_soc };
    const grid = join(f.grid_import, f.grid_export);
    if (grid) entities.grid = { ...prev.grid, entity: grid };
    if (f.home) entities.home = { ...prev.home, entity: f.home };
    if (f.devices?.length) entities.individual = f.devices.map((id) => prev.individual?.find((i) => i.entity === id) ?? { entity: id });
    for (const v of Object.values(entities)) {
      if (v && typeof v === "object" && !Array.isArray(v)) for (const k of Object.keys(v)) if ((v as any)[k] == null) delete (v as any)[k];
    }
    const config: EnergyCardConfig = { ...this._config!, entities };
    if (f.title) config.title = f.title;
    else delete config.title;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    return html`<ha-form .hass=${this.hass} .data=${this._flat()} .schema=${this._schema()}
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
