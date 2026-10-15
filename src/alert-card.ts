import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { AlertCardConfig, AlertConfig, HomeAssistant } from "./types";
import { localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { alertActive, openContactsKey, resolveContacts } from "./utils";
import { fallbackIcon } from "./components/shortcut-row";
import "./alert-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-alert-card",
  name: "Modern Alert Card",
  description: "Hinweise, die nur erscheinen, wenn etwas los ist – z.B. „Fenster offen – Marcel“ oder „Saugroboter hat ein Problem“ (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const SEVERITY: Record<string, string> = {
  info: "var(--info-color, #039be5)",
  warning: "var(--warning-color, #fb8c00)",
  error: "var(--error-color, #e53935)",
  success: "var(--success-color, #43a047)",
};

interface ActiveAlert {
  key: string;
  title: string;
  message: string;
  icon: string;
  color: string;
  entity?: string;
  navigation_path?: string;
}

@customElement("ha-alert-card")
export class HaAlertCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  /** Vorschau im Kartenauswahl-Dialog bzw. Bearbeitungsmodus von HA */
  @property({ type: Boolean }) preview = false;
  @property({ type: Boolean }) editMode = false;
  @state() private _config?: AlertCardConfig;
  private _visible?: boolean;
  private _show = true;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-alert-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<AlertCardConfig> {
    return { contacts: Object.values(hass.states).filter((s) => ["window", "door"].includes(s.attributes.device_class)).slice(0, 3).map((s) => s.entity_id) };
  }

  public setConfig(config: AlertCardConfig): void {
    if (!config || (!config.alerts?.length && !config.contacts?.length)) {
      throw new Error("ha-alert-card: 'contacts' und/oder 'alerts' angeben");
    }
    this._config = { ...config };
  }

  public getCardSize(): number {
    return this._visible === false ? 0 : 1;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 4, rows: "auto" };
  }

  private _t(key: string): string {
    return localize(this.hass, `alert.${key}`);
  }

  private _alerts(): AlertConfig[] {
    const c = this._config!;
    return [...(c.contacts?.length ? [{ contacts: c.contacts }] : []), ...(c.alerts ?? [])];
  }

  private _watched(): string[] {
    return this._alerts().flatMap((a) => [a.entity, ...(a.contacts ?? []).map((x) => (typeof x === "string" ? x : x.entity))])
      .filter(Boolean) as string[];
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this._config) return true;
    return this._watched().some((id) => old.states[id] !== this.hass!.states[id]) || old.locale !== this.hass!.locale;
  }

  private _active(): ActiveAlert[] {
    const s = this.hass!.states;
    const out: ActiveAlert[] = [];
    this._alerts().forEach((a, i) => {
      const color = a.color ?? SEVERITY[a.severity ?? "warning"] ?? SEVERITY.warning;
      if (a.contacts?.length) {
        const open = resolveContacts(s, { contact_sensors: a.contacts }).filter((x) => x.open);
        const key = openContactsKey(open);
        if (!key) return;
        const doors = open.every((x) => x.type === "door");
        out.push({ key: `contacts-${i}`, title: a.title ?? this._t(key), message: a.message ?? open.map((x) => x.name).join(" · "),
          icon: a.icon ?? (doors ? "mdi:door-open" : "mdi:window-open-variant"), color, entity: open[0]!.entity, navigation_path: a.navigation_path });
        return;
      }
      const st = a.entity ? s[a.entity] : undefined;
      if (!st || !alertActive(st, a)) return;
      const name = st.attributes.friendly_name ?? a.entity!;
      out.push({ key: `alert-${i}`, title: a.title ?? name, message: a.message ?? (a.title ? this.hass!.formatEntityState?.(st) ?? st.state : ""),
        icon: a.icon ?? st.attributes.icon ?? fallbackIcon(st, a.entity!, a.title ?? ""), color, entity: a.entity, navigation_path: a.navigation_path });
    });
    return out;
  }

  /** Ohne aktive Hinweise verschwindet die Karte samt Platz (wie eine bedingte Karte). */
  private _setVisible(visible: boolean): void {
    if (this._visible === visible) return;
    this._visible = visible;
    this.toggleAttribute("hidden", !visible);
    this.style.display = visible ? "" : "none";
    this.dispatchEvent(new CustomEvent("card-visibility-changed", { detail: { value: visible }, bubbles: true, composed: true }));
  }

  protected updated(): void {
    if (this._config && this.hass) this._setVisible(this._show);
  }

  private _tap(a: ActiveAlert): void {
    if (a.navigation_path) {
      window.history.pushState(null, "", a.navigation_path);
      window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
      return;
    }
    if (a.entity) this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: a.entity }, bubbles: true, composed: true }));
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const active = this._active();
    const editing = this.preview || this.editMode;
    const ok = !active.length;
    this._show = !ok || !!c.show_ok || editing;
    if (ok && !c.show_ok && !editing) return nothing;
    return html`<ha-card class="alerts anim-${c.animations ?? "full"} ${ok ? "ok" : ""}">
      ${ok ? html`<div class="row ok-row" style="--ac:${SEVERITY.success}">
          <span class="badge"><ha-icon icon="mdi:check-circle-outline"></ha-icon></span>
          <span class="text"><span class="title">${c.ok_text ?? this._t("all_ok")}</span>
            ${editing && !c.show_ok ? html`<span class="msg">${this._t("hidden_hint")}</span>` : nothing}</span>
        </div>`
        : active.map((a) => html`<button class="row" style="--ac:${a.color}" data-key=${a.key} @click=${() => this._tap(a)}>
          <span class="badge"><ha-icon .icon=${a.icon}></ha-icon></span>
          <span class="text"><span class="title">${a.title}</span>${a.message ? html`<span class="msg">${a.message}</span>` : nothing}</span>
          ${a.navigation_path ? html`<ha-icon class="chev" icon="mdi:chevron-right"></ha-icon>` : nothing}
        </button>`)}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.alerts { padding: 6px; gap: 4px; }
    .row { position: relative; display: flex; align-items: center; gap: 14px; width: 100%; padding: 10px 12px 10px 10px; border: none;
      border-radius: var(--hcc-inner-radius, 14px); cursor: pointer; font: inherit; color: inherit; text-align: left; overflow: hidden;
      background: linear-gradient(90deg, color-mix(in srgb, var(--ac) 16%, transparent), color-mix(in srgb, var(--ac) 4%, transparent) 70%);
      animation: slide-in 0.45s var(--ease-out) both; transition: background 0.3s, transform 0.2s var(--ease-spring); }
    .row::before { content: ""; position: absolute; left: 0; top: 10px; bottom: 10px; width: 3px; border-radius: 0 3px 3px 0; background: var(--ac); }
    .row:hover { background: linear-gradient(90deg, color-mix(in srgb, var(--ac) 24%, transparent), color-mix(in srgb, var(--ac) 8%, transparent) 70%); }
    .row:active { transform: scale(0.985); }
    .row:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }
    .ok-row { cursor: default; }
    .badge { position: relative; flex: none; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center;
      color: var(--ac); background: color-mix(in srgb, var(--ac) 20%, transparent); }
    .badge ha-icon { --mdc-icon-size: 24px; }
    .row:not(.ok-row) .badge::after { content: ""; position: absolute; inset: 0; border-radius: 50%; border: 2px solid var(--ac);
      animation: ring 2.2s ease-out infinite; }
    @keyframes ring { 0% { transform: scale(1); opacity: 0.8; } 70%, 100% { transform: scale(1.45); opacity: 0; } }
    ha-card.anim-reduced .badge::after, ha-card.anim-off .badge::after { animation: none; opacity: 0; }
    ha-card.anim-off .row { animation: none; }
    .text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .title { font-size: 15px; font-weight: 600; line-height: 1.3; }
    .msg { font-size: 13px; color: var(--secondary-text-color); white-space: normal; line-height: 1.35; }
    .chev { flex: none; --mdc-icon-size: 22px; color: var(--secondary-text-color); }
  `];
}
