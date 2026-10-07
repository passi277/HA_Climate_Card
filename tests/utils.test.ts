import { describe, expect, it } from "vitest";
import type { HassEntity } from "../src/types";
import {
  batteryHoursLeft, consumerGrid, formatHours, integratePower, statsEnergy, flowLpm, timerInfo, formatRemaining, rangeStatus, phDose, poolRuntimeRecommendation, cameraFeatures, wifiQuality, optionStyle, musicModes, isMusicEffect, energyFlows, formatPower, powerWatts, alertActive, batteryShoppingList, clockMinutes, upcomingPickups, wasteStyle, batteryIcon, doorDevices, doorKind, initials, isCharging, phoneSensors, brightnessPct, contactType, calibrationTransform, roomsFromMap, roomIcon, areaBatteries, batteryInfo, batteryNotesFor, mowerFeatures, mowerPhase, mapGeometry, mowerAreas, polygonSize, extendTrail, presetActive, presetData, DEFAULT_LIGHT_PRESETS, activityIcon, activityLabel, guessControlDevice, guessVolumeDevice, coverIcon, datetimeParts, nextOccurrence, coverPosition, skyPhase, sunPlacement, weatherOverlay, editorOptions, isNoEffect, lightEditorOptions, segmentIds, detectDeviceType, kelvinToRgb, lightColor, relatedScenes, supportsColor, supportsColorTemp, dewPoint, nextSwitch, parseSchedule, scheduleTempAt, durationToSeconds, effectiveAction, etaMinutes, inferAction, isActive, modeColor,
  llmEvents, llmCategory, snapshotMediaId, dayGroups, homeBatteryFeatures, batteryEta, batteryStatusKey,
  nextPickups, eventStart, daysUntil, offlineDevices, platformName,
  sceneStyle, sceneLabel, sceneGroups, hueRoomLights, hueRooms, parcelStatus, parcelCarrier, parcelText, sortParcels, sceneActivated, mealieMinutes, formatMinutes, scaleIngredient, mealEntries, ymdLocal,
  minutesUntil, formatShortDuration, shiftTime, weekStart, monthStart, dailyTotals, kwhFactor, percentChange,
  updateKind, pendingUpdates, updateName, resourceSensors, backupSensors, backupHealth, loadLevel, windDir, tempScale, weatherHint, weatherIcon,
  starlinkFeatures, speedtestFeatures, formatRate, formatBytes, formatUptime, toMbit, pingQuality,
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
    entity("sensor.marcel_s24_car_battery", "80", { device_class: "battery" }),
    entity("sensor.marcel_s24_car_charging_status", "charging"),
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
    reg("device_tracker.marcels", "phone_m"), reg("sensor.marcel_s24_car_battery", "phone_m"), reg("sensor.marcel_s24_car_charging_status", "phone_m"), reg("sensor.marcel_s24_battery_level", "phone_m"), reg("sensor.marcel_s24_charger_type", "phone_m"),
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

describe("waste collection", () => {
  const events = [
    { summary: "Restmüll", start: { date: "2026-10-08" } },
    { summary: "Altpapier", start: { date: "2026-10-09" } },
    { summary: "Bioabfall", start: { date: "2026-10-08" } },
    { summary: "Gelber Sack", start: { date: "2026-10-12" } },
  ];
  it("shows today + tomorrow, hides today's pickup after 10:00", () => {
    const morning = upcomingPickups(events, new Date(2026, 9, 8, 7, 30));
    expect(morning.map((p) => `${p.name}@${p.days}`)).toEqual(["Bioabfall@0", "Restmüll@0", "Altpapier@1"]);
    const noon = upcomingPickups(events, new Date(2026, 9, 8, 11, 0));
    expect(noon.map((p) => p.name)).toEqual(["Altpapier"]);
    expect(upcomingPickups(events, new Date(2026, 9, 7, 20, 0), 0)).toEqual([]);
    expect(upcomingPickups(events, new Date(2026, 9, 7, 20, 0), 5).length).toBe(4);
  });
  it("reads the calendar attributes (next event) and styles by type", () => {
    const [p] = upcomingPickups([{ message: "Restmüll", start: "2026-10-08 00:00:00" }], new Date(2026, 9, 7, 18, 0));
    expect(p?.days).toBe(1);
    expect(wasteStyle("Altpapier").icon).toBe("mdi:newspaper-variant-outline");
    expect(wasteStyle("Gelber Sack").icon).toBe("mdi:recycle");
    expect(wasteStyle("Restmüll").icon).toBe("mdi:trash-can");
    expect(clockMinutes("10:30", 600)).toBe(630);
    expect(clockMinutes(undefined, 600)).toBe(600);
  });
});

describe("alerts", () => {
  it("is active on matching states / thresholds", () => {
    expect(alertActive(entity("binary_sensor.x", "on"), {})).toBe(true);
    expect(alertActive(entity("binary_sensor.x", "off"), {})).toBe(false);
    expect(alertActive(entity("vacuum.r", "error"), { state: ["error", "cleaning"] })).toBe(true);
    expect(alertActive(entity("vacuum.r", "docked"), { state: "error" })).toBe(false);
    expect(alertActive(entity("sensor.remote", "disconnected"), { state_not: "connected" })).toBe(true);
    expect(alertActive(entity("sensor.b", "8"), { below: 10 })).toBe(true);
    expect(alertActive(entity("sensor.b", "unavailable"), { below: 10 })).toBe(false);
    expect(alertActive(undefined, {})).toBe(false);
  });
});

describe("time entities", () => {
  it("reads time.* state as minutes", () => {
    expect(datetimeParts(entity("time.dnd_start", "22:30:00"))).toEqual({ minutes: 1350, hasTime: true, hasDate: false });
    expect(datetimeParts(entity("time.dnd_start", "unknown")).minutes).toBeUndefined();
  });
});

describe("battery shopping list", () => {
  it("groups low batteries by type and sums quantities", () => {
    const list = batteryShoppingList([
      { entity: "a", name: "Schalter Küche", low: true, type: "CR2450", kind: "CR2450", quantity: 1 },
      { entity: "b", name: "Heizkörper Pascal", low: true, type: "2× AA" },
      { entity: "c", name: "Heizkörper Bad", low: true, type: "2× AA" },
      { entity: "d", name: "Wandthermostat", low: false, type: "2× AAA" },
    ]);
    expect(list).toEqual([{ kind: "AA", count: 4, names: ["Heizkörper Pascal", "Heizkörper Bad"] }, { kind: "CR2450", count: 1, names: ["Schalter Küche"] }]);
  });
});

describe("energy flows", () => {
  it("splits solar, battery and grid between home, battery and grid", () => {
    // Abends: Batterie versorgt das Haus
    const night = energyFlows({ solar: 0, batteryDischarge: 161, gridImport: 0, home: 161 });
    expect(night.batteryToHome).toBe(161);
    expect(night.autarky).toBe(100);
    // Mittags: Solar lädt Batterie, versorgt Haus und speist ein
    const noon = energyFlows({ solar: 1200, batteryCharge: 500, gridExport: 300 });
    expect(noon).toMatchObject({ solarToGrid: 300, solarToBattery: 500, solarToHome: 400, home: 400, gridToHome: 0 });
    // Netz lädt Batterie und versorgt Haus
    const grid = energyFlows({ gridImport: 800, batteryCharge: 300 });
    expect(grid).toMatchObject({ gridToBattery: 300, gridToHome: 500, autarky: 0 });
  });
  it("converts and formats power", () => {
    expect(powerWatts({ entity_id: "sensor.p", state: "1.5", attributes: { unit_of_measurement: "kW" }, last_changed: "", last_updated: "" })).toBe(1500);
    expect(powerWatts({ entity_id: "sensor.p", state: "unavailable", attributes: {}, last_changed: "", last_updated: "" })).toBeUndefined();
    expect(formatPower(161, "de")).toBe("161 W");
    expect(formatPower(1530, "de")).toBe("1,5 kW");
  });
});

describe("energy extras", () => {
  it("integrates power history to Wh", () => {
    const h = 3_600_000;
    expect(integratePower([{ t: 0, w: 100 }, { t: h, w: 200 }], 2 * h)).toBeCloseTo(300);
    expect(integratePower([{ t: 0, w: 100 }, { t: h / 2, w: undefined }], h)).toBeCloseTo(50);
  });
  it("sums energy from statistics means", () => {
    const h = 3_600_000;
    const rows = [{ start: 0, end: 24 * h, mean: 100 }, { start: 24 * h, end: 48 * h, mean: 50 }, { start: new Date(48 * h).toISOString(), mean: 10 }, { start: 72 * h, end: 96 * h, mean: null }];
    expect(statsEnergy(rows)).toBeCloseTo(2400 + 1200 + 240);
    expect(statsEnergy(rows, 24 * h)).toBeCloseTo(1200 + 240);
    expect(statsEnergy([{ start: 0, end: h, mean: -50 }])).toBe(0);
  });
  it("converts flow to L/min and reads timers", () => {
    expect(flowLpm(entity("sensor.f", "0.84", { unit_of_measurement: "m³/h" }))).toBeCloseTo(14);
    expect(flowLpm(entity("sensor.f", "120", { unit_of_measurement: "L/h" }))).toBeCloseTo(2);
    expect(flowLpm(entity("sensor.f", "unavailable"))).toBeUndefined();
    const now = Date.parse("2026-10-04T10:00:00Z");
    const t = timerInfo(entity("timer.a", "active", { duration: "0:10:00", finishes_at: "2026-10-04T10:05:00Z" }), now)!;
    expect(t.remaining).toBe(300);
    expect(t.progress).toBeCloseTo(0.5);
    expect(timerInfo(entity("timer.a", "paused", { duration: "0:10:00", remaining: "0:08:00" }), now)!.remaining).toBe(480);
    expect(timerInfo(entity("timer.a", "idle", { duration: "0:10:00" }), now)!.progress).toBe(0);
    expect(formatRemaining(485)).toBe("8:05");
    expect(formatRemaining(3725)).toBe("1:02:05");
  });
  it("rates pool values and computes care advice", () => {
    expect(rangeStatus(7.1, [6.8, 7.0, 7.2, 7.4])).toBe("optimal");
    expect(rangeStatus(6.9, [6.8, 7.0, 7.2, 7.4])).toBe("ok");
    expect(rangeStatus(531, [550, 650, 750, 800])).toBe("bad");
    expect(phDose(6.92, 7.1, 172, 7.0, 7.2)).toEqual({ kind: "plus", grams: 310 });
    expect(phDose(7.4, 7.1, 172, 7.0, 7.2)).toEqual({ kind: "minus", grams: 516 });
    expect(phDose(7.1, 7.1, 172, 7.0, 7.2)).toBeUndefined();
    expect(poolRuntimeRecommendation(24.6, true, false)).toEqual({ base: 7, extra: 2, total: 9 });
    expect(poolRuntimeRecommendation(17.2, false, true).total).toBe(7);
  });
  it("finds camera features via the device (Reolink and Blink)", () => {
    const st = (id: string, dc?: string, name = id) => entity(id, "off", { device_class: dc, friendly_name: name });
    const list = [
      st("camera.haus"), st("binary_sensor.haus_person", "motion", "Haus Person"), st("binary_sensor.haus_fahrzeug", "motion", "Haus Fahrzeug"),
      st("binary_sensor.haus_tier", "motion", "Haus Tier"), st("binary_sensor.haus_bewegung_2", "motion", "Haus Bewegung"), st("sensor.haus_batterie", "battery"),
      st("sensor.haus_batterietemperatur", "temperature"), st("light.haus_status_led", undefined, "Haus Status-LED"), st("light.haus_scheinwerfer", undefined, "Haus Flutlicht"),
      st("siren.haus_sirene"), st("switch.haus_automatisches_tracking", undefined, "Haus Automatisches Tracking"), st("select.haus_ptz_voreinstellung", undefined, "Haus PTZ-Voreinstellung"),
      st("button.haus_setze_aktuelle_position_als_startposition", undefined, "Setze aktuelle Position als Startposition"), st("button.haus_gehe_zu_startposition", undefined, "Gehe zu Startposition"),
      st("button.haus_ptz_links"), st("button.haus_ptz_ab"), st("button.haus_ptz_auf"), st("camera.tor"), st("binary_sensor.tor_bewegung", "motion", "Tor Bewegung"),
      st("binary_sensor.tor_batteriestand", "battery"), st("sensor.blink_tor_wlan_signalstarke", "signal_strength"), st("switch.tor_bewegungserkennung_der_kamera"),
    ];
    const states = Object.fromEntries(list.map((e) => [e.entity_id, e]));
    const entities = Object.fromEntries(list.map((e) => [e.entity_id, { entity_id: e.entity_id, device_id: /tor/.test(e.entity_id) ? "tor" : "haus" }]));
    const r = cameraFeatures(states, entities, "camera.haus");
    expect([r.person, r.vehicle, r.animal, r.motion]).toEqual(["binary_sensor.haus_person", "binary_sensor.haus_fahrzeug", "binary_sensor.haus_tier", "binary_sensor.haus_bewegung_2"]);
    expect([r.battery, r.temperature, r.light, r.siren, r.tracking, r.presets, r.home_button]).toEqual(["sensor.haus_batterie", "sensor.haus_batterietemperatur",
      "light.haus_scheinwerfer", "siren.haus_sirene", "switch.haus_automatisches_tracking", "select.haus_ptz_voreinstellung", "button.haus_gehe_zu_startposition"]);
    expect([r.ptz_left, r.ptz_up, r.ptz_down]).toEqual(["button.haus_ptz_links", "button.haus_ptz_auf", "button.haus_ptz_ab"]);
    const b = cameraFeatures(states, entities, "camera.tor");
    expect([b.motion, b.battery_low, b.wifi, b.motion_switch, b.person, b.light]).toEqual(["binary_sensor.tor_bewegung", "binary_sensor.tor_batteriestand",
      "sensor.blink_tor_wlan_signalstarke", "switch.tor_bewegungserkennung_der_kamera", undefined, undefined]);
    expect(wifiQuality(-52)).toBe("very_good");
    expect(wifiQuality(-71)).toBe("fair");
    expect(wifiQuality(-80)).toBe("weak");
    expect(wifiQuality(60, "%")).toBe("good");
    expect(wifiQuality(3, "")).toBe("good");
  });
  it("guesses icons and colors for select options", () => {
    expect(optionStyle("Aus").icon).toBe("mdi:power");
    expect(optionStyle("Solar-Automatik").icon).toBe("mdi:solar-power-variant");
    expect(optionStyle("Automatik").icon).toBe("mdi:robot");
    expect(optionStyle("Smart-Modus").icon).toBe("mdi:auto-fix");
    expect(optionStyle("Winter").icon).toBe("mdi:snowflake");
    expect(optionStyle("Zuhause").icon).toBe("mdi:home");
    expect(optionStyle("gestoppt").icon).toBe("mdi:stop-circle");
    expect(optionStyle("Neu-Befüllung (48h)").icon).toBe("mdi:water-plus");
    expect(optionStyle("Irgendwas").icon).toBe("mdi:checkbox-blank-circle-outline");
  });
  it("finds music modes in an effect list (Govee)", () => {
    const m = musicModes(["", "Aurora", "Music: Energic", "Music: DayAndNight", "Music: PianoKeys", "Music: Energic", "Fire"]);
    expect(m.map((x) => x.key)).toEqual(["energic", "dayandnight", "pianokeys"]);
    expect(m.map((x) => x.label)).toEqual(["Energic", "Day & Night", "Piano Keys"]);
    expect(m[0]!.icon).toBe("mdi:lightning-bolt");
    expect(isMusicEffect("Musik - Party")).toBe(true);
    expect(isMusicEffect("Aurora")).toBe(false);
  });
  it("computes battery time left / to full", () => {
    expect(batteryHoursLeft(50, 2688, 0, 161)).toBeCloseTo(8.35, 1);
    expect(batteryHoursLeft(80, 2000, 400, 0)).toBeCloseTo(1);
    expect(batteryHoursLeft(80, undefined, 400, 0)).toBeUndefined();
    expect(formatHours(8.35)).toBe("8:21 h");
    expect(formatHours(0.5)).toBe("30 min");
    expect(formatHours(14.2)).toBe("14 h");
  });
  it("lays out any number of consumers in rows", () => {
    expect(consumerGrid(2).map((g) => g.x)).toEqual([75, 225]);
    const six = consumerGrid(6, 4);
    expect(six.map((g) => g.row)).toEqual([0, 0, 0, 0, 1, 1]);
    expect(six[4]!.x).toBe(75);
  });
});

describe("battery notes entities on the device", () => {
  const st = (id: string, state: string, attributes: Record<string, unknown> = {}) => ({ entity_id: id, state, attributes, last_changed: "", last_updated: "" });
  const states = {
    "sensor.ventil_battery": st("sensor.ventil_battery", "12", { device_class: "battery", friendly_name: "Ventil Volleyball Batterie" }),
    "sensor.wasser_battery_type": st("sensor.wasser_battery_type", "4× AA", { battery_type: "AA", battery_quantity: 4 }),
    "sensor.wasser_battery_last_replaced": st("sensor.wasser_battery_last_replaced", "2025-03-25T17:09:45+00:00", { device_class: "timestamp" }),
    "button.wasser_battery_replaced": st("button.wasser_battery_replaced", "unknown"),
    "sensor.wasser_battery_plus": st("sensor.wasser_battery_plus", "12", { device_class: "battery" }),
    "button.other_battery_replaced": st("button.other_battery_replaced", "unknown"),
  };
  const entities = {
    "sensor.ventil_battery": { entity_id: "sensor.ventil_battery", device_id: "dv", platform: "mqtt" },
    "sensor.wasser_battery_type": { entity_id: "sensor.wasser_battery_type", device_id: "dv", platform: "battery_notes" },
    "sensor.wasser_battery_last_replaced": { entity_id: "sensor.wasser_battery_last_replaced", device_id: "dv", platform: "battery_notes" },
    "button.wasser_battery_replaced": { entity_id: "button.wasser_battery_replaced", device_id: "dv", platform: "battery_notes" },
    "sensor.wasser_battery_plus": { entity_id: "sensor.wasser_battery_plus", device_id: "dv", platform: "battery_notes" },
    "button.other_battery_replaced": { entity_id: "button.other_battery_replaced", device_id: "other", platform: "battery_notes" },
  };
  it("finds type, last replaced and button via the device", () => {
    expect(batteryNotesFor(states, entities, "sensor.ventil_battery")).toEqual({
      type: "sensor.wasser_battery_type", last: "sensor.wasser_battery_last_replaced", button: "button.wasser_battery_replaced" });
  });
  it("returns nothing without registry or device", () => {
    expect(batteryNotesFor(states, undefined, "sensor.ventil_battery")).toEqual({});
    expect(batteryNotesFor(states, entities, "sensor.unknown")).toEqual({});
  });
  it("fills type, quantity, replaced date and button into the battery info", () => {
    const b = batteryInfo(states, states["sensor.ventil_battery"], 20, [], batteryNotesFor(states, entities, "sensor.ventil_battery"));
    expect(b).toMatchObject({ name: "Ventil Volleyball", level: 12, low: true, type: "4× AA", kind: "AA", quantity: 4, replacedButton: "button.wasser_battery_replaced" });
    expect(b.replaced?.toISOString()).toBe("2025-03-25T17:09:45.000Z");
    expect(batteryShoppingList([b])).toEqual([{ kind: "AA", count: 4, names: ["Ventil Volleyball"] }]);
  });
  it("prefers attributes on the battery sensor itself", () => {
    const own = st("sensor.ventil_battery", "50", { device_class: "battery", battery_type_and_quantity: "2× AAA", battery_type: "AAA", battery_quantity: 2 });
    const b = batteryInfo(states, own, 20, [], { type: "sensor.wasser_battery_type" });
    expect(b).toMatchObject({ type: "2× AAA", kind: "AAA", quantity: 2 });
  });
  it("ignores unavailable notes entities", () => {
    const s2 = { ...states, "sensor.wasser_battery_type": st("sensor.wasser_battery_type", "unavailable", { battery_type: "AA" }) };
    expect(batteryInfo(s2, states["sensor.ventil_battery"], 20, [], { type: "sensor.wasser_battery_type" }).type).toBeUndefined();
  });
});

describe("mower", () => {
  const st = (id: string, state: string, attributes: Record<string, unknown> = {}) => ({ entity_id: id, state, attributes, last_changed: "", last_updated: "" });
  const ids: [string, string, Record<string, unknown>?][] = [
    ["lawn_mower.goat", "docked"], ["sensor.goat_battery_level", "86", { device_class: "battery" }], ["sensor.goat_error", "0"],
    ["sensor.goat_mowing_progress", "42"], ["sensor.goat_area_mowed", "10"], ["sensor.goat_mowing_area", "450"], ["sensor.goat_mowing_duration", "38"],
    ["sensor.goat_total_area_mowed", "1.2"], ["sensor.goat_total_mowing_duration", "65"], ["sensor.goat_total_mowings", "52"],
    ["sensor.goat_blade_lifespan", "20"], ["sensor.goat_lens_brush_lifespan", "60"], ["sensor.goat_wi_fi_rssi", "71"], ["sensor.goat_wi_fi_ssid", "Net"],
    ["button.goat_stop_debug_capture", "unknown"], ["button.goat_stop_mowing", "unknown"], ["button.goat_refresh_state", "unknown"],
    ["select.goat_mowing_efficiency", "Quick"], ["select.goat_obstacle_avoidance", "General"], ["number.goat_rain_delay", "180"],
    ["number.goat_cut_direction", "270"], ["switch.goat_rain_sensor", "on"], ["switch.goat_ai_recognition", "on", { friendly_name: "GOAT AI Recognition" }],
    ["switch.goat_animal_protection", "off"], ["switch.goat_border_switch", "on"], ["switch.goat_cross_map_border_warning", "on"], ["switch.goat_safer_mode", "off"],
    ["time.goat_animal_protection_start", "19:00:00"], ["time.goat_animal_protection_end", "07:00:00"], ["sensor.goat_live_map", "live"],
    ["update.goat_update", "off"], ["sensor.other_blade_lifespan", "5"],
  ];
  const states = Object.fromEntries(ids.map(([id, s, a]) => [id, st(id, s, a)]));
  const entities = Object.fromEntries(ids.map(([id]) => [id, { entity_id: id, device_id: id.includes("other") ? "x" : "g" }]));
  it("finds the mower's entities via the device", () => {
    expect(mowerFeatures(states, entities, "lawn_mower.goat")).toEqual({
      battery: "sensor.goat_battery_level", error: "sensor.goat_error", progress: "sensor.goat_mowing_progress", area: "sensor.goat_area_mowed",
      session_area: "sensor.goat_mowing_area", duration: "sensor.goat_mowing_duration", total_area: "sensor.goat_total_area_mowed",
      total_duration: "sensor.goat_total_mowing_duration", total_count: "sensor.goat_total_mowings", blade: "sensor.goat_blade_lifespan",
      brush: "sensor.goat_lens_brush_lifespan", wifi: "sensor.goat_wi_fi_rssi", stop: "button.goat_stop_mowing", refresh: "button.goat_refresh_state",
      efficiency: "select.goat_mowing_efficiency", obstacle: "select.goat_obstacle_avoidance", rain_delay: "number.goat_rain_delay",
      rain_sensor: "switch.goat_rain_sensor", ai: "switch.goat_ai_recognition", animal: "switch.goat_animal_protection",
      animal_start: "time.goat_animal_protection_start", animal_end: "time.goat_animal_protection_end", border: "switch.goat_border_switch",
      safe: "switch.goat_safer_mode", update: "update.goat_update", map: "sensor.goat_live_map",
    });
    expect(mowerFeatures(states, undefined, "lawn_mower.goat")).toEqual({});
  });
  it("maps states to phases, errors win", () => {
    expect(mowerPhase("mowing", "0")).toBe("mowing");
    expect(mowerPhase("docked")).toBe("docked");
    expect(mowerPhase("returning", "unknown")).toBe("returning");
    expect(mowerPhase("mowing", "102")).toBe("error");
    expect(mowerPhase("unavailable")).toBe("unknown");
  });
  it("normalizes live map geometry", () => {
    expect(mapGeometry({ info: { outline: [] }, trace: { path: [] }, current_position: { x: 2, y: 0 } })).toBeNull();
    const m = mapGeometry({ info: { outline: [[0, 0], [10, 0], [10, 5], [0, 5]] }, trace: { path: [[1, 1], [9, 1]] },
      current_position: { x: 9, y: 1, invalid: 0 }, charge_positions: [{ x: 0, y: 0 }] })!;
    expect(m.outline[0]).toHaveLength(4);
    expect(m.path).toEqual([{ x: 1, y: 1 }, { x: 9, y: 1 }]);
    expect(m.position).toEqual({ x: 9, y: 1 });
    expect(m.dock).toEqual({ x: 0, y: 0 });
    expect(m.box.w).toBeGreaterThan(10);
    expect(mapGeometry({ current_position: { x: 1, y: 1, invalid: 1 }, path: [[0, 0], [1, 1]] })!.position).toBeUndefined();
  });
  it("uses position_history when trace.path is empty (Ecovacs GOAT) and keeps the heading", () => {
    const m = mapGeometry({ trace: { path: [] }, info: { outline: [] }, current_position: { x: -279, y: 6417, a: 91, invalid: 0 },
      position_history: [{ x: -291, y: 3751, a: 88, invalid: 0 }, { x: -293, y: 4077, a: 91, invalid: 0 }, { x: -279, y: 6417, a: 91, invalid: 0 }] })!;
    expect(m.path).toHaveLength(3);
    expect(m.position).toEqual({ x: -279, y: 6417, a: 91 });
    expect(m.outline).toEqual([]);
  });
  it("reads tappable areas (goat_mower live map), largest first, and all lawn outlines", () => {
    const attrs = {
      info: { outline: [[0, 0], [40, 0], [40, 20], [0, 20]], outlines: [[[0, 0], [40, 0], [40, 20], [0, 20]], [[50, 0], [60, 0], [60, 5], [50, 5]]] },
      areas: [
        { id: "2", name: "Zeltplatz", points: [[50, 0], [60, 0], [60, 5], [50, 5]], area_m2: 16.2, label: [55, 2] },
        { id: "4", name: "Volleyball", points: [[0, 0], [40, 0], [40, 20], [0, 20]], area_m2: 192 },
        { id: "9", name: "", points: [[0, 0], [1, 1]] },
        { name: "ohne ID", points: [[0, 0], [1, 0], [1, 1]] },
      ],
      trace: { path: [] },
    };
    const areas = mowerAreas(attrs);
    expect(areas.map((a) => a.id)).toEqual(["4", "2"]);
    expect(areas[1]).toMatchObject({ name: "Zeltplatz", m2: 16.2, size: 50 });
    const m = mapGeometry(attrs)!;
    expect(m.outline).toHaveLength(2);
    expect(m.areas).toHaveLength(2);
    expect(m.box.w).toBeGreaterThan(60);
    // nur Bereiche, kein Umriss und keine Spur: trotzdem eine Karte
    expect(mapGeometry({ areas: [{ id: "1", name: "A", points: [[0, 0], [5, 0], [5, 5]] }] })!.areas).toHaveLength(1);
    expect(polygonSize([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }])).toBe(6);
    expect(areas[1]!.label).toEqual({ x: 55, y: 2 });
    expect(areas[0]!.label).toEqual({ x: 20, y: 10 });
    const g = mapGeometry({ ...attrs, obstacles: [{ id: "100", points: [[1, 1], [2, 1], [2, 2]] }], channels: [[[40, 5], [50, 5]]],
      trace: { path: [], segments: [[[0, 1], [40, 1]], [[0, 2]]] } })!;
    expect([g.obstacles.length, g.channels.length, g.segments.length]).toEqual([1, 1, 1]);
    expect(mowerAreas(undefined)).toEqual([]);
  });
  it("prefers a longer collected trail and extends it without duplicates", () => {
    const trail = extendTrail(extendTrail([], [{ x: 0, y: 0 }, { x: 0, y: 10 }]), [{ x: 0, y: 10 }, { x: 0, y: 20 }, { x: 5, y: 20 }]);
    expect(trail).toEqual([{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 0, y: 20 }, { x: 5, y: 20 }]);
    expect(extendTrail([], Array.from({ length: 10 }, (_, i) => ({ x: i, y: 0 })), 5)).toHaveLength(5);
    const m = mapGeometry({ position_history: [{ x: 0, y: 20 }, { x: 5, y: 20 }] }, trail)!;
    expect(m.path).toHaveLength(4);
  });
});

