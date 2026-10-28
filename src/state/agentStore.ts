export interface UserProfile {
  name: string;
  gender: 'male' | 'female' | 'other';
  pronoun: string; // 'anh' | 'chị' | 'bạn'
}

export interface LLMConfig {
  type: 'local' | 'api';
  mode?: 'local' | 'cloud';
  provider: 'ollama' | 'deepseek' | 'gemini' | 'openai' | 'claude';
  model: string;
  localModel?: string;
  cloudModel?: string;
  cloudProvider?: 'deepseek' | 'gemini' | 'openai' | 'claude';
  apiKey?: string;
  maxPower?: boolean;
}

export type SandboxExecutionPolicy = 'request_review' | 'default' | 'auto' | 'turbo';

const SANDBOX_POLICY_KEY = 'orbis_sandbox_policy';

export function getStoredSandboxPolicy(): SandboxExecutionPolicy {
  try {
    const raw = localStorage.getItem(SANDBOX_POLICY_KEY);
    if (raw === 'request_review' || raw === 'default' || raw === 'auto' || raw === 'turbo') {
      return raw;
    }
    return 'default';
  } catch {
    return 'default';
  }
}

export function saveStoredSandboxPolicy(policy: SandboxExecutionPolicy): void {
  try {
    localStorage.setItem(SANDBOX_POLICY_KEY, policy);
  } catch {
    // ignore
  }
}

export interface N8nConfig {
  enabled: boolean;
  webhookUrl: string;
  apiKey?: string;
}

const N8N_KEY = 'orbis_n8n_config';
export const DEFAULT_N8N_CONFIG: N8nConfig = {
  enabled: true,
  webhookUrl: 'https://siloneedsleep.app.n8n.cloud/webhook/orbis-bridge',
  apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzYzQxOWM3Yy01OWViLTQwYjItYTMxMC03MGVhOTlkMzY0N2IiLCJpc3MiOiJuOG4iLCJqdGkiOiJjZTNhYWE1ZS00ZTFjLTRjN2QtOWE5NC0zOTYzMzdkYzIwNzgiLCJpYXQiOjE3OTMxMTA5MTMsImF1ZCI6Im1jcC1zZXJ2ZXItYXBpIn0.NI-k02e1Z_4BSESEHSQ_Fs2hybySS1omt-Fr0rw7YW0',
};

