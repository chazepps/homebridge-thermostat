import { ThermostatAccessory } from './platformAccessory.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
export class ThermostatPlatform {
    log;
    config;
    api;
    Service;
    Characteristic;
    // Map to store registered accessories using their UUIDs
    accessories = new Map();
    motorIp;
    sensorIp;
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        // Initialize Homebridge service and characteristic references
        this.Service = api.hap.Service;
        this.Characteristic = api.hap.Characteristic;
        this.motorIp = config.motorIp ?? '10.10.8.1';
        this.sensorIp = config.sensorIp ?? '10.10.8.2';
        this.log.debug('Platform initialization complete:', this.config.name);
        // Event listener for when Homebridge has finished launching
        this.api.on('didFinishLaunching', () => {
            log.debug('didFinishLaunching event executed');
            this.discoverDevice();
        });
    }
    // Configure an accessory that has been cached
    configureAccessory(accessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);
        this.accessories.set(accessory.UUID, accessory);
    }
    // Discover and register new devices or restore existing ones
    discoverDevice() {
        const device = this.findDevice();
        const uuid = this.api.hap.uuid.generate(device.uniqueId);
        const existingAccessory = this.accessories.get(uuid);
        if (existingAccessory) {
            // Restore accessory from cache if it exists
            this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
            new ThermostatAccessory(this, existingAccessory);
        }
        else {
            // Register a new accessory if it does not exist in cache
            this.log.info('Registering new accessory:', device.displayName);
            const accessory = new this.api.platformAccessory(device.displayName, uuid);
            accessory.context.device = device;
            new ThermostatAccessory(this, accessory);
            this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
    }
    // Simulate device discovery; in a real scenario, this would involve network operations
    findDevice() {
        return { uniqueId: 'Device1', displayName: 'Home Thermostat' };
    }
}
//# sourceMappingURL=platform.js.map