import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TablePair, Card as CardType, GameSettings } from 'shared';
import './ActionPanel.css';

const canThrowIn = (card: CardType, table: CardType[]) =>
  table.some(tc => tc.rank === card.rank);

interface ActionPanelProps {
  isMyTurnAttacking: boolean;
  isMyTurnDefending: boolean;
  defenderIsTaking: boolean;
  selectedCard: CardType | null;
  pairs: TablePair[];
  settings: GameSettings;
  turnStartedAt: number;
  turnTimerSeconds: number;
  onAction: (type: 'attack' | 'take' | 'pass' | 'transfer') => void;
  onToggleEmoji: () => void;
  emojiOpen: boolean;
  isChatOpen: boolean;
  onToggleChat: () => void;
  unreadChat: number;
}

const ActionPanel: React.FC<ActionPanelProps> = ({
  isMyTurnAttacking, isMyTurnDefending, defenderIsTaking,
  selectedCard, pairs, settings,
  turnStartedAt, turnTimerSeconds,
  onAction, onToggleEmoji, emojiOpen,
  isChatOpen, onToggleChat, unreadChat,
}) => {
  const isMyTurn   = isMyTurnAttacking || isMyTurnDefending;
  const allTable   = pairs.flatMap(p => [p.attack, ...(p.defense ? [p.defense] : [])]);
  const allDefended = pairs.length > 0 && pairs.every(p => p.defense);

  const canPass     = isMyTurnAttacking && pairs.length > 0 && allDefended && !defenderIsTaking;
  const canThrow    = isMyTurnAttacking && pairs.length > 0 && pairs.length < 6
                      && !!selectedCard && canThrowIn(selectedCard, allTable);
  const canTake     = isMyTurnDefending && !defenderIsTaking;
  const canTransfer = isMyTurnDefending && !defenderIsTaking
                      && settings.mode === 'perevodnoy'
                      && pairs.length > 0
                      && !pairs.some(p => p.defense)
                      && !!selectedCard
                      && pairs.every(p => p.attack.rank === selectedCard!.rank);

  /* When defenderIsTaking, attacker can throw in or pass */
  const canThrowWhileTaking = defenderIsTaking && isMyTurnAttacking && pairs.length < 6
                              && !!selectedCard && canThrowIn(selectedCard, allTable);
  const canPassWhileTaking  = defenderIsTaking && isMyTurnAttacking;

  const btnVariants = {
    initial: { opacity: 0, scale: 0.82, y: 8 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit:    { opacity: 0, scale: 0.82, y: 8 },
  };
  const spring = { type: 'spring' as const, stiffness: 400, damping: 26 };

  return (
    <div className="ap glass">
      {/* Timer bar */}
      <div className="ap-timer-track" role="progressbar" aria-label="Таймер хода">
        <motion.div
          className={`ap-timer-fill ${!isMyTurn ? 'opp' : ''}`}
          key={turnStartedAt}
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: turnTimerSeconds, ease: 'linear' }}
        />
      </div>

      <div className="ap-row">
        {/* Emoji toggle */}
        <button
          className={`ap-emoji-btn ${emojiOpen ? 'active' : ''}`}
          onClick={onToggleEmoji}
          aria-label="Реакции"
          title="Реакции"
        >
          😀
        </button>

        {/* Chat toggle */}
        <button
          className={`ap-emoji-btn ${isChatOpen ? 'active' : ''}`}
          onClick={onToggleChat}
          aria-label="Чат"
          title="Чат"
          style={{ position: 'relative' }}
        >
          💬
          {unreadChat > 0 && !isChatOpen && (
            <motion.span
              className="gb-chat-badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 600, damping: 20 }}
            >
              {unreadChat}
            </motion.span>
          )}
        </button>

        <div className="ap-divider" aria-hidden="true" />

        <AnimatePresence mode="popLayout">
          {/* Defender is taking — attackers can throw more or pass */}
          {defenderIsTaking && isMyTurnAttacking && (
            <motion.div key="taking-hint" className="ap-taking-hint"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              🖐 Соперник берёт карты
            </motion.div>
          )}

          {canThrowWhileTaking && (
            <motion.button key="throw-taking" className="ap-btn warning"
              onClick={() => onAction('attack')}
              variants={btnVariants} initial="initial" animate="animate" exit="exit"
              transition={spring} whileTap={{ scale: 0.93 }}
            >↑ Подкинуть ещё</motion.button>
          )}

          {canPassWhileTaking && (
            <motion.button key="pass-taking" className="ap-btn secondary"
              onClick={() => onAction('pass')}
              variants={btnVariants} initial="initial" animate="animate" exit="exit"
              transition={spring} whileTap={{ scale: 0.93 }}
            >✓ Готово</motion.button>
          )}

          {/* Normal attack buttons */}
          {!defenderIsTaking && canPass && (
            <motion.button key="pass" className="ap-btn secondary"
              onClick={() => onAction('pass')}
              variants={btnVariants} initial="initial" animate="animate" exit="exit"
              transition={spring} whileTap={{ scale: 0.93 }}
            >✓ Бито</motion.button>
          )}

          {!defenderIsTaking && canThrow && (
            <motion.button key="throw" className="ap-btn primary"
              onClick={() => onAction('attack')}
              variants={btnVariants} initial="initial" animate="animate" exit="exit"
              transition={spring} whileTap={{ scale: 0.93 }}
            >↑ Подкинуть</motion.button>
          )}

          {canTake && (
            <motion.button key="take" className="ap-btn danger"
              onClick={() => onAction('take')}
              variants={btnVariants} initial="initial" animate="animate" exit="exit"
              transition={spring} whileTap={{ scale: 0.93 }}
            >🖐 Беру</motion.button>
          )}

          {canTransfer && (
            <motion.button key="transfer" className="ap-btn warning"
              onClick={() => onAction('transfer')}
              variants={btnVariants} initial="initial" animate="animate" exit="exit"
              transition={spring} whileTap={{ scale: 0.93 }}
            >→ Перевод</motion.button>
          )}

          {/* Hint states */}
          {isMyTurnAttacking && !defenderIsTaking && !canPass && !canThrow && (
            <motion.div key="select-atk" className="ap-hint"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              {pairs.length === 0 ? '⚔️ Выберите карту для атаки' : '↑ Выберите карту для подкидывания'}
            </motion.div>
          )}

          {isMyTurnDefending && !defenderIsTaking && !canTake && !canTransfer && !selectedCard && (
            <motion.div key="select-def" className="ap-hint"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              🛡️ Выберите карту для защиты
            </motion.div>
          )}

          {!isMyTurn && !defenderIsTaking && (
            <motion.div key="wait" className="ap-waiting"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <span className="ap-dots"><span /><span /><span /></span>
              Ход соперника
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ActionPanel;