describe("starlinkFeatures / speedtestFeatures", () => {
  const mk = (list: [string, string, Record<string, any>, string?][], platform: string, device: string) => ({
    states: Object.fromEntries(list.map(([id, s, a]) => [id, entity(id, s, a)])),
    entities: Object.fromEntries(list.map(([id, , , tk]) => [id, { entity_id: id, device_id: device, platform, ...(tk ? { translation_key: tk } : {}) }])),
  });

  it("findet Starlink-Entitäten mit deutschen Namen über translation_key und Name", () => {
    const { states, entities } = mk([
      ["binary_sensor.starlink_konnektivitat", "on", { device_class: "connectivity" }],
      ["sensor.starlink_ping", "18", { unit_of_measurement: "ms" }, "ping"],
      ["sensor.starlink_ping_drop_rate", "0", { unit_of_measurement: "%" }],
      ["sensor.starlink_downlink_durchsatz", "0.14", { unit_of_measurement: "Mbit/s", device_class: "data_rate" }],
      ["sensor.starlink_uplink_durchsatz", "0.64", { unit_of_measurement: "Mbit/s", device_class: "data_rate" }],
      ["sensor.starlink_download", "938", { unit_of_measurement: "GB", device_class: "data_size" }],
      ["sensor.starlink_upload", "338", { unit_of_measurement: "GB", device_class: "data_size" }],
      ["sensor.starlink_leistung", "62", { unit_of_measurement: "W", device_class: "power" }],
      ["sensor.starlink_letzter_neustart", "2026-10-03T01:37:51+00:00", { device_class: "timestamp" }],
      ["binary_sensor.starlink_beeintrachtigt", "off", { device_class: "problem" }, "currently_obstructed"],
      ["binary_sensor.starlink_heizung", "off", {}],
      ["switch.starlink_verstaut", "off", {}],
      ["switch.starlink_zeitplan_fur_ruhezustand", "off", {}],
      ["button.starlink_neu_starten", "unknown", { device_class: "restart" }],
    ], "starlink", "dev1");
    const f = starlinkFeatures(states, entities, "sensor.starlink_ping");
    expect(f).toMatchObject({
      online: "binary_sensor.starlink_konnektivitat", ping: "sensor.starlink_ping", drop: "sensor.starlink_ping_drop_rate",
      down_rate: "sensor.starlink_downlink_durchsatz", up_rate: "sensor.starlink_uplink_durchsatz",
      down_total: "sensor.starlink_download", up_total: "sensor.starlink_upload", power: "sensor.starlink_leistung",
      boot: "sensor.starlink_letzter_neustart", obstructed: "binary_sensor.starlink_beeintrachtigt", heating: "binary_sensor.starlink_heizung",
      stow: "switch.starlink_verstaut", sleep_schedule: "switch.starlink_zeitplan_fur_ruhezustand", reboot: "button.starlink_neu_starten",
    });
    // Ohne Anker: erstes Gerät der Integration
    expect(starlinkFeatures(states, entities).online).toBe("binary_sensor.starlink_konnektivitat");
    expect(starlinkFeatures(states, undefined, "sensor.starlink_ping")).toEqual({});
  });

  it("findet englische Starlink-Namen", () => {
    const { states, entities } = mk([
      ["sensor.starlink_downlink_throughput", "12", { unit_of_measurement: "Mbit/s", device_class: "data_rate" }],
      ["sensor.starlink_ping_drop_rate", "1", { unit_of_measurement: "%" }],
      ["sensor.starlink_ping", "30", { unit_of_measurement: "ms" }],
      ["binary_sensor.starlink_obstructed", "on", { device_class: "problem" }],
      ["switch.starlink_stowed", "off", {}],
    ], "starlink", "d");
    expect(starlinkFeatures(states, entities, "sensor.starlink_ping")).toMatchObject({
      down_rate: "sensor.starlink_downlink_throughput", ping: "sensor.starlink_ping", drop: "sensor.starlink_ping_drop_rate",
      obstructed: "binary_sensor.starlink_obstructed", stow: "switch.starlink_stowed",
    });
  });

  it("findet die Speedtest-Sensoren (Gerät oder Namensendung)", () => {
    const { states, entities } = mk([
      ["sensor.speedtest_download", "147", { unit_of_measurement: "Mbit/s" }],
      ["sensor.speedtest_upload", "50", { unit_of_measurement: "Mbit/s" }],
      ["sensor.speedtest_ping", "56", { unit_of_measurement: "ms" }],
    ], "speedtestdotnet", "sp");
    const want = { download: "sensor.speedtest_download", upload: "sensor.speedtest_upload", ping: "sensor.speedtest_ping" };
    expect(speedtestFeatures(states, entities, "sensor.speedtest_ping")).toEqual(want);
    expect(speedtestFeatures(states, undefined, "sensor.speedtest_download")).toEqual(want);
  });

  it("formatiert Raten, Datenmengen, Laufzeit und Ping", () => {
    expect(formatRate(0.139, "de")).toEqual({ v: "139", unit: "kbit/s" });
    expect(formatRate(147.47, "de")).toEqual({ v: "147", unit: "Mbit/s" });
    expect(formatRate(2.1, "de")).toEqual({ v: "2,1", unit: "Mbit/s" });
    expect(formatRate(1250, "en")).toEqual({ v: "1.25", unit: "Gbit/s" });
    expect(toMbit(500, "kbit/s")).toBe(0.5);
    expect(toMbit(10, "MB/s")).toBe(80);
    expect(formatBytes(938.33, "de")).toBe("938 GB");
    expect(formatBytes(1520, "de")).toBe("1,52 TB");
    expect(formatBytes(0.25, "de")).toBe("250 MB");
    expect(formatUptime(3 * 86400 + 7 * 3600 + 60)).toBe("3 T 7 h");
    expect(formatUptime(5 * 3600 + 12 * 60, "d")).toBe("5 h 12 min");
    expect(formatUptime(-1)).toBe("");
    expect([pingQuality(20), pingQuality(56), pingQuality(120)]).toEqual(["good", "fair", "bad"]);
  });
});

