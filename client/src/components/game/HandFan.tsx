import React, { useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { Card as CardType } from 'shared';
import PlayingCard from './PlayingCard';
import CardBack from './CardBack';
import './HandFan.css';

const CARD_W = 65; // matches --card-width

interface HandFanProps {
  cards: CardType[];
  isFaceDown?: boolean;
  selectedCard?: CardType | null;
  /** Cards that may legally be played this turn (undefined = no restriction) */
  validCards?: CardType[];
  onCardClick?: (card: CardType) => void;
  isMyTurn?: boolean;
  isTrumpSuit?: (card: CardType) => boolean;
  maxVisible?: number;
}

const HandFan: React.FC<HandFanProps> = ({
  cards,
  isFaceDown = false,
  selectedCard,
  validCards,
  onCardClick,
  isMyTurn = false,
  isTrumpSuit,
  maxVisible = 12,
}) => {
  const visible = cards.slice(0, maxVisible);
  const n = visible.length;

  const { overlap } = useMemo(() => {
    if (n <= 1) return { overlap: 0 };
    // Fit cards into ~320px available width (conservative mobile estimate)
    const available = 320;
    const raw = CARD_W - (available - CARD_W) / (n - 1);
    return { overlap: Math.max(16, Math.min(38, raw)) };
  }, [n]);

  const maxAngle = Math.min(n * 4.5, 28);

  return (
    <div
      className={`hand-fan ${isMyTurn && !isFaceDown ? 'my-turn' : ''}`}
      role={isFaceDown ? undefined : 'list'}
      aria-label={isFaceDown ? undefined : 'Карты в руке'}
    >
      <div className="hand-fan-inner">
        <AnimatePresence mode="popLayout">
          {visible.map((card, i) => {
            const center = (n - 1) / 2;
            const angleDeg = n > 1 ? ((i - center) / Math.max(n - 1, 1)) * maxAngle * 2 : 0;
            const yPx      = n > 1 ? (Math.abs(i - center) / Math.max(center, 1)) * (n > 4 ? 9 : 5) : 0;

            const key = isFaceDown
              ? `back-${i}`
              : `${card.suit}-${card.rank}`;

            const isSelected = !isFaceDown && selectedCard
              ? selectedCard.suit === card.suit && selectedCard.rank === card.rank
              : false;

            const isInvalid =
              !isFaceDown && isMyTurn && !!validCards &&
              !validCards.some(v => v.suit === card.suit && v.rank === card.rank);

            const isValidCard =
              !isFaceDown && isMyTurn && !!validCards &&
              validCards.some(v => v.suit === card.suit && v.rank === card.rank);

            return (
              <div
                key={key}
                className={`fan-slot ${isSelected ? 'sel' : ''} ${isInvalid ? 'invalid' : ''}`}
                style={{
                  transform: `rotate(${angleDeg}deg) translateY(${isSelected ? -22 : yPx}px)`,
                  zIndex: isSelected ? 100 : i,
                  marginLeft: i === 0 ? 0 : `-${overlap}px`,
                }}
                role={isFaceDown ? undefined : 'listitem'}
              >
                {isFaceDown ? (
                  <CardBack size="sm" />
                ) : (
                  <PlayingCard
                    card={card}
                    selected={isSelected}
                    disabled={!isMyTurn}
                    isTrump={isTrumpSuit?.(card) ?? false}
                    isValid={isValidCard}
                    onClick={onCardClick}
                    dealIndex={i}
                  />
                )}
              </div>
            );
          })}
        </AnimatePresence>
      </div>

      {cards.length > maxVisible && (
        <div className="fan-overflow">+{cards.length - maxVisible}</div>
      )}
    </div>
  );
};

export default React.memo(HandFan);
