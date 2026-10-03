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
  hidden?: boolean;
  entity_category?: string | null;
}

export interface DeviceRegistryEntry {
  id: string;
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
  window_sensor?: string;
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
