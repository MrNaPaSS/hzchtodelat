import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuthStore } from '../stores';
import PageTopBar from './PageTopBar';
import './Wallet.css';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  description: string;
  status: string;
  createdAt: string;
}

interface WalletInfo {
  starsBalance: number;
  nmnhBalance: number;
  exchangeRate: number;
  minExchange: number;
  minWithdraw: number;
}

const TX_META: Record<string, { icon: string; color: string }> = {
  game_win:     { icon: '🏆', color: 'var(--color-primary)' },
  game_loss:    { icon: '😔', color: 'var(--color-red)'     },
  purchase:     { icon: '🛒', color: 'var(--color-purple)'  },
  deposit:      { icon: '💰', color: 'var(--color-gold)'    },
  withdrawal:   { icon: '📤', color: 'var(--color-orange)'  },
  exchange:     { icon: '🔄', color: 'var(--color-secondary)'},
  quest_reward: { icon: '🎯', color: 'var(--color-orange)'  },
  referral:     { icon: '👥', color: 'var(--color-primary)' },
  referral_bonus: { icon: '🎁', color: 'var(--color-primary)' },
};

export default function Wallet() {
  const { user, refreshProfile } = useAuthStore();
  const [walletInfo, setWalletInfo]     = useState<WalletInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [exchangeAmount, setExchangeAmount] = useState('');
  const [showExchange, setShowExchange] = useState(false);
  const [showBuyTokens, setShowBuyTokens] = useState(false);
  const [processing, setProcessing]     = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [wallet, txs] = await Promise.all([api.getWallet(), api.getTransactions()]);
        setWalletInfo(wallet);
        const txData = txs as any;
        setTransactions(txData.transactions ?? txData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleExchange = async () => {
    const amount = parseInt(exchangeAmount, 10);
    if (!amount || amount < 100) return;
    setProcessing(true);
    try {
      await api.exchangeNmnh(amount);
      await refreshProfile();
      await api.getWallet().then(setWalletInfo);
      setExchangeAmount('');
      setShowExchange(false);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    } catch (err: any) {
      alert(err.message || 'Exchange failed');
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
    } finally {
      setProcessing(false);
    }
  };

  const handleBuyNmnh = async (amount: number) => {
    setProcessing(true);
    try {
      await api.buyNmnh(amount);
      await refreshProfile();
      await api.getWallet().then(setWalletInfo);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
      alert(`Успешно куплено ${amount} NMNH!`);
    } catch (err: any) {
      alert(err.message || 'Ошибка покупки');
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
    } finally {
      setProcessing(false);
    }
  };

  const handleDepositStars = async () => {
    setProcessing(true);
    try {
      const { invoiceUrl } = await api.createDeposit(50); // Default 50 for now or show modal
      if (window.Telegram?.WebApp?.openInvoice) {
        window.Telegram.WebApp.openInvoice(invoiceUrl, async (status: string) => {
          if (status === 'paid') {
            await refreshProfile();
            api.getWallet().then(setWalletInfo);
          }
        });
      } else {
        window.open(invoiceUrl, '_blank');
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка создания платежа');
    } finally {
      setProcessing(false);
    }
  };

  const handleShareReferral = () => {
    const botUsername = 'durak_game_bot'; // Replace with actual bot username if known
    const link = `https://t.me/${botUsername}?start=${user?.referralCode}`;
    const text = `Играй со мной в Дурака и получай бонусы! 🃏\n${link}`;
    
    if (window.Telegram?.WebApp) {
      (window.Telegram.WebApp as any).openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
    } else {
      navigator.clipboard.writeText(link);
      alert('Ссылка скопирована!');
    }
  };

  const exchangePreview =
    parseInt(exchangeAmount, 10) > 0 && walletInfo
      ? Math.floor(parseInt(exchangeAmount, 10) / walletInfo.exchangeRate)
      : 0;

  if (!user) return null;

  return (
    <div className="wallet page-wrap">

      {/* ── Header ─────────────────────────────── */}
      <PageTopBar title="Кошелёк" subtitle="Управление балансом и история" />

      {/* ── Balance cards ──────────────────────── */}
      <div className="wallet-balances">
        <div className="wallet-card wallet-stars glass">
          <div className="wallet-card-label">Telegram Stars</div>
          <div className="wallet-card-amount">
            <span className="wallet-card-icon">⭐</span>
            <span className="wallet-card-number">{user.starsBalance.toLocaleString()}</span>
          </div>
          <div className="wallet-card-actions">
            <button
              className="btn btn-gold btn-sm wallet-card-btn"
              onClick={handleDepositStars}
              disabled={processing}
            >
              Пополнить
            </button>
            <button
              className="btn btn-primary btn-sm wallet-card-btn"
              onClick={() => { setShowBuyTokens(!showBuyTokens); setShowExchange(false); }}
            >
              Купить 🪙
            </button>
          </div>
        </div>

        <div className="wallet-card wallet-nmnh glass">
          <div className="wallet-card-label">NMNH Токены</div>
          <div className="wallet-card-amount">
            <span className="wallet-card-icon">🪙</span>
            <span className="wallet-card-number">{user.nmnhBalance.toLocaleString()}</span>
          </div>
          <div className="wallet-card-actions">
            <button
              className="btn btn-secondary btn-sm wallet-card-btn"
              onClick={() => { setShowExchange(!showExchange); setShowBuyTokens(false); }}
            >
              {showExchange ? 'Закрыть' : 'Обменять ⭐'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Buy NMNH Tokens ── */}
      {showBuyTokens && (
        <div className="exchange-panel card-surface animate-slide-up">
          <div className="exchange-title">
            <span>Купить NMNH за Stars</span>
            <span className="exchange-rate">1⭐ = 10🪙</span>
          </div>
          <div className="buy-tokens-grid">
            {[100, 500, 1000, 5000].map(amt => (
              <button 
                key={amt} 
                className="buy-token-item glass"
                onClick={() => handleBuyNmnh(amt)}
                disabled={processing}
              >
                <div className="buy-amt">🪙 {amt.toLocaleString()}</div>
                <div className="buy-price">⭐ {Math.ceil(amt / 10)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Exchange ───────────────────────────── */}
      {showExchange && walletInfo && (
        <div className="exchange-panel card-surface animate-slide-up">
          <div className="exchange-title">
            <span>Обмен NMNH → Stars</span>
            <span className="exchange-rate">Курс: {walletInfo.exchangeRate}🪙 = 1⭐</span>
          </div>

          <div className="exchange-row">
            <div className="exchange-input-wrap">
              <input
                type="number"
                className="exchange-input"
                placeholder={`Мин. ${walletInfo.minExchange}`}
                value={exchangeAmount}
                onChange={(e) => setExchangeAmount(e.target.value)}
                min={walletInfo.minExchange}
              />
              <span className="exchange-suffix">🪙</span>
            </div>
            {exchangePreview > 0 && (
              <span className="exchange-arrow">→ {exchangePreview} ⭐</span>
            )}
          </div>

          <button
            className="btn btn-primary"
            onClick={handleExchange}
            disabled={processing || !exchangePreview}
          >
            {processing ? 'Обработка...' : 'Обменять'}
          </button>
        </div>
      )}

      {/* ── Referral Section ── */}
      <div className="referral-banner glass animate-fade-in">
        <div className="ref-icon">🎁</div>
        <div className="ref-content">
          <span className="ref-title">Приглашай друзей — получай NMNH!</span>
          <span className="ref-desc">Дарим <b>500 NMNH</b> за каждого нового игрока</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleShareReferral}>
          Пригласить
        </button>
      </div>

      {/* ── Transactions ───────────────────────── */}
      <div className="tx-section">
        <p className="section-label">История транзакций</p>

        {loading ? (
          <div className="tx-skeletons">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="tx-skeleton shimmer" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="tx-empty">
            <span className="tx-empty-icon">💳</span>
            <p>Нет транзакций</p>
          </div>
        ) : (
          <div className="tx-list">
            {transactions.map((tx) => {
              const meta = TX_META[tx.type] ?? { icon: '💳', color: 'var(--color-text-secondary)' };
              return (
                <div key={tx.id} className="tx-item">
                  <div className="tx-icon-wrap" style={{ background: `${meta.color}18` }}>
                    <span className="tx-icon">{meta.icon}</span>
                  </div>
                  <div className="tx-info">
                    <span className="tx-desc">{tx.description}</span>
                    <span className="tx-date text-muted">
                      {new Date(tx.createdAt).toLocaleDateString('ru-RU', {
                        day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <span className={`tx-amount ${tx.amount >= 0 ? 'tx-pos' : 'tx-neg'}`}>
                    {tx.amount >= 0 ? '+' : ''}{tx.amount}
                    {tx.currency === 'stars' ? ' ⭐' : ' 🪙'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
