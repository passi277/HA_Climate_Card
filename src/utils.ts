import type { ContactConfig, ContactType, HassEntity } from "./types";
import { ACTION_ICONS, ACTION_TO_MODE, ClimateFeature, DEFAULT_SHOW, MODE_COLORS, MODE_ICONS, supports } from "./const";

export const UNAVAILABLE = ["unavailable", "unknown"];

/** Modi, in denen das Gerät selbst zwischen Heizen und Kühlen entscheidet. */
const AUTO_MODES = ["auto", "heat_cool"];

/**
 * Die gemeldete Aktion passt zum eingestellten Modus. Nach einem Moduswechsel melden viele Geräte
 * noch kurz die alte Aktion (z.B. "cooling" im Modus "heat") – dann zählt der Modus.
 */
const actionMatchesMode = (st: HassEntity, action?: string): boolean => {
  const mapped = ACTION_TO_MODE[action ?? ""];
  return !mapped || mapped === st.state || AUTO_MODES.includes(st.state);
};

/** Farbe nach eingestelltem Modus; nur bei Auto/Heizen-Kühlen nach der tatsächlichen Aktion. */
export const modeColor = (st: HassEntity, action: string | undefined = st.attributes.hvac_action): string => {
  if (st.state === "off" || UNAVAILABLE.includes(st.state)) return MODE_COLORS.off;
  if (AUTO_MODES.includes(st.state)) {
    const fromAction = ACTION_TO_MODE[action ?? ""];
    return MODE_COLORS[fromAction ?? st.state] ?? "var(--primary-color)";
  }
  return MODE_COLORS[st.state] ?? "var(--primary-color)";
};

/** Symbol der aktuellen Aktion, sofern sie zum Modus passt, sonst das Modus-Symbol. */
export const stateIcon = (st: HassEntity, action: string | undefined = st.attributes.hvac_action): string => {
  if (action && ACTION_ICONS[action] && actionMatchesMode(st, action)) return ACTION_ICONS[action];
  return MODE_ICONS[st.state] ?? "mdi:air-conditioner";
};

/** Gerät arbeitet gerade (heizt, kühlt, entfeuchtet, lüftet). */
export const isActive = (st: HassEntity, action: string | undefined = st.attributes.hvac_action): boolean => {
  if (st.state === "off" || UNAVAILABLE.includes(st.state)) return false;
  return !!action && !["idle", "off"].includes(action);
};

export interface InferOptions {
  /** Mittlere Ventilöffnung in % (Heizkörper) – über 2 % gilt als heizend */
  valve?: number;
  /** Ist-Temperatur (z.B. vom externen Sensor), sonst `current_temperature` */
  current?: number;
  /** Aktuelle Leistung in W – unter `powerThreshold` gilt das Gerät als im Leerlauf */
  power?: number;
  powerThreshold?: number;
  /** Toleranz um den Sollwert in Grad */
  hysteresis?: number;
}

