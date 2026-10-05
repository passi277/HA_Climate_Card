import type { ContactConfig, ContactType, EntityRegistryEntry, HassEntity } from "./types";
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
  const all = ["lights", "scenes", "color", "temperature", "effects", "music", "segments", "shortcuts"];
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
    music: lamps.some((l) => musicModes(l.attributes.effect_list as unknown[]).length > 0),
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
  // time.* (z.B. Roborock „Bitte nicht stören Beginn“): Zustand „22:00:00“
  if (st?.entity_id.startsWith("time.")) {
    const m = /^(\d{1,2}):(\d{2})/.exec(st.state);
    return { minutes: m ? Number(m[1]) * 60 + Number(m[2]) : undefined, hasTime: true, hasDate: false };
  }
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
  /** Batterietyp ohne Anzahl („AA“) und Anzahl (Battery Notes) */
  kind?: string;
  quantity?: number;
  /** Letzter Batteriewechsel (Battery Notes) */
  replaced?: Date;
  /** Battery-Notes-Button „Batterie ersetzt“ */
  replacedButton?: string;
}

/** Battery-Notes-Entitäten am selben Gerät wie der Batteriesensor */
export interface BatteryNotes {
  type?: string;
  last?: string;
  button?: string;
}

/**
 * Battery Notes legt Typ, letzten Wechsel und „ersetzt“-Button als eigene Entitäten am Gerät an –
 * benannt nach dem Gerät, nicht nach dem Batteriesensor. Zuordnung daher über die device_id.
 */
export const batteryNotesFor = (states: Record<string, HassEntity>, entities: Record<string, EntityRegistryEntry> | undefined,
  batteryId: string): BatteryNotes => {
  const device = entities?.[batteryId]?.device_id;
  if (!device) return {};
  const out: BatteryNotes = {};
  for (const e of Object.values(entities!)) {
    if (e.device_id !== device || e.platform !== "battery_notes") continue;
    const domain = e.entity_id.split(".")[0];
    const st = states[e.entity_id];
    if (domain === "button") out.button ??= e.entity_id;
    else if (domain === "sensor" && st?.attributes.battery_type != null) out.type ??= e.entity_id;
    else if (domain === "sensor" && st?.attributes.device_class === "timestamp") out.last ??= e.entity_id;
  }
  return out;
};

/** Ein Batterie-Sensor → Info. Schwach bei < threshold oder wenn Battery Notes/binary_sensor „low“ meldet. */
export const batteryInfo = (states: Record<string, HassEntity>, st: HassEntity, threshold = 20, strip: string[] = [],
  notes: BatteryNotes = {}): BatteryInfo => {
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
  const typeSt = notes.type ? states[notes.type] : undefined;
  const lastSt = notes.last ? states[notes.last] : undefined;
  const typeOk = typeSt && !UNAVAILABLE.includes(typeSt.state);
  const lastRaw = a.battery_last_replaced ?? (lastSt && !UNAVAILABLE.includes(lastSt.state) ? lastSt.state : undefined);
  const replaced = lastRaw ? new Date(lastRaw) : undefined;
  const qty = a.battery_quantity ?? (typeOk ? typeSt!.attributes.battery_quantity : undefined);
  return { entity: st.entity_id, name, level, low,
    type: a.battery_type_and_quantity ?? a.battery_type ?? (typeOk ? typeSt!.state : undefined),
    kind: a.battery_type ?? (typeOk ? typeSt!.attributes.battery_type : undefined) ?? undefined,
    quantity: qty != null ? Number(qty) : undefined,
    replaced: replaced && !Number.isNaN(replaced.getTime()) ? replaced : undefined,
    replacedButton: notes.button && states[notes.button] ? notes.button : undefined };
};

export interface ShoppingItem {
  kind: string;
  count: number;
  names: string[];
}

