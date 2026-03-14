import { GameState, GameAction, GameStatus, Card, GameActionType } from 'shared';
import { gameManager } from './GameManager.js';
import { logger } from '../lib/logger.js';

export class BotPlayer {
  public userId: string;
  public gameId: string;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(gameId: string, level: number = 1) {
    this.gameId = gameId;
    this.userId = `bot_${Math.random().toString(36).substr(2, 6)}`;
    
    // Join the game
    gameManager.joinGame(gameId, {
      userId: this.userId,
      username: `Bot Level ${level}`,
      firstName: '🤖 Bot',
      avatarUrl: '',
      rating: 1000 + (level * 100),
    });

    // Start polling game state
    this.startPolling();
  }

  private startPolling() {
    // Poll every 1-2 seconds to simulate thinking time
    this.checkInterval = setInterval(() => {
      this.evaluateAndAct();
    }, 1500);
  }

  public destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }

  private evaluateAndAct() {
    const state = gameManager.getGameState(this.userId);
    if (!state) {
      this.destroy(); // Game probably ended or we got kicked
      return;
    }

    if (state.status !== GameStatus.Playing) {
      return;
    }

    const isMyTurnAttacking = state.currentAttackerId === this.userId;
    const isMyTurnDefending = state.currentDefenderId === this.userId;
    
    if (!isMyTurnAttacking && !isMyTurnDefending) {
      return; // Not my turn
    }

    try {
      if (isMyTurnAttacking) {
        this.handleAttack(state);
      } else if (isMyTurnDefending) {
        this.handleDefense(state);
      }
    } catch (error) {
      logger.error(`Bot ${this.userId} error evaluating action`, { error });
    }
  }

  private handleAttack(state: GameState) {
    // 1. Initial attack (table is empty)
    if (state.table.length === 0) {
      // Find the lowest non-trump card
      const myHand = [...state.myHand].sort((a, b) => {
        // Sort by value ascending. Put trumps at the end.
        const aIsTrump = a.suit === state.trumpSuit ? 1 : 0;
        const bIsTrump = b.suit === state.trumpSuit ? 1 : 0;
        if (aIsTrump !== bIsTrump) return aIsTrump - bIsTrump;
        return a.value - b.value;
      });

      if (myHand.length > 0) {
        const cardToPlay = myHand[0];
        gameManager.processAction(this.userId, { type: GameActionType.Attack, card: cardToPlay });
      }
      return;
    }

    // 2. Throw-in logic (table has cards)
    // Check if we can even throw anything (max pairs limit or defender hand limit)
    const activeDefender = gameManager.getGameState(state.currentDefenderId);
    const defenderHandSize = activeDefender?.myHand.length ?? 6;
    if (state.table.length >= 6 || state.table.length + 1 > defenderHandSize) {
       gameManager.processAction(this.userId, { type: GameActionType.Pass });
       return;
    }

    const tableRanks = new Set(state.table.flatMap(p => [p.attack, ...(p.defense ? [p.defense] : [])]).map(c => c.rank));
    
    // Find valid throw-ins in hand
    const validThrowIns = state.myHand.filter(c => tableRanks.has(c.rank));
    
    // Filter out trumps unless we really want to throw them (e.g. low value, or trying to win)
    const safeThrowIns = validThrowIns.filter(c => c.suit !== state.trumpSuit || state.myHand.length === 1);

    if (safeThrowIns.length > 0) {
      // Throw the lowest one
      const cardToThrow = safeThrowIns.sort((a, b) => a.value - b.value)[0];
      gameManager.processAction(this.userId, { type: GameActionType.Attack, card: cardToThrow });
    } else {
      // Pass if we don't want to throw anything
      gameManager.processAction(this.userId, { type: GameActionType.Pass });
    }
  }

  private handleDefense(state: GameState) {
    if (state.defenderIsTaking) return; // We already decided to take

    const undefendedPairs = state.table
      .map((pair, index) => ({ pair, index }))
      .filter(p => !p.pair.defense);

    if (undefendedPairs.length === 0) return; // Nothing to defend

    // Defend the first undefended pair
    const target = undefendedPairs[0];
    const attackCard = target.pair.attack;

    // Find valid defense cards: same suit and higher value, OR trump suit
    const validDefenses = state.myHand.filter(c => {
      if (c.suit === attackCard.suit && c.value > attackCard.value) return true;
      if (c.suit === state.trumpSuit && attackCard.suit !== state.trumpSuit) return true;
      return false;
    });

    if (validDefenses.length > 0) {
      // Pick the cheapest defense: prefer same suit over trumps, then lowest value
      const sortedDefenses = validDefenses.sort((a, b) => {
        const aIsTrump = a.suit === state.trumpSuit ? 1 : 0;
        const bIsTrump = b.suit === state.trumpSuit ? 1 : 0;
        if (aIsTrump !== bIsTrump) return aIsTrump - bIsTrump;
        return a.value - b.value;
      });

      const defenseCard = sortedDefenses[0];
      
      // Heuristic: If we are forced to use a high trump (e.g. > 12) early on, maybe just take?
      if (defenseCard.suit === state.trumpSuit && defenseCard.value > 11 && state.deckRemaining > 10) {
         // Pass/Take instead of wasting a high trump early
         gameManager.processAction(this.userId, { type: GameActionType.Take });
         return;
      }

      gameManager.processAction(this.userId, {
        type: GameActionType.Defend,
        card: defenseCard,
        targetPairIndex: target.index
      });
    } else {
      // Cannot defend, must take
      gameManager.processAction(this.userId, { type: GameActionType.Take });
    }
  }
}
