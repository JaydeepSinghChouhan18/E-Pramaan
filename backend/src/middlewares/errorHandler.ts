import { Request, Response, NextFunction } from 'express';
import { ApiResponseHelper } from '../utils/apiResponse.js';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(err: Error | AppError, req: Request, res: Response, _next: NextFunction): void {
  const isDev = process.env.NODE_ENV !== 'production';

  if (err instanceof AppError) {
    if (isDev) {
      const userContext = req.user ? `${req.user.role} (${req.user.id.slice(0, 8)}...)` : 'ANONYMOUS';
      console.error(
        `[Backend AppError] ${req.method} ${req.originalUrl} | User: ${userContext} | Code: ${err.code} | Status: ${err.statusCode} | Message: ${err.message}`
      );
      if (err.details) {
        const safeDetails = typeof err.details === 'object' ? JSON.stringify(err.details) : String(err.details);
        console.error(`[AppError Details]:`, safeDetails);
      }
    }
    ApiResponseHelper.error(res, err.message, err.code, err.statusCode, err.details);
    return;
  }

  console.error(`[Unhandled Exception] ${req.method} ${req.originalUrl}:`, err);
  ApiResponseHelper.error(
    res,
    isDev ? err.message : 'Internal server error occurred.',
    'INTERNAL_SERVER_ERROR',
    500
  );
}

export function notFoundHandler(req: Request, res: Response): void {
  ApiResponseHelper.error(res, `Route ${req.method} ${req.originalUrl} not found`, 'NOT_FOUND', 404);
}
