import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database...');

  // ─── Marketplace Items ───────────────────────────────────

  const items = [
    // Card Backs
    { name: 'Золотой узор', description: 'Элегантная золотая рубашка карт', category: 'card_backs', rarity: 'rare', priceStars: 50, priceNmnh: 500, assetKey: 'card_back_gold', previewUrl: '' },
    { name: 'Неон', description: 'Светящаяся неоновая рубашка', category: 'card_backs', rarity: 'epic', priceStars: 100, priceNmnh: 1000, assetKey: 'card_back_neon', previewUrl: '' },
    { name: 'Огненный', description: 'Пламенный дизайн', category: 'card_backs', rarity: 'legendary', priceStars: 250, priceNmnh: null, assetKey: 'card_back_fire', previewUrl: '' },
    { name: 'Ледяной', description: 'Холодный как лёд', category: 'card_backs', rarity: 'rare', priceStars: 50, priceNmnh: 500, assetKey: 'card_back_ice', previewUrl: '' },
    { name: 'Космос', description: 'Вселенная на рубашке', category: 'card_backs', rarity: 'epic', priceStars: 120, priceNmnh: 1200, assetKey: 'card_back_space', previewUrl: '' },

    // Table Themes
    { name: 'Казино Ройал', description: 'Роскошный стол казино', category: 'table_themes', rarity: 'epic', priceStars: 150, priceNmnh: 1500, assetKey: 'table_casino', previewUrl: '' },
    { name: 'Ночной город', description: 'Городские огни', category: 'table_themes', rarity: 'rare', priceStars: 75, priceNmnh: 750, assetKey: 'table_city', previewUrl: '' },
    { name: 'Арктика', description: 'Ледяная арена', category: 'table_themes', rarity: 'rare', priceStars: 60, priceNmnh: 600, assetKey: 'table_arctic', previewUrl: '' },

    // Avatar Frames
    { name: 'Золотая рамка', description: 'Покажи свой статус', category: 'avatar_frames', rarity: 'rare', priceStars: 40, priceNmnh: 400, assetKey: 'frame_gold', previewUrl: '' },
    { name: 'Огненная рамка', description: 'Пылающий аватар', category: 'avatar_frames', rarity: 'epic', priceStars: 80, priceNmnh: 800, assetKey: 'frame_fire', previewUrl: '' },
    { name: 'Легенда', description: 'Рамка для настоящих про', category: 'avatar_frames', rarity: 'legendary', priceStars: 300, priceNmnh: null, assetKey: 'frame_legend', previewUrl: '' },

    // Emoji Packs
    { name: 'Троллинг', description: '😏 Набор для троллинга', category: 'emoji_packs', rarity: 'common', priceStars: 20, priceNmnh: 200, assetKey: 'emoji_troll', previewUrl: '' },
    { name: 'Покер Фейс', description: '😐 Непробиваемое лицо', category: 'emoji_packs', rarity: 'rare', priceStars: 40, priceNmnh: 400, assetKey: 'emoji_poker', previewUrl: '' },

    // Win Effects
    { name: 'Фейерверк', description: '🎆 Салют при победе', category: 'win_effects', rarity: 'rare', priceStars: 60, priceNmnh: 600, assetKey: 'win_fireworks', previewUrl: '' },
    { name: 'Золотой дождь', description: '💰 Монеты летят с неба', category: 'win_effects', rarity: 'epic', priceStars: 120, priceNmnh: 1200, assetKey: 'win_gold_rain', previewUrl: '' },
    { name: 'Атомный взрыв', description: '💥 Эпичный взрыв при победе', category: 'win_effects', rarity: 'legendary', priceStars: 400, priceNmnh: null, assetKey: 'win_explosion', previewUrl: '' },
  ];

  for (const item of items) {
    await prisma.marketplaceItem.upsert({
      where: { assetKey: item.assetKey },
      update: item,
      create: item,
    });
  }

  console.log(`  ✅ ${items.length} marketplace items seeded`);

  // ─── Quests ──────────────────────────────────────────────

  const quests = [
    // Daily
    { title: 'Сыграть 3 игры', description: 'Сыграйте 3 игры в любом режиме', type: 'daily', targetValue: 3, rewardNmnh: 50, rewardStars: 0, icon: '🎮' },
    { title: 'Выиграть 1 игру', description: 'Одержите 1 победу', type: 'daily', targetValue: 1, rewardNmnh: 30, rewardStars: 0, icon: '🏆' },
    { title: 'Отбить 10 карт', description: 'Успешно отбейте 10 карт в одной игре', type: 'daily', targetValue: 10, rewardNmnh: 40, rewardStars: 0, icon: '🛡️' },

    // Weekly
    { title: 'Сыграть 20 игр', description: 'Сыграйте 20 игр за неделю', type: 'weekly', targetValue: 20, rewardNmnh: 200, rewardStars: 10, icon: '🎮' },
    { title: 'Выиграть 10 игр', description: 'Одержите 10 побед за неделю', type: 'weekly', targetValue: 10, rewardNmnh: 300, rewardStars: 20, icon: '🏆' },
    { title: '3 победы подряд', description: 'Выиграйте 3 игры подряд', type: 'weekly', targetValue: 3, rewardNmnh: 150, rewardStars: 5, icon: '🔥' },

    // Achievements
    { title: 'Первая победа', description: 'Выиграйте свою первую игру', type: 'achievement', targetValue: 1, rewardNmnh: 100, rewardStars: 0, icon: '⭐' },
    { title: 'Ветеран', description: 'Сыграйте 100 игр', type: 'achievement', targetValue: 100, rewardNmnh: 500, rewardStars: 50, icon: '🎖️' },
    { title: 'Мастер', description: 'Достигните рейтинга 2000', type: 'achievement', targetValue: 2000, rewardNmnh: 1000, rewardStars: 100, icon: '👑' },
    { title: 'Коллекционер', description: 'Купите 10 предметов в магазине', type: 'achievement', targetValue: 10, rewardNmnh: 300, rewardStars: 30, icon: '🛒' },
  ];

  for (const quest of quests) {
    await prisma.quest.upsert({
      where: { title: quest.title },
      update: quest,
      create: quest,
    });
  }

  console.log(`  ✅ ${quests.length} quests seeded`);

  console.log('🌱 Seeding complete!');
  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error('Seeding failed:', e);
  prisma.$disconnect();
  process.exit(1);
});