describe("LLM Vision Timeline", () => {
  it("liest llmvision.get_events (neueste zuerst)", () => {
    const ev = llmEvents({ events: [
      { uid: "a", title: "Marcels Auto", start: "2026-10-04T11:43:04+02:00", end: "2026-10-04T11:44:07+02:00", description: "Auto steht", key_frame: "/media/llmvision/snapshots/a.jpg", camera_name: "camera.haus", category: "", label: "" },
      { uid: "b", title: "Mann im Garten", start: "2026-10-07T07:55:52+02:00", description: "Eine Person geht", key_frame: "", camera_name: "camera.eingang" },
    ] });
    expect(ev.map((e) => e.id)).toEqual(["b", "a"]);
    expect(ev[1]).toMatchObject({ title: "Marcels Auto", image: "/media/llmvision/snapshots/a.jpg", camera: "camera.haus", category: "vehicle" });
    expect(ev[0]).toMatchObject({ image: undefined, category: "person" });
  });

  it("liest die Kalender-API (summary, start.dateTime) und verwirft Ungültiges", () => {
    const ev = llmEvents([
      { summary: "🦊 Unbekanntes Tier", description: "Ein dunkles Tier", start: { dateTime: "2026-10-03T23:18:42+02:00" }, end: { dateTime: "2026-10-03T23:19:42+02:00" }, uid: "x" },
      { summary: "kaputt", start: {} },
    ]);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ id: "x", title: "🦊 Unbekanntes Tier", category: "animal", end: "2026-10-03T23:19:42+02:00" });
    expect(llmEvents(undefined)).toEqual([]);
  });

  it("erkennt Kategorien aus Label oder Text", () => {
    expect(llmCategory("Vehicle")).toBe("vehicle");
    expect(llmCategory("", "Dog")).toBe("animal");
    expect(llmCategory("", "", "Paketbote an der Tür")).toBe("package");
    expect(llmCategory("", "", "Mann im Garten")).toBe("person");
    expect(llmCategory("", "", "Zwei Tiere am Zaun")).toBe("animal");
    expect(llmCategory("", "", "Die Kamera dreht sich")).toBe("other");
    expect(llmCategory("", "", "Keine Aktivität erkannt")).toBe("none");
    expect(llmCategory("", "", "Unbekannte Pflanze")).toBe("nature");
  });

  it("baut die media-source-ID und gruppiert nach Tagen", () => {
    expect(snapshotMediaId("/media/llmvision/snapshots/5816cb13-0.jpg")).toBe("media-source://media_source/local/llmvision/snapshots/5816cb13-0.jpg");
    expect(snapshotMediaId("/media/local/x.jpg")).toBe("media-source://media_source/local/x.jpg");
    expect(snapshotMediaId("/config/www/x.jpg")).toBeUndefined();
    const g = dayGroups([{ start: "2026-10-07T09:00:00" }, { start: "2026-10-07T07:00:00" }, { start: "2026-10-05T22:00:00" }]);
    expect(g.map((x) => x.items.length)).toEqual([2, 1]);
  });
});

