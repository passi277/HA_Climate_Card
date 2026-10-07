import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, SelectCardConfig, SelectEntityConfig, SelectLayout } from "./types";
import { localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { optionStyle, UNAVAILABLE } from "./utils";
import "./select-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-select-card",
  name: "Modern Select Card",
  description: "Dropdowns (input_select / select) als moderner Umschalter – Leiste, Chips, Kacheln, Liste oder kompaktes Dropdown, mit Symbolen und Farben je Option (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

interface Opt { value: string; name: string; icon: string; color: string }

interface Row {
  cfg: SelectEntityConfig;
  name: string;
  icon: string;
  options: Opt[];
  current?: string;
  layout: Exclude<SelectLayout, "auto">;
  up: boolean;
  unavailable: boolean;
}

@customElement("ha-select-card")
export class HaSelectCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: SelectCardConfig;
  @state() private _open?: string;
  /** Richtung des offenen Dropdowns (bei „auto“ beim Öffnen gemessen) */
  @state() private _openUp = false;
  /** Lage des schwebenden Menüs nach oben (Popover über dem Knopf, nicht von der Karte abgeschnitten) */
  @state() private _pop?: { left: number; bottom: number; width: number };
  private _outside = (ev: Event): void => {
    if (!ev.composedPath().includes(this)) this._close();
  };
  @state() private _confirm?: string;
  @state() private _pending: Record<string, string> = {};
  private _confirmTimer?: number;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-select-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<SelectCardConfig> {
    return { entity: Object.keys(hass.states).find((id) => id.startsWith("input_select.") || id.startsWith("select.")) ?? "" };
  }

  public setConfig(config: SelectCardConfig): void {
    if (!config || (!config.entity && !config.entities?.length)) throw new Error("ha-select-card: 'entity' oder 'entities' angeben");
    this._config = { ...config };
  }

  public getCardSize(): number {
    return 1 + 2 * (this._entities().length || 1);
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 4, rows: "auto" };
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._confirmTimer);
    this._close();
  }

  private _close(): void {
    this._open = undefined;
    this._pop = undefined;
    document.removeEventListener("pointerdown", this._outside, true);
    window.removeEventListener("scroll", this._outside, true);
    window.removeEventListener("resize", this._outside);
  }

  private _t(key: string): string {
    return localize(this.hass, `select.${key}`);
  }

  private _entities(): SelectEntityConfig[] {
    const c = this._config;
    if (!c) return [];
    const list = c.entities?.length ? c.entities : c.entity ? [{ entity: c.entity, name: c.name, icon: c.icon }] : [];
    return list.map((e) => {
      const base = typeof e === "string" ? { entity: e } : e;
      return { ...base, layout: base.layout ?? c.layout, dropdown_direction: base.dropdown_direction ?? c.dropdown_direction, options: { ...c.options, ...base.options }, confirm: base.confirm ?? c.confirm };
    });
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this._config) return true;
    return this._entities().some((e) => old.states[e.entity] !== this.hass!.states[e.entity]) || old.locale !== this.hass!.locale;
  }

  protected updated(changed: PropertyValues): void {
    // Optimistische Auswahl verwerfen, sobald HA den neuen Zustand meldet
    if (changed.has("hass") && Object.keys(this._pending).length) {
      const next = Object.fromEntries(Object.entries(this._pending).filter(([id, v]) => this.hass!.states[id]?.state !== v));
      if (Object.keys(next).length !== Object.keys(this._pending).length) this._pending = next;
    }
    const pop = this.renderRoot.querySelector<HTMLElement & { showPopover?: () => void }>(".pop");
    if (pop?.showPopover && !pop.matches(":popover-open")) pop.showPopover();
  }

  private _rows(): Row[] {
    const s = this.hass!.states;
    return this._entities().map((cfg) => {
      const st = s[cfg.entity];
      const raw = (st?.attributes.options as string[] | undefined) ?? [];
      const options = raw.filter((o) => !cfg.options?.[o]?.hide).map((o) => {
        const oc = cfg.options?.[o] ?? {};
        const auto = optionStyle(o);
        return { value: o, name: oc.name ?? o, icon: oc.icon ?? auto.icon, color: oc.color ?? auto.color };
      });
      const layout = !cfg.layout || cfg.layout === "auto" ? (options.length <= 4 ? "segment" : "chips") : cfg.layout;
      return {
        cfg, options, layout, up: this._open === cfg.entity && this._openUp, current: this._pending[cfg.entity] ?? st?.state,
        name: cfg.name ?? st?.attributes.friendly_name ?? cfg.entity,
        icon: cfg.icon ?? st?.attributes.icon ?? "mdi:form-dropdown",
        unavailable: !st || UNAVAILABLE.includes(st.state),
      };
    });
  }

  private _haptic(type = "light"): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: type }));
  }

  private _moreInfo(id: string): void {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  private _select(r: Row, o: Opt): void {
    if (r.unavailable || o.value === r.current) {
      if (r.layout === "dropdown") this._close();
      return;
    }
    const key = `${r.cfg.entity}|${o.value}`;
    if (r.cfg.confirm?.includes(o.value) && this._confirm !== key) {
      this._haptic("warning");
      this._confirm = key;
      clearTimeout(this._confirmTimer);
      this._confirmTimer = window.setTimeout(() => (this._confirm = undefined), 4000);
      return;
    }
    this._confirm = undefined;
    this._haptic("selection");
    this._pending = { ...this._pending, [r.cfg.entity]: o.value };
    if (r.layout === "dropdown") this._close();
    const domain = r.cfg.entity.split(".")[0]!;
    this.hass!.callService(domain, "select_option", { entity_id: r.cfg.entity, option: o.value }).catch((err: any) => {
      this._haptic("failure");
      const { [r.cfg.entity]: _drop, ...rest } = this._pending;
      this._pending = rest;
      this.dispatchEvent(new CustomEvent("hass-notification", {
        detail: { message: `${localize(this.hass, "card.error")}: ${err?.message ?? err}` }, bubbles: true, composed: true,
      }));
    });
  }

  private _label(r: Row, o: Opt): string {
    return this._confirm === `${r.cfg.entity}|${o.value}` ? this._t("confirm") : o.name;
  }

  private _renderOptions(r: Row) {
    const asking = (o: Opt) => this._confirm === `${r.cfg.entity}|${o.value}`;
    switch (r.layout) {
      case "segment": {
        const idx = r.options.findIndex((o) => o.value === r.current);
        const cur = r.options[idx];
        return html`<div class="segment" role="radiogroup" style="--n:${r.options.length};--i:${Math.max(0, idx)};--sc:${cur?.color ?? "transparent"}">
          ${idx >= 0 ? html`<span class="indicator"></span>` : nothing}
          ${r.options.map((o) => html`<button class="seg ${o.value === r.current ? "sel" : ""} ${asking(o) ? "ask" : ""}" role="radio" aria-checked=${o.value === r.current}
            ?disabled=${r.unavailable} @click=${() => this._select(r, o)} style="--oc:${o.color}">
            <ha-icon .icon=${asking(o) ? "mdi:alert-circle-outline" : o.icon}></ha-icon><span>${this._label(r, o)}</span></button>`)}
        </div>`;
      }
      case "chips":
        return html`<div class="chips" role="radiogroup">${r.options.map((o) => html`<button class="chip ${o.value === r.current ? "sel" : ""} ${asking(o) ? "ask" : ""}"
          role="radio" aria-checked=${o.value === r.current} ?disabled=${r.unavailable} style="--oc:${o.color}" @click=${() => this._select(r, o)}>
          <ha-icon .icon=${asking(o) ? "mdi:alert-circle-outline" : o.icon}></ha-icon>${this._label(r, o)}</button>`)}</div>`;
      case "tiles": {
        const cols = this._config!.columns ?? Math.min(4, Math.max(2, r.options.length));
        return html`<div class="tiles" role="radiogroup" style="--cols:${cols}">${r.options.map((o) => html`<button class="tile ${o.value === r.current ? "sel" : ""} ${asking(o) ? "ask" : ""}"
          role="radio" aria-checked=${o.value === r.current} ?disabled=${r.unavailable} style="--oc:${o.color}" @click=${() => this._select(r, o)}>
          <span class="t-icon"><ha-icon .icon=${asking(o) ? "mdi:alert-circle-outline" : o.icon}></ha-icon></span><span class="t-name">${this._label(r, o)}</span>
          ${o.value === r.current ? html`<ha-icon class="t-check" icon="mdi:check-circle"></ha-icon>` : nothing}</button>`)}</div>`;
      }
      case "dropdown": {
        const cur = r.options.find((o) => o.value === r.current);
        const open = this._open === r.cfg.entity;
        return html`<div class="dd ${open ? "open" : ""} ${r.up ? "up" : ""}">
          ${open && r.up ? this._pop
            ? html`<div class="pop" popover="manual" style="left:${this._pop.left}px;bottom:${this._pop.bottom}px;width:${this._pop.width}px">${this._renderList(r)}</div>`
            : this._renderList(r) : nothing}
          <button class="dd-btn" style="--oc:${cur?.color ?? "var(--secondary-text-color)"}" ?disabled=${r.unavailable} aria-expanded=${open}
            @click=${(ev: Event) => this._toggleDropdown(r, ev.currentTarget as HTMLElement, open)}>
            <ha-icon .icon=${cur?.icon ?? "mdi:help-circle-outline"}></ha-icon><span>${cur?.name ?? r.current ?? "–"}</span>
            <ha-icon class="chev ${(open ? !r.up : r.cfg.dropdown_direction === "up") ? "up" : ""}" icon="mdi:chevron-down"></ha-icon></button>
          ${open && !r.up ? this._renderList(r) : nothing}
        </div>`;
      }
      default:
        return this._renderList(r);
    }
  }

  private _toggleDropdown(r: Row, btn: HTMLElement, open: boolean): void {
    this._haptic("selection");
    if (open) {
      this._close();
      return;
    }
    const dir = r.cfg.dropdown_direction ?? "down";
    const rect = btn.getBoundingClientRect();
    let up = dir === "up";
    if (dir === "auto") {
      // Liste nach oben, wenn unten zu wenig Platz ist und oben mehr
      const need = r.options.length * 46 + 8;
      const below = window.innerHeight - rect.bottom;
      up = below < need && rect.top > below;
    }
    this._openUp = up;
    this._open = r.cfg.entity;
    // Nach oben schwebt die Liste über dem Knopf (Popover); ohne Popover-Unterstützung in der Karte
    this._pop = up && "showPopover" in HTMLElement.prototype
      ? { left: rect.left, bottom: window.innerHeight - rect.top + 6, width: rect.width } : undefined;
    if (this._pop) {
      document.addEventListener("pointerdown", this._outside, true);
      window.addEventListener("scroll", this._outside, true);
      window.addEventListener("resize", this._outside);
    }
  }

  private _renderList(r: Row) {
    const asking = (o: Opt) => this._confirm === `${r.cfg.entity}|${o.value}`;
    return html`<div class="list" role="radiogroup">${r.options.map((o) => html`<button class="li ${o.value === r.current ? "sel" : ""} ${asking(o) ? "ask" : ""}"
      role="radio" aria-checked=${o.value === r.current} ?disabled=${r.unavailable} style="--oc:${o.color}" @click=${() => this._select(r, o)}>
      <span class="li-icon"><ha-icon .icon=${asking(o) ? "mdi:alert-circle-outline" : o.icon}></ha-icon></span><span class="li-name">${this._label(r, o)}</span>
      <ha-icon class="li-check" .icon=${o.value === r.current ? "mdi:check-circle" : "mdi:circle-outline"}></ha-icon></button>`)}</div>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const rows = this._rows();
    const title = this._config.title;
    return html`<ha-card class="selects anim-${this._config.animations ?? "full"}">
      ${title ? html`<div class="title"><ha-icon icon="mdi:tune-variant"></ha-icon>${title}</div>` : nothing}
      ${rows.map((r) => {
        const cur = r.options.find((o) => o.value === r.current);
        return html`<div class="row ${r.unavailable ? "unavailable" : ""} l-${r.layout}" data-entity=${r.cfg.entity} style="--rc:${cur?.color ?? "var(--secondary-text-color)"}">
          <button class="r-head" @click=${() => this._moreInfo(r.cfg.entity)}>
            <span class="r-icon"><ha-icon .icon=${cur?.icon && r.layout !== "dropdown" ? cur.icon : r.icon}></ha-icon></span>
            <span class="r-name">${r.name}</span>
            ${r.unavailable ? html`<span class="r-val off">${this._t("unavailable")}</span>`
              : r.layout === "chips" || r.layout === "list" ? html`<span class="r-val">${cur?.name ?? r.current}</span>` : nothing}
          </button>
          ${r.options.length ? this._renderOptions(r) : nothing}
        </div>`;
      })}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.selects { gap: 14px; padding: 14px; }
    .title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; }
    .title ha-icon { --mdc-icon-size: 20px; color: var(--primary-color); }
    .row { display: flex; flex-direction: column; gap: 8px; container-type: inline-size; }
    .row.unavailable { opacity: 0.55; }
    .row.l-dropdown { flex-direction: row; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
    .row.l-dropdown .r-head { flex: 1 1 120px; }
    .row.l-dropdown .dd { flex: 1 1 160px; }
    .r-head { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 0; border: none; background: none; cursor: pointer; text-align: left; }
    .r-icon { flex: none; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: var(--rc);
      background: color-mix(in srgb, var(--rc) 16%, transparent); transition: color 0.4s, background 0.4s; }
    .r-icon ha-icon { --mdc-icon-size: 19px; }
    .r-name { flex: 1; min-width: 0; font-size: 14.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .r-val { flex: none; padding: 3px 10px; border-radius: 999px; font-size: 12.5px; font-weight: 700; color: var(--rc); background: color-mix(in srgb, var(--rc) 14%, transparent);
      transition: color 0.4s, background 0.4s; }
    .r-val.off { color: var(--secondary-text-color); background: rgba(127,127,127,0.12); }

    /* Leiste */
    .segment { position: relative; display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); padding: 4px; border-radius: 999px; background: rgba(127,127,127,0.1); isolation: isolate; }
    .indicator { position: absolute; z-index: -1; top: 4px; bottom: 4px; left: calc(4px + (100% - 8px) / var(--n) * var(--i)); width: calc((100% - 8px) / var(--n));
      border-radius: 999px; background: var(--sc); box-shadow: 0 2px 8px color-mix(in srgb, var(--sc) 40%, transparent); transition: left 0.35s cubic-bezier(0.34, 1.3, 0.64, 1), background 0.35s; }
    .seg { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-width: 0; padding: 8px 6px; border: none; border-radius: 999px; background: none; cursor: pointer;
      font-size: 13px; font-weight: 600; color: var(--secondary-text-color); transition: color 0.3s; }
    .seg span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .seg ha-icon { --mdc-icon-size: 17px; flex: none; }
    .seg.sel { color: #fff; }
    @container (max-width: 400px) { .seg { gap: 4px; padding: 8px 4px; font-size: 12.5px; } .segment[style*="--n:3"] .seg:not(.sel) ha-icon, .segment[style*="--n:4"] .seg:not(.sel) ha-icon { display: none; } }
    .seg.sel ha-icon { animation: pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .seg.ask { color: #e53935; }

    /* Chips */
    .chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin: 0 -4px; padding: 2px 4px; }
    .chips::-webkit-scrollbar { display: none; }
    .chip { flex: none; display: inline-flex; align-items: center; gap: 5px; padding: 7px 12px 7px 9px; border: none; border-radius: 999px; cursor: pointer; font-size: 13px; font-weight: 600;
      white-space: nowrap; color: var(--secondary-text-color); background: rgba(127,127,127,0.1); transition: background 0.3s, color 0.3s; }
    .chip ha-icon { --mdc-icon-size: 17px; color: var(--oc); transition: color 0.3s; }
    .chip.sel { color: #fff; background: var(--oc); box-shadow: 0 2px 8px color-mix(in srgb, var(--oc) 35%, transparent); }
    .chip.sel ha-icon { color: #fff; animation: pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }

    /* Kacheln */
    .tiles { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 8px; }
    .tile { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 6px 12px; border: none; border-radius: var(--hcc-inner-radius, 14px);
      cursor: pointer; background: rgba(127,127,127,0.08); transition: background 0.3s, box-shadow 0.3s, transform 0.2s; min-width: 0; }
    .tile:active { transform: scale(0.96); }
    .t-icon { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; color: var(--oc); background: color-mix(in srgb, var(--oc) 15%, transparent); transition: background 0.3s, color 0.3s; }
    .t-icon ha-icon { --mdc-icon-size: 26px; }
    .t-name { font-size: 13.5px; font-weight: 600; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .t-check { position: absolute; top: 6px; right: 6px; --mdc-icon-size: 18px; color: var(--oc); animation: pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .tile.sel { background: color-mix(in srgb, var(--oc) 13%, rgba(127,127,127,0.04)); box-shadow: inset 0 0 0 2px var(--oc); }
    .tile.sel .t-icon { color: #fff; background: var(--oc); }

    /* Liste / Dropdown */
    .list { display: flex; flex-direction: column; gap: 4px; padding: 4px; border-radius: var(--hcc-inner-radius, 14px); background: rgba(127,127,127,0.07); }
    .dd .list { margin-top: 6px; animation: fade-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both; }
    .dd.up .list { margin: 0 0 6px; animation-name: fade-in-up; }
    .pop { position: fixed; inset: auto; top: auto; right: auto; margin: 0; padding: 0; border: none; overflow: visible;
      background: var(--ha-card-background, var(--card-background-color, #1c1c1c)); color: var(--primary-text-color);
      border-radius: var(--hcc-inner-radius, 14px); box-shadow: 0 8px 28px rgba(0,0,0,0.35); }
    .dd.up .pop .list { margin: 0; max-height: 60vh; overflow-y: auto; }
    .row.l-dropdown .dd.up.open:has(.pop) { flex-basis: 160px; }
    @keyframes fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
    @keyframes fade-in-up { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
    .li { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: none; border-radius: 10px; background: none; cursor: pointer; text-align: left; transition: background 0.2s; }
    .li:hover { background: rgba(127,127,127,0.08); }
    .li-icon { flex: none; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; color: var(--oc); background: color-mix(in srgb, var(--oc) 14%, transparent); }
    .li-icon ha-icon { --mdc-icon-size: 17px; }
    .li-name { flex: 1; font-size: 14px; font-weight: 500; }
    .li-check { --mdc-icon-size: 20px; color: rgba(127,127,127,0.4); }
    .li.sel { background: color-mix(in srgb, var(--oc) 12%, transparent); }
    .li.sel .li-name { font-weight: 700; }
    .li.sel .li-check { color: var(--oc); }
    .dd-btn { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 10px 8px 12px; border: none; border-radius: 999px; cursor: pointer; font-size: 14px; font-weight: 600;
      background: color-mix(in srgb, var(--oc) 13%, rgba(127,127,127,0.06)); text-align: left; }
    .dd-btn > ha-icon:first-child { --mdc-icon-size: 18px; color: var(--oc); flex: none; }
    .dd-btn span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .chev { --mdc-icon-size: 20px; color: var(--secondary-text-color); transition: transform 0.3s; flex: none; }
    .chev.up { transform: rotate(180deg); }
    .row.l-dropdown .dd.open { flex-basis: 100%; }

    .ask, .chip.ask, .tile.ask, .li.ask { color: #e53935 !important; }
    .chip.ask, .tile.ask, .li.ask { background: color-mix(in srgb, #e53935 14%, transparent) !important; box-shadow: none !important; }
    .chip.ask ha-icon, .tile.ask ha-icon, .li.ask ha-icon { color: #e53935 !important; }
    button[disabled] { cursor: default; }
    @keyframes pop { 0% { transform: scale(0.7); } 60% { transform: scale(1.15); } 100% { transform: none; } }
    ha-card.anim-off .indicator { transition: none; }
    ha-card.anim-reduced *, ha-card.anim-off * { animation: none !important; }
  `];
}
