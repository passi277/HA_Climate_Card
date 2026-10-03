import type { HassEntity } from "./types";
import { ACTION_TO_MODE, MODE_COLORS } from "./const";

export const UNAVAILABLE = ["unavailable", "unknown"];

export const modeColor = (st: HassEntity): string => {
  if (st.state === "off" || UNAVAILABLE.includes(st.state)) return MODE_COLORS.off;
  const fromAction = ACTION_TO_MODE[st.attributes.hvac_action];
  return MODE_COLORS[fromAction ?? st.state] ?? "var(--primary-color)";
};

export const isActive = (st: HassEntity): boolean => {
  const action = st.attributes.hvac_action;
  if (st.state === "off" || UNAVAILABLE.includes(st.state)) return false;
  return action ? !["idle", "off"].includes(action) : true;
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
  return num(entity.state);
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
