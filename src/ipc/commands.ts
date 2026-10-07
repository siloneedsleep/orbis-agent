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

export const commands = {
  getOverlayLayout: () => invoke<OverlayLayout>("get_overlay_layout"),
  getSystemInfo: () => invoke<SystemInfo>("get_system_info"),
  openDashboard: () => invoke<void>("open_dashboard"),
  ollamaStatus: () => invoke<OllamaStatus>("ollama_status"),
  ollamaChat: (messages: OllamaMessage[], opts: OllamaOptions = {}) =>
    invoke<OllamaReply>("ollama_chat", {
      messages,
      model: opts.model ?? null,
      maxPower: opts.maxPower ?? true,
    }),
};
