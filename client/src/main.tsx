import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { useGameStore, useUIStore, useAuthStore } from './stores';

if (import.meta.env.DEV) {
  (window as any).__stores__ = { game: useGameStore, ui: useUIStore, auth: useAuthStore };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
