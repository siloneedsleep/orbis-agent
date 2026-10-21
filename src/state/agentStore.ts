export interface UserProfile {
  name: string;
  gender: 'male' | 'female' | 'other';
  pronoun: string; // 'anh' | 'chị' | 'bạn'
}

export interface LLMConfig {
  type: 'local' | 'api';
  provider: 'ollama' | 'deepseek' | 'gemini' | 'openai' | 'claude';
  model: string;
  apiKey?: string;
  maxPower?: boolean;
}

export interface ActionPayload {
  tool: 'ClickButton' | 'MoveMouse' | 'SendKeystroke' | 'CaptureScreen' | 'ExecutePowerShell' | 'SandboxExec';
  params: Record<string, any>;
  result?: any;
  status: 'running' | 'success' | 'error';
  durationMs?: number;
}

export interface WorkstreamItem {
  id: string;
  type: 'user' | 'assistant' | 'thinking' | 'action';
  content?: string;
  timestamp: string;
  actionData?: ActionPayload;
  stage?: 'analyzing' | 'planning' | 'executing' | 'verifying';
  screenshot?: string; // base64
}

export interface CatSkill {
  id: string;
  name: string;
  trigger: string;
  actionPrompt: string;
  enabled: boolean;
  category: 'habit' | 'macro' | 'personality' | 'safety';
}

export type CatColorTheme = 'cyan' | 'emerald' | 'violet' | 'amber' | 'gold';

export interface CatSettings {
  name: string;
  colorTheme: CatColorTheme;
  scale: number;
  position: { x: number; y: number };
  enabled: boolean;
  bondLevel: number;
  bondExp: number;
  speechBubbleEnabled: boolean;
  taughtSkills: CatSkill[];
}

const CAT_KEY = 'orbis_cat_settings';

export const DEFAULT_CAT_SKILLS: CatSkill[] = [
  {
    id: 'skill-sandbox-guard',
    name: 'Vệ sĩ Sandbox',
    trigger: 'Khi phát hiện thao tác xóa tệp hàng loạt hoặc can thiệp registry',
    actionPrompt: 'Tự động cô lập và điều hướng thực thi vào Detonation Sandbox (sandbox_exec) để bảo vệ hệ thống của người dùng.',
    enabled: true,
    category: 'safety'
  },
  {
    id: 'skill-cheer',
    name: 'Mừng công hoàn thành',
    trigger: 'Khi hoàn thành xuất sắc một tác vụ phức tạp',
    actionPrompt: 'Gửi lời khen ngợi ngắn gọn, ấm áp và chúc mừng thân thiện cho người dùng.',
    enabled: true,
    category: 'personality'
  },
  {
    id: 'skill-concise',
    name: 'Tác phong gọn gàng',
    trigger: 'Khi báo cáo tiến độ và thông báo kết quả',
    actionPrompt: 'Tránh giải thích lan man, chỉ trả về nội dung trọng tâm và kết quả súc tích.',
    enabled: true,
    category: 'habit'
  },
  {
    id: 'skill-hydration',
    name: 'Nhắc nhở sức khỏe',
    trigger: 'Khi người dùng đã làm việc liên tục nhiều bước',
    actionPrompt: 'Khẽ meow và nhắc người dùng uống nước hoặc cho mắt nghỉ ngơi 30 giây.',
    enabled: true,
    category: 'habit'
  }
];

export const DEFAULT_CAT_SETTINGS: CatSettings = {
  name: 'Silo',
  colorTheme: 'cyan',
  scale: 1.0,
  position: { x: 50, y: 50 },
  enabled: true,
  bondLevel: 1,
  bondExp: 25,
  speechBubbleEnabled: true,
  taughtSkills: DEFAULT_CAT_SKILLS,
};

export function getStoredCatSettings(): CatSettings {
  try {
    const raw = localStorage.getItem(CAT_KEY);
    if (!raw) return DEFAULT_CAT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CAT_SETTINGS,
      ...parsed,
      taughtSkills: parsed.taughtSkills || DEFAULT_CAT_SKILLS,
    };
  } catch {
    return DEFAULT_CAT_SETTINGS;
  }
}

export function saveStoredCatSettings(settings: CatSettings): void {
  localStorage.setItem(CAT_KEY, JSON.stringify(settings));
}

export function addCatExp(amount: number): CatSettings {
  const current = getStoredCatSettings();
  let newExp = current.bondExp + amount;
  let newLevel = current.bondLevel;

  while (newExp >= 100 && newLevel < 10) {
    newExp -= 100;
    newLevel += 1;
  }

  const updated: CatSettings = {
    ...current,
    bondLevel: newLevel,
    bondExp: Math.min(newExp, 99),
  };
  saveStoredCatSettings(updated);
  return updated;
}

const PROFILE_KEY = 'orbis_user_profile';
const LLM_KEY = 'orbis_llm_config';

export function getStoredProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveStoredProfile(profile: UserProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function getStoredLLMConfig(): LLMConfig | null {
  try {
    const raw = localStorage.getItem(LLM_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveStoredLLMConfig(config: LLMConfig): void {
  localStorage.setItem(LLM_KEY, JSON.stringify(config));
}

export function buildSystemPrompt(profile?: UserProfile | null, catSettings?: CatSettings | null): string {
  const userName = profile?.name?.trim() || "Người dùng";
  const pronoun = profile?.pronoun || "bạn";
  const cat = catSettings || getStoredCatSettings();

  const activeSkills = cat.taughtSkills.filter(s => s.enabled);
  const skillsPrompt = activeSkills.length > 0 
    ? `\nCác kỹ năng và thói quen mà ${pronoun} ${userName} đã đích thân huấn luyện cho Mèo Trợ lý (${cat.name}):\n` +
      activeSkills.map(s => `- [${s.name}]: ${s.trigger} -> ${s.actionPrompt}`).join('\n')
    : '';

  return `Bạn là Orbis Agent - Trợ lý AI và Hệ thống Tự động hóa Desktop chuyên biệt cho Windows (theo kiến trúc OperUI / DeepSeek Harness).
Linh vật đồng hành của hệ thống: Chú mèo công nghệ tên là "${cat.name}" (Mèo Xanh Cyber Cat, Cấp độ thân thiết: ${cat.bondLevel}/10).

Thông tin người dùng:
- Tên: ${userName}
- Đại từ nhân xưng: Hãy gọi người dùng là "${pronoun}" và xưng là "tôi" hoặc "${cat.name}" một cách lịch sự, nhã nhặn, tôn trọng và chuyên nghiệp.
${skillsPrompt}

Nhiệm vụ của bạn:
1. Tiếp nhận yêu cầu của ${pronoun} ${userName}.
2. Suy luận (Chain of Thought): Phân tích ngữ cảnh màn hình và các cửa sổ đang mở.
3. Ra lệnh tự động hóa: Trả về kế hoạch JSON theo định dạng nghiêm ngặt:
{
  "thought": "Suy nghĩ phân tích của bạn tại đây...",
  "action": "mouse_move" | "mouse_click" | "keyboard_type" | "sandbox_exec" | "done",
  "params": { ... },
  "message": "Thông báo ngắn gọn cho ${pronoun} ${userName}"
}

Quy tắc bảo mật & an toàn:
- Nếu thao tác liên quan đến lệnh hệ thống nguy hiểm (xóa tệp, can thiệp registry, cài đặt phần mềm không rõ nguồn gốc), BẮT BUỘC thực thi trong Detonation Sandbox (sandbox_exec).
- Luôn giữ thái độ phục vụ tận tâm, ngắn gọn và chính xác.`;
}

