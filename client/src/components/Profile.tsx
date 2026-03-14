import { useEffect } from 'react';
import { useAuthStore, useUIStore } from '../stores';
import PageTopBar from './PageTopBar';
import './Profile.css';

export default function Profile() {
  const { user, refreshProfile } = useAuthStore();
  const { setScreen } = useUIStore();

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  if (!user) return null;

  const winRate = user.stats?.winRate ?? 0;
  // @ts-ignore - xp field is in DB but might not be in types yet
  const xp = (user as any).xp || 0;
  const xpInCurrentLevel = xp % 1000;
  const xpProgress = (xpInCurrentLevel / 1000) * 100;

  const handleCopyReferral = () => {
    navigator.clipboard?.writeText(user.referralCode || '');
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
  };

  const handleShare = () => {
    const text = `Давай сыграем в Дурак Онлайн! Мой реферальный код: ${user.referralCode}`;
    const url = `https://t.me/share/url?url=${encodeURIComponent('https://t.me/durak_online_bot')}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="profile page-wrap">

      {/* ── Page Title ─────────────────────────── */}
      <PageTopBar title="Профиль" subtitle="Ваша игровая статистика" showBack />

      {/* ── Hero Card ──────────────────────────── */}
      <div className="profile-hero glass">
        <div className="profile-avatar-wrap">
          {user.avatarUrl
            ? <img className="profile-avatar-img" src={user.avatarUrl} alt={user.username} />
            : <div className="profile-avatar-placeholder">{user.firstName[0]}</div>}
          <div className="profile-level-ring">{user.level}</div>
        </div>

        <h2 className="profile-name">{user.firstName} {user.lastName ?? ''}</h2>
        {user.username && <span className="profile-username">@{user.username}</span>}

        <div className="profile-xp-container">
          <div className="profile-xp-info">
            <span>Уровень {user.level}</span>
            <span>{xpInCurrentLevel} / 1000 XP</span>
          </div>
          <div className="profile-xp-bar-bg">
            <div className="profile-xp-bar-fill" style={{ width: `${xpProgress}%` }}></div>
          </div>
        </div>

        <div className="profile-badges" style={{ marginTop: '12px' }}>
          <span className="profile-badge badge-stars">⭐ {user.rating}</span>
          {user.vipUntil && <span className="profile-badge badge-vip">👑 VIP</span>}
        </div>
      </div>

      {/* ── Stats Grid ─────────────────────────── */}
      <div className="profile-stats-grid">
        <div className="profile-stat card-surface">
          <span className="stat-icon">🎮</span>
          <span className="stat-val">{user.stats?.gamesPlayed ?? 0}</span>
          <span className="stat-name">Игр</span>
        </div>
        <div className="profile-stat card-surface">
          <span className="stat-icon">🏆</span>
          <span className="stat-val">{user.stats?.gamesWon ?? 0}</span>
          <span className="stat-name">Побед</span>
        </div>
        <div className="profile-stat card-surface">
          <span className="stat-icon">📈</span>
          <span className="stat-val">{winRate}%</span>
          <span className="stat-name">Винрейт</span>
        </div>
        <div className="profile-stat card-surface">
          <span className="stat-icon">🔥</span>
          <span className="stat-val">{user.stats?.longestStreak ?? 0}</span>
          <span className="stat-name">Рекорд</span>
        </div>
      </div>

      {/* ── Earnings ───────────────────────────── */}
      <div className="profile-earnings card-surface">
        <p className="section-label">Общий доход</p>
        <div className="earning-row">
          <div className="earning-icon-wrap earning-stars">⭐</div>
          <span className="earning-label">Telegram Stars</span>
          <span className="earning-val earning-val-stars">
            {user.stats?.totalStarsWon ?? 0}
          </span>
        </div>
        <div className="earning-row">
          <div className="earning-icon-wrap earning-nmnh">🪙</div>
          <span className="earning-label">NMNH Токены</span>
          <span className="earning-val earning-val-nmnh">
            {user.stats?.totalNmnhEarned ?? 0}
          </span>
        </div>
      </div>

      {/* ── Quick Actions ───────────────────────── */}
      <div className="profile-actions">
        <button className="btn btn-secondary profile-action-btn" onClick={() => setScreen('wallet')}>
          <span>💰</span> Кошелёк
        </button>
        <button className="btn btn-secondary profile-action-btn" onClick={() => setScreen('friends')}>
          <span>👥</span> Друзья
        </button>
      </div>

      {/* ── Referral ───────────────────────────── */}
      <div className="referral-card card-surface">
        <div className="referral-header">
          <div>
            <p className="section-label">Реферальный код</p>
            <p className="referral-subtitle">Пригласи друга — получи 500 NMNH</p>
          </div>
          <span className="referral-gift">🎁</span>
        </div>
        <div className="referral-row">
          <code className="referral-code">{user.referralCode}</code>
          <button className="btn btn-primary btn-sm" onClick={handleCopyReferral}>
            Копировать
          </button>
        </div>
        <button className="btn btn-secondary referral-share-btn" onClick={handleShare}>
          📤 Поделиться в Telegram
        </button>
      </div>
    </div>
  );
}
