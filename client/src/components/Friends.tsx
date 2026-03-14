import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores';
import { api } from '../api/client';
import PageTopBar from './PageTopBar';
import './Friends.css';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  firstName: string;
  avatarUrl: string;
  rating: number;
  gamesWon: number;
}

const RANK_META: Record<number, { medal: string; color: string; bg: string }> = {
  1: { medal: '🥇', color: '#FFD700', bg: 'rgba(255,215,0,0.20)'   },
  2: { medal: '🥈', color: '#C0C0C0', bg: 'rgba(192,192,192,0.20)' },
  3: { medal: '🥉', color: '#CD7F32', bg: 'rgba(205,127,50,0.20)'  },
};

export default function Friends() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'leaderboard' | 'friends'>('leaderboard');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getLeaderboard('all', 50)
      .then(setLeaderboard)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleInvite = () => {
    const shareText = `Давай сыграем в Дурак Онлайн! Мой реферальный код: ${user?.referralCode}`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent('https://t.me/durak_online_bot')}&text=${encodeURIComponent(shareText)}`;
    window.open(shareUrl, '_blank');
  };

  const top3 = leaderboard.slice(0, 3);
  const rest  = leaderboard.slice(3);

  return (
    <div className="friends page-wrap">

      {/* ── Header ─────────────────────────────── */}
      <PageTopBar title="Сообщество" subtitle="Рейтинг и друзья" />

      {/* ── Tabs ───────────────────────────────── */}
      <div className="friends-tabs">
        <button
          className={`friends-tab ${tab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setTab('leaderboard')}
        >
          🏆 Рейтинг
        </button>
        <button
          className={`friends-tab ${tab === 'friends' ? 'active' : ''}`}
          onClick={() => setTab('friends')}
        >
          👥 Друзья
        </button>
      </div>

      {/* ── Leaderboard ────────────────────────── */}
      {tab === 'leaderboard' && (
        <>
          {/* Podium */}
          {!loading && top3.length >= 3 && (
            <div className="podium">
              {/* 2nd place */}
              <div className="podium-slot podium-2">
                <PodiumAvatar entry={top3[1]} />
                <span className="podium-name">{top3[1].firstName}</span>
                <span className="podium-rating">{top3[1].rating}</span>
                <div className="podium-base podium-base-2">2</div>
              </div>
              {/* 1st place */}
              <div className="podium-slot podium-1">
                <PodiumAvatar entry={top3[0]} crown />
                <span className="podium-name">{top3[0].firstName}</span>
                <span className="podium-rating podium-rating-gold">{top3[0].rating}</span>
                <div className="podium-base podium-base-1">1</div>
              </div>
              {/* 3rd place */}
              <div className="podium-slot podium-3">
                <PodiumAvatar entry={top3[2]} />
                <span className="podium-name">{top3[2].firstName}</span>
                <span className="podium-rating">{top3[2].rating}</span>
                <div className="podium-base podium-base-3">3</div>
              </div>
            </div>
          )}

          {/* Rest list */}
          {loading ? (
            <div className="lb-skeletons">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="lb-skeleton shimmer" />
              ))}
            </div>
          ) : (
            <div className="lb-list">
              {rest.map((entry) => {
                const rankMeta = RANK_META[entry.rank];
                const isMe = entry.userId === user?.id;
                return (
                  <div key={entry.userId} className={`lb-row ${isMe ? 'lb-me' : ''}`}>
                    <span className="lb-rank" style={rankMeta ? { color: rankMeta.color } : {}}>
                      {rankMeta ? rankMeta.medal : `#${entry.rank}`}
                    </span>
                    <div className="lb-avatar">
                      {entry.avatarUrl
                        ? <img src={entry.avatarUrl} alt="" />
                        : <div className="lb-avatar-placeholder">{entry.firstName[0]}</div>}
                    </div>
                    <div className="lb-info">
                      <span className="lb-name">
                        {entry.firstName}
                        {isMe && <span className="lb-you"> (вы)</span>}
                      </span>
                      <span className="lb-wins">{entry.gamesWon} побед</span>
                    </div>
                    <span className="lb-rating">{entry.rating}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Friends tab ────────────────────────── */}
      {tab === 'friends' && (
        <div className="friends-content">
          <div className="invite-card card-surface">
            <div className="invite-visual">
              <span className="invite-emoji">🎉</span>
            </div>
            <div className="invite-info">
              <h3>Пригласи друга</h3>
              <p>Пригласи и получи <strong>50 NMNH</strong> бонус за каждого</p>
            </div>
            <button className="btn btn-primary" onClick={handleInvite}>
              Пригласить
            </button>
          </div>

          <div className="friends-empty">
            <span className="friends-empty-icon">👥</span>
            <p>Список друзей пуст</p>
            <span className="friends-empty-hint">Пригласи друзей, чтобы играть вместе!</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Podium Avatar ──────────────────────────────────────── */

function PodiumAvatar({ entry, crown }: { entry: LeaderboardEntry; crown?: boolean }) {
  return (
    <div className={`podium-avatar-wrap ${crown ? 'podium-crown' : ''}`}>
      {crown && <span className="podium-crown-icon">👑</span>}
      {entry.avatarUrl
        ? <img className="podium-avatar" src={entry.avatarUrl} alt="" />
        : <div className="podium-avatar podium-avatar-placeholder">{entry.firstName[0]}</div>}
    </div>
  );
}
