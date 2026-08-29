'use client';

import React from 'react';
import { motion, useReducedMotion, Variants } from 'framer-motion';

interface AnimatedSectionProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  id?: string;
}

export default function AnimatedSection({ children, delay = 0, className, id }: AnimatedSectionProps) {
  const prefersReducedMotion = useReducedMotion();

  // Subtle fade up, preserving corporate restraint
  const variants: Variants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 20 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { 
        duration: 0.6, 
        ease: [0.25, 0.1, 0.25, 1.0], // smooth, non-bouncy ease
        delay 
      } 
    }
  };

  return (
    <motion.div
      id={id}
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={variants}
    >
      {children}
    </motion.div>
  );
}
