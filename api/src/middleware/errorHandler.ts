import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { config } from '../config/index.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.code,
      statusCode: err.statusCode,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const path = issue.path.join('.');
      if (!fieldErrors[path]) {
        fieldErrors[path] = [];
      }
      fieldErrors[path].push(issue.message);
    }
    res.status(422).json({
      error: 'VALIDATION_ERROR',
      statusCode: 422,
      message: 'Validation failed',
      details: fieldErrors,
    });
    return;
  }

  console.error('Unhandled error:', err);

  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    statusCode: 500,
    message: config.isProduction ? 'Internal server error' : err.message,
    ...(config.isProduction ? {} : { stack: err.stack }),
  });
}
