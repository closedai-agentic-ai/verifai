/**
 * Configuration Utility
 * Loads and validates environment variables with proper typing
 */

import dotenv from 'dotenv';
import { AppConfig } from '../types';
import logger from './logger';

// Load environment variables
dotenv.config();

/**
 * Get environment variable with validation
 */
function getEnvVar(
  key: string,
  defaultValue?: string,
  required: boolean = true
): string {
  const value = process.env[key] || defaultValue;

  if (required && !value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }

  return value || '';
}

/**
 * Get environment variable as number
 */
function getEnvNumber(
  key: string,
  defaultValue?: number,
  required: boolean = true
): number {
  const value = getEnvVar(key, defaultValue?.toString(), required);
  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    throw new Error(
      `Environment variable ${key} must be a valid number, got: ${value}`
    );
  }

  return parsed;
}

/**
 * Get environment variable as boolean
 */
function getEnvBoolean(
  key: string,
  defaultValue?: boolean,
  required: boolean = true
): boolean {
  const value = getEnvVar(key, defaultValue?.toString(), required);

  if (value.toLowerCase() === 'true' || value === '1') {
    return true;
  } else if (value.toLowerCase() === 'false' || value === '0') {
    return false;
  } else {
    throw new Error(
      `Environment variable ${key} must be a boolean (true/false), got: ${value}`
    );
  }
}

/**
 * Load and validate application configuration
 */
