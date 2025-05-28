/**
 * Health Check Routes
 * Comprehensive health monitoring for the VerifAI service
 */

import { Router, Request, Response } from 'express';
import { rateLimiters } from '../middleware';
import { loggers } from '../../utils/logger';
import * as os from 'os';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  service: string;
  version: string;
  uptime: number;
  environment: string;
  dependencies: {
    [key: string]: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      error?: string;
    };
  };
  system: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      loadAverage: number[];
    };
    disk?: {
      available: number;
      total: number;
      percentage: number;
    };
  };
}

/**
 * Check AWS Bedrock connectivity
 */
const checkBedrockHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  error?: string;
}> => {
  try {
    const startTime = Date.now();

    // Basic check - verify AWS credentials are configured
    const hasCredentials = !!(
      process.env['AWS_ACCESS_KEY_ID'] && process.env['AWS_SECRET_ACCESS_KEY']
    );

    if (!hasCredentials) {
      const result = {
        status: 'unhealthy' as const,
        error: 'AWS credentials not configured',
      };
      loggers.health.dependency(
        'bedrock',
        result.status,
        undefined,
        result.error
      );
      return result;
    }

    const responseTime = Date.now() - startTime;
    const result = {
      status: 'healthy' as const,
      responseTime,
    };
    loggers.health.dependency('bedrock', result.status, responseTime);
    return result;
  } catch (error) {
    const result = {
      status: 'unhealthy' as const,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    loggers.health.dependency(
      'bedrock',
      result.status,
      undefined,
      result.error
    );
    return result;
  }
};

/**
 * Check JIRA connectivity
 */
const checkJiraHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  error?: string;
}> => {
  try {
    const startTime = Date.now();

    // Basic check - verify JIRA configuration
    const hasConfig = !!(
      process.env['JIRA_BASE_URL'] && process.env['JIRA_API_TOKEN']
    );

    if (!hasConfig) {
      const result = {
        status: 'unhealthy' as const,
        error: 'JIRA configuration not complete',
      };
      loggers.health.dependency('jira', result.status, undefined, result.error);
      return result;
    }

    const responseTime = Date.now() - startTime;
    const result = {
      status: 'healthy' as const,
      responseTime,
    };
    loggers.health.dependency('jira', result.status, responseTime);
    return result;
  } catch (error) {
    const result = {
      status: 'unhealthy' as const,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    loggers.health.dependency('jira', result.status, undefined, result.error);
    return result;
  }
};

/**
 * Check Android SDK availability
 */
const checkAndroidSdkHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  error?: string;
}> => {
  try {
    const startTime = Date.now();

    // Basic check - verify Android SDK path is configured
    const hasAndroidHome = !!process.env['ANDROID_HOME'];

    if (!hasAndroidHome) {
      const result = {
        status: 'unhealthy' as const,
        error: 'ANDROID_HOME not configured',
      };
      loggers.health.dependency(
        'androidSdk',
        result.status,
        undefined,
        result.error
      );
      return result;
    }

    const responseTime = Date.now() - startTime;
    const result = {
      status: 'healthy' as const,
      responseTime,
    };
    loggers.health.dependency('androidSdk', result.status, responseTime);
    return result;
  } catch (error) {
    const result = {
      status: 'unhealthy' as const,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    loggers.health.dependency(
      'androidSdk',
      result.status,
      undefined,
      result.error
    );
    return result;
  }
};

/**
 * Get system memory information
 */
const getMemoryInfo = () => {
  const used = process.memoryUsage().heapUsed;
  const total = process.memoryUsage().heapTotal;
  return {
    used: Math.round(used / 1024 / 1024), // MB
    total: Math.round(total / 1024 / 1024), // MB
    percentage: Math.round((used / total) * 100),
  };
};

/**
 * Basic health check endpoint
 */
router.get('/', rateLimiters.health, async (_req: Request, res: Response) => {
  try {
    const [bedrockHealth, jiraHealth, androidSdkHealth] = await Promise.all([
      checkBedrockHealth(),
      checkJiraHealth(),
      checkAndroidSdkHealth(),
    ]);

    const dependencies = {
      bedrock: bedrockHealth,
      jira: jiraHealth,
      androidSdk: androidSdkHealth,
    };

    // Determine overall status
    const hasUnhealthyDependencies = Object.values(dependencies).some(
      dep => dep.status === 'unhealthy'
    );
    const overallStatus: 'healthy' | 'degraded' | 'unhealthy' =
      hasUnhealthyDependencies ? 'degraded' : 'healthy';

    // Log health check
    loggers.health.check(overallStatus, dependencies);

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: 'VerifAI',
      version: '1.0.0',
      uptime: process.uptime(),
      environment: process.env['NODE_ENV'] || 'development',
      dependencies,
      system: {
        memory: getMemoryInfo(),
        cpu: {
          loadAverage: os.loadavg(),
        },
      },
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    loggers.health.check('unhealthy', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'VerifAI',
      version: '1.0.0',
      error: error instanceof Error ? error.message : 'Health check failed',
    });
  }
});

/**
 * Readiness probe endpoint
 */
router.get(
  '/ready',
  rateLimiters.health,
  async (_req: Request, res: Response) => {
    try {
      // Check if all critical dependencies are available
      const [bedrockHealth, androidSdkHealth] = await Promise.all([
        checkBedrockHealth(),
        checkAndroidSdkHealth(),
      ]);

      const isReady =
        bedrockHealth.status === 'healthy' &&
        androidSdkHealth.status === 'healthy';

      if (isReady) {
        res.status(200).json({
          status: 'ready',
          timestamp: new Date().toISOString(),
          service: 'VerifAI',
        });
      } else {
        res.status(503).json({
          status: 'not ready',
          timestamp: new Date().toISOString(),
          service: 'VerifAI',
          dependencies: {
            bedrock: bedrockHealth,
            androidSdk: androidSdkHealth,
          },
        });
      }
    } catch (error) {
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        service: 'VerifAI',
        error:
          error instanceof Error ? error.message : 'Readiness check failed',
      });
    }
  }
);

/**
 * Liveness probe endpoint
 */
router.get('/live', rateLimiters.health, (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    service: 'VerifAI',
    uptime: process.uptime(),
  });
});

export default router;
