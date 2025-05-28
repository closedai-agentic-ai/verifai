/**
 * Tests for Configuration Utility
 */

import {
  loadConfig,
  getConfig,
  reloadConfig,
  clearConfigCache,
  isDevelopment,
  isProduction,
  isTest,
  getServiceConfig,
} from './config';

// Mock logger
jest.mock('./logger');

describe('Configuration Utility', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    jest.resetModules();
    process.env = { ...originalEnv };

    // Remove NODE_ENV to allow tests to set it explicitly
    delete process.env['NODE_ENV'];

    // Clear any cached config
    clearConfigCache();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should load configuration with default values', () => {
      // Explicitly set to development environment
      process.env['NODE_ENV'] = 'development';

      const config = loadConfig();

      expect(config.api.port).toBe(3000);
      expect(config.api.environment).toBe('development');
      expect(config.aws.region).toBe('us-east-1');
      expect(config.testing.timeout).toBe(600000);
    });

    it('should load configuration from environment variables', () => {
      process.env['API_PORT'] = '8080';
      process.env['NODE_ENV'] = 'development'; // Use development to avoid production validation
      process.env['AWS_REGION'] = 'us-west-2';
      process.env['LOG_LEVEL'] = 'debug';

      const config = loadConfig();

      expect(config.api.port).toBe(8080);
      expect(config.api.environment).toBe('development');
      expect(config.aws.region).toBe('us-west-2');
      expect(config.logging.level).toBe('debug');
    });

    it('should parse boolean environment variables correctly', () => {
      process.env['SCREENSHOT_ON_FAILURE'] = 'false';

      const config = loadConfig();

      expect(config.testing.screenshotOnFailure).toBe(false);
    });

    it('should parse number environment variables correctly', () => {
      process.env['API_PORT'] = '9000';
      process.env['TEST_TIMEOUT'] = '300000';
      process.env['RETRY_ATTEMPTS'] = '5';

      const config = loadConfig();

      expect(config.api.port).toBe(9000);
      expect(config.testing.timeout).toBe(300000);
      expect(config.testing.retryAttempts).toBe(5);
    });

    it('should parse float environment variables correctly', () => {
      process.env['BEDROCK_TEMPERATURE'] = '0.8';
      process.env['BEDROCK_TOP_P'] = '0.95';

      const config = loadConfig();

      expect(config.aws.bedrock.temperature).toBe(0.8);
      expect(config.aws.bedrock.topP).toBe(0.95);
    });

    it('should split server args correctly', () => {
      process.env['MCP_MOBILE_SERVER_ARGS'] =
        '-y @mobilenext/mobile-mcp@latest --verbose';

      const config = loadConfig();

      expect(config.mcp.mobile.serverArgs).toEqual([
        '-y',
        '@mobilenext/mobile-mcp@latest',
        '--verbose',
      ]);
    });
  });

  describe('configuration validation', () => {
    it('should validate API port range', () => {
      process.env['API_PORT'] = '70000'; // Invalid port

      expect(() => loadConfig()).toThrow(
        'API port must be between 1 and 65535'
      );
    });

    it('should validate production API key', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['API_KEY'] = 'dev-api-key-change-in-production';

      expect(() => loadConfig()).toThrow(
        'API key must be changed in production environment'
      );
    });

    it('should validate AWS credentials in production', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['API_KEY'] = 'production-key';
      // Missing AWS credentials

      expect(() => loadConfig()).toThrow(
        'AWS_ACCESS_KEY_ID is required in production'
      );
    });

    it('should validate Bedrock temperature range', () => {
      process.env['BEDROCK_TEMPERATURE'] = '1.5'; // Invalid temperature

      expect(() => loadConfig()).toThrow(
        'Bedrock temperature must be between 0 and 1'
      );
    });

    it('should validate Bedrock topP range', () => {
      process.env['BEDROCK_TOP_P'] = '-0.1'; // Invalid topP

      expect(() => loadConfig()).toThrow(
        'Bedrock topP must be between 0 and 1'
      );
    });

    it('should validate JIRA base URL format', () => {
      process.env['JIRA_BASE_URL'] = 'invalid-url';

      expect(() => loadConfig()).toThrow('JIRA base URL must be a valid URL');
    });

    it('should validate JIRA email format', () => {
      process.env['JIRA_EMAIL'] = 'invalid-email';

      expect(() => loadConfig()).toThrow(
        'JIRA email must be a valid email address'
      );
    });

    it('should validate timeout values', () => {
      process.env['TEST_TIMEOUT'] = '500'; // Too low

      expect(() => loadConfig()).toThrow(
        'Test timeout must be at least 1000ms'
      );
    });

    it('should validate max concurrent tests', () => {
      process.env['MAX_CONCURRENT_TESTS'] = '0'; // Too low

      expect(() => loadConfig()).toThrow(
        'Max concurrent tests must be at least 1'
      );
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid number format', () => {
      process.env['API_PORT'] = 'not-a-number';

      expect(() => loadConfig()).toThrow(
        'Environment variable API_PORT must be a valid number'
      );
    });

    it('should throw error for invalid boolean format', () => {
      process.env['SCREENSHOT_ON_FAILURE'] = 'maybe';

      expect(() => loadConfig()).toThrow(
        'Environment variable SCREENSHOT_ON_FAILURE must be a boolean'
      );
    });

    it('should handle missing required environment variables', () => {
      // Test with a custom function that requires a variable
      process.env = {}; // Clear all env vars

      // This should work since we have defaults for most variables
      expect(() => loadConfig()).not.toThrow();
    });
  });

  describe('getConfig', () => {
    it('should return cached configuration', () => {
      const config1 = getConfig();
      const config2 = getConfig();

      expect(config1).toBe(config2); // Same reference
    });

    it('should load configuration on first call', () => {
      process.env['API_PORT'] = '7000';
      process.env['NODE_ENV'] = 'development';

      // Clear any existing cache first
      clearConfigCache();

      const config = getConfig();

      expect(config.api.port).toBe(7000);
    });
  });

  describe('reloadConfig', () => {
    it('should reload configuration with new environment variables', () => {
      process.env['API_PORT'] = '5000';
      process.env['NODE_ENV'] = 'development';

      const config1 = getConfig();
      expect(config1.api.port).toBe(5000);

      process.env['API_PORT'] = '6000';
      const config2 = reloadConfig();
      expect(config2.api.port).toBe(6000);
    });
  });

  describe('environment helpers', () => {
    it('should detect development environment', () => {
      process.env['NODE_ENV'] = 'development';

      // Clear cache to ensure fresh config load
      clearConfigCache();

      expect(isDevelopment()).toBe(true);
      expect(isProduction()).toBe(false);
      expect(isTest()).toBe(false);
    });

    it('should detect production environment', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['API_KEY'] = 'production-key';
      process.env['AWS_ACCESS_KEY_ID'] = 'test-key';
      process.env['AWS_SECRET_ACCESS_KEY'] = 'test-secret';

      // Clear cache to ensure fresh config load
      clearConfigCache();

      expect(isDevelopment()).toBe(false);
      expect(isProduction()).toBe(true);
      expect(isTest()).toBe(false);
    });

    it('should detect test environment', () => {
      process.env['NODE_ENV'] = 'test';

      // Clear cache to ensure fresh config load
      clearConfigCache();

      expect(isDevelopment()).toBe(false);
      expect(isProduction()).toBe(false);
      expect(isTest()).toBe(true);
    });
  });

  describe('getServiceConfig', () => {
    it('should return specific service configuration', () => {
      process.env['AWS_REGION'] = 'eu-west-1';
      process.env['NODE_ENV'] = 'development';

      // Clear cache to ensure fresh config load
      clearConfigCache();

      const awsConfig = getServiceConfig('aws');

      expect(awsConfig.region).toBe('eu-west-1');
      expect(awsConfig.bedrock).toBeDefined();
    });

    it('should return API configuration', () => {
      process.env['API_PORT'] = '4000';
      process.env['NODE_ENV'] = 'development';

      // Clear cache to ensure fresh config load
      clearConfigCache();

      const apiConfig = getServiceConfig('api');

      expect(apiConfig.port).toBe(4000);
      expect(apiConfig.environment).toBeDefined();
    });

    it('should return logging configuration', () => {
      process.env['LOG_LEVEL'] = 'warn';
      process.env['NODE_ENV'] = 'development';

      // Clear cache to ensure fresh config load
      clearConfigCache();

      const loggingConfig = getServiceConfig('logging');

      expect(loggingConfig.level).toBe('warn');
      expect(loggingConfig.format).toBeDefined();
    });
  });

  describe('URL and email validation', () => {
    it('should validate valid URLs', () => {
      process.env['JIRA_BASE_URL'] = 'https://company.atlassian.net';

      expect(() => loadConfig()).not.toThrow();
    });

    it('should validate valid emails', () => {
      process.env['JIRA_EMAIL'] = 'user@company.com';

      expect(() => loadConfig()).not.toThrow();
    });

    it('should reject invalid URLs', () => {
      process.env['JIRA_BASE_URL'] = 'not-a-url';

      expect(() => loadConfig()).toThrow('JIRA base URL must be a valid URL');
    });

    it('should reject invalid emails', () => {
      process.env['JIRA_EMAIL'] = 'not-an-email';

      expect(() => loadConfig()).toThrow(
        'JIRA email must be a valid email address'
      );
    });
  });

  describe('complex configuration scenarios', () => {
    it('should handle complete production configuration', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['API_KEY'] = 'secure-production-key';
      process.env['API_PORT'] = '8080';
      process.env['AWS_ACCESS_KEY_ID'] = 'AKIAIOSFODNN7EXAMPLE';
      process.env['AWS_SECRET_ACCESS_KEY'] =
        'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
      process.env['AWS_REGION'] = 'us-east-1';
      process.env['JIRA_BASE_URL'] = 'https://company.atlassian.net';
      process.env['JIRA_EMAIL'] = 'automation@company.com';
      process.env['JIRA_API_TOKEN'] = 'secure-token';
      process.env['LOG_LEVEL'] = 'info';

      const config = loadConfig();

      expect(config.api.environment).toBe('production');
      expect(config.api.apiKey).toBe('secure-production-key');
      expect(config.aws.accessKeyId).toBe('AKIAIOSFODNN7EXAMPLE');
      expect(config.jira.baseUrl).toBe('https://company.atlassian.net');
      expect(config.logging.level).toBe('info');
    });

    it('should handle minimal development configuration', () => {
      // Use all defaults
      process.env['NODE_ENV'] = 'development';

      // Clear cache to ensure fresh config load
      clearConfigCache();

      const config = loadConfig();

      expect(config.api.environment).toBe('development');
      expect(config.api.port).toBe(3000);
      expect(config.aws.region).toBe('us-east-1');
      expect(config.logging.level).toBe('info');
    });
  });
});
