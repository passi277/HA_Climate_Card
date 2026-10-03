import { LitElement, css, html, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

/** Popover-API (Top-Layer) wird nicht von `overflow: hidden` der Karte abgeschnitten. */
const SUPPORTS_POPOVER = typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;

export interface AttributeOption { value: string; label: string; }

/**
 * Beschriftete Auswahl für fan_mode / swing_mode / preset_mode o.ä. – als Chip-Reihe,
 * bei mehr als `dropdownThreshold` Optionen als Dropdown. Feuert `option-selected` mit `{ value }`.
 */
@customElement("hcc-attribute-select")
export class AttributeSelect extends LitElement {
  @property() label = "";
  @property() icon?: string;
  @property() selected?: string;
  @property({ attribute: false }) options: AttributeOption[] = [];
  @property({ type: Boolean }) disabled = false;
  /** Ab dieser Anzahl Optionen wird ein Dropdown statt Chips gezeigt (0 = immer Chips). */
  @property({ type: Number }) dropdownThreshold = 6;

  @state() private _open = false;
  @query(".trigger") private _trigger?: HTMLButtonElement;
  @query(".menu") private _menu?: HTMLElement;

  private _onViewportChange = (ev: Event) => {
    // Scrollen innerhalb der Liste selbst schließt sie nicht
    if (ev.type === "scroll" && this._menu && ev.composedPath().includes(this._menu)) return;
    this._close();
  };

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._close();
  }

  private _select(value: string): void {
    if (this.disabled || value === this.selected) return;
    this.dispatchEvent(new CustomEvent("option-selected", { detail: { value }, bubbles: true, composed: true }));
  }

  private get _useDropdown(): boolean {
    return this.dropdownThreshold > 0 && this.options.length > this.dropdownThreshold;
  }

  private _toggleMenu(): void {
    if (this._open) this._close();
    else this._openMenu();
  }

  private async _openMenu(): Promise<void> {
    if (this.disabled) return;
    this._open = true;
    await this.updateComplete;
    const menu = this._menu;
    if (!menu) return;
    if (SUPPORTS_POPOVER) {
      (menu as any).showPopover();
      this._position();
      window.addEventListener("scroll", this._onViewportChange, true);
      window.addEventListener("resize", this._onViewportChange);
    }
    const target = menu.querySelector<HTMLElement>(".option.on") ?? menu.querySelector<HTMLElement>(".option");
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "nearest" });
  }

  private _close(focusTrigger = false): void {
    window.removeEventListener("scroll", this._onViewportChange, true);
    window.removeEventListener("resize", this._onViewportChange);
    if (SUPPORTS_POPOVER && this._menu?.matches(":popover-open")) (this._menu as any).hidePopover();
    this._open = false;
    if (focusTrigger) this._trigger?.focus();
  }

  /** Liste am Auslöser ausrichten (rechtsbündig), bei Platzmangel nach oben öffnen. */
  private _position(): void {
    const trigger = this._trigger;
    const menu = this._menu;
    if (!trigger || !menu) return;
    const r = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(r.width, 220), vw - 16);
    const below = vh - r.bottom - 12;
    const above = r.top - 12;
    const openUp = below < 240 && above > below;
    const maxH = Math.min(340, openUp ? above : below);
    const left = Math.min(Math.max(8, r.right - width), vw - width - 8);
    Object.assign(menu.style, {
      width: `${width}px`,
      maxHeight: `${maxH}px`,
      left: `${left}px`,
      top: openUp ? "auto" : `${r.bottom + 6}px`,
      bottom: openUp ? `${vh - r.top + 6}px` : "auto",
    });
    menu.classList.toggle("up", openUp);
  }

  private _onMenuToggle(ev: Event): void {
    // Light-Dismiss (Klick daneben, Escape) durch die Popover-API
    if ((ev as ToggleEvent).newState === "closed" && this._open) this._close();
  }

  private _onMenuKey(ev: KeyboardEvent): void {
    const items = [...(this._menu?.querySelectorAll<HTMLElement>(".option") ?? [])];
    const idx = items.indexOf(this.shadowRoot!.activeElement as HTMLElement);
    const move = (i: number) => { ev.preventDefault(); items[(i + items.length) % items.length]?.focus(); };
    if (ev.key === "ArrowDown") move(idx + 1);
    else if (ev.key === "ArrowUp") move(idx - 1);
    else if (ev.key === "Home") move(0);
    else if (ev.key === "End") move(items.length - 1);
    else if (ev.key === "Escape" || ev.key === "Tab") { ev.preventDefault(); this._close(true); }
  }

  private _pick(value: string): void {
    this._select(value);
    this._close(true);
  }

  private _renderDropdown() {
    const current = this.options.find((o) => o.value === this.selected);
    const menu = html`<div class="menu ${SUPPORTS_POPOVER ? "" : "inline"}" role="listbox" aria-label=${this.label}
      popover=${SUPPORTS_POPOVER ? "auto" : nothing} @toggle=${this._onMenuToggle} @keydown=${this._onMenuKey}>
      ${this.options.map((o) => html`
        <button class="option ${o.value === this.selected ? "on" : ""}" role="option"
          aria-selected=${o.value === this.selected} @click=${() => this._pick(o.value)}>
          <span>${o.label}</span>
          ${o.value === this.selected ? html`<ha-icon icon="mdi:check"></ha-icon>` : nothing}
        </button>`)}
    </div>`;
    return html`<div class="dropdown-row">
      ${this._renderHead()}
      <button class="trigger ${this._open ? "open" : ""}" ?disabled=${this.disabled} aria-haspopup="listbox"
        aria-expanded=${this._open} aria-label=${this.label} @click=${this._toggleMenu}>
        <span>${current?.label ?? this.selected ?? "–"}</span>
        <ha-icon icon="mdi:chevron-down"></ha-icon>
      </button>
    </div>
    ${SUPPORTS_POPOVER || this._open ? menu : nothing}`;
  }

  private _renderHead() {
    return html`<div class="head">
      ${this.icon ? html`<ha-icon .icon=${this.icon}></ha-icon>` : nothing}
      <span>${this.label}</span>
    </div>`;
  }

  protected render() {
    if (this._useDropdown) return this._renderDropdown();
    return html`
      <div class="head">
        ${this.icon ? html`<ha-icon .icon=${this.icon}></ha-icon>` : nothing}
        <span>${this.label}</span>
      </div>
      <div class="chips" role="radiogroup" aria-label=${this.label}>
        ${this.options.map((o) => html`
          <button class="chip ${o.value === this.selected ? "on" : ""}" role="radio"
            aria-checked=${o.value === this.selected} ?disabled=${this.disabled}
            @click=${() => this._select(o.value)}>${o.label}</button>`)}
      </div>`;
  }

  static styles = css`
    :host { display: block; }
    .head { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500;
      color: var(--secondary-text-color); margin: 0 2px 6px; text-transform: uppercase; letter-spacing: 0.04em; }
    .head ha-icon { --mdc-icon-size: 16px; }
    .chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
    .chips::-webkit-scrollbar { display: none; }
    .chip {
      flex: 0 0 auto; border: none; border-radius: 999px; padding: 7px 14px; font: inherit; font-size: 13px;
      background: var(--hcc-chip-bg, rgba(127,127,127,0.12)); color: var(--primary-text-color);
      cursor: pointer; transition: background 0.2s, color 0.2s;
    }
    .chip:hover { background: rgba(127,127,127,0.2); }
    .chip.on { background: var(--hcc-accent, var(--primary-color)); color: var(--text-primary-color, #fff); }
    .chip:focus-visible { outline: 2px solid var(--hcc-accent, var(--primary-color)); outline-offset: 2px; }
    .chip:disabled { opacity: 0.5; cursor: default; }
    .dropdown-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .dropdown-row .head { margin: 0 2px; flex: none; }
    .trigger {
      display: flex; align-items: center; gap: 4px; min-width: 0; max-width: 60%; border: none; border-radius: 999px;
      padding: 7px 10px 7px 14px; font: inherit; font-size: 13px; cursor: pointer;
      background: var(--hcc-accent, var(--primary-color)); color: var(--text-primary-color, #fff);
      transition: filter 0.2s, box-shadow 0.2s;
    }
    .trigger span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .trigger:hover { filter: brightness(1.08); }
    .trigger:focus-visible { outline: 2px solid var(--hcc-accent, var(--primary-color)); outline-offset: 2px; }
    .trigger:disabled { opacity: 0.5; cursor: default; }
    .trigger ha-icon { --mdc-icon-size: 18px; flex: none; transition: transform 0.2s; }
    .trigger.open ha-icon { transform: rotate(180deg); }

    .menu {
      margin: 0; padding: 6px; border: none; border-radius: 16px; box-sizing: border-box;
      background: var(--card-background-color, var(--ha-card-background, #fff)); color: var(--primary-text-color);
      box-shadow: 0 8px 28px rgba(0,0,0,0.22), 0 0 0 1px var(--divider-color, rgba(127,127,127,0.18));
      overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin;
      flex-direction: column; gap: 2px;
    }
    .menu[popover] { position: fixed; inset: auto; }
    .menu:popover-open { display: flex; opacity: 1; transform: none;
      transition: opacity 0.15s, transform 0.15s, display 0.15s allow-discrete, overlay 0.15s allow-discrete; }
    @starting-style { .menu:popover-open { opacity: 0; transform: translateY(-4px); } }
    .menu.up:popover-open { transform-origin: bottom; }
    .menu.inline { display: flex; margin-top: 8px; max-height: 280px; box-shadow: none;
      background: var(--hcc-chip-bg, rgba(127,127,127,0.08)); }
    .option {
      display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; flex: none;
      border: none; border-radius: 10px; padding: 9px 12px; background: transparent; color: inherit;
      font: inherit; font-size: 14px; text-align: left; cursor: pointer;
    }
    .option:hover, .option:focus-visible { background: rgba(127,127,127,0.12); outline: none; }
    .option.on { background: color-mix(in srgb, var(--hcc-accent, var(--primary-color)) 16%, transparent);
      color: var(--hcc-accent, var(--primary-color)); font-weight: 600; }
    .option ha-icon { --mdc-icon-size: 18px; flex: none; }
  `;
}