const num2 = (v: unknown): number | undefined => {
  const n = v == null || v === "" ? NaN : Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Leitet die Tätigkeit für Geräte ohne `hvac_action` (z.B. Gree) ab: aus Modus, Ist- und
 * Solltemperatur und optional der Leistungsaufnahme.
 */
export const inferAction = (mode: string, attrs: Record<string, any>, opts: InferOptions = {}): string | undefined => {
  if (mode === "off") return "off";
  if (UNAVAILABLE.includes(mode)) return undefined;
  if (mode === "fan_only") return "fan";
  const threshold = opts.powerThreshold ?? 25;
  if (opts.power != null && opts.power < threshold) return "idle";
  if (mode === "dry") return "drying";
  if (opts.valve != null && (mode === "heat" || mode === "auto")) return opts.valve > 2 ? "heating" : "idle";
  const cur = opts.current ?? num2(attrs.current_temperature);
  const h = opts.hysteresis ?? 0.3;
  const target = num2(attrs.temperature);
  const low = num2(attrs.target_temp_low);
  const high = num2(attrs.target_temp_high);
  const running = opts.power != null; // Leistung über Schwelle → läuft sicher
  if (mode === "heat") return cur == null || target == null || cur < target - h ? "heating" : running ? "heating" : "idle";
  if (mode === "cool") return cur == null || target == null || cur > target + h ? "cooling" : running ? "cooling" : "idle";
  if (cur == null) return running ? "fan" : "idle";
  const lo = low ?? target;
  const hi = high ?? target;
  if (lo != null && cur < lo - h) return "heating";
  if (hi != null && cur > hi + h) return "cooling";
  return running ? "fan" : "idle";
};

/** Gemeldete Tätigkeit oder – falls das Gerät keine meldet – abgeleitete. */
export const effectiveAction = (st: HassEntity, opts: InferOptions = {}): { action?: string; inferred: boolean } => {
  const reported = st.attributes.hvac_action as string | undefined;
  if (reported) return { action: reported, inferred: false };
  return { action: inferAction(st.state, st.attributes, opts), inferred: true };
};

/** Leistung eines Sensors in W (kW wird umgerechnet). */
export const powerOf = (entity?: HassEntity): number | undefined => {
  if (!entity) return undefined;
  const v = num2(entity.state);
  if (v == null) return undefined;
  return /^kW$/i.test(entity.attributes.unit_of_measurement ?? "") ? v * 1000 : v;
};

const num = (raw: unknown): number | undefined => {
  const v = raw == null || raw === "" ? NaN : Number(raw);
  return Number.isFinite(v) ? v : undefined;
};

/** Temperatur aus Sensor, Thermostat (`current_temperature`) oder Wetter-Entität (`temperature`). */
export const temperatureOf = (entity?: HassEntity): number | undefined => {
  if (!entity || UNAVAILABLE.includes(entity.state)) return undefined;
  const domain = entity.entity_id.split(".")[0];
  if (domain === "climate") return num(entity.attributes.current_temperature);
  if (domain === "weather") return num(entity.attributes.temperature);
  // Nur echte Temperatursensoren: Einheit °C/°F/K oder device_class temperature
  // (verhindert z.B. "2" von einem Zähler-Sensor namens "Wetter").
  const unit = entity.attributes.unit_of_measurement as string | undefined;
  const isTemp = unit ? /^(°?[CF]|K)$/i.test(unit.trim()) : entity.attributes.device_class === "temperature";
  return isTemp ? num(entity.state) : undefined;
};

/** Taupunkt nach Magnus-Formel; Temperatur in der Einheit `unit` (°C/°F). */
export const dewPoint = (temp: number, humidity: number, unit = "°C"): number | undefined => {
  if (humidity <= 0 || humidity > 100) return undefined;
  const c = unit === "°F" ? ((temp - 32) * 5) / 9 : temp;
  const a = 17.62;
  const b = 243.12;
  const g = Math.log(humidity / 100) + (a * c) / (b + c);
  const dp = (b * g) / (a - g);
  return unit === "°F" ? (dp * 9) / 5 + 32 : dp;
};

export const WEATHER_ICONS: Record<string, string> = {
  "clear-night": "mdi:weather-night",
  cloudy: "mdi:weather-cloudy",
  exceptional: "mdi:alert-circle-outline",
  fog: "mdi:weather-fog",
  hail: "mdi:weather-hail",
  lightning: "mdi:weather-lightning",
  "lightning-rainy": "mdi:weather-lightning-rainy",
  partlycloudy: "mdi:weather-partly-cloudy",
  pouring: "mdi:weather-pouring",
  rainy: "mdi:weather-rainy",
  snowy: "mdi:weather-snowy",
  "snowy-rainy": "mdi:weather-snowy-rainy",
  sunny: "mdi:weather-sunny",
  windy: "mdi:weather-windy",
  "windy-variant": "mdi:weather-windy-variant",
};

/** "HH:MM:SS" → Sekunden */
export const durationToSeconds = (d?: string): number => {
  if (!d) return 0;
  const parts = d.split(":").map(Number);
  while (parts.length < 3) parts.unshift(0);
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
};

export const secondsToDuration = (s: number): string => {
  const p = (n: number) => String(Math.floor(n)).padStart(2, "0");
  return `${p(s / 3600)}:${p((s % 3600) / 60)}:${p(s % 60)}`;
};

export interface Sample { t: number; v: number; }

/** Steigung (Grad pro Minute) per linearer Regression über die Messpunkte. */
export const trendSlope = (samples: Sample[]): number | undefined => {
  if (samples.length < 2) return undefined;
  const t0 = samples[0].t;
  const xs = samples.map((s) => (s.t - t0) / 60000);
  const span = xs[xs.length - 1] - xs[0];
  if (span < 8) return undefined;
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = samples.reduce((a, s) => a + s.v, 0) / n;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => { num += (x - mx) * (samples[i].v - my); den += (x - mx) ** 2; });
  return den ? num / den : undefined;
};

/**
 * Geschätzte Minuten bis zum Ziel. `undefined`, wenn sich die Temperatur nicht (schnell genug)
 * in Richtung Ziel bewegt oder die Schätzung über 4 Stunden liegt.
 */
export const etaMinutes = (current: number, target: number, slope?: number): number | undefined => {
  if (slope == null || Math.abs(slope) < 0.008) return undefined;
  const minutes = (target - current) / slope;
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 240) return undefined;
  return minutes;
};

