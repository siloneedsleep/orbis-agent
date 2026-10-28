import React, { useState, useEffect } from 'react';
import { 
  Plug, 
  Cpu, 
  Shield, 
  User, 
  Bot, 
  Workflow, 
  Plus, 
  Trash2, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  Search, 
  ChevronRight, 
  ChevronDown, 
  CheckCircle2, 
  X, 
  Key, 
  Sparkles, 
  Terminal,
  ExternalLink,
  ShieldAlert,
  GraduationCap
} from 'lucide-react';
import { 
  UserProfile, 
  LLMConfig, 
  getStoredProfile, 
  saveStoredProfile, 
  getStoredLLMConfig, 
  saveStoredLLMConfig,
  N8nConfig,
  getStoredN8nConfig,
  saveStoredN8nConfig,
  McpServerConfig,
  getStoredMcpServers,
  saveStoredMcpServers,
  SandboxExecutionPolicy,
  getStoredSandboxPolicy,
  saveStoredSandboxPolicy,
  CatSettings,
  getStoredCatSettings,
  saveStoredCatSettings
} from '@/state/agentStore';
import { commands, OllamaStatus, McpToolItem } from '@/ipc/commands';
import { validateApiKey } from '@/services/apiValidator';

export type SettingsTab = 'mcp' | 'llm' | 'sandbox' | 'profile' | 'cat' | 'n8n';

interface UnifiedSettingsViewProps {
  initialTab?: SettingsTab;
  onClose?: () => void;
  isAdmin?: boolean;
}

const DEFAULT_CLOUD_MODELS: Record<'deepseek' | 'gemini' | 'openai' | 'claude', string> = {
  deepseek: 'deepseek-chat',
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o-mini',
  claude: 'claude-3-5-sonnet-20241022',
};

