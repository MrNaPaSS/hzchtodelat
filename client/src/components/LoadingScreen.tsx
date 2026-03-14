import './LoadingScreen.css';

export default function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-logo animate-float">
          <span className="loading-spade">♠</span>
        </div>
        <h1 className="loading-title">Дурак Онлайн</h1>
        <div className="loading-bar">
          <div className="loading-bar-fill" />
        </div>
        <p className="loading-subtitle text-muted">Загрузка...</p>
      </div>
    </div>
  );
}
