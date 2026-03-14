import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore, useAuthStore, useUIStore } from '../stores';
import './GameResults.css';

const haptic = (type: 'success' | 'error' | 'warning') => {
  try { (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred(type); } catch {/* */}
};

const CONFETTI_PIECES = ['♠', '♥', '♦', '♣', '⭐', '🃏', '✨', '🎴'];

export default function GameResults() {
  const { gameResult, resetGame } = useGameStore();
  const { user }    = useAuthStore();
  const { setScreen } = useUIStore();

  if (!gameResult || !user) { resetGame(); return null; }

  const isWinner = gameResult.winnerId === user.id;
  const isDraw   = gameResult.isDraw;
  const isLoser  = !isWinner && !isDraw;

  const myResult    = gameResult.players.find((p) => p.userId === user.id);
  const payout      = myResult?.starsPayout   ?? 0;
  const nmnh        = myResult?.nmnhEarned    ?? 0;
  const ratingDelta = myResult?.ratingChange  ?? 0;
  const newRating   = myResult?.newRating     ?? 0;

  useEffect(() => {
    if (isWinner) haptic('success');
    else if (isLoser) haptic('error');
    else haptic('warning');
  }, []);

  const handleLobby = () => { resetGame(); setScreen('lobby'); };
  const resultKey   = isWinner ? 'win' : isDraw ? 'draw' : 'lose';

  const titles: Record<string, string> = {
    win:  '🎉 Победа!',
    draw: '🤝 Ничья',
    lose: '☠️ Дурак!',
  };

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12 } },
  };
  const itemVariants = {
    hidden:  { opacity: 0, y: 20, scale: 0.9 },
    visible: { opacity: 1, y: 0,  scale: 1,
      transition: { type: 'spring', stiffness: 480, damping: 30 } },
  };

  return (
    <div className={`results-screen results-${resultKey}`}>

      {/* ── Confetti (win only) ─────────────── */}
      {isWinner && (
        <div className="results-confetti" aria-hidden="true">
          {Array.from({ length: 20 }, (_, i) => (
            <span
              key={i}
              className="confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${(Math.random() * 2).toFixed(2)}s`,
                animationDuration: `${(2.5 + Math.random() * 2).toFixed(2)}s`,
                fontSize: `${0.9 + Math.random() * 1.2}rem`,
              }}
            >
              {CONFETTI_PIECES[i % CONFETTI_PIECES.length]}
            </span>
          ))}
        </div>
      )}

      {/* ── Card ───────────────────────────── */}
      <motion.div
        className="results-card glass"
        initial={{ opacity: 0, scale: 0.82, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      >
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="results-inner"
        >
          {/* Title */}
          <motion.h1 className={`results-title results-title-${resultKey}`} variants={itemVariants}>
            {titles[resultKey]}
          </motion.h1>

          {isLoser && (
            <motion.div className="durak-badge" variants={itemVariants}>
              ВЫ ДУРАК 🃏
            </motion.div>
          )}

          {/* Rewards */}
          {(payout !== 0 || nmnh > 0) && (
            <motion.div className="results-rewards" variants={itemVariants}>
              {payout !== 0 && (
                <div className="reward-pill reward-stars">
                  <span className="reward-delta">{payout > 0 ? '+' : ''}{payout}</span>
                  <span>⭐ Stars</span>
                </div>
              )}
              {nmnh > 0 && (
                <div className="reward-pill reward-nmnh">
                  <span className="reward-delta">+{nmnh}</span>
                  <span>🪙 NMNH</span>
                </div>
              )}
            </motion.div>
          )}

          {/* Rating */}
          <motion.div className="results-rating" variants={itemVariants}>
            <span className="results-rating-label">Рейтинг</span>
            <span className={`results-rating-delta ${ratingDelta >= 0 ? 'delta-pos' : 'delta-neg'}`}>
              {ratingDelta > 0 ? '+' : ''}{ratingDelta}
            </span>
            <span className="results-rating-new">{newRating}</span>
          </motion.div>

          {/* Actions */}
          <motion.div className="results-actions" variants={itemVariants}>
            <button className="btn btn-primary btn-lg results-lobby-btn" onClick={handleLobby}>
              В лобби
            </button>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
