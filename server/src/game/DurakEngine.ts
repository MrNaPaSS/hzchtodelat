import {
  Card,
  Suit,
  GameMode,
  GameStatus,
  GameSettings,
  GameState,
  GameAction,
  GameActionType,
  GameActionResult,
  GameEndResult,
  GameResult,
  PlayerRole,
  TablePair,
  DeckSize,
} from 'shared';
import {
  createDeck,
  canBeat,
  canThrowIn,
  findLowestTrump,
  removeCard,
  isSameCard,
  getAllTableCards,
  extractTableCards,
  sortHand,
} from './cards.js';
import { logger } from '../lib/logger.js';

const HAND_SIZE = 6;
const MAX_TABLE_PAIRS = 6;
const FIRST_ROUND_MAX_PAIRS = 5;

interface InternalPlayer {
  userId: string;
  username: string;
  firstName: string;
  avatarUrl: string;
  rating: number;
  hand: Card[];
  position: number;
  isOut: boolean;
  hasPassedThisRound: boolean;
}

/**
 * The core Durak game engine.
 * Manages all game state and validates every action server-side.
 */
export class DurakEngine {
  readonly gameId: string;
  readonly settings: GameSettings;

  private status: GameStatus = GameStatus.Waiting;
  private players: InternalPlayer[] = [];
  private deck: Card[] = [];
  private trumpCard: Card | null = null;
  private trumpSuit: Suit = Suit.Hearts;
  private table: TablePair[] = [];
  private discardPile: Card[] = [];

  private currentAttackerIndex = 0;
  private currentDefenderIndex = 1;
  private roundNumber = 0;
  private isFirstRoundOfGame = true;

  /** Tracks who has passed (said "бито") this round */
  private passedPlayers: Set<string> = new Set();

  /** True when defender announced "Беру" — attackers may still throw in */
  private defenderAnnouncedTake = false;

  /** Stored turn start timestamp — set on start() and each new round */
  private turnStartedAt = 0;

  /** Stored loser id from finishGame() for correct getEndResult() */
  private _loserId: string | null = null;

  /** Defender's hand size at the start of the round (used for throw-in limits) */
  private roundStartDefenderHandSize = 0;

  constructor(gameId: string, settings: GameSettings) {
    this.gameId = gameId;
    this.settings = settings;
  }

  // ============================================================
  // LIFECYCLE
  // ============================================================

  addPlayer(player: {
    userId: string;
    username: string;
    firstName: string;
    avatarUrl: string;
    rating: number;
  }): boolean {
    if (this.status !== GameStatus.Waiting) return false;
    if (this.players.length >= this.settings.maxPlayers) return false;
    if (this.players.some((p) => p.userId === player.userId)) return false;

    this.players.push({
      ...player,
      hand: [],
      position: this.players.length,
      isOut: false,
      hasPassedThisRound: false,
    });

    return true;
  }

  removePlayer(userId: string): boolean {
    if (this.status !== GameStatus.Waiting) return false;
    const idx = this.players.findIndex((p) => p.userId === userId);
    if (idx === -1) return false;
    this.players.splice(idx, 1);
    this.players.forEach((p, i) => (p.position = i));
    return true;
  }

  canStart(): boolean {
    return (
      this.status === GameStatus.Waiting &&
      this.players.length >= 2 &&
      this.players.length <= this.settings.maxPlayers
    );
  }

  start(): boolean {
    if (!this.canStart()) return false;

    this.status = GameStatus.Playing;
    this.deck = createDeck(this.settings.deckSize);

    this.trumpCard = this.deck[this.deck.length - 1];
    this.trumpSuit = this.trumpCard.suit;

    for (let i = 0; i < HAND_SIZE; i++) {
      for (const player of this.players) {
        const card = this.deck.shift();
        if (card) player.hand.push(card);
      }
    }

    for (const player of this.players) {
      player.hand = sortHand(player.hand, this.trumpSuit);
    }

    let lowestTrumpValue = Infinity;
    let firstAttacker = 0;

    for (let i = 0; i < this.players.length; i++) {
      const lowest = findLowestTrump(this.players[i].hand, this.trumpSuit);
      if (lowest && lowest.value < lowestTrumpValue) {
        lowestTrumpValue = lowest.value;
        firstAttacker = i;
      }
    }

    this.currentAttackerIndex = firstAttacker;
    this.currentDefenderIndex = this.getNextActiveIndex(firstAttacker);
    this.roundNumber = 1;
    this.isFirstRoundOfGame = true;
    this.turnStartedAt = Date.now();

    logger.info(`Game ${this.gameId} started. Players: ${this.players.length}. Trump: ${this.trumpSuit}`);

    return true;
  }

