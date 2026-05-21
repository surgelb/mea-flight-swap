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
  const CardComponent = onClick ? motion.div : 'div';
  const interactionProps = onClick 
    ? {
        whileHover: { y: -4, scale: 1.01 },
        whileTap: { scale: 0.99 },
        onClick,
        className: `cursor-pointer ${className}`
      }
    : { className };

  return (
    // @ts-ignore
    <CardComponent
      {...interactionProps}
      className={`bg-white/70 backdrop-blur-md border border-amber-200/50 rounded-2xl p-6 shadow-md shadow-amber-900/5 glow-card ${hoverEffect ? 'hover:shadow-lg' : ''} ${className}`}
    >
      {children}
    </CardComponent>
  );
}
