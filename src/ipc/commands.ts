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
  /** Ảnh base64 (không có tiền tố data:) cho model vision. */
  images?: string[];
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
  setOverlayInteractive: (enabled: boolean) => invoke<void>("set_overlay_interactive", { enabled }),
  getSystemInfo: () => invoke<SystemInfo>("get_system_info"),
  openDashboard: () => invoke<void>("open_dashboard"),
  moveMouseBezier: (x: number, y: number) => invoke<void>("move_mouse_bezier", { x, y }),
  moveMouseNormalized: (normX: number, normY: number, monitorName?: string) =>
    invoke<void>("move_mouse_normalized", { normX, normY, monitorName: monitorName ?? null }),
  mouseClick: (button: 'left' | 'right') => invoke<void>("mouse_click", { button }),
  sendKeystroke: (text: string) => invoke<void>("send_keystroke", { text }),
  setupPanicHook: () => invoke<void>("setup_panic_hook"),
  captureScreenRegion: (x: number, y: number, width: number, height: number) => 
    invoke<string>("capture_screen_region", { x, y, width, height }),
  ollamaStatus: () => invoke<OllamaStatus>("ollama_status"),
  startOllamaServer: () => invoke<string>("start_ollama_server"),
  checkOllamaDaemon: () => invoke<string>("check_ollama_daemon"),
  ollamaChat: (messages: OllamaMessage[], opts: OllamaOptions = {}) =>
    invoke<OllamaReply>("ollama_chat", {
      messages,
      model: opts.model ?? null,
      maxPower: opts.maxPower ?? true,
    }),
  callLocalLlm: (messages: OllamaMessage[], opts: OllamaOptions = {}) =>
    invoke<OllamaReply>("call_local_llm", {
      messages,
      model: opts.model ?? null,
      maxPower: opts.maxPower ?? true,
    }),
  ollamaGenerate: (prompt: string, opts: { system?: string; model?: string; images?: string[] } = {}) =>
    invoke<OllamaReply>("ollama_generate", {
      prompt,
      system: opts.system ?? null,
      model: opts.model ?? null,
      images: opts.images ?? null,
    }),
  validateCloudApiKey: (provider: string, apiKey: string) =>
    invoke<KeyValidationResult>("validate_cloud_api_key", {
      provider,
      apiKey,
    }),
  cloudLlmChat: (params: {
    provider: string;
    apiKey: string;
    model?: string;
    systemPrompt: string;
    userPrompt: string;
    imageBase64?: string;
  }) =>
    invoke<OllamaReply>("cloud_llm_chat", {
      provider: params.provider,
      apiKey: params.apiKey,
      model: params.model ?? null,
      systemPrompt: params.systemPrompt,
      userPrompt: params.userPrompt,
      imageBase64: params.imageBase64 ?? null,
    }),
  startSandboxVm: () => invoke<string>("start_sandbox_vm"),
  createSandboxCheckpoint: (snapshotName: string) => invoke<string>("create_sandbox_checkpoint", { snapshotName }),
  rollbackSandboxCheckpoint: (snapshotName: string) => invoke<string>("rollback_sandbox_checkpoint", { snapshotName }),
  execInSandbox: (guestCmd: string) => invoke<string>("exec_in_sandbox", { guestCmd }),
  placeVmOnSecondaryScreen: () => invoke<string>("place_vm_on_secondary_screen"),
  requestAdminElevation: () => invoke<string>("request_admin_elevation"),
  getPetInfo: () => invoke<PetInfo>("get_pet_info"),
  getPetVideoBase64: (clipName: string) => invoke<string>("get_pet_video_base64", { clipName }),
};

export interface PetInfo {
  id: string;
  name: string;
  species: string;
  breed: string;
  isAvailable: boolean;
  clipsCount: number;
}
