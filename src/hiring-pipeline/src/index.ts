import express from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { applyRouter } from './routes/apply.js';
import { webhookRouter } from './routes/webhook.js';

const app = express();

// Base path for the service (matches load balancer path rule)
const BASE_PATH = '/hiring-pipeline';

// Middleware
app.use(express.json());

// Rate limiting: 10 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(`${BASE_PATH}/apply`, limiter);

// Health check (both root and base path for flexibility)
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'hiring-pipeline',
    timestamp: new Date().toISOString(),
  });
});

app.get(`${BASE_PATH}/health`, (_req, res) => {
  res.json({
    status: 'ok',
    service: 'hiring-pipeline',
    timestamp: new Date().toISOString(),
  });
});

// Routes (mounted under base path)
app.use(`${BASE_PATH}/apply`, applyRouter);
app.use(`${BASE_PATH}/webhook`, webhookRouter);

// Also mount at root for local development
app.use('/apply', applyRouter);
app.use('/webhook', webhookRouter);

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
);

// Connect to MongoDB and start server
async function start() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    app.listen(env.PORT, () => {
      console.log(`🚀 Server running on port ${env.PORT}`);
      console.log(`📍 Health check: http://localhost:${env.PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();
