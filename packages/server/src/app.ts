import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { requestLogger } from './middleware/request-logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { globalRateLimit } from './middleware/rate-limit.js';
import { rootRouter } from './routes/index.js';
import { swaggerSpec } from './lib/swagger.js';

export const app = express();

// Security & parsing
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000' }));
app.use(express.json());

// Logging (after body parsing so content-length is accurate)
app.use(requestLogger);

// Swagger UI — served before rate limiting so docs are always accessible
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

// Global rate limiting: 100 req / min per IP
app.use('/api', globalRateLimit);

// Routes
app.use('/api', rootRouter);

// 404 catch-all
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

// Error handler — must be last
app.use(errorHandler);
