export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
}

export interface EntityRegistryEntry {
  entity_id: string;
  device_id?: string | null;
  area_id?: string | null;
  hidden?: boolean;
  entity_category?: string | null;
}

export interface DeviceRegistryEntry {
  id: string;
  area_id?: string | null;
  name?: string | null;
  name_by_user?: string | null;
  model?: string | null;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  entities?: Record<string, EntityRegistryEntry>;
  devices?: Record<string, DeviceRegistryEntry>;
  areas?: Record<string, { area_id: string; name: string }>;
  language: string;
  locale?: { language: string };
  config: { unit_system: { temperature: string } };
  themes?: { darkMode?: boolean };
  callService(domain: string, service: string, data?: Record<string, unknown>): Promise<unknown>;
  callWS<T>(msg: Record<string, unknown>): Promise<T>;
  callApi?<T>(method: "GET" | "POST", path: string, data?: Record<string, unknown>): Promise<T>;
  services?: Record<string, Record<string, unknown>>;
  connection?: {
    subscribeMessage<T>(callback: (msg: T) => void, msg: Record<string, unknown>): Promise<() => void>;
  };
  localize?(key: string, ...args: unknown[]): string;
  formatEntityState?(entity: HassEntity, state?: string): string;
  formatEntityAttributeValue?(entity: HassEntity, attribute: string, value?: unknown): string;
}

export type CardLayout = "full" | "compact";

export interface ShowConfig {
  modes?: boolean;
  fan?: boolean;
  swing?: boolean;
  presets?: boolean;
  humidity?: boolean;
  sensors?: boolean;
  graph?: boolean;
  shortcuts?: boolean;
  timer?: boolean;
  airflow?: boolean;
  hints?: boolean;
}

export interface ShortcutConfig {
  entity: string;
  name?: string;
  icon?: string;
}

export type ContactType = "window" | "door";

export interface ContactConfig {
  entity: string;
  name?: string;
  type?: ContactType;
}

export interface ClimateCardConfig {
  type: string;
  entity: string;
  name?: string;
  icon?: string;
  layout?: CardLayout;
  show?: ShowConfig;
  temperature_sensor?: string;
  humidity_sensor?: string;
  outdoor_sensor?: string;
  power_sensor?: string;
  energy_sensor?: string;
  /** Veraltet: ein einzelner Kontakt. Wird intern zu `contact_sensors` hinzugefügt. */
  window_sensor?: string;
  /** Beliebig viele Fenster- und Türkontakte. */
  contact_sensors?: (string | ContactConfig)[];
  use_sensor_for_current?: boolean;
  graph_hours?: number;
  shortcuts?: (string | ShortcutConfig)[];
  auto_shortcuts?: boolean;
  expandable?: boolean;
  start_expanded?: boolean;
  dropdown_threshold?: number;
  timer_switch?: string;
  timer_time?: string;
  countdown_timer?: string;
  countdown_durations?: number[];
  weather_entity?: string;
  ventilation_delta?: number;
  humidity_warning?: number;
  power_threshold?: number;
  animations?: "full" | "reduced" | "off";
  /** Darstellung: automatisch erkannt, Klimaanlage oder Heizung */
  device_type?: "auto" | "ac" | "heating";
  /** Ventilöffnung (%) der Heizkörper im Raum */
  valve_sensors?: string[];
  /** Batteriestand (%) der Thermostate */
  battery_sensors?: string[];
  /** Ventil-/Batteriesensoren automatisch aus Gerät/Raum übernehmen (Heizung) */
  auto_heating_sensors?: boolean;
  /** Absenktemperatur für "Abwesend" (Homematic) */
  away_temperature?: number;
}

export interface OverviewEntityConfig {
  entity: string;
  name?: string;
}

export interface OverviewCardConfig {
  type: string;
  title?: string;
  entities: (string | OverviewEntityConfig)[];
  show_all_off?: boolean;
  show_controls?: boolean;
}

export interface LightShowConfig {
  lights?: boolean;
  scenes?: boolean;
  color?: boolean;
  temperature?: boolean;
  effects?: boolean;
  segments?: boolean;
  shortcuts?: boolean;
}

