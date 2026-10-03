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
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  entities?: Record<string, EntityRegistryEntry>;
  devices?: Record<string, DeviceRegistryEntry>;
  language: string;
  locale?: { language: string };
  config: { unit_system: { temperature: string } };
  themes?: { darkMode?: boolean };
  callService(domain: string, service: string, data?: Record<string, unknown>): Promise<unknown>;
  callWS<T>(msg: Record<string, unknown>): Promise<T>;
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
  /** Einzelne Lampen des Raums (sonst aus der Gruppe übernommen) */
  entities?: (string | { entity: string; name?: string })[];
  auto_entities?: boolean;
  /** Szenen (sonst Hue-Szenen der Gruppe) */
  scenes?: string[];
  auto_scenes?: boolean;
  motion_sensor?: string;
  illuminance_sensor?: string;
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
  /** Eigene Befehlsnamen, z.B. { select: "OK", back: "Return" } */
  commands?: Record<string, string>;
  expandable?: boolean;
  start_expanded?: boolean;
  animations?: "full" | "reduced" | "off";
}
