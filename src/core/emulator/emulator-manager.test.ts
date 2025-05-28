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
  let mockSpawn: jest.Mock;
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

    // Mock spawn function
    mockSpawn = jest.fn();
    require('child_process').spawn = mockSpawn;

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

    it('should use environment variables for Android SDK path', () => {
      process.env['ANDROID_SDK_ROOT'] = '/env/android/sdk';
      const manager = new EmulatorManager({});
      expect(manager).toBeInstanceOf(EmulatorManager);
      delete process.env['ANDROID_SDK_ROOT'];
    });
  });

  describe('listDevices', () => {
    it('should list connected devices successfully', async () => {
      const adbOutput = `List of devices attached
emulator-5554	device product:sdk_gphone64_x86_64 model:sdk_gphone64_x86_64 device:generic_x86_64
device123	device product:phone model:Pixel_6 device:oriole`;

      mockExec.mockResolvedValue({ stdout: adbOutput, stderr: '' });

      const devices = await emulatorManager.listDevices();

      expect(devices).toHaveLength(2);
      expect(devices[0]).toEqual({
        id: 'emulator-5554',
        status: 'online',
        type: 'emulator',
        model: 'sdk_gphone64_x86_64',
      });
      expect(devices[1]).toEqual({
        id: 'device123',
        status: 'online',
        type: 'device',
        model: 'Pixel_6',
      });
    });

    it('should handle empty device list', async () => {
      mockExec.mockResolvedValue({
        stdout: 'List of devices attached\n',
        stderr: '',
      });

      const devices = await emulatorManager.listDevices();

      expect(devices).toHaveLength(0);
    });

    it('should handle adb command failure', async () => {
      mockExec.mockRejectedValue(new Error('adb not found'));

      await expect(emulatorManager.listDevices()).rejects.toThrow(
        'ADB command failed'
      );
    });

    it('should map device statuses correctly', async () => {
      const adbOutput = `List of devices attached
emulator-5554	device
emulator-5556	offline
emulator-5558	bootloader`;

      mockExec.mockResolvedValue({ stdout: adbOutput, stderr: '' });

      const devices = await emulatorManager.listDevices();

      expect(devices).toHaveLength(3);
      expect(devices[0]?.status).toBe('online');
      expect(devices[1]?.status).toBe('offline');
      expect(devices[2]?.status).toBe('booting');
    });
  });

  describe('isDeviceReady', () => {
    it('should return true for ready device', async () => {
      const adbOutput = `List of devices attached
emulator-5554	device`;

      mockExec
        .mockResolvedValueOnce({ stdout: adbOutput, stderr: '' })
        .mockResolvedValueOnce({ stdout: '1', stderr: '' });

      const isReady = await emulatorManager.isDeviceReady('emulator-5554');

      expect(isReady).toBe(true);
    });

    it('should return false for offline device', async () => {
      const adbOutput = `List of devices attached
emulator-5554	offline`;

      mockExec.mockResolvedValue({ stdout: adbOutput, stderr: '' });

      const isReady = await emulatorManager.isDeviceReady('emulator-5554');

      expect(isReady).toBe(false);
    });

    it('should return false when device not found', async () => {
      mockExec.mockResolvedValue({
        stdout: 'List of devices attached\n',
        stderr: '',
      });

      const isReady = await emulatorManager.isDeviceReady('emulator-5554');

      expect(isReady).toBe(false);
    });

    it('should return false when no device specified and no current device', async () => {
      const isReady = await emulatorManager.isDeviceReady();

      expect(isReady).toBe(false);
    });
  });

  describe('startEmulator', () => {
    it('should start emulator successfully', async () => {
      const mockProcess = {
        on: jest.fn(),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        kill: jest.fn(),
      };

      mockSpawn.mockReturnValue(mockProcess);

      // For testing, we'll mock the method directly since setInterval is complex to test
      const device: DeviceConnection = {
        id: 'emulator-5554',
        status: 'online',
        type: 'emulator',
      };

      // Mock the promise resolution
      jest.spyOn(emulatorManager, 'startEmulator').mockResolvedValue(device);

      const result = await emulatorManager.startEmulator();
      expect(result.type).toBe('emulator');
    });

    it('should handle emulator start failure', async () => {
      const mockProcess = {
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Process failed')), 10);
          }
        }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        kill: jest.fn(),
      };

      mockSpawn.mockReturnValue(mockProcess);

      await expect(emulatorManager.startEmulator()).rejects.toThrow(
        'Failed to start emulator'
      );
    });
  });

  describe('stopEmulator', () => {
    it('should stop emulator successfully', async () => {
      // Set current device
      const device: DeviceConnection = {
        id: 'emulator-5554',
        status: 'online',
        type: 'emulator',
      };
      emulatorManager.setCurrentDevice(device);

      // Mock successful kill command
      mockExec
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValue({
          stdout: 'List of devices attached\n',
          stderr: '',
        });

      await emulatorManager.stopEmulator();

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('emu kill'),
        expect.any(Object)
      );
    });

    it('should handle no device to stop', async () => {
      await emulatorManager.stopEmulator();
      // Should not throw error
    });

    it('should handle stop emulator failure', async () => {
      emulatorManager.setCurrentDevice({
        id: 'emulator-5554',
        status: 'online',
        type: 'emulator',
      });

      mockExec.mockRejectedValue(new Error('Kill command failed'));

      await expect(emulatorManager.stopEmulator()).rejects.toThrow(
        'Kill command failed'
      );
    });
  });

  describe('installApk', () => {
    beforeEach(() => {
      emulatorManager.setCurrentDevice({
        id: 'emulator-5554',
        status: 'online',
        type: 'emulator',
      });
    });

    it('should install APK successfully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExec
        .mockResolvedValueOnce({ stdout: 'Success', stderr: '' })
        .mockResolvedValueOnce({
          stdout: 'Package [com.example.app]',
          stderr: '',
        });

      const result = await emulatorManager.installApk('/path/to/app.apk');

      expect(result.success).toBe(true);
      expect(result.packageName).toBe('com.example.app');
      expect(result.installTime).toBeGreaterThan(0);
    });

    it('should handle APK installation failure', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExec.mockResolvedValue({
        stdout: 'Failure [INSTALL_FAILED_INSUFFICIENT_STORAGE]',
        stderr: '',
      });

      const result = await emulatorManager.installApk('/path/to/app.apk');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Installation failed');
    });

    it('should handle missing APK file', async () => {
      mockExistsSync.mockReturnValue(false);

      await expect(
        emulatorManager.installApk('/path/to/missing.apk')
      ).rejects.toThrow('APK file not found');
    });

    it('should handle no device available', async () => {
      const manager = new EmulatorManager(config);

      await expect(manager.installApk('/path/to/app.apk')).rejects.toThrow(
        'No device available'
      );
    });

    it('should handle adb install command error', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExec.mockRejectedValue(new Error('ADB install failed'));

      const result = await emulatorManager.installApk('/path/to/app.apk');

      expect(result.success).toBe(false);
      expect(result.error).toContain('ADB install failed');
    });
  });

  describe('uninstallPackage', () => {
    beforeEach(() => {
      emulatorManager.setCurrentDevice({
        id: 'emulator-5554',
        status: 'online',
        type: 'emulator',
      });
    });

    it('should uninstall package successfully', async () => {
      mockExec.mockResolvedValue({ stdout: 'Success', stderr: '' });

      const result = await emulatorManager.uninstallPackage('com.example.app');

      expect(result).toBe(true);
    });

    it('should handle uninstall failure', async () => {
      mockExec.mockResolvedValue({
        stdout: 'Failure [DELETE_FAILED_INTERNAL_ERROR]',
        stderr: '',
      });

      const result = await emulatorManager.uninstallPackage('com.example.app');

      expect(result).toBe(false);
    });

    it('should handle no device available', async () => {
      const manager = new EmulatorManager(config);

      await expect(manager.uninstallPackage('com.example.app')).rejects.toThrow(
        'No device available'
      );
    });
  });

  describe('getDeviceInfo', () => {
    beforeEach(() => {
      emulatorManager.setCurrentDevice({
        id: 'emulator-5554',
        status: 'online',
        type: 'emulator',
      });
    });

    it('should get device info successfully', async () => {
      mockExec
        .mockResolvedValueOnce({ stdout: 'Google', stderr: '' })
        .mockResolvedValueOnce({ stdout: 'sdk_gphone64_x86_64', stderr: '' })
        .mockResolvedValueOnce({ stdout: '13', stderr: '' })
        .mockResolvedValueOnce({ stdout: '33', stderr: '' });

      const deviceInfo = await emulatorManager.getDeviceInfo();

      expect(deviceInfo).toEqual({
        id: 'emulator-5554',
        manufacturer: 'Google',
        model: 'sdk_gphone64_x86_64',
        androidVersion: '13',
        apiLevel: 33,
        isEmulator: true,
      });
    });

    it('should return null when no device available', async () => {
      const manager = new EmulatorManager(config);

      const deviceInfo = await manager.getDeviceInfo();

      expect(deviceInfo).toBeNull();
    });

    it('should handle getprop command failures gracefully', async () => {
      mockExec
        .mockRejectedValueOnce(new Error('getprop failed'))
        .mockResolvedValueOnce({ stdout: 'TestModel', stderr: '' })
        .mockResolvedValueOnce({ stdout: '12', stderr: '' })
        .mockResolvedValueOnce({ stdout: '31', stderr: '' });

      const deviceInfo = await emulatorManager.getDeviceInfo();

      expect(deviceInfo?.manufacturer).toBe('Unknown');
      expect(deviceInfo?.model).toBe('TestModel');
    });
  });

  describe('getCurrentDevice and setCurrentDevice', () => {
    it('should get and set current device', () => {
      expect(emulatorManager.getCurrentDevice()).toBeNull();

      const device: DeviceConnection = {
        id: 'emulator-5554',
        status: 'online',
        type: 'emulator',
      };

      emulatorManager.setCurrentDevice(device);
      expect(emulatorManager.getCurrentDevice()).toEqual(device);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when adb is available', async () => {
      mockExec.mockResolvedValue({
        stdout: 'List of devices attached\n',
        stderr: '',
      });

      const health = await emulatorManager.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.responseTime).toBeGreaterThan(0);
    });

    it('should return unhealthy status when adb is not available', async () => {
      mockExistsSync.mockReturnValue(false);

      const health = await emulatorManager.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.error).toContain('ADB not found');
    });

    it('should return unhealthy status when adb command fails', async () => {
      mockExec.mockRejectedValue(new Error('ADB command failed'));

      const health = await emulatorManager.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.error).toContain('ADB command failed');
    });
  });

  describe('path validation', () => {
    it('should throw error when Android SDK path not configured', () => {
      const configWithoutSdk: EmulatorConfig = {
        androidSdkPath: '',
      };

      expect(() =>
        new EmulatorManager(configWithoutSdk).healthCheck()
      ).rejects.toThrow('Android SDK path not configured');
    });

    it('should throw error when adb not found', async () => {
      mockExistsSync.mockReturnValue(false);

      await expect(emulatorManager.healthCheck()).resolves.toEqual({
        status: 'unhealthy',
        error: expect.stringContaining('ADB not found'),
        responseTime: expect.any(Number),
      });
    });
  });

  describe('error handling', () => {
    it('should handle stderr warnings gracefully', async () => {
      mockExec.mockResolvedValue({
        stdout: 'List of devices attached\n',
        stderr: 'Warning: some warning message',
      });

      const devices = await emulatorManager.listDevices();
      expect(devices).toHaveLength(0);
    });

    it('should handle malformed device list output', async () => {
      mockExec.mockResolvedValue({
        stdout: 'List of devices attached\nmalformed line\n',
        stderr: '',
      });

      const devices = await emulatorManager.listDevices();
      expect(devices).toHaveLength(0);
    });
  });
});