export interface LightCardConfig {
  type: string;
  entity: string;
  name?: string;
  icon?: string;
  layout?: CardLayout;
  show?: LightShowConfig;
  /** Lampen der Gruppe als steuerbare Zeilen (Standard) oder kompakte Ein/Aus-Kacheln */
  lights_layout?: "rows" | "tiles";
  /** Einzelne Lampen des Raums (sonst aus der Gruppe übernommen) */
  entities?: (string | { entity: string; name?: string })[];
  auto_entities?: boolean;
  /** Szenen (sonst Hue-Szenen der Gruppe) */
  scenes?: string[];
  auto_scenes?: boolean;
  motion_sensor?: string;
  illuminance_sensor?: string;
  /** Licht-Presets (Helligkeit + Weißton/Farbe) oder "default" für Hell/Warm/Gemütlich */
  presets?: "default" | { name: string; icon?: string; brightness?: number; kelvin?: number; rgb?: [number, number, number] }[];
  /** Segmente eines LED-Streifens (z.B. govee2mqtt `light.xyz_segment_001`) */
  segments?: string[];
  auto_segments?: boolean;
  /** Schalter/Buttons des Geräts (z.B. Govee „Gradient“) */
  shortcuts?: (string | ShortcutConfig)[];
  auto_shortcuts?: boolean;
  expandable?: boolean;
  start_expanded?: boolean;
  animations?: "full" | "reduced" | "off";
}

export interface LightGroupEntityConfig {
  entity: string;
  name?: string;
  icon?: string;
}

export interface LightGroupCardConfig {
  type: string;
  /** Lampen der Karte (beliebig, auch unterschiedliche Typen) */
  entities: (string | LightGroupEntityConfig)[];
  title?: string;
  icon?: string;
  /** Weißton/Farbe für alle in der Gruppenzeile anbieten */
  group_color?: boolean;
  /** Presets für alle (wie bei der Light Card) */
  presets?: LightCardConfig["presets"];
  /** Szenen (z.B. Hue-Szenen des Raums) als Chips */
  scenes?: string[];
  /** Einzellampen anzeigen */
  show_lights?: boolean;
  /** Einzellampen anfangs zugeklappt (nur Gruppenzeile) */
  collapsed?: boolean;
  animations?: "full" | "reduced" | "off";
}

export interface CoverShowConfig {
  /** Rollläden der Gruppe */
  covers?: boolean;
  /** Schnellwahl-Positionen */
  positions?: boolean;
  /** Lamellen-Neigung */
  tilt?: boolean;
  /** Himmel nach Sonnenstand (Tag/Dämmerung/Nacht) */
  sky?: boolean;
}

export interface CoverCardConfig {
  type: string;
  entity: string;
  name?: string;
  icon?: string;
  layout?: CardLayout;
  show?: CoverShowConfig;
  /** Schnellwahl in % Öffnung (Standard 0, 25, 50, 75, 100) */
  positions?: number[];
  /** Rollläden des Raums (sonst aus der Cover-Gruppe übernommen) */
  entities?: (string | { entity: string; name?: string; icon?: string })[];
  auto_entities?: boolean;
  /** Fenster-/Türkontakte: Hinweis, wenn beim Schließen etwas offen ist */
  contact_sensors?: string[];
  /** Rollo-Timer: Schalter (input_boolean/switch) + Uhrzeit (input_datetime) */
  timer_switch?: string;
  timer_time?: string;
  /** Fahrzeit ganz zu → ganz auf in Sekunden (für die gleichmäßige Fahrt-Animation, Standard 20) */
  travel_time?: number;
  /** Sonnenstand für den Himmel im Fenster (Standard sun.sun) */
  sun_entity?: string;
  /** Wetter im Fenster (Wolken, Regen, Schnee, Nebel) */
  weather_entity?: string;
  expandable?: boolean;
  start_expanded?: boolean;
  animations?: "full" | "reduced" | "off";
}

export interface CoverGroupCardConfig {
  type: string;
  entities: (string | { entity: string; name?: string; icon?: string })[];
  title?: string;
  icon?: string;
  positions?: number[];
  show_positions?: boolean;
  show_covers?: boolean;
  collapsed?: boolean;
  /** Fahrzeit ganz zu → ganz auf in Sekunden (Standard 20) */
  travel_time?: number;
  /** Rollo-Timer: Schalter + Uhrzeit */
  timer_switch?: string;
  timer_time?: string;
  /** Himmel nach Sonnenstand in den Kacheln (Standard an) */
  show_sky?: boolean;
  sun_entity?: string;
  weather_entity?: string;
  animations?: "full" | "reduced" | "off";
}

export interface SwitchTimeCardConfig {
  type: string;
  /** Schalter (input_boolean, switch, automation …) */
  switch_entity?: string;
  /** Zeit/Datum (input_datetime) */
  time_entity?: string;
  name?: string;
  icon?: string;
  /** Akzentfarbe (CSS-Farbe) */
  color?: string;
  /** Minutenschritte der Auswahl (Standard 5) */
  minute_step?: number;
  /** „in 7:12 h“ anzeigen (Standard an) */
  show_remaining?: boolean;
  /** toggle = Kippschalter rechts (Standard), button = ganze Zeile ist der Schalter (nur Symbol + Text) */
  switch_style?: "toggle" | "button";
  animations?: "full" | "reduced" | "off";
}

