import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { config } from './config/index.js';
import { logger } from './lib/logger.js';
import { connectDatabase, disconnectDatabase } from './lib/prisma.js';
import { connectRedis, disconnectRedis } from './lib/redis.js';
import { errorHandler } from './middleware/errorHandler.js';
import { setupSocketIO } from './socket/index.js';
import authRouter from './routes/auth.js';
import gamesRouter from './routes/games.js';
import usersRouter from './routes/users.js';
import marketplaceRouter from './routes/marketplace.js';
import questsRouter from './routes/quests.js';
import walletRouter from './routes/wallet.js';
import webhookRouter from './routes/webhook.js';

async function bootstrap(): Promise<void> {
  // ─── Database ──────────────────────────────────────────
  await connectDatabase();

  // ─── Redis (optional) ──────────────────────────────────
  await connectRedis();

  // ─── Express App ───────────────────────────────────────
  const app = express();
  const httpServer = createServer(app);

  // Security
  app.use(helmet());
  app.use(
    cors({
      origin: config.NODE_ENV === 'development' ? true : config.CLIENT_URL,
      credentials: true,
    }),
  );

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: { code: 'RATE_LIMIT', message: 'Too many requests, please try again later' },
      },
    }),
  );

  // Body parsing
  app.use(express.json({ limit: '1mb' }));

  // Logging
  app.use(
    morgan('short', {
      stream: { write: (msg: string) => logger.http(msg.trim()) },
    }),
  );

  // ─── Routes ────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/games', gamesRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/marketplace', marketplaceRouter);
  app.use('/api/quests', questsRouter);
  app.use('/api/wallet', walletRouter);
  app.use('/api/webhook', webhookRouter);

  // ─── Error Handler ────────────────────────────────────
  app.use(errorHandler);

  // ─── Socket.IO ────────────────────────────────────────
  setupSocketIO(httpServer);

  // ─── Start Server ─────────────────────────────────────
  httpServer.listen(config.PORT, () => {
    logger.info(`🚀 Server running on port ${config.PORT} (${config.NODE_ENV})`);
  });

  // ─── Graceful Shutdown ────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    httpServer.close();
    await disconnectRedis();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
