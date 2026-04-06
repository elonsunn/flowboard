import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { requestLogger } from './middleware/request-logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { rootRouter } from './routes/index.js';

export const app = express();

// Security & parsing
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000' }));
app.use(express.json());

// Logging (after body parsing so content-length is accurate)
app.use(requestLogger);

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