describe("Hausakku (Anker Solarbank)", () => {
  const dev = "sb", site = "site";
  const list: [string, string, Record<string, any>, string][] = [
    ["sensor.solarbank_3_e2700_pro_ladestand", "19", { device_class: "battery", unit_of_measurement: "%" }, dev],
    ["sensor.solarbank_3_e2700_pro_akkuenergie", "510", { device_class: "energy_storage", unit_of_measurement: "Wh" }, dev],
    ["number.solarbank_3_e2700_pro_akku_kapazitat", "2688", { device_class: "energy_storage", unit_of_measurement: "Wh", friendly_name: "Akku Kapazität" }, dev],
    ["sensor.solarbank_3_e2700_pro_betriebszustand", "bypass_discharge", { device_class: "enum" }, dev],
    ["sensor.solarbank_3_e2700_pro_solarleistung", "62", { device_class: "power", unit_of_measurement: "W" }, dev],
    ["sensor.solarbank_3_e2700_pro_solar_pv1", "3", { device_class: "power", unit_of_measurement: "W", name: "PV links" }, dev],
    ["sensor.solarbank_3_e2700_pro_solar_pv2", "7", { device_class: "power", unit_of_measurement: "W" }, dev],
    ["sensor.solarbank_3_e2700_pro_ac_steckdose", "0", { device_class: "power", unit_of_measurement: "W" }, dev],
    ["sensor.solarbank_3_e2700_pro_dc_ausgangsleistung", "0", { device_class: "power", unit_of_measurement: "W" }, dev],
    ["sensor.solarbank_3_e2700_pro_akkuleistung", "-23", { device_class: "power", unit_of_measurement: "W" }, dev],
    ["sensor.solarbank_3_e2700_pro_aufladeleistung", "0", { device_class: "power", unit_of_measurement: "W" }, dev],
    ["sensor.solarbank_3_e2700_pro_entladeleistung", "23", { device_class: "power", unit_of_measurement: "W" }, dev],
    ["sensor.solarbank_3_e2700_pro_ac_hausabgabe", "85", { device_class: "power", unit_of_measurement: "W" }, dev],
    ["sensor.solarbank_3_e2700_pro_netzaufladung", "0", { device_class: "power", unit_of_measurement: "W" }, dev],
    ["sensor.solarbank_3_e2700_pro_heizleistung", "0", { device_class: "power", unit_of_measurement: "W" }, dev],
    ["sensor.solarbank_3_e2700_pro_fehlercode", "0", {}, dev],
    ["sensor.solarbank_3_e2700_pro_cloud_zustand", "online", {}, dev],
    ["button.solarbank_3_e2700_pro_details_aktualisieren", "unknown", {}, dev],
    ["sensor.system_solix_garten_sb_solarleistung", "62", { device_class: "power", unit_of_measurement: "W", friendly_name: "System Solix Garten SB Solarleistung" }, site],
    ["sensor.system_solix_garten_sb_akkuleistung", "-23", { device_class: "power", unit_of_measurement: "W" }, site],
    ["sensor.system_solix_garten_aktiver_benutzermodus", "smart", {}, site],
    ["sensor.system_solix_garten_kostenersparnis", "551.63", { unit_of_measurement: "€" }, site],
    ["sensor.system_solix_garten_co2_einsparung", "533", { unit_of_measurement: "kg" }, site],
    ["binary_sensor.system_solix_garten_akkuheizung", "off", { device_class: "heat" }, site],
    ["sensor.solarerzeugung_tag", "0.06", { device_class: "energy", unit_of_measurement: "kWh" }, site],
    ["sensor.solar_kostenersparnis_tag_2", "0.38", { unit_of_measurement: "€" }, site],
  ];
  const states = Object.fromEntries(list.map(([id, s, a]) => [id, entity(id, s, a)]));
  const entities = Object.fromEntries(list.map(([id, , , d]) => [id, { entity_id: id, device_id: d }]));
  const devices = { sb: { id: "sb", via_device_id: "site" }, site: { id: "site" } };

  it("findet alle Werte über Gerät und System", () => {
    const { f, strings } = homeBatteryFeatures(states, entities, devices, "sensor.solarbank_3_e2700_pro_ladestand");
    const p = "sensor.solarbank_3_e2700_pro_";
    expect(f).toMatchObject({
      energy: `${p}akkuenergie`, capacity: "number.solarbank_3_e2700_pro_akku_kapazitat", status: `${p}betriebszustand`, solar: `${p}solarleistung`,
      battery_power: `${p}akkuleistung`, charge_power: `${p}aufladeleistung`, discharge_power: `${p}entladeleistung`, home: `${p}ac_hausabgabe`,
      grid_charge: `${p}netzaufladung`, socket: `${p}ac_steckdose`, heater: `${p}heizleistung`, error: `${p}fehlercode`, cloud: `${p}cloud_zustand`,
      refresh: "button.solarbank_3_e2700_pro_details_aktualisieren", mode: "sensor.system_solix_garten_aktiver_benutzermodus",
      savings: "sensor.system_solix_garten_kostenersparnis", savings_today: "sensor.solar_kostenersparnis_tag_2", solar_today: "sensor.solarerzeugung_tag",
      co2: "sensor.system_solix_garten_co2_einsparung", heating: "binary_sensor.system_solix_garten_akkuheizung",
    });
    expect(strings).toEqual([`${p}solar_pv1`, `${p}solar_pv2`]);
    expect(homeBatteryFeatures(states, undefined, devices, "x").f).toEqual({});
  });

  it("berechnet Restzeit und Status", () => {
    expect(Math.round(batteryEta(510, 2688, -23)! / 60)).toBe(22);
    expect(Math.round(batteryEta(1000, 2688, 422)!)).toBe(240);
    expect(batteryEta(510, 2688, 2)).toBeUndefined();
    expect(batteryStatusKey("bypass_discharge")).toEqual({ key: "bypass_discharge", dir: "discharge" });
    expect(batteryStatusKey("charge_ac")).toEqual({ key: "charge_grid", dir: "charge" });
    expect(batteryStatusKey("fully_charged")).toEqual({ key: "full", dir: "full" });
    expect(batteryStatusKey("unknown", 300).dir).toBe("charge");
  });
});

