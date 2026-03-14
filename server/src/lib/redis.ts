import Redis from 'ioredis';
import { config } from '../config/index.js';
import { logger } from './logger.js';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  return redis;
}

export async function connectRedis(): Promise<void> {
  try {
    redis = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) {
          logger.warn('⚠️ Redis connection failed after 3 attempts, continuing without Redis');
          return null; // stop retrying
        }
        return Math.min(times * 200, 3000);
      },
    });

    redis.on('connect', () => logger.info('✅ Redis connected'));
    redis.on('error', (err) => {
      logger.warn('⚠️ Redis error (non-fatal):', err.message);
    });

    await redis.connect();
  } catch (error) {
    logger.warn('⚠️ Redis not available — running without cache. This is fine for development.');
    redis = null;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.disconnect();
    logger.info('Redis disconnected');
  }
}
