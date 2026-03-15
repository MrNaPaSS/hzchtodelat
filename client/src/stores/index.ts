import { create } from 'zustand';
import type { UserProfile, GameState, GameEndResult } from 'shared';
import { api } from '../api/client';
import { connectSocket, getSocket, disconnectSocket } from '../api/socket';

// ============================================================
// AUTH STORE
// ============================================================

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  authenticate: (initData: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  authenticate: async (initData: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.authenticate(initData);
      if (!response || !response.token) {
        throw new Error('Server returned empty authentication data');
      }
      const { token, user } = response;
      api.setToken(token);
      connectSocket(token);

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: any) {
      set({
        error: err.message || 'Authentication failed',
        isLoading: false,
      });
    }
  },

  refreshProfile: async () => {
    try {
      const user = await api.getMe();
      set({ user });
    } catch (err) {
      console.error('Failed to refresh profile:', err);
    }
  },

  logout: () => {
    api.clearToken();
    disconnectSocket();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },
}));

// ============================================================
// GAME STORE
// ============================================================

type GameView = 'lobby' | 'searching' | 'playing' | 'results';

export interface EmojiReaction { id: number; userId: string; emoji: string; }
export interface GameToastItem  { id: number; message: string; type: 'info' | 'success' | 'warning' | 'error'; icon?: string; }
export interface ChatMessage    { id: number; userId: string; username: string; message: string; timestamp: number; }

interface GameStoreState {
  view: GameView;
  gameState: GameState | null;
  gameResult: GameEndResult | null;
  isLoading: boolean;
  error: string | null;
  emojiReactions: EmojiReaction[];
  gameToasts: GameToastItem[];
  chatMessages: ChatMessage[];
  isChatOpen: boolean;
  createdGameCode: string | null;

  setView: (view: GameView) => void;
  setGameState: (state: GameState) => void;
  setGameResult: (result: GameEndResult) => void;
  quickMatch: () => Promise<void>;
  playWithBot: () => Promise<void>;
  createGame: (settings: any) => Promise<void>;
  joinGame: (gameId: string, password?: string) => Promise<void>;
  sendAction: (action: any) => void;
  sendEmoji: (emoji: string) => void;
  sendChat: (message: string) => void;
  surrender: () => void;
  resetGame: () => void;
  addGameToast: (message: string, type?: GameToastItem['type'], icon?: string) => void;
  removeGameToast: (id: number) => void;
  toggleChat: () => void;
  setCreatedGameCode: (code: string | null) => void;

  initSocketListeners: () => void;
}

let _toastSeq = 0;

