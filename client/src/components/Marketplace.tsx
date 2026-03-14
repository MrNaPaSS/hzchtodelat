import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';
import { useAuthStore } from '../stores';
import PageTopBar from './PageTopBar';
import './Marketplace.css';

interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  priceStars: number;
  priceNmnh: number | null;
  assetKey: string;
  previewUrl: string;
}

/* ── Metadata ─────────────────────────────────────────────── */

const CATEGORY_LABELS: Record<string, string> = {
  card_backs:    'Рубашки',
  table_themes:  'Темы',
  avatar_frames: 'Рамки',
  emoji_packs:   'Эмодзи',
  win_effects:   'Эффекты',
};

const CATEGORY_META: Record<string, { icon: string; bg: string; deco: string }> = {
  card_backs:    { icon: '🃏', bg: 'linear-gradient(135deg,rgba(59,130,246,0.18) 0%,rgba(59,130,246,0.04) 100%)', deco: '♠ ♥' },
  table_themes:  { icon: '🎨', bg: 'linear-gradient(135deg,rgba(0,210,106,0.18) 0%,rgba(0,210,106,0.04) 100%)',   deco: '▒ ▓' },
  avatar_frames: { icon: '👑', bg: 'linear-gradient(135deg,rgba(168,85,247,0.18) 0%,rgba(168,85,247,0.04) 100%)', deco: '◈ ◇' },
  emoji_packs:   { icon: '🎭', bg: 'linear-gradient(135deg,rgba(249,115,22,0.18) 0%,rgba(249,115,22,0.04) 100%)',  deco: '✦ ✧' },
  win_effects:   { icon: '✨', bg: 'linear-gradient(135deg,rgba(255,215,0,0.18) 0%,rgba(255,215,0,0.04) 100%)',    deco: '★ ☆' },
};

const RARITY_META: Record<string, {
  label: string; badge: string;
  color: string; bg: string;
  border: string; glow: string;
  shimmer: boolean;
}> = {
  common:    { label: 'Обычный',     badge: 'ОБЩ',    color: '#94A3B8', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.20)', glow: 'none',                              shimmer: false },
  rare:      { label: 'Редкий',      badge: 'РЕД',     color: '#3B82F6', bg: 'rgba(59,130,246,0.13)',  border: 'rgba(59,130,246,0.35)',  glow: '0 0 18px rgba(59,130,246,0.22)',    shimmer: false },
  epic:      { label: 'Эпический',   badge: 'ЭПИ',     color: '#A855F7', bg: 'rgba(168,85,247,0.13)', border: 'rgba(168,85,247,0.38)',  glow: '0 0 20px rgba(168,85,247,0.28)',    shimmer: false },
  legendary: { label: 'Легендарный', badge: 'ЛЕГЕНД',  color: '#FFD700', bg: 'rgba(255,215,0,0.15)',   border: 'rgba(255,215,0,0.45)',   glow: '0 0 24px rgba(255,215,0,0.35)',     shimmer: true  },
};

/* ── Component ────────────────────────────────────────────── */

export default function Marketplace() {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const { refreshProfile } = useAuthStore();

  useEffect(() => {
    api.getMarketplace()
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleBuy = async (item: MarketplaceItem, currency: 'stars' | 'nmnh' = 'stars') => {
    setPurchasing(`${item.id}-${currency}`);
    try {
      await api.buyItem(item.id);
      await refreshProfile();
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    } catch (err: any) {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
      alert(err.message || 'Ошибка покупки');
    } finally {
      setPurchasing(null);
    }
  };

  const categories = ['all', ...new Set(items.map((i) => i.category))];
  const filtered = activeCategory === 'all' ? items : items.filter((i) => i.category === activeCategory);

  return (
    <div className="marketplace page-wrap">

      {/* ── Header ─────────────────────────────── */}
      <PageTopBar title="Магазин" subtitle="Кастомизируй свою игру" />

      {/* ── Category tabs ──────────────────────── */}
      <div className="mkt-tabs">
        {categories.map((cat) => (
          <motion.button
            key={cat}
            className={`mkt-tab ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
            whileTap={{ scale: 0.94 }}
          >
            {cat === 'all' ? '✨ Все' : `${CATEGORY_META[cat]?.icon ?? '🎁'} ${CATEGORY_LABELS[cat] ?? cat}`}
          </motion.button>
        ))}
      </div>

      {/* ── Items ──────────────────────────────── */}
      {loading ? (
        <div className="mkt-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="mkt-skeleton shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mkt-empty">
          <span className="mkt-empty-icon">🛒</span>
          <p>Нет товаров в этой категории</p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="mkt-grid">
            {filtered.map((item) => {
              const rarity = RARITY_META[item.rarity] ?? RARITY_META.common;
              const catMeta = CATEGORY_META[item.category] ?? { icon: '🎁', bg: 'rgba(100,100,100,0.1)', deco: '' };
              const isBuyingStars = purchasing === `${item.id}-stars`;
              const isBuyingNmnh  = purchasing === `${item.id}-nmnh`;
              const isBuying = isBuyingStars || isBuyingNmnh;

              return (
                <motion.div
                  key={item.id}
                  className={`mkt-card mkt-rarity-${item.rarity}`}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  whileHover={{ y: -4, transition: { duration: 0.18 } }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    '--rarity-color':  rarity.color,
                    '--rarity-bg':     rarity.bg,
                    '--rarity-border': rarity.border,
                    '--rarity-glow':   rarity.glow,
                  } as React.CSSProperties}
                >
                  {/* ── Preview ── */}
                  <div className="mkt-preview" style={{ background: catMeta.bg }}>
                    {/* Decorative deco text in background */}
                    {catMeta.deco && (
                      <span className="mkt-preview-deco" aria-hidden="true">
                        {catMeta.deco}
                      </span>
                    )}

                    {/* Shimmer overlay for legendary */}
                    {rarity.shimmer && <div className="mkt-legendary-shimmer" />}

                    {/* Main icon */}
                    <div className="mkt-icon-wrap">
                      <span className="mkt-icon">{catMeta.icon}</span>
                    </div>

                    {/* Rarity badge */}
                    <span className="mkt-rarity-badge">
                      {rarity.badge}
                    </span>
                  </div>

                  {/* ── Info ── */}
                  <div className="mkt-info">
                    <h3 className="mkt-name">{item.name}</h3>
                    <p className="mkt-desc">{item.description}</p>
                  </div>

                  {/* ── Price row ── */}
                  <div className="mkt-price-row">
                    {/* Stars — primary */}
                    <button
                      className="mkt-btn-stars"
                      onClick={() => handleBuy(item, 'stars')}
                      disabled={isBuying}
                    >
                      {isBuyingStars ? (
                        <span className="mkt-btn-spinner" />
                      ) : (
                        <>
                          <span className="mkt-btn-icon">⭐</span>
                          <span className="mkt-btn-price">{item.priceStars}</span>
                        </>
                      )}
                    </button>

                    {/* NMNH — secondary */}
                    {item.priceNmnh != null && (
                      <button
                        className="mkt-btn-nmnh"
                        onClick={() => handleBuy(item, 'nmnh')}
                        disabled={isBuying}
                      >
                        {isBuyingNmnh ? (
                          <span className="mkt-btn-spinner" />
                        ) : (
                          <>
                            <span className="mkt-btn-icon">🪙</span>
                            <span className="mkt-btn-price">{item.priceNmnh}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
