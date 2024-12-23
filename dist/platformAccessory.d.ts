import type { CharacteristicValue, PlatformAccessory } from 'homebridge';
import type { ThermostatPlatform } from './platform.js';
export declare class ThermostatAccessory {
    private readonly platform;
    private readonly accessory;
    private service;
    private currentTemp;
    private currentHumidity;
    private targetTemp;
    private isActive;
    private motorState;
    constructor(platform: ThermostatPlatform, accessory: PlatformAccessory);
    private lastUpdatedAt;
    getCurrentState(): Promise<CharacteristicValue>;
    getCurrentTemperature(): Promise<CharacteristicValue>;
    getCurrentHumidity(): Promise<CharacteristicValue>;
    setActive(value: CharacteristicValue): Promise<void>;
    getActive(): Promise<CharacteristicValue>;
    getCurrentHeaterCoolerState(): Promise<CharacteristicValue>;
    setTargetHeaterCoolerState(value: CharacteristicValue): Promise<void>;
    getTargetHeaterCoolerState(): Promise<CharacteristicValue>;
    setTargetTemperature(value: CharacteristicValue): Promise<void>;
    updateMotorStatus(): Promise<void>;
    getTargetTemperature(): Promise<CharacteristicValue>;
}