/** Farbton für eine Temperatur relativ zum Ziel: wärmer → orange, kälter → blau (max. bei 3° Abstand). */
export const temperatureTint = (current: number | undefined, target: number | undefined): string | undefined => {
  if (current == null || target == null) return undefined;
  const delta = current - target;
  if (Math.abs(delta) < 0.25) return undefined;
  const pct = Math.round(Math.min(1, Math.abs(delta) / 3) * 75);
  const color = delta > 0 ? "var(--state-climate-heat-color, #ff6d00)" : "var(--state-climate-cool-color, #2196f3)";
  return `color-mix(in srgb, ${color} ${pct}%, var(--primary-text-color))`;
};

export interface ResolvedContact {
  entity: string;
  name: string;
  type: ContactType;
  open: boolean;
}

/**
 * Tür oder Fenster: explizit konfiguriert, sonst aus der device_class (door/garage_door → Tür),
 * sonst am Namen erkannt ("Tür", "Door", "Tor") – Gruppen haben oft keine device_class.
 */
export const contactType = (entity?: HassEntity, override?: ContactType): ContactType => {
  if (override) return override;
  const dc = entity?.attributes.device_class;
  if (dc === "door" || dc === "garage_door") return "door";
  const name = `${entity?.attributes.friendly_name ?? ""} ${entity?.entity_id ?? ""}`;
  // Homematic meldet Türkontakte oft als device_class „window“ – ein eindeutiger Name gewinnt
  const doorName = /t(ü|ue)r|door|\btor\b|garage/i.test(name) && !/fenster|window/i.test(name);
  if (dc === "window") return doorName ? "door" : "window";
  return doorName ? "door" : "window";
};

/**
 * Alle Fenster-/Türkontakte aus `contact_sensors` und dem älteren `window_sensor`
 * (doppelte entfernt, fehlende Entitäten ausgelassen).
 */
export const resolveContacts = (
  states: Record<string, HassEntity>,
  config: { window_sensor?: string; contact_sensors?: (string | ContactConfig)[] },
): ResolvedContact[] => {
  const list: ContactConfig[] = [
    ...(config.contact_sensors ?? []).map((c) => (typeof c === "string" ? { entity: c } : c)),
    ...(config.window_sensor ? [{ entity: config.window_sensor }] : []),
  ];
  const seen = new Set<string>();
  const out: ResolvedContact[] = [];
  for (const c of list) {
    const st = c?.entity ? states[c.entity] : undefined;
    if (!st || seen.has(c.entity)) continue;
    seen.add(c.entity);
    out.push({
      entity: c.entity,
      name: c.name ?? st.attributes.friendly_name ?? c.entity,
      type: contactType(st, c.type),
      open: st.state === "on",
    });
  }
  return out;
};

/** Übersetzungsschlüssel für den Hinweis bei offenen Kontakten. */
export const openContactsKey = (open: ResolvedContact[]): "window_open" | "door_open" | "contacts_open" | undefined => {
  if (!open.length) return undefined;
  if (open.length > 1) return "contacts_open";
  return open[0].type === "door" ? "door_open" : "window_open";
};

// ---------- Heizungen ----------

export type DeviceType = "ac" | "heating";

/** Heizung: keine Lüfter/Lamellen und nur Heizen/Auto/Aus (z.B. Homematic-Thermostate). */
export const detectDeviceType = (st: HassEntity): DeviceType => {
  const f = Number(st.attributes.supported_features ?? 0);
  const airFeatures = 8 | 32 | 512; // FAN_MODE | SWING_MODE | SWING_HORIZONTAL_MODE
  const modes = (st.attributes.hvac_modes ?? []) as string[];
  const onlyHeat = modes.includes("heat") && modes.every((m) => ["heat", "auto", "off"].includes(m));
  return (f & airFeatures) === 0 && onlyHeat ? "heating" : "ac";
};

export interface ScheduleSegment {
  /** Minuten seit Mitternacht */
  start: number;
  end: number;
  temp: number;
}

const WEEKDAY_KEYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

const toMinutes = (hhmm: string): number => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return Math.min(1440, (h || 0) * 60 + (m || 0));
};

/**
 * Tagesverlauf aus dem Homematic-Wochenprogramm (`schedule_data`): Zeitfenster plus
 * Grundtemperatur für die Lücken, lückenlos von 0 bis 24 Uhr.
 */
