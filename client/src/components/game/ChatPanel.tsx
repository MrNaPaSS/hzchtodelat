import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, useAuthStore, ChatMessage } from '../../stores';
import './ChatPanel.css';

const formatTime = (ts: number) => {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

interface ChatPanelProps {
  isOpen: boolean;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen }) => {
  const { chatMessages, sendChat } = useGameStore();
  const { user } = useAuthStore();
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (isOpen) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isOpen]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleSend = useCallback(() => {
    const msg = draft.trim();
    if (!msg) return;
    sendChat(msg);
    setDraft('');
    inputRef.current?.focus();
  }, [draft, sendChat]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="cp-panel glass"
          initial={{ opacity: 0, y: 12, scaleY: 0.92 }}
          animate={{ opacity: 1, y: 0, scaleY: 1 }}
          exit={{ opacity: 0, y: 12, scaleY: 0.92 }}
          transition={{ type: 'spring', stiffness: 480, damping: 32 }}
          style={{ transformOrigin: 'bottom center' }}
        >
          <div className="cp-messages" role="log" aria-live="polite" aria-label="Чат">
            {chatMessages.length === 0 && (
              <div className="cp-empty">Начните общение!</div>
            )}
            <AnimatePresence mode="popLayout">
              {chatMessages.slice(-20).map((msg: ChatMessage) => {
                const isMe = msg.userId === user?.id;
                return (
                  <motion.div
                    key={msg.id}
                    className={`cp-msg ${isMe ? 'mine' : 'theirs'}`}
                    initial={{ opacity: 0, x: isMe ? 16 : -16, scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    layout
                  >
                    {!isMe && <span className="cp-sender">{msg.username}</span>}
                    <span className="cp-text">{msg.message}</span>
                    <span className="cp-time">{formatTime(msg.timestamp)}</span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={endRef} />
          </div>

          <div className="cp-input-row">
            <input
              ref={inputRef}
              className="cp-input"
              type="text"
              placeholder="Написать..."
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 200))}
              onKeyDown={handleKeyDown}
              aria-label="Сообщение"
            />
            <button
              className="cp-send"
              onClick={handleSend}
              disabled={!draft.trim()}
              aria-label="Отправить"
            >
              ➤
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChatPanel;
