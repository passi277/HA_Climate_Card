import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CoverGroupCardConfig, HomeAssistant } from "./types";
import { CARD_VERSION } from "./const";
import { localize } from "./localize/localize";
import { parsePositions } from "./cover-editor";

@customElement("ha-cover-group-card-editor")
export class HaCoverGroupCardEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: CoverGroupCardConfig;

  public setConfig(config: CoverGroupCardConfig): void {
    this._config = config;
  }

  private _t(key: string): string {
    return localize(this.hass, `cover_group_editor.${key}`);
  }

  private _schema() {
    return [
      { name: "entities", required: true, selector: { entity: { multiple: true, filter: { domain: "cover" } } } },
      { type: "grid", name: "", schema: [
        { name: "title", selector: { text: {} } },
        { name: "icon", selector: { icon: {} } },
      ] },
      { type: "grid", name: "", schema: [
        { name: "show_covers", selector: { boolean: {} } },
        { name: "collapsed", selector: { boolean: {} } },
        { name: "show_positions", selector: { boolean: {} } },
      ] },
      { name: "positions", selector: { text: {} } },
      { name: "animations", selector: { select: { mode: "dropdown", options: ["full", "reduced", "off"].map((v) => ({ value: v, label: localize(this.hass, `editor.anim_${v}`) })) } } },
    ];
  }

  private _computeLabel = (s: { name: string }): string => this._t(s.name);

  private _valueChanged(ev: CustomEvent): void {
    const config = { ...ev.detail.value } as CoverGroupCardConfig;
    config.positions = parsePositions(config.positions);
    const previous = this._config?.entities ?? [];
    config.entities = (config.entities ?? []).map((e) => {
      const id = typeof e === "string" ? e : e.entity;
      return previous.find((p) => typeof p !== "string" && p.entity === id) ?? id;
    });
    for (const key of Object.keys(config) as (keyof CoverGroupCardConfig)[]) {
      const v = config[key];
      if (key !== "entities" && (v === "" || v == null)) delete config[key];
    }
    this._config = config;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this._config) return nothing;
    const data = {
      show_covers: true, collapsed: false, show_positions: true, animations: "full",
      ...this._config,
      positions: (this._config.positions ?? [0, 25, 50, 75, 100]).join(", "),
      entities: (this._config.entities ?? []).map((e) => (typeof e === "string" ? e : e.entity)),
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
