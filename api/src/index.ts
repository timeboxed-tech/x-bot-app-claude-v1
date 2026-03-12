import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes.js';
import xOAuthRoutes from './routes/xOAuthRoutes.js';
import botRoutes from './routes/botRoutes.js';

const app = express();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.APP_URL || 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth/x', xOAuthRoutes);
app.use('/api/bots', botRoutes);

// Start server
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
});

export default app;
