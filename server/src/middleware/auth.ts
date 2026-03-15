import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export interface AuthUser {
  id: string;
  telegramId: number;
  username: string;
  firstName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Validates Telegram Mini App initData using HMAC-SHA256.
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateTelegramInitData(initData: string): Record<string, string> | null {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;

    params.delete('hash');
    const entries = Array.from(params.entries());
    entries.sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(config.BOT_TOKEN)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) return null;

    // Check auth_date is not too old (5 minutes)
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    const drift = now - authDate;
    
    if (Math.abs(drift) > 86400) { // If drift is more than a day, something is very wrong
        logger.error(`Extreme clock drift detected: ${drift}s`);
    }

    if (drift > 600) { // Increased window to 10 minutes for safety
        logger.warn(`auth_date is too old: ${drift}s ago`);
        return null;
    }

    return Object.fromEntries(entries);
  } catch {
    return null;
  }
}

/**
 * Creates a JWT token for authenticated users.
 */
export function createToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
    },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN } as jwt.SignOptions,
  );
}

/**
 * Verifies a JWT token and returns the user payload.
 */
export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, config.JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

/**
 * Express middleware that authenticates requests via Bearer token.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing authorization header' },
    });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
    });
    return;
  }

  // Verify user still exists
  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, telegramId: true, username: true, firstName: true },
  });

  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User no longer exists' },
    });
    return;
  }

  req.user = {
    id: user.id,
    telegramId: Number(user.telegramId),
    username: user.username,
    firstName: user.firstName,
  };

  next();
}
