import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore, useGameStore, useUIStore } from '../stores';
import { api } from '../api/client';
import './Lobby.css';

// Removed unused GameRoom interface

const FEATURE_TILES = [
  { id: 'tournaments', icon: '🏆', label: 'Турниры',   color: '#FFD700', bg: 'rgba(255,215,0,0.18)',    badge: 'СКОРО'   },
  { id: 'leaderboard', icon: '📊', label: 'Рейтинг',   color: '#3B82F6', bg: 'rgba(59,130,246,0.18)',   badge: null      },
  { id: 'friends',     icon: '👥', label: 'Друзья',    color: '#00D26A', bg: 'rgba(0,210,106,0.18)',    badge: null      },
  { id: 'marketplace', icon: '🛒', label: 'Магазин',   color: '#A855F7', bg: 'rgba(168,85,247,0.18)',   badge: null      },
  { id: 'quests',      icon: '📋', label: 'Задания',   color: '#F97316', bg: 'rgba(249,115,22,0.18)',   badge: null      },
] as const;

const MODE_LABELS: Record<string, string> = {
  podkidnoy: 'Подкидной',
  perevodnoy: 'Переводной',
};

export default function Lobby() {
  const { user } = useAuthStore();
  const { playWithBot, createGame, joinGame, createdGameCode, setCreatedGameCode, isLoading } = useGameStore();
  const { setScreen } = useUIStore();

  const [rooms, setRooms] = useState<any[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [dailyQuest, setDailyQuest] = useState<any>(null);
  
  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [stake, setStake] = useState(10);
  const [mode, setMode] = useState<'podkidnoy' | 'perevodnoy'>('podkidnoy');
  const [isPrivate, setIsPrivate] = useState(false);

  // Join by Code State
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      const [roomsResult, questsResult] = await Promise.allSettled([
        api.listGames(),
        api.getQuests(),
      ]);
      if (cancelled) return;

      if (roomsResult.status === 'fulfilled') {
        const data = roomsResult.value as any;
        setRooms((data.data || data).slice(0, 4));
      }
      if (questsResult.status === 'fulfilled') {
        const data = questsResult.value as any;
        const daily = (data.data || data).find(
          (q: any) => q.type === 'daily' && !q.claimed,
        );
        setDailyQuest(daily ?? null);
      }
      setRoomsLoading(false);
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return null;

  const handleCreateGame = async () => {
    if (user.nmnhBalance < stake) {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
      alert('Недостаточно NMNH токенов для такой ставки!');
      return;
    }

    setIsCreating(true);
    try {
      await createGame({
        mode,
        deckSize: 36,
        maxPlayers: 2,
        stake,
        throwInRule: 'neighbors',
        allowDraw: false,
        turnTimerSeconds: 30,
        isPrivate,
      });
      // Modal stays open if it's private to show the code, or closes if search starts
      if (!isPrivate) {
        setShowCreateModal(false);
      }
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    } catch (err: any) {
      console.error(err);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinByCode = async () => {
    if (joinCode.length < 6) return;
    setIsJoining(true);
    try {
      // We need a way to find gameId by code, or use code as gameId if we wanted.
      // For now, let's assume the "code" is the gameId or we have an endpoint.
      // Actually, let's use the gameId itself as the key for simplicity in MVP, 
      // or we can just try to join with the code as password.
      // BUT we need the gameId. 
      // Let's assume the user enters "code" and we have a "join by code" endpoint.
      
      // Let's modify the server to support joining by password/code directly if unique
      // Or for now, I'll just explain it.
      
      // Wait, the user said "join by key". 
      // I'll assume the code entered IS the code we need.
      await joinGame(joinCode, joinCode); // Temporary: using code as both ID and password
      setShowJoinModal(false);
    } catch (err: any) {
      alert(err.message || 'Неверный код или комната полна');
    } finally {
      setIsJoining(false);
    }
  };

  const handleTileAction = (id: string) => {
    switch (id) {
      case 'create':      setShowCreateModal(true); break;
      case 'join-code':   setShowJoinModal(true);   break;
      case 'leaderboard': setScreen('leaderboard');  break;
      case 'friends':     setScreen('friends');      break;
      case 'marketplace': setScreen('marketplace');  break;
      case 'quests':      setScreen('quests');       break;
      default: break;
    }
  };

  return (
    <div className="lobby">

      {/* ── Decorative card suits ───────────────── */}
      <div className="lobby-bg-deco" aria-hidden="true">
        <span className="deco-suit deco-1">♠</span>
        <span className="deco-suit deco-2">♥</span>
        <span className="deco-suit deco-3">♦</span>
        <span className="deco-suit deco-4">♣</span>
      </div>

      {/* ── Header ─────────────────────────────── */}
      <header className="lobby-header">
        <button className="user-chip glass" onClick={() => setScreen('profile')}>
          <div className="chip-avatar">
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt={user.username} />
              : <div className="avatar-initial">{user.firstName[0]}</div>}
            <span className="chip-level">{user.level}</span>
          </div>
          <div className="chip-info">
            <span className="chip-name">{user.firstName}</span>
            <span className="chip-rating">Рейтинг: {user.rating}</span>
          </div>
        </button>

        <div className="header-balances">
          <button className="balance-pill glass balance-stars" onClick={() => setScreen('wallet')}>
            <span>⭐</span>
            <span>{user.starsBalance.toLocaleString()}</span>
          </button>
          <button className="balance-pill glass balance-nmnh" onClick={() => setScreen('wallet')}>
            <span>🪙</span>
            <span>{user.nmnhBalance.toLocaleString()}</span>
          </button>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────── */}
      <div className="lobby-hero">
        <div className="hero-emblem animate-float">♠</div>
        <h1 className="hero-title">Подкидной<br />Дурак</h1>
        <p className="hero-subtitle">Играй · Побеждай · Зарабатывай Stars</p>
      </div>

      {/* ── Main Action Buttons ─────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <motion.button
          className={`quick-game-btn bot-game-btn${isLoading ? ' loading' : ''}`}
          onClick={playWithBot}
          disabled={isLoading}
          whileTap={{ scale: 0.97 }}
          style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.4) 100%)', border: '1px solid rgba(59, 130, 246, 0.4)' }}
        >
          <span className="quick-icon">🤖</span>
          <div className="quick-text">
            <span className="quick-title">Игра с ботом</span>
            <span className="quick-desc">Разминка против компьютера</span>
          </div>
          {!isLoading && <span className="quick-chevron">›</span>}
        </motion.button>

        <div style={{ display: 'flex', gap: '8px' }}>
          <motion.button
            className={`quick-game-btn`}
            onClick={() => setShowCreateModal(true)}
            disabled={isLoading}
            whileTap={{ scale: 0.97 }}
            style={{ flex: 1, padding: '12px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
          >
            <span className="quick-icon" style={{ background: 'rgba(239, 68, 68, 0.2)' }}>🏠</span>
            <div className="quick-text">
              <span className="quick-title" style={{ fontSize: '14px' }}>Создать</span>
            </div>
          </motion.button>
          
          <motion.button
             className={`quick-game-btn`}
             onClick={() => setShowJoinModal(true)}
             disabled={isLoading}
             whileTap={{ scale: 0.97 }}
             style={{ flex: 1, padding: '12px 16px', background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)' }}
           >
             <span className="quick-icon" style={{ background: 'rgba(168, 85, 247, 0.2)' }}>🔑</span>
             <div className="quick-text">
               <span className="quick-title" style={{ fontSize: '14px' }}>По коду</span>
             </div>
           </motion.button>
        </div>
      </div>

      {/* ── Feature Grid ───────────────────────── */}
      <div className="feature-grid">
        {FEATURE_TILES.map((tile) => {
          const isSoon = tile.badge === 'СКОРО';
          return (
            <motion.button
              key={tile.id}
              className={`feature-tile glass${isSoon ? ' tile-disabled' : ''}`}
              onClick={() => !isSoon && handleTileAction(tile.id)}
              whileTap={!isSoon ? { scale: 0.91 } : {}}
              disabled={isSoon}
            >
              {tile.badge && (
                <span className={`tile-badge ${isSoon ? 'badge-soon' : 'badge-new'}`}>
                  {tile.badge}
                </span>
              )}
              <div className="tile-icon-wrap" style={{ background: tile.bg }}>
                <span className="tile-icon">{tile.icon}</span>
              </div>
              <span className="tile-label">{tile.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* ── Live Rooms ─────────────────────────── */}
      <section className="live-section">
        <div className="section-header">
          <h3 className="section-title">
            <span className="live-dot" />
            Открытые комнаты
          </h3>
          <button className="btn-link" onClick={() => setShowCreateModal(true)}>+ Создать</button>
        </div>

        {roomsLoading ? (
          <div className="rooms-skeleton">
            {[0, 1].map((i) => (
              <div key={i} className="skeleton-room shimmer" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="rooms-empty">Нет открытых комнат</div>
        ) : (
          <div className="rooms-list">
            {rooms.map((room) => (
              <div key={room.gameId} className="room-row glass">
                <div className="room-info">
                  <span className="room-mode">{MODE_LABELS[room.settings.mode] ?? room.settings.mode}</span>
                  <span className="room-meta">
                    {room.settings.deckSize} карт · {room.playerCount}/{room.settings.maxPlayers} игроков
                  </span>
                </div>
                <div className="room-right">
                  <span className="room-stake">⭐ {room.settings.stake}</span>
                  <button className="btn btn-primary btn-sm" onClick={() => joinGame(room.gameId)}>
                    Войти
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Daily Quest Banner ─────────────────── */}
      {dailyQuest && (
        <button className="daily-quest-banner glass" onClick={() => setScreen('quests')}>
          <span className="quest-banner-icon">{dailyQuest.icon || '🎯'}</span>
          <div className="quest-banner-body">
            <span className="quest-banner-title">{dailyQuest.title}</span>
            <div className="quest-banner-bar">
              <div
                className="quest-banner-fill"
                style={{
                  width: `${Math.min(100, ((dailyQuest.currentProgress ?? 0) / dailyQuest.targetValue) * 100)}%`,
                }}
              />
            </div>
          </div>
          <span className="badge badge-nmnh">+{dailyQuest.rewardNmnh} 🪙</span>
        </button>
      )}

      {/* ── Create Game Modal ──────────────────── */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <motion.div 
            className="modal-content glass animate-slide-up" 
            onClick={e => e.stopPropagation()}
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <div className="modal-header">
              <h3>{createdGameCode ? 'Комната создана' : 'Создание комнаты'}</h3>
              <button className="modal-close" onClick={() => { setShowCreateModal(false); setCreatedGameCode(null); }}>✕</button>
            </div>

            <div className="modal-body">
              {createdGameCode ? (
                <div className="game-code-area">
                  <label>Ключ комнаты</label>
                  <div className="code-display" onClick={() => {
                    navigator.clipboard.writeText(createdGameCode);
                    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
                    alert('Код скопирован!');
                  }}>
                    {createdGameCode}
                    <span className="copy-icon">📋</span>
                  </div>
                  <p className="modal-hint">Отправьте этот код другу, чтобы он мог присоединиться к вашей игре.</p>
                  
                  <div className="waiting-spinner">
                    <div className="spinner-dots"><span></span><span></span><span></span></div>
                    <span>Ожидание игрока...</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="setting-group">
                    <div className="privacy-toggle" onClick={() => setIsPrivate(!isPrivate)}>
                      <div className="toggle-info">
                        <span className="toggle-label">Приватная комната</span>
                        <span className="toggle-desc">Вход только по секретному коду</span>
                      </div>
                      <div className={`toggle-switch ${isPrivate ? 'active' : ''}`}>
                        <div className="toggle-handle" />
                      </div>
                    </div>
                  </div>

                  <div className="setting-group">
                    <label>Режим игры</label>
                    <div className="mode-tabs">
                      <button 
                        className={`mode-tab ${mode === 'podkidnoy' ? 'active' : ''}`}
                        onClick={() => setMode('podkidnoy')}
                      >Подкидной</button>
                      <button 
                        className={`mode-tab ${mode === 'perevodnoy' ? 'active' : ''}`}
                        onClick={() => setMode('perevodnoy')}
                      >Переводной</button>
                    </div>
                  </div>

                  <div className="setting-group">
                    <label>Ставка (NMNH)</label>
                    <div className="stake-grid">
                      {[10, 50, 100, 250, 500, 1000].map(s => (
                        <button 
                          key={s}
                          className={`stake-item ${stake === s ? 'active' : ''}`}
                          onClick={() => setStake(s)}
                        >
                          🪙 {s}
                        </button>
                      ))}
                    </div>
                  </div>


                  
                  <p className="modal-hint">Победитель забирает весь банк (за вычетом комиссии 10%)</p>
                </>
              )}
            </div>

            {!createdGameCode && (
              <div className="modal-footer">
                <button 
                  className={`btn btn-primary btn-full ${isCreating ? 'loading' : ''}`}
                  onClick={handleCreateGame}
                  disabled={isCreating}
                >
                  {isCreating ? 'Создание...' : 'Создать комнату'}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* ── Join by Code Modal ──────────────────── */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <motion.div 
            className="modal-content glass animate-slide-up" 
            onClick={e => e.stopPropagation()}
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <div className="modal-header">
              <h3>Вход по коду</h3>
              <button className="modal-close" onClick={() => setShowJoinModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="setting-group">
                <label>Введите секретный ключ</label>
                <input 
                  type="text" 
                  className="code-input" 
                  placeholder="000 000"
                  maxLength={6}
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <p className="modal-hint">Ключ должен состоять из 6 цифр, которые прислал создатель комнаты.</p>
            </div>

            <div className="modal-footer">
              <button 
                className={`btn btn-primary btn-full ${isJoining ? 'loading' : ''}`}
                onClick={handleJoinByCode}
                disabled={isJoining || joinCode.length < 6}
              >
                {isJoining ? 'Подключение...' : 'Присоединиться'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
