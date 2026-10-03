import type { HassEntity, HomeAssistant } from "../types";
import de from "./languages/de.json";
import en from "./languages/en.json";

const languages: Record<string, unknown> = { de, en };

const lookup = (lang: string, key: string): string | undefined => {
  let node: any = languages[lang];
  for (const part of key.split(".")) {
    if (node == null || typeof node !== "object") return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
};

export const getLanguage = (hass?: HomeAssistant): string => {
  const lang = (hass?.locale?.language ?? hass?.language ?? navigator.language ?? "en")
    .split("-")[0]
    .toLowerCase();
  return lang in languages ? lang : "en";
};

/** Übersetzt einen Karten-Schlüssel (z.B. "card.target") – Fallback Englisch, dann Schlüssel. */
export const localize = (hass: HomeAssistant | undefined, key: string): string =>
  lookup(getLanguage(hass), key) ?? lookup("en", key) ?? key;

const prettify = (value: string): string =>
  value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/**
 * Übersetzt einen Attributwert (fan_mode, swing_mode, preset_mode, hvac_action …).
 * Nutzt die HA-eigenen (integrationsspezifischen) Übersetzungen, wenn verfügbar.
 */
export const formatAttribute = (
  hass: HomeAssistant,
  entity: HassEntity,
  attribute: string,
  value: string,
): string => {
  if (hass.formatEntityAttributeValue) {
    const formatted = hass.formatEntityAttributeValue(entity, attribute, value);
    if (formatted && formatted !== value) return formatted;
  }
  if (attribute === "hvac_action") {
    return lookup(getLanguage(hass), `hvac_action.${value}`) ?? prettify(value);
  }
  return prettify(value);
};

export const formatMode = (hass: HomeAssistant, entity: HassEntity, mode: string): string => {
  if (hass.formatEntityState) {
    const formatted = hass.formatEntityState(entity, mode);
    if (formatted && formatted !== mode) return formatted;
  }
  return lookup(getLanguage(hass), `hvac_mode.${mode}`) ?? prettify(mode);
};