  // ============================================================
  // ACTIONS
  // ============================================================

  processAction(userId: string, action: GameAction): GameActionResult {
    if (this.status !== GameStatus.Playing) {
      return { success: false, error: 'Game is not in progress' };
    }

    const player = this.getPlayer(userId);
    if (!player) {
      return { success: false, error: 'Player not found in game' };
    }

    if (player.isOut) {
      return { success: false, error: 'Player has already finished' };
    }

    switch (action.type) {
      case GameActionType.Attack:
        return this.handleAttack(player, action);
      case GameActionType.Defend:
        return this.handleDefend(player, action);
      case GameActionType.Take:
        return this.handleTake(player);
      case GameActionType.Pass:
        return this.handlePass(player);
      case GameActionType.Transfer:
        return this.handleTransfer(player, action);
      case GameActionType.Surrender:
        return this.handleSurrender(player);
      default:
        return { success: false, error: 'Unknown action type' };
    }
  }

  private handleAttack(player: InternalPlayer, action: GameAction): GameActionResult {
    const { card } = action;
    if (!card) return { success: false, error: 'No card specified' };

    const attacker = this.players[this.currentAttackerIndex];
    const defender = this.players[this.currentDefenderIndex];

    const isMainAttacker = player.userId === attacker.userId;
    const canCoAttack = this.canPlayerCoAttack(player);

    if (!isMainAttacker && !canCoAttack) {
      return { success: false, error: 'Not your turn to attack' };
    }

    if (!player.hand.some((c) => isSameCard(c, card))) {
      return { success: false, error: 'Card not in hand' };
    }

    const maxPairs = this.isFirstRoundOfGame ? FIRST_ROUND_MAX_PAIRS : MAX_TABLE_PAIRS;
    if (this.table.length >= maxPairs) {
      return { success: false, error: 'Maximum cards on table reached' };
    }

    // Set initial hand size when the first card is played in a round
    if (this.table.length === 0) {
      this.roundStartDefenderHandSize = defender.hand.length;
    }

    // Cannot throw more cards than defender can take (at the start of the round)
    // Important: limit is Math.min(6, initial_hand_size)
    const currentTableCount = this.table.length;
    const allowedToThrow = Math.min(maxPairs, this.roundStartDefenderHandSize);
    
    if (currentTableCount + 1 > allowedToThrow) {
      return { success: false, error: 'Defender does not have enough cards to defend' };
    }

    // First attack: any card. Subsequent (incl. after defenderAnnouncedTake): must match rank
    if (this.table.length > 0) {
      const tableCards = getAllTableCards(this.table);
      if (!canThrowIn(card, tableCards)) {
        return { success: false, error: 'Card rank does not match any card on the table' };
      }
    } else if (this.defenderAnnouncedTake) {
      // No cards on table yet but defender already took — shouldn't happen normally
      return { success: false, error: 'Cannot attack an empty table when defender is taking' };
    }

    player.hand = removeCard(player.hand, card);
    this.table.push({ attack: card, defense: null });

    // If defender announced take, don't reset passedPlayers — let throw-in round continue
    if (!this.defenderAnnouncedTake) {
      this.passedPlayers.clear();
    }

    return { success: true };
  }

  private handleDefend(player: InternalPlayer, action: GameAction): GameActionResult {
    const { card, targetPairIndex } = action;
    if (!card) return { success: false, error: 'No card specified' };
    if (targetPairIndex === undefined) return { success: false, error: 'No target pair specified' };

    // Cannot defend after announcing take
    if (this.defenderAnnouncedTake) {
      return { success: false, error: 'Cannot defend after announcing take' };
    }

    const defender = this.players[this.currentDefenderIndex];
    if (player.userId !== defender.userId) {
      return { success: false, error: 'Not your turn to defend' };
    }

    if (targetPairIndex < 0 || targetPairIndex >= this.table.length) {
      return { success: false, error: 'Invalid table pair index' };
    }

    const pair = this.table[targetPairIndex];
    if (pair.defense) {
      return { success: false, error: 'This pair is already defended' };
    }

    if (!player.hand.some((c) => isSameCard(c, card))) {
      return { success: false, error: 'Card not in hand' };
    }

    if (!canBeat(pair.attack, card, this.trumpSuit)) {
      return { success: false, error: 'Card cannot beat the attack card' };
    }

    player.hand = removeCard(player.hand, card);
    pair.defense = card;

    return { success: true };
  }

