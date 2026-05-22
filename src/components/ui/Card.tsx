'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
  onClick?: () => void;
}

export default function Card({
  children,
  className = '',
  hoverEffect = true,
  onClick
}: CardProps) {
  if (onClick) {
    return (
      <motion.div
        whileHover={{ y: -4, scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={onClick}
        className={`bg-white/70 backdrop-blur-md border border-border rounded-2xl p-6 shadow-md shadow-neutral-900/5 glow-card ${hoverEffect ? 'hover:shadow-lg' : ''} cursor-pointer ${className}`}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div
      className={`bg-white/70 backdrop-blur-md border border-border rounded-2xl p-6 shadow-md shadow-neutral-900/5 glow-card ${hoverEffect ? 'hover:shadow-lg' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
