import { useAuthStore, useUIStore } from '../stores';
import './PageTopBar.css';

interface PageTopBarProps {
  title: string;
  subtitle?: string;
  /** If true, shows a ← back button using goBack() */
  showBack?: boolean;
}

export default function PageTopBar({ title, subtitle, showBack }: PageTopBarProps) {
  const { user } = useAuthStore();
  const { goBack, setScreen, screen } = useUIStore();

  return (
    <div className="ptb-root">
      <div className="ptb-side ptb-left">
        {showBack && (
          <button className="ptb-back-btn" onClick={goBack} aria-label="Назад">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
      </div>

      <div className="ptb-center">
        <h1 className="ptb-title">{title}</h1>
        {subtitle && <p className="ptb-subtitle">{subtitle}</p>}
      </div>

      <div className="ptb-side ptb-right">
        {user && screen !== 'profile' && (
          <button
            className="ptb-avatar-btn"
            onClick={() => setScreen('profile')}
            aria-label="Профиль"
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.firstName} className="ptb-avatar-img" />
            ) : (
              <div className="ptb-avatar-initial">{user.firstName[0]}</div>
            )}
            <span className="ptb-level">{user.level}</span>
          </button>
        )}
      </div>
    </div>
  );
}
