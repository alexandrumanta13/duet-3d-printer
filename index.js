import axios from 'axios';
import { API, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

export default (api) => {
  api.registerPlatform('Duet3D', Duet3DPlatform);
};

class Duet3DPlatform {
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;
    this.accessories = new Map();

    this.api.on('didFinishLaunching', () => {
      this.discoverDevices();
    });
  }

  discoverDevices() {
    const devices = [
      { uniqueId: 'duet3d-printer', displayName: '3D Printer' }
    ];

    for (const device of devices) {
      const uuid = this.api.hap.uuid.generate(device.uniqueId);
      const accessory = new this.api.platformAccessory(device.displayName, uuid);
      accessory.context.device = device;

      const service = accessory.addService(this.api.hap.Service.Switch, device.displayName);
      service.getCharacteristic(this.api.hap.Characteristic.On)
        .on('set', this.setPrinterStatus.bind(this));

      this.api.registerPlatformAccessories('homebridge-duet3d', 'Duet3D', [accessory]);
      this.accessories.set(uuid, accessory);
    }
  }

  async setPrinterStatus(value, callback) {
    try {
      const command = value ? 'M25' : 'M0';
      await axios.get(`http://${this.config.ip}/rr_gcode?gcode=${command}`);
      callback();
    } catch (error) {
      this.log.error('Error setting printer status:', error);
      callback(error);
    }
  }
}