describe("System & Updates", () => {
  it("ordnet Updates nach Art und filtert", () => {
    const states = Object.fromEntries([
      entity("update.mushroom_update", "on", { friendly_name: "Mushroom Update" }),
      entity("update.home_assistant_core_update", "on", { friendly_name: "Home Assistant Core Update" }),
      entity("update.mosquitto_broker_update", "on", { friendly_name: "Mosquitto broker Update" }),
      entity("update.hmip_swdo_1_update", "on", { friendly_name: "Türkontakt Update" }),
      entity("update.hacs_update", "off", {}),
      entity("update.matter_server_update", "off", { friendly_name: "Matter Server Update", in_progress: true }),
    ].map((e) => [e.entity_id, e]));
    expect(pendingUpdates(states).map((s) => s.entity_id)).toEqual([
      "update.home_assistant_core_update", "update.matter_server_update", "update.mosquitto_broker_update", "update.mushroom_update", "update.hmip_swdo_1_update"]);
    expect(pendingUpdates(states, undefined, ["update.mushroom_update"]).length).toBe(4);
    expect(updateKind("update.home_assistant_operating_system_update")).toBe("os");
    expect(updateKind("update.battery_notes_update", { entity_picture: "https://brands.home-assistant.io/_/battery_notes/icon.png" })).toBe("integration");
    expect(updateName(states["update.mosquitto_broker_update"]!)).toBe("Mosquitto broker");
  });

  it("findet Ressourcen- und Backup-Sensoren", () => {
    const states = Object.fromEntries([
      entity("sensor.home_assistant_core_cpu_percent", "0.2", { unit_of_measurement: "%" }),
      entity("sensor.home_assistant_core_memory_percent", "11", { unit_of_measurement: "%" }),
      entity("sensor.system_monitor_disk_use_percent", "71", { unit_of_measurement: "%" }),
      entity("sensor.backup_letztes_erfolgreiches_automatisches_backup", "2026-10-07T03:27:32+00:00"),
      entity("sensor.backup_zuletzt_versuchtes_automatisches_backup", "2026-10-07T03:25:05+00:00"),
      entity("sensor.backup_nachstes_geplantes_automatisches_backup", "2026-10-08T03:12:30+00:00"),
      entity("sensor.backup_backup_manager_zustand", "idle"),
    ].map((e) => [e.entity_id, e]));
    expect(resourceSensors(states).map((r) => r.kind)).toEqual(["cpu", "memory", "disk"]);
    expect(backupSensors(states)).toEqual({
      last: "sensor.backup_letztes_erfolgreiches_automatisches_backup", attempted: "sensor.backup_zuletzt_versuchtes_automatisches_backup",
      next: "sensor.backup_nachstes_geplantes_automatisches_backup", state: "sensor.backup_backup_manager_zustand" });
    const now = new Date("2026-10-07T10:00:00Z").getTime();
    expect(backupHealth("2026-10-07T03:27:32Z", "2026-10-07T03:25:05Z", 3, now)).toBe("ok");
    expect(backupHealth("2026-10-01T03:27:32Z", undefined, 3, now)).toBe("stale");
    expect(backupHealth("2026-10-05T03:00:00Z", "2026-10-07T03:00:00Z", 3, now)).toBe("failed");
    expect([loadLevel(10), loadLevel(70), loadLevel(90)]).toEqual(["ok", "warn", "high"]);
  });
});

