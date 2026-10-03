import { describe, expect, it } from "vitest";
import type { HassEntity } from "../src/types";
import {
  brightnessPct, contactType, isNoEffect, segmentIds, detectDeviceType, kelvinToRgb, lightColor, relatedScenes, supportsColor, supportsColorTemp, dewPoint, nextSwitch, parseSchedule, scheduleTempAt, durationToSeconds, effectiveAction, etaMinutes, inferAction, isActive, modeColor,
  openContactsKey, powerOf, resolveContacts, secondsToDuration, stateIcon, temperatureOf, temperatureTint, trendSlope,
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
    expect(temperatureOf(entity("sensor.t", "21.5", { device_class: "temperature" }))).toBe(21.5);
    expect(temperatureOf(entity("climate.t", "heat", { current_temperature: 19 }))).toBe(19);
    expect(temperatureOf(entity("weather.home", "sunny", { temperature: 30 }))).toBe(30);
    expect(temperatureOf(entity("sensor.t", "unavailable"))).toBeUndefined();
    // Zähler/andere Sensoren sind keine Temperatur (z.B. "sensor.weather" mit Zustand "2")
    expect(temperatureOf(entity("sensor.weather", "2", { state_class: "total" }))).toBeUndefined();
    expect(temperatureOf(entity("sensor.p", "800", { unit_of_measurement: "W" }))).toBeUndefined();
    expect(temperatureOf(entity("sensor.t", "21.5", { unit_of_measurement: "°C" }))).toBe(21.5);
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

describe("windows and doors", () => {
  const states = {
    "binary_sensor.wz_fenster": entity("binary_sensor.wz_fenster", "off", { friendly_name: "Fenster Wohnzimmer", device_class: "window" }),
    "binary_sensor.balkon": entity("binary_sensor.balkon", "on", { friendly_name: "Balkontür" }),
    "binary_sensor.gruppe": entity("binary_sensor.gruppe", "on", { friendly_name: "Fenster Durchgang" }),
  };
  it("detects doors by device class or name", () => {
    expect(contactType(states["binary_sensor.wz_fenster"])).toBe("window");
    expect(contactType(states["binary_sensor.balkon"])).toBe("door");
    expect(contactType(entity("binary_sensor.x", "off", { device_class: "garage_door" }))).toBe("door");
    expect(contactType(entity("binary_sensor.monitor", "off", { friendly_name: "Monitor" }))).toBe("window");
    expect(contactType(states["binary_sensor.wz_fenster"], "door")).toBe("door");
  });
  it("merges contact_sensors with the legacy window_sensor, without duplicates", () => {
    const list = resolveContacts(states, {
      window_sensor: "binary_sensor.wz_fenster",
      contact_sensors: ["binary_sensor.wz_fenster", { entity: "binary_sensor.balkon", name: "Balkon" }, "binary_sensor.missing"],
    });
    expect(list.map((c) => c.entity)).toEqual(["binary_sensor.wz_fenster", "binary_sensor.balkon"]);
    expect(list[1]).toMatchObject({ name: "Balkon", type: "door", open: true });
  });
  it("chooses the banner text", () => {
    const all = resolveContacts(states, { contact_sensors: Object.keys(states) });
    const open = all.filter((c) => c.open);
    expect(openContactsKey([])).toBeUndefined();
    expect(openContactsKey(open.slice(0, 1))).toBe("door_open");
    expect(openContactsKey(open.slice(1, 2))).toBe("window_open");
    expect(openContactsKey(open)).toBe("contacts_open");
  });
});

describe("heating profile (Homematic)", () => {
  const thermostat = entity("climate.hm", "auto", {
    supported_features: 401, hvac_modes: ["auto", "heat", "off"], preset_modes: ["boost", "none"],
    schedule_data: {
      MONDAY: { base_temperature: 17, periods: [{ starttime: "06:00", endtime: "09:00", temperature: 21 }, { starttime: "17:00", endtime: "22:00", temperature: 21 }] },
      SATURDAY: { base_temperature: 21, periods: [{ starttime: "00:00", endtime: "06:00", temperature: 17 }, { starttime: "22:00", endtime: "24:00", temperature: 17 }] },
    },
  });
  it("detects heating vs. air conditioner", () => {
    expect(detectDeviceType(thermostat)).toBe("heating");
    expect(detectDeviceType(entity("climate.gree", "cool", { supported_features: 953, hvac_modes: ["auto", "cool", "heat", "off"] }))).toBe("ac");
    expect(detectDeviceType(entity("climate.x", "cool", { hvac_modes: ["cool", "off"] }))).toBe("ac");
  });
  it("parses a day into gap-free segments incl. 24:00", () => {
    expect(parseSchedule(thermostat.attributes, 1)).toEqual([
      { start: 0, end: 360, temp: 17 }, { start: 360, end: 540, temp: 21 }, { start: 540, end: 1020, temp: 17 },
      { start: 1020, end: 1320, temp: 21 }, { start: 1320, end: 1440, temp: 17 },
    ]);
    expect(parseSchedule(thermostat.attributes, 6)).toEqual([
      { start: 0, end: 360, temp: 17 }, { start: 360, end: 1320, temp: 21 }, { start: 1320, end: 1440, temp: 17 },
    ]);
    expect(parseSchedule(thermostat.attributes, 2)).toBeUndefined();
  });
  it("finds the current temperature and the next switch", () => {
    const monday0730 = new Date(2026, 9, 5, 7, 30); // Montag
    expect(scheduleTempAt(thermostat.attributes, monday0730)).toBe(21);
    const next = nextSwitch(thermostat.attributes, monday0730)!;
    expect([next.at.getHours(), next.at.getMinutes(), next.temp]).toEqual([9, 0, 17]);
    const monday2300 = new Date(2026, 9, 5, 23, 0);
    // Dienstag hat kein Programm, nächster Wechsel am Samstag 06:00 → 21°
    const later = nextSwitch(thermostat.attributes, monday2300)!;
    expect([later.at.getDay(), later.at.getHours(), later.temp]).toEqual([6, 6, 21]);
  });
  it("uses the valve position to tell heating from idle", () => {
    expect(inferAction("heat", { current_temperature: 25, temperature: 21 }, { valve: 40 })).toBe("heating");
    expect(inferAction("auto", { current_temperature: 18, temperature: 21 }, { valve: 0 })).toBe("idle");
  });
});

describe("lights", () => {
  it("converts color temperatures to plausible RGB", () => {
    const warm = kelvinToRgb(2200);
    const cool = kelvinToRgb(6500);
    expect(warm[0]).toBe(255);
    expect(warm[2]).toBeLessThan(120);
    expect(cool[2]).toBeGreaterThan(240);
  });
  it("derives color and brightness", () => {
    expect(lightColor(entity("light.a", "on", { rgb_color: [255, 0, 238] }))).toBe("rgb(255,0,238)");
    expect(lightColor(entity("light.a", "off", { rgb_color: [255, 0, 238] }))).toBeUndefined();
    expect(lightColor(entity("light.a", "on", { color_temp_kelvin: 2700 }))).toMatch(/^rgb\(255,/);
    expect(brightnessPct(entity("light.a", "on", { brightness: 128 }))).toBe(50);
    expect(brightnessPct(entity("light.a", "off", { brightness: 128 }))).toBe(0);
  });
  it("knows color capabilities", () => {
    const hue = entity("light.h", "on", { supported_color_modes: ["color_temp", "xy"] });
    expect(supportsColor(hue)).toBe(true);
    expect(supportsColorTemp(hue)).toBe(true);
    expect(supportsColor(entity("light.w", "on", { supported_color_modes: ["color_temp"] }))).toBe(false);
  });
  it("finds the Hue scenes of a room group without duplicates", () => {
    const group = entity("light.gaste_wc", "on", { friendly_name: "Gäste WC" });
    const states = {
      "light.gaste_wc": group,
      "scene.gaste_wc_lesen": entity("scene.gaste_wc_lesen", "unknown", { group_name: "Gäste WC", name: "Lesen" }),
      "scene.gaste_wc_lesen_2": entity("scene.gaste_wc_lesen_2", "unknown", { group_name: "Gäste WC", name: "Lesen" }),
      "scene.flur_hell": entity("scene.flur_hell", "unknown", { group_name: "Flur", name: "Hell" }),
    };
    expect(relatedScenes(states, group).map((s) => s.entity_id)).toEqual(["scene.gaste_wc_lesen"]);
  });
  it("recognizes 'no effect' entries (Govee \"\", Hue off, WLED None)", () => {
    for (const e of ["", "off", "None", null, undefined]) expect(isNoEffect(e)).toBe(true);
    expect(isNoEffect("Fire-A")).toBe(false);
  });
  it("finds govee2mqtt segments, ignoring a numeric suffix of the main light", () => {
    const states = Object.fromEntries(["light.carport_2", "light.carport_segment_010", "light.carport_segment_002",
      "light.carport_segment_001", "light.carportx_segment_001", "light.garten_segment_001"].map((id) => [id, entity(id, "on")]));
    expect(segmentIds(states, "light.carport_2")).toEqual(["light.carport_segment_001", "light.carport_segment_002", "light.carport_segment_010"]);
    expect(segmentIds(states, "light.garten")).toEqual(["light.garten_segment_001"]);
  });
});