  private handleTake(player: InternalPlayer): GameActionResult {
    const defender = this.players[this.currentDefenderIndex];
    if (player.userId !== defender.userId) {
      return { success: false, error: 'Only the defender can take cards' };
    }

    if (this.defenderAnnouncedTake) {
      return { success: false, error: 'Already announced take — wait for attackers' };
    }

    // Announce take: attackers may now throw in more cards
    this.defenderAnnouncedTake = true;

    // If no attackers can throw in at this moment, end round immediately
    if (!this.canAnyAttackerThrowIn()) {
      this.executeDefenderTake();
    }

    return { success: true };
  }

  private handlePass(player: InternalPlayer): GameActionResult {
    const attacker = this.players[this.currentAttackerIndex];
    const isMainAttacker = player.userId === attacker.userId;
    const canCoAttack = this.canPlayerCoAttack(player);

    if (!isMainAttacker && !canCoAttack) {
      return { success: false, error: 'Only attackers can pass' };
    }

    if (this.table.length === 0 && !this.defenderAnnouncedTake) {
      return { success: false, error: 'Must play at least one card before passing' };
    }

    this.passedPlayers.add(player.userId);

    if (this.defenderAnnouncedTake) {
      // All attackers passed after take announcement → defender takes everything
      if (this.haveAllAttackersPassed()) {
        this.executeDefenderTake();
      }
    } else {
      // Normal pass: all pairs defended AND all attackers passed → discard & next round
      const allDefended = this.table.every((p) => p.defense !== null);
      if (allDefended && this.haveAllAttackersPassed()) {
        this.discardPile.push(...getAllTableCards(this.table));
        this.table = [];
        this.endRound(false);
      }
    }

    return { success: true };
  }

  private handleTransfer(player: InternalPlayer, action: GameAction): GameActionResult {
    if (this.settings.mode !== GameMode.Perevodnoy) {
      return { success: false, error: 'Transfer is only allowed in perevodnoy mode' };
    }

    const { card } = action;
    if (!card) return { success: false, error: 'No card specified' };

    if (this.defenderAnnouncedTake) {
      return { success: false, error: 'Cannot transfer after announcing take' };
    }

    const defender = this.players[this.currentDefenderIndex];
    if (player.userId !== defender.userId) {
      return { success: false, error: 'Only the defender can transfer' };
    }

    if (this.table.some((p) => p.defense !== null)) {
      return { success: false, error: 'Cannot transfer after defending' };
    }

    const attackRank = this.table[0]?.attack.rank;
    if (!attackRank || card.rank !== attackRank) {
      return { success: false, error: 'Transfer card must have the same rank as attack cards' };
    }

    if (!player.hand.some((c) => isSameCard(c, card))) {
      return { success: false, error: 'Card not in hand' };
    }

    const nextDefender = this.getNextActivePlayer(this.currentDefenderIndex);
    if (!nextDefender) {
      return { success: false, error: 'No next player to transfer to' };
    }

    const totalAttackCards = this.table.length + 1;
    if (totalAttackCards > nextDefender.hand.length) {
      return { success: false, error: 'Next player does not have enough cards' };
    }

    player.hand = removeCard(player.hand, card);
    this.table.push({ attack: card, defense: null });

    this.currentAttackerIndex = this.currentDefenderIndex;
    this.currentDefenderIndex = this.getNextActiveIndex(this.currentDefenderIndex);
    this.roundStartDefenderHandSize = this.players[this.currentDefenderIndex].hand.length;
    this.passedPlayers.clear();

    return { success: true };
  }

  private handleSurrender(player: InternalPlayer): GameActionResult {
    // The surrendering player IS the loser (durak)
    const loserId = player.userId;
    player.isOut = true;

    const activePlayers = this.getActivePlayers();
    if (activePlayers.length <= 1) {
      this.finishGame(loserId);
    }

    return { success: true };
  }

  // ============================================================
  // ROUND MANAGEMENT
  // ============================================================

  /**
   * Defender takes all table cards and round ends.
   */
  private executeDefenderTake(): void {
    const defender = this.players[this.currentDefenderIndex];
    const allCards = getAllTableCards(this.table);
    defender.hand.push(...allCards);
    defender.hand = sortHand(defender.hand, this.trumpSuit);
    this.table = [];
    this.defenderAnnouncedTake = false;
    this.endRound(true);
  }

