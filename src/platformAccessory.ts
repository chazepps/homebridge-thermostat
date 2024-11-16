import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import type { ThermostatPlatform } from './platform.js';

export class ThermostatAccessory {
  private service: Service;
  private currentTemperature: number = 0;
  private currentHumidity: number = 0;
  private targetTemperature: number = 0;
  private heaterOn: boolean = false;

  constructor(
    private readonly platform: ThermostatPlatform,
    private readonly accessory: PlatformAccessory,
  ) {
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
        minValue: 10,
        maxValue: 30,
        minStep: 0.1,
      })
      .onSet(this.setTargetTemperature.bind(this))
      .onGet(this.getTargetTemperature.bind(this));

    // 주기적으로 온도 업데이트 및 초기 상태 동기화
    this.updateTemperature();
    setInterval(this.updateTemperature.bind(this), 10000);
  }

  async getCurrentState(): Promise<CharacteristicValue> {
    // 현재 온도 가져오기
    const response = await fetch('http://10.1.0.91');
    const data = await response.text();
    const [temperature, humidity] = data.split(',').map(Number);

    this.currentTemperature = temperature;
    this.currentHumidity = humidity;

    this.platform.log.debug(`현재 온도: ${this.currentTemperature}°C`);
    return {
      temperature: this.currentTemperature,
      humidity: this.currentHumidity,
    };
  }

  async getCurrentTemperature(): Promise<CharacteristicValue> {
    if (this.currentTemperature === 0) {
      await this.getCurrentState();
    }

    return this.currentTemperature;
  }

  async getCurrentHumidity(): Promise<CharacteristicValue> {
    if (this.currentHumidity === 0) {
      await this.getCurrentState();
    }

    return this.currentHumidity;
  }

  async setActive(value: CharacteristicValue) {
    const isActive = value as boolean;
    this.platform.log.debug('Heater 상태 설정 ->', isActive ? 'On' : 'Off');
    if (isActive) {
      // Heater를 켭니다
      await fetch('http://10.1.0.99/H', { method: 'POST' });
      this.heaterOn = true;
    } else {
      // Heater를 끕니다
      await fetch('http://10.1.0.99/L', { method: 'POST' });
      this.heaterOn = false;
    }
  }

  async getActive(): Promise<CharacteristicValue> {
    return this.heaterOn ? 1 : 0;
  }

  async getCurrentHeaterCoolerState(): Promise<CharacteristicValue> {
    if (this.heaterOn) {
      return this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
    } else {
      return this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE;
    }
  }

  async setTargetHeaterCoolerState(value: CharacteristicValue) {
    // 난방 모드만 지원하므로 추가 로직은 필요하지 않습니다
    this.platform.log.debug('목표 HeaterCooler 상태 설정 ->', value);
  }

  async getTargetHeaterCoolerState(): Promise<CharacteristicValue> {
    return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
  }

  async setTargetTemperature(value: CharacteristicValue) {
    const temp = value as number;
    if (temp < 10) {
      this.platform.log.warn(`설정된 온도 ${temp}°C가 최소값인 10°C보다 낮습니다. 최소값으로 설정됩니다.`);
      this.targetTemperature = 10;
    } else if (temp > 30) {
      this.platform.log.warn(`설정된 온도 ${temp}°C가 최대값인 30°C보다 높습니다. 최대값으로 설정됩니다.`);
      this.targetTemperature = 30;
    } else {
      this.targetTemperature = temp;
    }
    this.platform.log.debug('목표 온도 설정 ->', this.targetTemperature);

    // 현재 온도와 비교하여 Heater 제어
    if (this.currentTemperature < this.targetTemperature && !this.heaterOn) {
      await fetch('http://10.1.0.99/H', { method: 'POST' });
      this.heaterOn = true;
      this.platform.log.debug('Heater를 켰습니다');
    } else if (this.currentTemperature >= this.targetTemperature && this.heaterOn) {
      await fetch('http://10.1.0.99/L', { method: 'POST' });
      this.heaterOn = false;
      this.platform.log.debug('Heater를 껐습니다');
    }
  }

  async getTargetTemperature(): Promise<CharacteristicValue> {
    return this.targetTemperature;
  }

  private async updateTemperature() {
    await this.getCurrentState();

    this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.currentTemperature);
    this.service.updateCharacteristic(this.platform.Characteristic.CurrentRelativeHumidity, this.currentHumidity);

    // 온도 변화에 따라 Heater 제어 업데이트
    if (this.currentTemperature < this.targetTemperature && !this.heaterOn) {
      await this.setActive(1);
    } else if (this.currentTemperature >= this.targetTemperature && this.heaterOn) {
      await this.setActive(0);
    }
  }
}
