import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, PlugCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

/** Visueller Editor: Titel, Steckdosen, Strompreis, Rückfrage, Verlauf, Spalten; „läuft nicht“-Warnung je Steckdose per YAML. */
@customElement("ha-plug-card-editor")
export class HaPlugCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: PlugCardConfig;

  public setConfig(config: PlugCardConfig): void {
    this._config = config;
  }

  private _schema() {
    return [
      { name: "title", selector: { text: {} } },
      { name: "entities", selector: { entity: { multiple: true, filter: [{ domain: "switch" }, { domain: "light" }] } } },
      { type: "grid", name: "", schema: [
        { name: "price", selector: { number: { min: 0, max: 2, step: 0.01, mode: "box" } } },
        { name: "columns", selector: { number: { min: 1, max: 4, mode: "box" } } },
        { name: "confirm_off", selector: { boolean: {} } },
        { name: "show_graph", selector: { boolean: {} } },
      ] },
    ];
  }

  private _computeLabel = (s: { name: string }): string => localize(this.hass, `plug_editor.${s.name}`);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, any>;
    const prev = this._config?.entities ?? [];
    const entities = ((v.entities ?? []) as string[]).map((id) => prev.find((p) => typeof p !== "string" && p.entity === id) ?? id);
    const config: PlugCardConfig = { ...this._config!, entities };
    if (v.title) config.title = String(v.title); else delete config.title;
    const p = Number(v.price);
    if (Number.isFinite(p) && p > 0 && p !== 0.3) config.price = p; else delete config.price;
    const cols = Number(v.columns);
    if (Number.isFinite(cols) && cols > 0 && cols !== 2) config.columns = cols; else delete config.columns;
    for (const k of ["confirm_off", "show_graph"] as const) { if (v[k] === false) config[k] = false; else delete config[k]; }
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const c = this._config;
    const data = { title: c.title ?? "", entities: (c.entities ?? []).map((e) => (typeof e === "string" ? e : e.entity)), price: c.price ?? 0.3,
      columns: c.columns ?? 2, confirm_off: c.confirm_off !== false, show_graph: c.show_graph !== false };
    return html`<ha-form .hass=${this.hass} .data=${data} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <p class="hint">${localize(this.hass, "plug_editor.hint")}</p>
      <pre class="example">entities:
  - entity: switch.shelly_kuhlschrank
    name: Kühlschrank
    alert_below: 5        # Watt
    alert_minutes: 90     # „läuft nicht?“</pre>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .hint { font-size: 12.5px; color: var(--secondary-text-color); }
    .example { font-size: 11px; margin: 0; padding: 8px 10px; border-radius: 8px; background: rgba(127,127,127,0.1); overflow-x: auto; }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
