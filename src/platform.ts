import axios from 'axios';
import { API, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service, Characteristic, CharacteristicValue, CharacteristicSetCallback } from 'homebridge';

export class DuetHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly log: Logging; // Schimbat la public
  private readonly config: PlatformConfig;
  private readonly api: API;
  private readonly accessories: Map<string, PlatformAccessory>;
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;
  public CustomServices: any; // Schimbat la public
  public CustomCharacteristics: any; // Schimbat la public

  constructor(log: Logging, config: PlatformConfig, api: API) {
    this.log = log;
    this.config = config;
    this.api = api;
    this.accessories = new Map();
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;

    this.initializeCustomTypes();

    this.api.on('didFinishLaunching', () => {
      this.discoverDevices();
    });
  }

  async initializeCustomTypes() {
    const EveHomeKitTypes = await import('homebridge-lib/lib/EveHomeKitTypes');
    this.CustomServices = new EveHomeKitTypes.Services(this.api);
    this.CustomCharacteristics = new EveHomeKitTypes.Characteristics(this.api);
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.set(accessory.UUID, accessory);

    const service = accessory.getService(this.Service.Switch) || accessory.addService(this.Service.Switch);

    service.getCharacteristic(this.Characteristic.On)
      .on('set', this.setPrinterStatus.bind(this));
  }

  discoverDevices() {
    const devices = [
      { uniqueId: 'duet3d-printer', displayName: '3D Printer' }
    ];

    for (const device of devices) {
      const uuid = this.api.hap.uuid.generate(device.uniqueId);
      const accessory = new this.api.platformAccessory(device.displayName, uuid);
      accessory.context.device = device;

      const service = accessory.addService(this.Service.Switch, device.displayName);
      service.getCharacteristic(this.Characteristic.On)
        .on('set', this.setPrinterStatus.bind(this));

      this.api.registerPlatformAccessories('homebridge-duet3d', 'Duet3D', [accessory]);
      this.accessories.set(uuid, accessory);
    }
  }

  async setPrinterStatus(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    try {
      const command = value ? 'M25' : 'M0';
      await axios.get(`http://${this.config.ip}/rr_gcode?gcode=${command}`);
      callback();
    } catch (error: any) {
      this.log.error('Error setting printer status:', error);
      callback(error);
    }
  }
}