export function getStoredN8nConfig(): N8nConfig {
  try {
    const raw = localStorage.getItem(N8N_KEY);
    if (!raw) return DEFAULT_N8N_CONFIG;
    return { ...DEFAULT_N8N_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_N8N_CONFIG;
  }
}

export function saveStoredN8nConfig(cfg: N8nConfig): void {
  try {
    localStorage.setItem(N8N_KEY, JSON.stringify(cfg));
  } catch {
    // ignore
  }
}

export interface McpServerConfig {
  id: string;
  name: string;
  type: 'http' | 'sse' | 'stdio';
  serverUrl?: string;
  authToken?: string;
  command?: string;
  headers?: Record<string, string>;
  enabled: boolean;
  status?: 'connected' | 'disconnected' | 'testing' | 'error';
  latencyMs?: number;
  tools?: {
    name: string;
    description?: string;
    inputSchema?: any;
  }[];
  errorMessage?: string;
  lastChecked?: string;
}

const MCP_SERVERS_KEY = 'orbis_mcp_servers';
export const DEFAULT_MCP_SERVERS: McpServerConfig[] = [
  {
    id: 'mcp-n8n',
    name: 'n8n Cloud MCP Server',
    type: 'http',
    serverUrl: 'https://siloneedsleep.app.n8n.cloud/mcp-server/http',
    authToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzYzQxOWM3Yy01OWViLTQwYjItYTMxMC03MGVhOTlkMzY0N2IiLCJpc3MiOiJuOG4iLCJqdGkiOiJjZTNhYWE1ZS00ZTFjLTRjN2QtOWE5NC0zOTYzMzdkYzIwNzgiLCJpYXQiOjE3OTMxMTA5MTMsImF1ZCI6Im1jcC1zZXJ2ZXItYXBpIn0.NI-k02e1Z_4BSESEHSQ_Fs2hybySS1omt-Fr0rw7YW0',
    enabled: true,
  }
];

export function getStoredMcpServers(): McpServerConfig[] {
  try {
    const raw = localStorage.getItem(MCP_SERVERS_KEY);
    if (!raw) return DEFAULT_MCP_SERVERS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_MCP_SERVERS;
  } catch {
    return DEFAULT_MCP_SERVERS;
  }
}

export function saveStoredMcpServers(servers: McpServerConfig[]): void {
  try {
    localStorage.setItem(MCP_SERVERS_KEY, JSON.stringify(servers));
    storeListeners.forEach((listener) => listener());
  } catch {
    // ignore
  }
}

export interface ActionPayload {
  tool: 'ClickButton' | 'MoveMouse' | 'SendKeystroke' | 'CaptureScreen' | 'ExecutePowerShell' | 'SandboxExec' | 'N8nTrigger' | 'McpToolCall';
  params: Record<string, any>;
  result?: any;
  status: 'pending_approval' | 'running' | 'success' | 'error' | 'rejected';
  durationMs?: number;
  policyMode?: SandboxExecutionPolicy;
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
  treats: number; // Tiền tệ của mèo (Treats 🐟)
  redeemedCodes: string[]; // Danh sách mã redeem đã dùng
  isCreator?: boolean; // Quyền tạo & quản lý skill
  speechBubbleEnabled: boolean;
  taughtSkills: CatSkill[];
}

const CAT_KEY = 'orbis_cat_settings';
export const CREATOR_KEY = 'orbis_creator_key';
export const CREATOR_MASTER_SIGN = 'ORBIS_CREATOR_ROOT_KEY_9999';

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
  treats: 50,
  redeemedCodes: [],
  isCreator: true,
  speechBubbleEnabled: true,
  taughtSkills: DEFAULT_CAT_SKILLS,
};

export function isCreatorDevice(): boolean {
  try {
    const key = localStorage.getItem(CREATOR_KEY);
    if (!key) {
      // Mặc định khởi tạo creator key trên máy phát triển này
      localStorage.setItem(CREATOR_KEY, CREATOR_MASTER_SIGN);
      return true;
    }
    return key === CREATOR_MASTER_SIGN;
  } catch {
    return false;
  }
}

