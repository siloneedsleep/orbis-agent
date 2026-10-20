import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Key, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  RefreshCw, 
  ShieldCheck,
  User,
  Zap
} from 'lucide-react';
import { commands, OllamaStatus } from '@/ipc/commands';
import { validateApiKey } from '@/services/apiValidator';
import { UserProfile, LLMConfig, saveStoredProfile, saveStoredLLMConfig } from '@/state/agentStore';

interface OnboardingModalProps {
  onComplete: (profile: UserProfile, config: LLMConfig) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: User Profile
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');

  // Step 2: LLM Choice
  const [llmType, setLlmType] = useState<'local' | 'api'>('local');
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState<string>('auto');
  const [maxPower, setMaxPower] = useState(true);

  // Cloud API settings
  const [provider, setProvider] = useState<'deepseek' | 'gemini' | 'openai' | 'claude'>('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [apiModel, setApiModel] = useState('deepseek-chat');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; error?: string } | null>(null);

  // Quét Ollama khi chọn local
  const scanOllama = async () => {
    setOllamaLoading(true);
    try {
      const res = await commands.ollamaStatus();
      setOllamaStatus(res);
      if (res.models.length > 0) {
        setSelectedOllamaModel(res.largest || res.models[0].name);
      }
    } catch {
      setOllamaStatus(null);
    } finally {
      setOllamaLoading(false);
    }
  };

  useEffect(() => {
    if (step === 2 && llmType === 'local') {
      scanOllama();
    }
  }, [step, llmType]);

  const handleTestApiKey = async () => {
    if (!apiKey.trim()) return;
    setValidating(true);
    setValidationResult(null);
    const result = await validateApiKey(provider, apiKey);
    setValidationResult(result);
    setValidating(false);
  };

  const getPronoun = (g: 'male' | 'female' | 'other') => {
    if (g === 'male') return 'anh';
    if (g === 'female') return 'chị';
    return 'bạn';
  };

  const handleFinish = () => {
    const profile: UserProfile = {
      name: name.trim() || 'Người dùng',
      gender,
      pronoun: getPronoun(gender),
    };

    const config: LLMConfig = {
      type: llmType,
      provider: llmType === 'local' ? 'ollama' : provider,
      model: llmType === 'local' ? selectedOllamaModel : apiModel,
      apiKey: llmType === 'api' ? apiKey.trim() : undefined,
      maxPower,
    };

    saveStoredProfile(profile);
    saveStoredLLMConfig(config);
    onComplete(profile, config);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-900 shadow-2xl text-zinc-100 flex flex-col">
        {/* Header */}
        <div className="border-b border-zinc-800 bg-zinc-900/90 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white">Khởi tạo Orbis Desktop Agent</h2>
              <p className="text-xs text-zinc-400">Hệ thống trợ lý điều khiển Windows thông minh & an toàn</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 bg-zinc-800/80 px-2.5 py-1 rounded-full border border-zinc-700">
            <span>Bước {step}</span>
            <span className="text-zinc-600">/</span>
            <span>2</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4 text-sm text-cyan-200 flex gap-3">
                <User className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-white mb-1">Chào mừng bạn!</p>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Để Orbis Agent có thể hỗ trợ và xưng hô tự nhiên, chính xác theo văn hóa giao tiếp, xin vui lòng cho biết tên và cách xưng hô phù hợp nhất với bạn.
                  </p>
                </div>
              </div>

              {/* Tên */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Tên hoặc Biệt danh của bạn <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Ví dụ: Hoàng, Minh, Lan, Alex..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStep(2)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 transition"
                />
              </div>

              {/* Giới tính / Xưng hô */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Cách Orbis Agent nên xưng hô với bạn
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setGender('male')}
                    className={`flex flex-col items-center justify-center rounded-xl border p-4 text-center transition ${
                      gender === 'male'
                        ? 'border-cyan-500 bg-cyan-500/10 text-white ring-1 ring-cyan-500'
                        : 'border-zinc-800 bg-zinc-800/40 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    <span className="text-lg mb-1">👨</span>
                    <span className="text-sm font-medium">Nam</span>
                    <span className="text-xs text-zinc-500 mt-1">Xưng "anh"</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGender('female')}
                    className={`flex flex-col items-center justify-center rounded-xl border p-4 text-center transition ${
                      gender === 'female'
                        ? 'border-cyan-500 bg-cyan-500/10 text-white ring-1 ring-cyan-500'
                        : 'border-zinc-800 bg-zinc-800/40 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    <span className="text-lg mb-1">👩</span>
                    <span className="text-sm font-medium">Nữ</span>
                    <span className="text-xs text-zinc-500 mt-1">Xưng "chị"</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGender('other')}
                    className={`flex flex-col items-center justify-center rounded-xl border p-4 text-center transition ${
                      gender === 'other'
                        ? 'border-cyan-500 bg-cyan-500/10 text-white ring-1 ring-cyan-500'
                        : 'border-zinc-800 bg-zinc-800/40 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    <span className="text-lg mb-1">🧑</span>
                    <span className="text-sm font-medium">Khác / Bạn bè</span>
                    <span className="text-xs text-zinc-500 mt-1">Xưng "bạn"</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium text-white mb-1">
                  Chào {getPronoun(gender)} <span className="text-cyan-400">{name || 'bạn'}</span>!
                </p>
                <p className="text-xs text-zinc-400">
                  Hãy chọn bộ não AI (LLM) để vận hành Orbis Agent:
                </p>
              </div>

              {/* Selector 2 loại: Local vs Cloud API */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setLlmType('local')}
                  className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                    llmType === 'local'
                      ? 'border-cyan-500 bg-cyan-500/10 text-white ring-1 ring-cyan-500'
                      : 'border-zinc-800 bg-zinc-800/40 text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  <Cpu className="h-5 w-5 text-cyan-400 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-white">Local LLM (Ollama)</div>
                    <div className="text-xs text-zinc-400 mt-1">
                      Chạy 100% trên máy của bạn. Bảo mật tối đa, không tốn phí token, không cần Internet.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setLlmType('api')}
                  className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                    llmType === 'api'
                      ? 'border-cyan-500 bg-cyan-500/10 text-white ring-1 ring-cyan-500'
                      : 'border-zinc-800 bg-zinc-800/40 text-zinc-400 hover:bg-zinc-800'
                  }`}
                >
                  <Key className="h-5 w-5 text-amber-400 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-white">Cloud API (DeepSeek / Gemini...)</div>
                    <div className="text-xs text-zinc-400 mt-1">
                      Mô hình đám mây tốc độ cao, nhận diện thị giác máy tính và lập luận cực mạnh.
                    </div>
                  </div>
                </button>
              </div>

              {/* Local LLM details */}
              {llmType === 'local' && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-800/40 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Trạng thái Ollama cục bộ
                    </span>
                    <button
                      type="button"
                      onClick={scanOllama}
                      disabled={ollamaLoading}
                      className="flex items-center gap-1 text-xs text-cyan-400 hover:underline"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${ollamaLoading ? 'animate-spin' : ''}`} />
                      Quét lại
                    </button>
                  </div>

                  {ollamaStatus && ollamaStatus.models.length > 0 ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-zinc-400 mb-1 block">Chọn Model Ollama:</label>
                        <select
                          value={selectedOllamaModel}
                          onChange={(e) => setSelectedOllamaModel(e.target.value)}
                          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                        >
                          <option value="auto">Tự động (Model lớn nhất: {ollamaStatus.largest || 'Auto'})</option>
                          {ollamaStatus.models.map((m) => (
                            <option key={m.name} value={m.name}>
                              {m.name} ({(m.sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center justify-between rounded-lg bg-zinc-900/60 p-3 border border-zinc-800">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-yellow-400" />
                          <span className="text-xs font-medium text-zinc-200">Max Power Mode (Full GPU offload)</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={maxPower}
                          onChange={(e) => setMaxPower(e.target.checked)}
                          className="h-4 w-4 rounded border-zinc-700 text-cyan-500 focus:ring-cyan-400"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                      <p className="font-medium text-amber-300 mb-1">Chưa kết nối được Ollama hoặc chưa có model</p>
                      <p className="text-zinc-400">
                        Vui lòng mở Ollama trên máy và kéo model về bằng lệnh: <code className="text-cyan-300 font-mono">ollama run deepseek-r1</code> hoặc <code className="text-cyan-300 font-mono">ollama run qwen2.5-coder</code>.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Cloud API details */}
              {llmType === 'api' && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-800/40 p-4 space-y-4">
                  {/* Provider selection */}
                  <div className="grid grid-cols-4 gap-2">
                    {(['deepseek', 'gemini', 'openai', 'claude'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setProvider(p);
                          setValidationResult(null);
                          if (p === 'deepseek') setApiModel('deepseek-chat');
                          if (p === 'gemini') setApiModel('gemini-2.0-flash');
                          if (p === 'openai') setApiModel('gpt-4o');
                          if (p === 'claude') setApiModel('claude-3-5-sonnet-20241022');
                        }}
                        className={`rounded-lg border py-2 text-xs font-medium capitalize transition ${
                          provider === p
                            ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300'
                            : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  {/* API Key */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400 flex items-center justify-between">
                      <span>API Key ({provider})</span>
                      <button
                        type="button"
                        onClick={handleTestApiKey}
                        disabled={validating || !apiKey.trim()}
                        className="text-xs text-cyan-400 hover:underline disabled:opacity-50"
                      >
                        {validating ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
                      </button>
                    </label>
                    <input
                      type="password"
                      placeholder={`Nhập ${provider.toUpperCase()} API Key...`}
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        setValidationResult(null);
                      }}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-cyan-400 focus:outline-none"
                    />

                    {validationResult && (
                      <div className={`flex items-center gap-2 text-xs mt-1 ${validationResult.valid ? 'text-emerald-400' : 'text-red-400'}`}>
                        {validationResult.valid ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            <span>Kết nối thành công! API Key hợp lệ.</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>{validationResult.error || 'API Key không hợp lệ.'}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Model */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400">Tên Model</label>
                    <input
                      type="text"
                      value={apiModel}
                      onChange={(e) => setApiModel(e.target.value)}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-mono text-zinc-200 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 bg-zinc-900/90 px-6 py-4 flex items-center justify-between">
          {step === 2 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-zinc-400 hover:text-white"
            >
              ← Quay lại
            </button>
          ) : (
            <div />
          )}

          {step === 1 ? (
            <button
              type="button"
              disabled={!name.trim()}
              onClick={() => setStep(2)}
              className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
            >
              Tiếp tục
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:from-cyan-400 hover:to-blue-500"
            >
              <ShieldCheck className="h-4 w-4" />
              Kích hoạt Orbis Agent
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
