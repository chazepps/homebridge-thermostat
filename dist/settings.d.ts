import { PlatformConfig } from 'homebridge';
/**
 * This is the name of the platform that users will use to register the plugin in the Homebridge config.json
 */
export declare const PLATFORM_NAME = "thermostat";
/**
 * This must match the name of your plugin as defined the package.json
 */
export declare const PLUGIN_NAME = "@chazepps/homebridge-thermostat";
export interface ThermostatPlatformConfig extends PlatformConfig {
    motorIp?: string;
    sensorIp?: string;
}