export const UnifiedSettingsView: React.FC<UnifiedSettingsViewProps> = ({
  initialTab = 'mcp',
  onClose,
  isAdmin = false,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  // 1. MCP State
  const [mcpServers, setMcpServers] = useState<McpServerConfig[]>(getStoredMcpServers());
  const [selectedMcpServer, setSelectedMcpServer] = useState<McpServerConfig | null>(null);
  const [showAddMcpModal, setShowAddMcpModal] = useState(false);
  const [editingMcpServer, setEditingMcpServer] = useState<McpServerConfig | null>(null);
  const [mcpSearchTerm, setMcpSearchTerm] = useState('');
  const [syncingMcp, setSyncingMcp] = useState(false);
  const [testingServerId, setTestingServerId] = useState<string | null>(null);
  const [mcpNotification, setMcpNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal thêm/sửa MCP
  const [formMcpName, setFormMcpName] = useState('');
  const [formMcpUrl, setFormMcpUrl] = useState('');
  const [formMcpToken, setFormMcpToken] = useState('');
  const [formMcpType, setFormMcpType] = useState<'http' | 'sse' | 'stdio'>('http');

  // Interactive Tool Runner Modal
  const [activeToolToRun, setActiveToolToRun] = useState<McpToolItem | null>(null);
  const [toolArgsJson, setToolArgsJson] = useState('{}');
  const [toolRunning, setToolRunning] = useState(false);
  const [toolRunResult, setToolRunResult] = useState<any>(null);

  // 2. Profile State
  const [profile, setProfile] = useState<UserProfile>(getStoredProfile() || { name: 'Người dùng', gender: 'male', pronoun: 'anh' });
  const [profileSaved, setProfileSaved] = useState(false);

  // 3. LLM State
  const currentLlm = getStoredLLMConfig() || {
    type: 'api',
    mode: 'cloud',
    provider: 'deepseek',
    model: 'deepseek-chat',
    cloudProvider: 'deepseek',
    apiKey: '',
    maxPower: true,
  };
  const [llmType, setLlmType] = useState<'local' | 'api'>(currentLlm.type);
  const [llmProvider, setLlmProvider] = useState<'deepseek' | 'gemini' | 'openai' | 'claude'>(
    currentLlm.provider === 'ollama' ? (currentLlm.cloudProvider || 'deepseek') : (currentLlm.provider as any)
  );
  const [llmApiKey, setLlmApiKey] = useState(currentLlm.apiKey || '');
  const [llmModel, setLlmModel] = useState(currentLlm.model || 'deepseek-chat');
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [validatingLlmKey, setValidatingLlmKey] = useState(false);
  const [llmKeyResult, setLlmKeyResult] = useState<{ valid: boolean; error?: string } | null>(null);
  const [llmSaved, setLlmSaved] = useState(false);

  // 4. Sandbox State
  const [sandboxPolicy, setSandboxPolicy] = useState<SandboxExecutionPolicy>(getStoredSandboxPolicy());
  const [sandboxBusy, setSandboxBusy] = useState(false);
  const [sandboxMsg, setSandboxMsg] = useState<string | null>(null);

  // 5. Cat State
  const [catSettings, setCatSettings] = useState<CatSettings>(getStoredCatSettings());
  const [catSaved, setCatSaved] = useState(false);

  // 6. n8n State
  const [n8nConfig, setN8nConfig] = useState<N8nConfig>(getStoredN8nConfig());
  const [n8nTesting, setN8nTesting] = useState(false);
  const [n8nTestResult, setN8nTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Scan Ollama on switch
  const scanOllama = async () => {
    setOllamaLoading(true);
    try {
      await commands.startOllamaServer().catch(() => {});
      const res = await commands.ollamaStatus();
      setOllamaStatus(res);
      if (res.models.length > 0 && (!llmModel || /^(deepseek|gemini|gpt-|claude)/i.test(llmModel))) {
        setLlmModel(res.largest || res.models[0].name);
      }
    } catch {
      setOllamaStatus(null);
    } finally {
      setOllamaLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'llm' && llmType === 'local') {
      scanOllama();
    }
  }, [activeTab, llmType]);

  // Đồng bộ MCP từ ~/.gemini/config/mcp_config.json
  const handleSyncFromSystemMcp = async () => {
    setSyncingMcp(true);
    setMcpNotification(null);
    try {
      const res = await commands.readSystemMcpConfig();
      if (!res.exists || res.servers.length === 0) {
        setMcpNotification({
          type: 'error',
          message: `Không tìm thấy cấu hình mcpServers trong ${res.path}`,
        });
        return;
      }

      const current = getStoredMcpServers();
      const updatedList = [...current];

      for (const sysSrv of res.servers) {
        const existingIdx = updatedList.findIndex(
          (s) => s.name.toLowerCase() === sysSrv.name.toLowerCase() || (s.serverUrl && s.serverUrl === sysSrv.serverUrl)
        );
        if (existingIdx >= 0) {
          updatedList[existingIdx] = {
            ...updatedList[existingIdx],
            serverUrl: sysSrv.serverUrl || updatedList[existingIdx].serverUrl,
            authToken: sysSrv.authToken || updatedList[existingIdx].authToken,
            command: sysSrv.command || updatedList[existingIdx].command,
          };
        } else {
          updatedList.push({
            id: sysSrv.id || `mcp-${Date.now()}`,
            name: `${sysSrv.name} (Antigravity)`,
            type: sysSrv.type as any,
            serverUrl: sysSrv.serverUrl,
            authToken: sysSrv.authToken,
            command: sysSrv.command,
            enabled: true,
          });
        }
      }

      setMcpServers(updatedList);
      saveStoredMcpServers(updatedList);
      setMcpNotification({
        type: 'success',
        message: `Đã đồng bộ thành công ${res.servers.length} máy chủ MCP từ Antigravity (${res.path})!`,
      });
    } catch (err: any) {
      setMcpNotification({
        type: 'error',
        message: `Lỗi đồng bộ MCP: ${err?.message || err}`,
      });
    } finally {
      setSyncingMcp(false);
    }
  };

  // Test 1 MCP Server
  const handleTestMcpServer = async (server: McpServerConfig) => {
    if (!server.serverUrl?.trim()) return;
    setTestingServerId(server.id);
    setMcpNotification(null);
    try {
      const res = await commands.testMcpConnection({
        serverUrl: server.serverUrl,
        authToken: server.authToken,
      });

      const updated = mcpServers.map((s) => {
        if (s.id === server.id) {
          return {
            ...s,
            status: 'connected' as const,
            latencyMs: res.latencyMs,
            tools: res.tools,
            lastChecked: new Date().toLocaleTimeString(),
            errorMessage: undefined,
          };
        }
        return s;
      });

      setMcpServers(updated);
      saveStoredMcpServers(updated);
      if (selectedMcpServer?.id === server.id) {
        setSelectedMcpServer(updated.find((s) => s.id === server.id) || null);
      }

      setMcpNotification({
        type: 'success',
        message: `Kết nối thành công tới ${server.name}! Tìm thấy ${res.count} công cụ khả dụng (${res.latencyMs}ms).`,
      });
    } catch (err: any) {
      const errStr = String(err?.message || err);
      const updated = mcpServers.map((s) => {
        if (s.id === server.id) {
          return {
            ...s,
            status: 'error' as const,
            errorMessage: errStr,
            lastChecked: new Date().toLocaleTimeString(),
          };
        }
        return s;
      });
      setMcpServers(updated);
      saveStoredMcpServers(updated);
      setMcpNotification({
        type: 'error',
        message: `Lỗi kết nối tới ${server.name}: ${errStr}`,
      });
    } finally {
      setTestingServerId(null);
    }
  };

  // Toggle MCP Server Enable/Disable
  const handleToggleMcpServer = (id: string) => {
    const updated = mcpServers.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
    setMcpServers(updated);
    saveStoredMcpServers(updated);
  };

  // Xóa MCP Server
  const handleDeleteMcpServer = (id: string) => {
    const updated = mcpServers.filter((s) => s.id !== id);
    setMcpServers(updated);
    saveStoredMcpServers(updated);
    if (selectedMcpServer?.id === id) {
      setSelectedMcpServer(null);
    }
  };

  // Lưu MCP Server mới hoặc đã sửa
  const handleSaveMcpModal = async () => {
    if (!formMcpName.trim() || !formMcpUrl.trim()) return;

    let updated: McpServerConfig[];
    if (editingMcpServer) {
      updated = mcpServers.map((s) =>
        s.id === editingMcpServer.id
          ? {
              ...s,
              name: formMcpName.trim(),
              serverUrl: formMcpUrl.trim(),
              authToken: formMcpToken.trim() || undefined,
              type: formMcpType,
            }
          : s
      );
    } else {
      const newServer: McpServerConfig = {
        id: `mcp-${Date.now()}`,
        name: formMcpName.trim(),
        serverUrl: formMcpUrl.trim(),
        authToken: formMcpToken.trim() || undefined,
        type: formMcpType,
        enabled: true,
      };
      updated = [...mcpServers, newServer];
    }

    setMcpServers(updated);
    saveStoredMcpServers(updated);
    setShowAddMcpModal(false);
    setEditingMcpServer(null);

    // Tự động kiểm tra server vừa lưu
    const target = updated.find((s) => s.name === formMcpName.trim());
    if (target) {
      handleTestMcpServer(target);
    }
  };

  // Chạy thử 1 MCP Tool trực tiếp
  const handleExecuteToolTest = async () => {
    if (!activeToolToRun || !selectedMcpServer?.serverUrl) return;
    setToolRunning(true);
    setToolRunResult(null);
    try {
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(toolArgsJson);
      } catch {
        throw new Error('Tham số JSON không hợp lệ!');
      }

      const res = await commands.callMcpTool({
        serverUrl: selectedMcpServer.serverUrl,
        toolName: activeToolToRun.name,
        arguments: parsedArgs,
        authToken: selectedMcpServer.authToken,
      });

      setToolRunResult({ success: true, data: res });
    } catch (err: any) {
      setToolRunResult({ success: false, error: String(err?.message || err) });
    } finally {
      setToolRunning(false);
    }
  };

  // Lưu Profile
  const handleSaveProfile = () => {
    saveStoredProfile(profile);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  // Lưu LLM
  const handleSaveLlm = () => {
    const isLocal = llmType === 'local';
    const cleanModel = llmModel.trim();
    const resolvedLocalModel = isLocal
      ? cleanModel && !/^(deepseek|gemini|gpt-|claude)/i.test(cleanModel)
        ? cleanModel
        : ollamaStatus?.largest || 'auto'
      : currentLlm.localModel || 'auto';
    const resolvedCloudModel = !isLocal
      ? cleanModel && cleanModel !== 'auto'
        ? cleanModel
        : DEFAULT_CLOUD_MODELS[llmProvider]
      : currentLlm.cloudModel || DEFAULT_CLOUD_MODELS[llmProvider];

    const newConfig: LLMConfig = {
      type: llmType,
      mode: isLocal ? 'local' : 'cloud',
      provider: isLocal ? 'ollama' : llmProvider,
      model: isLocal ? resolvedLocalModel : resolvedCloudModel,
      localModel: resolvedLocalModel,
      cloudModel: resolvedCloudModel,
      cloudProvider: llmProvider,
      apiKey: !isLocal ? llmApiKey.trim() : currentLlm.apiKey,
      maxPower: currentLlm.maxPower ?? true,
    };

    saveStoredLLMConfig(newConfig);
    setLlmSaved(true);
    setTimeout(() => setLlmSaved(false), 2000);
  };

  // Test LLM API Key
  const handleTestLlmKey = async () => {
    if (!llmApiKey.trim()) return;
    setValidatingLlmKey(true);
    setLlmKeyResult(null);
    const res = await validateApiKey(llmProvider, llmApiKey);
    setLlmKeyResult(res);
    setValidatingLlmKey(false);
  };

  // Lưu Sandbox Policy
  const handleSelectPolicy = (p: SandboxExecutionPolicy) => {
    setSandboxPolicy(p);
    saveStoredSandboxPolicy(p);
    setSandboxMsg(`Đã lưu chính sách: ${p}`);
    setTimeout(() => setSandboxMsg(null), 2500);
  };

  // Mở Sandbox
  const handleOpenSandbox = async () => {
    setSandboxBusy(true);
    try {
      await commands.startSandboxVm();
      setSandboxMsg('Đã khởi tạo Sandbox thành công.');
    } catch (e: any) {
      setSandboxMsg(`Lỗi mở Sandbox: ${e?.message || e}`);
    } finally {
      setSandboxBusy(false);
    }
  };

  // Test n8n Webhook
  const handleTestN8n = async () => {
    if (!n8nConfig.webhookUrl?.trim()) return;
    setN8nTesting(true);
    setN8nTestResult(null);
    try {
      const res = await commands.triggerN8nWebhook({
        webhookUrl: n8nConfig.webhookUrl,
        action: 'ping_test',
        payload: { user: profile.name, test: true },
        authToken: n8nConfig.apiKey || undefined,
      });
      setN8nTestResult({
        success: true,
        message: 'Kết nối n8n thành công! ' + (res?.receivedAction || res?.status || 'OK'),
      });
    } catch (err: any) {
      setN8nTestResult({
        success: false,
        message: String(err?.message || err || 'Lỗi kết nối tới n8n webhook'),
      });
    } finally {
      setN8nTesting(false);
    }
  };

  // Lưu n8n Config
  const handleSaveN8n = () => {
    saveStoredN8nConfig(n8nConfig);
    setN8nTestResult({ success: true, message: 'Đã lưu cấu hình n8n!' });
    setTimeout(() => setN8nTestResult(null), 2000);
  };

  // Lọc danh sách tools của server đang xem
  const activeTools = (selectedMcpServer?.tools || []).filter(
    (t) =>
      t.name.toLowerCase().includes(mcpSearchTerm.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(mcpSearchTerm.toLowerCase()))
  );

  return (
    <div className="flex h-full w-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* 1. LEFT SETTINGS NAVIGATION */}
      <aside className="w-64 shrink-0 border-r border-zinc-800 bg-zinc-900/40 p-4 flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Plug className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wide">Cài đặt hệ thống</h2>
                <p className="text-[10px] text-zinc-500">Orbis & Connect MCP</p>
              </div>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                title="Đóng cài đặt"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <nav className="space-y-1">
            {[
              { id: 'mcp', label: 'Kết nối MCP', icon: Plug, badge: `${mcpServers.filter(s => s.enabled).length} Active`, color: 'text-emerald-400' },
              { id: 'llm', label: 'Bộ não AI & LLM', icon: Cpu, badge: llmType === 'local' ? 'Local' : llmProvider, color: 'text-cyan-400' },
              { id: 'sandbox', label: 'Bảo mật & Sandbox', icon: Shield, badge: sandboxPolicy, color: 'text-amber-400' },
              { id: 'profile', label: 'Hồ sơ & Người dùng', icon: User, color: 'text-indigo-400' },
              { id: 'cat', label: 'Trợ lý Cyber Cat', icon: Bot, badge: `Lv.${catSettings.bondLevel}`, color: 'text-purple-400' },
              { id: 'n8n', label: 'Tự động hóa n8n', icon: Workflow, badge: n8nConfig.enabled ? 'On' : 'Off', color: 'text-rose-400' },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition ${
                    isActive
                      ? 'bg-zinc-800 border border-zinc-700/80 text-white shadow-sm'
                      : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`h-4 w-4 ${isActive ? tab.color : 'text-zinc-500'}`} />
                    <span>{tab.label}</span>
                  </div>
                  {tab.badge && (
                    <span className="rounded-full bg-zinc-800 border border-zinc-700/60 px-2 py-0.5 text-[9px] font-mono text-zinc-400 uppercase">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3 text-[11px] text-zinc-400 space-y-1">
          <div className="font-semibold text-zinc-300">Model Context Protocol</div>
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            Kết nối tiêu chuẩn với các MCP Server đám mây (n8n, GitHub, Webhook) và công cụ nội bộ.
          </p>
        </div>
      </aside>

      {/* 2. RIGHT CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-8 max-w-5xl">
        {/* ================= TAB 1: KẾT NỐI MCP ================= */}
        {activeTab === 'mcp' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-5">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Plug className="h-5 w-5 text-emerald-400" />
                  Quản lý máy chủ MCP (Model Context Protocol)
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Cấu hình các máy chủ MCP để Orbis Agent tự động phát hiện và gọi công cụ (Tools), dữ liệu và tài nguyên.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSyncFromSystemMcp}
                  disabled={syncingMcp}
                  className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 transition disabled:opacity-50"
                  title="Tự động đồng bộ từ file ~/.gemini/config/mcp_config.json của Antigravity"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-cyan-400 ${syncingMcp ? 'animate-spin' : ''}`} />
                  <span>Đồng bộ từ Antigravity</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingMcpServer(null);
                    setFormMcpName('');
                    setFormMcpUrl('');
                    setFormMcpToken('');
                    setFormMcpType('http');
                    setShowAddMcpModal(true);
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white shadow transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Thêm MCP Server</span>
                </button>
              </div>
            </div>

            {/* Notification alert */}
            {mcpNotification && (
              <div
                className={`flex items-center justify-between rounded-xl border p-3 text-xs ${
                  mcpNotification.type === 'success'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-red-500/30 bg-red-500/10 text-red-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {mcpNotification.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                  )}
                  <span>{mcpNotification.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMcpNotification(null)}
                  className="text-zinc-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* List of MCP Servers */}
            <div className="grid grid-cols-1 gap-4">
              {mcpServers.map((server) => {
                const isTesting = testingServerId === server.id;
                const toolCount = server.tools?.length || 0;
                return (
                  <div
                    key={server.id}
                    className={`rounded-2xl border p-5 transition space-y-4 ${
                      server.enabled
                        ? 'border-zinc-800 bg-zinc-900/60 shadow-md'
                        : 'border-zinc-800/40 bg-zinc-900/20 opacity-60'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                            server.status === 'connected'
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                              : server.status === 'error'
                              ? 'border-red-500/40 bg-red-500/10 text-red-400'
                              : 'border-zinc-700 bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          <Plug className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{server.name}</span>
                            <span className="rounded bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 text-[9px] font-mono text-zinc-400 uppercase">
                              {server.type}
                            </span>
                            {server.status === 'connected' && (
                              <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Online {server.latencyMs ? `(${server.latencyMs}ms)` : ''}
                              </span>
                            )}
                            {server.status === 'error' && (
                              <span className="rounded-full bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-[10px] font-mono text-red-400">
                                Lỗi kết nối
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-400 font-mono mt-0.5 max-w-lg truncate">
                            {server.serverUrl || server.command || 'Chưa cấu hình URL'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-zinc-300 mr-2">
                          <input
                            type="checkbox"
                            checked={server.enabled}
                            onChange={() => handleToggleMcpServer(server.id)}
                            className="rounded border-zinc-700 bg-zinc-800 text-emerald-500 focus:ring-0"
                          />
                          <span>Bật</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => handleTestMcpServer(server)}
                          disabled={isTesting || !server.enabled}
                          className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1.5 text-xs text-zinc-200 transition disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3 w-3 text-cyan-400 ${isTesting ? 'animate-spin' : ''}`} />
                          <span>{isTesting ? 'Đang test...' : 'Test & Quét Tools'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMcpServer(server);
                            setMcpSearchTerm('');
                          }}
                          className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1.5 text-xs font-medium text-emerald-300 transition"
                        >
                          <Sparkles className="h-3 w-3 text-emerald-400" />
                          <span>Xem Tools ({toolCount})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingMcpServer(server);
                            setFormMcpName(server.name);
                            setFormMcpUrl(server.serverUrl || '');
                            setFormMcpToken(server.authToken || '');
                            setFormMcpType(server.type);
                            setShowAddMcpModal(true);
                          }}
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
                          title="Chỉnh sửa"
                        >
                          <Key className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteMcpServer(server.id)}
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition"
                          title="Xóa máy chủ này"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {server.errorMessage && (
                      <div className="rounded-xl bg-red-950/20 border border-red-500/20 p-2.5 text-xs text-red-300">
                        {server.errorMessage}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Tool Explorer Drawer / Section */}
            {selectedMcpServer && (
              <div className="rounded-2xl border border-emerald-500/30 bg-zinc-900/80 p-5 space-y-4 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-bold text-white">
                      Danh sách công cụ khả dụng của {selectedMcpServer.name} ({activeTools.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="h-3.5 w-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Tìm công cụ (vd: workflow, email, search)..."
                        value={mcpSearchTerm}
                        onChange={(e) => setMcpSearchTerm(e.target.value)}
                        className="rounded-lg border border-zinc-700 bg-zinc-800 pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 w-64"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedMcpServer(null)}
                      className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {activeTools.length === 0 ? (
                  <div className="text-center py-8 text-xs text-zinc-500">
                    Chưa có công cụ nào hoặc không tìm thấy kết quả phù hợp. Hãy bấm "Test & Quét Tools" để lấy danh sách từ server!
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                    {activeTools.map((t) => (
                      <div
                        key={t.name}
                        className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3.5 space-y-2 hover:border-zinc-700 transition"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-emerald-400">{t.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveToolToRun(t);
                              setToolArgsJson('{}');
                              setToolRunResult(null);
                            }}
                            className="rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-2 py-1 text-[11px] font-medium text-emerald-300 transition"
                          >
                            Chạy thử
                          </button>
                        </div>
                        <p className="text-[11px] text-zinc-400 line-clamp-3 leading-relaxed">
                          {t.description || 'Không có mô tả cho công cụ này.'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: BỘ NÃO AI & LLM ================= */}
        {activeTab === 'llm' && (
          <div className="space-y-6">
            <div className="border-b border-zinc-800 pb-5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Cpu className="h-5 w-5 text-cyan-400" />
                Bộ não AI & Mô hình ngôn ngữ (LLM)
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Lựa chọn mô hình cục bộ qua Ollama hoặc kết nối các API Đám mây (DeepSeek, Gemini, OpenAI, Claude).
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setLlmType('local');
                    setLlmModel(ollamaStatus?.largest || 'auto');
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${
                    llmType === 'local'
                      ? 'border-cyan-400 bg-cyan-400/10 text-white shadow-md'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-bold uppercase tracking-wider">Local Ollama</div>
                  <div className="text-xs text-zinc-400 mt-1">Chạy mô hình AI 100% offline trên GPU máy của bạn.</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLlmType('api');
                    setLlmModel(DEFAULT_CLOUD_MODELS[llmProvider]);
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${
                    llmType === 'api'
                      ? 'border-cyan-400 bg-cyan-400/10 text-white shadow-md'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white'
                  }`}
                >
                  <div className="text-xs font-bold uppercase tracking-wider">Cloud API</div>
                  <div className="text-xs text-zinc-400 mt-1">Mô hình mạnh mẽ nhất: DeepSeek V3/R1, Gemini 2.0 Flash, GPT-4o.</div>
                </button>
              </div>

              {llmType === 'api' ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400">Chọn Nhà cung cấp Cloud</label>
                    <div className="grid grid-cols-4 gap-2">
                      {(['deepseek', 'gemini', 'openai', 'claude'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            setLlmProvider(p);
                            setLlmModel(DEFAULT_CLOUD_MODELS[p]);
                            setLlmKeyResult(null);
                            const stored = typeof window !== 'undefined' ? localStorage.getItem(`orbis_${p}_key`) : null;
                            if (stored) setLlmApiKey(stored);
                          }}
                          className={`rounded-xl border py-2 text-xs font-medium capitalize transition ${
                            llmProvider === p
                              ? 'border-cyan-400 bg-cyan-400/15 text-cyan-300'
                              : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>API Key ({llmProvider.toUpperCase()})</span>
                      <button
                        type="button"
                        onClick={handleTestLlmKey}
                        disabled={validatingLlmKey || !llmApiKey.trim()}
                        className="text-cyan-400 hover:underline disabled:opacity-50"
                      >
                        {validatingLlmKey ? 'Đang kiểm tra...' : 'Kiểm tra API Key'}
                      </button>
                    </div>
                    <input
                      type="password"
                      placeholder={`Nhập ${llmProvider.toUpperCase()} API Key...`}
                      value={llmApiKey}
                      onChange={(e) => {
                        setLlmApiKey(e.target.value);
                        setLlmKeyResult(null);
                      }}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-xs text-white font-mono focus:border-cyan-400 focus:outline-none"
                    />
                    {llmKeyResult && (
                      <div className={`flex items-center gap-1.5 text-xs mt-1.5 ${llmKeyResult.valid ? 'text-emerald-400' : 'text-red-400'}`}>
                        {llmKeyResult.valid ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                        <span>{llmKeyResult.valid ? 'API Key hợp lệ và sẵn sàng hoạt động!' : llmKeyResult.error}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400">Tên Model</label>
                    <input
                      type="text"
                      value={llmModel}
                      onChange={(e) => setLlmModel(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-zinc-400">Model Ollama Cục bộ</label>
                    <button
                      type="button"
                      onClick={scanOllama}
                      disabled={ollamaLoading}
                      className="flex items-center gap-1 text-xs text-cyan-400 hover:underline"
                    >
                      <RefreshCw className={`h-3 w-3 ${ollamaLoading ? 'animate-spin' : ''}`} />
                      Quét lại mô hình
                    </button>
                  </div>
                  {ollamaStatus && ollamaStatus.models.length > 0 ? (
                    <select
                      value={llmModel}
                      onChange={(e) => setLlmModel(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                    >
                      <option value="auto">Tự động ({ollamaStatus.largest || 'Model lớn nhất'})</option>
                      {ollamaStatus.models.map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.name} ({(m.sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="auto hoặc tên model (vd: qwen2.5-coder:14b)"
                      value={llmModel}
                      onChange={(e) => setLlmModel(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-xs font-mono text-white focus:border-cyan-400 focus:outline-none"
                    />
                  )}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveLlm}
                  className="flex items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-5 py-2.5 text-xs font-semibold text-white shadow transition"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{llmSaved ? 'Đã lưu cấu hình LLM!' : 'Lưu cấu hình LLM'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: BẢO MẬT & SANDBOX ================= */}
        {activeTab === 'sandbox' && (
          <div className="space-y-6">
            <div className="border-b border-zinc-800 pb-5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-amber-400" />
                Chính sách Thực thi & Môi trường Sandbox
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Kiểm soát cấp độ cô lập và phê duyệt đối với các lệnh can thiệp hệ điều hành hoặc mã nguồn lạ.
              </p>
            </div>

            {sandboxMsg && (
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-300">
                {sandboxMsg}
              </div>
            )}

            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Chọn Chế độ Phê duyệt Lệnh Sandbox
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  {
                    id: 'request_review',
                    name: 'Request Review',
                    desc: 'Mọi lệnh hệ thống đều bắt buộc người dùng xác nhận thủ công trước khi chạy.',
                  },
                  {
                    id: 'default',
                    name: 'Default (Khuyên dùng)',
                    desc: 'Tự động chạy các lệnh đọc/an toàn. Hỏi xác nhận khi có thao tác nhạy cảm.',
                  },
                  {
                    id: 'auto',
                    name: 'Auto (Preview)',
                    desc: 'Agent tự động đánh giá độ an toàn và thực thi mà không làm phiền bạn.',
                  },
                  {
                    id: 'turbo',
                    name: 'Turbo (Toàn quyền)',
                    desc: 'Chạy thẳng toàn bộ lệnh không hạn chế. Yêu cầu Orbis có quyền Administrator.',
                    requiresAdmin: true,
                  },
                ].map((opt) => {
                  const isSelected = sandboxPolicy === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectPolicy(opt.id as any)}
                      className={`rounded-2xl border p-4 text-left transition space-y-1.5 ${
                        isSelected
                          ? 'border-amber-400 bg-amber-400/10 text-white shadow-md'
                          : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-100">{opt.name}</span>
                        {opt.requiresAdmin && !isAdmin && (
                          <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300">
                            Cần Admin
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
              <div className="text-xs font-bold text-white">Thao tác Môi trường Sandbox Cô lập</div>
              <p className="text-xs text-zinc-400">
                Sandbox cho phép chạy các tác vụ thử nghiệm trong một không gian an toàn, không làm ảnh hưởng tới hệ thống chính.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleOpenSandbox}
                  disabled={sandboxBusy}
                  className="flex items-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow transition disabled:opacity-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Khởi động Sandbox</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: HỒ SƠ & NGƯỜI DÙNG ================= */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="border-b border-zinc-800 pb-5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <User className="h-5 w-5 text-indigo-400" />
                Hồ sơ Người dùng & Xưng hô
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Tùy chỉnh thông tin để Trợ lý AI và Mèo Trợ lý xưng hô thân mật, đúng phong cách của bạn.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">Tên của bạn</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-xs text-white focus:border-indigo-400 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">Cách Orbis xưng hô với bạn</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'male', label: 'Nam (anh)', pronoun: 'anh' },
                    { id: 'female', label: 'Nữ (chị)', pronoun: 'chị' },
                    { id: 'other', label: 'Khác (bạn)', pronoun: 'bạn' },
                  ].map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setProfile({ ...profile, gender: g.id as any, pronoun: g.pronoun })}
                      className={`rounded-xl border py-2 text-xs font-medium transition ${
                        profile.gender === g.id
                          ? 'border-indigo-400 bg-indigo-400/15 text-indigo-300'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-xs font-semibold text-white shadow transition"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{profileSaved ? 'Đã lưu hồ sơ!' : 'Lưu hồ sơ'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 5: TRỢ LÝ CYBER CAT ================= */}
        {activeTab === 'cat' && (
          <div className="space-y-6">
            <div className="border-b border-zinc-800 pb-5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Bot className="h-5 w-5 text-purple-400" />
                Linh vật Đồng hành (Cyber Cat Companion)
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Tùy biến diện mạo, kích thước và kỹ năng của chú mèo đồng hành trên màn hình Desktop.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
                <div>
                  <div className="text-sm font-bold text-white">{catSettings.name}</div>
                  <div className="text-xs text-zinc-400">
                    Cấp độ thân thiết: Lv.{catSettings.bondLevel} ({catSettings.bondExp}/100 EXP) • {catSettings.treats} 🐟 Treats
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={catSettings.enabled}
                    onChange={(e) => {
                      const updated = { ...catSettings, enabled: e.target.checked };
                      setCatSettings(updated);
                      saveStoredCatSettings(updated);
                    }}
                    className="rounded border-zinc-700 bg-zinc-800 text-purple-500 focus:ring-0"
                  />
                  <span>Hiện mèo trên màn hình</span>
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">Màu sắc chủ đạo</label>
                <div className="grid grid-cols-5 gap-2">
                  {(['cyan', 'emerald', 'violet', 'amber', 'gold'] as const).map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        const updated = { ...catSettings, colorTheme: color };
                        setCatSettings(updated);
                        saveStoredCatSettings(updated);
                      }}
                      className={`rounded-xl border py-2 text-xs capitalize transition ${
                        catSettings.colorTheme === color
                          ? 'border-purple-400 bg-purple-400/15 text-purple-300 font-bold'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Kích thước Mèo</span>
                  <span className="font-mono">{catSettings.scale}x</span>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="1.6"
                  step="0.1"
                  value={catSettings.scale}
                  onChange={(e) => {
                    const updated = { ...catSettings, scale: parseFloat(e.target.value) };
                    setCatSettings(updated);
                    saveStoredCatSettings(updated);
                  }}
                  className="w-full accent-purple-400"
                />
              </div>

              <div className="border-t border-zinc-800 pt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Kỹ năng đã dạy ({catSettings.taughtSkills.length})</span>
                  <span className="text-purple-400">
                    {catSettings.taughtSkills.filter(s => s.enabled).length} kỹ năng đang kích hoạt
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 6: TỰ ĐỘNG HÓA N8N ================= */}
        {activeTab === 'n8n' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-5">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Workflow className="h-5 w-5 text-rose-400" />
                  Tự động hóa n8n Cloud Webhook Bridge
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Kích hoạt workflow n8n (gửi email, cào web, thông báo Telegram) trực tiếp từ Agent.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={n8nConfig.enabled}
                  onChange={(e) => setN8nConfig({ ...n8nConfig, enabled: e.target.checked })}
                  className="rounded border-zinc-700 bg-zinc-800 text-rose-500 focus:ring-0"
                />
                <span>Kích hoạt Webhook</span>
              </label>
            </div>

            <div className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4 ${!n8nConfig.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">Webhook URL</label>
                <input
                  type="text"
                  placeholder="https://.../webhook/orbis-bridge"
                  value={n8nConfig.webhookUrl}
                  onChange={(e) => setN8nConfig({ ...n8nConfig, webhookUrl: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-xs font-mono text-white focus:border-rose-400 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Bearer Token / API Key (Tùy chọn)</span>
                  <button
                    type="button"
                    onClick={handleTestN8n}
                    disabled={n8nTesting || !n8nConfig.webhookUrl.trim()}
                    className="text-rose-400 hover:underline disabled:opacity-50"
                  >
                    {n8nTesting ? 'Đang test...' : 'Test Webhook'}
                  </button>
                </div>
                <input
                  type="password"
                  placeholder="Nhập Bearer Token nếu webhook yêu cầu xác thực..."
                  value={n8nConfig.apiKey || ''}
                  onChange={(e) => setN8nConfig({ ...n8nConfig, apiKey: e.target.value })}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-xs text-white font-mono focus:border-rose-400 focus:outline-none"
                />
                {n8nTestResult && (
                  <div className={`flex items-center gap-1.5 text-xs mt-1.5 ${n8nTestResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                    {n8nTestResult.success ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                    <span>{n8nTestResult.message}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveN8n}
                  className="flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 px-5 py-2.5 text-xs font-semibold text-white shadow transition"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Lưu cấu hình n8n</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ================= MODAL: THÊM / SỬA MCP SERVER ================= */}
      {showAddMcpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plug className="h-4 w-4 text-emerald-400" />
                {editingMcpServer ? 'Chỉnh sửa MCP Server' : 'Thêm Máy chủ MCP Mới'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddMcpModal(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Tên hiển thị Máy chủ</label>
                <input
                  type="text"
                  placeholder="Ví dụ: n8n Cloud MCP, Local Filesystem..."
                  value={formMcpName}
                  onChange={(e) => setFormMcpName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Loại giao thức (Transport)</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'http', label: 'HTTP / SSE (Cloud)' },
                    { id: 'stdio', label: 'stdio (Process/CLI)' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFormMcpType(t.id as any)}
                      className={`rounded-xl border py-1.5 text-xs font-medium transition ${
                        formMcpType === t.id
                          ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
                          : 'border-zinc-800 bg-zinc-800/60 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Server Endpoint URL</label>
                <input
                  type="text"
                  placeholder="https://.../mcp-server/http"
                  value={formMcpUrl}
                  onChange={(e) => setFormMcpUrl(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-mono text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Authorization Token (Bearer / JWT)</label>
                <input
                  type="password"
                  placeholder="Nhập Token nếu MCP server yêu cầu xác thực..."
                  value={formMcpToken}
                  onChange={(e) => setFormMcpToken(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-mono text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-800 pt-3">
              <button
                type="button"
                onClick={() => setShowAddMcpModal(false)}
                className="rounded-xl px-4 py-2 text-xs text-zinc-400 hover:text-white"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveMcpModal}
                disabled={!formMcpName.trim() || !formMcpUrl.trim()}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition disabled:opacity-50"
              >
                {editingMcpServer ? 'Cập nhật' : 'Thêm & Kiểm tra'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CHẠY THỬ MCP TOOL ================= */}
      {activeToolToRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-700 bg-zinc-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-bold text-white font-mono">{activeToolToRun.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveToolToRun(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              {activeToolToRun.description || 'Chạy thử công cụ trực tiếp với MCP Server.'}
            </p>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Tham số Arguments (JSON)</label>
              <textarea
                rows={4}
                value={toolArgsJson}
                onChange={(e) => setToolArgsJson(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-xs font-mono text-zinc-200 focus:border-emerald-400 focus:outline-none"
              />
            </div>

            {toolRunResult && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 space-y-1 max-h-48 overflow-y-auto">
                <div className="text-[11px] font-bold text-zinc-400">Kết quả phản hồi:</div>
                <pre className="text-xs font-mono text-emerald-300 whitespace-pre-wrap">
                  {JSON.stringify(toolRunResult, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-zinc-800 pt-3">
              <button
                type="button"
                onClick={() => setActiveToolToRun(null)}
                className="rounded-xl px-4 py-2 text-xs text-zinc-400 hover:text-white"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleExecuteToolTest}
                disabled={toolRunning}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${toolRunning ? 'animate-spin' : ''}`} />
                <span>{toolRunning ? 'Đang gọi tool...' : 'Thực thi ngay'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
