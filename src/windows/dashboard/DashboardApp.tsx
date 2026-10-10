import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { commands, type OverlayLayout, type SystemInfo } from "@/ipc/commands";
import { events, type DemoAction } from "@/ipc/events";
import { AgentLoop, OllamaProvider, type AgentEvent } from "@/core/agent";

const IDLE_THRESHOLD_MS = 5000;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <motion.button type="button" onClick={onClick}
      whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
      className="rounded-lg border border-[#00F0FF]/40 bg-[#00F0FF]/10 px-3.5 py-2 text-sm text-[#7DF7FF] transition hover:bg-[#00F0FF]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00F0FF]"
    >
      {children}
    </motion.button>
  );
}

export function DashboardApp() {
  const [sys, setSys] = useState<SystemInfo | null>(null);
  const [layout, setLayout] = useState<OverlayLayout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    commands.getOverlayLayout()
      .then((l) => !cancelled && setLayout(l))
      .catch((e) => !cancelled && setError(String(e)));
    const poll = async () => {
      try {
        const s = await commands.getSystemInfo();
        if (!cancelled) setSys(s);
      } catch (e) { if (!cancelled) setError(String(e)); }
    };
    void poll();
    const timer = window.setInterval(poll, 1500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const demo = (action: DemoAction) => void events.demo(action);
  const idleSeconds = sys ? Math.floor(sys.idleMs / 1000) : null;
  const promptChannel = sys && sys.idleMs >= IDLE_THRESHOLD_MS
    ? "modal giữa màn hình chính" : "toast ngầm";

  const runAgent = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true); setLog([]);
    const loop = new AgentLoop({
      root: ".", provider: new OllamaProvider(undefined, true), maxIterations: 12,
      onEvent: (e: AgentEvent) => {
        const line =
          `[${e.phase}] ` +
          (e.action ? `${e.action.kind} ` : "") +
          (e.observation
            ? `${e.observation.ok ? "✓" : "✗"} ${e.observation.summary}` : "") +
          (e.note ? e.note : "");
        setLog((prev) => [...prev, line.trim()]);
      },
    });
    try { await loop.run(prompt); }
    catch (e) { setLog((prev) => [...prev, `[error] ${String(e)}`]); }
    finally { setBusy(false); }
  };

  return (
    <main className="mica min-h-full p-6 text-zinc-100">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <header className="mb-2">
          <h1 className="text-2xl font-semibold tracking-tight">Orbis Agent</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Hotkey: <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-xs">Ctrl+Alt+Space</kbd>
          </p>
        </header>

        {error && (
          <p role="alert"
            className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            Không gọi được backend: {error}. Chạy <code>npm run tauri dev</code>.
          </p>
        )}

        <Section title="Điều khiển Overlay">
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={() => void events.wake()}>Bật / tắt The Core</ActionButton>
            <ActionButton onClick={() => demo("think")}>Thinking</ActionButton>
            <ActionButton onClick={() => demo("idle")}>Idle</ActionButton>
            <ActionButton onClick={() => demo("fly")}>Bay sang màn kế</ActionButton>
          </div>
        </Section>

        <Section title="Agent — Aider + OpenHands Core">
          <div className="flex flex-col gap-3">
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ví dụ: Liệt kê file trong src/core/agent và giải thích AgentLoop."
              className="min-h-[84px] w-full resize-y rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-zinc-100 outline-none focus:border-[#00F0FF]/60"
            />
            <div className="flex items-center gap-3">
              <ActionButton onClick={() => void runAgent()}>
                {busy ? "Đang chạy…" : "Chạy Agent"}
              </ActionButton>
              <span className="text-xs text-zinc-500">Provider: Ollama · Max-power ON</span>
            </div>
            <div className="max-h-64 overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-xs leading-relaxed text-zinc-300">
              {log.length === 0
                ? <span className="text-zinc-500">Chưa có event.</span>
                : log.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          </div>
        </Section>

        <Section title="Hệ thống">
          {sys ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
              <dt className="text-zinc-400">Windows build</dt>
              <dd>{sys.windowsBuild} {sys.windowsBuild >= 22000 ? "(Win 11 ✓)" : "(không hỗ trợ)"}</dd>
              <dt className="text-zinc-400">Quyền</dt>
              <dd>{sys.isAdmin ? "Admin (Core vàng)" : "User (Core cyan)"}</dd>
              <dt className="text-zinc-400">Rảnh tay</dt>
              <dd>{idleSeconds} giây</dd>
              <dt className="text-zinc-400">Kênh xin phép</dt>
              <dd>{promptChannel}</dd>
            </dl>
          ) : <p className="text-sm text-zinc-500">Đang đọc…</p>}
        </Section>

        <Section title="Màn hình">
          {layout ? (
            <ul className="flex flex-col gap-1.5 text-sm">
              {layout.monitors.map((m, i) => (
                <li key={`${m.x}:${m.y}`} className="flex justify-between gap-4">
                  <span>Màn {i + 1}{m.primary ? " (chính)" : ""}</span>
                  <span className="text-zinc-400">
                    {m.width}×{m.height} · scale {m.scale} · lệch ({m.x}, {m.y})
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-zinc-500">Đang đọc…</p>}
        </Section>
      </div>
    </main>
  );
}
