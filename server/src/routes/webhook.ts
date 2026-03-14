import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { bot } from '../lib/telegram.js';

const router = Router();

/**
 * POST /api/webhook/telegram
 * Handles Telegram Bot API updates (webhooks)
 */
router.post(
  '/telegram',
  async (req, res) => {
    const update = req.body;

    // 1. Handle Pre-Checkout Query (Stars)
    if (update.pre_checkout_query) {
      const { id } = update.pre_checkout_query;
      // You can add logic to verify inventory/availability here
      await (bot as any).callApi('answerPreCheckoutQuery', {
        pre_checkout_query_id: id,
        ok: true,
      });
      return res.sendStatus(200);
    }

    // 2. Handle Successful Payment
    if (update.message?.successful_payment) {
      const payment = update.message.successful_payment;
      const payload = JSON.parse(payment.invoice_payload);

      if (payload.type === 'stars_deposit') {
        const { userId, amount } = payload;
        
        try {
          await prisma.$transaction(async (tx) => {
            // Find transaction
            const dbTx = await tx.transaction.findFirst({
              where: { userId, amount, status: 'pending', type: 'deposit' },
              orderBy: { createdAt: 'desc' }
            });

            if (dbTx) {
              await tx.transaction.update({
                where: { id: dbTx.id },
                data: { status: 'completed', metadata: JSON.stringify({ telegram_payment_id: payment.telegram_payment_charge_id }) }
              });

              await tx.user.update({
                where: { id: userId },
                data: { starsBalance: { increment: amount } }
              });

              logger.info(`Stars deposit confirmed via webhook: user=${userId} amount=${amount}`);
            }
          });
        } catch (err) {
          logger.error(`Error processing stars deposit webhook:`, err);
        }
      }
      return res.sendStatus(200);
    }

    res.sendStatus(200);
  }
);

export default router;