export function getStoredCatSettings(): CatSettings {
  try {
    const raw = localStorage.getItem(CAT_KEY);
    if (!raw) return DEFAULT_CAT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CAT_SETTINGS,
      ...parsed,
      treats: typeof parsed.treats === 'number' ? parsed.treats : 50,
      redeemedCodes: Array.isArray(parsed.redeemedCodes) ? parsed.redeemedCodes : [],
      isCreator: isCreatorDevice(),
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
  let bonusTreats = 0;

  while (newExp >= 100 && newLevel < 10) {
    newExp -= 100;
    newLevel += 1;
    bonusTreats += 50; // Thưởng 50 Treats khi lên cấp!
  }

  const updated: CatSettings = {
    ...current,
    bondLevel: newLevel,
    bondExp: Math.min(newExp, 99),
    treats: current.treats + bonusTreats,
  };
  saveStoredCatSettings(updated);
  return updated;
}

export function addCatTreats(amount: number): CatSettings {
  const current = getStoredCatSettings();
  const updated: CatSettings = {
    ...current,
    treats: Math.max(0, (current.treats || 0) + amount),
  };
  saveStoredCatSettings(updated);
  return updated;
}

export function spendCatTreats(amount: number): { success: boolean; settings: CatSettings; message?: string } {
  const current = getStoredCatSettings();
  if ((current.treats || 0) < amount) {
    return {
      success: false,
      settings: current,
      message: `Bạn không đủ Treats! (Cần ${amount} 🐟, hiện có ${current.treats || 0} 🐟)`
    };
  }

  const updated: CatSettings = {
    ...current,
    treats: current.treats - amount,
  };
  saveStoredCatSettings(updated);
  return { success: true, settings: updated };
}

export function renameCat(newName: string): { success: boolean; settings: CatSettings; message: string } {
  const current = getStoredCatSettings();
  if (current.bondLevel < 10) {
    return {
      success: false,
      settings: current,
      message: `Cần đạt Cấp độ thân thiết Lv.10 để mở khóa quyền đặt tên cho Mèo! (Hiện tại: Lv.${current.bondLevel}/10)`
    };
  }

  const name = newName.trim();
  if (!name) {
    return {
      success: false,
      settings: current,
      message: "Tên mèo không được để trống!"
    };
  }

  const updated: CatSettings = {
    ...current,
    name
  };
  saveStoredCatSettings(updated);
  return {
    success: true,
    settings: updated,
    message: `Đã đổi tên mèo thành "${name}"! ✨`
  };
}

const PROFILE_KEY = 'orbis_user_profile';
const LLM_KEY = 'orbis_llm_config';

type StoreChangeListener = () => void;
const storeListeners = new Set<StoreChangeListener>();

let cachedProfile: UserProfile | null = null;
let cachedLLMConfig: LLMConfig | null = null;

function normalizeLLMConfig(rawConfig: Partial<LLMConfig> | null): LLMConfig | null {
  if (!rawConfig) return null;
  const isLocal = rawConfig.mode === 'local' || rawConfig.type === 'local' || rawConfig.provider === 'ollama';
  const mode: 'local' | 'cloud' = isLocal ? 'local' : 'cloud';
  const type: 'local' | 'api' = isLocal ? 'local' : 'api';
  const cloudProvider = (
    rawConfig.cloudProvider ||
    (rawConfig.provider && rawConfig.provider !== 'ollama' ? rawConfig.provider : undefined) ||
    'deepseek'
  ) as 'deepseek' | 'gemini' | 'openai' | 'claude';
  const provider = isLocal ? 'ollama' : cloudProvider;

  const localModel = rawConfig.localModel || (isLocal ? rawConfig.model : undefined) || 'auto';
  const cloudModel = rawConfig.cloudModel || (!isLocal ? rawConfig.model : undefined) || 'deepseek-chat';
  const model = isLocal ? localModel : cloudModel;

  let apiKey = rawConfig.apiKey;
  if (!apiKey && typeof window !== 'undefined' && window.localStorage) {
    apiKey =
      localStorage.getItem(`orbis_${cloudProvider}_key`) ||
      localStorage.getItem('orbis_gemini_key') ||
      localStorage.getItem('orbis_openai_key') ||
      localStorage.getItem('orbis_claude_key') ||
      localStorage.getItem('orbis_deepseek_key') ||
      undefined;
  }

  return {
    type,
    mode,
    provider,
    model,
    localModel,
    cloudModel,
    cloudProvider,
    apiKey,
    maxPower: rawConfig.maxPower ?? true,
  };
}

export function getStoredProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    cachedProfile = raw ? JSON.parse(raw) : null;
    return cachedProfile;
  } catch {
    return cachedProfile;
  }
}

export function saveStoredProfile(profile: UserProfile): void {
  cachedProfile = profile;
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  storeListeners.forEach((listener) => listener());
}

export function getStoredLLMConfig(): LLMConfig | null {
  try {
    const raw = localStorage.getItem(LLM_KEY);
    if (!raw) return cachedLLMConfig;
    const parsed = JSON.parse(raw);
    cachedLLMConfig = normalizeLLMConfig(parsed);
    return cachedLLMConfig;
  } catch {
    return cachedLLMConfig;
  }
}

