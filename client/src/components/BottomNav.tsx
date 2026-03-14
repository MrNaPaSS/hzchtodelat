import { motion } from 'framer-motion';
import { useUIStore, useGameStore } from '../stores';
import './BottomNav.css';

/* ── SVG icon components ──────────────────────────────────── */

function HomeIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill={filled ? 'currentColor' : 'none'} fillOpacity={filled ? 0.15 : 0} />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function ShopIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" fill={filled ? 'currentColor' : 'none'} fillOpacity={filled ? 0.15 : 0} />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function QuestsIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill={filled ? 'currentColor' : 'none'} fillOpacity={filled ? 0.15 : 0} />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function WalletIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" fill={filled ? 'currentColor' : 'none'} fillOpacity={filled ? 0.15 : 0} />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function FriendsIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" fill={filled ? 'currentColor' : 'none'} fillOpacity={filled ? 0.15 : 0} />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/* ── Nav items ────────────────────────────────────────────── */

const NAV_ITEMS = [
  { id: 'lobby'       as const, Icon: HomeIcon,    label: 'Лоби'    },
  { id: 'marketplace' as const, Icon: ShopIcon,    label: 'Магазин' },
  { id: 'quests'      as const, Icon: QuestsIcon,  label: 'Задания' },
  { id: 'wallet'      as const, Icon: WalletIcon,  label: 'Кошелёк' },
  { id: 'friends'     as const, Icon: FriendsIcon, label: 'Друзья'  },
];

/* ── Component ────────────────────────────────────────────── */

export default function BottomNav() {
  const { screen, setScreen } = useUIStore();
  const { view } = useGameStore();

  if (view !== 'lobby') return null;

  // resolve active nav item — profile goes to lobby highlight
  const activeId = (screen === 'profile' || screen === 'leaderboard' || screen === 'settings')
    ? null
    : screen;

  return (
    <nav className="bottom-nav">
      <div className="nav-inner glass">
        {NAV_ITEMS.map(({ id, Icon, label }) => {
          const isActive = activeId === id;
          return (
            <button
              key={id}
              className={`nav-item${isActive ? ' active' : ''}`}
              onClick={() => setScreen(id)}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Animated pill indicator */}
              {isActive && (
                <motion.div
                  layoutId="nav-pill"
                  className="nav-pill"
                  transition={{ type: 'spring', bounce: 0.3, duration: 0.4 }}
                />
              )}

              <div className="nav-icon-wrap">
                <Icon filled={isActive} />
              </div>
              <span className="nav-label">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