export const parseSchedule = (attrs: Record<string, any>, weekday: number): ScheduleSegment[] | undefined => {
  const day = attrs.schedule_data?.[WEEKDAY_KEYS[weekday]];
  if (!day) return undefined;
  const base = Number(day.base_temperature);
  const periods = ((day.periods ?? []) as { starttime: string; endtime: string; temperature: number }[])
    .map((p) => ({ start: toMinutes(p.starttime), end: toMinutes(p.endtime), temp: Number(p.temperature) }))
    .filter((p) => p.end > p.start && Number.isFinite(p.temp))
    .sort((a, b) => a.start - b.start);
  const out: ScheduleSegment[] = [];
  let pos = 0;
  for (const p of periods) {
    if (p.start > pos && Number.isFinite(base)) out.push({ start: pos, end: p.start, temp: base });
    out.push({ start: Math.max(p.start, pos), end: p.end, temp: p.temp });
    pos = Math.max(pos, p.end);
  }
  if (pos < 1440 && Number.isFinite(base)) out.push({ start: pos, end: 1440, temp: base });
  // benachbarte Abschnitte mit gleicher Temperatur zusammenfassen
  return out.reduce<ScheduleSegment[]>((acc, s) => {
    const last = acc[acc.length - 1];
    if (last && last.end === s.start && last.temp === s.temp) last.end = s.end;
    else acc.push({ ...s });
    return acc;
  }, []);
};

export const hasSchedule = (attrs: Record<string, any>): boolean =>
  !!attrs.schedule_data && WEEKDAY_KEYS.some((k) => attrs.schedule_data[k]);

/** Laut Wochenprogramm aktuell gültige Temperatur. */
export const scheduleTempAt = (attrs: Record<string, any>, at: Date): number | undefined => {
  const mins = at.getHours() * 60 + at.getMinutes();
  return parseSchedule(attrs, at.getDay())?.find((s) => mins >= s.start && mins < s.end)?.temp;
};

/** Nächster Temperaturwechsel laut Wochenprogramm (bis zu 7 Tage voraus). */
export const nextSwitch = (attrs: Record<string, any>, now: Date): { at: Date; temp: number } | undefined => {
  const current = scheduleTempAt(attrs, now);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  for (let d = 0; d <= 7; d++) {
    const date = new Date(now);
    date.setDate(now.getDate() + d);
    const segs = parseSchedule(attrs, date.getDay());
    if (!segs) continue;
    for (const s of segs) {
      if (d === 0 && s.start <= nowMins) continue;
      if (s.temp !== current) {
        const at = new Date(date);
        at.setHours(Math.floor(s.start / 60), s.start % 60, 0, 0);
        return { at, temp: s.temp };
      }
    }
  }
  return undefined;
};

/** Prozentwert eines Sensors (Ventil, Batterie). */
export const percentOf = (entity?: HassEntity): number | undefined => {
  if (!entity || UNAVAILABLE.includes(entity.state)) return undefined;
  const v = Number(entity.state);
  return Number.isFinite(v) ? v : undefined;
};

export const VALVE_PATTERN = /ventil|valve/i;
export const BATTERY_PATTERN = /batter|spannungspegel|voltage_level/i;

// ---------- Licht ----------

/** Farbtemperatur (Kelvin) → RGB (Näherung nach Tanner Helland). */
export const kelvinToRgb = (kelvin: number): [number, number, number] => {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100;
  const clamp = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [clamp(r), clamp(g), clamp(b)];
};

/** Aktuelle Lichtfarbe als CSS-Farbe (undefined, wenn aus). Weißlicht ohne Farbe → warmweiß. */
export const lightColor = (st?: HassEntity): string | undefined => {
  if (!st || st.state !== "on") return undefined;
  const a = st.attributes;
  if (Array.isArray(a.rgb_color)) return `rgb(${a.rgb_color.join(",")})`;
  if (a.color_temp_kelvin) return `rgb(${kelvinToRgb(Number(a.color_temp_kelvin)).join(",")})`;
  return "rgb(255, 196, 107)";
};

/** Helligkeit in % (0 wenn aus). */
export const brightnessPct = (st?: HassEntity): number => {
  if (!st || st.state !== "on") return 0;
  const b = st.attributes.brightness;
  return b == null ? 100 : Math.max(1, Math.round((Number(b) / 255) * 100));
};

const COLOR_MODES = ["hs", "xy", "rgb", "rgbw", "rgbww"];
export const supportsColor = (st: HassEntity): boolean =>
  ((st.attributes.supported_color_modes ?? []) as string[]).some((m) => COLOR_MODES.includes(m));
export const supportsColorTemp = (st: HassEntity): boolean =>
  ((st.attributes.supported_color_modes ?? []) as string[]).includes("color_temp");
export const supportsBrightness = (st: HassEntity): boolean =>
  ((st.attributes.supported_color_modes ?? []) as string[]).some((m) => m !== "onoff");

/**
 * Szenen zu einer Lichtgruppe: Hue-Szenen (`group_name` = Gruppenname), gleiche Namen nur einmal.
 */
