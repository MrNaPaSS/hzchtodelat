import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { Currency, TransactionType } from 'shared';

export class EconomyManager {
  /**
   * Deducts a stake from a user's balance.
   */
  async deductStake(userId: string, amount: number, gameId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { nmnhBalance: true },
      });

      if (!user || user.nmnhBalance < amount) {
        return false;
      }

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { nmnhBalance: { decrement: amount } },
        });

        await tx.transaction.create({
          data: {
            userId,
            type: 'bet',
            currency: 'nmnh',
            amount: -amount,
            status: 'completed',
            description: `Stake for game ${gameId}`,
            referenceId: gameId,
            metadata: JSON.stringify({ gameId }),
          },
        });
      });

      logger.info(`Stake deducted: user=${userId}, amount=${amount}, game=${gameId}`);
      return true;
    } catch (err) {
      logger.error(`Failed to deduct stake for user ${userId}:`, err);
      return false;
    }
  }

  /**
   * Adds winnings to a user's balance.
   */
  async addWinnings(userId: string, amount: number, gameId: string, isStars = false): Promise<void> {
    try {
      const currency: 'stars' | 'nmnh' = isStars ? 'stars' : 'nmnh';
      
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: isStars 
            ? { starsBalance: { increment: amount }, totalStarsWon: { increment: amount } }
            : { nmnhBalance: { increment: amount }, totalNmnhEarned: { increment: amount } },
        });

        await tx.transaction.create({
          data: {
            userId,
            type: 'win',
            currency,
            amount,
            status: 'completed',
            description: `Winnings from game ${gameId}`,
            referenceId: gameId,
            metadata: JSON.stringify({ gameId }),
          },
        });
      });

      logger.info(`Winnings added: user=${userId}, amount=${amount} ${currency}, game=${gameId}`);
    } catch (err) {
      logger.error(`Failed to add winnings for user ${userId}:`, err);
    }
  }

  /**
   * Refunds a stake (e.g., if a game is cancelled or ends in a draw).
   */
  async refundStake(userId: string, amount: number, gameId: string): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { nmnhBalance: { increment: amount } },
        });

        await tx.transaction.create({
          data: {
            userId,
            type: 'deposit', // Or a new 'refund' type if added to shared
            currency: 'nmnh',
            amount: amount,
            status: 'completed',
            description: `Refund for game ${gameId}`,
            referenceId: gameId,
            metadata: JSON.stringify({ gameId, isRefund: true }),
          },
        });
      });

      logger.info(`Stake refunded: user=${userId}, amount=${amount}, game=${gameId}`);
    } catch (err) {
      logger.error(`Failed to refund stake for user ${userId}:`, err);
    }
  }
}

export const economyManager = new EconomyManager();
