import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, RecipeCardConfig } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";

/** Visueller Editor: Name, Mealie-Adresse (Bilder), Einkaufsliste, Mahlzeiten, Tage, Suche. */
@customElement("ha-recipe-card-editor")
export class HaRecipeCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: RecipeCardConfig;

  public setConfig(config: RecipeCardConfig): void {
    this._config = config;
  }

  private _schema() {
    return [
      { name: "name", selector: { text: {} } },
      { name: "mealie_url", selector: { text: {} } },
      { name: "shopping_list", selector: { entity: { filter: { domain: "todo" } } } },
      { name: "entry_types", selector: { select: { multiple: true, mode: "list", options: ["breakfast", "lunch", "dinner", "side", "dessert", "snack", "drink"].map((v) => ({ value: v, label: localize(this.hass, `recipe.type_${v}`) })) } } },
      { type: "grid", name: "", schema: [
        { name: "days", selector: { number: { min: 1, max: 14, mode: "box" } } },
        { name: "show_search", selector: { boolean: {} } },
      ] },
    ];
  }

  private _computeLabel = (s: { name: string }): string => localize(this.hass, `recipe_editor.${s.name}`);

  private _valueChanged(ev: CustomEvent): void {
    const v = ev.detail.value as Record<string, unknown>;
    const config = { ...this._config! } as Record<string, unknown>;
    for (const [k, val] of Object.entries(v)) {
      if (val === "" || val == null || (Array.isArray(val) && !val.length)) delete config[k];
      else config[k] = val;
    }
    this._config = config as RecipeCardConfig;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    return html`<ha-form .hass=${this.hass} .data=${this._config} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>
      <p class="hint">${localize(this.hass, "recipe_editor.hint")}</p>
      <div class="version">HA Modern Home Cards v${CARD_VERSION}</div>`;
  }

  static styles = css`
    :host { display: block; }
    .hint { font-size: 12.5px; color: var(--secondary-text-color); }
    .version { margin-top: 12px; text-align: right; font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; }
  `;
}
