import type { RequestHandler } from 'express';
import { verifyAccessToken } from '../lib/jwt.js';
import { UnauthorizedError } from '../lib/api-error.js';

export const authenticate: RequestHandler = (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }

  const token = authHeader.slice(7); // strip "Bearer "
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    next(err);
  }
};
