import { describe, expect, it } from "vitest";
import type { HassEntity } from "../src/types";
import {
  dewPoint, durationToSeconds, effectiveAction, etaMinutes, inferAction, isActive, modeColor, powerOf,
  secondsToDuration, stateIcon, temperatureOf, temperatureTint, trendSlope,
} from "../src/utils";
import { formatAttribute, localize } from "../src/localize/localize";
import type { HomeAssistant } from "../src/types";

const entity = (id: string, state: string, attributes: Record<string, any> = {}): HassEntity =>
  ({ entity_id: id, state, attributes, last_changed: "", last_updated: "" });

const hass = (language: string) => ({ language, locale: { language } }) as unknown as HomeAssistant;

describe("dewPoint", () => {
  it("matches reference values (Magnus)", () => {
    expect(dewPoint(25, 50)!).toBeCloseTo(13.9, 1);
    expect(dewPoint(20, 74)!).toBeCloseTo(15.2, 1);
  });
  it("handles Fahrenheit and invalid humidity", () => {
    expect(dewPoint(77, 50, "°F")!).toBeCloseTo(57.0, 0);
    expect(dewPoint(20, 0)).toBeUndefined();
  });
});

describe("inferAction (devices without hvac_action, e.g. Gree)", () => {
  it("cools when warmer than target, idles when reached", () => {
    expect(inferAction("cool", { current_temperature: 25, temperature: 23 })).toBe("cooling");
    expect(inferAction("cool", { current_temperature: 23, temperature: 23 })).toBe("idle");
  });
  it("heats when colder than target", () => {
    expect(inferAction("heat", { current_temperature: 18, temperature: 21 })).toBe("heating");
    expect(inferAction("heat", { current_temperature: 22, temperature: 21 })).toBe("idle");
  });
  it("uses the power sensor when available", () => {
    expect(inferAction("cool", { current_temperature: 25, temperature: 23 }, { power: 5 })).toBe("idle");
    expect(inferAction("cool", { current_temperature: 23, temperature: 23 }, { power: 600 })).toBe("cooling");
  });
  it("covers dry, fan, off and ranges", () => {
    expect(inferAction("dry", {})).toBe("drying");
    expect(inferAction("fan_only", {})).toBe("fan");
    expect(inferAction("off", {})).toBe("off");
    expect(inferAction("heat_cool", { current_temperature: 18, target_temp_low: 20, target_temp_high: 24 })).toBe("heating");
    expect(inferAction("heat_cool", { current_temperature: 26, target_temp_low: 20, target_temp_high: 24 })).toBe("cooling");
  });
  it("prefers a reported action", () => {
    const st = entity("climate.a", "cool", { hvac_action: "idle", current_temperature: 30, temperature: 20 });
    expect(effectiveAction(st)).toEqual({ action: "idle", inferred: false });
  });
});

describe("colors and icons follow the mode", () => {
  it("uses the mode color even if the reported action lags behind", () => {
    const st = entity("climate.a", "heat", { hvac_action: "cooling" });
    expect(modeColor(st)).toContain("heat");
    expect(stateIcon(st)).toBe("mdi:fire");
  });
  it("uses the action in auto mode", () => {
    expect(modeColor(entity("climate.a", "auto", { hvac_action: "cooling" }))).toContain("cool");
  });
  it("is grey when off", () => {
    expect(modeColor(entity("climate.a", "off"))).toContain("off");
    expect(isActive(entity("climate.a", "off", { hvac_action: "cooling" }))).toBe(false);
  });
});

describe("sensors", () => {
  it("reads temperatures from sensors, thermostats and weather", () => {
    expect(temperatureOf(entity("sensor.t", "21.5"))).toBe(21.5);
    expect(temperatureOf(entity("climate.t", "heat", { current_temperature: 19 }))).toBe(19);
    expect(temperatureOf(entity("weather.home", "sunny", { temperature: 30 }))).toBe(30);
    expect(temperatureOf(entity("sensor.t", "unavailable"))).toBeUndefined();
  });
  it("converts kW to W", () => {
    expect(powerOf(entity("sensor.p", "0.8", { unit_of_measurement: "kW" }))).toBe(800);
  });
});

describe("trend and ETA", () => {
  const now = Date.now();
  const falling = Array.from({ length: 7 }, (_, i) => ({ t: now - (30 - i * 5) * 60000, v: 26 - i * 0.2 }));
  it("estimates the slope in degrees per minute", () => {
    expect(trendSlope(falling)!).toBeCloseTo(-0.04, 3);
    expect(trendSlope(falling.slice(0, 1))).toBeUndefined();
  });
  it("estimates minutes to target only when moving towards it", () => {
    expect(etaMinutes(24.8, 23, -0.04)).toBeCloseTo(45, 0);
    expect(etaMinutes(24.8, 23, 0.04)).toBeUndefined();
    expect(etaMinutes(30, 20, -0.01)).toBeUndefined(); // > 4 h
  });
  it("tints warm above and cool below target", () => {
    expect(temperatureTint(26, 22)).toContain("heat");
    expect(temperatureTint(19, 22)).toContain("cool");
    expect(temperatureTint(22.1, 22)).toBeUndefined();
  });
});

describe("durations", () => {
  it("round-trips HH:MM:SS", () => {
    expect(durationToSeconds("1:30:00")).toBe(5400);
    expect(secondsToDuration(5400)).toBe("01:30:00");
  });
});

describe("localization", () => {
  it("translates card strings and falls back to English", () => {
    expect(localize(hass("de"), "card.target")).toBe("Ziel");
    expect(localize(hass("fr"), "card.target")).toBe("Target");
  });
  it("translates Gree values when HA has no translation", () => {
    const st = entity("climate.gree", "cool");
    expect(formatAttribute(hass("de"), st, "fan_mode", "medium low")).toBe("Mittel-niedrig");
    expect(formatAttribute(hass("de"), st, "swing_mode", "fixed_upper")).toBe("Oben fest");
    expect(formatAttribute(hass("en"), st, "swing_mode", "unknown_value")).toBe("Unknown value");
  });
});
