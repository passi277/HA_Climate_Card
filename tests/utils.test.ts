import { describe, expect, it } from "vitest";
import type { HassEntity } from "../src/types";
import {
  batteryIcon, doorDevices, doorKind, initials, isCharging, phoneSensors, brightnessPct, contactType, calibrationTransform, roomsFromMap, roomIcon, areaBatteries, batteryInfo, presetActive, presetData, DEFAULT_LIGHT_PRESETS, activityIcon, activityLabel, guessControlDevice, guessVolumeDevice, coverIcon, datetimeParts, nextOccurrence, coverPosition, skyPhase, sunPlacement, weatherOverlay, editorOptions, isNoEffect, lightEditorOptions, segmentIds, detectDeviceType, kelvinToRgb, lightColor, relatedScenes, supportsColor, supportsColorTemp, dewPoint, nextSwitch, parseSchedule, scheduleTempAt, durationToSeconds, effectiveAction, etaMinutes, inferAction, isActive, modeColor,
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

describe("editor options", () => {
  const gree = entity("climate.gree", "cool", { hvac_modes: ["off", "auto", "cool", "dry", "fan_only", "heat"], supported_features: 1 | 8 | 16 | 32 | 128 | 256 | 512 });
  const hmip = entity("climate.hmip", "heat", { hvac_modes: ["auto", "heat", "off"], supported_features: 1 | 16 | 128 | 256 });
  const noSwing = entity("climate.ac", "cool", { hvac_modes: ["off", "cool", "heat", "fan_only"], supported_features: 1 | 8 });

  it("offers fan, swing and presets for a Gree air conditioner", () => {
    const o = editorOptions(gree, "auto");
    expect(o.type).toBe("ac");
    expect(o.show).toEqual(expect.arrayContaining(["fan", "swing", "presets", "airflow"]));
    expect(o.show).not.toContain("humidity");
    expect(o.selects).toBe(true);
  });
  it("hides fan and swing for a Homematic thermostat", () => {
    const o = editorOptions(hmip);
    expect(o.type).toBe("heating");
    expect(o.show).not.toContain("fan");
    expect(o.show).not.toContain("swing");
    expect(o.show).toContain("presets");
  });
  it("respects features and manual device type", () => {
    expect(editorOptions(noSwing).show).not.toContain("swing");
    expect(editorOptions(noSwing).show).toContain("fan");
    const forced = editorOptions(gree, "heating");
    expect(forced.configured).toBe(true);
    expect(forced.show).not.toContain("fan");
    expect(editorOptions(undefined).show).toContain("swing");
  });
  it("offers only light features the lamp supports", () => {
    const states = {
      "light.weiss": entity("light.weiss", "on", { supported_color_modes: ["color_temp"] }),
      "light.carport_2": entity("light.carport_2", "on", { supported_color_modes: ["rgb", "color_temp"], effect_list: ["", "Fire"] }),
      "light.carport_segment_001": entity("light.carport_segment_001", "on", { supported_color_modes: ["rgb"] }),
    };
    const white = lightEditorOptions(states, "light.weiss");
    expect(white.show).toEqual(["scenes", "temperature", "shortcuts"]);
    const govee = lightEditorOptions(states, "light.carport_2");
    expect(govee.show).toEqual(expect.arrayContaining(["color", "temperature", "effects", "segments"]));
    expect(govee.show).not.toContain("lights");
  });
});

describe("covers", () => {
  it("derives the position", () => {
    expect(coverPosition(entity("cover.a", "open", { current_position: 29 }))).toBe(29);
    expect(coverPosition(entity("cover.b", "open"))).toBe(100);
    expect(coverPosition(entity("cover.c", "closed"))).toBe(0);
    expect(coverPosition(entity("cover.d", "unavailable", { current_position: 40 }))).toBeUndefined();
  });
  it("picks icons by device class and movement", () => {
    expect(coverIcon(entity("cover.a", "closed", { device_class: "shutter", current_position: 0 }))).toBe("mdi:window-shutter");
    expect(coverIcon(entity("cover.a", "open", { device_class: "blind", current_position: 50 }))).toBe("mdi:blinds-horizontal");
    expect(coverIcon(entity("cover.a", "opening", {}))).toBe("mdi:arrow-up-box");
  });
});

describe("sky", () => {
  it("knows day, twilight and night", () => {
    expect(skyPhase(20)).toBe("day");
    expect(skyPhase(2)).toBe("twilight");
    expect(skyPhase(-5)).toBe("twilight");
    expect(skyPhase(-12)).toBe("night");
    expect(skyPhase(undefined)).toBe("day");
  });
  it("places the sun east → west and higher with elevation", () => {
    const morning = sunPlacement({ elevation: 5, azimuth: 100 });
    const evening = sunPlacement({ elevation: 5, azimuth: 260 });
    const noon = sunPlacement({ elevation: 40, azimuth: 180 });
    expect(morning.x).toBeLessThan(evening.x);
    expect(noon.y).toBeLessThan(morning.y);
    expect(noon.y).toBeGreaterThanOrEqual(42);
  });
  it("maps weather to clouds, rain and snow", () => {
    expect(weatherOverlay("sunny")).toEqual({ clouds: 0, rain: false, snow: false, fog: false });
    expect(weatherOverlay("partlycloudy").clouds).toBe(1);
    expect(weatherOverlay("rainy")).toMatchObject({ clouds: 2, rain: true });
    expect(weatherOverlay("snowy").snow).toBe(true);
  });
});

describe("switch + time", () => {
  it("reads time-only and date+time helpers", () => {
    const t = datetimeParts(entity("input_datetime.a", "06:30:00", { has_date: false, has_time: true, hour: 6, minute: 30 }));
    expect(t).toMatchObject({ minutes: 390, hasTime: true, hasDate: false });
    const d = datetimeParts(entity("input_datetime.b", "2026-10-04 19:15:00", { has_date: true, has_time: true, year: 2026, month: 10, day: 4, hour: 19, minute: 15 }));
    expect(d.hasDate).toBe(true);
    expect(d.date?.getDate()).toBe(4);
  });
  it("finds the next occurrence today or tomorrow", () => {
    const now = new Date(2026, 9, 3, 20, 0).getTime();
    expect(nextOccurrence(6 * 60 + 30, undefined, now)?.getDate()).toBe(4);
    expect(nextOccurrence(21 * 60, undefined, now)?.getDate()).toBe(3);
    expect(nextOccurrence(19 * 60, new Date(2026, 9, 10), now)?.getDate()).toBe(10);
  });
});

describe("media / Harmony", () => {
  const devices = ["Philips AV-Switch", "Samsung 9.1.4", "Amazon Fire TV", "Google Multimedia-Player", "Sony TV Wohnzimmer"];
  it("picks icons and short labels for activities", () => {
    expect(activityIcon("Ps4")).toBe("mdi:sony-playstation");
    expect(activityIcon("Atmos")).toBe("mdi:speaker");
    expect(activityIcon("PC wiedergeben")).toBe("mdi:monitor");
    expect(activityIcon("Smart TV wiedergeben")).toBe("mdi:television");
    expect(activityLabel("Smart TV wiedergeben")).toBe("Smart TV");
    expect(activityLabel("Ps4")).toBe("Ps4");
  });
  it("guesses volume and control devices", () => {
    expect(guessVolumeDevice(devices)).toBe("Samsung 9.1.4");
    expect(guessControlDevice(devices, "Smart TV wiedergeben")).toBe("Sony TV Wohnzimmer");
    expect(guessControlDevice(devices, "Fire TV")).toBe("Amazon Fire TV");
    expect(guessControlDevice(devices, "Ps4")).toBe("Amazon Fire TV");
  });
});

describe("batteries, presets, door names", () => {
  const states: Record<string, HassEntity> = {
    "sensor.heiz_battery_plus": entity("sensor.heiz_battery_plus", "8.0", { device_class: "battery", device_name: "Heizkörperthermostat mein Zimmer", battery_type_and_quantity: "2× AA" }),
    "binary_sensor.heiz_battery_plus_low": entity("binary_sensor.heiz_battery_plus_low", "on", { device_class: "battery" }),
    "sensor.heiz_batterie": entity("sensor.heiz_batterie", "10", { device_class: "battery" }),
    "sensor.wand_battery_plus": entity("sensor.wand_battery_plus", "62.5", { device_class: "battery", device_name: "Wandthermostat mein Zimmer" }),
    "sensor.kueche_battery_plus": entity("sensor.kueche_battery_plus", "5", { device_class: "battery" }),
  };
  const entities = {
    "sensor.heiz_battery_plus": { entity_id: "sensor.heiz_battery_plus", device_id: "d1" },
    "binary_sensor.heiz_battery_plus_low": { entity_id: "binary_sensor.heiz_battery_plus_low", device_id: "d1" },
    "sensor.heiz_batterie": { entity_id: "sensor.heiz_batterie", device_id: "d1" },
    "sensor.wand_battery_plus": { entity_id: "sensor.wand_battery_plus", device_id: "d2", area_id: "mein_zimmer" },
    "sensor.kueche_battery_plus": { entity_id: "sensor.kueche_battery_plus", device_id: "d3" },
  };
  const devices = { d1: { area_id: "mein_zimmer" }, d2: { area_id: "kueche" }, d3: { area_id: "kueche" } };
  it("picks one battery per device in the area, Battery Notes first", () => {
    expect(areaBatteries(states, entities, devices, ["mein_zimmer"]).sort()).toEqual(["sensor.heiz_battery_plus", "sensor.wand_battery_plus"]);
  });
  it("detects low batteries and cleans names", () => {
    const b = batteryInfo(states, states["sensor.heiz_battery_plus"], 20, ["mein Zimmer"]);
    expect(b).toMatchObject({ name: "Heizkörperthermostat", level: 8, low: true, type: "2× AA" });
    expect(batteryInfo(states, states["sensor.wand_battery_plus"]).low).toBe(false);
  });
  it("recognizes active presets and builds service data", () => {
    const warm = DEFAULT_LIGHT_PRESETS[1];
    expect(presetActive(entity("light.a", "on", { brightness: 178, color_mode: "color_temp", color_temp_kelvin: 2700 }), warm)).toBe(true);
    expect(presetActive(entity("light.a", "on", { brightness: 255, color_mode: "color_temp", color_temp_kelvin: 2700 }), warm)).toBe(false);
    expect(presetData(warm)).toEqual({ brightness_pct: 70, color_temp_kelvin: 2700 });
  });
  it("treats a door-named contact with device_class window as door", () => {
    expect(contactType(entity("binary_sensor.t", "off", { device_class: "window", friendly_name: "Türkontakt mein Zimmer" }))).toBe("door");
    expect(contactType(entity("binary_sensor.f", "off", { device_class: "window", friendly_name: "Fenster Terrassentür" }))).toBe("window");
  });
});

describe("vacuum map", () => {
  const cal = [{ vacuum: { x: 25500, y: 25500 }, map: { x: 776, y: 908 } }, { vacuum: { x: 35500, y: 25500 }, map: { x: 1576, y: 908 } },
    { vacuum: { x: 25500, y: 35500 }, map: { x: 776, y: 108 } }];
  it("maps robot coordinates to map pixels (Roborock calibration)", () => {
    const tf = calibrationTransform(cal)!;
    expect(tf(25500, 25500)).toEqual([776, 908]);
    const [x, y] = tf(30500, 30500);
    expect(x).toBeCloseTo(1176);
    expect(y).toBeCloseTo(508);
    expect(calibrationTransform(undefined)).toBeUndefined();
  });
  it("reads rooms from the map image", () => {
    const rooms = roomsFromMap(entity("image.m", "x", { rooms: { 22: { number: 22, name: "Pascal", x0: 28950, y0: 23600, x1: 32800, y1: 27400 }, 18: { number: 18, name: "Küche" } } }));
    expect(rooms.map((r) => r.id).sort()).toEqual([18, 22]);
    expect(rooms.find((r) => r.id === 22)?.box).toEqual([28950, 23600, 32800, 27400]);
    expect(roomIcon("Küche")).toBe("mdi:silverware-fork-knife");
  });
});

describe("presence", () => {
  const states = Object.fromEntries([
    entity("device_tracker.marcels", "home"),
    entity("sensor.marcel_s24_battery_level", "15", { device_class: "battery", unit_of_measurement: "%" }),
    entity("sensor.marcel_s24_charger_type", "ac", { device_class: "enum" }),
    entity("device_tracker.pascal_handy", "home"),
    entity("sensor.pascal_handy_battery_level", "40", { device_class: "battery" }),
    entity("binary_sensor.pascal_handy_is_charging", "off", { device_class: "battery_charging" }),
    entity("lock.klingel", "locked", { supported_features: 1 }),
    entity("binary_sensor.klingel_klingelaktion", "off"),
    entity("binary_sensor.klingel_ring_to_open", "off", { device_class: "lock" }),
    entity("binary_sensor.klingel_batterie", "off", { device_class: "battery" }),
  ].map((e) => [e.entity_id, e]));
  const reg = (id: string, device: string | null) => ({ entity_id: id, device_id: device });
  const entities = Object.fromEntries([
    reg("device_tracker.marcels", "phone_m"), reg("sensor.marcel_s24_battery_level", "phone_m"), reg("sensor.marcel_s24_charger_type", "phone_m"),
    reg("lock.klingel", "opener"), reg("binary_sensor.klingel_klingelaktion", "opener"), reg("binary_sensor.klingel_ring_to_open", "opener"),
    reg("binary_sensor.klingel_batterie", "opener"),
  ].map((e) => [e.entity_id, e]));
  it("finds phone battery + charging via the tracker device or its name", () => {
    expect(phoneSensors(states, entities, ["device_tracker.marcels"])).toEqual({ battery: "sensor.marcel_s24_battery_level", charging: "sensor.marcel_s24_charger_type" });
    expect(phoneSensors(states, entities, ["device_tracker.pascal_handy"])).toEqual({ battery: "sensor.pascal_handy_battery_level", charging: "binary_sensor.pascal_handy_is_charging" });
    expect(phoneSensors(states, undefined, [])).toEqual({});
  });
  it("detects charging and picks battery icons", () => {
    expect(isCharging(states["sensor.marcel_s24_charger_type"])).toBe(true);
    expect(isCharging(entity("sensor.x_charger_type", "none"))).toBe(false);
    expect(isCharging(entity("sensor.x_battery_state", "Charging"))).toBe(true);
    expect(isCharging(states["binary_sensor.pascal_handy_is_charging"])).toBe(false);
    expect(batteryIcon(43)).toBe("mdi:battery-40");
    expect(batteryIcon(100, true)).toBe("mdi:battery-charging-100");
    expect(batteryIcon(2)).toBe("mdi:battery-outline");
    expect(initials("Pascal Schmitt")).toBe("PS");
  });
  it("finds doorbell + battery of the lock device and the door kind", () => {
    expect(doorDevices(states, entities, "lock.klingel")).toEqual({ doorbell: "binary_sensor.klingel_klingelaktion", battery: "binary_sensor.klingel_batterie" });
    expect(doorDevices(states, entities, "lock.unknown")).toEqual({});
    expect(doorKind("Nuki Opener")).toBe("opener");
    expect(doorKind("Smart Lock 3.0 Pro")).toBe("lock");
  });
});
