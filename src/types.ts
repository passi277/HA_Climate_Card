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
  platform?: string;
  translation_key?: string;
}

export interface DeviceRegistryEntry {
  id: string;
  area_id?: string | null;
  name?: string | null;
  name_by_user?: string | null;
  model?: string | null;
  via_device_id?: string | null;
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
  /** Musik-Modi (z.B. Govee „Music: …“) als eigener Bereich */
  music?: boolean;
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
  /** Auch bei 0 W / nicht verfügbar als Kreis zeigen (sonst ausgeblendet, siehe hide_inactive_consumers) */
  display_zero?: boolean;
  /** Schalter/Stecker: lange drücken schaltet ihn */
  switch?: string;
}

export interface EnergyCardConfig {
  type: string;
  title?: string;
  entities: {
    solar?: { entity: string; name?: string; icon?: string; display_zero_state?: boolean };
    /** consumption = Entladen (zum Haus), production = Laden; Text: positiv = Entladen */
    battery?: { entity?: EnergyEntity; state_of_charge?: string; name?: string; icon?: string; invert_state?: boolean;
      /** Kapazität in kWh oder Entität (Wh/kWh) – für „reicht noch … h“ */
      capacity?: number | string; min_soc?: number };
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
  /** Verbraucher-Kreise pro Zeile (Standard 4) */
  consumer_columns?: number;
  /** Verbraucher mit 0 W oder „nicht verfügbar“ ausblenden, bis sie wieder etwas verbrauchen (Standard an) */
  hide_inactive_consumers?: boolean;
  /** „Sonstiges“ = Haus minus alle Verbraucher (Standard an) */
  show_other?: boolean;
  /** Tageswerte aus dem Verlauf (Standard an) */
  show_daily?: boolean;
  /** full = Diagramm, compact = eine Zeile */
  layout?: "full" | "compact";
  /** Linien ohne Fluss trotzdem zeigen (Standard an) */
  display_zero_lines?: boolean;
  /** Tippen öffnet Details (Standard an) */
  clickable_entities?: boolean;
  animations?: "full" | "reduced" | "off";
  [key: string]: unknown;
}

/** Smart-Bereich der Bewässerungskarte */
export interface IrrigationSmartConfig {
  /** „Neu berechnen“: automation.* (wird ausgelöst) oder script.* */
  calculate?: string;
  /** „Jetzt gießen“ (Skript, mit Rückfrage) */
  run?: string;
  /** „Konten auf 0“ – smart_irrigation.reset_all_buckets (mit Rückfrage) */
  reset_buckets?: boolean;
  /** Smart-Lauf fällt aus (binary_sensor) und Grund (Text) */
  skipped?: string;
  skipped_reason?: string;
  /** Jahreszeit (input_select), Unwetter-Warnstufe (Zahl, 0 = keine) */
  season?: string;
  warning?: string;
  /** Text mit gemessenem Durchfluss */
  measured_flow?: string;
  /** Hinweistext unten */
  note?: string;
}

/** Bewässerungs-Zone: ein Ventil, optional mit Timer, Dauer und Sensoren */
export interface IrrigationZoneConfig {
  valve: string;
  name?: string;
  icon?: string;
  color?: string;
  /** timer.* – Restzeit und Fortschritt */
  timer?: string;
  /** input_number/number.* – Laufzeit in Minuten (mit −/+ einstellbar) */
  duration?: string;
  /** Durchfluss (m³/h, l/h, l/min) */
  flow?: string;
  /** Wassermenge (z.B. letzter Lauf / heute) */
  volume?: string;
  battery?: string;
  /** Berechnete Laufzeit (z.B. Smart Irrigation, in s/min) – gilt im smart_mode */
  smart_duration?: string;
  /** Eigene Skripte statt Timer + Ventil direkt; script_data wird mitgeschickt (z.B. zone: volleyball) */
  start_script?: string;
  pause_script?: string;
  stop_script?: string;
  script_data?: Record<string, unknown>;
}

export interface IrrigationCardConfig {
  type: string;
  title?: string;
  icon?: string;
  /** Pumpe / Hauswasserwerk (switch) */
  pump?: string;
  pump_power?: string;
  /** Strang „Sonstiges“: Pumpe zieht Strom, aber kein Ventil ist offen (Standard an, braucht pump_power) */
  show_other?: boolean;
  other_name?: string;
  other_icon?: string;
  /** Ab dieser Leistung (W) pumpt das Hauswasserwerk (Standard 15) */
  other_threshold?: number;
  /** input_select/select – Modus (z.B. Aus/Automatik/Smart) */
  mode?: string;
  /** input_datetime/time – Startzeit der Automatik */
  start_time?: string;
  /** Durchlauf aller Zonen (Skript) und dessen Status (input_boolean) */
  run_all?: string;
  run_all_active?: string;
  /** Notaus (Skript) – sonst: alle Timer stoppen, Ventile und Pumpe aus */
  stop_all?: string;
  /** Modus-Option, in der die Laufzeiten berechnet werden (z.B. "Smart") – dann gesperrt, Vorschlag aus smart_duration */
  smart_mode?: string;
  /** Smart: höchstens so viele Minuten (z.B. 30), darunter wird übersprungen (z.B. 3) */
  smart_max?: number;
  smart_min?: number;
  /** Zusätzliche Smart-Infos und -Aktionen (nur im smart_mode sichtbar) */
  smart?: IrrigationSmartConfig;
  /** Schnellwahl der Laufzeit in Minuten (Standard 5, 10, 15, 20, 30, 45, 60) */
  durations?: number[];
  /** Text-Entität mit Infos zum letzten Lauf */
  last_run?: string;
  zones: IrrigationZoneConfig[];
  animations?: "full" | "reduced" | "off";
  [key: string]: unknown;
}

/** Pool: Filterpumpe, Wasserwerte, Laufzeit, Pflege und Wartung */
export interface PoolCardConfig {
  type: string;
  title?: string;
  pump?: string;
  pump_power?: string;
  /** input_select – Betriebsmodus; target_mode: Modus, in dem target_runtime gilt (Standard „Automatik“) */
  mode?: string;
  target_mode?: string;
  start_time?: string;
  /** Laufzeiten in Stunden */
  target_runtime?: string;
  recommended_runtime?: string;
  runtime_today?: string;
  temperature?: string;
  ph?: string;
  orp?: string;
  /** Handlungshinweis (Text), letzte Messung, Messung veraltet, Gesamtbewertung (ok/check/critical) */
  guidance?: string;
  last_measurement?: string;
  measurement_stale?: string;
  quality?: string;
  energy_today?: string;
  cost_today?: string;
  solar_power?: string;
  solar_savings?: string;
  /** Auto-Aus bei Störung (input_boolean) */
  auto_off?: string;
  backwash?: { due?: string; hours?: string; interval?: number; last?: string; done_button?: string; script?: string; timer?: string };
  rinse?: { script?: string; timer?: string };
  /** Grenzen [rot-unten, grün-ab, grün-bis, rot-oben]; Temperatur [kalt-bis, warm-ab] */
  ranges?: { ph?: [number, number, number, number]; orp?: [number, number, number, number]; temperature?: [number, number] };
  /** Pflege: pH-Ziel, Gramm je 0,1 pH, Chlor-Granulat in g (niedrig / kritisch) */
  care?: false | { ph_target?: number; ph_dose?: number; chlorine_low?: number; chlorine_critical?: number };
  /** Schnellwahl Ziel-Laufzeit in Stunden */
  runtimes?: number[];
  animations?: "full" | "reduced" | "off";
  [key: string]: unknown;
}

/** Zuordnungen einer Kamera – werden über das Gerät automatisch gefunden und lassen sich überschreiben */
export interface CameraFeatures {
  person?: string;
  vehicle?: string;
  animal?: string;
  motion?: string;
  battery?: string;
  battery_low?: string;
  wifi?: string;
  temperature?: string;
  sleep?: string;
  light?: string;
  siren?: string;
  motion_switch?: string;
  tracking?: string;
  presets?: string;
  home_button?: string;
  ptz_left?: string;
  ptz_right?: string;
  ptz_up?: string;
  ptz_down?: string;
  ptz_stop?: string;
}

export interface CameraCardConfig extends CameraFeatures {
  type: string;
  entity: string;
  name?: string;
  /** weitere Linsen/Ansichten (z.B. Tele) – umschaltbar */
  lenses?: (string | { entity: string; name?: string })[];
  /** auto = live, wenn die Kamera streamen kann; live; snapshot */
  camera_view?: "auto" | "live" | "snapshot";
  /** Skript für eine Patrouille */
  patrol?: string;
  /** Automatische Erkennung über das Gerät abschalten */
  auto_detect?: boolean;
  /** Standbild alle x Sekunden neu laden (Standard 10) */
  refresh_interval?: number;
  aspect_ratio?: string;
  animations?: "full" | "reduced" | "off";
  [key: string]: unknown;
}

export interface CameraGroupCardConfig {
  type: string;
  title?: string;
  cameras: (string | (Partial<CameraCardConfig> & { entity: string }))[];
  /** Alarmanlage (alarm_control_panel) für Scharf/Unscharf */
  alarm?: string;
  columns?: number;
  /** Kameras mit Bewegung zuerst (Standard an) */
  sort_motion?: boolean;
  camera_view?: "auto" | "live" | "snapshot";
  refresh_interval?: number;
  animations?: "full" | "reduced" | "off";
  [key: string]: unknown;
}

/** Darstellung einer Option */
export interface SelectOptionConfig { name?: string; icon?: string; color?: string; hide?: boolean }

export type SelectLayout = "auto" | "segment" | "chips" | "tiles" | "list" | "dropdown";

export interface SelectEntityConfig {
  entity: string;
  name?: string;
  icon?: string;
  layout?: SelectLayout;
  options?: Record<string, SelectOptionConfig>;
  /** Optionen mit Rückfrage („Sicher?“) */
  confirm?: string[];
}

export interface SelectCardConfig {
  type: string;
  title?: string;
  entity?: string;
  entities?: (string | SelectEntityConfig)[];
  name?: string;
  icon?: string;
  layout?: SelectLayout;
  options?: Record<string, SelectOptionConfig>;
  confirm?: string[];
  /** Kacheln je Zeile (Standard: automatisch bis 4) */
  columns?: number;
  animations?: "full" | "reduced" | "off";
  [key: string]: unknown;
}


/** Zuordnungen eines Mähroboters – werden über das Gerät automatisch gefunden und lassen sich überschreiben */
export interface MowerFeatures {
  battery?: string;
  error?: string;
  progress?: string;
  area?: string;
  session_area?: string;
  duration?: string;
  total_area?: string;
  total_duration?: string;
  total_count?: string;
  blade?: string;
  brush?: string;
  wifi?: string;
  stop?: string;
  refresh?: string;
  efficiency?: string;
  obstacle?: string;
  rain_delay?: string;
  rain_sensor?: string;
  ai?: string;
  animal?: string;
  animal_start?: string;
  animal_end?: string;
  border?: string;
  safe?: string;
  update?: string;
  map?: string;
}

export interface MowerShowConfig {
  scene?: boolean;
  /** Bereiche zum Antippen und „Ausgewählte mähen“ (wenn die Integration `mow_areas` anbietet) */
  areas?: boolean;
  controls?: boolean;
  session?: boolean;
  stats?: boolean;
  maintenance?: boolean;
  settings?: boolean;
}

export interface MowerCardConfig extends MowerFeatures {
  type: string;
  /** lawn_mower.* */
  entity: string;
  name?: string;
  show?: MowerShowConfig;
  /** Einstellungen anfangs aufgeklappt */
  settings_open?: boolean;
  /** Live-Positions-Stream anfordern, solange die Karte sichtbar ist und der Mäher fährt (Standard an, wenn die Integration es anbietet) */
  live_stream?: boolean;
  animations?: "full" | "reduced" | "off";
  [key: string]: unknown;
}

export interface StarlinkFeatures {
  online?: string;
  ping?: string;
  drop?: string;
  down_rate?: string;
  up_rate?: string;
  down_total?: string;
  up_total?: string;
  power?: string;
  energy?: string;
  boot?: string;
  azimuth?: string;
  elevation?: string;
  obstructed?: string;
  heating?: string;
  sleeping?: string;
  update?: string;
  roaming?: string;
  thermal?: string;
  motors?: string;
  mast?: string;
  location?: string;
  ethernet?: string;
  stow?: string;
  sleep_schedule?: string;
  reboot?: string;
}

export interface SpeedtestFeatures {
  download?: string;
  upload?: string;
  ping?: string;
}

export interface StarlinkShowConfig {
  live?: boolean;
  speedtest?: boolean;
  history?: boolean;
  usage?: boolean;
  controls?: boolean;
}

export interface StarlinkCardConfig extends StarlinkFeatures {
  type: string;
  /** Beliebige Entität der Starlink-Schüssel (Standard: Konnektivität) – leer = nur Speedtest */
  entity?: string;
  /** Beliebiger Speedtest-Sensor (speedtestdotnet) */
  speedtest?: string;
  speedtest_download?: string;
  speedtest_upload?: string;
  speedtest_ping?: string;
  name?: string;
  show?: StarlinkShowConfig;
  /** Tage im Speedtest-Verlauf (Standard 7) */
  history_days?: number;
  animations?: "full" | "reduced" | "off";
  [key: string]: unknown;
}

export type LlmCategory = "person" | "vehicle" | "animal" | "package" | "nature" | "other" | "none";

export interface LlmEvent {
  id: string;
  title: string;
  description: string;
  start: string;
  end?: string;
  /** Pfad des Snapshots (z.B. /media/llmvision/snapshots/x.jpg) */
  image?: string;
  camera?: string;
  label?: string;
  category: LlmCategory;
}

export interface LlmTimelineCardConfig {
  type: string;
  /** calendar.llm_vision_timeline */
  entity: string;
  name?: string;
  /** Zeitraum in Tagen (Standard 7) */
  days?: number;
  /** Einträge in der Liste (Standard 20, „Mehr anzeigen“ lädt weitere) */
  limit?: number;
  show_latest?: boolean;
  show_filters?: boolean;
  /** Ereignisse „Keine Aktivität“ anzeigen (Standard aus) */
  show_no_activity?: boolean;
  /** Nur diese Kameras */
  cameras?: string[];
  animations?: "full" | "reduced" | "off";
  [key: string]: unknown;
}

export interface HomeBatteryFeatures {
  soc?: string;
  energy?: string;
  capacity?: string;
  solar?: string;
  battery_power?: string;
  charge_power?: string;
  discharge_power?: string;
  home?: string;
  grid_charge?: string;
  socket?: string;
  heater?: string;
  status?: string;
  mode?: string;
  error?: string;
  cloud?: string;
  heating?: string;
  solar_today?: string;
  savings_today?: string;
  savings?: string;
  co2?: string;
  refresh?: string;
}

export interface HomeBatteryShowConfig {
  flow?: boolean;
  strings?: boolean;
  stats?: boolean;
  history?: boolean;
}

export interface HomeBatteryCardConfig extends HomeBatteryFeatures {
  type: string;
  /** Ladestand-Sensor (device_class battery) */
  entity: string;
  name?: string;
  /** PV-Strings (Standard: automatisch, z.B. solar_pv1…4) */
  strings?: string[];
  show?: HomeBatteryShowConfig;
  /** Stunden im Verlauf (Standard 48) */
  hours_to_show?: number;
  animations?: "full" | "reduced" | "off";
  [key: string]: unknown;
}

export interface SystemCardConfig {
  type: string;
  name?: string;
  /** Ressourcen-Sensoren in % (Standard: automatisch CPU/RAM/Disk) */
  resources?: (string | { entity: string; name?: string; icon?: string })[];
  /** Dienste (binary_sensor/switch), z.B. Zigbee2MQTT, MQTT */
  services?: (string | { entity: string; name?: string; icon?: string })[];
  /** Nur diese Updates (Standard: alle update.*) */
  updates?: string[];
  /** Diese Updates ausblenden */
  exclude_updates?: string[];
  /** So viele Updates anzeigen, Rest über „Alle anzeigen“ (Standard 5) */
  max_updates?: number;
  /** Backup gilt nach so vielen Tagen als überfällig (Standard 3) */
  backup_max_age?: number;
  show_resources?: boolean;
  show_updates?: boolean;
  show_backup?: boolean;
  show_restart?: boolean;
  /** „YAML prüfen“ und „Schnell neu laden“ (Standard an) */
  show_actions?: boolean;
  animations?: "full" | "reduced" | "off";
  [key: string]: unknown;
}

export interface WeatherForecast {
  datetime: string;
  condition?: string;
  temperature?: number;
  templow?: number;
  precipitation?: number;
  precipitation_probability?: number;
  wind_speed?: number;
  wind_bearing?: number;
  is_daytime?: boolean;
  humidity?: number;
  uv_index?: number;
}

export interface WeatherCardConfig {
  type: string;
  /** weather.* */
  entity: string;
  name?: string;
  show_hourly?: boolean;
  show_daily?: boolean;
  show_details?: boolean;
  /** Werte/Stunden/Tage anfangs zugeklappt (danach merkt sich der Browser den Zustand) */
  collapsed?: boolean;
  /** Tage in der Vorschau (Standard 7) */
  days?: number;
  /** Stunden im Verlauf (Standard 24) */
  hours?: number;
  animations?: "full" | "reduced" | "off";
  [key: string]: unknown;
}

export interface AgendaCalendar { entity: string; name?: string; color?: string; icon?: string }

export interface AgendaCardConfig {
  type: string;
  name?: string;
  /** Abfallkalender (Waste Collection Schedule o.ä.) – eine oder mehrere Entitäten */
  waste?: string | string[];
  /** Weitere Kalender für die Termin-Liste */
  calendars?: (string | AgendaCalendar)[];
  /** Zeitraum in Tagen (Standard 14) */
  days?: number;
  /** Höchstens so viele Termine (Standard 12) */
  max_events?: number;
  /** Müll-Termine zusätzlich in der Liste zeigen (Standard nein) */
  waste_in_agenda?: boolean;
  /** Ab dieser Uhrzeit am Vortag „Heute rausstellen“ (Standard 16:00) */
  reminder_time?: string;
  animations?: "full" | "reduced" | "off";
  [key: string]: unknown;
}

export interface DeviceStatusCardConfig {
  type: string;
  name?: string;
  /** Diese Domains ignorieren (Standard: device_tracker) */
  exclude_domains?: string[];
  /** Diese Integrationen (platform) ignorieren */
  exclude_integrations?: string[];
  /** Diese Entitäten ignorieren */
  exclude?: string[];
  /** Auch „unbekannt“ als Problem werten (Standard nein) */
  include_unknown?: boolean;
  /** Höchstens so viele Geräte, Rest über „Alle anzeigen“ (Standard 8) */
  max_items?: number;
  animations?: "full" | "reduced" | "off";
  [key: string]: unknown;
}

export interface RecipeCardConfig {
  type: string;
  name?: string;
  /** Mealie-Integration (sonst automatisch die erste) */
  config_entry_id?: string;
  /** Mealie-Adresse für Rezeptbilder, z. B. http://mealie.local:9925 */
  mealie_url?: string;
  /** Tage im Essensplan (Standard 7) */
  days?: number;
  /** Diese Mahlzeiten zeigen (Standard Mittag + Abend) */
  entry_types?: string[];
  /** Einkaufsliste für „Zutaten auf die Liste“ (Standard todo.mealie_einkaufsliste) */
  shopping_list?: string;
  /** Rezeptsuche zeigen (Standard an) */
  show_search?: boolean;
  animations?: "full" | "reduced" | "off";
  [key: string]: unknown;
}

export interface SceneGroupConfig {
  name: string;
  icon?: string;
  /** Hue-Raum (`group_name`) oder Textmuster im Szenennamen */
  match?: string;
  /** Feste Szenenliste (statt `match`) */
  scenes?: string[];
  /** Lampen des Raums (Leiste mit an/aus + Helligkeit) */
  lights?: string[];
}

export interface SceneCardConfig {
  type: string;
  name?: string;
  /** Räume/Gruppen – ohne Angabe automatisch aus den Hue-Räumen */
  groups?: SceneGroupConfig[];
  /** Nur Szenen, deren Name eines der Muster enthält */
  include?: string[];
  /** Szenen mit diesen Mustern ausblenden */
  exclude?: string[];
  /** Favoriten oben (Szenen-Entitäten) */
  favorites?: string[];
  /** Kacheln pro Zeile (Standard 3) */
  columns?: number;
  animations?: "full" | "reduced" | "off";
  [key: string]: unknown;
}

export interface SleepTimerConfig {
  /** input_boolean: Timer aktiv */
  switch?: string;
  /** input_datetime / time: Uhrzeit */
  time: string;
  name?: string;
  icon?: string;
}

export interface SleepPersonConfig {
  name: string;
  icon?: string;
  color?: string;
  /** input_boolean: Schlafmodus */
  sleep?: string;
  timers?: SleepTimerConfig[];
  climate?: string;
  lights?: string[];
  /** media_player / remote zum Ausschalten */
  media?: string[];
  /** Sensor mit Weckzeit (Zeitstempel), z. B. nächster Wecker vom Handy */
  alarm?: string;
}

export interface SleepCardConfig {
  type: string;
  name?: string;
  persons: SleepPersonConfig[];
  animations?: "full" | "reduced" | "off";
  [key: string]: unknown;
}

export interface ClimateRoomConfig {
  name: string;
  icon?: string;
  temperature?: string;
  humidity?: string;
  /** Heizung (z. B. Homematic-Gruppe mit Wochenprogramm) */
  heating?: string;
  /** Klimaanlage */
  ac?: string;
  /** Fenster/Tür-Kontakt */
  window?: string;
  navigation_path?: string;
}

export interface ClimateRoomsCardConfig {
  type: string;
  name?: string;
  rooms: ClimateRoomConfig[];
  /** Komfortbereich Luftfeuchte (Standard 40–60) */
  humidity_range?: [number, number];
  animations?: "full" | "reduced" | "off";
  [key: string]: unknown;
}

export interface EnergyWeekEntity {
  entity: string;
  name?: string;
  color?: string;
}

export interface EnergyWeekCardConfig {
  type: string;
  name?: string;
  /** Energiezähler (kWh/Wh, steigend) – ohne Angabe aus den Energie-Einstellungen */
  entities?: (string | EnergyWeekEntity)[];
  /** Strompreis in €/kWh (Standard 0,30) */
  price?: number;
  currency?: string;
  animations?: "full" | "reduced" | "off";
  [key: string]: unknown;
}
