import React from 'react';
import { motion } from 'framer-motion';
import './CardBack.css';

interface CardBackProps {
  style?: React.CSSProperties;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

const CardBack = React.memo<CardBackProps>(
  ({ style, className = '', size = 'md', animated = false }) => {
    const Comp = animated ? motion.div : 'div';
    const animProps = animated
      ? {
          initial: { scale: 0.8, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          exit:    { scale: 0.8, opacity: 0 },
          transition: { type: 'spring', stiffness: 400, damping: 26 },
        }
      : {};

    return (
      <Comp
        className={`card-back cb-sz-${size} ${className}`}
        style={style}
        {...(animProps as any)}
      >
        <div className="cb-inner">
          <div className="cb-pattern" aria-hidden="true" />
          <div className="cb-border"  aria-hidden="true" />
          <span className="cb-logo"  aria-hidden="true">🃏</span>
        </div>
      </Comp>
    );
  }
);

CardBack.displayName = 'CardBack';
export default CardBack;
