import { useOrbisStream } from '@/state/useOrbisStream';
export function SomPreviewOverlay() {
  const stream = useOrbisStream();
  return <div aria-hidden="true" className={`pointer-events-none fixed inset-0 border-2 transition-opacity duration-300 ${stream.status==='executing' ? 'border-amber-400/40 opacity-100 shadow-[inset_0_0_25px_#f59e0b18]' : stream.status==='thinking' ? 'border-cyan-400/30 opacity-80' : 'opacity-0'}`} />;
}
