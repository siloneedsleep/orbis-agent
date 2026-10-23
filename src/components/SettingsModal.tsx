import React, { useState, useEffect } from 'react';
import { X, Key, User, Cpu, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { UserProfile, LLMConfig, saveStoredProfile, saveStoredLLMConfig } from '@/state/agentStore';
import { validateApiKey } from '@/services/apiValidator';
import { commands, OllamaStatus } from '@/ipc/commands';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  config: LLMConfig;
  onUpdate: (profile: UserProfile, config: LLMConfig) => void;
}

const DEFAULT_CLOUD_MODELS: Record<'deepseek' | 'gemini' | 'openai' | 'claude', string> = {
  deepseek: 'deepseek-chat',
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o-mini',
  claude: 'claude-3-5-sonnet-20241022',
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  config,
  onUpdate,
}) => {
  const [name, setName] = useState(profile.name);
  const [gender, setGender] = useState(profile.gender);
  const [llmType, setLlmType] = useState<'local' | 'api'>(config.type);
  const [provider, setProvider] = useState<'deepseek' | 'gemini' | 'openai' | 'claude'>(
    config.provider === 'ollama' ? (config.cloudProvider || 'deepseek') : config.provider
  );
  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [model, setModel] = useState(config.model);
  const [validating, setValidating] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; error?: string } | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [ollamaLoading, setOllamaLoading] = useState(false);

  const scanOllama = async () => {
    setOllamaLoading(true);
    try {
      await commands.startOllamaServer().catch(() => {});
      const res = await commands.ollamaStatus();
      setOllamaStatus(res);
      if (res.models.length > 0 && (!model || /^(deepseek|gemini|gpt-|claude)/i.test(model))) {
        setModel(res.largest || res.models[0].name);
      }
    } catch {
      setOllamaStatus(null);
    } finally {
      setOllamaLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setName(profile.name);
      setGender(profile.gender);
      setLlmType(config.type);
      const activeCloudProvider =
        config.provider === 'ollama' ? (config.cloudProvider || 'deepseek') : config.provider;
      setProvider(activeCloudProvider);
      const storedKey =
        config.apiKey ||
        (typeof window !== 'undefined' ? localStorage.getItem(`orbis_${activeCloudProvider}_key`) || '' : '');
      setApiKey(storedKey);
      setModel(config.model);
      setTestResult(null);
    }
  }, [isOpen, profile, config]);

  useEffect(() => {
    if (isOpen && llmType === 'local') {
      scanOllama();
    }
  }, [isOpen, llmType]);

  if (!isOpen) return null;

  const getPronoun = (g: 'male' | 'female' | 'other') => {
    if (g === 'male') return 'anh';
    if (g === 'female') return 'chị';
    return 'bạn';
  };

  const handleSwitchLlmType = (nextType: 'local' | 'api') => {
    setLlmType(nextType);
    setTestResult(null);
    if (nextType === 'local') {
      const nextLocal =
        config.localModel && !/^(deepseek|gemini|gpt-|claude)/i.test(config.localModel)
          ? config.localModel
          : ollamaStatus?.largest || 'auto';
      setModel(nextLocal);
    } else {
      const nextCloud = DEFAULT_CLOUD_MODELS[provider] || 'deepseek-chat';
      setModel(nextCloud);
      const storedKey =
        (typeof window !== 'undefined' ? localStorage.getItem(`orbis_${provider}_key`) : null) ||
        apiKey ||
        '';
      setApiKey(storedKey);
    }
  };

  const handleSelectProvider = (p: 'deepseek' | 'gemini' | 'openai' | 'claude') => {
    setProvider(p);
    setTestResult(null);
    setModel(DEFAULT_CLOUD_MODELS[p]);
    const storedKey =
      (typeof window !== 'undefined' ? localStorage.getItem(`orbis_${p}_key`) : null) || '';
    setApiKey(storedKey);
  };

  const handleTestKey = async () => {
    if (!apiKey.trim()) return;
    setValidating(true);
    setTestResult(null);
    const result = await validateApiKey(provider, apiKey);
    setTestResult(result);
    setValidating(false);
  };

  const handleSave = () => {
    const newProfile: UserProfile = {
      name: name.trim() || 'Người dùng',
      gender,
      pronoun: getPronoun(gender),
    };
    const isLocal = llmType === 'local';
    const cleanModel = model.trim();
    const resolvedLocalModel = isLocal
      ? cleanModel && !/^(deepseek|gemini|gpt-|claude)/i.test(cleanModel)
        ? cleanModel
        : ollamaStatus?.largest || 'auto'
      : config.localModel || 'auto';
    const resolvedCloudModel = !isLocal
      ? cleanModel && cleanModel !== 'auto'
        ? cleanModel
        : DEFAULT_CLOUD_MODELS[provider]
      : config.cloudModel || DEFAULT_CLOUD_MODELS[provider];

    const newConfig: LLMConfig = {
      type: llmType,
      mode: isLocal ? 'local' : 'cloud',
      provider: isLocal ? 'ollama' : provider,
      model: isLocal ? resolvedLocalModel : resolvedCloudModel,
      localModel: resolvedLocalModel,
      cloudModel: resolvedCloudModel,
      cloudProvider: provider,
      apiKey: !isLocal ? apiKey.trim() : config.apiKey,
      maxPower: config.maxPower ?? true,
    };

    saveStoredProfile(newProfile);
    saveStoredLLMConfig(newConfig);
    onUpdate(newProfile, newConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl text-zinc-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h3 className="text-base font-semibold text-white">Cấu hình Orbis Agent</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* User info */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Thông tin người dùng
            </h4>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Tên của bạn</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400">Xưng hô</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'male', label: 'Nam (anh)' },
                  { id: 'female', label: 'Nữ (chị)' },
                  { id: 'other', label: 'Khác (bạn)' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setGender(item.id as any)}
                    className={`rounded-lg border py-1.5 text-xs font-medium transition ${
                      gender === item.id
                        ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300'
                        : 'border-zinc-800 bg-zinc-800/60 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <hr className="border-zinc-800" />

          {/* LLM Config */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5" /> Bộ não LLM
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSwitchLlmType('local')}
                className={`rounded-lg border py-2 text-xs font-medium transition ${
                  llmType === 'local'
                    ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300'
                    : 'border-zinc-800 bg-zinc-800/60 text-zinc-400 hover:text-white'
                }`}
              >
                Local Ollama
              </button>
              <button
                type="button"
                onClick={() => handleSwitchLlmType('api')}
                className={`rounded-lg border py-2 text-xs font-medium transition ${
                  llmType === 'api'
                    ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300'
                    : 'border-zinc-800 bg-zinc-800/60 text-zinc-400 hover:text-white'
                }`}
              >
                Cloud API
              </button>
            </div>

            {llmType === 'api' ? (
              <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-800/40 p-3">
                <div className="grid grid-cols-4 gap-1.5">
                  {(['deepseek', 'gemini', 'openai', 'claude'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleSelectProvider(p)}
                      className={`rounded-md border py-1 text-xs capitalize transition ${
                        provider === p
                          ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300'
                          : 'border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>API Key ({provider})</span>
                    <button
                      type="button"
                      onClick={handleTestKey}
                      disabled={validating || !apiKey.trim()}
                      className="text-cyan-400 hover:underline disabled:opacity-50"
                    >
                      {validating ? 'Kiểm tra...' : 'Test Key'}
                    </button>
                  </div>
                  <input
                    type="password"
                    placeholder={`Nhập ${provider.toUpperCase()} API Key...`}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setTestResult(null);
                    }}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-white"
                  />
                  {testResult && (
                    <div className={`flex items-center gap-1.5 text-xs ${testResult.valid ? 'text-emerald-400' : 'text-red-400'}`}>
                      {testResult.valid ? <Check className="h-3 w-3 shrink-0" /> : <AlertCircle className="h-3 w-3 shrink-0" />}
                      <span>{testResult.valid ? 'API Key hợp lệ!' : testResult.error}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-400">Model</label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-mono text-white"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-800/40 p-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-zinc-400">Model Ollama cục bộ</label>
                  <button
                    type="button"
                    onClick={scanOllama}
                    disabled={ollamaLoading}
                    className="flex items-center gap-1 text-xs text-cyan-400 hover:underline"
                  >
                    <RefreshCw className={`h-3 w-3 ${ollamaLoading ? 'animate-spin' : ''}`} />
                    Quét lại
                  </button>
                </div>
                {ollamaStatus && ollamaStatus.models.length > 0 ? (
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  >
                    <option value="auto">Tự động ({ollamaStatus.largest || 'Model tốt nhất'})</option>
                    {ollamaStatus.models.map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.name} ({(m.sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB)
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="auto hoặc tên model (ví dụ: qwen2.5-coder:14b)"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-mono text-white"
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-zinc-800 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-xs text-zinc-400 hover:text-white"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500"
          >
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
};
