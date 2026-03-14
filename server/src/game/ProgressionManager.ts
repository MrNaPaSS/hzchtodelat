import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { GameEndResult, GameResult } from 'shared';

export class ProgressionManager {
  /**
   * Calculates and applies progression changes after a game ends.
   */
  async processGameResults(result: GameEndResult): Promise<void> {
    try {
      await Promise.all(
        result.players.map(async (p) => {
          const outcome = p.result;
          
          // Basic XP logic:
          // Participation: 10 XP
          // Win bonus: +40 XP
          // Draw bonus: +15 XP
          let xpGain = 10;
          if (outcome === GameResult.Win) xpGain += 40;
          else if (outcome === GameResult.Draw) xpGain += 15;

          // Update user in DB
          await this.updateUserStats(p.userId, {
            xpGain,
            ratingChange: p.ratingChange,
            outcome,
          });
        })
      );

      logger.info(`Progression processed for game ${result.gameId}`);
    } catch (err) {
      logger.error(`Failed to process progression for game ${result.gameId}:`, err);
    }
  }

  private async updateUserStats(
    userId: string,
    data: { xpGain: number; ratingChange: number; outcome: GameResult }
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { xp: true, level: true, gamesPlayed: true, gamesWon: true, gamesLost: true, gamesDraw: true, rating: true }
    });

    if (!user) return;

    const updates: any = {
      gamesPlayed: { increment: 1 },
      rating: { increment: data.ratingChange },
      xp: { increment: data.xpGain },
    };

    if (data.outcome === GameResult.Win) updates.gamesWon = { increment: 1 };
    else if (data.outcome === GameResult.Lose) updates.gamesLost = { increment: 1 };
    else if (data.outcome === GameResult.Draw) updates.gamesDraw = { increment: 1 };

    // Robust level up logic: 1000 XP per level
    // @ts-ignore
    const currentXP = (user as any).xp || 0;
    const newXP = currentXP + data.xpGain;
    const newLevel = Math.floor(newXP / 1000) + 1;
    if (newLevel > user.level) {
      updates.level = newLevel;
    }

    await prisma.user.update({
      where: { id: userId },
      data: updates,
    });
  }
}

export const progressionManager = new ProgressionManager();
