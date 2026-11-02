import type { CatSkill } from '../state/agentStore';

export function parseCapsule(text: string): CatSkill[] {
  if (text.length > 1_000_000) throw new Error('Capsule vượt quá 1 MB.');
  const capsule: unknown = JSON.parse(text);
  if (!capsule || typeof capsule !== 'object') throw new Error('Capsule không hợp lệ.');
  const data = capsule as { format?: unknown; version?: unknown; skills?: unknown };
  if (data.format !== 'orbis.skill-capsule' || data.version !== 1 || !Array.isArray(data.skills) || data.skills.length > 100) throw new Error('Sai định dạng hoặc phiên bản Capsule.');
  const ids = new Set<string>();
  return data.skills.map((value: unknown) => {
    if (!value || typeof value !== 'object') throw new Error('Kỹ năng không hợp lệ.');
    const skill = value as Record<string, unknown>;
    for (const key of ['id','name','trigger','actionPrompt']) if (typeof skill[key] !== 'string' || !(skill[key] as string).trim() || (skill[key] as string).length > 16000) throw new Error(`Trường ${key} không hợp lệ.`);
    if (!['habit','macro','personality','safety'].includes(String(skill.category))) throw new Error('Nhóm kỹ năng không hợp lệ.');
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(skill.id as string)) throw new Error('ID kỹ năng không hợp lệ.');
    if (ids.has(skill.id as string)) throw new Error('Capsule có ID trùng lặp.'); ids.add(skill.id as string);
    return { id: skill.id as string, name: skill.name as string, trigger: skill.trigger as string, actionPrompt: skill.actionPrompt as string, category: skill.category as CatSkill['category'], enabled: false };
  });
}
