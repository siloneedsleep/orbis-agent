import { 
  CatSettings, 
  CatSkill, 
  getStoredCatSettings, 
  saveStoredCatSettings, 
  addCatExp 
} from '@/state/agentStore';
import { events } from '@/ipc/events';
import builtInCodes from '@/data/redeemCodes.json';

export interface RedeemReward {
  code: string;
  name?: string;
  treats: number;
  exp: number;
  skill?: CatSkill;
  maxUses?: number;
}

export interface RedeemResult {
  success: boolean;
  message: string;
  rewards?: RedeemReward;
  updatedSettings?: CatSettings;
}

const DYNAMIC_CODES_KEY = 'orbis_dynamic_redeem_codes';

export function getDynamicCodes(): RedeemReward[] {
  try {
    const raw = localStorage.getItem(DYNAMIC_CODES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDynamicCodes(codes: RedeemReward[]): void {
  localStorage.setItem(DYNAMIC_CODES_KEY, JSON.stringify(codes));
}

export function registerDynamicCode(newCode: RedeemReward): void {
  const current = getDynamicCodes();
  const filtered = current.filter(c => c.code.toLowerCase() !== newCode.code.toLowerCase());
  filtered.push(newCode);
  saveDynamicCodes(filtered);
}

export function redeemCode(inputCode: string): RedeemResult {
  const cleanCode = inputCode.trim();
  if (!cleanCode) {
    return { success: false, message: "Vui lòng nhập mã Redeem Code!" };
  }

  const normalized = cleanCode.toLowerCase();
  const current = getStoredCatSettings();

  // Kiểm tra xem mã đã được sử dụng chưa
  if (current.redeemedCodes && current.redeemedCodes.some(c => c.toLowerCase() === normalized)) {
    return { 
      success: false, 
      message: "Mã này bạn đã sử dụng trên máy rồi! Mỗi mã chỉ được nhập 1 lần." 
    };
  }

  // 1. Tìm trong Built-in codes
  let found = (builtInCodes as RedeemReward[]).find(
    c => c.code.toLowerCase() === normalized
  );

  // 2. Tìm trong Dynamic codes (do PowerShell tool cấp hoặc sync)
  if (!found) {
    const dynamicCodes = getDynamicCodes();
    found = dynamicCodes.find(c => c.code.toLowerCase() === normalized);
  }

  // 3. Phân tích token mã hóa (nếu code có dạng orbis-b64-...)
  if (!found && normalized.startsWith('orbis-b64-')) {
    try {
      const b64 = cleanCode.replace(/^orbis-b64-/i, '');
      const jsonStr = decodeURIComponent(escape(atob(b64)));
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed.treats === 'number') {
        found = {
          code: cleanCode,
          name: parsed.name || 'Gói quà Độc quyền Creator',
          treats: parsed.treats || 0,
          exp: parsed.exp || 0,
          skill: parsed.skill,
        };
      }
    } catch {
      // ignore parsing error
    }
  }

  if (!found) {
    return {
      success: false,
      message: "Mã đổi thưởng không hợp lệ hoặc không tồn tại!"
    };
  }

  // Tiến hành áp dụng phần thưởng
  let updatedExpSettings = current;
  if (found.exp > 0) {
    updatedExpSettings = addCatExp(found.exp);
  }

  let updatedSkills = [...updatedExpSettings.taughtSkills];
  let skillAddedName: string | null = null;
  if (found.skill) {
    const existingIndex = updatedSkills.findIndex(s => s.id === found!.skill!.id);
    if (existingIndex >= 0) {
      updatedSkills[existingIndex] = { ...found.skill, enabled: true };
    } else {
      updatedSkills.unshift({ ...found.skill, enabled: true });
    }
    skillAddedName = found.skill.name;
  }

  const finalSettings: CatSettings = {
    ...updatedExpSettings,
    treats: (updatedExpSettings.treats || 0) + (found.treats || 0),
    redeemedCodes: [...(updatedExpSettings.redeemedCodes || []), cleanCode],
    taughtSkills: updatedSkills,
  };

  saveStoredCatSettings(finalSettings);

  // Bắn sự kiện vui mừng
  events.emitPetState({
    state: 'done',
    message: `Nhận thưởng thành công: +${found.treats} 🐟 Treats! ✨`
  }).catch(() => {});

  let rewardDetail = `+${found.treats} 🐟 Treats, +${found.exp} ⭐ EXP`;
  if (skillAddedName) {
    rewardDetail += `, mở khóa Kỹ năng [${skillAddedName}]`;
  }

  return {
    success: true,
    message: `Chúc mừng! Bạn đã đổi mã thành công: ${rewardDetail}!`,
    rewards: found,
    updatedSettings: finalSettings,
  };
}
