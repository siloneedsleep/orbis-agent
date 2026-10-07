import React from 'react';
import { motion } from 'framer-motion';
import { CoreState } from '../../state/coreMachine';
import { useVoicePulse } from '../../hooks/useVoicePulse';

interface Props {
  state: CoreState;
  isAdmin: boolean;
}

export const TheCore: React.FC<Props> = ({ state, isAdmin }) => {
  const coreColor = isAdmin ? '#FACC15' : '#00F0FF'; // Vàng Admin vs Xanh User
  const audioPulse = useVoicePulse(state === 'listening');

  // Khai báo các trạng thái chuyển động (Framer Motion Variants)
  const variants = {
    idle: { scale: 1, borderRadius: '50%', x: 0 },
    docked: { scale: 0.8, borderRadius: '10px 50% 50% 10px', x: -20 }, // Bán cầu sát mép
    listening: { scale: 1 + audioPulse * 0.3, borderRadius: '40%', opacity: 0.9 }, // Biến thiên theo giọng
    thinking: { scale: 0.9, rotate: 360, transition: { repeat: Infinity, duration: 2 } },
    glitched: { x: [-10, 10, -10, 10, 0], filter: 'hue-rotate(90deg)', transition: { duration: 0.2 } },
    shielded: { scale: 1.2, boxShadow: `0 0 20px ${coreColor}, inset 0 0 10px #fff` }
  };

  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      {/* Vòng Shield nếu đang tương tác vùng nhạy cảm */}
      {state === 'shielded' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1.5 }}
          className="absolute w-full h-full border-2 border-dashed rounded-full border-cyan-400 opacity-50"
        />
      )}

      {/* Vệ tinh xoay khi Thinking */}
      {state === 'thinking' && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          className="absolute w-24 h-24 border-t-2 border-cyan-300 rounded-full"
        />
      )}

      {/* The Core Entity */}
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
