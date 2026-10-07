import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const OnboardingFlow = ({ onComplete }: { onComplete: (data: any) => void }) => {
  const [step, setStep] = useState<'name' | 'persona' | 'setup' | 'grapple'>('name');
  const [name, setName] = useState('');

  return (
    <div className="flex flex-col items-center justify-center w-full h-full text-white">
      <AnimatePresence mode="wait">
        {step === 'name' && (
          <motion.div key="name" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="flex flex-col items-center">
            <div className="px-4 py-2 mb-4 bg-black/50 backdrop-blur-md rounded-2xl border border-cyan-500/30">
              Được rồi, tôi đã kết nối! Trước khi bắt đầu, tôi cần biết tên của bạn.
            </div>
            <input 
              autoFocus
              className="px-4 py-2 bg-black/40 border border-cyan-500/50 rounded-full outline-none focus:border-cyan-400 w-64 text-center"
              placeholder="Nhập tên của bạn..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && name && setStep('persona')}
            />
          </motion.div>
        )}

        {step === 'persona' && (
          <motion.div key="persona" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
            <div className="px-4 py-2 mb-4 bg-black/50 backdrop-blur-md rounded-2xl border border-cyan-500/30">
              Rất vui được gặp {name}! Tôi nên xưng hô với bạn như thế nào?
            </div>
            <div className="flex gap-4">
              {['Nam', 'Nữ', 'Khác'].map((p) => (
                <button 
                  key={p} 
                  onClick={() => { setStep('setup'); setTimeout(() => setStep('grapple'), 5000); }}
                  className="px-6 py-2 rounded-full bg-cyan-900/40 hover:bg-cyan-600/60 border border-cyan-500/30 transition-all"
                >
                  {p}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 'setup' && (
          <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-cyan-400 animate-pulse">
            Đang thiết lập hệ thống...
          </motion.div>
        )}

        {step === 'grapple' && (
          <motion.div key="grapple" initial={{ y: -500 }} animate={{ y: 0 }} transition={{ type: "spring", bounce: 0.6 }} className="relative flex flex-col items-center" onAnimationComplete={() => setTimeout(() => onComplete({ name }), 1500)}>
            <div className="w-1 h-32 bg-gradient-to-b from-cyan-400 to-transparent"></div>
            <div className="w-6 h-6 border-4 border-cyan-400 rotate-45 -mt-3 shadow-[0_0_15px_#00F0FF]"></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
