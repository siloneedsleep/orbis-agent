import React from 'react';
import { motion } from 'framer-motion';
import { CoreState } from '../../state/coreMachine';
import { useVoicePulse } from '../../hooks/useVoicePulse';

interface Props {
  state: CoreState;
  isAdmin: boolean;
}

export const TheCore: React.FC<Props> = ({ state, isAdmin }) => {
  let coreColor = isAdmin ? '#FACC15' : '#00F0FF';
  if (state === 'quarantine') coreColor = '#F59E0B'; // Vàng hổ phách cảnh báo
  if (state === 'time_rewind') coreColor = '#A855F7'; // Tím thời gian hoàn tác

  const audioPulse = useVoicePulse(state === 'listening');

  const variants = {
    idle: { scale: 1, borderRadius: '50%', x: 0 },
    docked: { scale: 0.8, borderRadius: '10px 50% 50% 10px', x: -20 },
    listening: { scale: 1 + audioPulse * 0.3, borderRadius: '40%', opacity: 0.9 },
    thinking: { scale: 0.9, rotate: 360, transition: { repeat: Infinity, duration: 2, ease: "linear" } },
    glitched: { x: [-10, 10, -10, 10, 0], filter: 'hue-rotate(90deg)', transition: { duration: 0.2 } },
    shielded: { scale: 1.2, boxShadow: `0 0 20px ${coreColor}, inset 0 0 10px #fff` },
    quarantine: { scale: 1.15, filter: 'drop-shadow(0 0 25px #F59E0B)', transition: { yoyo: Infinity, duration: 0.8 } },
    time_rewind: { rotate: -720, scale: [1, 0.7, 1.1, 1], transition: { duration: 1.2, ease: "easeInOut" } }
  };

  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      {/* Vòng quét mã nhị phân khi Quarantine */}
      {state === 'quarantine' && (
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
          className="absolute w-28 h-28 border-2 border-dashed border-amber-500 rounded-full opacity-70"
        />
      )}

      {/* Hiệu ứng hạt bị hút ngược khi Time Rewind */}
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
