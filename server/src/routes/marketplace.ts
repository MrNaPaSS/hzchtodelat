import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler, NotFoundError, BadRequestError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/marketplace — Get all marketplace items
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const items = await prisma.marketplaceItem.findMany({
      where: { active: true },
      orderBy: [{ category: 'asc' }, { priceStars: 'asc' }],
    });

    res.json({
      success: true,
      data: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        category: item.category,
        rarity: item.rarity,
        priceStars: item.priceStars,
        priceNmnh: item.priceNmnh,
        assetKey: item.assetKey,
        previewUrl: item.previewUrl,
      })),
    });
  }),
);

/**
 * POST /api/marketplace/:id/buy — Purchase an item
 */
router.post(
  '/:id/buy',
  asyncHandler(async (req, res) => {
    const { id: itemId } = req.params;
    const userId = req.user!.id;
    const { currency } = z.object({ currency: z.enum(['stars', 'nmnh']).default('stars') }).parse(req.body);

    const item = await prisma.marketplaceItem.findUnique({ where: { id: itemId } });
    if (!item || !item.active) throw new NotFoundError('Item');

    // Check if already owned
    const existing = await prisma.userInventory.findFirst({
      where: { userId, itemId },
    });
    if (existing) throw new BadRequestError('You already own this item');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User');

    // Determine price and check balance
    if (currency === 'stars') {
      if (user.starsBalance < item.priceStars) {
        throw new BadRequestError('Insufficient Stars balance');
      }
    } else {
      if (!item.priceNmnh || user.nmnhBalance < item.priceNmnh) {
        throw new BadRequestError('Insufficient NMNH balance or item not available for NMNH');
      }
    }

    // Transaction: deduct balance + create inventory + create transaction record
    await prisma.$transaction(async (tx: any) => {
      if (currency === 'stars') {
        await tx.user.update({
          where: { id: userId },
          data: { starsBalance: { decrement: item.priceStars } },
        });
      } else {
        await tx.user.update({
          where: { id: userId },
          data: { nmnhBalance: { decrement: item.priceNmnh! } },
        });
      }

      await tx.userInventory.create({
        data: { userId, itemId, equipped: false },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'purchase',
          amount: currency === 'stars' ? -item.priceStars : -item.priceNmnh!,
          currency: currency === 'stars' ? 'stars' : 'nmnh',
          description: `Purchased ${item.name}`,
          metadata: JSON.stringify({ itemId: item.id, itemName: item.name }),
        },
      });
    });

    res.json({
      success: true,
      data: { message: `${item.name} purchased successfully` },
    });
  }),
);

/**
 * GET /api/inventory — Get user's inventory
 */
router.get(
  '/inventory',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const inventory = await prisma.userInventory.findMany({
      where: { userId },
      include: { item: true },
      orderBy: { acquiredAt: 'desc' },
    });

    res.json({
      success: true,
      data: inventory.map((inv: any) => ({
        id: inv.id,
        itemId: inv.itemId,
        name: inv.item.name,
        description: inv.item.description,
        category: inv.item.category,
        rarity: inv.item.rarity,
        assetKey: inv.item.assetKey,
        previewUrl: inv.item.previewUrl,
        equipped: inv.equipped,
        acquiredAt: inv.acquiredAt.toISOString(),
      })),
    });
  }),
);

/**
 * POST /api/inventory/:id/equip — Equip/unequip an inventory item
 */
router.post(
  '/inventory/:id/equip',
  asyncHandler(async (req, res) => {
    const { id: inventoryId } = req.params;
    const userId = req.user!.id;

    const inventoryItem = await prisma.userInventory.findFirst({
      where: { id: inventoryId, userId },
      include: { item: true },
    });

    if (!inventoryItem) throw new NotFoundError('Inventory item');

    // Unequip all items in the same category first
    await prisma.userInventory.updateMany({
      where: {
        userId,
        equipped: true,
        item: { category: inventoryItem.item.category },
      },
      data: { equipped: false },
    });

    // Toggle equip
    const newEquipped = !inventoryItem.equipped;
    await prisma.userInventory.update({
      where: { id: inventoryId },
      data: { equipped: newEquipped },
    });

    res.json({
      success: true,
      data: { equipped: newEquipped },
    });
  }),
);

export default router;
