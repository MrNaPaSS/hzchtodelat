import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuthStore } from '../stores';
import PageTopBar from './PageTopBar';
import './Quests.css';

interface Quest {
  id: string;
  title: string;
  description: string;
  type: string;
  targetValue: number;
  rewardNmnh: number;
  rewardStars: number;
  icon: string;
  currentProgress: number;
  completed: boolean;
  claimed: boolean;
}

const TABS = [
  { id: 'daily',       label: 'Ежедневные', icon: '📅' },
  { id: 'weekly',      label: 'Еженед.',    icon: '📆' },
  { id: 'achievement', label: 'Достижения', icon: '🏅' },
];

export default function Quests() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [activeTab, setActiveTab] = useState('daily');
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const { refreshProfile } = useAuthStore();

  useEffect(() => {
    api.getQuests()
      .then(setQuests)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleClaim = async (questId: string) => {
    setClaiming(questId);
    try {
      await api.claimQuest(questId);
      await refreshProfile();
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      setQuests((prev) => prev.map((q) => q.id === questId ? { ...q, claimed: true } : q));
    } catch {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
    } finally {
      setClaiming(null);
    }
  };

  const filtered = quests.filter((q) => q.type === activeTab);

  const completedCount = filtered.filter((q) => q.completed || q.claimed).length;
  const totalCount    = filtered.length;

  return (
    <div className="quests page-wrap">

      {/* ── Header ─────────────────────────────── */}
      <PageTopBar title="Задания" subtitle="Выполняй задания — зарабатывай NMNH" />

      {/* ── Tabs ───────────────────────────────── */}
      <div className="quests-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`quests-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Progress summary ───────────────────── */}
      {!loading && totalCount > 0 && (
        <div className="quests-summary glass">
          <div className="summary-info">
            <span className="summary-done">{completedCount}/{totalCount}</span>
            <span className="summary-label">заданий выполнено</span>
          </div>
          <div className="summary-bar">
            <div
              className="summary-fill"
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Quest list ─────────────────────────── */}
      {loading ? (
        <div className="quest-skeletons">
          {[0, 1, 2].map((i) => (
            <div key={i} className="quest-skeleton shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="quests-empty">
          <span className="quests-empty-icon">📋</span>
          <p>Нет заданий в этой категории</p>
        </div>
      ) : (
        <div className="quests-list">
          {filtered.map((quest) => {
            const pct = Math.min(100, Math.round((quest.currentProgress / quest.targetValue) * 100));
            const isDone = quest.completed && !quest.claimed;
            const isClaimed = quest.claimed;

            return (
              <div
                key={quest.id}
                className={`quest-card card-surface ${isClaimed ? 'quest-claimed' : ''} ${isDone ? 'quest-ready' : ''}`}
              >
                <div className="quest-icon-wrap">
                  <span className="quest-icon">{quest.icon || '🎯'}</span>
                  {isDone && <span className="quest-ready-dot" />}
                </div>

                <div className="quest-body">
                  <h3 className="quest-title">{quest.title}</h3>
                  <p className="quest-desc text-muted">{quest.description}</p>
                  <div className="quest-progress">
                    <div className="quest-bar">
                      <div className="quest-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="quest-progress-text">
                      {quest.currentProgress}/{quest.targetValue}
                    </span>
                  </div>
                </div>

                <div className="quest-reward">
                  {isClaimed ? (
                    <span className="quest-check">✅</span>
                  ) : isDone ? (
                    <button
                      className="btn btn-primary btn-sm claim-btn"
                      onClick={() => handleClaim(quest.id)}
                      disabled={claiming === quest.id}
                    >
                      {claiming === quest.id ? '...' : 'Забрать'}
                    </button>
                  ) : (
                    <div className="quest-rewards-preview">
                      {quest.rewardNmnh > 0 && (
                        <span className="badge badge-nmnh">+{quest.rewardNmnh}🪙</span>
                      )}
                      {quest.rewardStars > 0 && (
                        <span className="badge badge-stars">+{quest.rewardStars}⭐</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
