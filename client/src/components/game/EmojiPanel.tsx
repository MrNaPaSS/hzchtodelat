import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './EmojiPanel.css';

const EMOJIS = ['😂', '👍', '😤', '🤔', '😭', '🔥', '👎', '😎', '🙏', '💪'];

interface EmojiPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (emoji: string) => void;
}

const EmojiPanel: React.FC<EmojiPanelProps> = ({ isOpen, onClose, onSend }) => {
  const handle = (emoji: string) => { onSend(emoji); onClose(); };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="ep glass"
          initial={{ opacity: 0, y: 10, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        >
          <div className="ep-header">
            <span>Реакции</span>
            <button className="ep-close" onClick={onClose} aria-label="Закрыть">✕</button>
          </div>
          <div className="ep-grid">
            {EMOJIS.map(e => (
              <motion.button
                key={e}
                className="ep-btn"
                onClick={() => handle(e)}
                whileTap={{ scale: 0.82 }}
                whileHover={{ scale: 1.22, y: -3 }}
              >{e}</motion.button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EmojiPanel;
