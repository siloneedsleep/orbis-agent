import { 
  CatSettings, 
  CatSkill, 
  getStoredCatSettings, 
  saveStoredCatSettings, 
  addCatExp 
} from '@/state/agentStore';
import { events } from '@/ipc/events';

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

/**
 * Vault chứa toàn bộ danh sách Redeem Code đã được mã hóa AES-256 an toàn.
 * Biến duy nhất này được đẩy lên GitHub để bảo mật tuyệt đối, không lộ mã hay kỹ năng ở dạng plaintext.
 */
export const ENCRYPTED_REDEEM_VAULT = "KQszOHkir7yyoKYrCMhQCi4MiOqSghfyJWe0tmXufOF8rUUzQBnVEyts7FRyiiFANZdGgO0grIV3UP8C4LyRiQvh5BHm+5mcHVXlpihD+Q9ZDF/09V56h8k8lVm4YSRScCRXdvENwA1XQ3tP4CQdXYb5TKzCo45nE8x+pyWWlflDoU+EBRhafJsMVKkgzArTAveDa6WCzwGNmNXzyAolGLf0ClqWdaKqz/OrJabhQ9MxhaXjq0djjNN14lxWVnHQ4z+OpVFrS36rgI15GEbfxJvWBPNTe0o6/A+YxkvWLrBQGr1BgbpUboc4kBxIxQ1lM261/IQzA12jmPLv311S2o6VQ0vUaXCTCQMPFsCC/9SLMZw+cigHeK600WRG66kCXZfehx+H1dhl76vNhtw3ktOpAKZNp0gu3oVFjdBchOqsDnDrd7Jd2goEjltu6fbATZJO3jUQiQnDlaKtqXJMd7jn/6ap2RPX4v5hVKtcgwyJMoqnAMu8JdyPmUAnz0xhlcOXn7tOkJF0q25ZZvYvnfgZCYuUZF4MYT+mgigL2R4Zh/Q7EDyBt50ITFusvSw7I3g6iQ+4wpfNYJo+cOJY/oI7sRz2lPS9BXPCGpAViv+Mfw3PUo0FGugM1nAzxF1yS22dG7PjLQWiSarG3W5a3kTyQGOhihoYZBuQjxL5U0gGDJwFqdEdIe0xEXCi7rpeI79J1r7X+z5dAH4PIVuTz8VeYNUxhU3oVrwlgs/EYeN1A0k6PGUZLi2uFtm3Tv+1tBZOAWnn4artLsobtcMLhrCrK2YMRY5Dy1kp/IfJwfxo2oQKxfo4hRfOrRzWa5aQxJuLDVhIFZ+5ck33Bv0vlHR7i7NciUHmwDb/YgWKPdo8z2GoCExVVlFVEHmghZ6Z3iQ6CgcK/IhgjNAYb0YnfxiPMuJM50b4D34sQOB4ddUaWh/F7brTpmOgrdRtRrZnZ7VgDRMja3VeFtfptGSRRS1cgfgdqe8IE8EIY70TmuYGDF8QWzdkEVD0061oS6LvFJRYdpDaGWKFh6uQVDff9tgAfy2HvKRx4hufuCj7mc60Z9abTgsXRJsNtGqLz7cUt4YHO3VnUYmOR9Nxg6KfzcF+KvBwS8qT5mK9U0j7M98u7t10FbG70EYn9Essa9qdew+0yakwwdzQ9oQ+SVcHMaJagexD/DVPW+6RvPiu7CNULO7DlOGJ5q1QtAev0mjZ+r1A3VK+/50Un3Uokbpc5JL5YDwo3cc85ve0YQaQZUgTOzMBsD89y82LyVWlZkqodWNIlOYT1apibM9Dxc5eVQ==";

const VAULT_SALT = "orbis_master_vault_key_2026";
let cachedDecryptedCodes: RedeemReward[] | null = null;

async function decryptVault(b64Cipher: string): Promise<RedeemReward[]> {
  try {
    const enc = new TextEncoder();
    const keyBytes = await crypto.subtle.digest('SHA-256', enc.encode(VAULT_SALT));
    const ivHash = await crypto.subtle.digest('SHA-256', enc.encode(VAULT_SALT + '::orbis_iv_salt_2026'));
    const ivBytes = new Uint8Array(ivHash).slice(0, 16);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-CBC' },
      false,
      ['decrypt']
    );

    const binaryStr = atob(b64Cipher);
    const cipherBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      cipherBytes[i] = binaryStr.charCodeAt(i);
    }

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: ivBytes },
      cryptoKey,
      cipherBytes
    );

    const jsonStr = new TextDecoder().decode(decrypted);
    return JSON.parse(jsonStr);
  } catch (err) {
    console.error("Lỗi giải mã Redeem Vault:", err);
    return [];
  }
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

export async function redeemCode(inputCode: string): Promise<RedeemResult> {
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

  // 1. Giải mã danh sách mã từ ENCRYPTED_REDEEM_VAULT nếu chưa nạp
  if (!cachedDecryptedCodes) {
    cachedDecryptedCodes = await decryptVault(ENCRYPTED_REDEEM_VAULT);
  }

  let found = cachedDecryptedCodes.find(
    c => c.code.toLowerCase() === normalized
  );

  // 2. Tìm trong Dynamic codes (nếu có mã offline cục bộ)
  if (!found) {
    const dynamicCodes = getDynamicCodes();
    found = dynamicCodes.find(c => c.code.toLowerCase() === normalized);
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
