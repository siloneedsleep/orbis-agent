import React from 'react';
import { motion, type Variants } from 'framer-motion';
import type { CoreState, Privilege } from '../../state/coreMachine';
import { useVoicePulse } from '../../hooks/useVoicePulse';

export interface TheCoreProps {
  state: CoreState;
  privilege?: Privilege;
  isAdmin?: boolean;
  position?: { x: number; y: number };
  target?: { x: number; y: number };
  size?: number;
  onFlyComplete?: () => void;
}

export const TheCore: React.FC<TheCoreProps> = ({ 
  state, 
  privilege = 'standard', 
  isAdmin = false 
}) => {
  const isHighPerm = isAdmin || privilege === 'admin' || privilege === 'elevated';
  let coreColor = isHighPerm ? '#FACC15' : '#00F0FF';
  if (state === 'quarantine') coreColor = '#F59E0B';
  if (state === 'time_rewind') coreColor = '#A855F7';

  const audioPulse = useVoicePulse(state === 'listening');

  const variants: Variants = {
    spawning: { scale: [0.2, 1.15, 1], opacity: 1, transition: { duration: 0.5 } },
    idle: { scale: 1, borderRadius: '50%', x: 0, opacity: 1 },
    docked: { scale: 0.8, borderRadius: '10px 50% 50% 10px', x: -20 },
    listening: { scale: 1 + audioPulse * 0.3, borderRadius: '40%', opacity: 0.9 },
    thinking: { scale: 0.9, rotate: 360, transition: { repeat: Infinity, duration: 2, ease: 'linear' } },
    executing: { scale: [1, 1.08, 1], transition: { repeat: Infinity, duration: 0.9, ease: 'easeInOut' } },
    sonic_flying: { scale: [1, 0.75, 1], transition: { duration: 0.8, ease: 'easeInOut' } },
    glitched: { x: [-10, 10, -10, 10, 0], filter: 'hue-rotate(90deg)', transition: { duration: 0.2 } },
    shielded: { scale: 1.2, boxShadow: `0 0 20px ${coreColor}, inset 0 0 10px #fff` },
    quarantine: {
      scale: 1.15,
      filter: 'drop-shadow(0 0 25px #F59E0B)',
      transition: { repeat: Infinity, repeatType: 'reverse', duration: 0.8 },
    },
    time_rewind: { rotate: -720, scale: [1, 0.7, 1.1, 1], transition: { duration: 1.2, ease: 'easeInOut' } },
    sleeping: { scale: 0.6, opacity: 0 },
  };

  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      {state === 'quarantine' && (
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
          className="absolute w-28 h-28 border-2 border-dashed border-amber-500 rounded-full opacity-70"
        />
      )}

      {state === 'time_rewind' && (
        <motion.div 
          initial={{ scale: 2, opacity: 1 }}
          animate={{ scale: 0.2, opacity: 0 }}
          transition={{ repeat: Infinity, duration: 0.6 }}
          className="absolute w-20 h-20 border-2 border-purple-400 rounded-full"
        />
      )}

      {state === 'shielded' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1.5 }}
          className="absolute w-full h-full border-2 border-dashed rounded-full border-cyan-400 opacity-50"
        />
      )}

      {state === 'thinking' && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          className="absolute w-24 h-24 border-t-2 border-cyan-300 rounded-full"
        />
      )}

      <motion.div
        variants={variants}
        initial="idle"
        animate={state}
        style={{
          width: '64px',
          height: '64px',
          background: coreColor,
          boxShadow: `0 0 30px ${coreColor}`,
        }}
        className="relative z-10 cursor-pointer"
        whileHover={state === 'docked' ? { scale: 1.1, x: 0, borderRadius: '50%' } : { scale: 1.05 }}
        whileTap={{ scale: 0.9 }}
      />
    </div>
  );
};

