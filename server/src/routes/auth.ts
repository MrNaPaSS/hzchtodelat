import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validateTelegramInitData, createToken } from '../middleware/auth.js';
import { asyncHandler, BadRequestError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import { v4 as uuid } from 'uuid';
import { config } from '../config/index.js';

const router = Router();

const authSchema = z.object({
  initData: z.string().min(1),
});

/**
 * POST /api/auth/telegram
 * Authenticates a user via Telegram Mini App initData.
 * Creates the user if they don't exist yet.
 */
router.post(
  '/telegram',
  asyncHandler(async (req, res) => {
    const { initData } = authSchema.parse(req.body);

    let telegramId: number;
    let userData: any;

    const isMockAllowed = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true';
    logger.debug(`Auth attempt: isMockAllowed=${isMockAllowed}, initDataPrefix=${initData.substring(0, 20)}`);

    if (isMockAllowed && initData === 'mock_init_data') {
      telegramId = 123456789;
      userData = {
        id: 123456789,
        username: 'dev_player',
        first_name: 'Разработчик',
        last_name: 'Тест',
        photo_url: '',
      };
    } else {
      const validated = validateTelegramInitData(initData);
      if (!validated) {
        logger.warn(`Invalid Telegram initData received. Prefix: ${initData.substring(0, 20)}`);
        throw new BadRequestError('Invalid Telegram initData');
      }

      userData = JSON.parse(validated['user'] || '{}');
      telegramId = userData.id;
      const startParam = validated['start_param'];

      if (!telegramId) {
        throw new BadRequestError('Missing Telegram user ID');
      }

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { telegramId: BigInt(telegramId) }
      });

      if (!existingUser && startParam) {
        // Find referrer by their referral code
        const referrer = await prisma.user.findUnique({
          where: { referralCode: startParam }
        });

        if (referrer) {
          // Grant reward to referrer
          await prisma.$transaction([
            prisma.user.update({
              where: { id: referrer.id },
              data: { 
                nmnhBalance: { increment: config.REFERRAL_REWARD_NMNH },
                totalNmnhEarned: { increment: config.REFERRAL_REWARD_NMNH }
              }
            }),
            prisma.transaction.create({
              data: {
                userId: referrer.id,
                type: 'referral_bonus',
                currency: 'nmnh',
                amount: config.REFERRAL_REWARD_NMNH,
                description: `Referral bonus for inviting a user`,
                metadata: JSON.stringify({ invitedTelegramId: telegramId })
              }
            })
          ]);
          logger.info(`Referral reward granted to ${referrer.id} for user ${telegramId}`);
        }
      }
    }

    // Upsert user
    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(telegramId) },
      update: {
        username: userData.username || '',
        firstName: userData.first_name || 'Player',
        lastName: userData.last_name || null,
        avatarUrl: userData.photo_url || '',
      },
      create: {
        telegramId: BigInt(telegramId),
        username: userData.username || '',
        firstName: userData.first_name || 'Player',
        lastName: userData.last_name || null,
        avatarUrl: userData.photo_url || '',
        referralCode: uuid().slice(0, 8).toUpperCase(),
        starsBalance: 0,
        nmnhBalance: 1000,
        totalNmnhEarned: 1000,
      },
    });

    const token = createToken({
      id: user.id,
      telegramId: Number(user.telegramId),
      username: user.username,
      firstName: user.firstName,
    });

    logger.info(`User authenticated: ${user.id} (@${user.username})`);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          telegramId: Number(user.telegramId),
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          avatarUrl: user.avatarUrl,
          starsBalance: user.starsBalance,
          nmnhBalance: user.nmnhBalance,
          rating: user.rating,
          level: user.level,
          vipUntil: user.vipUntil?.toISOString() || null,
          referralCode: user.referralCode,
          createdAt: user.createdAt.toISOString(),
        },
      },
    });
  }),
);

export default router;