export const useGameStore = create<GameStoreState>((set, get) => ({
  view: 'lobby',
  gameState: null,
  gameResult: null,
  isLoading: false,
  error: null,
  emojiReactions: [],
  gameToasts: [],
  chatMessages: [],
  isChatOpen: false,
  createdGameCode: null,

  setView: (view) => set({ view }),
  setGameState: (state) => set({ gameState: state, view: 'playing' }),
  setGameResult: (result) => set({ gameResult: result, view: 'results' }),

  quickMatch: async () => {
    set({ isLoading: true, error: null, view: 'searching' });
    try {
      await api.quickMatch();
      // We don't need to manually emit 'game:join' anymore.
      // The server will automatically add us to the game and send 'game:state'.
    } catch (err: any) {
      set({ error: err.message, isLoading: false, view: 'lobby' });
    }
  },

  playWithBot: async () => {
    set({ isLoading: true, error: null, view: 'searching' });
    try {
      await api.playWithBot();
    } catch (err: any) {
      set({ error: err.message, isLoading: false, view: 'lobby' });
    }
  },

  createGame: async (settings) => {
    set({ isLoading: true, error: null, createdGameCode: null });
    try {
      const { gameId, password } = await api.createGame(settings);
      const socket = getSocket();
      socket?.emit('game:join', { gameId });
      
      set({ createdGameCode: password || null, isLoading: false });
      
      // Notify the user that they can wait in the lobby
      get().addGameToast(
        settings.isPrivate ? 'Приватная комната создана' : 'Комната создана! Ждем соперника', 
        'success', 
        '🏠'
      );
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  joinGame: async (gameId, password) => {
    set({ isLoading: true, error: null });
    try {
      await api.joinGame(gameId, password);
      const socket = getSocket();
      socket?.emit('game:join', { gameId });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  sendAction: (action) => {
    getSocket()?.emit('game:action', action);
  },

  sendEmoji: (emoji) => {
    getSocket()?.emit('game:emoji', { emoji });
  },

  sendChat: (message) => {
    getSocket()?.emit('game:chat', { message });
  },

  surrender: () => {
    getSocket()?.emit('game:surrender');
  },

  resetGame: () => {
    set({
      view: 'lobby',
      gameState: null,
      gameResult: null,
      isLoading: false,
      error: null,
      emojiReactions: [],
      gameToasts: [],
      chatMessages: [],
      isChatOpen: false,
    });
  },

  addGameToast: (message, type = 'info', icon) => {
    const id = ++_toastSeq;
    set(s => ({ gameToasts: [...s.gameToasts, { id, message, type, icon }] }));
    setTimeout(() => get().removeGameToast(id), 2800);
  },

  removeGameToast: (id) =>
    set(s => ({ gameToasts: s.gameToasts.filter(t => t.id !== id) })),

  toggleChat: () => set(s => ({ isChatOpen: !s.isChatOpen })),

  setCreatedGameCode: (code) => set({ createdGameCode: code }),

  initSocketListeners: () => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('game:state', (state) => {
      const prev = get().gameState;
      const myId = useAuthStore.getState().user?.id;
      set({ gameState: state, view: 'playing', isLoading: false });
      if (myId) {
        if (state.currentAttackerId === myId && prev?.currentAttackerId !== myId)
          get().addGameToast('Ваш ход! Атакуйте', 'success', '⚔️');
        else if (state.currentDefenderId === myId && prev?.currentDefenderId !== myId)
          get().addGameToast('Защищайтесь!', 'warning', '🛡️');
        if ((prev?.deckRemaining ?? 99) > 0 && state.deckRemaining === 0)
          get().addGameToast('Колода закончилась', 'info', '📭');
      }
    });

    socket.on('game:end', (result) => {
      set({ gameResult: result, view: 'results' });
    });

    socket.on('balance:update', ({ starsBalance, nmnhBalance }) => {
      const authStore = useAuthStore.getState();
      if (authStore.user) {
        useAuthStore.setState({
          user: { ...authStore.user, starsBalance, nmnhBalance },
        });
      }
    });

    socket.on('game:emoji', ({ userId, emoji }: { userId: string; emoji: string }) => {
      const id = ++_toastSeq;
      set(s => ({ emojiReactions: [...s.emojiReactions, { id, userId, emoji }] }));
      setTimeout(() => {
        set(s => ({ emojiReactions: s.emojiReactions.filter(r => r.id !== id) }));
      }, 2500);
    });

    socket.on('game:chat', ({ userId, message, timestamp }) => {
      const players = get().gameState?.players ?? [];
      const sender  = players.find(p => p.userId === userId);
      const username = sender?.username ?? 'Игрок';
      const id = ++_toastSeq;
      set(s => ({
        chatMessages: [...s.chatMessages.slice(-49), { id, userId, username, message, timestamp }],
      }));
    });

    socket.on('error', ({ code, message }) => {
      set({ error: `${code}: ${message}` });
      get().addGameToast(`Ошибка: ${message}`, 'error', '⚠️');
    });
  },
}));

// ============================================================
// UI STORE
// ============================================================

type Screen = 'lobby' | 'game' | 'marketplace' | 'quests' | 'wallet' | 'profile' | 'leaderboard' | 'settings' | 'friends';

interface UIState {
  screen: Screen;
  prevScreen: Screen | null;
  setScreen: (screen: Screen) => void;
  goBack: () => void;
  isModalOpen: boolean;
  modalContent: string | null;
  openModal: (content: string) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  screen: 'lobby',
  prevScreen: null,
  setScreen: (screen) => set((state) => ({ prevScreen: state.screen, screen })),
  goBack: () => {
    const { prevScreen } = get();
    set({ screen: prevScreen ?? 'lobby', prevScreen: null });
  },
  isModalOpen: false,
  modalContent: null,
  openModal: (content) => set({ isModalOpen: true, modalContent: content }),
  closeModal: () => set({ isModalOpen: false, modalContent: null }),
}));
