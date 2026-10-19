import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant, LlmCategory, LlmEvent, LlmTimelineCardConfig } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { relTime } from "./components/camera-view";
import { dayGroups, llmEvents, snapshotMediaId } from "./utils";
import "./llm-timeline-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-llm-timeline-card",
  name: "Modern LLM Vision Timeline",
  description: "KI-Kamera-Ereignisse aus LLM Vision: neuestes Ereignis groß mit Bild, Filter nach Personen/Fahrzeugen/Tieren, Zeitleiste nach Tagen und Detailansicht (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

const CAT: Record<LlmCategory, { icon: string; color: string }> = {
  person: { icon: "mdi:account", color: "#42a5f5" },
  vehicle: { icon: "mdi:car", color: "#ab47bc" },
  animal: { icon: "mdi:paw", color: "#fb8c00" },
  package: { icon: "mdi:package-variant-closed", color: "#a1887f" },
  nature: { icon: "mdi:leaf", color: "#66bb6a" },
  other: { icon: "mdi:eye-outline", color: "#26a69a" },
  none: { icon: "mdi:eye-off-outline", color: "#8a8a8a" },
};
const CAT_ORDER: LlmCategory[] = ["person", "vehicle", "animal", "package", "nature", "other", "none"];
const REFRESH_MS = 5 * 60_000;
/** Signierte Bild-URLs gelten 24 h – kartenübergreifend zwischenspeichern */
const URL_TTL_MS = 20 * 3600_000;
const urlCache = new Map<string, { url: string; at: number }>();

