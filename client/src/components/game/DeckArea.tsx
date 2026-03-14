import React from 'react';
import { motion } from 'framer-motion';
import type { Card as CardType, Suit } from 'shared';
import PlayingCard, { SUIT_SYMBOLS, isRedSuit } from './PlayingCard';
import CardBack from './CardBack';
import './DeckArea.css';

interface DeckAreaProps {
  deckRemaining: number;
  trumpCard: CardType | null;
  trumpSuit: Suit;
  discardPileCount: number;
}

const DeckArea: React.FC<DeckAreaProps> = ({
  deckRemaining, trumpCard, trumpSuit, discardPileCount,
}) => {
  const sym   = SUIT_SYMBOLS[trumpSuit] ?? '?';
  const isRed = isRedSuit(trumpSuit);

  return (
    <div className="deck-area">
      {/* Trump suit chip */}
      <div className={`da-trump-chip ${isRed ? 'red' : 'black'}`}>
        <span className="da-trump-sym">{sym}</span>
        <span className="da-trump-lbl">Козырь</span>
      </div>

      {/* Deck stack + rotated trump card */}
      <div className="da-stack-wrap">
        {/* Trump card sticking out horizontally (rotated 90°) */}
        {trumpCard && (
          <motion.div
            className="da-trump-card"
            initial={{ opacity: 0, rotate: -60 }}
            animate={{ opacity: 1, rotate: -90 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          >
            <PlayingCard
              card={trumpCard}
              isTrump
            />
          </motion.div>
        )}

        {/* Deck stack */}
        {deckRemaining > 0 ? (
          <div className="da-deck">
            <div className="da-layer l3" aria-hidden="true" />
            <div className="da-layer l2" aria-hidden="true" />
            <div className="da-layer l1" aria-hidden="true" />
            <CardBack />
            <div className="da-count" aria-label={`${deckRemaining} карт в колоде`}>
              <span>{deckRemaining}</span>
            </div>
          </div>
        ) : (
          <div className="da-empty" aria-label="Колода закончилась">
            <span>📭</span>
          </div>
        )}
      </div>

      {/* Discard pile */}
      {discardPileCount > 0 && (
        <div className="da-discard" title={`Отбито карт: ${discardPileCount}`}>
          <span className="da-discard-icon">🗑</span>
          <span className="da-discard-n">{discardPileCount}</span>
        </div>
      )}
    </div>
  );
};

export default DeckArea;
