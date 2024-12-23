import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, Service } from 'homebridge';
import { ThermostatPlatformConfig } from './settings.js';
export declare class ThermostatPlatform implements DynamicPlatformPlugin {
    readonly log: Logging;
    readonly config: ThermostatPlatformConfig;
    readonly api: API;
    readonly Service: typeof Service;
    readonly Characteristic: typeof Characteristic;
    readonly accessories: Map<string, PlatformAccessory>;
    readonly motorIp: string;
    readonly sensorIp: string;
    constructor(log: Logging, config: ThermostatPlatformConfig, api: API);
    configureAccessory(accessory: PlatformAccessory): void;
    discoverDevice(): void;
    private findDevice;
}