export interface MediaActivityConfig {
  /** Name der Harmony-Aktivität */
  name: string;
  label?: string;
  icon?: string;
  /** Gerät für Steuerkreuz/Wiedergabe in dieser Aktivität */
  control_device?: string;
  /** Gerät für Lautstärke in dieser Aktivität */
  volume_device?: string;
}

export interface MediaShowConfig {
  activities?: boolean;
  remote?: boolean;
  volume?: boolean;
  now_playing?: boolean;
  source?: boolean;
}

export interface MediaCardConfig {
  type: string;
  /** remote.* (z.B. Harmony Hub) oder media_player.* */
  entity: string;
  /** Media-Player für „Läuft gerade“, Lautstärke, Quelle */
  media_player?: string;
  name?: string;
  icon?: string;
  layout?: CardLayout;
  show?: MediaShowConfig;
  /** Reihenfolge/Beschriftung/Symbole der Aktivitäten (sonst alle aus dem Hub) */
  activities?: (string | MediaActivityConfig)[];
  /** Harmony-Gerät für Steuerkreuz/Wiedergabe (sonst automatisch) */
  control_device?: string;
  /** Harmony-Gerät für Lautstärke (sonst automatisch, z.B. Soundbar/AV-Receiver) */
  volume_device?: string;
  /** Sleeptimer: Schalter (input_boolean/switch) + Ausschaltzeit (input_datetime), wie bei der Klima-Karte */
  timer_switch?: string;
  timer_time?: string;
  /** Eigene Befehlsnamen, z.B. { select: "OK", back: "Return" } */
  commands?: Record<string, string>;
  expandable?: boolean;
  start_expanded?: boolean;
  animations?: "full" | "reduced" | "off";
}

export interface RoomChipConfig {
  entity: string;
  name?: string;
  icon?: string;
}

export interface RoomCardConfig {
  type: string;
  title?: string;
  icon?: string;
  /** Licht(gruppe) des Raums */
  light?: string;
  /** Fenster-/Türkontakte */
  contacts?: (string | ContactConfig)[];
  /** Temperatur: Sensor oder climate-Entität (current_temperature) */
  temperature?: string;
  /** Luftfeuchte: Sensor oder climate-Entität (current_humidity) */
  humidity?: string;
  humidity_warning?: number;
  /** Klimaanlage/Heizung */
  climate?: string;
  /** Harmony-Hub (remote) oder Media-Player */
  media?: string;
  /** Weitere Chips */
  chips?: (string | RoomChipConfig)[];
  /** Hinweis „Fenster offen – Klima läuft“ (Standard an) */
  window_warning?: boolean;
  /** Müllabfuhr: Kalender (z.B. Waste Collection Schedule) */
  trash?: string;
  /** Tage im Voraus (0 = nur heute, Standard 1 = heute + morgen) */
  trash_days?: number;
  /** Heutige Abholung ausblenden ab (Standard „10:00“) */
  trash_today_until?: string;
  /** full = Kopfzeile mit Chips, tile = Raumkachel */
  layout?: "full" | "tile";
  /** Tippen öffnet diese Seite (z.B. /dashboard-final/pascal) */
  navigation_path?: string;
  /** Farbe des Symbols / der Kachel, wenn kein Licht an ist */
  color?: string;
  animations?: "full" | "reduced" | "off";
}

export interface StatusCardConfig {
  type: string;
  title?: string;
  /** Batterie-Sensoren (Prozent oder binary_sensor) */
  batteries?: string[];
  /** Batterien automatisch aus diesen Bereichen (area_id) */
  areas?: string[];
  /** Schwach unter … % (Standard 20) */
  threshold?: number;
  /** Tür-/Fensterkontakte */
  contacts?: (string | ContactConfig)[];
  /** Tippen auf den Kopf navigiert hierhin */
  navigation_path?: string;
  /** Batterieliste anfangs offen */
  expanded?: boolean;
  /** Einkaufsliste: schwache Batterien nach Typ gruppiert (Battery Notes) */
  shopping_list?: boolean;
  /** „gewechselt vor … Tagen“ anzeigen (Battery Notes, Standard an) */
  show_replaced?: boolean;
  animations?: "full" | "reduced" | "off";
}

export interface VacuumCardConfig {
  type: string;
  entity: string;
  name?: string;
  icon?: string;
  /** Kartenbild (image.*); Standard: automatisch (mit Kalibrierung/Räumen bevorzugt) */
  map?: string;
  /** Räume selbst festlegen (sonst aus der Karte) */
  rooms?: { id: number; name?: string; icon?: string }[];
  show?: { map?: boolean; rooms?: boolean; controls?: boolean; settings?: boolean; shortcuts?: boolean; maintenance?: boolean };
  /** Auswahlen (select.*) wie Reinigungsmodus – sonst automatisch vom Gerät */
  selects?: string[];
  /** Routinen/Buttons (button.*) – sonst automatisch vom Gerät */
  shortcuts?: string[];
  /** Weitere Verbrauchsteile, z.B. der Station (Sensoren „… verbleibend“) */
  maintenance_sensors?: string[];
  animations?: "full" | "reduced" | "off";
}