/** Einkaufsliste: schwache Batterien nach Typ gruppiert („3× CR2450“). */
export const batteryShoppingList = (batteries: BatteryInfo[]): ShoppingItem[] => {
  const map = new Map<string, ShoppingItem>();
  for (const b of batteries.filter((x) => x.low)) {
    const parsed = /^(\d+)\s*[×x]\s*(.+)$/i.exec(b.type ?? "");
    const kind = b.kind ?? parsed?.[2] ?? b.type;
    if (!kind) continue;
    const qty = b.quantity ?? (parsed ? Number(parsed[1]) : 1);
    const item = map.get(kind) ?? { kind, count: 0, names: [] };
    item.count += qty;
    item.names.push(b.name);
    map.set(kind, item);
  }
  return [...map.values()].sort((a, b) => a.kind.localeCompare(b.kind));
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

// ---------- Saugroboter ----------

export interface CalibrationPoint { vacuum: { x: number; y: number }; map: { x: number; y: number }; }

/**
 * Affine Abbildung Roboter-Koordinaten → Kartenpixel aus 3 Kalibrierpunkten
 * (Format der Roborock-/Xiaomi-Kartenintegrationen).
 */
export const calibrationTransform = (points?: CalibrationPoint[]): ((x: number, y: number) => [number, number]) | undefined => {
  if (!Array.isArray(points) || points.length < 3) return undefined;
  const [p1, p2, p3] = points;
  const det = (p1.vacuum.x - p3.vacuum.x) * (p2.vacuum.y - p3.vacuum.y) - (p2.vacuum.x - p3.vacuum.x) * (p1.vacuum.y - p3.vacuum.y);
  if (!det) return undefined;
  const solve = (k: "x" | "y") => {
    const a = ((p1.map[k] - p3.map[k]) * (p2.vacuum.y - p3.vacuum.y) - (p2.map[k] - p3.map[k]) * (p1.vacuum.y - p3.vacuum.y)) / det;
    const b = ((p2.map[k] - p3.map[k]) * (p1.vacuum.x - p3.vacuum.x) - (p1.map[k] - p3.map[k]) * (p2.vacuum.x - p3.vacuum.x)) / det;
    const c = p3.map[k] - a * p3.vacuum.x - b * p3.vacuum.y;
    return [a, b, c];
  };
  const [ax, bx, cx] = solve("x");
  const [ay, by, cy] = solve("y");
  return (x, y) => [ax * x + bx * y + cx, ay * x + by * y + cy];
};

export interface VacuumRoom { id: number; name: string; icon?: string; box?: [number, number, number, number]; }

/** Räume aus den Attributen des Kartenbilds (`rooms: { "16": { number, name, x0, y0, x1, y1 } }`). */
export const roomsFromMap = (st?: HassEntity): VacuumRoom[] => {
  const rooms = st?.attributes.rooms;
  if (!rooms || typeof rooms !== "object") return [];
  return Object.entries(rooms as Record<string, any>)
    .map(([key, r]) => ({ id: Number(r?.number ?? key), name: String(r?.name ?? key),
      box: [r?.x0, r?.y0, r?.x1, r?.y1].every((v) => Number.isFinite(Number(v))) ? [Number(r.x0), Number(r.y0), Number(r.x1), Number(r.y1)] as [number, number, number, number] : undefined }))
    .filter((r) => Number.isFinite(r.id));
};

const ROOM_ICONS: [RegExp, string][] = [
  [/k(ü|ue)che|kitchen/i, "mdi:silverware-fork-knife"], [/bad|bath|wc|toilet/i, "mdi:shower"], [/schlaf|bed/i, "mdi:bed"],
  [/wohn|living/i, "mdi:sofa"], [/flur|diele|hall|corridor/i, "mdi:door"], [/kind|child/i, "mdi:teddy-bear"],
  [/g(ä|ae)ste|guest/i, "mdi:bed-outline"], [/b(ü|ue)ro|office|arbeit/i, "mdi:desk"], [/ess|dining/i, "mdi:table-chair"],
  [/teppich|carpet|rug/i, "mdi:rug"],
];

export const roomIcon = (name: string): string => ROOM_ICONS.find(([re]) => re.test(name))?.[1] ?? "mdi:floor-plan";

// ---------- Personen & Haustür ----------

export interface PhoneSensors {
  battery?: string;
  charging?: string;
}

type RegistryEntities = Record<string, { entity_id: string; device_id?: string | null }>;

/** Handy-Akku + Ladestatus zu den Device-Trackern einer Person (über das Gerät, sonst über den Namen). */
export const phoneSensors = (states: Record<string, HassEntity>, entities: RegistryEntities | undefined, trackers: string[]): PhoneSensors => {
  const out: PhoneSensors = {};
  const isBattery = (id: string) => id.startsWith("sensor.") && states[id]?.attributes.device_class === "battery";
  const isCharging = (id: string) => (id.startsWith("binary_sensor.") && states[id]?.attributes.device_class === "battery_charging")
    || (id.startsWith("sensor.") && /charger_type|battery_state|_charging$/.test(id));
  for (const tracker of trackers) {
    const device = entities?.[tracker]?.device_id;
    const ids = device ? Object.values(entities!).filter((e) => e.device_id === device).map((e) => e.entity_id).filter((id) => states[id]) : [];
    const base = tracker.split(".")[1];
    if (!ids.length && base) {
      ids.push(...[`sensor.${base}_battery_level`, `sensor.${base}_charger_type`, `sensor.${base}_battery_state`, `binary_sensor.${base}_is_charging`]
        .filter((id) => states[id]));
    }
    out.battery ??= ids.filter(isBattery).sort((x, y) => Number(/car_/.test(x)) - Number(/car_/.test(y))
      || Number(/battery_level$/.test(y)) - Number(/battery_level$/.test(x)))[0];
    out.charging ??= ids.filter(isCharging).sort((a, b) => Number(/charger_type/.test(b)) - Number(/charger_type/.test(a)))[0];
    if (out.battery) break;
  }
  return out;
};

/** Lädt das Handy? (binary_sensor an, Ladeart ≠ none, Akkustatus „charging“/„full“) */
export const isCharging = (st?: HassEntity): boolean => {
  if (!st || UNAVAILABLE.includes(st.state)) return false;
  if (st.entity_id.startsWith("binary_sensor.")) return st.state === "on";
  return /^(ac|usb|wireless|dock|charging|full)$/i.test(st.state);
};

const BATTERY_ICONS = ["mdi:battery-outline", "mdi:battery-10", "mdi:battery-20", "mdi:battery-30", "mdi:battery-40", "mdi:battery-50",
  "mdi:battery-60", "mdi:battery-70", "mdi:battery-80", "mdi:battery-90", "mdi:battery"];
const CHARGING_ICONS = ["mdi:battery-charging-outline", "mdi:battery-charging-10", "mdi:battery-charging-20", "mdi:battery-charging-30",
  "mdi:battery-charging-40", "mdi:battery-charging-50", "mdi:battery-charging-60", "mdi:battery-charging-70", "mdi:battery-charging-80",
  "mdi:battery-charging-90", "mdi:battery-charging-100"];

/** Batterie-Symbol passend zum Stand (10er-Schritte). */
export const batteryIcon = (level: number, charging = false): string =>
  (charging ? CHARGING_ICONS : BATTERY_ICONS)[Math.max(0, Math.min(10, Math.round(level / 10)))]!;

/** Initialen für Personen ohne Bild. */
export const initials = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

export interface DoorDevices {
  doorbell?: string;
  battery?: string;
}

/** Klingel-Sensor und Batterie-Warnung vom selben Gerät wie das Schloss (z.B. Nuki Opener). */
export const doorDevices = (states: Record<string, HassEntity>, entities: RegistryEntities | undefined, lock: string): DoorDevices => {
  const device = entities?.[lock]?.device_id;
  if (!device) return {};
  const ids = Object.values(entities!).filter((e) => e.device_id === device && states[e.entity_id]).map((e) => e.entity_id);
  return {
    doorbell: ids.find((id) => id.startsWith("binary_sensor.") && /ring_?action|klingelaktion|doorbell|ding/.test(id))
      ?? ids.find((id) => id.startsWith("event.") && states[id]?.attributes.device_class === "doorbell"),
    battery: ids.find((id) => id.startsWith("binary_sensor.") && states[id]?.attributes.device_class === "battery" && !/_low$/.test(id))
      ?? ids.find((id) => id.startsWith("binary_sensor.") && /batter.*low|low.*batter/.test(id)),
  };
};

/** Nuki Opener (Ring to Open) oder normales Schloss? */
export const doorKind = (model?: string | null): "opener" | "lock" =>
  /opener/i.test(model ?? "") ? "opener" : "lock";

// ---------- Müllabfuhr ----------

export interface CalendarEventLike {
  summary?: string;
  message?: string;
  start: string | { date?: string; dateTime?: string };
}

export interface WastePickup {
  name: string;
  date: Date;
  /** 0 = heute, 1 = morgen … */
  days: number;
  icon: string;
  color: string;
}

const WASTE_STYLES: [RegExp, string, string][] = [
  [/bio|organ|grün|kompost/i, "mdi:leaf", "#7cb342"],
  [/papier|paper|pappe|karton/i, "mdi:newspaper-variant-outline", "#1e88e5"],
  [/gelb|wertstoff|verpackung|plastik|recycl|leichtverp/i, "mdi:recycle", "#fbc02d"],
  [/glas|glass/i, "mdi:bottle-wine-outline", "#43a047"],
  [/sperr|bulky/i, "mdi:sofa-outline", "#8d6e63"],
  [/schadstoff|hazard|elektro/i, "mdi:biohazard", "#e53935"],
];

/** Symbol + Farbe je Müllart (am Namen erkannt). */
export const wasteStyle = (name: string): { icon: string; color: string } => {
  const hit = WASTE_STYLES.find(([re]) => re.test(name));
  return hit ? { icon: hit[1], color: hit[2] } : { icon: "mdi:trash-can-outline", color: "#78909c" };
};

const parseEventStart = (start: CalendarEventLike["start"]): Date | undefined => {
  const raw = typeof start === "string" ? start : start.dateTime ?? start.date;
  if (!raw) return undefined;
  // Ganztägig („2026-10-08“ bzw. „2026-10-08 00:00:00“) als lokales Datum lesen
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(raw);
  if (m && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) return new Date(+m[1]!, +m[2]! - 1, +m[3]!, +(m[4] ?? 0), +(m[5] ?? 0));
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const dayStart = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * Abholungen der nächsten Tage (0 = nur heute, 1 = heute + morgen …).
 * Heutige Abholungen verschwinden ab `todayUntil` (Minuten nach Mitternacht, Standard 10:00).
 */
export const upcomingPickups = (events: CalendarEventLike[], now: Date, days = 1, todayUntil = 600): WastePickup[] => {
  const today = dayStart(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const out: WastePickup[] = [];
  for (const ev of events) {
    const date = parseEventStart(ev.start);
    const name = (ev.summary ?? ev.message ?? "").trim();
    if (!date || !name) continue;
    const offset = Math.round((dayStart(date) - today) / 86_400_000);
    if (offset < 0 || offset > days || (offset === 0 && nowMin >= todayUntil)) continue;
    if (out.some((p) => p.name === name && p.days === offset)) continue;
    out.push({ name, date, days: offset, ...wasteStyle(name) });
  }
  return out.sort((a, b) => a.days - b.days || a.name.localeCompare(b.name));
};

/** „HH:MM“ → Minuten nach Mitternacht */
export const clockMinutes = (hhmm: string | undefined, fallback: number): number => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? "");
  return m ? Math.min(1440, +m[1]! * 60 + +m[2]!) : fallback;
};

// ---------- Hinweise ----------

export interface AlertCondition {
  state?: string | string[];
  state_not?: string | string[];
  above?: number;
  below?: number;
}

/** Ist der Hinweis aktiv? Ohne Bedingung: Zustand „on“. Nicht verfügbare Entitäten nur bei ausdrücklicher Bedingung. */
export const alertActive = (st: HassEntity | undefined, c: AlertCondition): boolean => {
  if (!st) return false;
  const list = (v?: string | string[]) => (v == null ? undefined : ([] as string[]).concat(v).map(String));
  const is = list(c.state);
  const not = list(c.state_not);
  if (!is && !not && c.above == null && c.below == null) return st.state === "on";
  if (is && !is.includes(st.state)) return false;
  if (not?.includes(st.state)) return false;
  if (c.above != null || c.below != null) {
    const v = Number(st.state);
    if (!Number.isFinite(v) || UNAVAILABLE.includes(st.state)) return false;
    if (c.above != null && !(v > c.above)) return false;
    if (c.below != null && !(v < c.below)) return false;
  }
  return true;
};

// ---------- Energiefluss ----------

export interface EnergyInput {
  solar?: number;
  gridImport?: number;
  gridExport?: number;
  batteryCharge?: number;
  batteryDischarge?: number;
  /** Hausverbrauch (sonst berechnet) */
  home?: number;
}

export interface EnergyFlows {
  solarToHome: number;
  solarToBattery: number;
  solarToGrid: number;
  gridToHome: number;
  gridToBattery: number;
  batteryToHome: number;
  batteryToGrid: number;
  home: number;
  /** Anteil des Hausverbrauchs aus eigener Erzeugung/Batterie (0–100) */
  autarky?: number;
}

/** Leistungsflüsse zwischen Solar, Netz, Batterie und Haus (Solar zuerst, dann Batterie, dann Netz). */
export const energyFlows = (i: EnergyInput): EnergyFlows => {
  const p = (v?: number) => (v != null && Number.isFinite(v) && v > 0 ? v : 0);
  const solar = p(i.solar);
  const gi = p(i.gridImport);
  const ge = p(i.gridExport);
  const bc = p(i.batteryCharge);
  const bd = p(i.batteryDischarge);
  const solarToGrid = Math.min(solar, ge);
  const batteryToGrid = Math.min(bd, ge - solarToGrid);
  const solarToBattery = Math.min(solar - solarToGrid, bc);
  const gridToBattery = Math.min(gi, bc - solarToBattery);
  const solarToHome = Math.max(0, solar - solarToGrid - solarToBattery);
  const batteryToHome = Math.max(0, bd - batteryToGrid);
  const gridToHome = Math.max(0, gi - gridToBattery);
  const home = i.home != null && Number.isFinite(i.home) ? Math.max(0, i.home) : solarToHome + batteryToHome + gridToHome;
  const supplied = solarToHome + batteryToHome + gridToHome;
  const autarky = supplied > 0 ? Math.round(((solarToHome + batteryToHome) / supplied) * 100) : undefined;
  return { solarToHome, solarToBattery, solarToGrid, gridToHome, gridToBattery, batteryToHome, batteryToGrid, home, autarky };
};

/** Leistung in Watt (kW/MW werden umgerechnet); undefined bei nicht verfügbar. */
export const powerWatts = (st?: HassEntity): number | undefined => {
  if (!st || UNAVAILABLE.includes(st.state)) return undefined;
  const v = Number(st.state);
  if (!Number.isFinite(v)) return undefined;
  const unit = String(st.attributes.unit_of_measurement ?? "W").toLowerCase();
  return unit === "kw" ? v * 1000 : unit === "mw" ? v * 1_000_000 : v;
};

/** „161 W“ bzw. „1,2 kW“ ab Schwelle */
export const formatPower = (w: number, lang = "de", threshold = 1000, wDecimals = 0, kwDecimals = 1): string => {
  const abs = Math.abs(w);
  if (abs >= threshold) return `${(w / 1000).toLocaleString(lang, { minimumFractionDigits: kwDecimals, maximumFractionDigits: kwDecimals })} kW`;
  return `${w.toLocaleString(lang, { minimumFractionDigits: wDecimals, maximumFractionDigits: wDecimals })} W`;
};

/** Energie in Wh aus einem Leistungsverlauf (Werte gelten bis zur nächsten Änderung). */
export const integratePower = (points: { t: number; w?: number }[], until: number): number => {
  const pts = points.filter((p) => Number.isFinite(p.t)).sort((a, b) => a.t - b.t);
  let wh = 0;
  for (let i = 0; i < pts.length; i++) {
    const end = Math.min(i + 1 < pts.length ? pts[i + 1]!.t : until, until);
    const w = pts[i]!.w;
    if (w != null && Number.isFinite(w) && w > 0 && end > pts[i]!.t) wh += (w * (end - pts[i]!.t)) / 3_600_000;
  }
  return wh;
};

/** Zeile aus recorder/statistics_during_period (start/end in ms oder ISO) */
export interface StatRow { start: number | string; end?: number | string; mean?: number | null }

const statTime = (t: number | string): number => (typeof t === "number" ? t : Date.parse(t));

/** Energie in Wh aus Statistik-Mittelwerten (W): Mittelwert × Dauer je Zeile, nur Zeilen ab `from`. */
export const statsEnergy = (rows: StatRow[], from = 0): number => {
  let wh = 0;
  for (const r of rows) {
    const start = statTime(r.start);
    if (!(start >= from) || r.mean == null || !Number.isFinite(r.mean)) continue;
    let end = r.end != null ? statTime(r.end) : NaN;
    if (!Number.isFinite(end)) {
      const d = new Date(start);
      d.setDate(d.getDate() + 1);
      end = d.getTime();
    }
    if (end > start) wh += (Math.max(0, r.mean) * (end - start)) / 3_600_000;
  }
  return wh;
};

/** Akku-Restzeit in Stunden: bis leer (Entladen) bzw. bis voll (Laden). */
export const batteryHoursLeft = (soc: number | undefined, capacityWh: number | undefined, chargeW: number, dischargeW: number, minSoc = 0): number | undefined => {
  if (soc == null || !capacityWh || capacityWh <= 0) return undefined;
  if (dischargeW > 1) return Math.max(0, ((soc - minSoc) / 100) * capacityWh) / dischargeW;
  if (chargeW > 1) return Math.max(0, ((100 - soc) / 100) * capacityWh) / chargeW;
  return undefined;
};

/** „7 h“ / „2:15 h“ / „45 min“ */
export const formatHours = (h: number): string => {
  if (h >= 24) return `${Math.round(h / 24)} d`;
  if (h >= 10) return `${Math.round(h)} h`;
  const mins = Math.round(h * 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")} h`;
};

/** Raster für beliebig viele Verbraucher-Kreise: x je Kreis (0–300) und Zeile */
export const consumerGrid = (n: number, cols = 4): { x: number; row: number }[] => {
  const per = Math.max(1, Math.min(cols, n));
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / per);
    const inRow = Math.min(per, n - row * per);
    const col = i - row * per;
    return { x: (300 * (col + 0.5)) / inRow, row };
  });
};

