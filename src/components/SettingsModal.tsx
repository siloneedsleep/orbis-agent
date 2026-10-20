import React, { useState } from 'react';
import { X, Key, User, Cpu, Check, AlertCircle } from 'lucide-react';
import { UserProfile, LLMConfig, saveStoredProfile, saveStoredLLMConfig } from '@/state/agentStore';
import { validateApiKey } from '@/services/apiValidator';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  config: LLMConfig;
  onUpdate: (profile: UserProfile, config: LLMConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  config,
  onUpdate,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState(profile.name);
  const [gender, setGender] = useState(profile.gender);
  const [llmType, setLlmType] = useState(config.type);
  const [provider, setProvider] = useState(config.provider === 'ollama' ? 'deepseek' : config.provider);
  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [model, setModel] = useState(config.model);
  const [validating, setValidating] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; error?: string } | null>(null);

  const getPronoun = (g: 'male' | 'female' | 'other') => {
    if (g === 'male') return 'anh';
    if (g === 'female') return 'chị';
    return 'bạn';
  };

  const handleTestKey = async () => {
    if (!apiKey.trim()) return;
    setValidating(true);
    setTestResult(null);
    const result = await validateApiKey(provider as any, apiKey);
    setTestResult(result);
    setValidating(false);
  };

  const handleSave = () => {
    const newProfile: UserProfile = {
      name: name.trim() || 'Người dùng',
      gender,
      pronoun: getPronoun(gender),
    };
    const newConfig: LLMConfig = {
      type: llmType,
      provider: llmType === 'local' ? 'ollama' : (provider as any),
      model: model.trim() || (llmType === 'local' ? 'auto' : 'deepseek-chat'),
      apiKey: llmType === 'api' ? apiKey.trim() : undefined,
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
                onClick={() => setLlmType('local')}
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
                onClick={() => setLlmType('api')}
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
                      onClick={() => setProvider(p)}
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
                    <span>API Key</span>
                    <button
                      type="button"
                      onClick={handleTestKey}
                      disabled={validating || !apiKey.trim()}
                      className="text-cyan-400 hover:underline"
                    >
                      {validating ? 'Kiểm tra...' : 'Test Key'}
                    </button>
                  </div>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-white"
                  />
                  {testResult && (
                    <div className={`flex items-center gap-1.5 text-xs ${testResult.valid ? 'text-emerald-400' : 'text-red-400'}`}>
                      {testResult.valid ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                      <span>{testResult.valid ? 'Hợp lệ!' : testResult.error}</span>
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
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400">Model Ollama</label>
                <input
                  type="text"
                  placeholder="auto hoặc tên model (ví dụ: deepseek-r1)"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-mono text-white"
                />
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
