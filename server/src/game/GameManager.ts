import { GameSettings, GameState, GameAction, GameActionResult, GameEndResult } from 'shared';
import { DurakEngine } from './DurakEngine.js';
import { logger } from '../lib/logger.js';
import { v4 as uuid } from 'uuid';

interface ActiveGame {
  engine: DurakEngine;
  createdAt: Date;
  turnTimeout: NodeJS.Timeout | null;
}

/**
 * Manages all active game instances in memory.
 * Responsible for game lifecycle, matchmaking queue, and turn timers.
 */
export class GameManager {
  private games: Map<string, ActiveGame> = new Map();
  private playerGameMap: Map<string, string> = new Map(); // userId → gameId

  private onGameStateUpdate?: (gameId: string, userId: string, state: GameState) => void;
  private onGameEnd?: (gameId: string, result: GameEndResult) => void;
  private onTurnTimeout?: (gameId: string, userId: string) => void;

  /**
   * Register callbacks for game events.
   */
  setCallbacks(callbacks: {
    onGameStateUpdate: (gameId: string, userId: string, state: GameState) => void;
    onGameEnd: (gameId: string, result: GameEndResult) => void;
    onTurnTimeout: (gameId: string, userId: string) => void;
  }): void {
    this.onGameStateUpdate = callbacks.onGameStateUpdate;
    this.onGameEnd = callbacks.onGameEnd;
    this.onTurnTimeout = callbacks.onTurnTimeout;
  }

  /**
   * Creates a new game room with given settings.
   */
  createGame(settings: GameSettings): string {
    const gameId = uuid();
    const engine = new DurakEngine(gameId, settings);

    this.games.set(gameId, {
      engine,
      createdAt: new Date(),
      turnTimeout: null,
    });

    logger.info(`Game ${gameId} created`, { settings });
    return gameId;
  }

  /**
   * Adds a player to an existing game.
   */
  joinGame(
    gameId: string,
    player: {
      userId: string;
      username: string;
      firstName: string;
      avatarUrl: string;
      rating: number;
    },
  ): boolean {
    const game = this.games.get(gameId);
    if (!game) return false;

    // Check if player is already in another game
    const existingGameId = this.playerGameMap.get(player.userId);
    if (existingGameId && existingGameId !== gameId) {
      logger.warn(`Player ${player.userId} tried to join game ${gameId} but is already in ${existingGameId}`);
      return false;
    }

    const success = game.engine.addPlayer(player);
    if (success) {
      this.playerGameMap.set(player.userId, gameId);
      logger.info(`Player ${player.userId} joined game ${gameId}`);
    }

    return success;
  }

  /**
   * Removes a player from a game (only in waiting state).
   */
  leaveGame(userId: string): boolean {
    const gameId = this.playerGameMap.get(userId);
    if (!gameId) return false;

    const game = this.games.get(gameId);
    if (!game) return false;

    const success = game.engine.removePlayer(userId);
    if (success) {
      this.playerGameMap.delete(userId);

      // If no players left, remove the game
      if (game.engine.getPlayerCount() === 0) {
        this.destroyGame(gameId);
      }
    }

    return success;
  }

  /**
   * Starts a game if enough players have joined.
   */
  startGame(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game) {
      logger.error(`startGame: Game ${gameId} not found`);
      return false;
    }

    const started = game.engine.start();
    if (started) {
      logger.info(`Game ${gameId} started successfully`);
      this.broadcastState(gameId);
      this.startTurnTimer(gameId);
    } else {
      logger.warn(`Game ${gameId} failed to start. canStart=${game.engine.canStart()}, players=${game.engine.getPlayerCount()}`);
    }