describe("Wetter", () => {
  it("Windrichtung, Skala, Symbole", () => {
    expect([windDir(82.8), windDir(225), windDir(350, "en")]).toEqual(["O", "SW", "N"]);
    expect(tempScale([{ datetime: "", temperature: 13, templow: 6 }, { datetime: "", temperature: 19, templow: -1 }])).toEqual({ min: -1, max: 19 });
    expect(weatherIcon("partlycloudy", true)).toBe("mdi:weather-night-partly-cloudy");
  });

  it("Hinweis: Regen ab, Regen bis, Frost, trocken", () => {
    const now = new Date("2026-10-07T08:00:00Z").getTime();
    const h = (i: number, x: Record<string, unknown> = {}) => ({ datetime: new Date(now + i * 3600_000).toISOString(), temperature: 10, condition: "cloudy", ...x });
    expect(weatherHint([h(0), h(1), h(2, { condition: "rainy" })], "cloudy", now)).toMatchObject({ key: "rain_from", at: new Date(now + 2 * 3600_000) });
    expect(weatherHint([h(0, { condition: "rainy" }), h(1, { precipitation: 1 }), h(2)], "rainy", now)).toMatchObject({ key: "rain_until", at: new Date(now + 2 * 3600_000) });
    expect(weatherHint([h(0), h(5, { temperature: -2 })], "cloudy", now)).toMatchObject({ key: "frost", value: -2 });
    expect(weatherHint([h(0), h(1)], "sunny", now)).toEqual({ key: "dry" });
    expect(weatherHint([], "sunny", now)).toBeUndefined();
  });
});

