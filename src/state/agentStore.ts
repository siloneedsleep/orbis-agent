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

export function buildSystemPrompt(profile?: UserProfile | null): string {
  const userName = profile?.name?.trim() || "Người dùng";
  const pronoun = profile?.pronoun || "bạn";

  return `Bạn là Orbis Agent - Trợ lý AI và Hệ thống Tự động hóa Desktop chuyên biệt cho Windows (theo kiến trúc OperUI / DeepSeek Harness).
Thông tin người dùng:
- Tên: ${userName}
- Đại từ nhân xưng: Hãy gọi người dùng là "${pronoun}" và xưng là "tôi" hoặc "Orbis" một cách lịch sự, nhã nhặn, tôn trọng và chuyên nghiệp.

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