@customElement("ha-llm-timeline-card")
export class HaLlmTimelineCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: LlmTimelineCardConfig;
  @state() private _events: LlmEvent[] = [];
  @state() private _loading = false;
  @state() private _loaded = false;
  @state() private _filter: LlmCategory | "all" = "all";
  @state() private _camera?: string;
  @state() private _shown = 20;
  @state() private _open?: LlmEvent;
  @state() private _expanded = false;
  @state() private _urls: Record<string, string> = {};
  private _pending = new Set<string>();
  private _loadKey = "";
  private _timer?: number;

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-llm-timeline-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<LlmTimelineCardConfig> {
    const ids = Object.keys(hass.states).filter((id) => id.startsWith("calendar."));
    return { entity: ids.find((id) => /llm|vision|timeline/.test(id)) ?? ids[0] ?? "" };
  }

  public setConfig(config: LlmTimelineCardConfig): void {
    if (!config?.entity) throw new Error("ha-llm-timeline-card: 'entity' (calendar.llm_vision_timeline) angeben");
    if (this._config && (this._config.entity !== config.entity || this._config.days !== config.days)) this._loadKey = "";
    this._config = { ...config };
    this._shown = config.limit ?? 20;
  }

  public getCardSize(): number {
    return 8;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._timer = window.setInterval(() => this._load(true), REFRESH_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._timer);
    this._loadKey = "";
  }

  private _t(key: string): string {
    return localize(this.hass, `llm.${key}`);
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this._config) return true;
    return old.states[this._config.entity] !== this.hass!.states[this._config.entity] || old.locale !== this.hass!.locale;
  }

  protected updated(): void {
    this._load();
    this._resolveImages();
    const dlg = this.shadowRoot?.querySelector("dialog.detail") as HTMLDialogElement | null;
    if (dlg && this._open && !dlg.open) dlg.showModal?.();
  }

  // ---------- Daten ----------

  /** Neu laden, wenn sich der Kalender ändert (neues Ereignis) oder per Taste/Intervall */
  private async _load(force = false): Promise<void> {
    const c = this._config;
    const hass = this.hass;
    if (!c || !hass) return;
    const st = hass.states[c.entity];
    const key = `${c.entity}|${c.days ?? 7}|${st?.last_updated ?? ""}`;
    if (!force && key === this._loadKey) return;
    this._loadKey = key;
    this._loading = true;
    const days = Math.max(1, c.days ?? 7);
    const start = new Date(Date.now() - days * 86400_000);
    let events: LlmEvent[] = [];
    try {
      if ((hass as any).services?.llmvision?.get_events) {
        const pad = (n: number) => String(n).padStart(2, "0");
        const local = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())} ${pad(start.getHours())}:${pad(start.getMinutes())}:00`;
        const res: any = await (hass as any).callService("llmvision", "get_events", { start: local, limit: 500, include_no_activity: true }, undefined, false, true);
        events = llmEvents(res?.response ?? res);
      } else {
        throw new Error("no service");
      }
    } catch {
      // Fallback: Kalender-API (ohne Bilder) + Bild/Kamera des neuesten Ereignisses aus den Attributen
      try {
        const raw = await hass.callApi!<unknown[]>("GET", `calendars/${c.entity}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(new Date(Date.now() + 60_000).toISOString())}`);
        events = llmEvents(raw);
        const a = st?.attributes ?? {};
        const newest = events[0];
        if (newest && a.key_frame && (!a.title || a.title === newest.title)) {
          events[0] = { ...newest, image: String(a.key_frame), camera: a.camera_name ? String(a.camera_name) : undefined };
        }
      } catch {
        /* keine Daten */
      }
    }
    this._events = events;
    this._loading = false;
    this._loaded = true;
  }

  /** Signierte URLs für die sichtbaren Snapshots holen */
  private _resolveImages(): void {
    const hass = this.hass;
    if (!hass?.callWS) return;
    const want = [this._visible()[0], ...this._list().slice(0, this._shown), this._open].filter(Boolean) as LlmEvent[];
    for (const e of want) {
      const path = e.image;
      if (!path || this._urls[path] || this._pending.has(path)) continue;
      const cached = urlCache.get(path);
      if (cached && Date.now() - cached.at < URL_TTL_MS) { this._urls = { ...this._urls, [path]: cached.url }; continue; }
      const id = snapshotMediaId(path);
      if (!id) continue;
      this._pending.add(path);
      hass.callWS<{ url: string }>({ type: "media_source/resolve_media", media_content_id: id }).then((r) => {
        if (!r?.url) return;
        const url = r.url.startsWith("http") || r.url.startsWith("data:") ? r.url : (hass as any).hassUrl?.(r.url) ?? r.url;
        urlCache.set(path, { url, at: Date.now() });
        this._urls = { ...this._urls, [path]: url };
      }).catch(() => { /* nur Symbol anzeigen */ }).finally(() => this._pending.delete(path));
    }
  }

  /** Nach Kamera-Konfiguration und „Keine Aktivität“ gefiltert */
  private _visible(): LlmEvent[] {
    const c = this._config!;
    return this._events.filter((e) => (c.show_no_activity || e.category !== "none") && (!c.cameras?.length || (e.camera && c.cameras.includes(e.camera))));
  }

  /** Zusätzlich nach den Filter-Chips */
  private _list(): LlmEvent[] {
    return this._visible().filter((e) => (this._filter === "all" || e.category === this._filter) && (!this._camera || e.camera === this._camera));
  }

  // ---------- Darstellung ----------

  private _camName(id?: string): string {
    if (!id) return "";
    const n = this.hass!.states[id]?.attributes.friendly_name;
    return String(n ?? id.replace(/^\w+\./, "").replace(/_/g, " "))
      .replace(/\s*(standardauflösung|standardauflosung|hd|sd|fluent|clear|main|sub)$/i, "").trim();
  }

  private _time(iso: string): string {
    return new Date(iso).toLocaleTimeString(getLanguage(this.hass), { hour: "2-digit", minute: "2-digit" });
  }

  private _dayLabel(d: Date): string {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((today.getTime() - d.getTime()) / 86400_000);
    if (diff === 0) return this._t("today");
    if (diff === 1) return this._t("yesterday");
    return d.toLocaleDateString(getLanguage(this.hass), { weekday: "short", day: "numeric", month: "short" });
  }

  private _moreInfo(id?: string): void {
    if (!id) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  private _haptic(type = "selection"): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: type }));
  }

  private _openEvent(e: LlmEvent): void {
    this._haptic("light");
    this._open = e;
  }

  private _close(): void {
    (this.shadowRoot?.querySelector("dialog.detail") as HTMLDialogElement | null)?.close?.();
    this._open = undefined;
  }

  private _thumb(e: LlmEvent, cls = "thumb") {
    const url = e.image ? this._urls[e.image] : undefined;
    const meta = CAT[e.category];
    return url
      ? html`<img class=${cls} src=${url} alt="" loading="lazy" @error=${() => { const u = { ...this._urls }; delete u[e.image!]; this._urls = u; }} />`
      : html`<span class="${cls} ph" style="--cc:${meta.color}"><ha-icon .icon=${meta.icon}></ha-icon></span>`;
  }

  private _renderLatest(e?: LlmEvent) {
    if (!e) return nothing;
    const meta = CAT[e.category];
    const lang = getLanguage(this.hass);
    return html`<div class="latest" style="--cc:${meta.color}">
      <button class="hero" @click=${() => this._openEvent(e)} aria-label=${e.title}>
        ${this._thumb(e, "hero-img")}
        <span class="hero-shade"></span>
        <span class="hero-top">
          <span class="badge"><ha-icon .icon=${meta.icon}></ha-icon>${this._t(`one_${e.category}`)}</span>
          <span class="badge time">${this._t("latest")} · ${relTime(e.start, lang)}</span>
        </span>
        <span class="hero-text">
          <b>${e.title || this._t("untitled")}</b>
          <small>${this._time(e.start)}${e.camera ? html` · <ha-icon icon="mdi:cctv"></ha-icon>${this._camName(e.camera)}` : nothing}</small>
        </span>
      </button>
      ${e.description ? html`<button class="desc ${this._expanded ? "open" : ""}" @click=${() => { this._expanded = !this._expanded; }}>${e.description}</button>` : nothing}
    </div>`;
  }

  private _renderFilters(events: LlmEvent[]) {
    const counts = new Map<LlmCategory, number>();
    for (const e of events) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    const cats = CAT_ORDER.filter((k) => counts.get(k));
    const cams = [...new Set(events.map((e) => e.camera).filter(Boolean))] as string[];
    if (cats.length < 2 && cams.length < 2) return nothing;
    const chip = (key: LlmCategory | "all", n: number) => {
      const sel = this._filter === key;
      const meta = key === "all" ? { icon: "mdi:format-list-bulleted", color: "var(--primary-color)" } : CAT[key];
      return html`<button class="chip ${sel ? "sel" : ""}" style="--cc:${meta.color}" data-cat=${key} aria-pressed=${sel}
        @click=${() => { this._haptic(); this._filter = sel && key !== "all" ? "all" : key; this._shown = this._config!.limit ?? 20; }}>
        <ha-icon .icon=${meta.icon}></ha-icon><span>${this._t(key === "all" ? "all" : `cat_${key}`)}</span><small>${n}</small></button>`;
    };
    return html`<div class="filters">
      <div class="chips" role="group" aria-label=${this._t("filter")}>${chip("all", events.length)}${cats.map((k) => chip(k, counts.get(k)!))}</div>
      ${cams.length > 1 ? html`<div class="chips cams">${cams.map((cam) => {
        const sel = this._camera === cam;
        return html`<button class="chip cam ${sel ? "sel" : ""}" aria-pressed=${sel} @click=${() => { this._haptic(); this._camera = sel ? undefined : cam; }}>
          <ha-icon icon="mdi:cctv"></ha-icon><span>${this._camName(cam)}</span></button>`;
      })}</div>` : nothing}
    </div>`;
  }

  private _renderTimeline(list: LlmEvent[]) {
    if (!list.length) {
      return html`<div class="empty"><ha-icon icon="mdi:timeline-remove-outline"></ha-icon>
        <span>${this._loaded ? this._t("empty").replace("{n}", String(this._config!.days ?? 7)) : this._t("loading")}</span></div>`;
    }
    const groups = dayGroups(list.slice(0, this._shown));
    return html`<div class="timeline">
      ${groups.map((g) => html`<div class="day">
        <div class="day-head"><span>${this._dayLabel(g.date)}</span><small>${g.items.length}</small></div>
        ${g.items.map((e) => {
          const meta = CAT[e.category];
          return html`<button class="item" style="--cc:${meta.color}" data-cat=${e.category} @click=${() => this._openEvent(e)}>
            <span class="rail"><span class="dot"><ha-icon .icon=${meta.icon}></ha-icon></span></span>
            ${this._thumb(e)}
            <span class="i-text">
              <span class="i-head"><b>${e.title || this._t("untitled")}</b><time>${this._time(e.start)}</time></span>
              ${e.description ? html`<span class="i-desc">${e.description}</span>` : nothing}
              ${e.camera ? html`<span class="i-cam"><ha-icon icon="mdi:cctv"></ha-icon>${this._camName(e.camera)}</span>` : nothing}
            </span>
          </button>`;
        })}
      </div>`)}
      ${list.length > this._shown ? html`<button class="more" @click=${() => { this._shown += this._config!.limit ?? 20; }}>
        <ha-icon icon="mdi:chevron-down"></ha-icon>${this._t("more").replace("{n}", String(list.length - this._shown))}</button>` : nothing}
    </div>`;
  }

  private _renderDetail() {
    const e = this._open;
    if (!e) return nothing;
    const meta = CAT[e.category];
    const lang = getLanguage(this.hass);
    const date = new Date(e.start).toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" });
    return html`<dialog class="detail" style="--cc:${meta.color}" @close=${() => { this._open = undefined; }} @cancel=${() => { this._open = undefined; }}
      @click=${(ev: MouseEvent) => { if (ev.target === ev.currentTarget) this._close(); }}>
      <div class="d-img">${this._thumb(e, "d-pic")}
        <button class="d-close" aria-label=${this._t("close")} @click=${() => this._close()}><ha-icon icon="mdi:close"></ha-icon></button></div>
      <div class="d-body">
        <span class="badge solid"><ha-icon .icon=${meta.icon}></ha-icon>${this._t(`one_${e.category}`)}${e.label ? ` · ${e.label}` : ""}</span>
        <h3>${e.title || this._t("untitled")}</h3>
        <div class="d-meta"><ha-icon icon="mdi:clock-outline"></ha-icon>${date}, ${this._time(e.start)}${e.end ? `–${this._time(e.end)}` : ""} · ${relTime(e.start, lang)}</div>
        ${e.description ? html`<p>${e.description}</p>` : nothing}
        ${e.camera ? html`<button class="d-cam" @click=${() => { const cam = e.camera; this._close(); this._moreInfo(cam); }}>
          <ha-icon icon="mdi:cctv"></ha-icon><span>${this._camName(e.camera)}</span><small>${this._t("open_camera")}</small><ha-icon icon="mdi:chevron-right"></ha-icon></button>` : nothing}
      </div>
    </dialog>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const st = this.hass.states[c.entity];
    if (!st) return html`<ha-card class="llm"><div class="missing">${this._t("missing")}: ${c.entity}</div></ha-card>`;
    const visible = this._visible();
    const list = this._list();
    const latest = visible[0];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayCount = visible.filter((e) => new Date(e.start) >= today).length;
    const color = latest ? CAT[latest.category].color : "var(--primary-color)";
    const sub = latest
      ? `${todayCount ? this._t("today_count").replace("{n}", String(todayCount)) : this._t("today_none")} · ${this._t("last")} ${relTime(latest.start, getLanguage(this.hass))}`
      : this._loaded ? this._t("no_events") : this._t("loading");
    return html`<ha-card class="llm anim-${c.animations ?? "full"}" style="--hcc-accent-c:${color}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <span class="h-icon"><ha-icon icon="mdi:creation"></ha-icon></span>
        <button class="head-text" @click=${() => this._moreInfo(c.entity)}>
          <span class="h-title">${c.name ?? this._t("title")}</span>
          <span class="h-sub">${sub}</span>
        </button>
        <button class="refresh ${this._loading ? "spin" : ""}" aria-label=${this._t("refresh")} title=${this._t("refresh")}
          @click=${() => { this._haptic("light"); this._load(true); }}><ha-icon icon="mdi:refresh"></ha-icon></button>
      </div>
      ${c.show_latest !== false && this._filter === "all" && !this._camera ? this._renderLatest(latest) : nothing}
      ${c.show_filters !== false ? this._renderFilters(visible) : nothing}
      ${this._renderTimeline(c.show_latest !== false && this._filter === "all" && !this._camera ? list.slice(1) : list)}
      ${this._renderDetail()}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.llm { --accent: var(--hcc-accent-c); gap: 12px; container-type: inline-size; }
    .missing { padding: 8px; color: var(--error-color, #e53935); }
    .header { display: flex; align-items: center; gap: 10px; }
    .h-icon { flex: none; width: 42px; height: 42px; border-radius: 50%; display: grid; place-items: center;
      color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); transition: background 0.4s, color 0.4s; }
    .h-icon ha-icon { --mdc-icon-size: 24px; }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; border: none; background: none; padding: 0; text-align: left; cursor: pointer; }
    .h-title { font-size: 17px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .h-sub { font-size: 13px; font-weight: 600; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .refresh { flex: none; width: 34px; height: 34px; border-radius: 50%; border: none; padding: 0; display: grid; place-items: center; cursor: pointer;
      background: rgba(127,127,127,0.1); color: var(--secondary-text-color); }
    .refresh ha-icon { --mdc-icon-size: 18px; }
    .refresh.spin ha-icon { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Neuestes Ereignis */
    .latest { display: flex; flex-direction: column; gap: 6px; }
    .hero { position: relative; display: block; width: 100%; aspect-ratio: 16 / 9; max-height: 320px; padding: 0; border: none; cursor: pointer; overflow: hidden;
      border-radius: var(--hcc-inner-radius, 14px); background: color-mix(in srgb, var(--cc) 22%, #111); color: #fff; text-align: left; }
    .hero-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .hero-img.ph { display: grid; place-items: center; background: radial-gradient(120% 90% at 30% 20%, color-mix(in srgb, var(--cc) 45%, #222), #141414); }
    .hero-img.ph ha-icon { --mdc-icon-size: 64px; color: color-mix(in srgb, var(--cc) 70%, #fff); opacity: 0.7; }
    .hero-shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 30%, transparent 45%, rgba(0,0,0,0.78) 100%); }
    .hero-top { position: absolute; top: 10px; left: 10px; right: 10px; display: flex; justify-content: space-between; gap: 6px; }
    .badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 9px 4px 6px; border-radius: 999px; font-size: 11.5px; font-weight: 700;
      color: #fff; background: color-mix(in srgb, var(--cc) 75%, rgba(0,0,0,0.4)); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); white-space: nowrap; }
    .badge.time { background: rgba(0,0,0,0.4); padding-left: 9px; overflow: hidden; text-overflow: ellipsis; }
    .badge ha-icon { --mdc-icon-size: 15px; }
    .hero-text { position: absolute; left: 12px; right: 12px; bottom: 10px; display: flex; flex-direction: column; gap: 2px; text-shadow: 0 1px 3px rgba(0,0,0,0.5); }
    .hero-text b { font-size: clamp(16px, 5cqi, 21px); line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .hero-text small { display: flex; align-items: center; gap: 3px; font-size: 12.5px; font-weight: 600; opacity: 0.9; }
    .hero-text small ha-icon { --mdc-icon-size: 14px; }
    .desc { border: none; background: none; padding: 0 2px; text-align: left; cursor: pointer; font-size: 13.5px; line-height: 1.4; color: var(--primary-text-color);
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .desc.open { -webkit-line-clamp: unset; }

    /* Filter */
    .filters { display: flex; flex-direction: column; gap: 6px; }
    .chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 1px; }
    .chips::-webkit-scrollbar { display: none; }
    .chip { --cc: var(--primary-color); flex: none; display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px 6px 8px; border: none; border-radius: 999px;
      cursor: pointer; font-size: 12.5px; font-weight: 600; background: rgba(127,127,127,0.1); transition: background 0.25s, color 0.25s; }
    .chip ha-icon { --mdc-icon-size: 16px; color: var(--cc); }
    .chip small { font-weight: 700; color: var(--secondary-text-color); }
    .chip.sel { color: #fff; background: var(--cc); }
    .chip.sel ha-icon, .chip.sel small { color: #fff; }
    .chip.cam { --cc: var(--secondary-text-color); font-weight: 500; }
    .chip.cam.sel { --cc: var(--primary-color); }

    /* Zeitleiste */
    .timeline { display: flex; flex-direction: column; gap: 10px; }
    .day { display: flex; flex-direction: column; }
    .day-head { display: flex; align-items: baseline; gap: 6px; padding: 0 2px 4px; font-size: 12px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.04em; color: var(--secondary-text-color); }
    .day-head small { font-weight: 600; opacity: 0.7; }
    .item { display: grid; grid-template-columns: 26px 64px minmax(0, 1fr); align-items: start; gap: 10px; padding: 6px 6px 6px 0; border: none; background: none;
      cursor: pointer; text-align: left; border-radius: 12px; transition: background 0.2s; }
    .item:hover { background: rgba(127,127,127,0.07); }
    .rail { position: relative; align-self: stretch; display: flex; justify-content: center; }
    .rail::before { content: ""; position: absolute; top: -6px; bottom: -6px; width: 2px; background: rgba(127,127,127,0.2); }
    .day .item:first-of-type .rail::before { top: 14px; }
    .day .item:last-of-type .rail::before { bottom: calc(100% - 14px); }
    .day .item:only-of-type .rail::before { display: none; }
    .dot { position: relative; margin-top: 2px; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: var(--cc);
      box-shadow: 0 0 0 3px var(--card-background-color, var(--ha-card-background, #1c1c1c)); }
    .dot ha-icon { --mdc-icon-size: 15px; }
    .thumb { width: 64px; height: 48px; border-radius: 10px; object-fit: cover; background: rgba(127,127,127,0.12); display: block; }
    .thumb.ph { display: grid; place-items: center; background: color-mix(in srgb, var(--cc) 14%, transparent); }
    .thumb.ph ha-icon { --mdc-icon-size: 22px; color: var(--cc); }
    .i-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .i-head { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
    .i-head b { flex: 1; min-width: 0; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .i-head time { flex: none; font-size: 12px; font-weight: 600; color: var(--secondary-text-color); }
    .i-desc { font-size: 12.5px; line-height: 1.35; color: var(--secondary-text-color); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .i-cam { display: inline-flex; align-items: center; gap: 3px; font-size: 11.5px; color: var(--secondary-text-color); opacity: 0.85; }
    .i-cam ha-icon { --mdc-icon-size: 13px; }
    @container (max-width: 340px) { .item { grid-template-columns: 22px 52px minmax(0, 1fr); gap: 8px; } .thumb { width: 52px; height: 40px; } .dot { width: 22px; height: 22px; } }
    .more { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 9px; border: none; border-radius: 12px; cursor: pointer;
      font-size: 13px; font-weight: 600; background: rgba(127,127,127,0.08); color: var(--secondary-text-color); }
    .more ha-icon { --mdc-icon-size: 18px; }
    .empty { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 18px 8px; font-size: 13px; color: var(--secondary-text-color); text-align: center; }
    .empty ha-icon { --mdc-icon-size: 32px; opacity: 0.6; }

    /* Detail */
    dialog.detail { width: min(94vw, 640px); max-height: 92dvh; padding: 0; border: none; border-radius: var(--ha-card-border-radius, 16px); overflow: auto;
      color: var(--primary-text-color); background: var(--card-background-color, var(--ha-card-background, #1c1c1c)); }
    dialog.detail::backdrop { background: rgba(0,0,0,0.6); backdrop-filter: blur(3px); }
    .d-img { position: relative; aspect-ratio: 16 / 9; background: #111; }
    .d-pic { width: 100%; height: 100%; object-fit: contain; display: block; }
    .d-pic.ph { display: grid; place-items: center; background: radial-gradient(120% 90% at 30% 20%, color-mix(in srgb, var(--cc) 45%, #222), #141414); }
    .d-pic.ph ha-icon { --mdc-icon-size: 72px; color: color-mix(in srgb, var(--cc) 70%, #fff); opacity: 0.7; }
    .d-close { position: absolute; top: 10px; right: 10px; width: 36px; height: 36px; border-radius: 50%; border: none; padding: 0; display: grid; place-items: center;
      cursor: pointer; color: #fff; background: rgba(0,0,0,0.45); backdrop-filter: blur(4px); }
    .d-close ha-icon { --mdc-icon-size: 20px; }
    .d-body { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 14px 16px 16px; }
    .badge.solid { backdrop-filter: none; background: var(--cc); }
    .d-body h3 { margin: 0; font-size: 19px; line-height: 1.25; }
    .d-meta { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; font-size: 12.5px; color: var(--secondary-text-color); }
    .d-meta ha-icon { --mdc-icon-size: 15px; }
    .d-body p { margin: 0; font-size: 14.5px; line-height: 1.5; }
    .d-cam { align-self: stretch; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: none; border-radius: 12px; cursor: pointer; text-align: left;
      font-size: 14px; font-weight: 600; background: rgba(127,127,127,0.1); }
    .d-cam span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .d-cam small { color: var(--secondary-text-color); font-weight: 500; }
    .d-cam ha-icon { --mdc-icon-size: 20px; color: var(--secondary-text-color); }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-llm-timeline-card": HaLlmTimelineCard;
  }
}
