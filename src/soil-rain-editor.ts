import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, SoilRainCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

/** Visueller Editor: Titel, Bodenfeuchte-Sensoren, Regensensor, Zeiträume; Bestätigung/Regensperre/Mengen per YAML. */
@customElement("ha-soil-rain-card-editor")
export class HaSoilRainCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: SoilRainCardConfig;

  public setConfig(config: SoilRainCardConfig): void {
    this._config = config;
  }

  private _schema() {
    return [
      { name: "title", selector: { text: {} } },
      { name: "soil", selector: { entity: { multiple: true, filter: [{ domain: "sensor", device_class: "moisture" }, { domain: "sensor" }] } } },
      { name: "rain", selector: { entity: { filter: [{ domain: "sensor" }, { domain: "binary_sensor" }] } } },
      { type: "grid", name: "", schema: [
        { name: "days", selector: { number: { min: 1, max: 30, mode: "box" } } },
        { name: "rain_hours", selector: { number: { min: 6, max: 168, mode: "box" } } },
      ] },
      { name: "note", selector: { text: { multiline: true } } },
    ];
  }

  private _computeLabel = (s: { name: string }): string => localize(this.hass, `soil_rain_editor.${s.name}`);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, any>;
    const c = this._config!;
    const prevSoil = c.soil ?? [];
    const soil = ((v.soil ?? []) as string[]).map((id) => prevSoil.find((p) => typeof p !== "string" && p.entity === id) ?? id);
    const config: SoilRainCardConfig = { ...c, soil };
    if (!soil.length) delete config.soil;
    const prevRain = c.rain;
    if (v.rain) config.rain = typeof prevRain === "object" && prevRain.entity === v.rain ? prevRain : v.rain; else delete config.rain;
    for (const k of ["title", "note"] as const) { if (v[k]) config[k] = String(v[k]); else delete config[k]; }
    const d = Number(v.days); if (Number.isFinite(d) && d > 0 && d !== 7) config.days = d; else delete config.days;
    const h = Number(v.rain_hours); if (Number.isFinite(h) && h > 0 && h !== 48) config.rain_hours = h; else delete config.rain_hours;
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const c = this._config;
    const data = { title: c.title ?? "", soil: (c.soil ?? []).map((e) => (typeof e === "string" ? e : e.entity)),
      rain: typeof c.rain === "string" ? c.rain : c.rain?.entity ?? "", days: c.days ?? 7, rain_hours: c.rain_hours ?? 48, note: c.note ?? "" };
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <p class="hint">${localize(this.hass, "soil_rain_editor.hint")}</p>
      <pre class="example">rain:
  entity: sensor.regensensor_rainwater
  confirmed: binary_sensor.regensensor_plausibel
  lock: binary_sensor.smarte_bewasserung_regensperre
  lock_reason: sensor.smarte_bewasserung_sperrgrund
  rain_today: sensor.regen_heute
  forecast: sensor.regenvorhersage_24_h</pre>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .hint { font-size: 12.5px; color: var(--secondary-text-color); }
    .example { font-size: 11px; margin: 0; padding: 8px 10px; border-radius: 8px; background: rgba(127,127,127,0.1); overflow-x: auto; }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
