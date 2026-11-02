import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getStoredCatSettings, saveStoredCatSettings, subscribeAgentStore } from '@/state/agentStore';
import { useOrbisStream } from '@/state/useOrbisStream';
import { CyberCatView } from './CyberCatView';
import { TheCoreView } from './TheCoreView';

export function AvatarContainer({ commandOpen, onCommand }: { commandOpen: boolean; onCommand: () => void }) {
  const stream = useOrbisStream();
  const [showReport,setShowReport] = useState(false);
  useEffect(() => { if (!['done','error','stopped'].includes(stream.status)) { setShowReport(false); return; } setShowReport(true); const timer=window.setTimeout(()=>setShowReport(false),7000); return ()=>clearTimeout(timer); },[stream.status,stream.message]);
  const [settings, setSettings] = useState(getStoredCatSettings);
  const [position, setPosition] = useState(settings.position);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const drag = useRef<{ x: number; y: number; originX: number; originY: number; moved: boolean }>();
  useEffect(() => subscribeAgentStore(() => { const next = getStoredCatSettings(); setSettings(next); if (!drag.current) setPosition(next.position); }), []);
  useEffect(() => { const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight }); window.addEventListener('resize',resize); return () => window.removeEventListener('resize',resize); }, []);
  const active = ['thinking','executing','awaiting_approval'].includes(stream.status);
  const core = active || commandOpen || settings.stealthMode;
  if (!settings.enabled && !core) return null;
  const x = core ? viewport.width - 100 : Math.min(viewport.width - 160, Math.max(0,position.x));
  const y = core ? 40 : Math.min(viewport.height - 160, Math.max(0,position.y));
  return <motion.button type="button" data-orbis-interactive aria-label="Mở thanh lệnh Orbis" title="Bấm để ra lệnh · Kéo để di chuyển"
    className="pointer-events-auto absolute touch-none rounded-full border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
    animate={{ x, y, width: core ? 64 : 160, height: core ? 64 : 160, scale: core ? 1 : settings.scale }}
    transition={{ duration: drag.current ? 0 : 0.45, ease: [0.22, 0.8, 0.2, 1] }}
    onPointerDown={event => { if (core) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x:event.clientX,y:event.clientY,originX:position.x,originY:position.y,moved:false }; }}
    onPointerMove={event => { const current = drag.current; if (!current) return; if (Math.hypot(event.clientX-current.x,event.clientY-current.y)>4) current.moved=true; if (current.moved) setPosition({ x:Math.max(0,Math.min(viewport.width-160,current.originX+event.clientX-current.x)),y:Math.max(0,Math.min(viewport.height-160,current.originY+event.clientY-current.y)) }); }}
    onPointerUp={() => { const moved = drag.current?.moved; drag.current=undefined; if (moved) saveStoredCatSettings({ ...getStoredCatSettings(), position }); else onCommand(); }}
    onPointerCancel={() => { drag.current=undefined; }} onKeyDown={event => { if (event.key==='Enter' || event.key===' ') { event.preventDefault(); onCommand(); } }}>
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={core ? 'core' : 'companion'} initial={{ opacity:0,scale:0.6,filter:'blur(8px)' }} animate={{ opacity:1,scale:1,filter:'blur(0px)' }} exit={{ opacity:0,scale:0.6,filter:'blur(8px)' }} transition={{ duration:0.22 }}>
        {core ? <TheCoreView status={stream.status} /> : <CyberCatView state={stream.status} />}
      </motion.div>
    </AnimatePresence>
    {(active || showReport) && settings.speechBubbleEnabled && <span role="status" className={`pointer-events-none absolute right-0 top-full mt-3 w-64 rounded-lg border border-cyan-900/40 bg-zinc-950/95 px-3 py-2 text-left text-xs ${stream.status === 'error' ? 'text-red-300' : 'text-cyan-200'}`}>{stream.message.slice(0,220)}</span>}
  </motion.button>;
}
