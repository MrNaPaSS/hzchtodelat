import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler, BadRequestError, NotFoundError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import { bot } from '../lib/telegram.js';

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/wallet — Get wallet overview
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new NotFoundError('User');

    res.json({
      success: true,
      data: {
        starsBalance: user.starsBalance,
        nmnhBalance: user.nmnhBalance,
        maxExchangeable: Math.max(0, user.nmnhBalance - 1000),
        exchangeRate: config.NMNH_EXCHANGE_RATE,
        minExchange: 100,
        minWithdraw: 50,
      },
    });
  }),
);

/**
 * GET /api/wallet/transactions — Get transaction history
 */
router.get(
  '/transactions',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 100);
    const offset = parseInt((req.query.offset as string) || '0', 10);

    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.transaction.count({ where: { userId } });

    res.json({
      success: true,
      data: {
        transactions: transactions.map((tx: any) => ({
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          currency: tx.currency,
          description: tx.description,
          status: tx.status,
          createdAt: tx.createdAt.toISOString(),
        })),
        total,
        hasMore: offset + limit < total,
      },
    });
  }),
);

/**
 * POST /api/wallet/exchange — Exchange NMNH tokens for Stars
 */
const exchangeSchema = z.object({
  amount: z.number().int().min(100, 'Minimum exchange is 100 NMNH'),
});

router.post(
  '/exchange',
  asyncHandler(async (req, res) => {
    const { amount } = exchangeSchema.parse(req.body);
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');

    const maxExchangeable = Math.max(0, user.nmnhBalance - 1000);
    if (amount > maxExchangeable) {
      throw new BadRequestError(`Недостаточно доступных монет. Стартовые 1000 NMNH вывести нельзя.`);
    }

    const starsReceived = Math.floor(amount / config.NMNH_EXCHANGE_RATE);
    if (starsReceived < 1) {
      throw new BadRequestError(`Need at least ${config.NMNH_EXCHANGE_RATE} NMNH for 1 Star`);
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          nmnhBalance: { decrement: amount },
          starsBalance: { increment: starsReceived },
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'exchange',
          amount: -amount,
          currency: 'nmnh',
          description: `Exchanged ${amount} NMNH → ${starsReceived} Stars`,
          metadata: JSON.stringify({ starsReceived, exchangeRate: config.NMNH_EXCHANGE_RATE }),
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'exchange',
          amount: starsReceived,
          currency: 'stars',
          description: `Received ${starsReceived} Stars from NMNH exchange`,
          metadata: JSON.stringify({ nmnhSpent: amount, exchangeRate: config.NMNH_EXCHANGE_RATE }),
        },
      });
    });

    logger.info(`Exchange: user=${userId} ${amount} NMNH → ${starsReceived} Stars`);

    res.json({
      success: true,
      data: {
        nmnhSpent: amount,
        starsReceived,
        newNmnhBalance: user.nmnhBalance - amount,
        newStarsBalance: user.starsBalance + starsReceived,
      },
    });
  }),
);

/**
 * POST /api/wallet/buy-nmnh — Buy NMNH tokens using Stars balance
 */
const buyNmnhSchema = z.object({
  amountNmnh: z.number().int().min(100),
});

router.post(
  '/buy-nmnh',
  asyncHandler(async (req, res) => {
    const { amountNmnh } = buyNmnhSchema.parse(req.body);
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');

    const starsRequired = Math.ceil(amountNmnh / config.STARS_TO_NMNH_RATE);
    
    if (user.starsBalance < starsRequired) {
      throw new BadRequestError(`Insufficient Stars balance. Need ${starsRequired} Stars for ${amountNmnh} NMNH.`);
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          starsBalance: { decrement: starsRequired },
          nmnhBalance: { increment: amountNmnh }
        }
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'purchase_tokens',
          amount: amountNmnh,
          currency: 'nmnh',
          description: `Purchased ${amountNmnh} NMNH for ${starsRequired} Stars`,
          metadata: JSON.stringify({ starsSpent: starsRequired })
        }
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'purchase_tokens',
          amount: -starsRequired,
          currency: 'stars',
          description: `Spent ${starsRequired} Stars for NMNH tokens`,
          metadata: JSON.stringify({ nmnhBought: amountNmnh })
        }
      });
    });

    res.json({
      success: true,
      data: {
        nmnhBought: amountNmnh,
        starsSpent: starsRequired,
        newStarsBalance: user.starsBalance - starsRequired,
        newNmnhBalance: user.nmnhBalance + amountNmnh
      }
    });
  }),
);

/**
 * POST /api/wallet/deposit — Create a Stars deposit (via Telegram invoice)
 */
const depositSchema = z.object({
  amount: z.number().int().min(1).max(100000),
});

router.post(
  '/deposit',
  asyncHandler(async (req, res) => {
    const { amount } = depositSchema.parse(req.body);
    const userId = req.user!.id;

    // In production, this would create a Telegram Stars invoice via Bot API
    // For MVP, we create a pending transaction
    const tx = await prisma.transaction.create({
      data: {
        userId,
        type: 'deposit',
        amount,
        currency: 'stars',
        description: `Deposit ${amount} Stars`,
        status: 'pending',
        metadata: '{}',
      },
    });

    // Create Telegram Stars invoice URL via Bot API
    const invoiceUrl = await bot.createStarsInvoiceLink(
      `Пополнение ${amount} ⭐`,
      `Пополнение баланса звезд в игре Дурак`,
      JSON.stringify({ type: 'stars_deposit', userId, amount }),
      amount
    );

    if (!invoiceUrl) {
      throw new BadRequestError('Failed to generate Telegram invoice');
    }

    res.json({
      success: true,
      data: {
        transactionId: tx.id,
        amount,
        invoiceUrl,
        message: 'Invoice created. Complete payment via Telegram.',
      },
    });
  }),
);

/**
 * POST /api/wallet/withdraw — Request withdrawal of Stars
 */
const withdrawSchema = z.object({
  amount: z.number().int().min(50, 'Minimum withdrawal is 50 Stars'),
});

router.post(
  '/withdraw',
  asyncHandler(async (req, res) => {
    const { amount } = withdrawSchema.parse(req.body);
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');

    if (user.starsBalance < amount) {
      throw new BadRequestError('Insufficient Stars balance');
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id: userId },
        data: { starsBalance: { decrement: amount } },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'withdrawal',
          amount: -amount,
          currency: 'stars',
          description: `Withdrawal of ${amount} Stars`,
          status: 'pending',
          metadata: '{}',
        },
      });
    });

    logger.info(`Withdrawal request: user=${userId} amount=${amount} Stars`);

    res.json({
      success: true,
      data: {
        amount,
        message: 'Withdrawal request submitted. Processing may take up to 24 hours.',
      },
    });
  }),
);

export default router;
