/**
 * Winston Logger Configuration
 * Centralized logging for the VerifAI application
 */

import winston from 'winston';
import path from 'path';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each log level
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(logColors);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info: any) => `${info['timestamp']} [${info.level}]: ${info.message}`
  )
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create transports array
const transports: winston.transport[] = [];

// Console transport for development
if (process.env['NODE_ENV'] !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// File transports
const logsDir = process.env['LOGS_DIR'] || './logs';

transports.push(
  // Error log file
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: parseInt(process.env['LOG_MAX_SIZE'] || '10485760'), // 10MB
    maxFiles: parseInt(process.env['LOG_MAX_FILES'] || '5'),
  }),

  // Combined log file
  new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    format: fileFormat,
    maxsize: parseInt(process.env['LOG_MAX_SIZE'] || '10485760'), // 10MB
    maxFiles: parseInt(process.env['LOG_MAX_FILES'] || '5'),
  })
);

// Create the logger
const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] || 'info',
  levels: logLevels,
  format: fileFormat,
  transports,
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: fileFormat,
    }),
  ],
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: fileFormat,
    }),
  ],
});

// Create a stream object for Morgan HTTP logging
export const logStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Helper functions for structured logging
export const loggers = {
  // System events
  system: {
    startup: (port: number) => {
      logger.info('Server startup', {
        event: 'server_startup',
        port,
        environment: process.env['NODE_ENV'] || 'development',
        timestamp: new Date().toISOString(),
      });
    },
    shutdown: (signal: string) => {
      logger.info('Server shutdown', {
        event: 'server_shutdown',
        signal,
        timestamp: new Date().toISOString(),
      });
    },
    error: (error: Error, context?: any) => {
      logger.error('System error', {
        event: 'system_error',
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        context,
        timestamp: new Date().toISOString(),
      });
    },
  },

  // API request/response logging
  api: {
    request: (req: any, metadata?: any) => {
      logger.http('API request', {
        event: 'api_request',
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        apiKey: req.headers['x-api-key'] ? 'present' : 'missing',
        metadata,
        timestamp: new Date().toISOString(),
      });
    },
    response: (req: any, res: any, responseTime: number) => {
      logger.http('API response', {
        event: 'api_response',
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString(),
      });
    },
    error: (req: any, error: Error, statusCode: number) => {
      logger.error('API error', {
        event: 'api_error',
        method: req.method,
        url: req.url,
        statusCode,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        timestamp: new Date().toISOString(),
      });
    },
  },

  // Test execution logging
  test: {
    started: (testId: string, metadata: any) => {
      logger.info('Test execution started', {
        event: 'test_started',
        testId,
        metadata,
        timestamp: new Date().toISOString(),
      });
    },
    completed: (testId: string, result: any, duration: number) => {
      logger.info('Test execution completed', {
        event: 'test_completed',
        testId,
        result,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
    },
    failed: (testId: string, error: Error, duration: number) => {
      logger.error('Test execution failed', {
        event: 'test_failed',
        testId,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
    },
    step: (
      testId: string,
      step: string,
      status: 'started' | 'completed' | 'failed',
      metadata?: any
    ) => {
      logger.debug('Test step', {
        event: 'test_step',
        testId,
        step,
        status,
        metadata,
        timestamp: new Date().toISOString(),
      });
    },
  },

  // Health check logging
  health: {
    check: (status: string, dependencies: any) => {
      logger.info('Health check', {
        event: 'health_check',
        status,
        dependencies,
        timestamp: new Date().toISOString(),
      });
    },
    dependency: (
      name: string,
      status: string,
      responseTime?: number,
      error?: string
    ) => {
      logger.debug('Dependency check', {
        event: 'dependency_check',
        dependency: name,
        status,
        responseTime: responseTime ? `${responseTime}ms` : undefined,
        error,
        timestamp: new Date().toISOString(),
      });
    },
  },

  // Authentication logging
  auth: {
    success: (apiKey: string, endpoint: string) => {
      logger.info('Authentication success', {
        event: 'auth_success',
        apiKey: apiKey.substring(0, 8) + '...',
        endpoint,
        timestamp: new Date().toISOString(),
      });
    },
    failure: (reason: string, endpoint: string, ip: string) => {
      logger.warn('Authentication failure', {
        event: 'auth_failure',
        reason,
        endpoint,
        ip,
        timestamp: new Date().toISOString(),
      });
    },
  },

  // Rate limiting logging
  rateLimit: {
    exceeded: (clientId: string, endpoint: string, limit: number) => {
      logger.warn('Rate limit exceeded', {
        event: 'rate_limit_exceeded',
        clientId: clientId.substring(0, 10) + '...',
        endpoint,
        limit,
        timestamp: new Date().toISOString(),
      });
    },
  },
};

export default logger;
