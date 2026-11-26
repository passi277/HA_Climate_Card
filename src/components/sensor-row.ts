import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

export interface SensorItem {
  entity?: string;
  icon: string;
  label: string;
  value: string;
  warning?: boolean;
}

/** Kompakte Info-Kacheln für Zusatzsensoren. Klick öffnet den More-Info-Dialog. */
@customElement("hcc-sensor-row")
export class SensorRow extends LitElement {
  @property({ attribute: false }) items: SensorItem[] = [];

  private _open(entityId?: string): void {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  protected render() {
    return html`<div class="row">
      ${this.items.map((s) => html`
        <button class="item ${s.warning ? "warn" : ""}" title=${s.label} @click=${() => this._open(s.entity)}>
          <ha-icon .icon=${s.icon}></ha-icon>
          <div class="text"><span class="value">${s.value}</span><span class="label">${s.label}</span></div>
        </button>`)}
    </div>`;
  }

  static styles = css`
    .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(128px, 1fr)); gap: 8px; }
    .item {
      display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: none; border-radius: var(--hcc-inner-radius, 12px);
      background: var(--hcc-chip-bg, rgba(127,127,127,0.12)); color: var(--primary-text-color);
      font: inherit; text-align: left; cursor: pointer; min-width: 0;
    }
    .item:hover { background: rgba(127,127,127,0.2); }
    .item ha-icon { --mdc-icon-size: 20px; color: var(--secondary-text-color); flex: none; }
    .item.warn { background: color-mix(in srgb, var(--warning-color, #ff9800) 20%, transparent); }
    .item.warn ha-icon { color: var(--warning-color, #ff9800); }
    .text { display: flex; flex-direction: column; min-width: 0; }
    .value { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .label { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  `;
}
