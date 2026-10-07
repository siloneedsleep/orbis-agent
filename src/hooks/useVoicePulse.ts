import { useState, useEffect, useRef } from 'react';

export function useVoicePulse(isActive: boolean) {
  const [amplitude, setAmplitude] = useState(0);
  const audioCtx = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!isActive) {
      setAmplitude(0);
      return;
    }
    
    // Giả lập luồng data âm thanh (Khi chạy thật sẽ dùng navigator.mediaDevices.getUserMedia)
    const interval = setInterval(() => {
      setAmplitude(Math.random() * 0.5 + 0.5); // Random biên độ 0.5 - 1.0
    }, 100);

    return () => clearInterval(interval);
  }, [isActive]);

  return amplitude;
}
