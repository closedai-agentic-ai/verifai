/**
 * Tests for Logger Utility
 */

import winston from 'winston';

// Mock winston before importing logger
jest.mock('winston', () => ({
  createLogger: jest.fn(),
  addColors: jest.fn(),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
    printf: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

// Create mock logger instance
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  http: jest.fn(),
};

// Mock winston.createLogger to return our mock
(winston.createLogger as jest.Mock).mockReturnValue(mockLogger);

// Now import logger after mocking
import logger, { logStream, loggers } from './logger';

describe('Logger Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('default logger', () => {
    it('should export a default logger instance', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });
  });

  describe('logStream', () => {
    it('should provide a write method for Morgan integration', () => {
      expect(logStream).toBeDefined();
      expect(typeof logStream.write).toBe('function');
    });

    it('should write messages to http log level', () => {
      const message = 'GET /api/health 200 - 5ms\n';

      logStream.write(message);

      expect(mockLogger.http).toHaveBeenCalledWith('GET /api/health 200 - 5ms');
    });
  });

  describe('structured logging helpers', () => {
    describe('system loggers', () => {
      it('should log system startup', () => {
        const port = 3000;

        loggers.system.startup(port);

        expect(mockLogger.info).toHaveBeenCalledWith('Server startup', {
          event: 'server_startup',
          port,
          environment: expect.any(String),
          timestamp: expect.any(String),
        });
      });

      it('should log system shutdown', () => {
        const signal = 'SIGTERM';

        loggers.system.shutdown(signal);

        expect(mockLogger.info).toHaveBeenCalledWith('Server shutdown', {
          event: 'server_shutdown',
          signal,
          timestamp: expect.any(String),
        });
      });

      it('should log system errors', () => {
        const error = new Error('System failure');
        const context = { component: 'database' };

        loggers.system.error(error, context);

        expect(mockLogger.error).toHaveBeenCalledWith('System error', {
          event: 'system_error',
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
          context,
          timestamp: expect.any(String),
        });
      });
    });

    describe('api loggers', () => {
      const mockReq = {
        method: 'GET',
        url: '/api/health',
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
        headers: { 'x-api-key': 'test-key' },
      };

      const mockRes = {
        statusCode: 200,
      };

      it('should log API requests', () => {
        const metadata = { userId: '123' };

        loggers.api.request(mockReq, metadata);

        expect(mockLogger.http).toHaveBeenCalledWith('API request', {
          event: 'api_request',
          method: 'GET',
          url: '/api/health',
          ip: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
          apiKey: 'present',
          metadata,
          timestamp: expect.any(String),
        });
      });

      it('should log API responses', () => {
        const responseTime = 150;

        loggers.api.response(mockReq, mockRes, responseTime);

        expect(mockLogger.http).toHaveBeenCalledWith('API response', {
          event: 'api_response',
          method: 'GET',
          url: '/api/health',
          statusCode: 200,
          responseTime: '150ms',
          timestamp: expect.any(String),
        });
      });

      it('should log API errors', () => {
        const error = new Error('API error');
        const statusCode = 500;

        loggers.api.error(mockReq, error, statusCode);

        expect(mockLogger.error).toHaveBeenCalledWith('API error', {
          event: 'api_error',
          method: 'GET',
          url: '/api/health',
          statusCode,
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
          timestamp: expect.any(String),
        });
      });
    });

    describe('test loggers', () => {
      it('should log test started', () => {
        const testId = 'test-123';
        const metadata = { apkName: 'test.apk' };

        loggers.test.started(testId, metadata);

        expect(mockLogger.info).toHaveBeenCalledWith('Test execution started', {
          event: 'test_started',
          testId,
          metadata,
          timestamp: expect.any(String),
        });
      });

      it('should log test completed', () => {
        const testId = 'test-123';
        const result = { status: 'passed', steps: 5 };
        const duration = 5000;

        loggers.test.completed(testId, result, duration);

        expect(mockLogger.info).toHaveBeenCalledWith(
          'Test execution completed',
          {
            event: 'test_completed',
            testId,
            result,
            duration: '5000ms',
            timestamp: expect.any(String),
          }
        );
      });

      it('should log test failed', () => {
        const testId = 'test-123';
        const error = new Error('Test failed');
        const duration = 3000;

        loggers.test.failed(testId, error, duration);

        expect(mockLogger.error).toHaveBeenCalledWith('Test execution failed', {
          event: 'test_failed',
          testId,
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
          duration: '3000ms',
          timestamp: expect.any(String),
        });
      });

      it('should log test steps', () => {
        const testId = 'test-123';
        const step = 'launch_app';
        const status = 'completed';
        const metadata = { packageName: 'com.example.app' };

        loggers.test.step(testId, step, status, metadata);

        expect(mockLogger.debug).toHaveBeenCalledWith('Test step', {
          event: 'test_step',
          testId,
          step,
          status,
          metadata,
          timestamp: expect.any(String),
        });
      });
    });

    describe('health loggers', () => {
      it('should log health checks', () => {
        const status = 'healthy';
        const dependencies = { database: 'up', redis: 'up' };

        loggers.health.check(status, dependencies);

        expect(mockLogger.info).toHaveBeenCalledWith('Health check', {
          event: 'health_check',
          status,
          dependencies,
          timestamp: expect.any(String),
        });
      });

      it('should log dependency checks', () => {
        const name = 'database';
        const status = 'up';
        const responseTime = 50;

        loggers.health.dependency(name, status, responseTime);

        expect(mockLogger.debug).toHaveBeenCalledWith('Dependency check', {
          event: 'dependency_check',
          dependency: name,
          status,
          responseTime: '50ms',
          error: undefined,
          timestamp: expect.any(String),
        });
      });
    });

    describe('auth loggers', () => {
      it('should log authentication success', () => {
        const apiKey = 'test-api-key-123';
        const endpoint = '/api/test';

        loggers.auth.success(apiKey, endpoint);

        expect(mockLogger.info).toHaveBeenCalledWith('Authentication success', {
          event: 'auth_success',
          apiKey: 'test-api...',
          endpoint,
          timestamp: expect.any(String),
        });
      });

      it('should log authentication failure', () => {
        const reason = 'Invalid API key';
        const endpoint = '/api/test';
        const ip = '192.168.1.1';

        loggers.auth.failure(reason, endpoint, ip);

        expect(mockLogger.warn).toHaveBeenCalledWith('Authentication failure', {
          event: 'auth_failure',
          reason,
          endpoint,
          ip,
          timestamp: expect.any(String),
        });
      });
    });

    describe('rate limit loggers', () => {
      it('should log rate limit exceeded', () => {
        const clientId = 'client-123456789';
        const endpoint = '/api/test';
        const limit = 100;

        loggers.rateLimit.exceeded(clientId, endpoint, limit);

        expect(mockLogger.warn).toHaveBeenCalledWith('Rate limit exceeded', {
          event: 'rate_limit_exceeded',
          clientId: 'client-123...',
          endpoint,
          limit,
          timestamp: expect.any(String),
        });
      });
    });
  });

  // Winston configuration is tested implicitly through the logger functionality
  // The actual winston setup is mocked, so we don't need to test the configuration directly
});