describe("Termine & Abfall", () => {
  it("nächste Abholung je Müllart", () => {
    const now = new Date(2026, 9, 7, 12, 0);
    const p = nextPickups([
      { summary: "Restmüll", start: { date: "2026-10-08" } }, { summary: "Altpapier", start: { date: "2026-10-15" } },
      { summary: "Restmüll", start: { date: "2026-10-22" } }, { summary: "Gelber Sack", start: { date: "2026-10-30" } },
    ], now, 14);
    expect(p.map((x) => [x.name, x.days])).toEqual([["Restmüll", 1], ["Altpapier", 8]]);
    expect(p[0]!.icon).toBe("mdi:trash-can");
    expect(eventStart({ date: "2026-10-08" })).toMatchObject({ allDay: true });
    expect(eventStart({ dateTime: "2026-10-08T09:30:00+02:00" }).allDay).toBe(false);
    expect(daysUntil(new Date(2026, 9, 9, 23, 0), now)).toBe(2);
  });
});

describe("Gerätestatus", () => {
  it("gruppiert nicht erreichbare Entitäten nach Gerät", () => {
    const states = Object.fromEntries([
      { ...entity("light.couch_licht", "unavailable", { friendly_name: "Couch" }), last_changed: "2026-10-07T08:00:00Z" },
      { ...entity("light.couch_links", "unavailable"), last_changed: "2026-10-07T07:00:00Z" },
      { ...entity("cover.kuche", "unavailable"), last_changed: "2026-10-06T07:00:00Z" },
      entity("device_tracker.ipad", "unavailable"),
      entity("sensor.ok", "21"),
      entity("sensor.unbekannt", "unknown"),
    ].map((e) => [e.entity_id, e]));
    const entities = { "light.couch_licht": { entity_id: "light.couch_licht", device_id: "d1", platform: "hue" }, "light.couch_links": { entity_id: "light.couch_links", device_id: "d1", platform: "hue" },
      "cover.kuche": { entity_id: "cover.kuche", device_id: "d2", platform: "bosch_shc" } };
    const devices = { d1: { id: "d1", name: "Couch Lightstrip" }, d2: { id: "d2", name: "Rollo Küche", name_by_user: "Küchenrollo" } };
    const list = offlineDevices(states, entities, devices);
    expect(list.map((d) => [d.name, d.entities.length, d.since])).toEqual([["Küchenrollo", 1, "2026-10-06T07:00:00Z"], ["Couch Lightstrip", 2, "2026-10-07T07:00:00Z"]]);
    expect(offlineDevices(states, entities, devices, { excludeDomains: [], includeUnknown: true }).length).toBe(4);
    expect(offlineDevices(states, entities, devices, { excludeIntegrations: ["hue"] }).length).toBe(1);
    expect([platformName("bosch_shc"), platformName("my_custom_thing"), platformName(undefined)]).toEqual(["Bosch Smart Home", "My Custom Thing", "Sonstige"]);
  });
});

describe("Szenen", () => {
  const sc = (id: string, name: string, group?: string, state = "unknown"): HassEntity =>
    ({ entity_id: id, state, attributes: { friendly_name: group ? `${group} ${name}` : name, ...(group ? { group_name: group, name } : {}) } } as HassEntity);
  it("erkennt Symbol und Farbe am Namen", () => {
    expect(sceneStyle("Nachtlicht").icon).toBe("mdi:weather-night");
    expect(sceneStyle("Ambiente Kaminfeuer").icon).toBe("mdi:fireplace");
    expect(sceneStyle("Sonnenuntergang Savanne").icon).toBe("mdi:weather-sunset");
    expect(sceneStyle("Irgendwas").icon).toBe("mdi:palette-outline");
  });
  it("Name ohne Raum, Gruppierung nach Hue-Raum, Doppelte nur einmal", () => {
    expect(sceneLabel({ entity_id: "scene.x", state: "", attributes: { friendly_name: "Wohnzimmer_ Lesen", group_name: "Wohnzimmer" } } as HassEntity)).toBe("Lesen");
    const t = new Date(Date.now() - 60_000).toISOString();
    const states = Object.fromEntries([
      sc("scene.tv_hell", "Hell", "tv"), sc("scene.tv_lesen", "Lesen", "tv"), sc("scene.wz_lesen", "Lesen", "Wohnzimmer"),
      sc("scene.wz_lesen_2", "Lesen", "Wohnzimmer", t), sc("scene.film", "Filmabend"),
    ].map((s) => [s.entity_id, s]));
    const g = sceneGroups(states);
    expect(g.map((x) => x.name)).toEqual(["TV", "Wohnzimmer", ""]);
    expect(g[1]!.scenes.map((s) => s.entity_id)).toEqual(["scene.wz_lesen_2"]);
    expect(sceneActivated(states["scene.wz_lesen_2"])).toBeGreaterThan(0);
    const custom = sceneGroups(states, { groups: [{ name: "Fernsehen", match: "tv", lights: ["light.tv"] }, { name: "Leer", match: "nix" }], exclude: ["hell"] });
    expect(custom.length).toBe(1);
    expect(custom[0]!.scenes.map((s) => s.entity_id)).toEqual(["scene.tv_lesen"]);
  });
  it("ordnet Hue-Räume exakt zu (Zimmer ≠ Wohnzimmer), „Wohnzimmer_“ = „Wohnzimmer“", () => {
    const states = Object.fromEntries([
      sc("scene.zimmer_hell", "Hell", "Zimmer"), sc("scene.wohnzimmer_hell", "Hell", "Wohnzimmer"), sc("scene.wohnzimmer_lesen", "Lesen", "Wohnzimmer_"),
      sc("scene.gastezimmer_hell", "Hell", "Gästezimmer"), sc("scene.party", "Party Zimmer"),
    ].map((s) => [s.entity_id, s]));
    const g = sceneGroups(states, { groups: [{ name: "Pascal", match: "Zimmer" }, { name: "WZ", match: "Wohnzimmer" }, { name: "Party", match: "party" }] });
    expect(g.map((x) => x.scenes.map((s) => s.entity_id))).toEqual([["scene.zimmer_hell"], ["scene.wohnzimmer_hell", "scene.wohnzimmer_lesen"], ["scene.party"]]);
  });
});