  /**
   * Ends the current round. defenderTook = true means defender picked up cards.
   */
  private endRound(defenderTook: boolean): void {
    this.dealCards();

    for (const player of this.players) {
      if (!player.isOut && player.hand.length === 0 && this.deck.length === 0) {
        player.isOut = true;
      }
    }

    const activePlayers = this.getActivePlayers();
    if (activePlayers.length <= 1) {
      const loserId = activePlayers.length === 1 ? activePlayers[0].userId : null;
      this.finishGame(loserId);
      return;
    }

    if (defenderTook) {
      this.currentAttackerIndex = this.getNextActiveIndex(this.currentDefenderIndex);
    } else {
      this.currentAttackerIndex = this.currentDefenderIndex;
    }

    this.currentDefenderIndex = this.getNextActiveIndex(this.currentAttackerIndex);
    this.roundNumber++;
    this.isFirstRoundOfGame = false;
    this.passedPlayers.clear();
    this.defenderAnnouncedTake = false;
    this.turnStartedAt = Date.now();

    if (this.deck.length === 0) {
      this.trumpCard = null;
    }

    logger.debug(`Game ${this.gameId}: round ${this.roundNumber}`);
  }

  private dealCards(): void {
    if (this.deck.length === 0) return;

    const order = this.getDealOrder();

    for (const playerIndex of order) {
      const player = this.players[playerIndex];
      while (player.hand.length < HAND_SIZE && this.deck.length > 0) {
        const card = this.deck.shift()!;
        player.hand.push(card);
      }
      player.hand = sortHand(player.hand, this.trumpSuit);
    }
  }

  private getDealOrder(): number[] {
    const order: number[] = [];
    const count = this.players.length;

    let idx = this.currentAttackerIndex;
    for (let i = 0; i < count; i++) {
      if (idx !== this.currentDefenderIndex && !this.players[idx].isOut) {
        order.push(idx);
      }
      idx = (idx + 1) % count;
    }
    if (!this.players[this.currentDefenderIndex].isOut) {
      order.push(this.currentDefenderIndex);
    }

    return order;
  }

  private finishGame(loserId: string | null): void {
    this.status = GameStatus.Finished;
    this._loserId = loserId;

    if (loserId) {
      logger.info(`Game ${this.gameId} finished. Loser (durak): ${loserId}`);
    } else {
      logger.info(`Game ${this.gameId} finished as draw`);
    }
  }

  // ============================================================
  // QUERIES
  // ============================================================

  getStatus(): GameStatus {
    return this.status;
  }

  getPlayerCount(): number {
    return this.players.length;
  }

  getPlayer(userId: string): InternalPlayer | undefined {
    return this.players.find((p) => p.userId === userId);
  }

  getActivePlayers(): InternalPlayer[] {
    return this.players.filter((p) => !p.isOut);
  }

  getStateForPlayer(userId: string): GameState {
    const player = this.getPlayer(userId);

    return {
      gameId: this.gameId,
      status: this.status,
      settings: this.settings,
      players: this.players.map((p) => ({
        userId: p.userId,
        visibleCards: p.userId === userId ? p.hand : [],
        cardCount: p.hand.length,
        role: this.getPlayerRole(p),
        isOut: p.isOut,
        position: p.position,
        avatarUrl: p.avatarUrl,
        username: p.username,
        rating: p.rating,
      })),
      myHand: player ? sortHand(player.hand, this.trumpSuit) : [],
      table: this.table,
      trumpCard: this.trumpCard,
      trumpSuit: this.trumpSuit,
      deckRemaining: this.deck.length,
      currentAttackerId: this.players[this.currentAttackerIndex]?.userId ?? '',
      currentDefenderId: this.players[this.currentDefenderIndex]?.userId ?? '',
      turnStartedAt: this.turnStartedAt,
      turnTimerSeconds: this.settings.turnTimerSeconds,
      discardPileCount: this.discardPile.length,
      defenderIsTaking: this.defenderAnnouncedTake,
    };
  }

