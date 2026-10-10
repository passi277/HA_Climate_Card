import { LitElement, css, html, nothing, svg, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HassEntity, HomeAssistant, SpeedtestFeatures, StarlinkCardConfig, StarlinkFeatures } from "./types";
import { getLanguage, localize } from "./localize/localize";
import { cardStyles } from "./styles";
import { DOCS_URL } from "./shared";
import { relTime } from "./components/camera-view";
import { formatBytes, formatRate, formatUptime, pingQuality, speedtestFeatures, starlinkFeatures, toMbit, UNAVAILABLE } from "./utils";
import "./starlink-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "ha-starlink-card",
  name: "Modern Starlink Card",
  description: "Starlink-Schüssel mit Live-Durchsatz, Ping, Paketverlust, Warnungen, Verstauen/Neustart sowie externem Speedtest (Ookla) mit Verlauf und „Jetzt testen“ (HA Modern Home Cards).",
  preview: true,
  documentationURL: DOCS_URL,
});

type Phase = "online" | "obstructed" | "sleeping" | "stowed" | "offline" | "speedtest";

const PHASE_COLOR: Record<Phase, string> = {
  online: "var(--success-color, #43a047)",
  obstructed: "#fb8c00",
  sleeping: "var(--state-inactive-color, #8a8a8a)",
  stowed: "#1e88e5",
  offline: "var(--error-color, #e53935)",
  speedtest: "#7e57c2",
};
const PHASE_ICON: Record<Phase, string> = {
  online: "mdi:satellite-uplink", obstructed: "mdi:satellite-variant", sleeping: "mdi:sleep", stowed: "mdi:satellite-variant",
  offline: "mdi:satellite-uplink", speedtest: "mdi:speedometer",
};
const STARLINK_KEYS: (keyof StarlinkFeatures)[] = ["online", "ping", "drop", "down_rate", "up_rate", "down_total", "up_total", "power", "energy",
  "boot", "azimuth", "elevation", "obstructed", "heating", "sleeping", "update", "roaming", "thermal", "motors", "mast", "location", "ethernet",
  "stow", "sleep_schedule", "reboot"];
/** Warnungen (binary_sensor an = Problem), schwerste zuerst */
const ALERTS: { key: keyof StarlinkFeatures; icon: string; level: "bad" | "warn" | "info" }[] = [
  { key: "motors", icon: "mdi:engine-off-outline", level: "bad" },
  { key: "obstructed", icon: "mdi:tree-outline", level: "warn" },
  { key: "thermal", icon: "mdi:thermometer-alert", level: "warn" },
  { key: "location", icon: "mdi:map-marker-alert-outline", level: "warn" },
  { key: "ethernet", icon: "mdi:ethernet-off", level: "warn" },
  { key: "mast", icon: "mdi:arrow-up-bold-box-outline", level: "info" },
  { key: "roaming", icon: "mdi:earth", level: "info" },
  { key: "update", icon: "mdi:package-up", level: "info" },
];
/** So lange auf neue Speedtest-Werte warten */
const TEST_TIMEOUT_MS = 120_000;
const HISTORY_REFRESH_MS = 30 * 60_000;

interface Pt { t: number; v: number }