/** Durchfluss in Liter pro Minute (m³/h, l/h, l/min, l/s). */
export const flowLpm = (st?: HassEntity): number | undefined => {
  if (!st || UNAVAILABLE.includes(st.state)) return undefined;
  const v = Number(st.state);
  if (!Number.isFinite(v)) return undefined;
  const unit = String(st.attributes.unit_of_measurement ?? "L/min").toLowerCase().replace(/\s/g, "");
  if (unit === "m³/h" || unit === "m3/h") return (v * 1000) / 60;
  if (unit === "l/h") return v / 60;
  if (unit === "l/s") return v * 60;
  if (unit === "m³/s" || unit === "m3/s") return v * 60_000;
  if (unit === "gal/min") return v * 3.785;
  return v;
};

/** Timer-Helfer: Restzeit (s), Gesamtdauer (s) und Fortschritt 0–1 (läuft ab). */
export const timerInfo = (st: HassEntity | undefined, now: number): { state: string; remaining: number; duration: number; progress: number } | undefined => {
  if (!st || UNAVAILABLE.includes(st.state)) return undefined;
  const duration = durationToSeconds(st.attributes.duration);
  let remaining = 0;
  if (st.state === "active" && st.attributes.finishes_at) remaining = Math.max(0, (new Date(st.attributes.finishes_at).getTime() - now) / 1000);
  else if (st.state !== "idle") remaining = durationToSeconds(st.attributes.remaining);
  const progress = st.state === "idle" || !duration ? 0 : Math.min(1, Math.max(0, 1 - remaining / duration));
  return { state: st.state, remaining, duration, progress };
};

