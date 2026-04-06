import type { RequestHandler } from 'express';
import type { ZodSchema, z } from 'zod';
import { ValidationError } from '../lib/api-error.js';

interface ValidateSchemas<B, Q, P> {
  body?: ZodSchema<B>;
  query?: ZodSchema<Q>;
  params?: ZodSchema<P>;
}

export function validate<
  B = unknown,
  Q = unknown,
  P = unknown,
>(schemas: ValidateSchemas<B, Q, P>): RequestHandler<
  P extends Record<string, string> ? P : Record<string, string>,
  unknown,
  B,
  Q extends Record<string, string> ? Q : Record<string, string>
> {
  return (req, _res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body) as B;
      }
      if (schemas.query) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any).query = schemas.query.parse(req.query);
      }
      if (schemas.params) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req as any).params = schemas.params.parse(req.params);
      }
      next();
    } catch (err) {
      // Let the global error handler convert ZodError → 422
      next(err);
    }
  };
}

// Convenience: infer the parsed body type from a Zod schema
export type InferBody<S extends ZodSchema> = z.infer<S>;