@customElement("ha-starlink-card")
export class HaStarlinkCard extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @state() private _config?: StarlinkCardConfig;
  @state() private _confirm?: string;
  /** Speedtest läuft: Zeitpunkt des Starts und Stand von last_updated davor */
  @state() private _testing?: { at: number; before?: string };
  @state() private _history: { down: Pt[]; up: Pt[] } = { down: [], up: [] };
  private _confirmTimer?: number;
  private _testTimer?: number;
  private _historyTimer?: number;
  private _historyKey = "";
  private _cache?: { key: unknown; s: Record<string, string | undefined>; t: Record<string, string | undefined> };

  public static getConfigElement(): HTMLElement {
    return document.createElement("ha-starlink-card-editor");
  }

  public static getStubConfig(hass: HomeAssistant): Partial<StarlinkCardConfig> {
    const ents = Object.values(hass.entities ?? {});
    const star = ents.find((e) => e.platform === "starlink" && e.entity_id.startsWith("binary_sensor.") && hass.states[e.entity_id]?.attributes.device_class === "connectivity")
      ?? ents.find((e) => e.platform === "starlink");
    const speed = ents.find((e) => e.platform === "speedtestdotnet" && /download/.test(e.entity_id))
      ?? ents.find((e) => e.platform === "speedtestdotnet");
    const out: Partial<StarlinkCardConfig> = {};
    if (star) out.entity = star.entity_id;
    if (speed) out.speedtest = speed.entity_id;
    if (!star && !speed) out.entity = "";
    return out;
  }

  public setConfig(config: StarlinkCardConfig): void {
    if (!config || (!config.entity && !config.speedtest && !config.speedtest_download)) {
      throw new Error("ha-starlink-card: 'entity' (Starlink) und/oder 'speedtest' angeben");
    }
    this._config = { ...config };
  }

  public getCardSize(): number {
    return 6;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._historyTimer = window.setInterval(() => this._loadHistory(true), HISTORY_REFRESH_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._historyTimer);
    clearTimeout(this._confirmTimer);
    clearTimeout(this._testTimer);
    this._historyKey = "";
  }

  private _t(key: string): string {
    return localize(this.hass, `starlink.${key}`);
  }

  // ---------- Entitäten ----------

  private _features(): { s: StarlinkFeatures; t: SpeedtestFeatures } {
    const hass = this.hass!;
    const c = this._config!;
    if (!this._cache || this._cache.key !== hass.entities) {
      this._cache = {
        key: hass.entities,
        s: c.entity ? starlinkFeatures(hass.states, hass.entities, c.entity) : {},
        t: c.speedtest || c.speedtest_download ? speedtestFeatures(hass.states, hass.entities, c.speedtest ?? c.speedtest_download) : {},
      };
    }
    const s: Record<string, string | undefined> = { ...this._cache.s };
    for (const k of STARLINK_KEYS) if (typeof c[k] === "string") s[k] = c[k] as string;
    // Ohne Gerät: die angegebene Entität als Konnektivität nutzen
    if (c.entity && !s.online && c.entity.startsWith("binary_sensor.")) s.online = c.entity;
    const t: Record<string, string | undefined> = { ...this._cache.t };
    for (const k of ["download", "upload", "ping"] as const) if (c[`speedtest_${k}`]) t[k] = String(c[`speedtest_${k}`]);
    return { s: s as StarlinkFeatures, t: t as SpeedtestFeatures };
  }

  private _ids(): string[] {
    const { s, t } = this._features();
    return [...Object.values(s), ...Object.values(t)].filter(Boolean) as string[];
  }

  protected shouldUpdate(changed: PropertyValues): boolean {
    if (!changed.has("hass") || changed.size > 1) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || !this._config) return true;
    return this._ids().some((id) => old.states[id] !== this.hass!.states[id]) || old.locale !== this.hass!.locale || old.entities !== this.hass!.entities;
  }

  protected updated(): void {
    const { t } = this._features();
    // Neue Speedtest-Werte → Test fertig
    if (this._testing && t.download) {
      const lu = this.hass!.states[t.download]?.last_updated;
      if (lu && lu !== this._testing.before) this._finishTest();
    }
    this._loadHistory();
  }

  private _st(id?: string): HassEntity | undefined {
    const st = id ? this.hass!.states[id] : undefined;
    return st && !UNAVAILABLE.includes(st.state) ? st : undefined;
  }

  private _num(id?: string): number | undefined {
    const st = this._st(id);
    if (!st) return undefined;
    const v = Number(st.state);
    return Number.isFinite(v) ? v : undefined;
  }

  private _on(id?: string): boolean {
    return this._st(id)?.state === "on";
  }

  private _mbit(id?: string): number | undefined {
    const v = this._num(id);
    return v == null ? undefined : toMbit(v, this._st(id)!.attributes.unit_of_measurement);
  }

  private _gb(id?: string): number | undefined {
    const v = this._num(id);
    if (v == null) return undefined;
    const u = String(this._st(id)!.attributes.unit_of_measurement ?? "GB");
    const f: Record<string, number> = { B: 1e-9, kB: 1e-6, KB: 1e-6, MB: 1e-3, GB: 1, TB: 1000, PB: 1e6, KiB: 1.024e-6, MiB: 1.048576e-3, GiB: 1.073741824, TiB: 1099.511627776 };
    return v * (f[u] ?? 1);
  }

  private _fmt(v: number, digits = 1): string {
    return v.toLocaleString(getLanguage(this.hass), { maximumFractionDigits: digits });
  }

  private _phase(s: StarlinkFeatures): Phase {
    if (!this._config!.entity) return "speedtest";
    const online = this._st(s.online);
    if (s.online && (!online || online.state === "off")) return this._on(s.stow) ? "stowed" : "offline";
    if (this._on(s.stow)) return "stowed";
    if (this._on(s.sleeping)) return "sleeping";
    if (this._on(s.obstructed)) return "obstructed";
    return "online";
  }

  // ---------- Aktionen ----------

  private _haptic(type = "light"): void {
    window.dispatchEvent(new CustomEvent("haptic", { detail: type }));
  }

  private async _call(domain: string, service: string, data: Record<string, unknown>): Promise<boolean> {
    try {
      await this.hass!.callService(domain, service, data);
      return true;
    } catch (err: any) {
      this._haptic("failure");
      this.dispatchEvent(new CustomEvent("hass-notification", {
        detail: { message: `${localize(this.hass, "card.error")}: ${err?.message ?? err}` }, bubbles: true, composed: true,
      }));
      return false;
    }
  }

  private _moreInfo(id?: string): void {
    if (!id) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
  }

  private _confirmed(key: string): boolean {
    if (this._confirm === key) { this._confirm = undefined; clearTimeout(this._confirmTimer); return true; }
    this._haptic("warning");
    this._confirm = key;
    clearTimeout(this._confirmTimer);
    this._confirmTimer = window.setTimeout(() => (this._confirm = undefined), 4000);
    return false;
  }

  private _toggle(id: string | undefined, confirmKey?: string): void {
    if (!id) return;
    // Nur das Einschalten (z.B. Verstauen) bestätigen lassen
    if (confirmKey && !this._on(id) && !this._confirmed(confirmKey)) return;
    this._haptic("selection");
    this._call("homeassistant", "toggle", { entity_id: id });
  }

  private _reboot(id?: string): void {
    if (!id || !this._confirmed("reboot")) return;
    this._haptic("medium");
    this._call("button", "press", { entity_id: id });
  }

  private async _runTest(): Promise<void> {
    const { t } = this._features();
    const id = t.download ?? t.upload ?? t.ping;
    if (!id || this._testing) return;
    this._haptic("medium");
    this._testing = { at: Date.now(), before: this.hass!.states[id]?.last_updated };
    clearTimeout(this._testTimer);
    this._testTimer = window.setTimeout(() => this._finishTest(), TEST_TIMEOUT_MS);
    // Ein Sensor genügt: die Integration misst alle Werte gemeinsam
    if (!(await this._call("homeassistant", "update_entity", { entity_id: id }))) this._finishTest();
  }

  private _finishTest(): void {
    if (!this._testing) return;
    this._testing = undefined;
    clearTimeout(this._testTimer);
    this._historyKey = "";
  }

  // ---------- Verlauf ----------

  private async _loadHistory(force = false): Promise<void> {
    const c = this._config;
    if (!c || !this.hass?.callWS || c.show?.history === false || c.show?.speedtest === false) return;
    const { t } = this._features();
    const ids = [t.download, t.upload].filter(Boolean) as string[];
    if (!ids.length) return;
    const key = `${ids.join(",")}|${c.history_days ?? 7}|${this.hass.states[ids[0]!]?.last_updated ?? ""}`;
    if (!force && key === this._historyKey) return;
    this._historyKey = key;
    const start = new Date(Date.now() - Math.max(1, c.history_days ?? 7) * 86400_000);
    try {
      const res = await this.hass.callWS<Record<string, { s?: string; lu?: number; lc?: number }[]>>({
        type: "history/history_during_period", start_time: start.toISOString(), end_time: new Date().toISOString(),
        entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false,
      });
      const pts = (id?: string): Pt[] => {
        if (!id) return [];
        const unit = this.hass!.states[id]?.attributes.unit_of_measurement;
        return (res?.[id] ?? []).map((p) => ({ t: (p.lu ?? p.lc ?? 0) * 1000, v: toMbit(Number(p.s), unit) }))
          .filter((p) => Number.isFinite(p.v) && p.t >= start.getTime() && p.v > 0);
      };
      this._history = { down: pts(t.download), up: pts(t.upload) };
    } catch {
      /* Verlauf nicht verfügbar */
    }
  }

  // ---------- Darstellung ----------

  private _renderLive(s: StarlinkFeatures, phase: Phase) {
    const lang = getLanguage(this.hass);
    const down = this._mbit(s.down_rate);
    const up = this._mbit(s.up_rate);
    const ping = this._num(s.ping);
    const drop = this._num(s.drop);
    const items = [
      down != null ? { key: "down", id: s.down_rate, icon: "mdi:arrow-down-bold", ...formatRate(down, lang), q: "" } : undefined,
      up != null ? { key: "up", id: s.up_rate, icon: "mdi:arrow-up-bold", ...formatRate(up, lang), q: "" } : undefined,
      ping != null ? { key: "ping", id: s.ping, icon: "mdi:timer-outline", v: this._fmt(ping, 0), unit: "ms", q: pingQuality(ping) } : undefined,
      drop != null ? { key: "drop", id: s.drop, icon: "mdi:package-variant-remove", v: this._fmt(drop * (drop <= 1 && this._st(s.drop)!.attributes.unit_of_measurement !== "%" ? 100 : 1), 1), unit: "%",
        q: drop < 1 ? "good" : drop < 5 ? "fair" : "bad" } : undefined,
    ].filter((x): x is NonNullable<typeof x> => !!x);
    if (!items.length || phase === "offline") return nothing;
    return html`<div class="live">${items.map((x) => html`<button class="tile ${x.q ? `q-${x.q}` : ""}" data-key=${x.key} @click=${() => this._moreInfo(x.id)}>
      <span class="t-top"><ha-icon .icon=${x.icon}></ha-icon><small>${this._t(x.key)}</small></span>
      <span class="t-val"><b>${x.v}</b><small>${x.unit}</small></span>
    </button>`)}</div>`;
  }

  private _renderAlerts(s: StarlinkFeatures, phase: Phase) {
    const active = ALERTS.filter((a) => this._on(s[a.key]));
    const offline = phase === "offline";
    if (!active.length && !offline) return nothing;
    return html`<div class="alerts">
      ${offline ? html`<button class="alert bad" @click=${() => this._moreInfo(s.online)}><ha-icon icon="mdi:lan-disconnect"></ha-icon><span>${this._t("alert_offline")}</span></button>` : nothing}
      ${active.map((a) => html`<button class="alert ${a.level}" data-key=${a.key} @click=${() => this._moreInfo(s[a.key])}>
        <ha-icon .icon=${a.icon}></ha-icon><span>${this._t(`alert_${a.key}`)}</span></button>`)}
    </div>`;
  }

  private _sparkline(down: Pt[], up: Pt[]) {
    const all = [...down, ...up];
    if (down.length < 2) return nothing;
    const W = 300, H = 56, pad = 4;
    const t0 = Math.min(...all.map((p) => p.t)), t1 = Math.max(...all.map((p) => p.t), t0 + 1);
    const max = Math.max(...all.map((p) => p.v), 1) * 1.08;
    const x = (t: number) => ((t - t0) / (t1 - t0)) * W;
    const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
    const line = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
    const area = `${line(down)}L${x(down[down.length - 1]!.t).toFixed(1)},${H}L${x(down[0]!.t).toFixed(1)},${H}Z`;
    const last = down[down.length - 1]!;
    return html`<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label=${this._t("history")}>
      <defs><linearGradient id="sl-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sc)" stop-opacity="0.35"></stop><stop offset="1" stop-color="var(--sc)" stop-opacity="0"></stop></linearGradient></defs>
      ${svg`<path class="s-area" d=${area}></path>`}
      ${up.length > 1 ? svg`<path class="s-up" d=${line(up)}></path>` : nothing}
      ${svg`<path class="s-down" d=${line(down)}></path>`}
      ${svg`<circle class="s-dot" cx=${x(last.t)} cy=${y(last.v)} r="3"></circle>`}
    </svg>`;
  }

  private _renderSpeedtest(t: SpeedtestFeatures) {
    const c = this._config!;
    const lang = getLanguage(this.hass);
    const down = this._mbit(t.download);
    const up = this._mbit(t.upload);
    const ping = this._num(t.ping);
    if (!t.download && !t.upload && !t.ping) return nothing;
    const ref = this._st(t.download) ?? this._st(t.upload) ?? this._st(t.ping);
    const server = ref?.attributes.server_name ? String(ref.attributes.server_name) : "";
    const when = ref ? relTime(ref.last_updated, lang) : "";
    const { down: hd, up: hu } = this._history;
    const avg = hd.length ? hd.reduce((a, p) => a + p.v, 0) / hd.length : undefined;
    const testing = !!this._testing;
    const vals = [
      { key: "download", id: t.download, icon: "mdi:download", v: down != null ? formatRate(down, lang) : undefined },
      { key: "upload", id: t.upload, icon: "mdi:upload", v: up != null ? formatRate(up, lang) : undefined },
      { key: "ping", id: t.ping, icon: "mdi:timer-outline", v: ping != null ? { v: this._fmt(ping, 0), unit: "ms" } : undefined, q: ping != null ? pingQuality(ping) : "" },
    ].filter((x) => x.id);
    return html`<div class="speed ${testing ? "testing" : ""}">
      <div class="sp-head">
        <span class="sec-title"><ha-icon icon="mdi:speedometer"></ha-icon><span>${this._t("speedtest")}</span></span>
        <span class="sp-meta">${testing ? this._t("testing") : [server, when].filter(Boolean).join(" · ")}</span>
      </div>
      <div class="sp-vals">${vals.map((x) => html`<button class="sp-val ${x.q ? `q-${x.q}` : ""}" data-key=${x.key} @click=${() => this._moreInfo(x.id)}>
        <small><ha-icon .icon=${x.icon}></ha-icon>${this._t(x.key)}</small>
        <span class="sp-num">${testing ? html`<span class="dots"><i></i><i></i><i></i></span>` : x.v ? html`<b>${x.v.v}</b><small>${x.v.unit}</small>` : html`<b>–</b>`}</span>
      </button>`)}</div>
      ${c.show?.history !== false && hd.length > 1 ? html`<div class="sp-hist">
        ${this._sparkline(hd, hu)}
        <div class="sp-legend"><span class="l-down">${this._t("download")}</span>${hu.length > 1 ? html`<span class="l-up">${this._t("upload")}</span>` : nothing}
          <span class="l-avg">${this._t("history_days").replace("{n}", String(c.history_days ?? 7))}${avg != null ? ` · Ø ${formatRate(avg, lang).v} ${formatRate(avg, lang).unit}` : ""}</span></div>
      </div>` : nothing}
      <button class="run" ?disabled=${testing} @click=${() => this._runTest()}>
        <ha-icon class=${testing ? "spin" : ""} .icon=${testing ? "mdi:loading" : "mdi:play-speed"}></ha-icon><span>${this._t(testing ? "testing" : "run_test")}</span>
      </button>
    </div>`;
  }

  private _renderUsage(s: StarlinkFeatures) {
    const lang = getLanguage(this.hass);
    const energy = this._num(s.energy);
    const dt = this._gb(s.down_total);
    const ut = this._gb(s.up_total);
    const items = [
      { id: s.down_total, icon: "mdi:cloud-download-outline", v: dt != null ? formatBytes(dt, lang) : undefined, l: this._t("down_total") },
      { id: s.up_total, icon: "mdi:cloud-upload-outline", v: ut != null ? formatBytes(ut, lang) : undefined, l: this._t("up_total") },
      { id: s.energy, icon: "mdi:lightning-bolt-outline", v: energy != null ? `${this._fmt(energy, energy < 100 ? 1 : 0)} ${this._st(s.energy)!.attributes.unit_of_measurement ?? "kWh"}` : undefined, l: this._t("energy") },
    ].filter((x) => x.v);
    if (!items.length) return nothing;
    return html`<div class="stats" style="--n:${items.length}">${items.map((x) => html`<button class="stat" @click=${() => this._moreInfo(x.id)}>
      <ha-icon .icon=${x.icon}></ha-icon><b>${x.v}</b><small>${x.l}</small></button>`)}</div>`;
  }

  private _renderControls(s: StarlinkFeatures) {
    const rows = [
      { key: "stow", id: s.stow, icon: "mdi:satellite-variant" },
      { key: "sleep_schedule", id: s.sleep_schedule, icon: "mdi:sleep" },
    ].filter((x) => x.id && this.hass!.states[x.id]);
    const reboot = s.reboot && this.hass!.states[s.reboot] ? s.reboot : undefined;
    if (!rows.length && !reboot) return nothing;
    return html`<div class="controls">
      ${rows.map((x) => {
        const on = this._on(x.id);
        const asking = this._confirm === x.key;
        return html`<button class="toggle-row ${on ? "on" : ""} ${asking ? "ask" : ""}" role="switch" aria-checked=${on} data-key=${x.key}
          ?disabled=${!this._st(x.id)} @click=${() => this._toggle(x.id, x.key === "stow" ? "stow" : undefined)}>
          <ha-icon .icon=${asking ? "mdi:alert" : x.icon}></ha-icon>
          <span class="tr-text">${asking ? this._t("confirm_stow") : this._t(x.key)}</span>
          <span class="sw"><span></span></span></button>`;
      })}
      ${reboot ? html`<button class="reboot ${this._confirm === "reboot" ? "ask" : ""}" data-key="reboot" @click=${() => this._reboot(reboot)}>
        <ha-icon .icon=${this._confirm === "reboot" ? "mdi:alert" : "mdi:restart"}></ha-icon>
        <span>${this._t(this._confirm === "reboot" ? "confirm_reboot" : "reboot")}</span></button>` : nothing}
    </div>`;
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    const c = this._config;
    const { s, t } = this._features();
    if (c.entity && !this.hass.states[c.entity]) {
      return html`<ha-card class="starlink"><div class="missing">${this._t("missing")}: ${c.entity}</div></ha-card>`;
    }
    const show = { live: true, speedtest: true, history: true, usage: true, controls: true, ...c.show };
    const phase = this._phase(s);
    const color = PHASE_COLOR[phase];
    const boot = this._st(s.boot);
    const uptime = boot && phase !== "offline" ? formatUptime((Date.now() - new Date(boot.state).getTime()) / 1000, this._t("day_short")) : "";
    const power = this._num(s.power);
    const heating = this._on(s.heating);
    const anchor = s.online ?? c.entity ?? t.download;
    const title = c.name ?? (c.entity ? this._t("title") : this._t("title_speedtest"));
    const sub = phase === "speedtest" ? this._t("sub_speedtest") : `${this._t(`phase_${phase}`)}${uptime && phase !== "stowed" ? ` · ${this._t("since")} ${uptime}` : ""}`;
    return html`<ha-card class="starlink anim-${c.animations ?? "full"} ${phase}" style="--hcc-accent-c:${color}; --pc:${color}">
      <div class="glow"><div class="blob b1"></div><div class="blob b2"></div></div>
      <div class="header">
        <button class="h-icon" @click=${() => this._moreInfo(anchor)} aria-label=${title}><ha-icon .icon=${PHASE_ICON[phase]}></ha-icon>
          ${phase === "online" ? html`<span class="beam"></span>` : nothing}</button>
        <button class="head-text" @click=${() => this._moreInfo(anchor)}>
          <span class="h-title">${title}</span>
          <span class="h-sub">${sub}</span>
        </button>
        ${heating ? html`<button class="chip heat" @click=${() => this._moreInfo(s.heating)} title=${this._t("heating")}><ha-icon icon="mdi:snowflake-melt"></ha-icon></button>` : nothing}
        ${power != null ? html`<button class="pill" @click=${() => this._moreInfo(s.power)} title=${this._t("power")}>
          <ha-icon icon="mdi:flash"></ha-icon>${this._fmt(power, 0)} W</button>` : nothing}
      </div>
      ${this._renderAlerts(s, phase)}
      ${show.live ? this._renderLive(s, phase) : nothing}
      ${show.speedtest ? this._renderSpeedtest(t) : nothing}
      ${show.usage ? this._renderUsage(s) : nothing}
      ${show.controls ? this._renderControls(s) : nothing}
    </ha-card>`;
  }

  static styles = [cardStyles, css`
    ha-card.starlink { --accent: var(--pc); gap: 12px; container-type: inline-size; }
    ha-card.starlink.sleeping .blob, ha-card.starlink.stowed .blob { opacity: 0.35; animation-play-state: paused; }
    .missing { padding: 8px; color: var(--error-color, #e53935); }
    .header { display: flex; align-items: center; gap: 10px; }
    .h-icon { position: relative; flex: none; width: 42px; height: 42px; border-radius: 50%; border: none; padding: 0; display: grid; place-items: center; cursor: pointer;
      color: var(--pc); background: color-mix(in srgb, var(--pc) 16%, transparent); transition: background 0.4s, color 0.4s; }
    .h-icon ha-icon { --mdc-icon-size: 24px; }
    .beam { position: absolute; inset: -3px; border-radius: 50%; border: 2px solid color-mix(in srgb, var(--pc) 60%, transparent); animation: beam 2.4s ease-out infinite; pointer-events: none; }
    @keyframes beam { from { transform: scale(0.85); opacity: 0.9; } to { transform: scale(1.45); opacity: 0; } }
    ha-card.anim-reduced .beam, ha-card.anim-off .beam { animation: none; opacity: 0; }
    .head-text { display: flex; flex-direction: column; min-width: 0; flex: 1; border: none; background: none; padding: 0; text-align: left; cursor: pointer; }
    .h-title { font-size: 17px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .h-sub { font-size: 13px; font-weight: 600; color: var(--pc); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .chip { flex: none; width: 34px; height: 34px; border-radius: 50%; border: none; padding: 0; display: grid; place-items: center; cursor: pointer;
      background: rgba(127,127,127,0.1); color: var(--secondary-text-color); }
    .chip ha-icon { --mdc-icon-size: 18px; }
    .chip.heat { color: #ff7043; background: color-mix(in srgb, #ff7043 14%, transparent); }
    .pill { flex: none; display: inline-flex; align-items: center; gap: 3px; padding: 6px 10px 6px 7px; border: none; border-radius: 999px; cursor: pointer;
      font-size: 13px; font-weight: 700; background: rgba(127,127,127,0.1); white-space: nowrap; }
    .pill ha-icon { --mdc-icon-size: 16px; color: #fbc02d; }

    /* Warnungen */
    .alerts { display: flex; flex-direction: column; gap: 6px; }
    .alert { --ac: #fb8c00; display: flex; align-items: center; gap: 10px; padding: 9px 12px; border: none; border-radius: var(--hcc-inner-radius, 14px); cursor: pointer;
      text-align: left; font-size: 13.5px; font-weight: 600; color: var(--ac); background: color-mix(in srgb, var(--ac) 13%, transparent); }
    .alert.bad { --ac: var(--error-color, #e53935); }
    .alert.info { --ac: #1e88e5; }
    .alert ha-icon { --mdc-icon-size: 20px; flex: none; }

    /* Live-Werte */
    .live { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    @container (max-width: 420px) { .live { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .tile { --qc: var(--primary-text-color); display: flex; flex-direction: column; gap: 4px; min-width: 0; padding: 10px; border: none; border-radius: var(--hcc-inner-radius, 14px);
      cursor: pointer; text-align: left; background: rgba(127,127,127,0.08); }
    .t-top { display: flex; align-items: center; gap: 5px; min-width: 0; color: var(--secondary-text-color); }
    .t-top ha-icon { --mdc-icon-size: 16px; flex: none; color: var(--accent); }
    .t-top small { font-size: 11.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .t-val { display: flex; align-items: baseline; gap: 3px; min-width: 0; }
    .t-val b { font-size: clamp(16px, 5cqi, 21px); color: var(--qc); white-space: nowrap; }
    .t-val small { font-size: 11.5px; color: var(--secondary-text-color); white-space: nowrap; }
    .q-good { --qc: var(--success-color, #43a047); }
    .q-fair { --qc: #fb8c00; }
    .q-bad { --qc: var(--error-color, #e53935); }
    .tile[data-key="down"] .t-top ha-icon { color: #29b6f6; }
    .tile[data-key="up"] .t-top ha-icon { color: #ab47bc; }

    /* Speedtest */
    .speed { --sc: #29b6f6; display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: var(--hcc-inner-radius, 14px); background: rgba(127,127,127,0.07); }
    .sp-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .sec-title { flex: none; display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--secondary-text-color); }
    .sec-title ha-icon { --mdc-icon-size: 16px; }
    .sp-meta { flex: 1; min-width: 0; text-align: right; font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sp-vals { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
    .sp-val { --qc: var(--primary-text-color); display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-width: 0; padding: 4px 2px; border: none; background: none; cursor: pointer; text-align: left; }
    .sp-val > small { display: flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 600; color: var(--secondary-text-color); white-space: nowrap; }
    .sp-val > small ha-icon { --mdc-icon-size: 15px; }
    .sp-val[data-key="download"] > small ha-icon { color: #29b6f6; }
    .sp-val[data-key="upload"] > small ha-icon { color: #ab47bc; }
    .sp-num { display: flex; align-items: baseline; gap: 3px; min-height: 30px; min-width: 0; }
    .sp-num b { font-size: clamp(20px, 7cqi, 28px); font-weight: 700; color: var(--qc); white-space: nowrap; letter-spacing: -0.01em; }
    .sp-num small { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; }
    .dots { display: inline-flex; gap: 4px; align-self: center; }
    .dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--sc); animation: dot 1s ease-in-out infinite; }
    .dots i:nth-child(2) { animation-delay: 0.15s; }
    .dots i:nth-child(3) { animation-delay: 0.3s; }
    @keyframes dot { 0%, 100% { opacity: 0.25; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-4px); } }
    .sp-hist { display: flex; flex-direction: column; gap: 4px; }
    .spark { width: 100%; height: 56px; display: block; overflow: visible; }
    .s-area { fill: url(#sl-fill); }
    .s-down { fill: none; stroke: var(--sc); stroke-width: 2px; vector-effect: non-scaling-stroke; stroke-linejoin: round; stroke-linecap: round; }
    .s-up { fill: none; stroke: #ab47bc; stroke-width: 1.5px; vector-effect: non-scaling-stroke; stroke-linejoin: round; stroke-dasharray: 4 3; opacity: 0.85; }
    .s-dot { fill: var(--sc); stroke: var(--card-background-color, #fff); stroke-width: 1.5px; vector-effect: non-scaling-stroke; }
    .sp-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; font-size: 11.5px; color: var(--secondary-text-color); }
    .sp-legend span::before { content: ""; display: inline-block; width: 10px; height: 3px; border-radius: 2px; margin-right: 5px; vertical-align: middle; background: currentColor; }
    .l-down::before { background: #29b6f6 !important; }
    .l-up::before { background: #ab47bc !important; }
    .l-avg { margin-left: auto; }
    .l-avg::before { display: none !important; }
    .run { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 12px; border: none; border-radius: 12px; cursor: pointer;
      font-size: 14px; font-weight: 700; color: #fff; background: var(--sc); transition: opacity 0.3s, transform 0.2s var(--ease-spring); }
    .run:active:not([disabled]) { transform: scale(0.98); }
    .run[disabled] { opacity: 0.6; cursor: default; }
    .run ha-icon { --mdc-icon-size: 20px; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Verbrauch */
    .stats { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 8px; }
    @container (max-width: 300px) { .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } .stat:last-child:nth-child(odd) { grid-column: span 2; } }
    .stat { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; min-width: 0; padding: 10px; border: none; border-radius: var(--hcc-inner-radius, 14px);
      cursor: pointer; background: rgba(127,127,127,0.07); text-align: left; }
    .stat ha-icon { --mdc-icon-size: 18px; color: var(--secondary-text-color); }
    .stat b { font-size: clamp(14px, 4.6cqi, 17px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .stat small { font-size: 11.5px; line-height: 1.25; color: var(--secondary-text-color); max-width: 100%; overflow-wrap: anywhere; }

    /* Steuerung */
    .controls { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 6px; }
    .toggle-row, .reboot { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 9px 10px; border: none; border-radius: 12px; cursor: pointer; text-align: left;
      font-size: 13.5px; font-weight: 600; background: rgba(127,127,127,0.08); transition: background 0.3s, color 0.3s; }
    .toggle-row[disabled] { opacity: 0.45; cursor: default; }
    .toggle-row > ha-icon, .reboot > ha-icon { --mdc-icon-size: 19px; color: var(--secondary-text-color); flex: none; transition: color 0.3s; }
    .toggle-row.on > ha-icon { color: #1e88e5; }
    .tr-text { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sw { position: relative; flex: none; width: 34px; height: 20px; border-radius: 10px; background: rgba(127,127,127,0.35); transition: background 0.3s; }
    .sw span { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 0.3s var(--ease-spring); box-shadow: 0 1px 2px rgba(0,0,0,0.3); }
    .toggle-row.on .sw { background: #1e88e5; }
    .toggle-row.on .sw span { transform: translateX(14px); }
    .reboot span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .toggle-row.ask, .reboot.ask { color: #f57c00; background: color-mix(in srgb, #f57c00 14%, transparent); }
    .toggle-row.ask > ha-icon, .reboot.ask > ha-icon { color: #f57c00; }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    "ha-starlink-card": HaStarlinkCard;
  }
}
