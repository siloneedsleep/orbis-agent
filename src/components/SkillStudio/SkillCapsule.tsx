import { parseCapsule } from '@/services/skillCapsule';
import { useRef, useState } from 'react';
import { Download, Upload, Package } from 'lucide-react';
import { getStoredCatSettings, saveStoredCatSettings } from '@/state/agentStore';
import { redeemCode } from '@/services/redeemService';

export function SkillCapsule() {
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const apply = async (value: string) => {
    try {
      if (!value.trim().startsWith('{')) { const result = await redeemCode(value.trim()); setMessage(result.message); return; }
      const skills = parseCapsule(value);
      const settings = getStoredCatSettings();
      const ids = new Set(settings.taughtSkills.map(s=>s.id));
      const added = skills.filter(s=>!ids.has(s.id));
      saveStoredCatSettings({ ...settings, taughtSkills:[...settings.taughtSkills,...added] });
      setMessage(`Đã nhập ${added.length} kỹ năng. Xem chỉ dẫn và bật kỹ năng để sử dụng.`); setText('');
    } catch(error) { setMessage(String(error)); }
  };
  const exportFile = () => {
    const capsule = { format:'orbis.skill-capsule',version:1,skills:getStoredCatSettings().taughtSkills };
    const url = URL.createObjectURL(new Blob([JSON.stringify(capsule,null,2)],{ type:'application/json' }));
    const link = document.createElement('a');link.href=url;link.download='my-skills.orbis';link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <section className="m-6 mb-0 rounded-2xl border border-cyan-800/50 bg-cyan-950/10 p-5 text-sm">
    <div className="mb-3 flex items-center gap-2 text-cyan-200"><Package size={18}/><h2 className="font-semibold">Skill Capsule</h2><span className="ml-auto text-xs text-zinc-500">.orbis · v1</span></div>
    <p className="mb-4 text-xs text-zinc-400">Đóng gói bài học để chia sẻ hoặc nhập kỹ năng mới. Các kỹ năng nhập vào bắt đầu ở trạng thái tắt.</p>
    <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>input.current?.click()} className="flex items-center gap-2 rounded-lg bg-cyan-500/15 px-3 py-2 text-xs text-cyan-200"><Upload size={14}/>Nhập tệp .orbis</button><button type="button" onClick={exportFile} className="flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-300"><Download size={14}/>Xuất kỹ năng</button></div>
    <input ref={input} type="file" accept=".orbis,application/json" aria-label="Chọn Skill Capsule" className="hidden" onChange={async event=>{const file=event.target.files?.[0];if(file){if(file.size>1_000_000)setMessage('Capsule vượt quá 1 MB.');else await apply(await file.text());}event.target.value='';}}/>
    <details className="mt-4 text-xs text-zinc-500"><summary className="cursor-pointer">Nhập nội dung Capsule hoặc mã quà tặng</summary><textarea aria-label="Nội dung Capsule" value={text} onChange={e=>setText(e.target.value)} rows={3} className="mt-3 w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-zinc-300"/><button type="button" onClick={()=>void apply(text)} disabled={!text.trim()} className="mt-2 rounded-lg bg-zinc-800 px-3 py-2 text-zinc-200 disabled:opacity-40">Nhập</button></details>
    {message && <p role="status" className="mt-3 text-xs text-cyan-200">{message}</p>}
  </section>;
}