export const relatedScenes = (states: Record<string, HassEntity>, light: HassEntity): HassEntity[] => {
  const group = light.attributes.friendly_name;
  const seen = new Set<string>();
  return Object.values(states)
    .filter((s) => s.entity_id.startsWith("scene.") && group && s.attributes.group_name === group)
    .sort((a, b) => a.entity_id.localeCompare(b.entity_id))
    .filter((s) => {
      const name = String(s.attributes.name ?? s.attributes.friendly_name);
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
};

/** Effekt-Einträge, die „kein Effekt“ bedeuten (Govee: `""`, Hue/WLED: `off`/`None`). */
export const isNoEffect = (effect: unknown): boolean =>
  effect == null || ["", "off", "none"].includes(String(effect).trim().toLowerCase());

/**
 * Segment-Lampen eines LED-Streifens (govee2mqtt: `light.<name>_segment_001`).
 * Ein Ziffern-Suffix der Haupt-Entität (`light.carport_2`) wird ignoriert.
 */
export const segmentIds = (states: Record<string, HassEntity>, entityId: string): string[] => {
  const base = entityId.replace(/_\d+$/, "");
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:_\\d+)?_segment_\\d+$`);
  return Object.keys(states)
    .filter((id) => id !== entityId && re.test(id))
    .sort((a, b) => Number(a.match(/(\d+)$/)![1]) - Number(b.match(/(\d+)$/)![1]));
};

// ---------- Editor ----------

export interface EditorOptions {
  /** Erkannter bzw. eingestellter Gerätetyp (undefined ohne Entität) */
  type?: DeviceType;
  /** Wurde der Typ manuell eingestellt? */
  configured: boolean;
  /** Sinnvolle Bereiche für „Sichtbare Bereiche“ */
  show: (keyof typeof DEFAULT_SHOW)[];
  /** Gibt es Auswahllisten (Lüfter, Lamellen, Voreinstellungen)? */
  selects: boolean;
}

/** Welche Editor-Optionen passen zum Gerät? Heizungen ohne Lüfter/Lamellen, Felder nur bei passenden Features. */
export const editorOptions = (st: HassEntity | undefined, deviceType?: "auto" | "ac" | "heating"): EditorOptions => {
  const all = Object.keys(DEFAULT_SHOW) as (keyof typeof DEFAULT_SHOW)[];
  const configured = deviceType === "ac" || deviceType === "heating";
  if (!st) return { type: configured ? (deviceType as DeviceType) : undefined, configured, show: all, selects: true };
  const type: DeviceType = configured ? (deviceType as DeviceType) : detectDeviceType(st);
  const a = st.attributes;
  const fan = type === "ac" && supports(a, ClimateFeature.FAN_MODE);
  const swing = type === "ac" && (supports(a, ClimateFeature.SWING_MODE) || supports(a, ClimateFeature.SWING_HORIZONTAL_MODE));
  const presets = supports(a, ClimateFeature.PRESET_MODE);
  const humidity = supports(a, ClimateFeature.TARGET_HUMIDITY);
  const ok: Record<string, boolean> = { fan, swing, presets, humidity };
  return { type, configured, show: all.filter((k) => ok[k] ?? true), selects: fan || swing || presets };
};

/**
 * Sinnvolle Bereiche für den Light-Editor: Farbe/Weißton/Effekte nur, wenn die Lampe bzw. eine
 * Lampe der Gruppe das kann; Lampenliste nur bei Gruppen, Segmente nur bei LED-Streifen.
 */
export const lightEditorOptions = (
  states: Record<string, HassEntity>,
  entityId: string | undefined,
  config: { entities?: unknown[]; segments?: unknown[] } = {},
): { show: string[]; segments: boolean } => {
  const all = ["lights", "scenes", "color", "temperature", "effects", "segments", "shortcuts"];
  const st = entityId ? states[entityId] : undefined;
  if (!st) return { show: all, segments: true };
  const memberIds = Array.isArray(st.attributes.entity_id) ? (st.attributes.entity_id as string[]) : [];
  const lamps = [st, ...memberIds.map((id) => states[id]).filter((s): s is HassEntity => !!s)];
  const segments = !!config.segments?.length || segmentIds(states, st.entity_id).length > 0;
  const ok: Record<string, boolean> = {
    lights: memberIds.length > 0 || !!config.entities?.length,
    color: lamps.some(supportsColor),
    temperature: lamps.some(supportsColorTemp),
    effects: lamps.some((l) => ((l.attributes.effect_list ?? []) as unknown[]).some((e) => !isNoEffect(e))),
    segments,
  };
  return { show: all.filter((k) => ok[k] ?? true), segments };
};

// ---------- Rollläden ----------

export const CoverFeature = {
  OPEN: 1, CLOSE: 2, SET_POSITION: 4, STOP: 8, OPEN_TILT: 16, CLOSE_TILT: 32, STOP_TILT: 64, SET_TILT_POSITION: 128,
} as const;

export const coverSupports = (st: HassEntity | undefined, feature: number): boolean =>
  !!st && ((Number(st.attributes.supported_features) || 0) & feature) !== 0;

/** Öffnung in % (100 = ganz offen). Ohne Positionsangabe aus dem Zustand abgeleitet. */
export const coverPosition = (st?: HassEntity): number | undefined => {
  if (!st || UNAVAILABLE.includes(st.state)) return undefined;
  const p = st.attributes.current_position;
  if (p != null && Number.isFinite(Number(p))) return Math.round(Number(p));
  if (st.state === "open") return 100;
  if (st.state === "closed") return 0;
  return undefined;
};

export const coverMoving = (st?: HassEntity): "opening" | "closing" | undefined =>
  st?.state === "opening" || st?.state === "closing" ? st.state : undefined;

const COVER_ICONS: Record<string, [string, string]> = {
  shutter: ["mdi:window-shutter-open", "mdi:window-shutter"],
  blind: ["mdi:blinds-horizontal", "mdi:blinds-horizontal-closed"],
  awning: ["mdi:awning-outline", "mdi:awning-outline"],
  curtain: ["mdi:curtains", "mdi:curtains-closed"],
  garage: ["mdi:garage-open-variant", "mdi:garage-variant"],
  gate: ["mdi:gate-open", "mdi:gate"],
  door: ["mdi:door-open", "mdi:door-closed"],
  window: ["mdi:window-open-variant", "mdi:window-closed-variant"],
  shade: ["mdi:roller-shade", "mdi:roller-shade-closed"],
};

export const coverIcon = (st?: HassEntity): string => {
  const [open, closed] = COVER_ICONS[String(st?.attributes.device_class ?? "shutter")] ?? COVER_ICONS.shutter;
  if (st?.state === "opening") return "mdi:arrow-up-box";
  if (st?.state === "closing") return "mdi:arrow-down-box";
  return (coverPosition(st) ?? 0) > 0 ? open : closed;
};

export type SkyPhase = "day" | "twilight" | "night";

export interface SunInfo { elevation: number; azimuth?: number; rising?: boolean; }

/** Tag (> 6°), Dämmerung (−6° … 6°, bürgerliche Dämmerung), Nacht. */
export const skyPhase = (elevation?: number): SkyPhase =>
  elevation == null || elevation > 6 ? "day" : elevation >= -6 ? "twilight" : "night";

/** Sonnenstand aus `sun.sun` (oder undefined, wenn keine Daten). */
export const sunInfo = (st?: HassEntity): SunInfo | undefined => {
  const e = Number(st?.attributes.elevation);
  if (!st || !Number.isFinite(e)) return undefined;
  const az = Number(st.attributes.azimuth);
  return { elevation: e, azimuth: Number.isFinite(az) ? az : undefined, rising: st.attributes.rising };
};

/**
 * Lage der Sonne im Fensterausschnitt in %: Ost (90°) links → West (270°) rechts,
 * je höher die Sonne, desto weiter oben (Horizont bei 86 %, Mittagshöhe ~ 42 %).
 */
export const sunPlacement = (sun: SunInfo): { x: number; y: number } => {
  const az = sun.azimuth ?? (sun.rising ? 110 : 250);
  const x = Math.min(88, Math.max(12, 12 + ((az - 90) / 180) * 76));
  // bewusst nur untere Fensterhälfte: auch bei halb geschlossenem Rollladen sichtbar
  const y = Math.min(90, Math.max(42, 86 - (Math.max(-4, sun.elevation) / 55) * 44));
  return { x: Math.round(x), y: Math.round(y) };
};

/** Wetterzustand → Darstellung im Fenster. */
export const weatherOverlay = (condition?: string): { clouds: number; rain: boolean; snow: boolean; fog: boolean } => {
  const c = condition ?? "";
  return {
    clouds: c === "partlycloudy" ? 1 : /pouring|lightning|rainy|snowy|hail|^cloudy$|fog/.test(c) ? 2 : 0,
    rain: /rainy|pouring|hail/.test(c),
    snow: /snowy/.test(c),
    fog: c === "fog",
  };
};

// ---------- Schalter + Uhrzeit ----------

/** Uhrzeit/Datum eines input_datetime: Minuten seit Mitternacht und Datum (lokal). */
export const datetimeParts = (st?: HassEntity): { minutes?: number; date?: Date; hasTime: boolean; hasDate: boolean } => {
  const a = st?.attributes ?? {};
  const hasDate = !!a.has_date;
  const hasTime = a.has_time !== false;
  const minutes = a.hour != null ? Number(a.hour) * 60 + Number(a.minute ?? 0) : undefined;
  const date = hasDate && a.year != null ? new Date(Number(a.year), Number(a.month) - 1, Number(a.day)) : undefined;
  return { minutes, date, hasTime, hasDate };
};

/** Nächster Zeitpunkt: festes Datum, sonst heute bzw. morgen um die Uhrzeit. */
export const nextOccurrence = (minutes: number | undefined, date: Date | undefined, now = Date.now()): Date | undefined => {
  if (minutes == null && !date) return undefined;
  const d = date ? new Date(date) : new Date(now);
  d.setHours(Math.floor((minutes ?? 0) / 60), (minutes ?? 0) % 60, 0, 0);
  if (!date && d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d;
};

// ---------- Medien ----------

export const MediaFeature = {
  PAUSE: 1, SEEK: 2, VOLUME_SET: 4, VOLUME_MUTE: 8, PREVIOUS_TRACK: 16, NEXT_TRACK: 32, TURN_ON: 128, TURN_OFF: 256,
  VOLUME_STEP: 1024, SELECT_SOURCE: 2048, STOP: 4096, PLAY: 16384,
} as const;

export const mediaSupports = (st: HassEntity | undefined, f: number): boolean =>
  !!st && ((Number(st.attributes.supported_features) || 0) & f) !== 0;

const ACTIVITY_ICONS: [RegExp, string][] = [
  [/ps\s?[345]|playstation/i, "mdi:sony-playstation"],
  [/xbox/i, "mdi:microsoft-xbox"],
  [/switch|nintendo/i, "mdi:nintendo-switch"],
  [/spiel|game|konsole/i, "mdi:gamepad-variant"],
  [/fire\s?tv|amazon/i, "mdi:amazon"],
  [/netflix/i, "mdi:netflix"],
  [/apple\s?tv/i, "mdi:apple"],
  [/chrome|google/i, "mdi:google-chrome"],
  [/klima|air\s?con|\bac\b|clima/i, "mdi:air-conditioner"],
  [/licht|light|lampe/i, "mdi:lightbulb"],
  [/pc|computer|rechner/i, "mdi:monitor"],
  [/musik|music|radio|sonos|spotify|atmos|audio|soundbar/i, "mdi:speaker"],
  [/film|movie|kino|blu.?ray|dvd/i, "mdi:movie-open"],
  [/tv|fernseh|television/i, "mdi:television"],
];

/** Symbol für eine Aktivität anhand ihres Namens. */
export const activityIcon = (name: string): string =>
  ACTIVITY_ICONS.find(([re]) => re.test(name))?.[1] ?? "mdi:play-circle-outline";

const VOLUME_DEVICE = /soundbar|receiver|\bavr\b|verstärker|amp|sonos|denon|yamaha|onkyo|marantz|bose|harman|samsung\s*\d|atmos|lautsprecher|speaker/i;

/** Gerät für die Lautstärke: Soundbar/AV-Receiver, sonst der Fernseher, sonst das erste Gerät. */
export const guessVolumeDevice = (devices: string[]): string | undefined =>
  devices.find((d) => VOLUME_DEVICE.test(d) && !/switch/i.test(d)) ?? devices.find((d) => /tv|fernseh/i.test(d)) ?? devices[0];

/**
 * Gerät für Steuerkreuz/Wiedergabe in einer Aktivität: gleiches Stichwort im Namen
 * („Smart TV wiedergeben“ → „Sony TV“, „Fire TV“ …), sonst Streaming-Gerät, sonst Fernseher.
 */
export const guessControlDevice = (devices: string[], activity?: string): string | undefined => {
  const words = (activity ?? "").toLowerCase().split(/[^a-z0-9äöü]+/).filter((w) => w.length >= 2 && !["wiedergeben", "watch", "play", "smart"].includes(w));
  // „Smart TV“ meint die Apps des Fernsehers selbst – dann den Fernseher vor Streaming-Sticks wählen
  const smart = /smart/i.test(activity ?? "");
  const streaming = /fire\s?tv|apple\s?tv|shield|chromecast|roku|stick/i;
  const byWord = devices
    .filter((d) => words.some((w) => d.toLowerCase().includes(w)) && !VOLUME_DEVICE.test(d))
    .sort((x, y) => (smart ? Number(streaming.test(x)) - Number(streaming.test(y)) : 0))[0];
  return byWord ?? devices.find((d) => /fire\s?tv|apple\s?tv|shield|chromecast|google|roku|media/i.test(d))
    ?? devices.find((d) => /tv|fernseh/i.test(d)) ?? devices[0];
};

/** Sekunden → „m:ss“ bzw. „h:mm:ss“. */
export const formatMediaTime = (secs?: number): string => {
  if (secs == null || !Number.isFinite(secs)) return "";
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad2(m)}:${pad2(s % 60)}` : `${m}:${pad2(s % 60)}`;
};

/** Kurzer Anzeigename einer Harmony-Aktivität: „Smart TV wiedergeben“ → „Smart TV“. */
export const activityLabel = (name: string): string =>
  name.replace(/\s+(wiedergeben|ansehen|anschauen|schauen|starten|spielen|hören|watch|play|listen|start)$/i, "").trim() || name;

// ---------- Batterien ----------

export interface BatteryInfo {
  entity: string;
  name: string;
  level?: number;
  low: boolean;
  /** z.B. „2× AA“ (Battery Notes) */
  type?: string;
}

/** Ein Batterie-Sensor → Info. Schwach bei < threshold oder wenn Battery Notes/binary_sensor „low“ meldet. */
export const batteryInfo = (states: Record<string, HassEntity>, st: HassEntity, threshold = 20, strip: string[] = []): BatteryInfo => {
  const a = st.attributes;
  const domain = st.entity_id.split(".")[0];
  const raw = Number(st.state);
  const level = domain === "sensor" && Number.isFinite(raw) && !UNAVAILABLE.includes(st.state) ? Math.round(raw) : undefined;
  const lowSensor = states[st.entity_id.replace(/^sensor\./, "binary_sensor.") + "_low"];
  const low = domain === "binary_sensor" ? st.state === "on"
    : a.battery_low === true || lowSensor?.state === "on" || (level != null && level < threshold);
  let name = String(a.device_name ?? a.friendly_name ?? st.entity_id)
    .replace(/\s*(batterie\+?|battery\+?|akku)(\s*(fast leer|low|niedrig))?\s*$/i, "").trim();
  // Bereichsnamen („mein Zimmer“) weglassen – in der Raumkarte überflüssig
  for (const word of strip.map((w) => w.trim()).filter((w) => w.length > 1)) {
    const short = name.replace(new RegExp(`\\s*${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), " ").trim();
    if (short) name = short;
  }
  return { entity: st.entity_id, name, level, low, type: a.battery_type_and_quantity ?? a.battery_type ?? undefined };
};

/**
 * Batterie-Sensoren der Geräte in den angegebenen Bereichen – je Gerät einer
 * (Battery-Notes-Sensor bevorzugt, sonst Prozent-Sensor, sonst binary_sensor).
 */
export const areaBatteries = (
  states: Record<string, HassEntity>,
  entities: Record<string, { entity_id: string; device_id?: string | null; area_id?: string | null; hidden?: boolean }>,
  devices: Record<string, { area_id?: string | null }>,
  areas: string[],
): string[] => {
  const wanted = new Set(areas);
  const byDevice = new Map<string, string[]>();
  for (const e of Object.values(entities)) {
    const st = states[e.entity_id];
    if (!st || st.attributes.device_class !== "battery" || e.hidden) continue;
    const area = e.area_id ?? (e.device_id ? devices[e.device_id]?.area_id : undefined);
    if (!area || !wanted.has(area)) continue;
    const key = e.device_id ?? e.entity_id;
    byDevice.set(key, [...(byDevice.get(key) ?? []), e.entity_id]);
  }
  const score = (id: string) => (states[id]?.attributes.battery_type_and_quantity ? 0 : 2)
    + (id.startsWith("sensor.") ? 0 : 1) + (/_low$/.test(id) ? 1 : 0);
  return [...byDevice.values()].map((ids) => ids.sort((a, b) => score(a) - score(b))[0]);
};

// ---------- Licht-Presets ----------

export interface LightPreset {
  name: string;
  icon?: string;
  brightness?: number;
  kelvin?: number;
  rgb?: [number, number, number];
}

export const DEFAULT_LIGHT_PRESETS: LightPreset[] = [
  { name: "bright", icon: "mdi:white-balance-sunny", brightness: 100, kelvin: 4000 },
  { name: "warm", icon: "mdi:lightbulb-on", brightness: 70, kelvin: 2700 },
  { name: "cozy", icon: "mdi:candle", brightness: 25, kelvin: 2200 },
];

/** Entspricht der aktuelle Zustand der Lampe dem Preset? (Helligkeit ±3 %, Kelvin ±150, Farbe ±25 je Kanal) */
export const presetActive = (st: HassEntity | undefined, p: LightPreset): boolean => {
  if (!st || st.state !== "on") return false;
  const a = st.attributes;
  if (p.brightness != null && Math.abs(brightnessPct(st) - p.brightness) > 3) return false;
  if (p.kelvin != null && (a.color_mode !== "color_temp" || Math.abs(Number(a.color_temp_kelvin) - p.kelvin) > 150)) return false;
  if (p.rgb) {
    const c = a.rgb_color as number[] | undefined;
    if (!Array.isArray(c) || c.some((v, i) => Math.abs(v - p.rgb![i]) > 25)) return false;
  }
  return true;
};

/** Service-Daten für light.turn_on. */
export const presetData = (p: LightPreset): Record<string, unknown> => ({
  ...(p.brightness != null ? { brightness_pct: p.brightness } : {}),
  ...(p.kelvin != null ? { color_temp_kelvin: p.kelvin } : {}),
  ...(p.rgb ? { rgb_color: p.rgb } : {}),
});
