import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFound.js';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import botRoutes from './routes/botRoutes.js';
import xOAuthRoutes from './routes/xOAuthRoutes.js';
import postRoutes from './routes/postRoutes.js';
import userRoutes from './routes/userRoutes.js';
import statsRoutes from './routes/statsRoutes.js';
import * as jobWorker from './worker/jobWorker.js';
import * as staleLockRecovery from './worker/staleLockRecovery.js';
import * as postPublisher from './worker/postPublisher.js';

const app = express();

// Global middleware
app.use(helmet());
app.use(
  cors({
    origin: config.app.frontendUrl,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(requestIdMiddleware);
app.use(requestLogger);

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/bots', botRoutes);
app.use('/api/bots', statsRoutes);
app.use('/api/auth/x', xOAuthRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);

// 404 handler for unknown routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  console.log(`API server listening on port ${config.port}`);

  // Start workers in-process (safe to run multiple instances via SKIP LOCKED)
  jobWorker.start();
  staleLockRecovery.start();
  postPublisher.start();
  console.log('Workers started in-process');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  jobWorker.stop();
  staleLockRecovery.stop();
  postPublisher.stop();
  process.exit(0);
});

export default app;
