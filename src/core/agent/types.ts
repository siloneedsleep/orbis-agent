import type { EditBlockPayload, RepoMapEntry, ShellResult } from "@/ipc/commands";

export type AgentPhase =
  | "idle" | "planning" | "awaiting_llm" | "parsing" | "applying"
  | "observing" | "done" | "error";

export type AgentActionKind =
  | "read_file" | "write_file" | "list_dir" | "run_shell"
  | "apply_edit_blocks" | "done";

export interface ReadFileAction { kind: "read_file"; path: string; }
export interface WriteFileAction { kind: "write_file"; path: string; content: string; }
export interface ListDirAction { kind: "list_dir"; path: string; }
export interface RunShellAction {
  kind: "run_shell"; cmd: string; cwd?: string; timeoutMs?: number;
}
export interface ApplyEditAction { kind: "apply_edit_blocks"; blocks: EditBlockPayload[]; }
export interface DoneAction { kind: "done"; message: string; }

export type AgentAction =
  | ReadFileAction | WriteFileAction | ListDirAction
  | RunShellAction | ApplyEditAction | DoneAction;

export interface Observation {
  kind: AgentActionKind; ok: boolean; summary: string;
  payload?: unknown; raw?: ShellResult;
}

export interface AgentEvent {
  ts: number; phase: AgentPhase; action?: AgentAction;
  observation?: Observation; note?: string;
}

export interface AgentContext {
  root: string; repoMap: RepoMapEntry[];
  history: AgentEvent[]; maxIterations: number;
}

export interface LLMMessage { role: "system" | "user" | "assistant"; content: string; }

export interface LLMChatOptions {
  model?: string; temperature?: number; maxTokens?: number; signal?: AbortSignal;
}

export interface LLMProvider {
  readonly id: string;
  chat(messages: LLMMessage[], opts?: LLMChatOptions): Promise<string>;
}

export interface AgentLoopOptions {
  root: string; provider: LLMProvider; maxIterations?: number;
  model?: string; onEvent?: (e: AgentEvent) => void; signal?: AbortSignal;
}
