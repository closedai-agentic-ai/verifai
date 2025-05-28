/**
 * Authentication Middleware
 * Handles API key validation for protected routes
 */

import { Request, Response, NextFunction } from 'express';
import { loggers } from '../../utils/logger';

interface AuthenticatedRequest extends Request {
  apiKey?: string;
}

/**
 * Middleware to validate API key
 */
export const validateApiKey = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const apiKey = req.headers['x-api-key'] as string;
  const clientIp = req.ip || 'unknown';

  if (!apiKey) {
    loggers.auth.failure('API key missing', req.path, clientIp);
    res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const validApiKey = process.env['API_KEY'];

  if (!validApiKey) {
    loggers.auth.failure('API key not configured', req.path, clientIp);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'API key not configured',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (apiKey !== validApiKey) {
    loggers.auth.failure('Invalid API key', req.path, clientIp);
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  loggers.auth.success(apiKey, req.path);
  req.apiKey = apiKey;
  next();
};

/**
 * Optional authentication middleware for routes that can work with or without auth
 */
export const optionalAuth = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  const apiKey = req.headers['x-api-key'] as string;
  const clientIp = req.ip || 'unknown';

  if (apiKey) {
    const validApiKey = process.env['API_KEY'];
    if (validApiKey && apiKey === validApiKey) {
      loggers.auth.success(apiKey, req.path);
      req.apiKey = apiKey;
    } else {
      loggers.auth.failure(
        'Invalid API key in optional auth',
        req.path,
        clientIp
      );
    }
  }

  next();
};
