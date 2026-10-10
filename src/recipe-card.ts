import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import type { HomeAssistant, RecipeCardConfig } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { formatMinutes, mealEntries, mealieMinutes, scaleIngredient, ymdLocal, type MealEntry } from "./utils";
import "./recipe-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-recipe-card",
  name: "Modern Recipe Card",
  description: "Rezepte & Essensplan (Mealie): Woche mit Mittag/Abend, „Zufällig“ und Rezeptsuche, Rezept mit Portionen-Umrechner, Zutaten und Schritten, einplanen und auf die Einkaufsliste (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const TYPE_ICONS: Record<string, string> = {
  breakfast: "mdi:coffee", lunch: "mdi:food", dinner: "mdi:silverware-fork-knife", side: "mdi:bowl-mix", dessert: "mdi:cupcake", snack: "mdi:food-apple", drink: "mdi:cup",
};

interface RecipeSummary { recipe_id: string; slug?: string; name: string; description?: string; total_time?: string; tags?: { name: string }[]; rating?: number | null; image?: string | null }

@customElement("ha-recipe-card")
export class HaRecipeCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: RecipeCardConfig;
  @state() private _entry?: string;
  @state() private _plan?: MealEntry[];
  @state() private _results?: RecipeSummary[];
  @state() private _query = "";
  @state() private _detail?: any;
  @state() private _servings = 0;
  @state() private _have = new Set<number>();
  @state() private _done = new Set<number>();
  @state() private _slot?: { date: string; type: string };
  @state() private _busy?: string;
  @state() private _error?: string;
  @query("dialog") private _dialog?: HTMLDialogElement;
  private _loaded = false;
  private _searchTimer?: number;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-recipe-card-editor");
  }

  public static getStubConfig(): Partial<RecipeCardConfig> {
    return {};
  }

  public setConfig(config: RecipeCardConfig): void {
    this._config = { ...(config ?? { type: "custom:ha-recipe-card" }) };
    this._loaded = false;
  }

  public getCardSize(): number {
    return 7;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  private _t(key: string): string {
    return localize(this.hass, `recipe.${key}`);
  }

  /** Daten kommen über Dienste – Zustandswechsel anderer Entitäten brauchen kein Neuzeichnen */
  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    return !old || old.locale !== this.hass!.locale || !this._loaded;
  }

  protected updated(): void {
    if (this.hass && !this._loaded) {
      this._loaded = true;
      this._init();
    }
  }

  private get _showPlan(): boolean {
    return this._config?.show_plan !== false;
  }

  private get _types(): string[] {
    return this._config?.entry_types?.length ? this._config.entry_types : ["lunch", "dinner"];
  }

  private async _service(service: string, data: Record<string, unknown> = {}, response = false): Promise<any> {
    const payload = { config_entry_id: this._entry, ...data };
    const res: any = await (this.hass as any).callService("mealie", service, payload, undefined, false, response);
    return response ? res?.response ?? res : res;
  }

  private _notify(message: string): void {
    this.dispatchEvent(new CustomEvent("hass-notification", { detail: { message }, bubbles: true, composed: true }));
  }

  private async _init(): Promise<void> {
    try {
      this._entry = this._config!.config_entry_id;
      if (!this._entry) {
        const entries: any[] = await this.hass!.callWS({ type: "config_entries/get", domain: "mealie" });
        this._entry = entries?.find((e) => e.state === "loaded")?.entry_id ?? entries?.[0]?.entry_id;
      }
      if (!this._entry) { this._error = this._t("no_mealie"); return; }
      await Promise.all([this._showPlan ? this._loadPlan() : undefined, this._config!.show_search !== false || !this._showPlan ? this._search("") : undefined]);
    } catch (err: any) {
      this._error = err?.message ?? String(err);
    }
  }

  private _days(): Date[] {
    const n = this._config?.days ?? 7;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: n }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i));
  }

  private async _loadPlan(): Promise<void> {
    const days = this._days();
    const res = await this._service("get_mealplan", { start_date: ymdLocal(days[0]!), end_date: ymdLocal(days[days.length - 1]!) }, true);
    this._plan = mealEntries(res);
  }

  private async _search(q: string): Promise<void> {
    const res = await this._service("get_recipes", { ...(q ? { search_terms: q } : {}), result_limit: q ? 12 : 6 }, true);
    const items = res?.recipes?.items ?? res?.items ?? [];
    this._results = items as RecipeSummary[];
  }

  private _onSearch(e: Event): void {
    this._query = (e.target as HTMLInputElement).value;
    window.clearTimeout(this._searchTimer);
    this._searchTimer = window.setTimeout(() => this._search(this._query.trim()).catch((err) => this._notify(String(err?.message ?? err))), 400);
  }

  private async _openRecipe(idOrSlug?: string): Promise<void> {
    if (!idOrSlug) return;
    window.dispatchEvent(new CustomEvent("haptic", { detail: "light" }));
    this._busy = `open:${idOrSlug}`;
    try {
      const res = await this._service("get_recipe", { recipe_id: idOrSlug }, true);
      this._detail = res?.recipe ?? res;
      this._servings = Number(this._detail?.recipe_servings) || 0;
      this._have = new Set();
      this._done = new Set();
      await this.updateComplete;
      this._dialog?.showModal();
    } catch (err: any) {
      this._notify(`${localize(this.hass, "card.error")}: ${err?.message ?? err}`);
    }
    this._busy = undefined;
  }

  private _close(): void {
    this._dialog?.close();
    this._detail = undefined;
  }

  private async _plan_(date: string, type: string, recipeId?: string): Promise<void> {
    window.dispatchEvent(new CustomEvent("haptic", { detail: "success" }));
    this._busy = `plan:${date}:${type}`;
    try {
      if (recipeId) await this._service("set_mealplan", { date, entry_type: type, recipe_id: recipeId });
      else await this._service("set_random_mealplan", { date, entry_type: type });
      if (this._showPlan) await this._loadPlan();
      else this._notify(this._t("planned"));
    } catch (err: any) {
      this._notify(`${localize(this.hass, "card.error")}: ${err?.message ?? err}`);
    }
    this._busy = undefined;
    this._slot = undefined;
  }

  private async _fillWeek(): Promise<void> {
    if (this._busy !== "fill-confirm") { this._busy = "fill-confirm"; window.setTimeout(() => { if (this._busy === "fill-confirm") this._busy = undefined; }, 4000); return; }
    this._busy = "fill";
    try {
      const taken = new Set((this._plan ?? []).map((e) => `${e.date}|${e.type}`));
      for (const d of this._days()) for (const type of this._types) {
        if (!taken.has(`${ymdLocal(d)}|${type}`)) await this._service("set_random_mealplan", { date: ymdLocal(d), entry_type: type });
      }
      await this._loadPlan();
    } catch (err: any) {
      this._notify(`${localize(this.hass, "card.error")}: ${err?.message ?? err}`);
    }
    this._busy = undefined;
  }

  private async _toShoppingList(lines: string[]): Promise<void> {
    const list = this._config?.shopping_list ?? "todo.mealie_einkaufsliste";
    if (!lines.length) return;
    this._busy = "shop";
    try {
      for (const item of lines) await this.hass!.callService("todo", "add_item", { entity_id: list, item });
      this._notify(this._t("added").replace("{n}", String(lines.length)));
      window.dispatchEvent(new CustomEvent("haptic", { detail: "success" }));
    } catch (err: any) {
      this._notify(`${localize(this.hass, "card.error")}: ${err?.message ?? err}`);
    }
    this._busy = undefined;
  }

  private _dayLabel(d: Date, i: number): string {
    if (i === 0) return this._t("today");
    if (i === 1) return this._t("tomorrow");
    return `${d.toLocaleDateString(getLanguage(this.hass), { weekday: "short" }).replace(/\.$/, "")} ${d.getDate()}.`;
  }

  private _image(r: { recipe_id?: string; image?: string | null }): string | undefined {
    const base = this._config?.mealie_url?.replace(/\/$/, "");
    return base && r.recipe_id && r.image ? `${base}/api/media/recipes/${r.recipe_id}/images/min-original.webp` : undefined;
  }

  private _renderWeek() {
    const days = this._days();
    const plan = this._plan ?? [];
    return html`<div class="week" style="--nt:${this._types.length}">
      <div class="day head"><span></span><div class="meals">${this._types.map((t) => html`<span class="t-head"><ha-icon .icon=${TYPE_ICONS[t] ?? "mdi:food"}></ha-icon>${this._t(`type_${t}`)}</span>`)}</div></div>
      ${days.map((d, i) => {
      const key = ymdLocal(d);
      const meals = plan.filter((e) => e.date === key);
      return html`<div class="day ${i === 0 ? "today" : ""}" data-date=${key}>
        <span class="d-label">${this._dayLabel(d, i)}</span>
        <div class="meals">${this._types.map((type) => {
          const m = meals.filter((e) => e.type === type);
          const slotOpen = this._slot?.date === key && this._slot.type === type;
          if (m.length) return html`<span class="slot">${m.map((e) => html`<button class="meal" data-type=${type} @click=${() => this._openRecipe(e.slug ?? e.recipeId)}>
            <span>${e.title}</span>${e.time ? html`<small>${formatMinutes(e.time)}</small>` : nothing}</button>`)}</span>`;
          return html`<span class="slot ${slotOpen ? "open" : ""}">
            <button class="meal empty" data-type=${type} aria-label=${this._t(`type_${type}`)} @click=${() => { this._slot = slotOpen ? undefined : { date: key, type }; }}>
              <ha-icon icon="mdi:plus"></ha-icon></button>
            ${slotOpen ? html`<span class="slot-menu">
              <button class="mini" data-act="random" ?disabled=${!!this._busy} @click=${() => this._plan_(key, type)}><ha-icon icon="mdi:dice-5"></ha-icon>${this._t("random")}</button>
              <button class="mini" data-act="pick" @click=${() => (this.renderRoot.querySelector("input.search") as HTMLInputElement | null)?.focus()}>
                <ha-icon icon="mdi:magnify"></ha-icon>${this._t("pick")}</button>
            </span>` : nothing}
          </span>`;
        })}</div>
      </div>`;
    })}</div>`;
  }

  private _renderResult(r: RecipeSummary) {
    const min = mealieMinutes(r.total_time);
    const img = this._image(r);
    return html`<button class="res" data-recipe=${r.slug ?? r.recipe_id} @click=${() => this._openRecipe(r.slug ?? r.recipe_id)}>
      <span class="r-img" style=${img ? `background-image:url('${img}')` : ""}>${img ? nothing : html`<ha-icon icon="mdi:chef-hat"></ha-icon>`}</span>
      <span class="r-text"><b>${r.name}</b>
        <small>${[min ? formatMinutes(min) : "", ...(r.tags ?? []).slice(0, 2).map((t) => t.name)].filter(Boolean).join(" · ")}</small></span>
      ${r.rating ? html`<span class="stars">${"★".repeat(Math.round(r.rating))}</span>` : nothing}
      ${this._busy === `open:${r.slug ?? r.recipe_id}` ? html`<ha-icon class="spin" icon="mdi:loading"></ha-icon>` : nothing}
    </button>`;
  }

  private _renderDetail() {
    const r = this._detail;
    if (!r) return nothing;
    const base = Number(r.recipe_servings) || 0;
    const factor = base && this._servings ? this._servings / base : 1;
    const ings: string[] = (r.ingredients ?? r.recipe_ingredient ?? []).map((i: any) => String(i.display || i.note || i.original_text || "").trim()).filter(Boolean);
    const steps: { title?: string; text: string }[] = (r.instructions ?? r.recipe_instructions ?? []).map((s: any) => ({ title: s.title, text: String(s.text ?? "") }));
    const total = mealieMinutes(r.total_time), prep = mealieMinutes(r.prep_time), cook = mealieMinutes(r.perform_time);
    const img = this._image(r);
    const today = ymdLocal(new Date());
    const tomorrow = ymdLocal(new Date(Date.now() + 86_400_000));
    const slot = this._slot;
    const missing = ings.map((t, i) => (this._have.has(i) ? "" : scaleIngredient(t, factor))).filter(Boolean);
    return html`
      ${img ? html`<div class="dl-img" style="background-image:url('${img}')"></div>` : nothing}
      <div class="dl-head"><h3>${r.name}</h3><button class="x" @click=${this._close} aria-label=${this._t("close")}><ha-icon icon="mdi:close"></ha-icon></button></div>
      ${r.description ? html`<p class="desc">${r.description}</p>` : nothing}
      <div class="facts">
        ${total ? html`<span><ha-icon icon="mdi:clock-outline"></ha-icon>${formatMinutes(total)}</span>` : nothing}
        ${prep ? html`<span><ha-icon icon="mdi:knife"></ha-icon>${this._t("prep")} ${formatMinutes(prep)}</span>` : nothing}
        ${cook ? html`<span><ha-icon icon="mdi:pot-steam-outline"></ha-icon>${this._t("cook")} ${formatMinutes(cook)}</span>` : nothing}
        ${(r.tags ?? []).map((t: any) => html`<span class="tag">${t.name}</span>`)}
      </div>
      <div class="plan-row">
        ${slot ? html`<button class="act primary" data-act="plan-slot" @click=${() => this._plan_(slot.date, slot.type, r.recipe_id).then(() => this._close())}>
          <ha-icon icon="mdi:calendar-plus"></ha-icon>${this._t("plan_for").replace("{day}", new Date(slot.date + "T12:00").toLocaleDateString(getLanguage(this.hass), { weekday: "short" })).replace("{type}", this._t(`type_${slot.type}`))}</button>`
          : html`<button class="act primary" data-act="plan-today" @click=${() => this._plan_(today, "dinner", r.recipe_id)}><ha-icon icon="mdi:calendar-today"></ha-icon>${this._t("plan_today")}</button>
            <button class="act" data-act="plan-tomorrow" @click=${() => this._plan_(tomorrow, "dinner", r.recipe_id)}><ha-icon icon="mdi:calendar-arrow-right"></ha-icon>${this._t("plan_tomorrow")}</button>`}
      </div>
      <div class="sec-head"><b>${this._t("ingredients")}</b>
        ${base ? html`<span class="serv"><button class="step" @click=${() => { this._servings = Math.max(1, this._servings - 1); }}><ha-icon icon="mdi:minus"></ha-icon></button>
          <span>${this._t("servings").replace("{n}", String(this._servings))}</span>
          <button class="step" @click=${() => { this._servings += 1; }}><ha-icon icon="mdi:plus"></ha-icon></button></span>` : nothing}
      </div>
      <ul class="ings">${ings.map((t, i) => html`<li class=${this._have.has(i) ? "have" : ""} @click=${() => { const s = new Set(this._have); s.has(i) ? s.delete(i) : s.add(i); this._have = s; }}>
        <ha-icon .icon=${this._have.has(i) ? "mdi:checkbox-marked-circle" : "mdi:checkbox-blank-circle-outline"}></ha-icon><span>${scaleIngredient(t, factor)}</span></li>`)}</ul>
      ${ings.length ? html`<button class="act" data-act="shop" ?disabled=${this._busy === "shop" || !missing.length} @click=${() => this._toShoppingList(missing)}>
        <ha-icon icon="mdi:cart-plus"></ha-icon>${this._t(this._have.size ? "add_missing" : "add_all").replace("{n}", String(missing.length))}</button>` : nothing}
      ${steps.length ? html`<div class="sec-head"><b>${this._t("steps")}</b><small>${this._done.size}/${steps.length}</small></div>
        <ol class="steps">${steps.map((s, i) => html`<li class=${this._done.has(i) ? "done" : ""} @click=${() => { const d = new Set(this._done); d.has(i) ? d.delete(i) : d.add(i); this._done = d; }}>
          <span class="n">${this._done.has(i) ? html`<ha-icon icon="mdi:check"></ha-icon>` : i + 1}</span>
          <span>${s.title ? html`<b>${s.title}</b><br>` : nothing}${s.text}</span></li>`)}</ol>` : nothing}`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const todayKey = ymdLocal(new Date());
    const todays = (this._plan ?? []).filter((e) => e.date === todayKey);
    const plan = this._showPlan;
    const sub = this._error ? this._error : !plan ? (this._results ? this._t("recipes_hint") : this._t("loading")) : !this._plan ? this._t("loading")
      : todays.length ? `${this._t("today")}: ${todays.map((e) => e.title).join(" · ")}` : this._t("nothing_today");
    const planned = (this._plan ?? []).length;
    return html`<ha-card class="recipes anim-${c.animations ?? "full"}" style="--hcc-accent-c:#fb8c00">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <span class="h-icon"><ha-icon icon="mdi:chef-hat"></ha-icon></span>
        <span class="head-text"><span class="h-title">${c.name ?? this._t(plan ? "title" : "title_recipes")}</span><span class="h-sub">${sub}</span></span>
        ${plan && this._plan ? html`<button class="fill ${this._busy === "fill-confirm" ? "confirm" : ""}" data-act="fill" ?disabled=${this._busy === "fill"} @click=${this._fillWeek}
          title=${this._t("fill_week")}><ha-icon class=${this._busy === "fill" ? "spin" : ""} .icon=${this._busy === "fill" ? "mdi:loading" : "mdi:dice-multiple"}></ha-icon>
          ${this._busy === "fill-confirm" ? this._t("confirm") : planned ? this._t("fill_gaps") : this._t("fill_week")}</button>` : nothing}
      </div>
      ${this._error || !plan ? nothing : !this._plan ? html`<div class="graph-placeholder"></div>` : this._renderWeek()}
      ${(c.show_search !== false || !plan) && !this._error ? html`<div class="search-box">
        <ha-icon icon="mdi:magnify"></ha-icon>
        <input class="search" type="search" .value=${this._query} placeholder=${this._slot ? this._t("search_for_slot") : this._t("search")} @input=${this._onSearch}>
      </div>
      ${this._results ? html`<div class="results">
        ${!this._query ? html`<small class="r-head">${this._t("newest")}</small>` : nothing}
        ${this._results.length ? this._results.map((r) => this._renderResult(r)) : html`<div class="empty">${this._t("no_results")}</div>`}</div>` : nothing}` : nothing}
      <dialog @close=${() => { this._detail = undefined; }} @click=${(e: Event) => { if (e.target === this._dialog) this._close(); }}>
        <div class="dl">${this._renderDetail()}</div>
      </dialog>
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.recipes { gap: 12px; container-type: inline-size; }
    .header { display: flex; align-items: center; gap: 10px; }
    .h-icon { flex: none; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center; color: var(--accent);
      background: color-mix(in srgb, var(--accent) 18%, transparent); }
    .h-icon ha-icon { --mdc-icon-size: 24px; }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .h-title { font-size: 17px; font-weight: 600; }
    .h-sub { font-size: 12.5px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .fill { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border: none; border-radius: 999px; cursor: pointer;
      font-size: 12.5px; font-weight: 700; background: rgba(127,127,127,0.14); }
    .fill.confirm { color: #fff; background: var(--accent); }
    .fill ha-icon { --mdc-icon-size: 17px; }

    .week { display: flex; flex-direction: column; gap: 4px; }
    .day { display: grid; grid-template-columns: 52px minmax(0, 1fr); align-items: start; gap: 8px; padding: 4px; border-radius: 12px; }
    .day.head { padding-top: 0; padding-bottom: 0; }
    .t-head { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: var(--secondary-text-color); }
    .t-head ha-icon { --mdc-icon-size: 14px; color: var(--accent); }
    .day.today { background: color-mix(in srgb, var(--accent) 9%, transparent); }
    .d-label { padding-top: 7px; font-size: 12.5px; font-weight: 700; color: var(--secondary-text-color); white-space: nowrap; }
    .day.today .d-label { color: var(--accent); }
    .meals { display: grid; grid-template-columns: repeat(var(--nt, 2), minmax(0, 1fr)); gap: 6px; }
    .slot { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .meal { display: flex; align-items: center; gap: 6px; width: 100%; min-height: 34px; box-sizing: border-box; padding: 6px 10px; border: none; border-radius: 10px; cursor: pointer;
      font-size: 13px; font-weight: 600; text-align: left; background: rgba(127,127,127,0.1); }
    .meal small { flex: none; font-size: 11px; color: var(--secondary-text-color); }
    .meal ha-icon { --mdc-icon-size: 16px; color: var(--accent); flex: none; }
    .meal:not(.empty) { flex-direction: column; align-items: flex-start; gap: 0; padding: 5px 9px; }
    .meal span { width: 100%; min-width: 0; font-size: 12.5px; line-height: 1.25; white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .meal.empty { justify-content: center; color: var(--secondary-text-color); background: none; box-shadow: inset 0 0 0 1.5px rgba(127,127,127,0.2); font-weight: 500; }
    .meal.empty ha-icon { color: var(--secondary-text-color); }
    .slot.open .meal.empty { box-shadow: inset 0 0 0 1.5px var(--accent); color: var(--accent); }
    .slot-menu { display: flex; flex-wrap: wrap; gap: 4px; animation: pop 0.2s var(--ease-out) both; }
    @keyframes pop { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: none; } }
    .mini { display: inline-flex; align-items: center; gap: 4px; padding: 5px 9px; border: none; border-radius: 999px; cursor: pointer;
      font-size: 12px; font-weight: 700; color: #fff; background: var(--accent); }
    .mini ha-icon { --mdc-icon-size: 15px; }

    .search-box { display: flex; align-items: center; gap: 8px; padding: 0 12px; border-radius: 999px; background: rgba(127,127,127,0.1); }
    .search-box ha-icon { --mdc-icon-size: 19px; color: var(--secondary-text-color); }
    .search { flex: 1; min-width: 0; border: none; outline: none; background: none; padding: 10px 0; font: inherit; font-size: 14px; color: var(--primary-text-color); }
    .results { display: flex; flex-direction: column; gap: 4px; }
    .r-head { font-size: 11.5px; font-weight: 700; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: 0.5px; padding: 0 4px; }
    .res { display: flex; align-items: center; gap: 10px; padding: 6px; border: none; border-radius: 12px; background: none; cursor: pointer; text-align: left; }
    .res:hover { background: rgba(127,127,127,0.07); }
    .r-img { flex: none; width: 42px; height: 42px; border-radius: 10px; display: grid; place-items: center; background: color-mix(in srgb, var(--accent) 14%, transparent) center/cover;
      color: var(--accent); }
    .r-img ha-icon { --mdc-icon-size: 20px; }
    .r-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .r-text b { font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .r-text small { font-size: 11.5px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .stars { flex: none; color: #ffb300; font-size: 12px; letter-spacing: -1px; }
    .spin { animation: spin 1s linear infinite; --mdc-icon-size: 18px; }
    .empty { padding: 10px; text-align: center; font-size: 13px; color: var(--secondary-text-color); }

    dialog { width: min(560px, calc(100vw - 24px)); max-height: calc(100vh - 48px); padding: 0; border: none; border-radius: 20px; overflow: auto;
      color: var(--primary-text-color); background: var(--card-background-color, var(--ha-card-background, #fff)); box-shadow: 0 12px 48px rgba(0,0,0,0.35); }
    dialog::backdrop { background: rgba(0,0,0,0.5); backdrop-filter: blur(3px); }
    .dl { display: flex; flex-direction: column; gap: 12px; padding: 0 18px 18px; }
    .dl-img { margin: 0 -18px; height: 180px; background: center/cover; }
    .dl-head { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; gap: 8px; padding: 14px 0 4px;
      background: var(--card-background-color, var(--ha-card-background, #fff)); }
    .dl-head h3 { flex: 1; margin: 0; font-size: 19px; line-height: 1.25; }
    .x { flex: none; width: 34px; height: 34px; border: none; border-radius: 50%; display: grid; place-items: center; cursor: pointer; background: rgba(127,127,127,0.14); }
    .desc { margin: 0; font-size: 13.5px; line-height: 1.45; color: var(--secondary-text-color); }
    .facts { display: flex; flex-wrap: wrap; gap: 6px; }
    .facts span { display: inline-flex; align-items: center; gap: 4px; padding: 4px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; background: rgba(127,127,127,0.1); }
    .facts ha-icon { --mdc-icon-size: 15px; color: #fb8c00; }
    .facts .tag { color: #fb8c00; background: color-mix(in srgb, #fb8c00 12%, transparent); }
    .plan-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .act { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border: none; border-radius: 999px; cursor: pointer; font-size: 13px; font-weight: 700;
      background: rgba(127,127,127,0.14); }
    .act.primary { color: #fff; background: #fb8c00; }
    .act:disabled { opacity: 0.5; cursor: default; }
    .act ha-icon { --mdc-icon-size: 17px; }
    .sec-head { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; font-size: 15px; }
    .sec-head small { color: var(--secondary-text-color); font-weight: 700; }
    .serv { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; }
    .step { width: 28px; height: 28px; border: none; border-radius: 50%; display: grid; place-items: center; cursor: pointer; background: rgba(127,127,127,0.14); }
    .step ha-icon { --mdc-icon-size: 15px; }
    .ings, .steps { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; }
    .ings li { display: flex; align-items: flex-start; gap: 8px; padding: 5px 4px; border-radius: 8px; font-size: 13.5px; cursor: pointer; }
    .ings li ha-icon { --mdc-icon-size: 18px; color: var(--secondary-text-color); flex: none; }
    .ings li.have { color: var(--secondary-text-color); text-decoration: line-through; }
    .ings li.have ha-icon { color: #43a047; }
    .steps li { display: flex; gap: 10px; padding: 8px 4px; border-radius: 10px; font-size: 13.5px; line-height: 1.45; cursor: pointer; }
    .steps .n { flex: none; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 800;
      color: #fff; background: #fb8c00; }
    .steps .n ha-icon { --mdc-icon-size: 15px; }
    .steps li.done { opacity: 0.5; }
    .steps li.done .n { background: #43a047; }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-recipe-card": HaRecipeCard;
  }
}
