/**
 * Error Handling Middleware
 * Centralized error handling for the application
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Custom error class for application-specific errors
 */
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Async error wrapper to catch async errors in route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Error response formatter
 */
const sendErrorResponse = (err: AppError, res: Response): void => {
  const isDevelopment = process.env['NODE_ENV'] === 'development';

  const errorResponse: any = {
    error: err.name || 'Error',
    message: err.message,
    statusCode: err.statusCode,
    timestamp: new Date().toISOString(),
  };

  // Include stack trace in development
  if (isDevelopment) {
    errorResponse.stack = err.stack;
  }

  res.status(err.statusCode).json(errorResponse);
};

/**
 * Handle different types of errors
 */
const handleCastError = (err: any): AppError => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsError = (err: any): AppError => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

const handleValidationError = (err: any): AppError => {
  const errors = Object.values(err.errors).map((el: any) => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = (): AppError => {
  return new AppError('Invalid token. Please log in again!', 401);
};

const handleJWTExpiredError = (): AppError => {
  return new AppError('Your token has expired! Please log in again.', 401);
};

/**
 * Global error handling middleware
 */
export const globalErrorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  let error = { ...err };
  error.message = err.message;

  // Handle specific error types
  if (err.name === 'CastError') {
    error = handleCastError(error);
  }
  if (err.code === 11000) {
    error = handleDuplicateFieldsError(error);
  }
  if (err.name === 'ValidationError') {
    error = handleValidationError(error);
  }
  if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }
  if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  sendErrorResponse(error, res);
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  res.status(error.statusCode).json({
    error: error.name,
    message: error.message,
    statusCode: error.statusCode,
    timestamp: new Date().toISOString(),
  });
};
