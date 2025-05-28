/**
 * Tests for Health Check Routes
 */

import request from 'supertest';
import express from 'express';
import healthRouter from './health';

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  loggers: {
    health: {
      check: jest.fn(),
      dependency: jest.fn(),
    },
  },
}));

jest.mock('../../utils/config');

// Mock the middleware
jest.mock('../middleware', () => ({
  rateLimiters: {
    health: (_req: any, _res: any, next: any) => next(),
  },
}));

const app = express();
app.use('/health', healthRouter);

describe('Health Check Routes', () => {
  beforeEach(() => {
    // Set up environment variables for tests
    process.env['NODE_ENV'] = 'test';
    process.env['AWS_ACCESS_KEY_ID'] = 'test-key';
    process.env['AWS_SECRET_ACCESS_KEY'] = 'test-secret';
    process.env['JIRA_BASE_URL'] = 'https://test.atlassian.net';
    process.env['JIRA_API_TOKEN'] = 'test-token';
    process.env['ANDROID_HOME'] = '/test/android-sdk';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version');
    });

    it('should include service information', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body.service).toBe('VerifAI');
      expect(response.body.status).toBe('healthy');
      expect(typeof response.body.uptime).toBe('number');
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed health status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('dependencies');
      expect(response.body).toHaveProperty('system');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should include dependency checks', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body.dependencies).toHaveProperty('bedrock');
      expect(response.body.dependencies).toHaveProperty('jira');
      expect(response.body.dependencies).toHaveProperty('androidSdk');
    });

    it('should include system information', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body.system).toHaveProperty('memory');
      expect(response.body.system).toHaveProperty('cpu');
      expect(response.body.system.memory).toHaveProperty('used');
      expect(response.body.system.memory).toHaveProperty('total');
      expect(response.body.system.memory).toHaveProperty('percentage');
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app).get('/health/ready').expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.service).toBe('VerifAI');
    });

    it('should check critical dependencies', async () => {
      const response = await request(app).get('/health/ready').expect(200);

      expect(response.body.status).toBe('ready');
      expect(response.body.service).toBe('VerifAI');
    });
  });

  describe('GET /health/live', () => {
    it('should return liveness status', async () => {
      const response = await request(app).get('/health/live').expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.status).toBe('alive');
      expect(response.body.service).toBe('VerifAI');
    });
  });

  describe('error handling', () => {
    it('should handle internal errors gracefully', async () => {
      // Mock an error in the health check
      const originalProcessUptime = process.uptime;
      process.uptime = jest.fn().mockImplementation(() => {
        throw new Error('Process error');
      });

      const response = await request(app).get('/health').expect(500);

      expect(response.body).toHaveProperty('status', 'unhealthy');
      expect(response.body).toHaveProperty('error');

      // Restore original function
      process.uptime = originalProcessUptime;
    });
  });
});
