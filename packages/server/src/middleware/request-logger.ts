import morgan from 'morgan';
import type { RequestHandler } from 'express';

const isProd = process.env.NODE_ENV === 'production';

// Production: structured JSON logs
// Development: colorized concise output
export const requestLogger: RequestHandler = isProd
  ? morgan((tokens, req, res) => {
      return JSON.stringify({
        method: tokens.method(req, res),
        url: tokens.url(req, res),
        status: Number(tokens.status(req, res)),
        responseTimeMs: Number(tokens['response-time'](req, res)),
        contentLength: tokens.res(req, res, 'content-length') ?? 0,
      });
    })
  : morgan('dev');
