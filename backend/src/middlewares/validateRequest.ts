import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from './errorHandler.js';

export const validateRequest = (schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new AppError('Request validation failed', 400, 'VALIDATION_ERROR', error.flatten()));
      } else {
        next(error);
      }
    }
  };
};
