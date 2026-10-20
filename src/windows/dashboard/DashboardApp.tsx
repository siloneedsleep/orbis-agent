import React, { useEffect, useState, useRef } from "react";
import { 
  Bot, 
  Terminal, 
  MousePointer, 
  ShieldAlert, 
  Play, 
  Square, 
  Camera, 
  Settings as SettingsIcon, 
  AlertOctagon, 
  PanelRightClose, 
  PanelRightOpen, 
  Cpu, 
  Key, 
  Layers, 
  Monitor, 
  Check, 
  HelpCircle,
  Plus
} from "lucide-react";
import { commands, OverlayLayout, SystemInfo } from "@/ipc/commands";
import { 
  UserProfile, 
  LLMConfig, 
  WorkstreamItem, 
  getStoredProfile, 
  getStoredLLMConfig 
} from "@/state/agentStore";
import { OnboardingModal } from "@/components/OnboardingModal";
import { SettingsModal } from "@/components/SettingsModal";
import { WorkstreamCard } from "@/components/WorkstreamCard";
import { AgentBrain, AgentAction } from "@/services/agentLoop";

export function DashboardApp() {
  // Profiles & Settings
  const [profile, setProfile] = useState<UserProfile | null>(getStoredProfile());
  const [config, setConfig] = useState<LLMConfig | null>(getStoredLLMConfig());
  const [showOnboarding, setShowOnboarding] = useState<boolean>(!getStoredProfile() || !getStoredLLMConfig());
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Inspector Panel State
  const [showInspector, setShowInspector] = useState<boolean>(true);
  const [inspectorTab, setInspectorTab] = useState<'screen' | 'logs' | 'system'>('screen');

  // Execution Mode: 'computer_use' (OS control) | 'sandbox' (VM detonation) | 'chat'
  const [mode, setMode] = useState<'computer_use' | 'sandbox' | 'chat'>('computer_use');

  // System status
  const [sys, setSys] = useState<SystemInfo | null>(null);
  const [layout, setLayout] = useState<OverlayLayout | null>(null);

  // Workstream and Agent Loop
  const [workstream, setWorkstream] = useState<WorkstreamItem[]>([]);
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentStage, setCurrentStage] = useState<'analyzing' | 'planning' | 'executing' | 'verifying' | null>(null);
  const [lastScreenshot, setLastScreenshot] = useState<string | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);

  const workstreamEndRef = useRef<HTMLDivElement>(null);
  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;

  // Poll system status & layout
  useEffect(() => {
    let cancelled = false;

    commands.getOverlayLayout()
      .then((l) => !cancelled && setLayout(l))
      .catch((e) => console.error("Error loading layout:", e));

    const pollSys = async () => {
      try {
        const s = await commands.getSystemInfo();
        if (!cancelled) setSys(s);
      } catch (err) {
        console.error("Error getting system info:", err);
      }
    };

    pollSys();
    const timer = setInterval(pollSys, 1500);

    // Kích hoạt Panic Hook khẩn cấp
    commands.setupPanicHook().catch(() => {});

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // Auto scroll workstream
  useEffect(() => {
    workstreamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [workstream, currentStage]);

  // Log append helper
  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setConsoleLogs(prev => [`[${time}] ${msg}`, ...prev.slice(0, 100)]);
  };

  // Add workstream item helper
  const addItem = (item: Omit<WorkstreamItem, 'id' | 'timestamp'>) => {
    const newItem: WorkstreamItem = {
      ...item,
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setWorkstream(prev => [...prev, newItem]);
    return newItem.id;
  };

  // Emergency Kill Switch
  const handleEmergencyStop = () => {
    setIsRunning(false);
    setCurrentStage(null);
    addLog("EMERGENCY KILL SWITCH ACTIVATED: Đã dừng toàn bộ vòng lặp Agent!");
    addItem({
      type: 'assistant',
      content: '⚠️ Đã kích hoạt Dừng khẩn cấp! Toàn bộ thao tác chuột, phím và lập lịch đã được ngắt an toàn.',
    });
  };

  // Run Agent Task Loop
  const handleStartTask = async () => {
    const text = inputPrompt.trim();
    if (!text || isRunning) return;

    setInputPrompt('');
    setIsRunning(true);
    addLog(`Bắt đầu tác vụ: "${text}"`);

    // Add user message to stream
    addItem({
      type: 'user',
      content: text,
    });

    const brain = new AgentBrain();
    let loopCount = 0;
    const maxLoops = 5;

    try {
      while (isRunningRef.current && loopCount < maxLoops) {
        loopCount++;

        // Phase 1: Analyzing Screen
        setCurrentStage('analyzing');
        addLog(`[Vòng ${loopCount}] Giai đoạn 1: Phân tích màn hình...`);
        
        let screenData: string | undefined = undefined;
        try {
          if (layout && layout.monitors.length > 0) {
            const p = layout.monitors.find(m => m.primary) || layout.monitors[0];
            screenData = await commands.captureScreenRegion(p.x, p.y, p.width, p.height);
            setLastScreenshot(screenData);
          }
        } catch (captureErr) {
          addLog(`Không chụp được màn hình: ${captureErr}`);
        }

        // Phase 2: Planning Move (Reasoning)
        setCurrentStage('planning');
        addLog(`[Vòng ${loopCount}] Giai đoạn 2: Lập kế hoạch suy luận (LLM)...`);
        
        const plan = await brain.planNextMove(text, screenData);

        // Hiển thị Chain of Thought
        if (plan.thought) {
          addItem({
            type: 'thinking',
            content: plan.thought,
          });
        }

        // Phase 3: Executing Action
        setCurrentStage('executing');
        addLog(`[Vòng ${loopCount}] Giai đoạn 3: Thực thi hành động [${plan.action.type}]`);

        if (plan.action.type === 'done') {
          addItem({
            type: 'assistant',
            content: plan.message || 'Tác vụ đã hoàn thành.',
          });
          break;
        }

        // Tạo action card
        let toolName: any = 'ClickButton';
        if (plan.action.type === 'mouse_move') toolName = 'MoveMouse';
        if (plan.action.type === 'mouse_click') toolName = 'ClickButton';
        if (plan.action.type === 'keyboard_type') toolName = 'SendKeystroke';
        if (plan.action.type === 'sandbox_exec') toolName = 'SandboxExec';

        const actionCardId = addItem({
          type: 'action',
          actionData: {
            tool: toolName,
            params: plan.action,
            status: 'running',
          }
        });

        const startT = Date.now();
        const execResult = await brain.executeAction(plan.action);
        const duration = Date.now() - startT;

        // Cập nhật card thành công
        setWorkstream(prev => prev.map(it => {
          if (it.id === actionCardId && it.actionData) {
            return {
              ...it,
              actionData: {
                ...it.actionData,
                status: 'success',
                result: execResult,
                durationMs: duration
              }
            };
          }
          return it;
        }));

        // Phase 4: Verifying
        setCurrentStage('verifying');
        addLog(`[Vòng ${loopCount}] Giai đoạn 4: Kiểm tra kết quả`);
        await new Promise(r => setTimeout(r, 600));
      }
    } catch (err: any) {
      addLog(`Lỗi thực thi vòng lặp: ${err.message}`);
      addItem({
        type: 'assistant',
        content: `❌ Gặp lỗi trong quá trình xử lý: ${err.message}`,
      });
    } finally {
      setIsRunning(false);
      setCurrentStage(null);
      addLog("Kết thúc tác vụ.");
    }
  };

  // Chụp ảnh thủ công
  const handleManualCapture = async () => {
    try {
      if (layout && layout.monitors.length > 0) {
        const p = layout.monitors.find(m => m.primary) || layout.monitors[0];
        const screen = await commands.captureScreenRegion(p.x, p.y, p.width, p.height);
        setLastScreenshot(screen);
        addLog("Đã chụp màn hình thủ công.");
        setInspectorTab('screen');
      }
    } catch (err) {
      addLog(`Lỗi chụp màn hình: ${err}`);
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-950 font-sans text-zinc-100 antialiased overflow-hidden select-none">
      {/* Onboarding Modal */}
      {showOnboarding && (
        <OnboardingModal
          onComplete={(newProf, newCfg) => {
            setProfile(newProf);
            setConfig(newCfg);
            setShowOnboarding(false);
            addLog(`Hồ sơ người dùng: ${newProf.name} (${newProf.pronoun}) | LLM: ${newCfg.provider} - ${newCfg.model}`);
          }}
        />
      )}

      {/* Settings Modal */}
      {profile && config && (
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          profile={profile}
          config={config}
          onUpdate={(p, c) => {
            setProfile(p);
            setConfig(c);
            addLog(`Cập nhật cấu hình: ${c.provider} (${c.model})`);
          }}
        />
      )}

      {/* 1. TOP HEADER BAR */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-4 backdrop-blur-md">
        {/* Brand & Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Bot className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-tight text-white text-sm">ORBIS AGENT</span>
            <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700/60">
              v0.2.0
            </span>
          </div>

          <div className="h-4 w-px bg-zinc-800" />

          {/* Active LLM Pill */}
          {config && (
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1.5 rounded-full bg-zinc-800/80 px-2.5 py-1 text-xs border border-zinc-700 hover:border-zinc-500 transition"
              title="Bấm để đổi cấu hình LLM"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-zinc-300 font-medium capitalize">{config.provider}:</span>
              <span className="text-zinc-400 font-mono text-[11px] truncate max-w-[120px]">{config.model}</span>
            </button>
          )}

          {/* Admin Privilege Badge */}
          {sys && (
            <span
              className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
                sys.isAdmin
                  ? "border-amber-400/30 bg-amber-400/10 text-amber-300 shadow-[0_0_10px_rgba(250,204,21,0.15)]"
                  : "border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
              }`}
            >
              {sys.isAdmin ? "👑 Administrator" : "👤 Standard User"}
            </span>
          )}
        </div>

        {/* Action Controls & Emergency Stop */}
        <div className="flex items-center gap-2">
          {/* Emergency Kill Switch */}
          <button
            type="button"
            onClick={handleEmergencyStop}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/25 active:scale-95 transition"
            title="Dừng khẩn cấp toàn bộ tác vụ (Hoặc nhấn ESC 3 lần)"
          >
            <AlertOctagon className="h-3.5 w-3.5 text-red-400 animate-pulse" />
            <span>DỪNG KHẨN CẤP</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
            title="Cài đặt hệ thống"
          >
            <SettingsIcon className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowInspector(!showInspector)}
            className={`rounded-lg p-1.5 transition ${
              showInspector ? "bg-zinc-800 text-cyan-400" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
            }`}
            title="Ẩn/Hiện bảng kiểm soát bên phải"
          >
            {showInspector ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* 2. MAIN 3-COLUMN WORKSPACE */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR */}
        <aside className="w-64 shrink-0 flex flex-col border-r border-zinc-800 bg-zinc-900/40 p-3 space-y-4">
          <button
            type="button"
            onClick={() => {
              setWorkstream([]);
              addLog("Khởi tạo phiên làm việc mới.");
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-800/40 py-2.5 text-xs font-semibold text-zinc-200 hover:border-cyan-500/60 hover:bg-cyan-500/10 hover:text-cyan-300 transition"
          >
            <Plus className="h-4 w-4" />
            Tác vụ mới
          </button>

          {/* Mode Switcher */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 px-1">
              Chế độ điều khiển
            </span>
            <div className="space-y-1">
              {[
                { id: 'computer_use', label: 'Computer-Use (OS)', icon: MousePointer, desc: 'Tự động chuột & bàn phím' },
                { id: 'sandbox', label: 'Detonation Sandbox', icon: ShieldAlert, desc: 'Cách ly trong Hyper-V VM' },
                { id: 'chat', label: 'Chat Assistant', icon: Bot, desc: 'Trò chuyện không can thiệp OS' },
              ].map((m) => {
                const Icon = m.icon;
                const active = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id as any)}
                    className={`flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left transition ${
                      active
                        ? "bg-zinc-800 border border-zinc-700 text-white shadow-sm"
                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${active ? 'text-cyan-400' : 'text-zinc-500'}`} />
                    <div>
                      <div className="text-xs font-medium">{m.label}</div>
                      <div className="text-[10px] text-zinc-500">{m.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* System Telemetry Box */}
          <div className="mt-auto rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-[11px] space-y-2">
            <div className="font-semibold text-zinc-400 text-[10px] uppercase tracking-wider flex items-center justify-between">
              <span>Hệ thống</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </div>

            <div className="flex justify-between text-zinc-400">
              <span>Rảnh tay:</span>
              <span className="font-mono text-zinc-200">
                {sys ? `${Math.floor(sys.idleMs / 1000)}s` : '...'}
              </span>
            </div>

            <div className="flex justify-between text-zinc-400">
              <span>Màn hình:</span>
              <span className="font-mono text-zinc-200">
                {layout ? `${layout.monitors.length} monitor` : '...'}
              </span>
            </div>

            <div className="flex justify-between text-zinc-400">
              <span>Sandbox VM:</span>
              <span className="font-mono text-emerald-400">Sẵn sàng</span>
            </div>
          </div>
        </aside>

        {/* CENTER WORKSTREAM */}
        <main className="flex flex-1 flex-col overflow-hidden bg-zinc-950">
          {/* Multi-stage Progress Indicator */}
          {isRunning && currentStage && (
            <div className="border-b border-zinc-800 bg-zinc-900/60 px-4 py-2 flex items-center justify-center gap-6 text-xs font-mono">
              {[
                { id: 'analyzing', label: '1. Phân tích màn hình' },
                { id: 'planning', label: '2. Lập kế hoạch' },
                { id: 'executing', label: '3. Thực thi chuột/phím' },
                { id: 'verifying', label: '4. Kiểm tra kết quả' },
              ].map((st) => {
                const isActive = currentStage === st.id;
                return (
                  <div
                    key={st.id}
                    className={`flex items-center gap-1.5 transition ${
                      isActive ? 'text-cyan-400 font-bold scale-105' : 'text-zinc-600'
                    }`}
                  >
                    {isActive && <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />}
                    <span>{st.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Workstream Feed */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {workstream.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center p-8 space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-cyan-400 shadow-inner">
                  <Bot className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-white">
                  Xin chào {profile?.pronoun} {profile?.name}!
                </h3>
                <p className="max-w-md text-xs text-zinc-400 leading-relaxed">
                  Orbis Agent đã kết nối với <strong className="text-zinc-200">{config?.provider.toUpperCase()}</strong>. Hãy nhập yêu cầu để Agent tự động hóa công việc trên máy tính của {profile?.pronoun}.
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {[
                    "Chụp màn hình và tóm tắt nội dung",
                    "Mở Notepad và ghi chú lại thông tin",
                    "Kiểm tra các tiến trình đang chiếm RAM trong máy",
                  ].map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setInputPrompt(sug)}
                      className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:border-cyan-500/40 hover:bg-zinc-800/80 transition"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              workstream.map((item) => <WorkstreamCard key={item.id} item={item} />)
            )}
            <div ref={workstreamEndRef} />
          </div>

          {/* Bottom Command Bar (DeepSeek / OperUI style) */}
          <div className="border-t border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-md">
            <div className="mx-auto max-w-4xl space-y-2">
              <div className="relative flex items-center rounded-2xl border border-zinc-700/70 bg-zinc-900 p-2 shadow-2xl focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-400 transition">
                <input
                  type="text"
                  disabled={isRunning}
                  placeholder={`Nhập yêu cầu cho Orbis Agent (${profile?.pronoun || 'bạn'})...`}
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleStartTask()}
                  className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none disabled:opacity-50"
                />

                <div className="flex items-center gap-1.5 pl-2">
                  <button
                    type="button"
                    onClick={handleManualCapture}
                    title="Chụp màn hình nhanh"
                    className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
                  >
                    <Camera className="h-4 w-4" />
                  </button>

                  {isRunning ? (
                    <button
                      type="button"
                      onClick={handleEmergencyStop}
                      className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-red-500 transition"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" />
                      Dừng
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!inputPrompt.trim()}
                      onClick={handleStartTask}
                      className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-cyan-600/20 hover:bg-cyan-500 disabled:opacity-40 transition"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Gửi
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-zinc-500 px-1 font-mono">
                <span>Nhấn Enter để gửi lệnh · Phím tắt dừng khẩn cấp: Esc × 3</span>
                <span>Chế độ: {mode.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </main>

        {/* RIGHT COLLAPSIBLE INSPECTOR */}
        {showInspector && (
          <aside className="w-80 shrink-0 border-l border-zinc-800 bg-zinc-900/60 flex flex-col">
            {/* Inspector Tab Header */}
            <div className="flex border-b border-zinc-800 bg-zinc-900 text-xs">
              <button
                type="button"
                onClick={() => setInspectorTab('screen')}
                className={`flex-1 py-2.5 font-medium border-b-2 transition ${
                  inspectorTab === 'screen'
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-500/5'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Màn hình Live
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('logs')}
                className={`flex-1 py-2.5 font-medium border-b-2 transition ${
                  inspectorTab === 'logs'
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-500/5'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Console Logs
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('system')}
                className={`flex-1 py-2.5 font-medium border-b-2 transition ${
                  inspectorTab === 'system'
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-500/5'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Monitors
              </button>
            </div>

            {/* Inspector Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {inspectorTab === 'screen' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-semibold uppercase tracking-wider text-[10px]">Ảnh chụp ngữ cảnh</span>
                    <button
                      onClick={handleManualCapture}
                      className="text-cyan-400 hover:underline text-[11px]"
                    >
                      Chụp lại
                    </button>
                  </div>
                  {lastScreenshot ? (
                    <div className="rounded-xl border border-zinc-800 bg-black overflow-hidden shadow-lg">
                      <img
                        src={lastScreenshot}
                        alt="Desktop Capture"
                        className="w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 text-zinc-600 text-xs text-center p-4">
                      <Camera className="h-6 w-6 mb-2 opacity-50" />
                      <span>Chưa có ảnh chụp màn hình nào. Bấm nút Chụp để nạp khung hình.</span>
                    </div>
                  )}
                </div>
              )}

              {inspectorTab === 'logs' && (
                <div className="font-mono text-[11px] space-y-1.5 text-zinc-300">
                  {consoleLogs.length === 0 ? (
                    <span className="text-zinc-600 italic">Chưa có log hệ thống...</span>
                  ) : (
                    consoleLogs.map((lg, i) => (
                      <div key={i} className="rounded bg-black/40 p-1.5 border border-zinc-800/60 leading-tight">
                        {lg}
                      </div>
                    ))
                  )}
                </div>
              )}

              {inspectorTab === 'system' && layout && (
                <div className="space-y-3 text-xs">
                  <span className="font-semibold uppercase tracking-wider text-[10px] text-zinc-400">
                    Danh sách màn hình ({layout.monitors.length})
                  </span>
                  <div className="space-y-2">
                    {layout.monitors.map((m, i) => (
                      <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-800/40 p-3 space-y-1">
                        <div className="flex justify-between font-medium text-white">
                          <span>Màn {i + 1} {m.primary && "(Chính)"}</span>
                          <span className="text-cyan-400 font-mono">Scale {m.scale}x</span>
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono">
                          {m.width} × {m.height} px
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          Toạ độ lệch: X: {m.x}, Y: {m.y}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
