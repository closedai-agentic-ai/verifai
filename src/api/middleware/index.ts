/**
 * Middleware Index
 * Centralized exports for all middleware
 */

// Authentication middleware
export { validateApiKey, optionalAuth } from './auth';

// Validation middleware
export { validate, commonSchemas } from './validation';

// Error handling middleware
export {
  AppError,
  asyncHandler,
  globalErrorHandler,
  notFoundHandler,
} from './errorHandler';

// Rate limiting middleware
export { createRateLimit, rateLimiters } from './rateLimiter';
