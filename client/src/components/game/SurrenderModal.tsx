import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './SurrenderModal.css';

interface SurrenderModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const SurrenderModal: React.FC<SurrenderModalProps> = ({ isOpen, onConfirm, onCancel }) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="sm-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            className="sm-card glass"
            initial={{ opacity: 0, scale: 0.82, y: 32 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{ opacity: 0, scale: 0.88, y: 24 }}
            transition={{ type: 'spring', stiffness: 480, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Подтвердите сдачу"
          >
            <div className="sm-icon" aria-hidden="true">🏳️</div>
            <h2 className="sm-title">Вы уверены?</h2>
            <p className="sm-desc">Вы сдадитесь и станете Дураком. Ставка будет проиграна.</p>
            <div className="sm-actions">
              <button className="sm-btn sm-cancel" onClick={onCancel}>
                Продолжить игру
              </button>
              <button className="sm-btn sm-confirm" onClick={onConfirm}>
                Да, сдаюсь
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SurrenderModal;
