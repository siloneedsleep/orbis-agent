import { useEffect, useRef, useState } from 'react';
import { Command, Send, Square, Settings, EyeOff, X } from 'lucide-react';
import { commands } from '@/ipc/commands';
import { getStoredCatSettings, getStoredMcpServers, saveStoredCatSettings } from '@/state/agentStore';
import { useOrbisStream } from '@/state/useOrbisStream';
import { startAgent, stopAgent } from '@/state/orbisBridge';

export function SpatialCommandBar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const stream = useOrbisStream();
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('computer_use');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = ['thinking','executing','awaiting_approval'].includes(stream.status);
  useEffect(() => { if (open) { inputRef.current?.focus(); setError(''); } },[open]);
  if (!open) return null;
  const choices = input.startsWith('/') ? getStoredCatSettings().taughtSkills.filter(s => s.enabled).map(s => ({ value:`/${s.id}`,name:s.name })) : input.startsWith('@') ? getStoredMcpServers().filter(s=>s.enabled).map(s=>({ value:`@${s.id}`,name:s.name })) : [];
  const submit = async () => { if (!input.trim() || busy) return; setError(''); try { await startAgent(input.trim(),mode); setInput(''); onClose(); } catch (error) { setError(String(error)); } };
  return <section data-orbis-interactive aria-label="Thanh lệnh Orbis" className="pointer-events-auto absolute left-1/2 top-[22%] w-[min(640px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl border border-cyan-300/30 bg-zinc-950/95 shadow-[0_20px_100px_#0009,0_0_45px_#06b6d415] backdrop-blur-2xl">
    <form onSubmit={event=>{event.preventDefault();void submit();}} className="flex h-14 items-center gap-3 px-4">
      <Command className="h-5 w-5 shrink-0 text-cyan-300" aria-hidden="true" />
      <input ref={inputRef} aria-label="Yêu cầu cho Orbis" autoComplete="off" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')onClose();}} placeholder="Orbis, giúp mình…  / kỹ năng  @ công cụ" className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500" />
      {busy ? <button type="button" aria-label="Dừng tác vụ" onClick={()=>void stopAgent()} className="rounded-lg bg-red-500/20 p-2 text-red-300"><Square size={16}/></button> : <button type="submit" aria-label="Gửi yêu cầu" disabled={!input.trim()} className="rounded-lg p-2 text-cyan-300 disabled:text-zinc-600"><Send size={17}/></button>}
      <button type="button" aria-label="Đóng thanh lệnh" onClick={onClose} className="p-1 text-zinc-500"><X size={16}/></button>
    </form>
    {choices.length>0 && <div className="max-h-48 overflow-auto border-t border-white/5 p-2">{choices.filter(c=>c.value.includes(input)||c.name.toLowerCase().includes(input.slice(1).toLowerCase())).map(choice=><button type="button" key={choice.value} onClick={()=>{setInput(`${choice.value} `);inputRef.current?.focus();}} className="flex w-full gap-3 rounded-lg px-3 py-2 text-left text-xs text-zinc-300 hover:bg-cyan-400/10"><span className="text-cyan-400">{choice.value}</span>{choice.name}</button>)}</div>}
    <div className="flex items-center gap-3 border-t border-white/5 px-4 py-2 text-[11px] text-zinc-500">
      <select aria-label="Chế độ thực thi" value={mode} onChange={e=>setMode(e.target.value)} className="rounded bg-zinc-900 p-1 text-zinc-300"><option value="computer_use">Điều khiển máy</option><option value="chat">Trò chuyện</option><option value="sandbox">Windows Sandbox</option></select>
      <span className="mr-auto truncate">{stream.status !== 'idle' ? stream.message : 'Ctrl + Alt + Space'}</span>
      <button type="button" aria-label="Chuyển chế độ tối giản" title="Stealth Mode" onClick={()=>{const settings=getStoredCatSettings();saveStoredCatSettings({...settings,stealthMode:!settings.stealthMode});}}><EyeOff size={14}/></button>
      <button type="button" aria-label="Mở Dashboard" onClick={()=>{void commands.openDashboard();onClose();}}><Settings size={14}/></button>
    </div>
    {error && <p role="alert" className="border-t border-red-500/20 px-4 py-3 text-xs text-red-300">{error}</p>}
  </section>;
}