export function saveStoredLLMConfig(config: LLMConfig): void {
  const prev = getStoredLLMConfig();
  const isLocal = config.mode === 'local' || config.type === 'local' || config.provider === 'ollama';
  const cloudProvider = (
    !isLocal && config.provider !== 'ollama'
      ? config.provider
      : config.cloudProvider || prev?.cloudProvider || (prev?.provider !== 'ollama' ? prev?.provider : 'deepseek') || 'deepseek'
  ) as 'deepseek' | 'gemini' | 'openai' | 'claude';

  const merged: LLMConfig = {
    type: isLocal ? 'local' : 'api',
    mode: isLocal ? 'local' : 'cloud',
    provider: isLocal ? 'ollama' : cloudProvider,
    model: config.model || (isLocal ? prev?.localModel || 'auto' : prev?.cloudModel || 'deepseek-chat'),
    localModel: isLocal ? (config.localModel || config.model || 'auto') : (config.localModel || prev?.localModel || 'auto'),
    cloudModel: !isLocal ? (config.cloudModel || config.model || 'deepseek-chat') : (config.cloudModel || prev?.cloudModel || 'deepseek-chat'),
    cloudProvider,
    apiKey: config.apiKey?.trim() || prev?.apiKey,
    maxPower: config.maxPower ?? prev?.maxPower ?? true,
  };

  if (merged.apiKey && typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(`orbis_${cloudProvider}_key`, merged.apiKey);
  }

  cachedLLMConfig = merged;
  localStorage.setItem(LLM_KEY, JSON.stringify(merged));
  storeListeners.forEach((listener) => listener());
}

export function subscribeAgentStore(listener: StoreChangeListener): () => void {
  storeListeners.add(listener);
  return () => {
    storeListeners.delete(listener);
  };
}

// Đồng bộ tự động cấu hình LLM & Profile giữa 2 cửa sổ WebView (dashboard.html <-> overlay.html)
if (typeof window !== 'undefined') {
  cachedProfile = getStoredProfile();
  cachedLLMConfig = getStoredLLMConfig();

  window.addEventListener('storage', (event: StorageEvent) => {
    if (
      !event.key ||
      event.key === LLM_KEY ||
      event.key === PROFILE_KEY ||
      event.key === CAT_KEY ||
      event.key.startsWith('orbis_')
    ) {
      cachedProfile = getStoredProfile();
      cachedLLMConfig = getStoredLLMConfig();
      storeListeners.forEach((listener) => listener());
    }
  });
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
3. Ra lệnh tự động hóa: Trả về DUY NHẤT 1 JSON object hợp lệ sử dụng khóa "type" khớp hoàn toàn với định nghĩa AgentAction (không bọc văn bản giải thích bên ngoài JSON):
- Di chuyển chuột:
  { "type": "mouse_move", "x": 500, "y": 300, "thought": "Suy nghĩ phân tích...", "message": "Thông báo cho ${pronoun} ${userName}" }
- Click chuột:
  { "type": "mouse_click", "button": "left", "thought": "Suy nghĩ phân tích...", "message": "Thông báo cho ${pronoun} ${userName}" }
- Gõ phím:
  { "type": "keyboard_type", "text": "Nội dung cần gõ", "thought": "Suy nghĩ phân tích...", "message": "Thông báo cho ${pronoun} ${userName}" }
- Chạy lệnh trong Sandbox an toàn:
  { "type": "sandbox_exec", "command": "Lệnh thực thi", "requireCheckpoint": true, "thought": "Suy nghĩ phân tích...", "message": "Thông báo cho ${pronoun} ${userName}" }
- Kích hoạt n8n Cloud Automation / Webhook (gửi email, cào web, thông báo Telegram, kết nối GitHub):
  { "type": "n8n_execute", "workflow": "Tên tác vụ (vd: send_email, scrape_web, notify_telegram, sync_github)", "payload": { "key": "value" }, "thought": "Suy nghĩ phân tích...", "message": "Thông báo cho ${pronoun} ${userName}" }
- Hoàn tất tác vụ / Trả lời người dùng:
  { "type": "done", "message": "Câu trả lời hoặc báo cáo hoàn tất cho ${pronoun} ${userName}", "thought": "Suy nghĩ phân tích..." }

Quy tắc bảo mật & an toàn:
- Nếu thao tác liên quan đến lệnh hệ thống nguy hiểm (xóa tệp, can thiệp registry, cài đặt phần mềm không rõ nguồn gốc), BẮT BUỘC thực thi trong Sandbox (type: "sandbox_exec").
- Nếu thao tác liên quan đến dịch vụ Cloud/Web (gửi mail, thông báo, trigger n8n), BẮT BUỘC sử dụng n8n Cloud (type: "n8n_execute").
- Luôn giữ thái độ phục vụ tận tâm, ngắn gọn và chính xác.`;
}


