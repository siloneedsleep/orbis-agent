import { invoke } from "@tauri-apps/api/core";

export interface MonitorInfo {
  name: string | null;
  x: number; y: number; width: number; height: number;
  scale: number; primary: boolean;
}
export interface OverlayLayout {
  originX: number; originY: number; width: number; height: number;
  monitors: MonitorInfo[];
}
export interface SystemInfo {
  isAdmin: boolean; idleMs: number; windowsBuild: number; platform: string;
}
export interface OllamaMessage {
  role: "system" | "user" | "assistant"; content: string; images?: string[];
}
export interface OllamaReply { model: string; content: string; maxPower: boolean; }
export interface OllamaStatus {
  models: { name: string; sizeBytes: number }[];
  largest: string | null; threads: number; ctxCap: number;
}
export interface OllamaOptions { model?: string; maxPower?: boolean; }

export interface FsEntry { name: string; path: string; isDir: boolean; sizeBytes: number; }
export interface ShellResult { stdout: string; stderr: string; exitCode: number; timedOut: boolean; }
export interface RepoMapEntry { path: string; symbols: string[]; lines: number; }
export interface EditBlockPayload { path: string; search: string; replace: string; }
export interface ApplyResult { path: string; applied: boolean; diff: string; error: string | null; }

export const commands = {
  getOverlayLayout: () => invoke<OverlayLayout>("get_overlay_layout"),
  getSystemInfo: () => invoke<SystemInfo>("get_system_info"),
  openDashboard: () => invoke<void>("open_dashboard"),
  ollamaStatus: () => invoke<OllamaStatus>("ollama_status"),
  ollamaChat: (messages: OllamaMessage[], opts: OllamaOptions = {}) =>
    invoke<OllamaReply>("ollama_chat", {
      messages, model: opts.model ?? null, maxPower: opts.maxPower ?? true,
    }),
  fsRead: (path: string) => invoke<string>("agent_fs_read", { path }),
  fsWrite: (path: string, content: string) =>
    invoke<void>("agent_fs_write", { path, content }),
  fsExists: (path: string) => invoke<boolean>("agent_fs_exists", { path }),
  fsList: (path: string) => invoke<FsEntry[]>("agent_fs_list", { path }),
  shellExec: (cmd: string, cwd?: string, timeoutMs?: number) =>
    invoke<ShellResult>("agent_shell_exec", {
      cmd, cwd: cwd ?? null, timeoutMs: timeoutMs ?? null,
    }),
  buildRepoMap: (root: string, tokenBudget?: number) =>
    invoke<RepoMapEntry[]>("agent_build_repo_map", {
      root, tokenBudget: tokenBudget ?? null,
    }),
  applyEdits: (blocks: EditBlockPayload[], dryRun: boolean) =>
    invoke<ApplyResult[]>("agent_apply_edits", { blocks, dryRun }),
} as const;
