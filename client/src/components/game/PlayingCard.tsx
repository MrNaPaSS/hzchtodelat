import React from 'react';
import { motion } from 'framer-motion';
import type { Card as CardType } from 'shared';
import './PlayingCard.css';

export const SUIT_SYMBOLS: Record<string, string> = {
  hearts:   '♥',
  diamonds: '♦',
  clubs:    '♣',
  spades:   '♠',
};

export const isRedSuit = (suit: string) =>
  suit === 'hearts' || suit === 'diamonds';

export interface PlayingCardProps {
  card: CardType;
  onClick?: (card: CardType) => void;
  selected?: boolean;
  disabled?: boolean;
  isTrump?: boolean;
  /** Card can be legally played this turn */
  isValid?: boolean;
  className?: string;
  style?: React.CSSProperties;
  size?: 'sm' | 'md' | 'lg';
  /** Used for staggering the initial deal animation */
  dealIndex?: number;
}

const PlayingCard = React.memo<PlayingCardProps>(
  ({ card, onClick, selected, disabled, isTrump, isValid, className = '', style, size = 'md', dealIndex = 0 }) => {
    const isRed   = isRedSuit(card.suit);
    const sym     = SUIT_SYMBOLS[card.suit] ?? '?';
    const isFace  = ['J', 'Q', 'K', 'A'].includes(card.rank);

    const handleClick = React.useCallback(() => {
        if (onClick && !disabled) {
            onClick(card);
        }
    }, [onClick, card, disabled]);

    // Initial deal animation comes from top-right (Deck approximate position)
    const initialY = -150;
    const initialX = 100;
    const delay = dealIndex * 0.12;

    return (
      <motion.div
        layout
        className={[
          'pc',
          isRed   ? 'red'      : 'black',
          selected ? 'selected' : '',
          disabled ? 'disabled' : '',
          isTrump  ? 'trump'    : '',
          isValid  ? 'valid'    : '',
          `sz-${size}`,
          className,
        ].filter(Boolean).join(' ')}
        style={style}
        initial={{ scale: 0.1, opacity: 0, x: initialX, y: initialY }}
        animate={{ scale: 1, opacity: disabled ? 0.52 : 1, x: 0, y: 0 }}
        exit={{ scale: 0.75, opacity: 0, transition: { duration: 0.12 } }}
        whileTap={onClick && !disabled ? { scale: 0.93 } : undefined}
        transition={{ 
            type: 'spring', 
            stiffness: 280, 
            damping: 24,
            delay: delay,
            layout: { type: "spring", stiffness: 360, damping: 24 } // Override layout spring to ignore deal delay later
        }}
        onClick={handleClick}
        role={onClick ? 'button' : 'img'}
        aria-label={`${card.rank} ${card.suit}`}
        aria-pressed={selected}
      >
        {/* Top-left corner */}
        <div className="pc-corner tl">
          <span className="pc-rank">{card.rank}</span>
          <span className="pc-suit-sm">{sym}</span>
        </div>

        {/* Center */}
        <div className="pc-center">
          {isFace ? (
            <div className="pc-face">
              <span className="pc-face-letter">{card.rank}</span>
              <span className="pc-face-suit">{sym}</span>
            </div>
          ) : (
            <span className="pc-suit-lg">{sym}</span>
          )}
        </div>

        {/* Bottom-right corner (rotated) */}
        <div className="pc-corner br">
          <span className="pc-rank">{card.rank}</span>
          <span className="pc-suit-sm">{sym}</span>
        </div>

        {/* Gloss overlay */}
        <div className="pc-gloss" aria-hidden="true" />

        {/* Selected tint */}
        {selected && <div className="pc-sel-tint" aria-hidden="true" />}
      </motion.div>
    );
  }
);

PlayingCard.displayName = 'PlayingCard';
export default PlayingCard;
