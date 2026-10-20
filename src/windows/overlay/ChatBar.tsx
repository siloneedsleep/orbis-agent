import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OrbisOrchestrator } from '@/services/orchestrator';

const orchestrator = new OrbisOrchestrator();

export const ChatBar = ({ visible, onClose }: { visible: boolean, onClose: () => void }) => {
  const [input, setInput] = useState('');

  const handleSubmit = async () => {
    if (!input.trim()) return;
    const goal = input;
    setInput('');
    onClose();
    await orchestrator.startTask(goal);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 w-96 p-4 bg-black/60 backdrop-blur-xl border border-cyan-500/30 rounded-3xl shadow-2xl z-50"
        >
          <div className="flex gap-3">
            <input 
              autoFocus
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-cyan-700 px-2"
              placeholder=" ra lệnh cho Orbis..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            <button 
              onClick={handleSubmit}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full transition-colors font-medium"
            >
              Gửi
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
