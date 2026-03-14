import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './TurnBanner.css';

export type TurnPhase = 'attack' | 'defend' | 'wait' | 'taking' | null;

interface TurnBannerProps {
  phase: TurnPhase;
}

const CONFIG: Record<NonNullable<TurnPhase>, { icon: string; text: string; className: string }> = {
  attack:  { icon: '⚔️', text: 'ТВОЯ АТАКА!',           className: 'tb-atk' },
  defend:  { icon: '🛡️', text: 'ЗАЩИЩАЙСЯ!',             className: 'tb-def' },
  wait:    { icon: '⏳', text: 'ХОД СОПЕРНИКА...',       className: 'tb-wait' },
  taking:  { icon: '🖐',  text: 'СОПЕРНИК БЕРЁТ КАРТЫ!', className: 'tb-take' },
};

const TurnBanner: React.FC<TurnBannerProps> = ({ phase }) => (
  <AnimatePresence mode="wait">
    {phase && (
      <motion.div
        key={phase}
        className={`tb ${CONFIG[phase].className}`}
        initial={{ opacity: 0, y: -32, scale: 0.88 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -24, scale: 0.92 }}
        transition={{ type: 'spring', stiffness: 520, damping: 32 }}
        aria-live="assertive"
        role="status"
      >
        <motion.span
          className="tb-icon"
          initial={{ scale: 0.5, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 600, damping: 20, delay: 0.05 }}
        >
          {CONFIG[phase].icon}
        </motion.span>
        <span className="tb-text">{CONFIG[phase].text}</span>
      </motion.div>
    )}
  </AnimatePresence>
);

export default TurnBanner;
