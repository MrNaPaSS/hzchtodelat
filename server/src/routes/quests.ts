import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler, NotFoundError, BadRequestError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/quests — Get all quests and user progress
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const quests = await prisma.quest.findMany({
      where: { active: true },
      orderBy: [{ type: 'asc' }, { rewardNmnh: 'desc' }],
    });

    // For a real implementation, you'd track progress in a separate UserQuestProgress table
    // For MVP, we return quests with default progress
    res.json({
      success: true,
      data: quests.map((q: any) => ({
        id: q.id,
        title: q.title,
        description: q.description,
        type: q.type,
        targetValue: q.targetValue,
        rewardNmnh: q.rewardNmnh,
        rewardStars: q.rewardStars,
        icon: q.icon,
        // MVP: progress would be tracked via game events
        currentProgress: 0,
        completed: false,
        claimed: false,
      })),
    });
  }),
);

/**
 * POST /api/quests/:id/claim — Claim a completed quest reward
 */
router.post(
  '/:id/claim',
  asyncHandler(async (req, res) => {
    const { id: questId } = req.params;
    const userId = req.user!.id;

    const quest = await prisma.quest.findUnique({ where: { id: questId } });
    if (!quest || !quest.active) throw new NotFoundError('Quest');

    // In production, verify completion via UserQuestProgress table
    // For MVP, we accept the claim and grant rewards
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');

    await prisma.$transaction(async (tx: any) => {
      const updateData: any = {};
      if (quest.rewardNmnh > 0) {
        updateData.nmnhBalance = { increment: quest.rewardNmnh };
        updateData.totalNmnhEarned = { increment: quest.rewardNmnh };
      }
      if (quest.rewardStars && quest.rewardStars > 0) {
        updateData.starsBalance = { increment: quest.rewardStars };
        updateData.totalStarsWon = { increment: quest.rewardStars };
      }

      await tx.user.update({
        where: { id: userId },
        data: updateData,
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'quest_reward',
          amount: quest.rewardNmnh,
          currency: 'nmnh',
          description: `Quest completed: ${quest.title}`,
          metadata: JSON.stringify({ questId: quest.id }),
        },
      });
    });

    res.json({
      success: true,
      data: {
        rewardNmnh: quest.rewardNmnh,
        rewardStars: quest.rewardStars || 0,
      },
    });
  }),
);

export default router;