    return started;
  }

  /**
   * Processes a game action from a player.
   */
  processAction(userId: string, action: GameAction): GameActionResult {
    const gameId = this.playerGameMap.get(userId);
    if (!gameId) return { success: false, error: 'Not in a game' };

    const game = this.games.get(gameId);
    if (!game) return { success: false, error: 'Game not found' };

    const result = game.engine.processAction(userId, action);

    if (result.success) {
      // Broadcast updated state
      this.broadcastState(gameId);

      // Check if game ended
      const endResult = game.engine.getEndResult();
      if (endResult) {
        this.clearTurnTimer(gameId);
        this.onGameEnd?.(gameId, endResult);
        this.cleanupGame(gameId);
      } else {
        // Reset turn timer
        this.startTurnTimer(gameId);
      }
    }

    return result;
  }

  /**
   * Gets the game state for a specific player.
   */
  getGameState(userId: string): GameState | null {
    const gameId = this.playerGameMap.get(userId);
    if (!gameId) return null;

    const game = this.games.get(gameId);
    if (!game) return null;

    return game.engine.getStateForPlayer(userId);
  }

  /**
   * Gets the game ID a player is currently in.
   */
  getPlayerGameId(userId: string): string | null {
    return this.playerGameMap.get(userId) ?? null;
  }

  /**
   * Gets a game by ID.
   */
  getGame(gameId: string): ActiveGame | undefined {
    return this.games.get(gameId);
  }

  /**
   * Lists all waiting games (for lobby).
   */
  getWaitingGames(): Array<{ gameId: string; settings: GameSettings; playerCount: number; createdAt: Date }> {
    const result: Array<{ gameId: string; settings: GameSettings; playerCount: number; createdAt: Date }> = [];

    for (const [gameId, game] of this.games) {
      if (game.engine.getStatus() === 'waiting') {
        const state = game.engine.getStateForPlayer('');
        result.push({
          gameId,
          settings: state.settings,
          playerCount: game.engine.getPlayerCount(),
          createdAt: game.createdAt,
        });
      }
    }

    return result;
  }

  // ============================================================
  // TIMERS
  // ============================================================

  private startTurnTimer(gameId: string): void {
    this.clearTurnTimer(gameId);

    const game = this.games.get(gameId);
    if (!game) return;

    const state = game.engine.getStateForPlayer('');
    const timeoutMs = state.settings.turnTimerSeconds * 1000;

    game.turnTimeout = setTimeout(() => {
      this.handleTurnTimeout(gameId);
    }, timeoutMs);
  }

  private clearTurnTimer(gameId: string): void {
    const game = this.games.get(gameId);
    if (game?.turnTimeout) {
      clearTimeout(game.turnTimeout);
      game.turnTimeout = null;
    }
  }

  private handleTurnTimeout(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;

    const state = game.engine.getStateForPlayer('');
    const defenderId = state.currentDefenderId;

    // Timeout = defender takes or current player auto-passes
    logger.info(`Turn timeout in game ${gameId}`);
    this.onTurnTimeout?.(gameId, defenderId);

    // Auto-action: defender takes
    const result = game.engine.processAction(defenderId, { type: 'take' as any });
    if (result.success) {
      this.broadcastState(gameId);

      const endResult = game.engine.getEndResult();
      if (endResult) {
        this.onGameEnd?.(gameId, endResult);
        this.cleanupGame(gameId);
      } else {
        this.startTurnTimer(gameId);
      }
    }
  }

  // ============================================================
  // INTERNAL
  // ============================================================

  private broadcastState(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;

    for (const [userId, gId] of this.playerGameMap) {
      if (gId === gameId) {
        const state = game.engine.getStateForPlayer(userId);
        this.onGameStateUpdate?.(gameId, userId, state);
      }
    }
  }

  private cleanupGame(gameId: string): void {
    // Remove player mappings
    for (const [userId, gId] of this.playerGameMap) {
      if (gId === gameId) {
        this.playerGameMap.delete(userId);
      }
    }
  }

  private destroyGame(gameId: string): void {
    this.clearTurnTimer(gameId);
    this.cleanupGame(gameId);
    this.games.delete(gameId);
    logger.info(`Game ${gameId} destroyed`);
  }

  /**
   * Returns stats for monitoring.
   */
  getStats(): { activeGames: number; waitingGames: number; playersInGame: number } {
    let waiting = 0;
    let active = 0;

    for (const game of this.games.values()) {
      if (game.engine.getStatus() === 'waiting') waiting++;
      else active++;
    }

    return {
      activeGames: active,
      waitingGames: waiting,
      playersInGame: this.playerGameMap.size,
    };
  }
}

/** Singleton instance */
export const gameManager = new GameManager();
