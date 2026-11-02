import type { FrameRef } from '@/state/orbisBridge';
import { invoke } from "@tauri-apps/api/core";

/** Toạ độ & kích thước theo physical px; x/y đã quy về gốc = góc trên-trái overlay. */
export interface MonitorInfo {
  name: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  primary: boolean;
}

export interface OverlayLayout {
  originX: number;
  originY: number;
  width: number;
  height: number;
  monitors: MonitorInfo[];
}

export interface SystemInfo {
  isAdmin: boolean;
  idleMs: number;
}

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaReply {
  model: string;
  content: string;
  /** false nếu cấu hình max lỗi (vd. hết VRAM) và đã tự lùi về mặc định của Ollama. */
  maxPower: boolean;
}

export interface OllamaStatus {
  models: { name: string; sizeBytes: number }[];
  /** Model sẽ được chọn khi model = "auto". */
  largest: string | null;
  threads: number;
  ctxCap: number;
}

export interface OllamaOptions {
  /** Bỏ trống hoặc "auto" = model lớn nhất đã cài. */
  model?: string;
  /** Mặc định true: full GPU, toàn bộ luồng CPU, keep_alive vô hạn. */
  maxPower?: boolean;
}

export interface KeyValidationResult {
  valid: boolean;
  error?: string;
}

export const commands = {
  getOverlayLayout: () => invoke<OverlayLayout>("get_overlay_layout"),
  getSystemInfo: () => invoke<SystemInfo>("get_system_info"),
  openDashboard: () => invoke<void>("open_dashboard"),
  moveMouseBezier: (x: number, y: number) => invoke<void>("move_mouse_bezier", { x, y }),
  moveMouseNormalized: (normX: number, normY: number, monitorName?: string) =>
    invoke<void>("move_mouse_normalized", { normX, normY, monitorName: monitorName ?? null }),
  mouseClick: (button: 'left' | 'right' | 'middle' | 'double') => invoke<void>("mouse_click", { button }),
  sendKeystroke: (text: string) => invoke<void>("send_keystroke", { text }),
  setupPanicHook: () => invoke<void>("setup_panic_hook"),
  captureScreenRegion: (x: number, y: number, width: number, height: number) => 
    invoke<FrameRef>("capture_screen_region", { x, y, width, height }),
  ollamaStatus: () => invoke<OllamaStatus>("ollama_status"),
  startOllamaServer: () => invoke<string>("start_ollama_server"),
  checkOllamaDaemon: () => invoke<string>("check_ollama_daemon"),
  validateCloudApiKey: (provider: string, apiKey: string) =>
    invoke<KeyValidationResult>("validate_cloud_api_key", {
      provider,
      apiKey,
    }),
  triggerN8nWebhook: (params: {
    webhookUrl?: string;
    action: string;
    payload?: Record<string, any>;
    authToken?: string;
  }) =>
    invoke<any>("trigger_n8n_webhook", {
      webhookUrl: params.webhookUrl ?? null,
      action: params.action,
      payload: params.payload ?? null,
      authToken: params.authToken ?? null,
    }),
  testMcpConnection: (params: { serverUrl: string; authToken?: string; customHeaders?: Record<string, string>; type?: string; command?: string; args?: string[] }) =>
    invoke<McpTestResult>('mcp_list', { config: { type: params.type || 'http', serverUrl: params.serverUrl, authToken: params.authToken, headers: params.customHeaders, command: params.command, args: params.args } }),
  callMcpTool: (params: { serverUrl: string; toolName: string; arguments?: Record<string, unknown>; authToken?: string; customHeaders?: Record<string, string>; type?: string; command?: string; args?: string[] }) =>
    invoke<unknown>('mcp_execute', { config: { type: params.type || 'http', serverUrl: params.serverUrl, authToken: params.authToken, headers: params.customHeaders, command: params.command, args: params.args }, tool: params.toolName, arguments: params.arguments || {} }),
  readSystemMcpConfig: () => invoke<McpSystemConfigResult>("read_system_mcp_config"),
  startSandboxVm: () => invoke<string>("start_sandbox_vm"),
  createSandboxCheckpoint: (snapshotName: string) => invoke<string>("create_sandbox_checkpoint", { snapshotName }),
  rollbackSandboxCheckpoint: (snapshotName: string) => invoke<string>("rollback_sandbox_checkpoint", { snapshotName }),
  execInSandbox: (guestCmd: string) => invoke<string>("exec_in_sandbox", { guestCmd }),
  placeVmOnSecondaryScreen: () => invoke<string>("place_vm_on_secondary_screen"),
  requestAdminElevation: () => invoke<string>("request_admin_elevation"),
  getPetInfo: () => invoke<PetInfo>("get_pet_info"),
};

export interface PetInfo {
  id: string;
  name: string;
  species: string;
  breed: string;
  isAvailable: boolean;
  clipsCount: number;
}

export interface McpToolItem {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface McpTestResult {
  success: boolean;
  latencyMs: number;
  count: number;
  tools: McpToolItem[];
}

export interface McpSystemConfigResult {
  exists: boolean;
  path: string;
  servers: {
    id: string;
    name: string;
    serverUrl?: string;
    authToken?: string;
    headers?: Record<string, string>;
    command?: string;
    type: 'http' | 'stdio';
    enabled: boolean;
  }[];
}