/** Restzeit kompakt: „8:05“ bzw. „1:02:05“ */
export const formatRemaining = (s: number): string => {
  const t = Math.max(0, Math.round(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

/** Bereich [rot-unten, grün-ab, grün-bis, rot-oben]: optimal (grün), ok (gelb) oder bad (rot) */
export const rangeStatus = (v: number, r: [number, number, number, number]): "optimal" | "ok" | "bad" =>
  v >= r[1] && v <= r[2] ? "optimal" : v >= r[0] && v <= r[3] ? "ok" : "bad";

/** pH-Dosierung: Gramm pH-Plus/-Minus, um den Zielwert zu erreichen (außerhalb des grünen Bereichs) */
export const phDose = (ph: number, target: number, gramsPer01: number, okLow: number, okHigh: number): { kind: "minus" | "plus"; grams: number } | undefined => {
  if (ph > okHigh) return { kind: "minus", grams: Math.round(((ph - target) / 0.1) * gramsPer01) };
  if (ph < okLow) return { kind: "plus", grams: Math.round(((target - ph) / 0.1) * gramsPer01) };
  return undefined;
};

/** Filterlaufzeit-Empfehlung (h): Basis nach Wassertemperatur + Korrektur bei schlechtem pH/Redox */
export const poolRuntimeRecommendation = (temp: number, phBad: boolean, orpLow: boolean): { base: number; extra: number; total: number } => {
  const base = temp < 20 ? 5 : temp <= 26 ? 7 : temp <= 30 ? 9 : 12;
  const extra = (phBad ? 2 : 0) + (orpLow ? 2 : 0);
  return { base, extra, total: base + extra };
};

type CameraRegistry = Record<string, { entity_id: string; device_id?: string | null; hidden?: boolean; platform?: string }>;

/** Alles, was zur Kamera gehört, über ihr Gerät finden (Reolink, Blink, …): Erkennung, Akku, WLAN, Licht, Sirene, PTZ … */
export const cameraFeatures = (states: Record<string, HassEntity>, entities: CameraRegistry | undefined, camera: string): Record<string, string | undefined> => {
  const reg = entities?.[camera];
  const device = reg?.device_id;
  if (!device) return {};
  const sibs = Object.values(entities!).filter((e) => e.device_id === device && e.entity_id !== camera && states[e.entity_id]);
  const same = (e: { platform?: string }) => !reg.platform || !e.platform || e.platform === reg.platform;
  const ids = sibs.sort((a, b) => Number(same(b)) - Number(same(a))).map((e) => e.entity_id);
  const name = (id: string) => `${id} ${states[id]?.attributes.friendly_name ?? ""}`.toLowerCase();
  const dc = (id: string) => states[id]?.attributes.device_class;
  const find = (domain: string, re: RegExp, not?: RegExp) => ids.find((id) => id.startsWith(`${domain}.`) && re.test(name(id)) && !(not && not.test(name(id))));
  const motionLike = (id: string) => id.startsWith("binary_sensor.") && ["motion", "occupancy", "moving", "presence"].includes(dc(id));
  return {
    person: ids.find((id) => motionLike(id) && /person|people|mensch/.test(name(id))) ?? find("binary_sensor", /person/),
    vehicle: ids.find((id) => motionLike(id) && /fahrzeug|vehicle|\bcar\b|auto\b/.test(name(id))),
    animal: ids.find((id) => motionLike(id) && /tier|animal|\bpet\b|dog|cat|hund|katze/.test(name(id))),
    motion: ids.find((id) => motionLike(id) && /bewegung|motion/.test(name(id)) && !/person|fahrzeug|vehicle|tier|animal|pet/.test(name(id))),
    battery: ids.find((id) => id.startsWith("sensor.") && dc(id) === "battery"),
    battery_low: ids.find((id) => id.startsWith("binary_sensor.") && dc(id) === "battery"),
    wifi: ids.find((id) => id.startsWith("sensor.") && (dc(id) === "signal_strength" || /wlan|wifi|wi-fi/.test(name(id)))),
    temperature: ids.find((id) => id.startsWith("sensor.") && dc(id) === "temperature" && !/batter/.test(name(id)))
      ?? ids.find((id) => id.startsWith("sensor.") && dc(id) === "temperature"),
    sleep: find("binary_sensor", /schlaf|sleep/),
    light: find("light", /scheinwerfer|flutlicht|flood|spot/, /status|led/) ?? find("light", /./, /status|led|infrarot|infrared|\bir\b/),
    siren: ids.find((id) => id.startsWith("siren.")),
    motion_switch: find("switch", /bewegungserkennung|motion.?detect|pir.?(aktiv|enabled)|^switch\.\w*pir\b/),
    tracking: find("switch", /tracking/),
    presets: find("select", /ptz|preset|voreinstellung|position/),
    home_button: find("button", /startposition|ptz.?home|go.?to.?home|guard/, /setze|set_current|set current/),
    ptz_left: find("button", /ptz.?(links|left)/),
    ptz_right: find("button", /ptz.?(rechts|right)/),
    ptz_up: find("button", /ptz.?(auf|up)/),
    ptz_down: find("button", /ptz.?(ab|down)/),
    ptz_stop: find("button", /ptz.?stop/),
  };
};

/** WLAN-Qualität aus dBm (Prozent wird ebenfalls verstanden) */
export const wifiQuality = (v: number, unit = "dBm"): "very_good" | "good" | "fair" | "weak" => {
  if (unit === "%") return v >= 75 ? "very_good" : v >= 50 ? "good" : v >= 30 ? "fair" : "weak";
  // Balken 0–5 (z.B. Reolink „WLAN-Signal“ ohne Einheit)
  if (v >= 0 && v <= 5) return v >= 4 ? "very_good" : v >= 3 ? "good" : v >= 2 ? "fair" : "weak";
  return v > -55 ? "very_good" : v > -67 ? "good" : v > -75 ? "fair" : "weak";
};

/** Symbol und Farbe einer Auswahl-Option aus dem Namen erraten (deutsch/englisch) */
const OPTION_STYLES: [RegExp, string, string][] = [
  [/^(aus|off|deaktiv|disabled|keine?|none)$/i, "mdi:power", "#9e9e9e"],
  [/smart|intelligen|\bki\b|\bai\b/i, "mdi:auto-fix", "#ab47bc"],
  [/solar|sonne(n)?-?auto/i, "mdi:solar-power-variant", "#ffa000"],
  [/auto/i, "mdi:robot", "#1e88e5"],
  [/manu|hand/i, "mdi:hand-back-right", "#8d6e63"],
  [/sommer|summer/i, "mdi:white-balance-sunny", "#fbc02d"],
  [/winter/i, "mdi:snowflake", "#4fc3f7"],
  [/fr(ü|ue)hling|spring/i, "mdi:flower-tulip", "#66bb6a"],
  [/herbst|autumn|fall/i, "mdi:leaf-maple", "#ef6c00"],
  [/zuhause|daheim|\bhome\b|haus/i, "mdi:home", "#26a69a"],
  [/garten|garden/i, "mdi:flower", "#43a047"],
  [/(ab|weg)wesend|away|urlaub|vacation|holiday/i, "mdi:airplane", "#7e57c2"],
  [/nacht|night|schlaf|sleep/i, "mdi:weather-night", "#5c6bc0"],
  [/\beco\b|spar|energy.?sav/i, "mdi:leaf", "#43a047"],
  [/boost|turbo|max|power/i, "mdi:rocket-launch", "#e53935"],
  [/komfort|comfort/i, "mdi:sofa", "#ff7043"],
  [/gestartet|l(ä|ae)uft|running|start|aktiv|^on$/i, "mdi:play-circle", "#43a047"],
  [/pausiert|pause/i, "mdi:pause-circle", "#fb8c00"],
  [/gestoppt|stop/i, "mdi:stop-circle", "#9e9e9e"],
  [/alg/i, "mdi:bacteria", "#7cb342"],
  [/bef(ü|ue)ll|fill/i, "mdi:water-plus", "#29b6f6"],
  [/niedrig|low|leise|quiet/i, "mdi:speedometer-slow", "#26c6da"],
  [/mittel|medium|normal/i, "mdi:speedometer-medium", "#1e88e5"],
  [/hoch|high|laut/i, "mdi:speedometer", "#e53935"],
];

export const optionStyle = (option: string): { icon: string; color: string } => {
  const hit = OPTION_STYLES.find(([re]) => re.test(option.trim()));
  return hit ? { icon: hit[1], color: hit[2] } : { icon: "mdi:checkbox-blank-circle-outline", color: "var(--primary-color)" };
};

// ---------- Musik-Modi (z.B. Govee „Music: …“-Effekte) ----------

const MUSIC_RE = /^(music|musik)\s*[:\-]\s*/i;
const MUSIC_ICONS: Record<string, string> = {
  energic: "mdi:lightning-bolt", energetic: "mdi:lightning-bolt", rhythm: "mdi:metronome", spectrum: "mdi:equalizer", rolling: "mdi:waves",
  separation: "mdi:arrow-split-vertical", hopping: "mdi:debug-step-over", pianokeys: "mdi:piano", fountain: "mdi:fountain", shiny: "mdi:shimmer",
  sprouting: "mdi:sprout", dayandnight: "mdi:theme-light-dark", dynamic: "mdi:pulse", calm: "mdi:weather-night", soft: "mdi:feather",
};

export const isMusicEffect = (e?: unknown): boolean => typeof e === "string" && MUSIC_RE.test(e);

/** Musik-Modi aus der Effektliste: Effektname, Schlüssel (für Übersetzung/Symbol) und lesbarer Name */
export const musicModes = (effects: unknown[] | undefined): { effect: string; key: string; label: string; icon: string }[] =>
  [...new Set((effects ?? []).map(String).filter(isMusicEffect))].map((effect) => {
    const raw = effect.replace(MUSIC_RE, "").trim();
    const key = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
    const label = raw.replace(/([a-z])[aA]nd([A-Z])/g, "$1 & $2").replace(/([a-z])([A-Z])/g, "$1 $2");
    return { effect, key, label, icon: MUSIC_ICONS[key] ?? "mdi:music-note" };
  });

/** Mähroboter: Zusatz-Entitäten über das Gerät finden (Ecovacs GOAT, Husqvarna, Worx …) */
export const mowerFeatures = (states: Record<string, HassEntity>, entities: Record<string, EntityRegistryEntry> | undefined,
  mower: string): Record<string, string | undefined> => {
  const device = entities?.[mower]?.device_id;
  if (!device) return {};
  const ids = Object.values(entities!).filter((e) => e.device_id === device && e.entity_id !== mower && states[e.entity_id]).map((e) => e.entity_id).sort();
  const name = (id: string) => `${id} ${states[id]?.attributes.friendly_name ?? ""}`.toLowerCase();
  const dc = (id: string) => states[id]?.attributes.device_class;
  const find = (domain: string, re: RegExp, not?: RegExp) => ids.find((id) => id.startsWith(`${domain}.`) && re.test(name(id)) && !(not && not.test(name(id))));
  const TOTAL = /total|gesamt|insgesamt/;
  return {
    battery: ids.find((id) => id.startsWith("sensor.") && dc(id) === "battery") ?? find("sensor", /batter|akku/, /voltage|spannung|temp/),
    error: find("sensor", /error|fehler/),
    progress: find("sensor", /progress|fortschritt/),
    area: find("sensor", /area.?mowed|gemäht|gemaeht|mowed.?area/, TOTAL),
    session_area: find("sensor", /mowing.?area|mähfläche|maehflaeche|zielfläche|task.?area/, TOTAL),
    duration: find("sensor", /mowing.?(duration|time)|mähdauer|maehdauer|laufzeit/, TOTAL),
    total_area: find("sensor", /(total|gesamt).*(area|fläche|flaeche)/),
    total_duration: find("sensor", /(total|gesamt).*(duration|time|dauer|zeit|stunden)/),
    total_count: find("sensor", /(total|gesamt|anzahl).*(mowings|mähvorg|maehvorg|einsätze|cycles|count)/),
    blade: find("sensor", /blade|messer|klinge/),
    brush: find("sensor", /brush|bürste|buerste/),
    wifi: ids.find((id) => id.startsWith("sensor.") && (dc(id) === "signal_strength" || /rssi|wlan|wifi|wi-fi/.test(name(id))) && !/ssid/.test(name(id))),
    stop: find("button", /stop/, /debug|capture/),
    refresh: find("button", /refresh|aktualisier/),
    efficiency: find("select", /efficien|effizienz|mähmodus|maehmodus|cutting.?mode/),
    obstacle: find("select", /obstacle|hindernis/),
    rain_delay: find("number", /rain|regen/),
    rain_sensor: find("switch", /rain|regen/),
    ai: find("switch", /\bai\b|ki.?erkennung|recognition/),
    animal: find("switch", /animal|tier/),
    animal_start: find("time", /(animal|tier).*(start|beginn)/),
    animal_end: find("time", /(animal|tier).*(end|ende)/),
    border: find("switch", /border.?switch|randm|edge/, /warning|warnung/),
    safe: find("switch", /safe|sicher/),
    update: ids.find((id) => id.startsWith("update.")),
    map: find("sensor", /live.?map|karte/) ?? (ids.find((id) => id.startsWith("image.")) ?? undefined),
  };
};

export type MowerPhase = "mowing" | "paused" | "returning" | "docked" | "error" | "unknown";

/** Zustand eines lawn_mower in eine Phase übersetzen */
export const mowerPhase = (state?: string, errorCode?: string): MowerPhase => {
  if (errorCode && !["0", "", "none", "no_error", "unknown", "unavailable"].includes(errorCode.toLowerCase())) return "error";
  switch (state) {
    case "mowing": return "mowing";
    case "paused": return "paused";
    case "returning": return "returning";
    case "docked": return "docked";
    case "error": return "error";
    default: return "unknown";
  }
};

export interface MapPoint { x: number; y: number; a?: number }
export interface MowerMap { outline: MapPoint[][]; path: MapPoint[]; position?: MapPoint; dock?: MapPoint; box: { x: number; y: number; w: number; h: number } }

const toPoint = (p: unknown): MapPoint | undefined => {
  if (Array.isArray(p) && p.length >= 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]))) return { x: Number(p[0]), y: Number(p[1]) };
  if (p && typeof p === "object" && "x" in p && "y" in p) {
    const o = p as { x: unknown; y: unknown; invalid?: unknown };
    if (o.invalid) return undefined;
    const x = Number(o.x), y = Number(o.y), a = Number((o as { a?: unknown }).a);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
    return (o as { a?: unknown }).a != null && Number.isFinite(a) ? { x, y, a } : { x, y };
  }
  return undefined;
};

