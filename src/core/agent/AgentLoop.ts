import { commands, type ApplyResult, type EditBlockPayload } from "@/ipc/commands";
import { parseEditBlocks, EDIT_BLOCK_FORMAT_INSTRUCTION } from "./EditBlockCoder";
import { loadRepoMap, renderRepoMap } from "./RepoMap";
import type {
  AgentAction, AgentEvent, AgentLoopOptions, LLMMessage, Observation,
} from "./types";

const SYSTEM_PROMPT = `
Bạn là Orbis Agent — autonomous coding agent trên Windows 11.
Mỗi lượt, trả về DUY NHẤT một JSON (không markdown fence):

{
  "thought": "suy luận ngắn",
  "action": { "kind": "<read_file|write_file|list_dir|run_shell|apply_edit_blocks|done>", ... }
}

Schema:
- read_file:        { "path": "..." }
- write_file:       { "path": "...", "content": "..." }
- list_dir:         { "path": "..." }
- run_shell:        { "cmd": "...", "cwd": null, "timeoutMs": 30000 }
- apply_edit_blocks:{ "blocks": [ { "path": "...", "search": "...", "replace": "..." } ] }
- done:             { "message": "..." }

${EDIT_BLOCK_FORMAT_INSTRUCTION}
`.trim();

function extractJson(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("LLM output không phải JSON.");
  return JSON.parse(raw.slice(start, end + 1));
}

function parseAction(json: unknown): AgentAction {
  if (!json || typeof json !== "object") throw new Error("Action không hợp lệ.");
  const a = (json as { action?: unknown }).action;
  if (!a || typeof a !== "object") throw new Error("Thiếu trường 'action'.");
  const act = a as Record<string, unknown>;
  const kind = act.kind;
  switch (kind) {
    case "read_file": return { kind, path: String(act.path ?? "") };
    case "write_file": return { kind, path: String(act.path ?? ""), content: String(act.content ?? "") };
    case "list_dir": return { kind, path: String(act.path ?? "") };
    case "run_shell":
      return {
        kind,
        cmd: String(act.cmd ?? ""),
        cwd: typeof act.cwd === "string" ? act.cwd : undefined,
        timeoutMs: typeof act.timeoutMs === "number" ? act.timeoutMs : undefined,
      };
    case "apply_edit_blocks": {
      const raw = Array.isArray(act.blocks) ? act.blocks : [];
      const blocks: EditBlockPayload[] = raw
        .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
        .map((b) => ({
          path: String(b.path ?? ""),
          search: String(b.search ?? ""),
          replace: String(b.replace ?? ""),
        }));
      return { kind, blocks };
    }
    case "done": return { kind, message: String(act.message ?? "Hoàn tất.") };
    default: throw new Error(`Action kind không hỗ trợ: ${String(kind)}`);
  }
}

export class AgentLoop {
  private readonly history: LLMMessage[] = [];
  private readonly events: AgentEvent[] = [];

  constructor(private readonly opts: AgentLoopOptions) {}

  private emit(e: Omit<AgentEvent, "ts">): void {
    const ev: AgentEvent = { ts: Date.now(), ...e };
    this.events.push(ev);
    this.opts.onEvent?.(ev);
  }

  private async execute(action: AgentAction): Promise<Observation> {
    switch (action.kind) {
      case "read_file": {
        const content = await commands.fsRead(action.path);
        return { kind: action.kind, ok: true,
          summary: `Đọc ${action.path} (${content.length} ký tự)`, payload: content };
      }
      case "write_file": {
        await commands.fsWrite(action.path, action.content);
        return { kind: action.kind, ok: true, summary: `Ghi ${action.path}` };
      }
      case "list_dir": {
        const entries = await commands.fsList(action.path);
        return { kind: action.kind, ok: true,
          summary: `Liệt kê ${action.path} (${entries.length} mục)`, payload: entries };
      }
      case "run_shell": {
        const res = await commands.shellExec(action.cmd, action.cwd, action.timeoutMs);
        return {
          kind: action.kind,
          ok: res.exitCode === 0 && !res.timedOut,
          summary: `shell "${action.cmd}" → exit=${res.exitCode}`,
          payload: { stdout: res.stdout, stderr: res.stderr }, raw: res,
        };
      }
      case "apply_edit_blocks": {
        const dry = await commands.applyEdits(action.blocks, true);
        const failed = dry.filter((r) => !r.applied);
        if (failed.length) {
          return { kind: action.kind, ok: false,
            summary: `${failed.length}/${action.blocks.length} block không apply được.`,
            payload: dry.map((r: ApplyResult) => ({ path: r.path, error: r.error })) };
        }
        const real = await commands.applyEdits(action.blocks, false);
        return { kind: action.kind, ok: true,
          summary: `Áp dụng ${real.length} block`, payload: real };
      }
      case "done": return { kind: action.kind, ok: true, summary: action.message };
    }
  }

  async run(userPrompt: string): Promise<AgentEvent[]> {
    const { root, provider, model, maxIterations = 12, signal } = this.opts;

    this.emit({ phase: "planning", note: `Load repo-map @ ${root}` });
    let repoMapText = "";
    try {
      const entries = await loadRepoMap(root, { tokenBudget: 3000 });
      repoMapText = renderRepoMap(entries);
    } catch (e) {
      this.emit({ phase: "error", note: `repo-map lỗi: ${String(e)}` });
    }

    this.history.push({ role: "system", content: SYSTEM_PROMPT });
    this.history.push({
      role: "user",
      content:
        `Working directory: ${root}\n\n` +
        `Repo map:\n${repoMapText || "(rỗng)"}\n\n` +
        `Task: ${userPrompt}`,
    });

    for (let i = 0; i < maxIterations; i++) {
      if (signal?.aborted) { this.emit({ phase: "error", note: "Bị huỷ." }); break; }
      this.emit({ phase: "awaiting_llm", note: `iteration ${i + 1}/${maxIterations}` });

      let llmText: string;
      try {
        llmText = await provider.chat(this.history, { model, signal });
      } catch (e) {
        this.emit({ phase: "error", note: `LLM lỗi: ${String(e)}` }); break;
      }

      this.emit({ phase: "parsing", note: "Parse action…" });
      let action: AgentAction;
      try {
        action = parseAction(extractJson(llmText));
      } catch (e) {
        this.history.push({ role: "assistant", content: llmText });
        this.history.push({ role: "user",
          content: `Lỗi parse: ${String(e)}. Trả lại DUY NHẤT JSON.` });
        this.emit({ phase: "error", note: `Parse lỗi: ${String(e)}` });
        continue;
      }

      this.emit({ phase: "applying", action });
      if (action.kind === "done") {
        this.emit({ phase: "done", action, note: action.message }); break;
      }

      let observation: Observation;
      try { observation = await this.execute(action); }
      catch (e) { observation = { kind: action.kind, ok: false, summary: `Exec lỗi: ${String(e)}` }; }
      this.emit({ phase: "observing", action, observation });

      this.history.push({ role: "assistant", content: llmText });
      this.history.push({
        role: "user",
        content:
          `Observation (${observation.kind}, ok=${observation.ok}): ` +
          `${observation.summary}\n` +
          (observation.payload !== undefined
            ? `Payload: ${JSON.stringify(observation.payload).slice(0, 4000)}` : ""),
      });
    }
    return this.events;
  }

  getEvents(): AgentEvent[] { return this.events; }
}
