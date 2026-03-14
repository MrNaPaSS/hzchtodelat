import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TablePair, Card as CardType, Suit } from 'shared';
import PlayingCard from './PlayingCard';
import './TableArea.css';

/* ── Client-side canBeat (mirrors server logic) ── */
const canBeat = (atk: CardType, def: CardType, trump: Suit): boolean => {
  if (def.suit === trump && atk.suit !== trump) return true;
  if (def.suit !== trump && atk.suit === trump) return false;
  if (def.suit === atk.suit) return def.value > atk.value;
  return false;
};

interface TableAreaProps {
  pairs: TablePair[];
  isDefending: boolean;
  selectedCard: CardType | null;
  onPairClick: (index: number) => void;
  trumpSuit: Suit;
  defenderIsTaking?: boolean;
}

const TableArea: React.FC<TableAreaProps> = ({
  pairs, isDefending, selectedCard, onPairClick, trumpSuit, defenderIsTaking = false,
}) => {
  const isEmpty = pairs.length === 0;

  const handlePairClick = React.useCallback((idx: number, clickable: boolean) => {
    if (clickable) onPairClick(idx);
  }, [onPairClick]);

  return (
    <div className={`table-area ${defenderIsTaking ? 'taking' : ''}`} aria-label="Игровой стол">
      {/* "Taking" indicator banner */}
      <AnimatePresence>
        {defenderIsTaking && (
          <motion.div
            className="table-taking-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          >
            🖐 Подкиньте ещё карт
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {isEmpty ? (
          <motion.div
            key="empty"
            className="table-empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="table-empty-suits">♠ ♥ ♦ ♣</div>
            <span>Ждём хода...</span>
          </motion.div>
        ) : (
          <motion.div
            key="pairs"
            className={`table-pairs cnt-${Math.min(pairs.length, 6)}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <AnimatePresence mode="popLayout">
              {pairs.map((pair, idx) => {
                const clickable  = isDefending && !pair.defense && !!selectedCard;
                const defendable = clickable && selectedCard
                  ? canBeat(pair.attack, selectedCard, trumpSuit)
                  : false;

                return (
                  <motion.div
                    key={`${pair.attack.suit}-${pair.attack.rank}-${idx}`}
                    className={[
                      'table-pair',
                      clickable    ? 'clickable'  : '',
                      defendable   ? 'defendable' : '',
                      pair.defense ? 'defended'   : 'open',
                      defenderIsTaking && !pair.defense ? 'taking-open' : '',
                    ].filter(Boolean).join(' ')}
                    initial={{ opacity: 0, scale: 0.65, y: -16 }}
                    animate={{ opacity: 1, scale: 1,    y: 0    }}
                    exit={{ opacity: 0, scale: 0.65 }}
                    transition={{ type: 'spring', stiffness: 360, damping: 24 }}
                    onClick={() => handlePairClick(idx, clickable)}
                    layout
                  >
                    {/* Attack card */}
                    <PlayingCard
                      card={pair.attack}
                      isTrump={pair.attack.suit === trumpSuit}
                      disabled={!!pair.defense}
                      className="tp-attack"
                    />

                    {/* Defense card */}
                    {pair.defense && (
                      <motion.div
                        className="tp-defense-wrap"
                        initial={{ opacity: 0, scale: 0.7, rotate: -20 }}
                        animate={{ opacity: 1, scale: 1,   rotate: -12 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                      >
                        <PlayingCard
                          card={pair.defense}
                          isTrump={pair.defense.suit === trumpSuit}
                          className="tp-defense"
                        />
                      </motion.div>
                    )}

                    {/* Highlight ring when defendable */}
                    {defendable && (
                      <motion.div
                        className="tp-ring"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        aria-hidden="true"
                      />
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(TableArea);
