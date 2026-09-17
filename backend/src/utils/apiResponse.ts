import { Response } from 'express';
import { ApiResponse } from '@e-pramaan/shared';

export class ApiResponseHelper {
  static success<T>(res: Response, data: T, message?: string, statusCode = 200): Response {
    const payload: ApiResponse<T> = {
      success: true,
      message,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
    return res.status(statusCode).json(payload);
  }

  static error(res: Response, message: string, code = 'INTERNAL_ERROR', statusCode = 500, details?: unknown): Response {
    const payload: ApiResponse<never> = {
      success: false,
      error: {
        code,
        message,
        details
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
    return res.status(statusCode).json(payload);
  }
}
