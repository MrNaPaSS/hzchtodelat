import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { asyncHandler, BadRequestError, NotFoundError } from '../middleware/errorHandler.js';
import { gameManager } from '../game/index.js';
import { BotPlayer } from '../game/BotPlayer.js';
import { GameMode, DeckSize, ThrowInRule, GameSettings } from 'shared';

const router = Router();

// All game routes require authentication
router.use(authMiddleware);

const createGameSchema = z.object({
  mode: z.nativeEnum(GameMode),
  deckSize: z.nativeEnum(DeckSize),
  maxPlayers: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  stake: z.number().int().min(1).max(10000),
  throwInRule: z.nativeEnum(ThrowInRule).default(ThrowInRule.Neighbors),
  allowDraw: z.boolean().default(false),
  turnTimerSeconds: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(90)]).default(30),
  isPrivate: z.boolean().default(false),
  password: z.string().optional(),
});

/**
 * POST /api/games — Create a new game room
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const settings = createGameSchema.parse(req.body);
    const user = req.user!;

    // Auto-generate numeric password if private and not provided
    if (settings.isPrivate && !settings.password) {
      settings.password = Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Check if player is already in a game
    const existingGameId = gameManager.getPlayerGameId(user.id);
    if (existingGameId) {
      throw new BadRequestError('Already in a game. Leave current game first.');
    }

    const gameId = gameManager.createGame(settings as GameSettings);

    // Auto-join the creator
    gameManager.joinGame(gameId, {
      userId: user.id,
      username: user.username,
      firstName: user.firstName,
      avatarUrl: '',
      rating: 1000,
    });

    res.status(201).json({
      success: true,
      data: { gameId, password: settings.password },
    });
  }),
);

/**
 * POST /api/games/bot — Create a game and auto-fill with a bot
 */
router.post(
  '/bot',
  asyncHandler(async (req, res) => {
    const user = req.user!;

    const existingGameId = gameManager.getPlayerGameId(user.id);
    if (existingGameId) {
      throw new BadRequestError('Already in a game. Leave current game first.');
    }

    const gameId = gameManager.createGame({
      mode: GameMode.Podkidnoy,
      deckSize: DeckSize.Medium,
      maxPlayers: 2,
      stake: 10,
      throwInRule: ThrowInRule.Neighbors,
      allowDraw: false,
      turnTimerSeconds: 30,
      isPrivate: true,
    });

    gameManager.joinGame(gameId, {
      userId: user.id,
      username: user.username,
      firstName: user.firstName,
      avatarUrl: '',
      rating: 1000,
    });

    // Add exactly 1 bot to make it a 2-player game.
    new BotPlayer(gameId, 1);
    
    // Auto-start since room should be full (1 player + 1 bot)
    const game = gameManager.getGame(gameId);
    if (game?.engine.canStart()) {
      gameManager.startGame(gameId);
    }

    res.status(201).json({
      success: true,
      data: { gameId },
    });
  }),
);

/**
 * GET /api/games — List waiting games
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const games = gameManager.getWaitingGames();

    res.json({
      success: true,
      data: games.filter((g) => !g.settings.isPrivate),
    });
  }),
);

/**
 * POST /api/games/:id/join — Join an existing game
 */
router.post(
  '/:id/join',
  asyncHandler(async (req, res) => {
    const { id: gameId } = req.params;
    const { password } = req.body;
    const user = req.user!;

    const game = gameManager.getGame(gameId);
    if (!game) {
      throw new NotFoundError('Game');
    }

    // Check password if private
    if (game.engine.getStateForPlayer('').settings.isPrivate) {
      const actualPassword = game.engine.getStateForPlayer('').settings.password;
      if (actualPassword && actualPassword !== password) {
        throw new BadRequestError('Invalid room key');
      }
    }

    const success = gameManager.joinGame(gameId, {
      userId: user.id,
      username: user.username,
      firstName: user.firstName,
      avatarUrl: '',
      rating: 1000,
    });

    if (!success) {
      throw new BadRequestError('Cannot join game. It may be full or already started.');
    }

    // Auto-start if enough players
    if (game.engine.canStart() && game.engine.getPlayerCount() === game.engine.getStateForPlayer('').settings.maxPlayers) {
      gameManager.startGame(gameId);
    }

    res.json({
      success: true,
      data: { gameId },
    });
  }),
);

/**
 * POST /api/games/quick — Quick match / auto-matchmaking
 */
router.post(
  '/quick',
  asyncHandler(async (req, res) => {
    const user = req.user!;

    // Check if already in a game
    const existingGameId = gameManager.getPlayerGameId(user.id);
    if (existingGameId) {
      throw new BadRequestError('Already in a game');
    }

    // Try to find a waiting game with matching criteria
    const waitingGames = gameManager.getWaitingGames();
    const match = waitingGames.find(
      (g) => !g.settings.isPrivate && g.playerCount < g.settings.maxPlayers,
    );

    let gameId: string;

    if (match) {
      gameId = match.gameId;
      gameManager.joinGame(gameId, {
        userId: user.id,
        username: user.username,
        firstName: user.firstName,
        avatarUrl: '',
        rating: 1000,
      });

      // Auto-start if full
      const game = gameManager.getGame(gameId);
      if (game?.engine.canStart() && game.engine.getPlayerCount() === game.engine.getStateForPlayer('').settings.maxPlayers) {
        gameManager.startGame(gameId);
      }
    } else {
      // Create a new game with default settings
      gameId = gameManager.createGame({
        mode: GameMode.Podkidnoy,
        deckSize: DeckSize.Medium,
        maxPlayers: 2,
        stake: 10,
        throwInRule: ThrowInRule.Neighbors,
        allowDraw: false,
        turnTimerSeconds: 30,
        isPrivate: false,
      });

      gameManager.joinGame(gameId, {
        userId: user.id,
        username: user.username,
        firstName: user.firstName,
        avatarUrl: '',
        rating: 1000,
      });
    }

    res.json({
      success: true,
      data: { gameId },
    });
  }),
);

export default router;
