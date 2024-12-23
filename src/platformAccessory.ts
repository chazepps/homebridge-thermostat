import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import type { ThermostatPlatform } from './platform.js';

const MIN_TEMPERATURE = 10;
const MAX_TEMPERATURE = 35;
const MIN_STEP = 0.1;

export class ThermostatAccessory {
  private service: Service;
  private currentTemperature: number = 0;
  private currentHumidity: number = 0;
  private targetTemperature: number = 22;

  private active: boolean = false;
  private motorStatus: 'H' | 'L' = 'L';

  constructor(
    private readonly platform: ThermostatPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.platform.log.debug('ctor...');

    // 액세서리 정보 설정
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Studio Z')
      .setCharacteristic(this.platform.Characteristic.Model, 'ST-001')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, '0x00000001');

    // HeaterCooler 서비스를 생성하거나 가져오기
    this.service = this.accessory.getService(this.platform.Service.HeaterCooler) || this.accessory.addService(this.platform.Service.HeaterCooler);

    // 서비스 이름 설정
    this.service.setCharacteristic(this.platform.Characteristic.Name, 'Heater');

    // 현재 온도 특성
    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));

    // 현재 습도 특성
    this.service.getCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity)
      .onGet(this.getCurrentHumidity.bind(this));

    // 활성 상태 특성 (On/Off)
    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .onSet(this.setActive.bind(this))
      .onGet(this.getActive.bind(this));

    // 현재 HeaterCooler 상태 설정 (난방만 사용)
    this.service.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .onGet(this.getCurrentHeaterCoolerState.bind(this));

    // 목표 HeaterCooler 상태 설정 (난방만 지원)
    this.service.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .setProps({
        validValues: [1], // 난방만 지원
      })
      .onSet(this.setTargetHeaterCoolerState.bind(this))
      .onGet(this.getTargetHeaterCoolerState.bind(this));

    // 난방 임계값 온도 설정
    this.service.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature)
      .setProps({
        minValue: MIN_TEMPERATURE,
        maxValue: MAX_TEMPERATURE,
        minStep: MIN_STEP,
      })
      .onSet(this.setTargetTemperature.bind(this))
      .onGet(this.getTargetTemperature.bind(this));

    // 주기적으로 온도 업데이트 및 초기 상태 동기화
    this.updateMotorStatus();
    setInterval(this.updateMotorStatus.bind(this), 5_000);

    this.platform.log.debug('ctor... done');
  }

  private lastUpdateAt = 0;
  async getCurrentState(): Promise<CharacteristicValue> {
    const now = Date.now();

    if (now - this.lastUpdateAt < 2000) {
      return {
        temperature: this.currentTemperature,
        humidity: this.currentHumidity,
      };
    }

    this.platform.log.debug('getCurrentState...');
    // 현재 온도 가져오기
    const response = await fetch(`http://${this.platform.sensorIp}/`);
    const data = await response.text();
    const [temperature, humidity] = data.split(',').map(Number);

    this.currentTemperature = temperature;
    this.currentHumidity = humidity;

    const result = {
      temperature: this.currentTemperature,
      humidity: this.currentHumidity,
    };

    this.platform.log.debug('getCurrentState... done', result);

    this.lastUpdateAt = now;

    return result;
  }

  async getCurrentTemperature(): Promise<CharacteristicValue> {
    this.platform.log.debug('getCurrentTemperature...');
    if (this.currentTemperature === 0) {
      this.platform.log.debug('getCurrentTemperature... init status');
      await this.getCurrentState();
    }

    this.platform.log.debug('getCurrentTemperature... done', this.currentTemperature);

    return this.currentTemperature;
  }

  async getCurrentHumidity(): Promise<CharacteristicValue> {
    this.platform.log.debug('getCurrentHumidity...');

    if (this.currentHumidity === 0) {
      this.platform.log.debug('getCurrentHumidity... init status');
      await this.getCurrentState();
    }

    this.platform.log.debug('getCurrentHumidity... done', this.currentHumidity);

    return this.currentHumidity;
  }

  async setActive(value: CharacteristicValue) {
    this.platform.log.debug(`setActive... active: ${this.active ? 'Active' : 'Inactive'} -> ${value ? 'Active' : 'Inactive'}`);

    this.active = value as boolean;
    this.platform.log.debug('setActive... done');
  }

  async getActive(): Promise<CharacteristicValue> {
    this.platform.log.debug(`getActive... active: ${this.active ? 'Active' : 'Inactive'}`);
    return this.active ? 1 : 0;
  }

  async getCurrentHeaterCoolerState(): Promise<CharacteristicValue> {
    this.platform.log.debug('getCurrentHeaterCoolerState...');

    if (this.active) {
      this.platform.log.debug('getCurrentHeaterCoolerState... done', this.platform.Characteristic.CurrentHeaterCoolerState.HEATING);
      return this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
    } else {
      this.platform.log.debug('getCurrentHeaterCoolerState... done', this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE);
      return this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE;
    }
  }

  async setTargetHeaterCoolerState(value: CharacteristicValue) {
    this.platform.log.debug('setTargetHeaterCoolerState...');
    this.platform.log.debug('setTargetHeaterCoolerState... done');
  }

  async getTargetHeaterCoolerState(): Promise<CharacteristicValue> {
    this.platform.log.debug('getTargetHeaterCoolerState...');
    this.platform.log.debug('getTargetHeaterCoolerState... done', this.platform.Characteristic.TargetHeaterCoolerState.HEAT);
    return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
  }

  async setTargetTemperature(value: CharacteristicValue) {
    const temp = value as number;
    this.platform.log.debug('setTargetTemperature... target: ', temp);
    if (temp < MIN_TEMPERATURE) {
      this.platform.log(`setTargetTemperature... target: ${temp}°C is less than ${MIN_TEMPERATURE}°C, set to ${MIN_TEMPERATURE}°C`);
      this.targetTemperature = MIN_TEMPERATURE;
    } else if (temp > MAX_TEMPERATURE) {
      this.platform.log(`setTargetTemperature... target: ${temp}°C is greater than ${MAX_TEMPERATURE}°C, set to ${MAX_TEMPERATURE}°C`);
      this.targetTemperature = MAX_TEMPERATURE;
    } else {
      this.targetTemperature = temp;
    }

    this.platform.log.debug('setTargetTemperature... done', this.targetTemperature);
  }

  async updateMotorStatus() {
    this.platform.log.debug('updateMotorStatus...');
    await this.getCurrentState();

    this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.currentTemperature);
    this.service.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, this.currentHumidity);

    const motorStatus = this.motorStatus;

    if (!this.active) {
      this.motorStatus = 'L';
    }

    const diff = this.targetTemperature - this.currentTemperature;
    if (diff >= 0.5) {
      this.motorStatus = 'H';
    }
    if (diff <= -0.5) {
      this.motorStatus = 'L';
    }

    this.platform.log.debug(`updateMotorStatus... motorStatus: ${motorStatus} -> ${this.motorStatus}`);

    try {
      await fetch(`http://${this.platform.motorIp}/${this.motorStatus}`, { method: 'POST' });
    } catch (error) {
      this.platform.log.error('updateMotorStatus... error', error);
    }

    this.platform.log.debug('updateMotorStatus... done', this.motorStatus);
  }

  async getTargetTemperature(): Promise<CharacteristicValue> {
    this.platform.log.debug('## getTargetTemperature');
    return this.targetTemperature;
  }
}
