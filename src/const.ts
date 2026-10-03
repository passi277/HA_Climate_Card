export const CARD_VERSION = "1.12.0";

export const ClimateFeature = {
  TARGET_TEMPERATURE: 1,
  TARGET_TEMPERATURE_RANGE: 2,
  TARGET_HUMIDITY: 4,
  FAN_MODE: 8,
  PRESET_MODE: 16,
  SWING_MODE: 32,
  TURN_OFF: 128,
  TURN_ON: 256,
  SWING_HORIZONTAL_MODE: 512,
} as const;

export const supports = (attrs: Record<string, any>, feature: number): boolean =>
  ((attrs.supported_features ?? 0) & feature) !== 0;

export const HVAC_MODE_ORDER = ["auto", "heat_cool", "heat", "cool", "dry", "fan_only", "off"];

export const MODE_ICONS: Record<string, string> = {
  auto: "mdi:thermostat-auto",
  heat_cool: "mdi:sun-snowflake-variant",
  heat: "mdi:fire",
  cool: "mdi:snowflake",
  dry: "mdi:water-percent",
  fan_only: "mdi:fan",
  off: "mdi:power",
};

export const ACTION_ICONS: Record<string, string> = {
  heating: "mdi:fire",
  cooling: "mdi:snowflake",
  drying: "mdi:water-percent",
  fan: "mdi:fan",
  idle: "mdi:clock-outline",
  off: "mdi:power",
  preheating: "mdi:heat-wave",
  defrosting: "mdi:snowflake-melt",
};

/** CSS-Farbe pro Modus, mit HA-Theme-Variablen und Fallback. */
export const MODE_COLORS: Record<string, string> = {
  auto: "var(--state-climate-auto-color, #43a047)",
  heat_cool: "var(--state-climate-heat_cool-color, #ffa000)",
  heat: "var(--state-climate-heat-color, #ff6d00)",
  cool: "var(--state-climate-cool-color, #2196f3)",
  dry: "var(--state-climate-dry-color, #00bcd4)",
  fan_only: "var(--state-climate-fan_only-color, #00acc1)",
  off: "var(--state-climate-off-color, #8a8a8a)",
};

export const ACTION_TO_MODE: Record<string, string> = {
  heating: "heat",
  preheating: "heat",
  cooling: "cool",
  drying: "dry",
  fan: "fan_only",
  defrosting: "cool",
};

export const DEFAULT_SHOW = {
  modes: true,
  fan: true,
  swing: true,
  presets: true,
  humidity: true,
  sensors: true,
  graph: false,
  shortcuts: true,
  timer: true,
  airflow: true,
  hints: true,
};

/** Bereiche, die im vollen Layout immer sichtbar sind – der Rest liegt im ausklappbaren Teil. */
export const PRIMARY_SECTIONS = ["modes", "fan", "timer", "countdown", "shortcuts"];

/** Domains, die als Schalter-Buttons automatisch vom Klimagerät übernommen werden. */
export const AUTO_SHORTCUT_DOMAINS = ["switch", "button"];
