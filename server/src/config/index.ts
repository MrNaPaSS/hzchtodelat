import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  BOT_TOKEN: z.string(),

  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('7d'),

  COMMISSION_RATE: z.coerce.number().min(0).max(1).default(0.05),
  NMNH_EXCHANGE_RATE: z.coerce.number().default(100),
  MIN_EXCHANGE_NMNH: z.coerce.number().default(500),
  MAX_DAILY_WITHDRAWAL_STARS: z.coerce.number().default(1000),
  EXCHANGE_COOLDOWN_HOURS: z.coerce.number().default(24),
  REFERRAL_REWARD_NMNH: z.coerce.number().default(500),
  STARS_TO_NMNH_RATE: z.coerce.number().default(10), // 1 Star = 10 NMNH

  CLIENT_URL: z.string().default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
