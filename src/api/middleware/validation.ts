/**
 * Request Validation Middleware
 * Handles request body, query, and parameter validation using Joi
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

interface ValidationOptions {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}

/**
 * Generic validation middleware factory
 */
export const validate = (schemas: ValidationOptions) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    // Validate request body
    if (schemas.body) {
      const { error } = schemas.body.validate(req.body);
      if (error) {
        errors.push(`Body: ${error.details.map(d => d.message).join(', ')}`);
      }
    }

    // Validate query parameters
    if (schemas.query) {
      const { error } = schemas.query.validate(req.query);
      if (error) {
        errors.push(`Query: ${error.details.map(d => d.message).join(', ')}`);
      }
    }

    // Validate route parameters
    if (schemas.params) {
      const { error } = schemas.params.validate(req.params);
      if (error) {
        errors.push(`Params: ${error.details.map(d => d.message).join(', ')}`);
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Request validation failed',
        details: errors,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
};

/**
 * Common validation schemas
 */
export const commonSchemas = {
  // UUID validation
  uuid: Joi.string().uuid().required(),

  // Pagination
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }),

  // Test execution request
  testExecution: Joi.object({
    apkUrl: Joi.string().uri().required(),
    testType: Joi.string()
      .valid('sanity', 'smoke', 'regression')
      .default('sanity'),
    emulatorName: Joi.string().optional(),
    timeout: Joi.number().integer().min(60).max(3600).default(600),
    screenshotOnFailure: Joi.boolean().default(true),
    jiraIntegration: Joi.object({
      enabled: Joi.boolean().default(false),
      projectKey: Joi.string().when('enabled', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional(),
      }),
      issueType: Joi.string().default('Bug'),
    }).optional(),
  }),

  // APK upload
  apkUpload: Joi.object({
    filename: Joi.string().required(),
    size: Joi.number().integer().min(1).required(),
    checksum: Joi.string().optional(),
  }),
};