export interface PresencePersonConfig {
  entity: string;
  name?: string;
  /** Akku-Sensor (sonst automatisch vom Handy der Person) */
  battery?: string;
  /** Ladestatus (sonst automatisch) */
  charging?: string;
}

export interface PresenceCardConfig {
  type: string;
  /** Personen (person.*) */
  persons?: (string | PresencePersonConfig)[];
  /** Schloss / Nuki Opener (lock.*) */
  lock?: string;
  door_name?: string;
  door_icon?: string;
  /** Statt lock.open: Skript oder Button ausführen */
  open_action?: string;
  /** Klingel-Sensor (sonst automatisch vom Gerät) */
  doorbell?: string;
  /** auto (Gerätemodell), opener (Ring to Open) oder lock */
  door_type?: "auto" | "opener" | "lock";
  /** Öffnen per Halten (Standard) oder Tippen */
  open_confirm?: "hold" | "tap";
  /** Handy-Akku zeigen (Standard an) */
  show_battery?: boolean;
  /** Kacheln pro Zeile (Standard: alle in einer Zeile, max. 4) */
  columns?: number;
  animations?: "full" | "reduced" | "off";
}

export interface AlertConfig {
  /** Entität, deren Zustand den Hinweis auslöst */
  entity?: string;
  /** Fenster-/Türkontakte: Hinweis „Fenster offen – Marcel“, sobald einer offen ist */
  contacts?: (string | ContactConfig)[];
  /** Aktiv bei diesem Zustand / diesen Zuständen (ohne Angabe: „on“) */
  state?: string | string[];
  state_not?: string | string[];
  above?: number;
  below?: number;
  title?: string;
  /** Zweite Zeile (Standard: Zustand bzw. Namen der offenen Kontakte) */
  message?: string;
  icon?: string;
  /** info (blau), warning (orange, Standard), error (rot), success (grün) – oder eine CSS-Farbe */
  severity?: "info" | "warning" | "error" | "success";
  color?: string;
  /** Tippen öffnet diese Seite (sonst Details der Entität) */
  navigation_path?: string;
}

export interface AlertCardConfig {
  type: string;
  alerts?: AlertConfig[];
  /** Kurzform für den häufigsten Fall: Fenster-/Türkontakte */
  contacts?: (string | ContactConfig)[];
  /** Statt auszublenden „Alles in Ordnung“ zeigen */
  show_ok?: boolean;
  ok_text?: string;
  animations?: "full" | "reduced" | "off";
}

/** Entität als Text (Vorzeichen) oder getrennt nach Richtung – wie power-flow-card-plus */
export type EnergyEntity = string | { consumption?: string; production?: string };

export interface EnergyIndividualConfig {
  entity: string;
  name?: string;
  icon?: string;
  color?: string;
  /** Auch bei 0 W als Kreis im Diagramm zeigen */
  display_zero?: boolean;
}

export interface EnergyCardConfig {
  type: string;
  title?: string;
  entities: {
    solar?: { entity: string; name?: string; icon?: string; display_zero_state?: boolean };
    /** consumption = Entladen (zum Haus), production = Laden; Text: positiv = Entladen */
    battery?: { entity?: EnergyEntity; state_of_charge?: string; name?: string; icon?: string; invert_state?: boolean };
    /** consumption = Netzbezug, production = Einspeisung; Text: positiv = Bezug */
    grid?: { entity: EnergyEntity; name?: string; icon?: string; invert_state?: boolean };
    home?: { entity?: string; name?: string; icon?: string };
    individual?: EnergyIndividualConfig[];
  };
  /** Ab dieser Leistung in kW anzeigen (Standard 1000 W) */
  watt_threshold?: number;
  w_decimals?: number;
  kw_decimals?: number;
  /** Animationsdauer der Punkte in Sekunden (schnellster / langsamster Fluss) */
  min_flow_rate?: number;
  max_flow_rate?: number;
  /** Bei dieser Leistung laufen die Punkte am schnellsten (Standard 2000 W) */
  max_expected_power?: number;
  /** Weitere Verbraucher unter dem Diagramm als Liste (Standard an) */
  show_individual_list?: boolean;
  /** Linien ohne Fluss trotzdem zeigen (Standard an) */
  display_zero_lines?: boolean;
  /** Tippen öffnet Details (Standard an) */
  clickable_entities?: boolean;
  animations?: "full" | "reduced" | "off";
  [key: string]: unknown;
}
