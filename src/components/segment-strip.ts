import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { HomeAssistant } from "../types";
import { lightColor } from "../utils";

export interface SegmentItem {
  entity: string;
  name: string;
}

/** LED-Streifen als Leiste: jedes Segment in seiner aktuellen Farbe, Tippen öffnet die Details. */
@customElement("hcc-segment-strip")
export class SegmentStrip extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ attribute: false }) items: SegmentItem[] = [];
  @property() label = "";

  private _open(entityId: string): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: "selection" }));
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this.hass || !this.items.length) return nothing;
    return html`<span class="label"><ha-icon icon="mdi:led-strip-variant"></ha-icon>${this.label}
        <span class="count">${this.items.length}</span></span>
      <div class="strip">
        ${this.items.map((s, i) => {
          const st = this.hass!.states[s.entity];
          const color = lightColor(st);
          const unavailable = !st || st.state === "unavailable";
          return html`<button class="seg ${color ? "on" : ""}" ?disabled=${unavailable} title=${s.name}
            aria-label=${s.name} style=${color ? `--sc:${color}` : ""} @click=${() => this._open(s.entity)}>
            <span class="num">${i + 1}</span>
          </button>`;
        })}
      </div>`;
  }

  static styles = css`
    :host { display: flex; flex-direction: column; gap: 8px; }
    .label { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--secondary-text-color); }
    .label ha-icon { --mdc-icon-size: 18px; }
    .count { margin-left: auto; font-size: 12px; opacity: 0.8; }
    .strip { display: flex; gap: 4px; padding: 4px; border-radius: 999px; background: rgba(127,127,127,0.12); }
    .seg { flex: 1; min-width: 0; height: 30px; border: none; border-radius: 999px; cursor: pointer; padding: 0;
      background: rgba(127,127,127,0.18); color: var(--secondary-text-color); font: inherit; font-size: 11px;
      transition: background 0.4s, box-shadow 0.4s, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .seg:hover { transform: scaleY(1.12); }
    .seg:active { transform: scale(0.94); }
    .seg:disabled { opacity: 0.35; cursor: default; }
    .seg.on { background: var(--sc); color: rgba(0,0,0,0.55);
      box-shadow: 0 0 12px color-mix(in srgb, var(--sc) 55%, transparent); }
    .seg:focus-visible { outline: 2px solid var(--hcc-accent, var(--primary-color)); outline-offset: 2px; }
    .num { pointer-events: none; font-weight: 600; }
  `;
}
