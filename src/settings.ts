import { PlatformConfig } from 'homebridge';

/**
 * This is the name of the platform that users will use to register the plugin in the Homebridge config.json
 */
export const PLATFORM_NAME = 'thermostat';

/**
 * This must match the name of your plugin as defined the package.json
 */
export const PLUGIN_NAME = '@chazepps/homebridge-thermostat';

// Config
export interface ThermostatPlatformConfig extends PlatformConfig {
  motorIp?: string;
  sensorIp?: string;
}