  getEndResult(): GameEndResult | null {
    if (this.status !== GameStatus.Finished) return null;

    const loserId = this._loserId ?? '';
    const isDraw = this._loserId === null && this.settings.allowDraw;

    // Winner = a player who is NOT the loser and has finished (isOut)
    // In a 2-player game: winner is the one who ran out of cards, loser still has cards (isOut=false)
    // We find winner as: not the loser, and either isOut=true OR has 0 cards
    const winnerId = isDraw
      ? null
      : this.players.find((p) => p.userId !== loserId && !p.isOut === false || (p.userId !== loserId && p.isOut))?.userId ??
        this.players.find((p) => p.userId !== loserId)?.userId ??
        null;

    return {
      gameId: this.gameId,
      winnerId,
      loserId,
      isDraw,
      players: this.players.map((p) => ({
        userId: p.userId,
        result: isDraw
          ? GameResult.Draw
          : p.userId === loserId
            ? GameResult.Lose
            : GameResult.Win,
        starsPayout: 0,
        nmnhEarned: 0,
        ratingChange: 0,
        newRating: p.rating,
      })),
      questProgress: [],
    };
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private getPlayerRole(player: InternalPlayer): PlayerRole {
    if (player.isOut) return PlayerRole.Spectator;
    if (player.position === this.players[this.currentAttackerIndex]?.position) {
      return PlayerRole.Attacker;
    }
    if (player.position === this.players[this.currentDefenderIndex]?.position) {
      return PlayerRole.Defender;
    }
    if (this.canPlayerCoAttack(player)) {
      return PlayerRole.CoAttacker;
    }
    return PlayerRole.Spectator;
  }

  private canPlayerCoAttack(player: InternalPlayer): boolean {
    if (player.isOut) return false;
    const defender = this.players[this.currentDefenderIndex];
    if (player.userId === defender.userId) return false;
    if (player.userId === this.players[this.currentAttackerIndex].userId) return false;

    if (this.settings.throwInRule === 'all') {
      return true;
    }

    // Neighbors: left neighbor of defender
    const leftNeighborIndex = this.getPrevActiveIndex(this.currentDefenderIndex);
    return player.position === this.players[leftNeighborIndex]?.position;
  }

  private canAnyAttackerThrowIn(): boolean {
    if (this.table.length === 0) return false;
    
    // Memory Optimization: Extract cards safely to avoid constant reallocation
    const tableCards: Card[] = [];
    extractTableCards(this.table, tableCards);
    
    const maxPairs = this.isFirstRoundOfGame ? FIRST_ROUND_MAX_PAIRS : MAX_TABLE_PAIRS;
    if (this.table.length >= maxPairs) return false;

    const defender = this.players[this.currentDefenderIndex];

    for (let i = 0; i < this.players.length; i++) {
        const player = this.players[i];
      if (player.isOut) continue;
      if (player.userId === defender.userId) continue;

      const isMainAttacker = player.userId === this.players[this.currentAttackerIndex].userId;
      if (!isMainAttacker && !this.canPlayerCoAttack(player)) continue;
      if (this.passedPlayers.has(player.userId)) continue;

      // Check if they have any valid throw-in card efficiently
      for (let j = 0; j < player.hand.length; j++) {
        const c = player.hand[j];
          if (canThrowIn(c, tableCards) && this.table.length + 1 <= defender.hand.length) {
              return true;
          }
      }
    }

    return false;
  }

  private getNextActiveIndex(fromIndex: number): number {
    const count = this.players.length;
    let idx = (fromIndex + 1) % count;
    let safety = 0;
    while (this.players[idx].isOut && safety < count) {
      idx = (idx + 1) % count;
      safety++;
    }
    return idx;
  }

  private getPrevActiveIndex(fromIndex: number): number {
    const count = this.players.length;
    let idx = (fromIndex - 1 + count) % count;
    let safety = 0;
    while (this.players[idx].isOut && safety < count) {
      idx = (idx - 1 + count) % count;
      safety++;
    }
    return idx;
  }

  private getNextActivePlayer(fromIndex: number): InternalPlayer | null {
    const idx = this.getNextActiveIndex(fromIndex);
    return this.players[idx]?.isOut === false ? this.players[idx] : null;
  }

  private haveAllAttackersPassed(): boolean {
    for (const player of this.players) {
      if (player.isOut) continue;
      if (player.userId === this.players[this.currentDefenderIndex].userId) continue;

      const canAttack =
        player.userId === this.players[this.currentAttackerIndex].userId ||
        this.canPlayerCoAttack(player);

      if (canAttack && !this.passedPlayers.has(player.userId)) {
        return false;
      }
    }
    return true;
  }
}
