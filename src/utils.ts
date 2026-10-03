import type { ContactConfig, ContactType, HassEntity } from "./types";
import { ACTION_ICONS, ACTION_TO_MODE, MODE_COLORS, MODE_ICONS } from "./const";

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
  if (dc === "window") return "window";
  const name = `${entity?.attributes.friendly_name ?? ""} ${entity?.entity_id ?? ""}`;
  return /t(ü|ue)r|door|\btor\b|garage/i.test(name) ? "door" : "window";
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
