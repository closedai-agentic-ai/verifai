/**
 * Emulator Manager
 * Handles Android emulator lifecycle management and APK installation
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
import { EmulatorConfig, DeviceInfo } from '../../types';
import logger from '../../utils/logger';

const execAsync = promisify(exec);

/**
 * Emulator status types
 */
export type EmulatorStatus = 'offline' | 'booting' | 'online' | 'error';

/**
 * Device connection info
 */
export interface DeviceConnection {
  id: string;
  status: EmulatorStatus;
  type: 'emulator' | 'device';
  model?: string | undefined;
  androidVersion?: string;
}

/**
 * APK installation result
 */
export interface ApkInstallResult {
  success: boolean;
  packageName?: string | undefined;
  error?: string;
  installTime?: number;
}

/**
 * EmulatorManager class for Android emulator lifecycle management
 */
export class EmulatorManager {
  private config: EmulatorConfig;
  private currentDevice: DeviceConnection | null = null;

  constructor(config: EmulatorConfig) {
    this.config = {
      androidSdkPath:
        process.env['ANDROID_SDK_ROOT'] || process.env['ANDROID_HOME'] || '',
      emulatorName: 'VerifAI_Test_Device',
      deviceTimeout: 60000,
      bootTimeout: 120000,
      ...config,
    };

    logger.info('EmulatorManager initialized', {
      event: 'emulator_manager_init',
      config: {
        androidSdkPath: this.config.androidSdkPath,
        emulatorName: this.config.emulatorName,
        deviceTimeout: this.config.deviceTimeout,
        bootTimeout: this.config.bootTimeout,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get path to adb executable
   */
  private getAdbPath(): string {
    if (!this.config.androidSdkPath) {
      throw new Error(
        'Android SDK path not configured. Set ANDROID_SDK_ROOT or ANDROID_HOME environment variable.'
      );
    }

    const adbPath = join(this.config.androidSdkPath, 'platform-tools', 'adb');
    const adbPathWithExt =
      process.platform === 'win32' ? `${adbPath}.exe` : adbPath;

    if (!existsSync(adbPathWithExt)) {
      throw new Error(
        `ADB not found at ${adbPathWithExt}. Please ensure Android SDK is properly installed.`
      );
    }

    return adbPathWithExt;
  }

  /**
   * Get path to emulator executable
   */
  private getEmulatorPath(): string {
    if (!this.config.androidSdkPath) {
      throw new Error('Android SDK path not configured.');
    }

    const emulatorPath = join(
      this.config.androidSdkPath,
      'emulator',
      'emulator'
    );
    const emulatorPathWithExt =
      process.platform === 'win32' ? `${emulatorPath}.exe` : emulatorPath;

    if (!existsSync(emulatorPathWithExt)) {
      throw new Error(
        `Emulator not found at ${emulatorPathWithExt}. Please ensure Android SDK is properly installed.`
      );
    }

    return emulatorPathWithExt;
  }

  /**
   * Execute adb command
   */
  private async executeAdb(
    args: string[],
    timeout: number = 30000
  ): Promise<string> {
    const adbPath = this.getAdbPath();
    const command = `"${adbPath}" ${args.join(' ')}`;

    logger.debug('Executing adb command', {
      event: 'adb_command',
      command,
      args,
      timeout,
      timestamp: new Date().toISOString(),
    });

    try {
      const { stdout, stderr } = await execAsync(command, { timeout });

      if (stderr && !stderr.includes('Warning')) {
        logger.warn('ADB command stderr', {
          event: 'adb_stderr',
          command,
          stderr,
          timestamp: new Date().toISOString(),
        });
      }

      return stdout.trim();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error('ADB command failed', {
        event: 'adb_error',
        command,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      throw new Error(`ADB command failed: ${errorMessage}`);
    }
  }

  /**
   * List all connected devices
   */
  public async listDevices(): Promise<DeviceConnection[]> {
    try {
      const output = await this.executeAdb(['devices', '-l']);
      const lines = output.split('\n').slice(1); // Skip header line
      const devices: DeviceConnection[] = [];

      for (const line of lines) {
        if (line.trim() === '') {
          continue;
        }

        const parts = line.trim().split(/\s+/);
        if (parts.length < 2) {
          continue;
        }

        const id = parts[0];
        const status = parts[1];
        if (!id || !status) {
          continue;
        }

        const isEmulator = id.startsWith('emulator-');

        // Parse additional device info
        const modelMatch = line.match(/model:([^\s]+)/);
        const model = modelMatch ? modelMatch[1] : undefined;

        devices.push({
          id,
          status: this.mapDeviceStatus(status),
          type: isEmulator ? 'emulator' : 'device',
          model,
        });
      }

      logger.info('Listed connected devices', {
        event: 'devices_listed',
        deviceCount: devices.length,
        devices: devices.map(d => ({
          id: d.id,
          status: d.status,
          type: d.type,
        })),
        timestamp: new Date().toISOString(),
      });

      return devices;
    } catch (error) {
      logger.error('Failed to list devices', {
        event: 'list_devices_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Map adb device status to our status enum
   */
  private mapDeviceStatus(adbStatus: string): EmulatorStatus {
    switch (adbStatus.toLowerCase()) {
      case 'device':
        return 'online';
      case 'offline':
        return 'offline';
      case 'bootloader':
      case 'recovery':
        return 'booting';
      default:
        return 'error';
    }
  }

  /**
   * Check if a specific device is online and ready
   */
  public async isDeviceReady(deviceId?: string): Promise<boolean> {
    try {
      const targetDevice = deviceId || this.currentDevice?.id;
      if (!targetDevice) {
        return false;
      }

      // Check if device is listed and online
      const devices = await this.listDevices();
      const device = devices.find(d => d.id === targetDevice);

      if (!device || device.status !== 'online') {
        return false;
      }

      // Additional check: try to get device properties
      try {
        await this.executeAdb([
          '-s',
          targetDevice,
          'shell',
          'getprop',
          'sys.boot_completed',
        ]);
        return true;
      } catch {
        return false;
      }
    } catch (error) {
      logger.warn('Device readiness check failed', {
        event: 'device_ready_check_error',
        deviceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      return false;
    }
  }

  /**
   * Start Android emulator
   */
  public async startEmulator(): Promise<DeviceConnection> {
    const emulatorPath = this.getEmulatorPath();

    logger.info('Starting Android emulator', {
      event: 'emulator_start',
      emulatorName: this.config.emulatorName,
      bootTimeout: this.config.bootTimeout,
      timestamp: new Date().toISOString(),
    });

    return new Promise((resolve, reject) => {
      // Start emulator process
      const emulatorProcess = spawn(
        emulatorPath,
        [
          '-avd',
          this.config.emulatorName!,
          '-no-audio',
          '-no-window', // Headless mode
          '-gpu',
          'swiftshader_indirect',
          '-no-snapshot-save',
          '-wipe-data',
        ],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: true,
        }
      );

      let emulatorStarted = false;
      const startTime = Date.now();

      // Handle emulator process events
      emulatorProcess.on('error', error => {
        if (!emulatorStarted) {
          logger.error('Failed to start emulator process', {
            event: 'emulator_process_error',
            error: error.message,
            timestamp: new Date().toISOString(),
          });
          reject(new Error(`Failed to start emulator: ${error.message}`));
        }
      });

      emulatorProcess.stdout?.on('data', data => {
        logger.debug('Emulator stdout', {
          event: 'emulator_stdout',
          data: data.toString(),
          timestamp: new Date().toISOString(),
        });
      });

      emulatorProcess.stderr?.on('data', data => {
        const message = data.toString();
        logger.debug('Emulator stderr', {
          event: 'emulator_stderr',
          data: message,
          timestamp: new Date().toISOString(),
        });
      });

      // Poll for emulator to become available
      const pollInterval = setInterval(async () => {
        try {
          const devices = await this.listDevices();
          const emulator = devices.find(
            d => d.type === 'emulator' && d.status === 'online'
          );

          if (emulator && (await this.isDeviceReady(emulator.id))) {
            clearInterval(pollInterval);
            clearTimeout(bootTimeout);
            emulatorStarted = true;

            this.currentDevice = emulator;

            const bootTime = Date.now() - startTime;
            logger.info('Emulator started successfully', {
              event: 'emulator_started',
              deviceId: emulator.id,
              bootTime,
              timestamp: new Date().toISOString(),
            });

            resolve(emulator);
          }
        } catch (error) {
          // Continue polling on errors
          logger.debug('Emulator polling error', {
            event: 'emulator_poll_error',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          });
        }
      }, 5000); // Poll every 5 seconds

      // Set boot timeout
      const bootTimeout = setTimeout(() => {
        clearInterval(pollInterval);
        if (!emulatorStarted) {
          emulatorProcess.kill();
          logger.error('Emulator boot timeout', {
            event: 'emulator_boot_timeout',
            timeout: this.config.bootTimeout,
            timestamp: new Date().toISOString(),
          });
          reject(
            new Error(
              `Emulator failed to boot within ${this.config.bootTimeout}ms`
            )
          );
        }
      }, this.config.bootTimeout);
    });
  }

  /**
   * Stop emulator
   */
  public async stopEmulator(deviceId?: string): Promise<void> {
    const targetDevice = deviceId || this.currentDevice?.id;

    if (!targetDevice) {
      logger.warn('No device to stop', {
        event: 'emulator_stop_no_device',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      logger.info('Stopping emulator', {
        event: 'emulator_stop',
        deviceId: targetDevice,
        timestamp: new Date().toISOString(),
      });

      await this.executeAdb(['-s', targetDevice, 'emu', 'kill']);

      // Wait for device to disconnect
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        const devices = await this.listDevices();
        if (!devices.find(d => d.id === targetDevice)) {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      if (this.currentDevice?.id === targetDevice) {
        this.currentDevice = null;
      }

      logger.info('Emulator stopped successfully', {
        event: 'emulator_stopped',
        deviceId: targetDevice,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to stop emulator', {
        event: 'emulator_stop_error',
        deviceId: targetDevice,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Install APK on device
   */
  public async installApk(
    apkPath: string,
    deviceId?: string
  ): Promise<ApkInstallResult> {
    const targetDevice = deviceId || this.currentDevice?.id;

    if (!targetDevice) {
      throw new Error('No device available for APK installation');
    }

    if (!existsSync(apkPath)) {
      throw new Error(`APK file not found: ${apkPath}`);
    }

    const startTime = Date.now();

    logger.info('Installing APK', {
      event: 'apk_install_start',
      apkPath,
      deviceId: targetDevice,
      timestamp: new Date().toISOString(),
    });

    try {
      // Install APK
      const output = await this.executeAdb(
        ['-s', targetDevice, 'install', '-r', `"${apkPath}"`],
        120000
      );

      const installTime = Date.now() - startTime;

      if (output.includes('Success')) {
        // Try to extract package name from APK
        let packageName: string | undefined;
        try {
          const dumpOutput = await this.executeAdb([
            '-s',
            targetDevice,
            'shell',
            'dumpsys',
            'package',
            '|',
            'grep',
            '-E',
            '"^Package \\[.*\\]"',
            '|',
            'tail',
            '-1',
          ]);
          const packageMatch = dumpOutput.match(/Package \[([^\]]+)\]/);
          packageName = packageMatch ? packageMatch[1] : undefined;
        } catch {
          // Package name extraction failed, but installation succeeded
        }

        logger.info('APK installed successfully', {
          event: 'apk_install_success',
          apkPath,
          deviceId: targetDevice,
          packageName,
          installTime,
          timestamp: new Date().toISOString(),
        });

        return {
          success: true,
          packageName,
          installTime,
        };
      } else {
        const error = `Installation failed: ${output}`;
        logger.error('APK installation failed', {
          event: 'apk_install_failed',
          apkPath,
          deviceId: targetDevice,
          error,
          installTime,
          timestamp: new Date().toISOString(),
        });

        return {
          success: false,
          error,
          installTime,
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const installTime = Date.now() - startTime;

      logger.error('APK installation error', {
        event: 'apk_install_error',
        apkPath,
        deviceId: targetDevice,
        error: errorMessage,
        installTime,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        installTime,
      };
    }
  }

  /**
   * Uninstall package from device
   */
  public async uninstallPackage(
    packageName: string,
    deviceId?: string
  ): Promise<boolean> {
    const targetDevice = deviceId || this.currentDevice?.id;

    if (!targetDevice) {
      throw new Error('No device available for package uninstallation');
    }

    logger.info('Uninstalling package', {
      event: 'package_uninstall_start',
      packageName,
      deviceId: targetDevice,
      timestamp: new Date().toISOString(),
    });

    try {
      const output = await this.executeAdb([
        '-s',
        targetDevice,
        'uninstall',
        packageName,
      ]);

      const success = output.includes('Success');

      if (success) {
        logger.info('Package uninstalled successfully', {
          event: 'package_uninstall_success',
          packageName,
          deviceId: targetDevice,
          timestamp: new Date().toISOString(),
        });
      } else {
        logger.warn('Package uninstallation failed', {
          event: 'package_uninstall_failed',
          packageName,
          deviceId: targetDevice,
          output,
          timestamp: new Date().toISOString(),
        });
      }

      return success;
    } catch (error) {
      logger.error('Package uninstallation error', {
        event: 'package_uninstall_error',
        packageName,
        deviceId: targetDevice,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      return false;
    }
  }

  /**
   * Get device information
   */
  public async getDeviceInfo(deviceId?: string): Promise<DeviceInfo | null> {
    const targetDevice = deviceId || this.currentDevice?.id;

    if (!targetDevice) {
      return null;
    }

    try {
      const [manufacturer, model, androidVersion, apiLevel] = await Promise.all(
        [
          this.executeAdb([
            '-s',
            targetDevice,
            'shell',
            'getprop',
            'ro.product.manufacturer',
          ]).catch(() => 'Unknown'),
          this.executeAdb([
            '-s',
            targetDevice,
            'shell',
            'getprop',
            'ro.product.model',
          ]).catch(() => 'Unknown'),
          this.executeAdb([
            '-s',
            targetDevice,
            'shell',
            'getprop',
            'ro.build.version.release',
          ]).catch(() => 'Unknown'),
          this.executeAdb([
            '-s',
            targetDevice,
            'shell',
            'getprop',
            'ro.build.version.sdk',
          ]).catch(() => 'Unknown'),
        ]
      );

      const deviceInfo: DeviceInfo = {
        id: targetDevice,
        manufacturer: manufacturer.trim(),
        model: model.trim(),
        androidVersion: androidVersion.trim(),
        apiLevel: parseInt(apiLevel.trim()) || 0,
        isEmulator: targetDevice.startsWith('emulator-'),
      };

      logger.debug('Retrieved device info', {
        event: 'device_info_retrieved',
        deviceInfo,
        timestamp: new Date().toISOString(),
      });

      return deviceInfo;
    } catch (error) {
      logger.error('Failed to get device info', {
        event: 'device_info_error',
        deviceId: targetDevice,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      return null;
    }
  }

  /**
   * Get current device
   */
  public getCurrentDevice(): DeviceConnection | null {
    return this.currentDevice;
  }

  /**
   * Set current device
   */
  public setCurrentDevice(device: DeviceConnection): void {
    this.currentDevice = device;
    logger.info('Current device set', {
      event: 'current_device_set',
      deviceId: device.id,
      deviceType: device.type,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Health check for emulator manager
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    error?: string;
    responseTime: number;
  }> {
    const startTime = Date.now();

    try {
      // Check if adb is available
      this.getAdbPath();

      // Try to list devices
      await this.listDevices();

      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        status: 'unhealthy',
        error: errorMessage,
        responseTime,
      };
    }
  }
}

export default EmulatorManager;
