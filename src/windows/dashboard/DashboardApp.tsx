import { useEffect, useState, type ReactNode } from "react";
import { commands, type OverlayLayout, type SystemInfo } from "@/ipc/commands";
import { events, type DemoAction } from "@/ipc/events";

/** Theo spec: user rảnh từ 5s trở lên thì hỏi bằng modal, còn không thì chỉ bắn toast. */
const IDLE_THRESHOLD_MS = 5000;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <h2 className="mb-3 text-sm font-medium text-zinc-400">{title}</h2>
      {children}
    </section>
  );
}

function ActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-[#00F0FF]/40 bg-[#00F0FF]/10 px-3.5 py-2 text-sm text-[#7DF7FF] transition hover:bg-[#00F0FF]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00F0FF] active:translate-y-px"
    >
      {children}
    </button>
  );
}

export function DashboardApp() {
  const [sys, setSys] = useState<SystemInfo | null>(null);
  const [layout, setLayout] = useState<OverlayLayout | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    commands
      .getOverlayLayout()
      .then((l) => !cancelled && setLayout(l))
      .catch((e) => !cancelled && setError(String(e)));

    const poll = async () => {
      try {
        const s = await commands.getSystemInfo();
        if (!cancelled) setSys(s);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    };
    void poll();
    const timer = window.setInterval(poll, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const demo = (action: DemoAction) => void events.demo(action);
  const idleSeconds = sys ? Math.floor(sys.idleMs / 1000) : null;
  const promptChannel = sys && sys.idleMs >= IDLE_THRESHOLD_MS ? "modal giữa màn hình chính" : "toast ngầm";

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-4 p-6">
      <header className="mb-2">
        <h1 className="text-xl font-semibold tracking-tight">Orbis Agent</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Bảng thử nghiệm The Core. Hotkey bật/tắt: Ctrl+Alt+Space.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          Không gọi được backend Tauri: {error}. Chạy bằng <code>npm run tauri dev</code>, không mở trực
          tiếp trên trình duyệt.
        </p>
      )}

      <Section title="Điều khiển overlay">
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={() => void events.wake()}>Bật / tắt The Core</ActionButton>
          <ActionButton onClick={() => demo("think")}>Thinking</ActionButton>
          <ActionButton onClick={() => demo("idle")}>Idle</ActionButton>
          <ActionButton onClick={() => demo("fly")}>Bay sang màn kế tiếp</ActionButton>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Thinking và Bay chỉ có tác dụng khi The Core đang hiện và không đang bay.
        </p>
      </Section>

      <Section title="Hệ thống">
        {sys ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
            <dt className="text-zinc-400">Quyền chạy</dt>
            <dd>{sys.isAdmin ? "Admin (The Core màu vàng)" : "User (The Core màu cyan)"}</dd>
            <dt className="text-zinc-400">Rảnh tay</dt>
            <dd>{idleSeconds} giây</dd>
            <dt className="text-zinc-400">Kênh xin phép</dt>
            <dd>{promptChannel}</dd>
          </dl>
        ) : (
          <p className="text-sm text-zinc-500">Đang đọc…</p>
        )}
      </Section>

      <Section title="Màn hình">
        {layout ? (
          <ul className="flex flex-col gap-1.5 text-sm">
            {layout.monitors.map((m, i) => (
              <li key={`${m.x}:${m.y}`} className="flex justify-between gap-4">
                <span>
                  Màn {i + 1}
                  {m.primary ? " (chính)" : ""}
                </span>
                <span className="text-zinc-400">
                  {m.width}×{m.height} · scale {m.scale} · lệch ({m.x}, {m.y})
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">Đang đọc…</p>
        )}
      </Section>
    </main>
  );
}
