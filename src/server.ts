/**
 * VerifAI Express Server
 * Main server setup with middleware and basic endpoints
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import healthRoutes from './api/routes/health';
import logger, { loggers } from './utils/logger';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env['API_PORT'] || 3000;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env['NODE_ENV'] === 'production' ? false : true,
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware with Winston
app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // Log the request
  loggers.api.request(req);

  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  res.end = function (chunk?: any, encoding?: any, cb?: any) {
    const responseTime = Date.now() - startTime;
    loggers.api.response(req, res, responseTime);
    return originalEnd(chunk, encoding, cb);
  };

  next();
});

// Health check routes
app.use('/health', healthRoutes);

// API routes placeholder
app.get('/api/v1', (_req: Request, res: Response) => {
  res.status(200).json({
    message: 'VerifAI API v1.0',
    endpoints: {
      health: '/health',
      healthReady: '/health/ready',
      healthLive: '/health/live',
      sanityTest: '/api/v1/sanity-test',
    },
  });
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  loggers.api.error(req, err, res.statusCode || 500);

  res.status(500).json({
    error: 'Internal Server Error',
    message:
      process.env['NODE_ENV'] === 'development'
        ? err.message
        : 'Something went wrong',
    timestamp: new Date().toISOString(),
  });
});

// Start server
const server = app.listen(PORT, () => {
  loggers.system.startup(Number(PORT));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  loggers.system.shutdown('SIGTERM');
  server.close(() => {
    logger.info('Process terminated');
  });
});

process.on('SIGINT', () => {
  loggers.system.shutdown('SIGINT');
  server.close(() => {
    logger.info('Process terminated');
  });
});

export default app;
