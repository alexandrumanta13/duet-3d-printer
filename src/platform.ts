import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';
import { ExamplePlatformAccessory } from './platformAccessory.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { EveHomeKitTypes } from 'homebridge-lib/EveHomeKitTypes';
import axios from 'axios';

export class ExampleHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;
  public readonly accessories: Map<string, PlatformAccessory> = new Map();
  public readonly discoveredCacheUUIDs: string[] = [];
  public readonly CustomServices: any;
  public readonly CustomCharacteristics: any;

  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;
    this.CustomServices = new EveHomeKitTypes(this.api).Services;
    this.CustomCharacteristics = new EveHomeKitTypes(this.api).Characteristics;

    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      this.discoverDevices();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.set(accessory.UUID, accessory);

    const service = accessory.getService(this.Service.Switch) || accessory.addService(this.Service.Switch);

    service.getCharacteristic(this.Characteristic.On)
      .on('get', async (callback) => {
        try {
          const status = await this.getPrinterStatus();
          const isPrinting = status.status === 'P';
          callback(null, isPrinting);
        } catch (error) {
          callback(error as Error);
        }
      });

    service.getCharacteristic(this.Characteristic.On)
      .on('set', async (value, callback) => {
        try {
          if (value) {
            await this.pausePrint();
          } else {
            await this.stopPrint();
          }
          callback();
        } catch (error) {
          callback(error as Error);
        }
      });

    const temperatureService = accessory.getService('Temperature') || accessory.addService(this.Service.TemperatureSensor, 'Temperature');

    temperatureService.getCharacteristic(this.Characteristic.CurrentTemperature)
      .on('get', async (callback) => {
        try {
          const temperatures = await this.getTemperatures();
          callback(null, temperatures.extruder);
        } catch (error) {
          callback(error as Error);
        }
      });

    const bedTemperatureService = accessory.getService('Bed Temperature') || accessory.addService(this.Service.TemperatureSensor, 'Bed Temperature');

    bedTemperatureService.getCharacteristic(this.Characteristic.CurrentTemperature)
      .on('get', async (callback) => {
        try {
          const temperatures = await this.getTemperatures();
          callback(null, temperatures.bed);
        } catch (error) {
          callback(error as Error);
        }
      });
  }

  discoverDevices() {
    const exampleDevices = [
      { exampleUniqueId: 'ABCD', exampleDisplayName: 'Bedroom' },
      { exampleUniqueId: 'EFGH', exampleDisplayName: 'Kitchen' },
      { exampleUniqueId: 'IJKL', exampleDisplayName: 'Backyard', CustomService: 'AirPressureSensor' },
    ];

    for (const device of exampleDevices) {
      const uuid = this.api.hap.uuid.generate(device.exampleUniqueId);
      const existingAccessory = this.accessories.get(uuid);

      if (existingAccessory) {
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
        new ExamplePlatformAccessory(this, existingAccessory);
      } else {
        this.log.info('Adding new accessory:', device.exampleDisplayName);
        const accessory = new this.api.platformAccessory(device.exampleDisplayName, uuid);
        accessory.context.device = device;
        new ExamplePlatformAccessory(this, accessory);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }

      this.discoveredCacheUUIDs.push(uuid);
    }

    for (const [uuid, accessory] of this.accessories) {
      if (!this.discoveredCacheUUIDs.includes(uuid)) {
        this.log.info('Removing existing accessory from cache:', accessory.displayName);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }

  async getPrinterStatus() {
    try {
      const response = await axios.get('http://192.168.1.146/rr_status?type=2');
      return response.data;
    } catch (error) {
      this.log.error('Error fetching printer status:', error);
      throw new Error('Failed to fetch printer status');
    }
  }

  async getTemperatures() {
    try {
      const response = await axios.get('http://192.168.1.146/rr_status?type=2');
      const temperatures = {
        extruder: response.data.temps.current[0],
        bed: response.data.temps.bed.current,
      };
      return temperatures;
    } catch (error) {
      this.log.error('Error fetching temperatures:', error);
      throw new Error('Failed to fetch temperatures');
    }
  }

  async pausePrint() {
    try {
      await axios.get('http://192.168.1.146/rr_gcode?gcode=M25');
    } catch (error) {
      this.log.error('Error pausing print:', error);
      throw new Error('Failed to pause print');
    }
  }

  async stopPrint() {
    try {
      await axios.get('http://192.168.1.146/rr_gcode?gcode=M0');
    } catch (error) {
      this.log.error('Error stopping print:', error);
      throw new Error('Failed to stop print');
    }
  }
}