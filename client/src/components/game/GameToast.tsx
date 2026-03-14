import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './GameToast.css';

export interface ToastItem {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  icon?: string;
}

interface GameToastProps {
  toasts: ToastItem[];
  onRemove: (id: number) => void;
}

export const GameToast: React.FC<GameToastProps> = ({ toasts, onRemove }) => (
  <div className="gt-container" role="log" aria-live="polite" aria-label="Уведомления">
    <AnimatePresence mode="popLayout">
      {toasts.slice(-3).map(t => (
        <motion.div
          key={t.id}
          className={`gt-toast gt-${t.type}`}
          initial={{ opacity: 0, y: -16, scale: 0.88 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          layout
          onClick={() => onRemove(t.id)}
        >
          {t.icon && <span className="gt-icon">{t.icon}</span>}
          <span className="gt-msg">{t.message}</span>
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);
