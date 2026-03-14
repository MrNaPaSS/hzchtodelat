import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler, NotFoundError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/users/me — Get current user profile with stats
 */
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        inventory: {
          where: { equipped: true },
          include: { item: true },
        },
      },
    });

    if (!user) throw new NotFoundError('User');

    const winRate =
      user.gamesPlayed > 0
        ? Math.round((user.gamesWon / user.gamesPlayed) * 100)
        : 0;

    res.json({
      success: true,
      data: {
        id: user.id,
        telegramId: Number(user.telegramId),
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        starsBalance: user.starsBalance,
        nmnhBalance: user.nmnhBalance,
        rating: user.rating,
        // @ts-ignore
        xp: (user as any).xp || 0,
        level: user.level,
        vipUntil: user.vipUntil?.toISOString() || null,
        referralCode: user.referralCode,
        createdAt: user.createdAt.toISOString(),
        stats: {
          gamesPlayed: user.gamesPlayed,
          gamesWon: user.gamesWon,
          gamesLost: user.gamesLost,
          gamesDraw: user.gamesDraw,
          winRate,
          longestStreak: user.longestStreak,
          currentStreak: user.currentStreak,
          totalStarsWon: user.totalStarsWon,
          totalNmnhEarned: user.totalNmnhEarned,
          favoriteMode: 'podkidnoy',
        },
        equippedItems: {
          cardBack: user.inventory.find((i) => i.item.category === 'card_backs')?.item.assetKey || null,
          tableTheme: user.inventory.find((i) => i.item.category === 'table_themes')?.item.assetKey || null,
          avatarFrame: user.inventory.find((i) => i.item.category === 'avatar_frames')?.item.assetKey || null,
          emojiPack: user.inventory.find((i) => i.item.category === 'emoji_packs')?.item.assetKey || null,
          winEffect: user.inventory.find((i) => i.item.category === 'win_effects')?.item.assetKey || null,
        },
      },
    });
  }),
);

/**
 * GET /api/users/:id — Get another user's public profile
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!user) throw new NotFoundError('User');

    const winRate =
      user.gamesPlayed > 0
        ? Math.round((user.gamesWon / user.gamesPlayed) * 100)
        : 0;

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        avatarUrl: user.avatarUrl,
        rating: user.rating,
        level: user.level,
        stats: {
          gamesPlayed: user.gamesPlayed,
          gamesWon: user.gamesWon,
          winRate,
        },
      },
    });
  }),
);

/**
 * GET /api/leaderboard — Global leaderboard
 */
router.get(
  '/leaderboard',
  asyncHandler(async (req, res) => {
    const period = (req.query.period as string) || 'all';
    const limit = Math.min(parseInt((req.query.limit as string) || '100', 10), 100);

    const users = await prisma.user.findMany({
      orderBy: { rating: 'desc' },
      take: limit,
      select: {
        id: true,
        username: true,
        firstName: true,
        avatarUrl: true,
        rating: true,
        gamesWon: true,
      },
    });

    res.json({
      success: true,
      data: users.map((u, i) => ({
        rank: i + 1,
        userId: u.id,
        username: u.username,
        firstName: u.firstName,
        avatarUrl: u.avatarUrl,
        rating: u.rating,
        gamesWon: u.gamesWon,
      })),
    });
  }),
);

export default router;
