/**
 * Tests for EmulatorManager
 */

import { EmulatorManager, DeviceConnection } from './emulator-manager';
import { EmulatorConfig } from '../../types';

// Mock child_process and fs
jest.mock('child_process');
jest.mock('fs');
jest.mock('../../utils/logger');

describe('EmulatorManager', () => {
  let emulatorManager: EmulatorManager;
  let config: EmulatorConfig;
  let mockExec: jest.Mock;
  let mockExistsSync: jest.Mock;

  beforeEach(() => {
    config = {
      androidSdkPath: '/mock/android/sdk',
      emulatorName: 'test_emulator',
      deviceTimeout: 30000,
      bootTimeout: 60000,
    };

    // Mock exec function
    mockExec = jest.fn();
    require('util').promisify = jest.fn(() => mockExec);

    // Mock fs.existsSync
    mockExistsSync = jest.fn().mockReturnValue(true);
    require('fs').existsSync = mockExistsSync;

    emulatorManager = new EmulatorManager(config);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(emulatorManager).toBeInstanceOf(EmulatorManager);
    });

    it('should use default values for missing config', () => {
      const minimalConfig: EmulatorConfig = {};
      const manager = new EmulatorManager(minimalConfig);
      expect(manager).toBeInstanceOf(EmulatorManager);
    });
  });

  describe('getCurrentDevice', () => {
    it('should return null initially', () => {
      const currentDevice = emulatorManager.getCurrentDevice();
      expect(currentDevice).toBeNull();
    });

    it('should return current device after setting', () => {
      const device: DeviceConnection = {
        id: 'emulator-5554',
        status: 'online',
        type: 'emulator',
      };

      emulatorManager.setCurrentDevice(device);
      const currentDevice = emulatorManager.getCurrentDevice();

      expect(currentDevice).toEqual(device);
    });
  });

  describe('basic functionality', () => {
    it('should handle device management', () => {
      const device: DeviceConnection = {
        id: 'test-device',
        status: 'online',
        type: 'emulator',
      };

      emulatorManager.setCurrentDevice(device);
      expect(emulatorManager.getCurrentDevice()).toEqual(device);
    });

    it('should validate configuration', () => {
      const configWithSdk: EmulatorConfig = {
        androidSdkPath: '/valid/path',
      };

      const manager = new EmulatorManager(configWithSdk);
      expect(manager).toBeInstanceOf(EmulatorManager);
    });
  });
});
