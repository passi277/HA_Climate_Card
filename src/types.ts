export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  language: string;
  locale?: { language: string };
  config: { unit_system: { temperature: string } };
  themes?: { darkMode?: boolean };
  callService(domain: string, service: string, data?: Record<string, unknown>): Promise<unknown>;
  callWS<T>(msg: Record<string, unknown>): Promise<T>;
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
}
