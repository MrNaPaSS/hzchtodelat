import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { config } from '../config/index.js';
import { verifyToken, AuthUser } from '../middleware/auth.js';
import { gameManager } from '../game/index.js';
import { GameAction, ClientToServerEvents, ServerToClientEvents, GameState } from 'shared';
import { logger } from '../lib/logger.js';

interface AuthenticatedSocket extends Socket<ClientToServerEvents, ServerToClientEvents> {
  user: AuthUser;
}

/** Map userId → socketId for routing messages to specific players */
const userSocketMap = new Map<string, string>();

let ioInstance: SocketIOServer | null = null;

export function forceJoinGameRoom(userId: string, gameId: string) {
  if (!ioInstance) return;
  const socketId = userSocketMap.get(userId);
  if (!socketId) return;

  const socket = ioInstance.sockets.sockets.get(socketId);
  if (socket) {
    socket.join(`game:${gameId}`);
    logger.debug(`Forced user ${userId} to join room game:${gameId}`);
    
    // Immediately send state
    const state = gameManager.getGameState(userId);
    if (state) {
      socket.emit('game:state', state);
    }
  }
}

export function setupSocketIO(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: [config.CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 10000,
  });

  // ============================================================
  // AUTH MIDDLEWARE
  // ============================================================

  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const user = verifyToken(token);
    if (!user) {
      return next(new Error('Invalid token'));
    }

    (socket as AuthenticatedSocket).user = user;
    next();
  });

  // ============================================================
  // GAME MANAGER CALLBACKS
  // ============================================================

  gameManager.setCallbacks({
    onGameStateUpdate: (gameId: string, userId: string, state: GameState) => {
      const socketId = userSocketMap.get(userId);
      if (socketId) {
        io.to(socketId).emit('game:state', state);
      }
    },
    onGameEnd: (gameId, result) => {
      io.to(`game:${gameId}`).emit('game:end', result);
      logger.info(`Game ${gameId} ended`, { result });
      
      // Process XP and Rating progression
      import('../game/ProgressionManager.js').then(({ progressionManager }) => {
        progressionManager.processGameResults(result).catch(err => {
          logger.error(`Progression processing failed for game ${gameId}:`, err);
        });
      });
    },
    onTurnTimeout: (gameId, userId) => {
      io.to(`game:${gameId}`).emit('game:timer', { remainingSeconds: 0 });
    },
  });

  // ============================================================
  // CONNECTION HANDLER
  // ============================================================

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const { user } = socket;

    userSocketMap.set(user.id, socket.id);
    logger.info(`Socket connected: ${user.username} (${socket.id})`);

    // Rejoin active game room if player was in a game
    const activeGameId = gameManager.getPlayerGameId(user.id);
    if (activeGameId) {
      socket.join(`game:${activeGameId}`);
      const state = gameManager.getGameState(user.id);
      if (state) {
        socket.emit('game:state', state);
      }
    }

    // ─── GAME JOIN ───────────────────────────────────────────

    socket.on('game:join', ({ gameId }) => {
      socket.join(`game:${gameId}`);
      logger.debug(`${user.username} joined game room ${gameId}`);

      const state = gameManager.getGameState(user.id);
      if (state) {
        socket.emit('game:state', state);
      }
    });

    // ─── GAME ACTION ─────────────────────────────────────────

    socket.on('game:action', (action: GameAction) => {
      const result = gameManager.processAction(user.id, action);

      socket.emit('game:action_result', result);

      if (!result.success) {
        logger.debug(`Invalid action from ${user.username}:`, { action, error: result.error });
      }
    });

    // ─── EMOJI ───────────────────────────────────────────────

    socket.on('game:emoji', ({ emoji }) => {
      const gameId = gameManager.getPlayerGameId(user.id);
      if (gameId) {
        socket.to(`game:${gameId}`).emit('game:emoji', {
          userId: user.id,
          emoji,
        });
      }
    });

    // ─── CHAT ────────────────────────────────────────────────

    socket.on('game:chat', ({ message }) => {
      const gameId = gameManager.getPlayerGameId(user.id);
      if (gameId) {
        const sanitized = message.slice(0, 200).trim();
        if (sanitized) {
          io.to(`game:${gameId}`).emit('game:chat', {
            userId: user.id,
            message: sanitized,
            timestamp: Date.now(),
          });
        }
      }
    });

    // ─── SURRENDER ───────────────────────────────────────────

    socket.on('game:surrender', () => {
      const result = gameManager.processAction(user.id, { type: 'surrender' as any });
      socket.emit('game:action_result', result);
    });

    // ─── DISCONNECT ──────────────────────────────────────────

    socket.on('disconnect', (reason) => {
      userSocketMap.delete(user.id);
      logger.info(`Socket disconnected: ${user.username} (${reason})`);
    });
  });

  logger.info('✅ Socket.IO initialized');
  ioInstance = io;
  return io;
}
