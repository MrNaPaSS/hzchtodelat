import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './PlayerInfoChip.css';

interface PlayerInfoChipProps {
  username: string;
  avatarUrl?: string;
  cardCount: number;
  isAttacker?: boolean;
  isDefender?: boolean;
  isTaking?: boolean;
  isMe?: boolean;
  className?: string;
  emojiReaction?: string | null;
}

const PlayerInfoChip: React.FC<PlayerInfoChipProps> = ({
  username, avatarUrl, cardCount, isAttacker, isDefender, isTaking,
  isMe, className = '', emojiReaction,
}) => {
  const initial = username.charAt(0).toUpperCase();

  /* Animate card count on change */
  const prevCount = useRef(cardCount);
  const [countDelta, setCountDelta] = useState<number | null>(null);

  useEffect(() => {
    const delta = cardCount - prevCount.current;
    if (delta !== 0 && prevCount.current !== 0) {
      setCountDelta(delta);
      const t = setTimeout(() => setCountDelta(null), 900);
      prevCount.current = cardCount;
      return () => clearTimeout(t);
    }
    prevCount.current = cardCount;
  }, [cardCount]);

  const cardWord = (n: number) => {
    if (n === 1) return 'карта';
    if (n >= 2 && n <= 4) return 'карты';
    return 'карт';
  };

  return (
    <div className={`pic ${isMe ? 'me' : 'opp'} ${isTaking ? 'taking' : ''} ${className}`}>
      <AnimatePresence>
        {emojiReaction && (
          <motion.div
            key={emojiReaction + Date.now()}
            className="pic-emoji-float"
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 1, 0], y: isMe ? -55 : 55, scale: [0.5, 1.4, 1.2, 0.8] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.8, times: [0, 0.15, 0.75, 1] }}
          >
            {emojiReaction}
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`pic-avatar ${isAttacker ? 'atk' : ''} ${isDefender ? 'def' : ''} ${isTaking ? 'take' : ''}`}>
        {avatarUrl
          ? <img src={avatarUrl} alt={username} className="pic-avatar-img" />
          : <span className="pic-avatar-letter">{initial}</span>
        }
        {isAttacker && !isTaking && <div className="pic-role-badge atk-badge" title="Атакует">⚔️</div>}
        {isDefender && !isTaking && <div className="pic-role-badge def-badge" title="Защищается">🛡️</div>}
        {isTaking   && <div className="pic-role-badge take-badge" title="Берёт карты">🖐</div>}
      </div>

      <div className="pic-info">
        <span className="pic-name">{username}</span>
        <div className="pic-cards-row">
          <motion.span
            key={cardCount}
            className="pic-cards"
            initial={{ scale: 1.4, color: countDelta !== null ? (countDelta > 0 ? '#EF4444' : '#00D26A') : undefined }}
            animate={{ scale: 1, color: 'var(--color-text-muted)' }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          >
            {cardCount} {cardWord(cardCount)}
          </motion.span>
          <AnimatePresence>
            {countDelta !== null && (
              <motion.span
                key={`delta-${countDelta}`}
                className={`pic-delta ${countDelta > 0 ? 'neg' : 'pos'}`}
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 0, y: countDelta > 0 ? 10 : -10 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7 }}
              >
                {countDelta > 0 ? `+${countDelta}` : countDelta}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default PlayerInfoChip;