describe("Rezepte (Mealie)", () => {
  it("liest Zeiten in Minuten", () => {
    expect(mealieMinutes("3 hours 20 minutes")).toBe(200);
    expect(mealieMinutes("PT1H30M")).toBe(90);
    expect(mealieMinutes("45 min")).toBe(45);
    expect(mealieMinutes("1,5 Stunden")).toBe(90);
    expect(mealieMinutes(null)).toBeUndefined();
    expect([formatMinutes(200), formatMinutes(45), formatMinutes(120)]).toEqual(["3 h 20 min", "45 min", "2 h"]);
  });
  it("rechnet Mengen auf Portionen um", () => {
    expect(scaleIngredient("2 Zwiebeln", 1.5)).toBe("3 Zwiebeln");
    expect(scaleIngredient("½ TL Pfeffer", 2)).toBe("1 TL Pfeffer");
    expect(scaleIngredient("1 kg Rindergulasch", 0.5)).toBe("½ kg Rindergulasch");
    expect(scaleIngredient("2–3 EL Öl", 2)).toBe("4–6 EL Öl");
    expect(scaleIngredient("1,5 l Wasser", 2)).toBe("3 l Wasser");
    expect(scaleIngredient("Salz", 3)).toBe("Salz");
  });
  it("wandelt den Essensplan um", () => {
    const e = mealEntries({ mealplan: [
      { mealplan_id: "b", mealplan_date: "2026-10-09", entry_type: "lunch", title: "", recipe: { recipe_id: "r2", slug: "curry", name: "Curry", total_time: "35 minutes" } },
      { mealplan_id: "a", mealplan_date: "2026-10-08", entry_type: "dinner", title: "Reste essen", recipe: null },
      { mealplan_id: "c", mealplan_date: "2026-10-08", entry_type: "dinner", title: "" },
    ] });
    expect(e.map((x) => [x.date, x.type, x.title, x.time])).toEqual([["2026-10-08", "dinner", "Reste essen", undefined], ["2026-10-09", "lunch", "Curry", 35]]);
    expect(ymdLocal(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("Schlafen", () => {
  it("Countdown und Uhrzeit verschieben", () => {
    const now = new Date(2026, 9, 7, 22, 0).getTime();
    expect(minutesUntil(new Date(2026, 9, 7, 23, 25), now)).toBe(85);
    expect([formatShortDuration(45), formatShortDuration(85)]).toEqual(["45 min", "1:25 h"]);
    expect([shiftTime(23 * 60 + 50, 15), shiftTime(10, -15), shiftTime(22 * 60, -15)]).toEqual(["00:05:00", "23:55:00", "21:45:00"]);
  });
});

describe("Wochenrückblick Energie", () => {
  it("Wochen- und Monatsanfang", () => {
    expect(weekStart(new Date(2026, 9, 7, 15)).toDateString()).toBe(new Date(2026, 9, 5).toDateString());
    expect(weekStart(new Date(2026, 9, 11), -1).toDateString()).toBe(new Date(2026, 8, 28).toDateString());
    expect(monthStart(new Date(2026, 0, 20), -1).toDateString()).toBe(new Date(2025, 11, 1).toDateString());
  });
  it("verteilt Tageswerte und vergleicht", () => {
    const start = new Date(2026, 9, 5);
    const rows = [0, 1, 1, 3, 9].map((d, i) => ({ start: new Date(2026, 9, 5 + d, 0, 0).getTime(), change: [1.5, 2, 0.5, null, 4][i] as number | null }));
    expect(dailyTotals(rows, start, 7)).toEqual([1.5, 2.5, 0, 0, 0, 0, 0]);
    expect(dailyTotals([{ start: new Date(2026, 9, 6).toISOString(), change: 1500 }], start, 7, kwhFactor("Wh"))[1]).toBe(1.5);
    expect([kwhFactor("kWh"), kwhFactor("Wh"), kwhFactor("MWh")]).toEqual([1, 0.001, 1000]);
    expect([percentChange(12, 10), percentChange(8, 10), percentChange(5, 0)]).toEqual([20, -20, undefined]);
  });
});

describe("Hue-Räume und Pakete", () => {
  const L = (id: string, name: string, extra: Record<string, unknown> = {}): HassEntity => ({ entity_id: id, state: "on", attributes: { friendly_name: name, ...extra } } as HassEntity);
  const states = Object.fromEntries([
    L("light.tv", "tv", { is_hue_group: true, hue_type: "room", entity_id: ["light.b", "light.a"] }),
    L("light.wz_zone", "Wohnzimmer_", { is_hue_group: true, hue_type: "zone", entity_id: ["light.a", "light.b", "light.c"] }),
    L("light.wz_room", "Wohnzimmer", { is_hue_group: true, hue_type: "room", entity_id: ["light.c"] }),
    L("light.a", "A"), L("light.b", "B"), L("light.c", "C"),
    { entity_id: "scene.tv_hell", state: "unknown", attributes: { friendly_name: "tv Hell", group_name: "tv", name: "Hell" } } as HassEntity,
  ].map((s) => [s.entity_id, s]));
  it("findet Lampen eines Hue-Raums (Raum vor Zone)", () => {
    expect(hueRoomLights(states, "TV")).toEqual({ group: "light.tv", members: ["light.a", "light.b"] });
    expect(hueRoomLights(states, "Wohnzimmer")?.group).toBe("light.wz_room");
    expect(hueRoomLights(states, "Küche")).toBeUndefined();
    expect(hueRooms(states).map((r) => `${r.name}:${r.lights}:${r.scenes}`)).toEqual(["tv:2:1", "Wohnzimmer:3:0"]);
    const g = sceneGroups(states, { rooms: ["tv"] });
    expect([g[0]!.name, g[0]!.group, g[0]!.lights.length, g[0]!.scenes.length]).toEqual(["TV", "light.tv", 2, 1]);
  });
  it("Paket-Status, Versender, Texte und Sortierung", () => {
    expect(["In Transit", "Delivered", "Ready to be picked up", "Undelivered", "Not Found", "Alert"].map((s) => parcelStatus(s).key))
      .toEqual(["transit", "delivered", "ready", "problem", "not_found", "problem"]);
    expect(["00340434469856658870", "1Z999AA10123456784", "TBA123456789000", "RR123456789DE", "JJD000390007777777", "DE5922818887"].map(parcelCarrier))
      .toEqual(["DHL", "UPS", "Amazon", "Deutsche Post", "DHL", "DHL"]);
    expect(parcelText("The shipment has been successfully delivered")).toBe("Erfolgreich zugestellt");
    expect(parcelText("Something special", "de")).toBe("Something special");
    const now = Date.parse("2026-10-07T12:00:00Z");
    const sorted = sortParcels([
      { tracking_number: "1", status: "Delivered", timestamp: "2026-10-07T08:00:00Z" },
      { tracking_number: "2", status: "In Transit", timestamp: "2026-10-06T08:00:00Z" },
      { tracking_number: "3", status: "In Transit", timestamp: "2026-10-07T09:00:00Z" },
      { tracking_number: "4", status: "Delivered", timestamp: "2026-09-20T08:00:00Z" },
      { tracking_number: "5", status: "Ready to be picked up" },
    ], 3, now);
    expect(sorted.map((p) => p.tracking_number)).toEqual(["5", "3", "2", "1"]);
  });
});
