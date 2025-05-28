/**
 * Rate Limiting Middleware
 * Prevents API abuse by limiting requests per time window
 */

import { Request, Response, NextFunction } from 'express';
import { loggers } from '../../utils/logger';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * In-memory rate limit store (for production, use Redis)
 */
const store: RateLimitStore = {};

/**
 * Clean up expired entries from the store
 */
const cleanupStore = (): void => {
  const now = Date.now();
  Object.keys(store).forEach(key => {
    const entry = store[key];
    if (entry && entry.resetTime <= now) {
      delete store[key];
    }
  });
};

/**
 * Get client identifier from request
 */
const getClientId = (req: Request): string => {
  // Use API key if available, otherwise fall back to IP
  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey) {
    return `api:${apiKey}`;
  }

  // Get real IP address (considering proxies)
  const forwarded = req.headers['x-forwarded-for'] as string;
  const ip = forwarded
    ? forwarded.split(',')[0]
    : req.connection.remoteAddress || req.ip || 'unknown';
  return `ip:${ip}`;
};

/**
 * Rate limiting middleware factory
 */
export const createRateLimit = (options: RateLimitOptions) => {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later.',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientId = getClientId(req);
    const now = Date.now();
    const resetTime = now + windowMs;

    // Clean up expired entries periodically
    if (Math.random() < 0.01) {
      // 1% chance to cleanup
      cleanupStore();
    }

    // Get or create client entry
    if (!store[clientId] || store[clientId].resetTime <= now) {
      store[clientId] = {
        count: 0,
        resetTime,
      };
    }

    const clientData = store[clientId];

    // Check if request should be counted
    const shouldCount = !skipSuccessfulRequests && !skipFailedRequests;

    if (shouldCount) {
      clientData.count++;
    }

    // Check if limit exceeded
    if (clientData.count > maxRequests) {
      const retryAfter = Math.ceil((clientData.resetTime - now) / 1000);

      // Log rate limit exceeded
      loggers.rateLimit.exceeded(clientId, req.path, maxRequests);

      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(clientData.resetTime).toISOString(),
        'Retry-After': retryAfter.toString(),
      });

      res.status(429).json({
        error: 'Too Many Requests',
        message,
        retryAfter,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': (maxRequests - clientData.count).toString(),
      'X-RateLimit-Reset': new Date(clientData.resetTime).toISOString(),
    });

    // Handle response counting for skip options
    if (skipSuccessfulRequests || skipFailedRequests) {
      const originalSend = res.send;
      res.send = function (body) {
        const statusCode = res.statusCode;
        const isSuccess = statusCode >= 200 && statusCode < 300;
        const isFailure = statusCode >= 400;

        if (
          (skipSuccessfulRequests && isSuccess) ||
          (skipFailedRequests && isFailure)
        ) {
          clientData.count--;
        }

        return originalSend.call(this, body);
      };
    }

    next();
  };
};

/**
 * Predefined rate limiters for common use cases
 */
export const rateLimiters = {
  // General API rate limit
  general: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'Too many requests from this IP, please try again later.',
  }),

  // Strict rate limit for test execution
  testExecution: createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    message: 'Too many test executions, please try again later.',
  }),

  // Rate limit for file uploads
  upload: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many file uploads, please try again later.',
  }),

  // Lenient rate limit for health checks
  health: createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    message: 'Too many health check requests.',
  }),
};
