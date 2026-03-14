import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore, useAuthStore } from '../stores';
import type { Card as CardType } from 'shared';
import { Suit, Rank, GameStatus } from 'shared';
import HandFan from './game/HandFan';
import TableArea from './game/TableArea';
import DeckArea from './game/DeckArea';
import PlayerInfoChip from './game/PlayerInfoChip';
import ActionPanel from './game/ActionPanel';
import EmojiPanel from './game/EmojiPanel';
import { GameToast } from './game/GameToast';
import TurnBanner, { TurnPhase } from './game/TurnBanner';
import SurrenderModal from './game/SurrenderModal';
import ChatPanel from './game/ChatPanel';
import './GameBoard.css';

/* Client-side helper: can card be thrown in? */
const canThrowIn = (card: CardType, table: CardType[]) =>
  table.some(tc => tc.rank === card.rank);

/* Placeholder card for face-down hand rendering */
const DUMMY: CardType = { suit: Suit.Spades, rank: Rank.Ace, value: 14 };

/* Haptic feedback via Telegram WebApp */
const haptic = (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light') => {
  try {
    (window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred(style);
  } catch {
    /* silently ignore outside Telegram */
  }
};
const hapticNotification = (type: 'error' | 'success' | 'warning') => {
  try {
    (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred(type);
  } catch {/* */}
};

export default function GameBoard() {
  const {
    gameState, sendAction, sendEmoji, surrender,
    emojiReactions, gameToasts, removeGameToast,
    isChatOpen, toggleChat,
  } = useGameStore();
  const { user } = useAuthStore();

  const [selectedCard, setSelectedCard]       = useState<CardType | null>(null);
  const [emojiOpen, setEmojiOpen]             = useState(false);
  const [surrenderOpen, setSurrenderOpen]     = useState(false);
  const [bannerPhase, setBannerPhase]         = useState<TurnPhase>(null);

  /* Track prev attacker/defender to detect turn change */
  const prevAttackerRef = useRef<string | null>(null);
  const prevDefenderRef = useRef<string | null>(null);
  const bannerTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!gameState || !user) return null;

  const me       = gameState.players.find(p => p.userId === user.id);
  const opponent = gameState.players.find(p => p.userId !== user.id);

  const isMyTurnAttacking = gameState.status === GameStatus.Playing && gameState.currentAttackerId === user.id;
  const isMyTurnDefending = gameState.status === GameStatus.Playing && gameState.currentDefenderId === user.id;
  const isSpectator       = me?.isOut ?? false;
  const defenderIsTaking  = gameState.defenderIsTaking ?? false;

  /* All cards on table (for canThrowIn rank matching) */
  const allTableCards = useMemo(
    () => gameState.table.flatMap(p => [p.attack, ...(p.defense ? [p.defense] : [])]),
    [gameState.table],
  );

  /* Cards that can be legally thrown in when attacking */
  const validCards: CardType[] | undefined = useMemo(
    () =>
      isMyTurnAttacking && gameState.table.length > 0
        ? gameState.myHand.filter(c => canThrowIn(c, allTableCards))
        : undefined,
    [isMyTurnAttacking, gameState.table.length, gameState.myHand, allTableCards],
  );

  /* Face-down dummy array for opponent hand fan */
  const opponentFakeCards = useMemo(
    () => Array.from({ length: opponent?.cardCount ?? 0 }, () => DUMMY),
    [opponent?.cardCount],
  );

  /* ── Turn-change banner & haptic ── */
  useEffect(() => {
    const prevAtk = prevAttackerRef.current;
    const prevDef = prevDefenderRef.current;
    const curAtk  = gameState.currentAttackerId;
    const curDef  = gameState.currentDefenderId;

    const attackerChanged = curAtk !== prevAtk;
    const defenderChanged = curDef !== prevDef;
    const turnChanged     = attackerChanged || defenderChanged;

    if (turnChanged && (prevAtk !== null || prevDef !== null)) {
      let phase: TurnPhase = null;

      if (defenderIsTaking) {
        // The opponent (defender) announced taking — show it
        if (gameState.currentDefenderId !== user.id) {
          phase = 'taking';
        }
      } else if (isMyTurnAttacking) {
        phase = 'attack';
        hapticNotification('success');
      } else if (isMyTurnDefending) {
        phase = 'defend';
        hapticNotification('warning');
      } else {
        phase = 'wait';
      }

      if (phase) {
        setBannerPhase(phase);
        if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = setTimeout(() => setBannerPhase(null), 1800);
      }
    }

    prevAttackerRef.current = curAtk;
    prevDefenderRef.current = curDef;
  }, [gameState.currentAttackerId, gameState.currentDefenderId, isMyTurnAttacking, isMyTurnDefending, defenderIsTaking, user.id]);

  /* Reset selection when turn/table changes */
  useEffect(() => {
    setSelectedCard(null);
    setEmojiOpen(false);
  }, [gameState.currentAttackerId, gameState.currentDefenderId, gameState.table.length]);

  /* Cleanup banner timer */
  useEffect(() => () => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
  }, []);

  /* Latest emoji per player */
  const myLatestEmoji       = emojiReactions.find(r => r.userId === user.id)?.emoji ?? null;
  const opponentLatestEmoji = emojiReactions.find(r => r.userId !== user.id)?.emoji ?? null;

  /* ── Handlers ── */
  const handleCardClick = useCallback((card: CardType) => {
    if (isSpectator) return;
    haptic('light');

    const isSame = selectedCard?.suit === card.suit && selectedCard?.rank === card.rank;
    if (isSame) { setSelectedCard(null); return; }

    if (isMyTurnAttacking) {
      if (gameState.table.length === 0) {
        /* First attack — send immediately */
        sendAction({ type: 'attack', card });
        setSelectedCard(null);
      } else if (defenderIsTaking || canThrowIn(card, allTableCards)) {
        /* Throw-in — select card, ActionPanel provides throw button */
        setSelectedCard(card);
      } else {
        /* Card can't be thrown in — select for context but dim */
        setSelectedCard(card);
      }
    } else if (isMyTurnDefending) {
      setSelectedCard(card);
      /* If only one undefended pair exists + card can beat it — auto defend */
      const openPairs = gameState.table
        .map((p, i) => ({ pair: p, index: i }))
        .filter(({ pair }) => !pair.defense);

      if (openPairs.length === 1) {
        const { pair, index } = openPairs[0];
        const canBeat =
          (card.suit === gameState.trumpSuit && pair.attack.suit !== gameState.trumpSuit) ||
          (card.suit === pair.attack.suit && card.value > pair.attack.value);
        if (canBeat) {
          sendAction({ type: 'defend', card, targetPairIndex: index });
          setSelectedCard(null);
          haptic('medium');
        }
      }
    } else {
      setSelectedCard(card);
    }
  }, [selectedCard, isMyTurnAttacking, isMyTurnDefending, gameState, sendAction, isSpectator, allTableCards, defenderIsTaking]);

  const handlePairClick = useCallback((index: number) => {
    if (!isMyTurnDefending || !selectedCard) return;
    sendAction({ type: 'defend', card: selectedCard, targetPairIndex: index });
    setSelectedCard(null);
    haptic('medium');
  }, [isMyTurnDefending, selectedCard, sendAction]);

  const handleAction = useCallback((type: 'attack' | 'take' | 'pass' | 'transfer') => {
    if ((type === 'attack' || type === 'transfer') && selectedCard) {
      sendAction({ type, card: selectedCard });
    } else {
      sendAction({ type });
    }
    if (type === 'take') haptic('heavy');
    else haptic('light');
    setSelectedCard(null);
  }, [selectedCard, sendAction]);

  const handleSendEmoji = useCallback((emoji: string) => {
    sendEmoji(emoji);
    setEmojiOpen(false);
    haptic('soft');
  }, [sendEmoji]);

  const handleSurrenderConfirm = useCallback(() => {
    setSurrenderOpen(false);
    surrender();
  }, [surrender]);

  /* Is it "our turn" in any capacity */
  const isMyTurn = isMyTurnAttacking || isMyTurnDefending;

  /* Header: unread chat badge */
  const chatCount = useGameStore(s => s.chatMessages.length);
  const prevChatCountRef = useRef(0);
  const [unreadChat, setUnreadChat] = useState(0);
  useEffect(() => {
    if (!isChatOpen && chatCount > prevChatCountRef.current) {
      setUnreadChat(v => v + chatCount - prevChatCountRef.current);
    }
    prevChatCountRef.current = chatCount;
  }, [chatCount, isChatOpen]);
  useEffect(() => { if (isChatOpen) setUnreadChat(0); }, [isChatOpen]);

  return (
    <div className={`gb ${isMyTurnAttacking ? 'phase-atk' : isMyTurnDefending ? 'phase-def' : ''}`}>

      {/* ── Waiting Overlay ─────────────────────── */}
      <AnimatePresence>
        {gameState.status === GameStatus.Waiting && (
          <motion.div
            className="gb-waiting-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
               className="waiting-content glass"
               initial={{ scale: 0.9, y: 20 }}
               animate={{ scale: 1, y: 0 }}
            >
              <div className="waiting-spinner">⏳</div>
              <h2>Ожидание соперника...</h2>
              <p>Разминаем пальцы, готовим козыри</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Turn banner ─────────────────────────── */}
      <TurnBanner phase={bannerPhase} />

      {/* ── In-game toasts ─────────────────────── */}
      <GameToast toasts={gameToasts} onRemove={removeGameToast} />

      {/* ── Surrender modal ─────────────────────── */}
      <SurrenderModal
        isOpen={surrenderOpen}
        onConfirm={handleSurrenderConfirm}
        onCancel={() => setSurrenderOpen(false)}
      />

      {/* ── Top header bar ─────────────────────── */}
      <header className="gb-header">
        <button
          className="gb-surrender"
          onClick={() => setSurrenderOpen(true)}
          aria-label="Сдаться"
        >
          Сдаться
        </button>

        <div className="gb-meta">
          <span className="gb-mode">
            {gameState.settings.mode === 'perevodnoy' ? 'Переводной' : 'Подкидной'}
          </span>
          <span className="gb-stake">⭐ {gameState.settings.stake}</span>
        </div>

        <div className="gb-header-right">
          <div className="gb-discard" title="Отбито карт">
            🗑 {gameState.discardPileCount}
          </div>
        </div>
      </header>

      {/* ── Opponent zone ───────────────────────── */}
      <section className="gb-opponent" aria-label="Соперник">
        <PlayerInfoChip
          username={opponent?.username ?? 'Соперник'}
          avatarUrl={opponent?.avatarUrl}
          cardCount={opponent?.cardCount ?? 0}
          isAttacker={gameState.currentAttackerId === opponent?.userId}
          isDefender={gameState.currentDefenderId === opponent?.userId}
          isTaking={defenderIsTaking && gameState.currentDefenderId === opponent?.userId}
          emojiReaction={opponentLatestEmoji}
          className="gb-opp-chip"
        />
        <HandFan
          cards={opponentFakeCards}
          isFaceDown
          maxVisible={Math.min(opponent?.cardCount ?? 0, 10)}
        />
      </section>

      {/* ── Center: table + deck ────────────────── */}
      <section className="gb-center" aria-label="Стол">
        <TableArea
          pairs={gameState.table}
          isDefending={isMyTurnDefending && !defenderIsTaking}
          selectedCard={selectedCard}
          onPairClick={handlePairClick}
          trumpSuit={gameState.trumpSuit}
          defenderIsTaking={defenderIsTaking}
        />
        <DeckArea
          deckRemaining={gameState.deckRemaining}
          trumpCard={gameState.trumpCard}
          trumpSuit={gameState.trumpSuit}
          discardPileCount={gameState.discardPileCount}
        />
      </section>

      {/* ── Action panel (with emoji + chat) ────── */}
      <div className="gb-action-wrap">
        <AnimatePresence>
          {emojiOpen && (
            <EmojiPanel
              isOpen={emojiOpen}
              onClose={() => setEmojiOpen(false)}
              onSend={handleSendEmoji}
            />
          )}
        </AnimatePresence>

        <ChatPanel isOpen={isChatOpen} />

        <ActionPanel
          isMyTurnAttacking={isMyTurnAttacking}
          isMyTurnDefending={isMyTurnDefending}
          defenderIsTaking={defenderIsTaking}
          selectedCard={selectedCard}
          pairs={gameState.table}
          settings={gameState.settings}
          turnStartedAt={gameState.turnStartedAt}
          turnTimerSeconds={gameState.turnTimerSeconds}
          onAction={handleAction}
          onToggleEmoji={() => { setEmojiOpen(v => !v); if (isChatOpen) toggleChat(); }}
          emojiOpen={emojiOpen}
          isChatOpen={isChatOpen}
          onToggleChat={() => { toggleChat(); haptic('light'); if (emojiOpen) setEmojiOpen(false); }}
          unreadChat={unreadChat}
        />
      </div>

      {/* ── My hand zone ───────────────────────── */}
      <section
        className={`gb-hand ${isMyTurnAttacking ? 'turn-atk' : isMyTurnDefending ? 'turn-def' : ''} ${defenderIsTaking && isMyTurnAttacking ? 'turn-throwing' : ''}`}
        aria-label="Мои карты"
      >
        <PlayerInfoChip
          username={me?.username ?? user.firstName}
          avatarUrl={me?.avatarUrl ?? user.avatarUrl}
          cardCount={gameState.myHand.length}
          isAttacker={isMyTurnAttacking}
          isDefender={isMyTurnDefending}
          isTaking={defenderIsTaking && isMyTurnDefending}
          isMe
          emojiReaction={myLatestEmoji}
          className="gb-my-chip"
        />
        <HandFan
          cards={gameState.myHand}
          selectedCard={selectedCard}
          validCards={validCards}
          onCardClick={handleCardClick}
          isMyTurn={isMyTurn}
          isTrumpSuit={(c) => c.suit === gameState.trumpSuit}
        />
      </section>
    </div>
  );
}
