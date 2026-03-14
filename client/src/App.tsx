import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore, useGameStore, useUIStore } from './stores';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import GameResults from './components/GameResults';
import BottomNav from './components/BottomNav';
import LoadingScreen from './components/LoadingScreen';
import Marketplace from './components/Marketplace';
import Quests from './components/Quests';
import Wallet from './components/Wallet';
import Profile from './components/Profile';
import Friends from './components/Friends';
import './App.css';

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -6 },
};

const pageTransition = {
  duration: 0.20,
  ease: [0.4, 0, 0.2, 1] as const,
};

export default function App() {
  const { isAuthenticated, isLoading, error, authenticate } = useAuthStore();
  const { view, initSocketListeners } = useGameStore();
  const { screen } = useUIStore();

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setBackgroundColor('#060B1A');
      tg.setHeaderColor('#060B1A');
    }

    const initData = tg?.initData;
    const isDevMode = window.location.search.includes('dev=true') || import.meta.env.DEV;

    if (initData) {
      authenticate(initData);
    } else if (isDevMode) {
      authenticate('mock_init_data');
    }
    // If neither, authenticate will not be called, and it will stay on checking screen
  }, [authenticate]);

  useEffect(() => {
    if (isAuthenticated) {
      initSocketListeners();
    }
  }, [isAuthenticated, initSocketListeners]);

  // Mandatory Telegram check (unless in dev)
  const isWebAccess = !window.Telegram?.WebApp?.initData;
  const isDevMode = window.location.search.includes('dev=true') || import.meta.env.DEV;

  if (isWebAccess && !isDevMode) {
    return (
      <div className="error-screen access-denied">
        <div className="error-icon">📱</div>
        <h2>Только в Telegram</h2>
        <p>Для игры запустите нашего бота в приложении Telegram.</p>
        <div style={{ marginTop: '20px' }}>
          <a
            href="https://t.me/durak_online_bot"
            className="btn btn-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            Открыть бота
          </a>
        </div>
      </div>
    );
  }

  if (isLoading) return <LoadingScreen />;

  if (error) {
    return (
      <div className="error-screen">
        <div className="error-icon">⚠️</div>
        <h2>Ошибка подключения</h2>
        <p>{error}</p>
        <button className="btn btn-primary btn-lg" onClick={() => window.location.reload()}>
          Попробовать снова
        </button>
      </div>
    );
  }

  if (!isAuthenticated) return <LoadingScreen />;

  // Game views take priority over screen navigation
  if (view === 'playing') return <GameBoard />;
  if (view === 'results') return <GameResults />;

  if (view === 'searching') {
    return (
      <div className="searching-screen">
        <div className="searching-animation">
          <div className="searching-ring" />
          <div className="searching-ring delay-1" />
          <div className="searching-ring delay-2" />
          <span className="searching-icon">🃏</span>
        </div>
        <h2>Поиск игры...</h2>
        <p className="text-muted">Ищем достойного соперника</p>
        <button
          className="btn btn-secondary"
          onClick={() => useGameStore.getState().resetGame()}
        >
          Отмена
        </button>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <main className="app-main">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={screen}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            style={{ height: '100%' }}
          >
            {screen === 'lobby'       && <Lobby />}
            {screen === 'marketplace' && <Marketplace />}
            {screen === 'quests'      && <Quests />}
            {screen === 'wallet'      && <Wallet />}
            {screen === 'profile'     && <Profile />}
            {screen === 'friends'     && <Friends />}
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  );
}
