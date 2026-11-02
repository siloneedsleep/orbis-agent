import { useEffect, useState } from 'react';
import { Plus, Trash2, GraduationCap } from 'lucide-react';
import { CatSkill, getStoredCatSettings, saveStoredCatSettings, subscribeAgentStore } from '@/state/agentStore';
import { SkillCapsule } from './SkillCapsule';

export function SkillStudio() {
  const [settings,setSettings] = useState(getStoredCatSettings);
  const [name,setName] = useState(''); const [trigger,setTrigger] = useState(''); const [prompt,setPrompt] = useState('');
  useEffect(()=>subscribeAgentStore(()=>setSettings(getStoredCatSettings())),[]);
  const update = (skills: CatSkill[]) => saveStoredCatSettings({...getStoredCatSettings(),taughtSkills:skills});
  return <div className="flex-1 overflow-y-auto pb-6">
    <div className="flex items-center gap-3 px-6 pt-6"><GraduationCap className="text-cyan-300"/><div><h1 className="text-lg font-semibold">Skill Studio</h1><p className="text-xs text-zinc-500">Dạy một lần, gọi lại từ thanh lệnh bằng /</p></div></div>
    <SkillCapsule />
    <form className="m-6 space-y-3 rounded-2xl border border-zinc-800 p-5 text-xs" onSubmit={event=>{event.preventDefault();if(!name.trim()||!prompt.trim())return;update([...settings.taughtSkills,{id:`skill-${crypto.randomUUID()}`,name:name.trim(),trigger:trigger.trim()||name.trim(),actionPrompt:prompt.trim(),enabled:true,category:'macro'}]);setName('');setTrigger('');setPrompt('');}}>
      <h2 className="font-semibold text-zinc-200">Dạy kỹ năng mới</h2>
      <div className="grid grid-cols-2 gap-3"><input aria-label="Tên kỹ năng" required value={name} onChange={e=>setName(e.target.value)} placeholder="Tên kỹ năng" className="rounded-lg border border-zinc-700 bg-zinc-900 p-3"/><input aria-label="Điều kiện kích hoạt" value={trigger} onChange={e=>setTrigger(e.target.value)} placeholder="Ví dụ: /dondep" className="rounded-lg border border-zinc-700 bg-zinc-900 p-3"/></div>
      <textarea aria-label="Chỉ dẫn hành động" required value={prompt} onChange={e=>setPrompt(e.target.value)} rows={3} placeholder="Mô tả việc cần làm và cách kiểm tra kết quả…" className="w-full rounded-lg border border-zinc-700 bg-zinc-900 p-3"/>
      <button type="submit" className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-white"><Plus size={14}/>Lưu kỹ năng</button>
    </form>
    <div className="space-y-3 px-6">{settings.taughtSkills.map(skill=><article key={skill.id} className={`rounded-xl border p-4 text-xs ${skill.enabled?'border-cyan-900/50 bg-zinc-900/60':'border-zinc-800 opacity-70'}`}>
      <div className="flex items-center gap-3"><h2 className="flex-1 font-semibold text-zinc-200">{skill.name}</h2><label className="flex items-center gap-2 text-zinc-400"><input type="checkbox" checked={skill.enabled} onChange={()=>update(settings.taughtSkills.map(s=>s.id===skill.id?{...s,enabled:!s.enabled}:s))}/>Bật</label><button type="button" aria-label={`Xóa kỹ năng ${skill.name}`} onClick={()=>update(settings.taughtSkills.filter(s=>s.id!==skill.id))} className="p-1 text-zinc-500 hover:text-red-300"><Trash2 size={14}/></button></div>
      <p className="mt-2 font-mono text-cyan-500">{skill.trigger}</p><p className="mt-3 whitespace-pre-wrap leading-relaxed text-zinc-400">{skill.actionPrompt}</p>
    </article>)}</div>
  </div>;
}