export function loadConfig(): AppConfig {
  try {
    const config: AppConfig = {
      api: {
        port: getEnvNumber('API_PORT', 3000, false),
        apiKey: getEnvVar('API_KEY', 'dev-api-key-change-in-production', false),
        environment: getEnvVar('NODE_ENV', 'development', false),
      },

      aws: {
        region: getEnvVar('AWS_REGION', 'us-east-1', false),
        accessKeyId: getEnvVar('AWS_ACCESS_KEY_ID', '', false),
        secretAccessKey: getEnvVar('AWS_SECRET_ACCESS_KEY', '', false),
        bedrock: {
          modelId: getEnvVar(
            'BEDROCK_MODEL_ID',
            'anthropic.claude-3-sonnet-20240229-v1:0',
            false
          ),
          region: getEnvVar('AWS_REGION', 'us-east-1', false),
          maxTokens: getEnvNumber('BEDROCK_MAX_TOKENS', 4096, false),
          temperature: parseFloat(
            getEnvVar('BEDROCK_TEMPERATURE', '0.7', false)
          ),
          topP: parseFloat(getEnvVar('BEDROCK_TOP_P', '0.9', false)),
        },
      },

      android: {
        home: getEnvVar('ANDROID_HOME', '/opt/android-sdk', false),
        sdkRoot: getEnvVar('ANDROID_SDK_ROOT', '/opt/android-sdk', false),
        adbPath: getEnvVar(
          'ADB_PATH',
          '/opt/android-sdk/platform-tools/adb',
          false
        ),
        emulatorName: getEnvVar('EMULATOR_NAME', 'test_emulator_api_30', false),
      },

      jira: {
        baseUrl: getEnvVar('JIRA_BASE_URL', '', false),
        email: getEnvVar('JIRA_EMAIL', '', false),
        apiToken: getEnvVar('JIRA_API_TOKEN', '', false),
        projectKey: getEnvVar('JIRA_PROJECT_KEY', '', false),
        issueType: getEnvVar('JIRA_ISSUE_TYPE', 'Bug', false),
      },

      mcp: {
        mobile: {
          serverPath: getEnvVar('MCP_MOBILE_SERVER_PATH', 'npx', false),
          serverArgs: getEnvVar(
            'MCP_MOBILE_SERVER_ARGS',
            '-y @mobilenext/mobile-mcp@latest',
            false
          ).split(' '),
          timeout: getEnvNumber('MCP_MOBILE_TIMEOUT', 30000, false),
          retryAttempts: getEnvNumber('MCP_MOBILE_RETRY_ATTEMPTS', 3, false),
        },
        jira: {
          serverPath: getEnvVar('MCP_JIRA_SERVER_PATH', 'npx', false),
          serverArgs: getEnvVar(
            'MCP_JIRA_SERVER_ARGS',
            '-y @atlassian/jira-mcp@latest',
            false
          ).split(' '),
          timeout: getEnvNumber('MCP_JIRA_TIMEOUT', 30000, false),
          retryAttempts: getEnvNumber('MCP_JIRA_RETRY_ATTEMPTS', 3, false),
        },
        claudeCliPath: getEnvVar('CLAUDE_CLI_PATH', 'claude', false),
      },

      storage: {
        tempDir: getEnvVar('TEMP_DIR', './temp', false),
        screenshotsDir: getEnvVar(
          'SCREENSHOTS_DIR',
          './temp/screenshots',
          false
        ),
        apkDownloadDir: getEnvVar('APK_DOWNLOAD_DIR', './temp/apks', false),
        logsDir: getEnvVar('LOGS_DIR', './logs', false),
      },

      logging: {
        level: getEnvVar('LOG_LEVEL', 'info', false),
        format: getEnvVar('LOG_FORMAT', 'json', false),
        maxSize: getEnvVar('LOG_MAX_SIZE', '10m', false),
        maxFiles: getEnvNumber('LOG_MAX_FILES', 5, false),
      },

      testing: {
        timeout: getEnvNumber('TEST_TIMEOUT', 600000, false), // 10 minutes
        emulatorStartupTimeout: getEnvNumber(
          'EMULATOR_STARTUP_TIMEOUT',
          60000,
          false
        ), // 1 minute
        elementWaitTimeout: getEnvNumber('ELEMENT_WAIT_TIMEOUT', 10000, false), // 10 seconds
        screenshotOnFailure: getEnvBoolean(
          'SCREENSHOT_ON_FAILURE',
          true,
          false
        ),
        maxConcurrentTests: getEnvNumber('MAX_CONCURRENT_TESTS', 1, false),
        retryAttempts: getEnvNumber('RETRY_ATTEMPTS', 3, false),
        retryDelay: getEnvNumber('RETRY_DELAY', 1000, false),
      },
    };

    // Validate configuration
    validateConfig(config);

    logger.info('Configuration loaded successfully', {
      event: 'config_loaded',
      environment: config.api.environment,
      logLevel: config.logging.level,
      timestamp: new Date().toISOString(),
    });

    return config;
  } catch (error) {
    logger.error('Failed to load configuration', {
      event: 'config_load_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

/**
 * Validate configuration values
 */
function validateConfig(config: AppConfig): void {
  const errors: string[] = [];

  // Validate API configuration
  if (config.api.port < 1 || config.api.port > 65535) {
    errors.push('API port must be between 1 and 65535');
  }

  if (
    config.api.environment === 'production' &&
    config.api.apiKey === 'dev-api-key-change-in-production'
  ) {
    errors.push('API key must be changed in production environment');
  }

  // Validate AWS configuration for production
  if (config.api.environment === 'production') {
    if (!config.aws.accessKeyId) {
      errors.push('AWS_ACCESS_KEY_ID is required in production');
    }
    if (!config.aws.secretAccessKey) {
      errors.push('AWS_SECRET_ACCESS_KEY is required in production');
    }
  }

  // Validate Bedrock configuration
  if (
    config.aws.bedrock.temperature !== undefined &&
    (config.aws.bedrock.temperature < 0 || config.aws.bedrock.temperature > 1)
  ) {
    errors.push('Bedrock temperature must be between 0 and 1');
  }

  if (
    config.aws.bedrock.topP !== undefined &&
    (config.aws.bedrock.topP < 0 || config.aws.bedrock.topP > 1)
  ) {
    errors.push('Bedrock topP must be between 0 and 1');
  }

  // Validate JIRA configuration
  if (config.jira.baseUrl && !isValidUrl(config.jira.baseUrl)) {
    errors.push('JIRA base URL must be a valid URL');
  }

  if (config.jira.email && !isValidEmail(config.jira.email)) {
    errors.push('JIRA email must be a valid email address');
  }

  // Validate timeout values
  if (config.testing.timeout < 1000) {
    errors.push('Test timeout must be at least 1000ms');
  }

  if (config.testing.elementWaitTimeout < 1000) {
    errors.push('Element wait timeout must be at least 1000ms');
  }

  if (config.testing.maxConcurrentTests < 1) {
    errors.push('Max concurrent tests must be at least 1');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Get configuration with caching
 */
let cachedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

/**
 * Reload configuration (useful for testing)
 */
export function reloadConfig(): AppConfig {
  cachedConfig = null;
  return getConfig();
}

/**
 * Clear configuration cache (for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return getConfig().api.environment === 'development';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return getConfig().api.environment === 'production';
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return getConfig().api.environment === 'test';
}

/**
 * Get configuration for specific service
 */
export function getServiceConfig<K extends keyof AppConfig>(
  service: K
): AppConfig[K] {
  return getConfig()[service];
}

// Export default configuration instance
export default getConfig();
