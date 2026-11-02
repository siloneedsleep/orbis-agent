import { useEffect, useState } from 'react';
import { mediaUrl } from '@/state/orbisBridge';

export function CyberCatView({ state = 'idle' }: { state?: string }) {
  const [failed, setFailed] = useState(false);
  const clip = state === 'done' ? '39-idle-stand-alert-paw-wave' : state === 'sleep' ? '01-idle-curled-deep-sleep' : '05-idle-sphinx-blink';
  useEffect(() => setFailed(false), [clip]);
  return <div className="relative h-40 w-40" aria-label="Orbis CyberCat">
    {!failed && <video src={mediaUrl(`/pet/${clip}.webm`)} autoPlay loop muted playsInline onError={() => setFailed(true)} className="absolute inset-0 z-10 h-full w-full object-contain" style={{ filter: 'hue-rotate(150deg) saturate(1.85) drop-shadow(0 0 14px #00f0ff66)' }} />}
    {failed && <svg viewBox="0 0 180 180" className="h-full w-full drop-shadow-[0_0_15px_#22d3ee50]" role="img" aria-label="Mèo Orbis">
      <path d="M128 139c35 8 41-27 26-37" fill="none" stroke="#0e7490" strokeWidth="14" strokeLinecap="round" />
      <ellipse cx="87" cy="136" rx="47" ry="25" fill="#155e75" />
      <path d="M42 92 37 41 72 59Q91 49 111 59l31-18-4 52c12 54-110 54-96-1" fill="#164e63" stroke="#22d3ee" strokeWidth="3" />
      <path d="m48 56 6 26 14-15m59-9-7 23-12-14" fill="#0891b2" />
      <path d="M61 96q9-10 18 0m23 0q9-10 18 0" fill="none" stroke="#67e8f9" strokeWidth="4" strokeLinecap="round" />
      <path d="m86 105 8 0-4 5z" fill="#f0abfc" /><path d="M90 110q-6 9-13 1m13-1q6 9 13 1" fill="none" stroke="#a5f3fc" strokeWidth="2" />
      <path d="m36 102 29 5m-31 6 29-1m83-10-28 5m30 6-28-1" stroke="#22d3ee" strokeWidth="2" />
    </svg>}
  </div>;
}
