import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import type { ThermostatPlatform } from './platform.js';

const MIN_TEMPERATURE = 10;
const MAX_TEMPERATURE = 35;
const MIN_STEP = 0.1;

export class ThermostatAccessory {
  private service: Service;
  private currentTemp: number = 0;
  private currentHumidity: number = 0;
  private targetTemp: number = 22;

  private isActive: boolean = false;
  private motorState: 'H' | 'L' = 'L';

  constructor(
    private readonly platform: ThermostatPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.platform.log.debug('Constructor initiated.');

    // Set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Studio Z')
      .setCharacteristic(this.platform.Characteristic.Model, 'ST-001')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, '0x00000001');

    // Create or retrieve HeaterCooler service
    this.service = this.accessory.getService(this.platform.Service.HeaterCooler) || this.accessory.addService(this.platform.Service.HeaterCooler);

    // Set service name
    this.service.setCharacteristic(this.platform.Characteristic.Name, 'Heater');

    // Current temperature characteristic
    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    // Current humidity characteristic
    this.service.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
      .onGet(this.getCurrentHumidity.bind(this));

    // Active state characteristic (On/Off)
    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .onSet(this.setActive.bind(this))
      .onGet(this.getActive.bind(this));

    // Set current HeaterCooler state (Heating only)
    this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .onGet(this.getCurrentHeaterCoolerState.bind(this));

    // Set target HeaterCooler state (Heating only support)
    this.service.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .setProps({
        validValues: [1], // Support heating only
      })
      .onSet(this.setTargetHeaterCoolerState.bind(this))
      .onGet(this.getTargetHeaterCoolerState.bind(this));

    // Set heating threshold temperature
    this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .setProps({
        minValue: MIN_TEMPERATURE,
        maxValue: MAX_TEMPERATURE,
        minStep: MIN_STEP,
      })
      .onSet(this.setTargetTemperature.bind(this))
      .onGet(this.getTargetTemperature.bind(this));

    // Periodically update temperature and synchronize initial state
    this.updateMotorStatus();
    setInterval(this.updateMotorStatus.bind(this), 5_000);

    this.platform.log.debug('Constructor completed.');
  }

  private lastUpdatedAt = 0;
  async getCurrentState(): Promise<CharacteristicValue> {
    const now = Date.now();

    if (now - this.lastUpdatedAt < 2000) {
      return {
        temperature: this.currentTemp,
        humidity: this.currentHumidity,
      };
    }

    this.platform.log.debug('Fetching current state...');
    try {
      // Fetch current temperature
      const response = await fetch(`http://${this.platform.sensorIp}/`);
      const data = await response.text();
      const [temperature, humidity] = data.split(',').map(Number);

      this.currentTemp = temperature;
      this.currentHumidity = humidity;
    } catch (error) {
      this.platform.log.error('Error fetching current state:', error);
    }

    const result = {
      temperature: this.currentTemp,
      humidity: this.currentHumidity,
    };

    this.platform.log.debug('Current state fetched successfully.', result);

    this.lastUpdatedAt = now;

    return result;
  }

  async getCurrentTemperature(): Promise<CharacteristicValue> {
    this.platform.log.debug('Fetching current temperature...');
    if (this.currentTemp === 0) {
      this.platform.log.debug('Initializing temperature status.');
      await this.getCurrentState();
    }

    this.platform.log.debug('Current temperature fetched:', this.currentTemp);

    return this.currentTemp;
  }

  async getCurrentHumidity(): Promise<CharacteristicValue> {
    this.platform.log.debug('Fetching current humidity...');

    if (this.currentHumidity === 0) {
      this.platform.log.debug('Initializing humidity status.');
      await this.getCurrentState();
    }

    this.platform.log.debug('Current humidity fetched:', this.currentHumidity);

    return this.currentHumidity;
  }

  async setActive(value: CharacteristicValue) {
    this.platform.log.debug(`Setting active state: ${this.isActive ? 'Active' : 'Inactive'} -> ${value ? 'Active' : 'Inactive'}`);

    this.isActive = value as boolean;
    this.platform.log.debug('Active state set successfully.');
  }

  async getActive(): Promise<CharacteristicValue> {
    this.platform.log.debug(`Retrieving active state: ${this.isActive ? 'Active' : 'Inactive'}`);
    return this.isActive ? 1 : 0;
  }

  async getCurrentHeaterCoolerState(): Promise<CharacteristicValue> {
    this.platform.log.debug('Fetching current HeaterCooler state...');

    if (this.isActive) {
      this.platform.log.debug('Current HeaterCooler state: HEATING');
      return this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
    } else {
      this.platform.log.debug('Current HeaterCooler state: INACTIVE');
      return this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE;
    }
  }

  async setTargetHeaterCoolerState(value: CharacteristicValue) {
    this.platform.log.debug('Setting target HeaterCooler state...', value);
    this.platform.log.debug('Target HeaterCooler state set successfully.');
  }

  async getTargetHeaterCoolerState(): Promise<CharacteristicValue> {
    this.platform.log.debug('Fetching target HeaterCooler state...');
    this.platform.log.debug('Target HeaterCooler state: HEAT');
    return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
  }

  async setTargetTemperature(value: CharacteristicValue) {
    const temp = value as number;
    this.platform.log.debug('Setting target temperature...', temp);
    if (temp < MIN_TEMPERATURE) {
      this.platform.log(`Target temperature ${temp}°C is below minimum ${MIN_TEMPERATURE}°C, setting to minimum.`);
      this.targetTemp = MIN_TEMPERATURE;
    } else if (temp > MAX_TEMPERATURE) {
      this.platform.log(`Target temperature ${temp}°C exceeds maximum ${MAX_TEMPERATURE}°C, setting to maximum.`);
      this.targetTemp = MAX_TEMPERATURE;
    } else {
      this.targetTemp = temp;
    }

    this.platform.log.debug('Target temperature set successfully.', this.targetTemp);
  }

  async updateMotorStatus() {
    this.platform.log.debug('Updating motor status...');
    await this.getCurrentState();

    this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.currentTemp);
    this.service.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, this.currentHumidity);

    const previousMotorState = this.motorState;

    if (!this.isActive) {
      this.motorState = 'L';
    }

    const diff = this.targetTemp - this.currentTemp;
    if (diff >= 0.5) {
      this.motorState = 'H';
    }
    if (diff <= -0.5) {
      this.motorState = 'L';
    }

    this.platform.log.debug(`Motor status updated: ${previousMotorState} -> ${this.motorState}`);

    try {
      await fetch(`http://${this.platform.motorIp}/${this.motorState}`, { method: 'POST' });
    } catch (error) {
      this.platform.log.error('Error updating motor status:', error);
    }

    this.platform.log.debug('Motor status update completed.', this.motorState);
  }

  async getTargetTemperature(): Promise<CharacteristicValue> {
    this.platform.log.debug('Retrieving target temperature.');
    return this.targetTemp;
  }
}