const toLine = (l: unknown): MapPoint[] => (Array.isArray(l) ? l.map(toPoint).filter((p): p is MapPoint => !!p) : []);

/** Live-Karte (z.B. Ecovacs „Live map“): Umriss, Spur und Position normalisieren – null, wenn nichts zum Zeichnen da ist */
export const mapGeometry = (attrs?: Record<string, any>, trail: MapPoint[] = []): MowerMap | null => {
  if (!attrs) return null;
  const rawOutline = attrs.info?.outline ?? attrs.outline ?? attrs.areas ?? [];
  const outline = (Array.isArray(rawOutline) && rawOutline.length && toPoint(rawOutline[0]) ? [toLine(rawOutline)]
    : (Array.isArray(rawOutline) ? rawOutline : []).map((a: any) => toLine(a?.points ?? a?.outline ?? a))).filter((l: MapPoint[]) => l.length >= 3);
  // erste Quelle, die wirklich Punkte enthält (Ecovacs: trace.path oft leer, position_history gefüllt)
  const fromAttrs = [attrs.trace?.path, attrs.path, attrs.position_history].map(toLine).find((l) => l.length > 1) ?? [];
  const path = trail.length > fromAttrs.length ? trail : fromAttrs;
  const position = toPoint(attrs.current_position ?? attrs.position);
  const dock = toPoint(Array.isArray(attrs.charge_positions) ? attrs.charge_positions[0] : attrs.charge_position);
  const all = [...outline.flat(), ...path];
  if (!outline.length && path.length < 2) return null;
  if (position) all.push(position);
  if (dock) all.push(dock);
  const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = Math.max(maxX - minX, maxY - minY, 1) * 0.06;
  return { outline, path, position, dock, box: { x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad } };
};

/** Fahrspur fortschreiben: neue Punkte anhängen, Dubletten und Sprünge zurück an den Anfang vermeiden */
export const extendTrail = (trail: MapPoint[], points: MapPoint[], max = 3000): MapPoint[] => {
  const out = [...trail];
  const key = (p: MapPoint) => `${Math.round(p.x)},${Math.round(p.y)}`;
  const seen = new Set(out.slice(-200).map(key));
  for (const p of points) {
    if (seen.has(key(p))) continue;
    seen.add(key(p));
    out.push({ x: p.x, y: p.y });
  }
  return out.length > max ? out.slice(out.length - max) : out;
};
