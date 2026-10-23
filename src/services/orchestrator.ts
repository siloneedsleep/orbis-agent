import { AgentBrain, AgentStepResult } from "./agentLoop";
import { commands } from "@/ipc/commands";
import { events } from "@/ipc/events";
import { getStoredLLMConfig, LLMConfig, addCatExp } from "@/state/agentStore";

function resolveCloudFallbackConfig(current: LLMConfig | null): LLMConfig | null {
  const candidates: Array<{
    provider: 'gemini' | 'openai' | 'claude' | 'deepseek';
    defaultModel: string;
  }> = [
    { provider: 'deepseek', defaultModel: 'deepseek-chat' },
    { provider: 'gemini', defaultModel: 'gemini-2.0-flash' },
    { provider: 'openai', defaultModel: 'gpt-4o' },
    { provider: 'claude', defaultModel: 'claude-3-5-sonnet-20241022' },
  ];

  if (current?.cloudProvider && current?.apiKey?.trim()) {
    return {
      ...current,
      type: 'api',
      mode: 'cloud',
      provider: current.cloudProvider,
      model: current.cloudModel || 'deepseek-chat',
      apiKey: current.apiKey.trim(),
    };
  }

  for (const c of candidates) {
    const storedKey =
      (current?.cloudProvider === c.provider ? current?.apiKey : undefined) ||
      (typeof window !== 'undefined' ? localStorage.getItem(`orbis_${c.provider}_key`) : null);
    if (storedKey && storedKey.trim()) {
      return {
        type: 'api',
        mode: 'cloud',
        provider: c.provider,
        cloudProvider: c.provider,
        model: current?.cloudModel || c.defaultModel,
        cloudModel: current?.cloudModel || c.defaultModel,
        localModel: current?.localModel || 'auto',
        apiKey: storedKey.trim(),
        maxPower: current?.maxPower ?? true,
      };
    }
  }

  return null;
}

export async function planStepWithHybridFallback(
  brain: AgentBrain,
  goal: string,
  screenContext?: string
): Promise<AgentStepResult> {
  // Luôn đọc cấu hình LLM mới nhất từ agentStore trước mỗi bước
  const latestConfig = getStoredLLMConfig();
  const isLocal =
    !latestConfig ||
    latestConfig.mode === 'local' ||
    latestConfig.type === 'local' ||
    latestConfig.provider === 'ollama';

  try {
    return await brain.planNextMove(goal, screenContext, latestConfig);
  } catch (primaryErr: any) {
    const errMsg = String(primaryErr?.message || primaryErr || '');
    console.warn(`[HybridFallback] Bước suy luận chính (${isLocal ? 'Local' : 'Cloud'}) gặp lỗi:`, errMsg);

    // Trường hợp 1: Đang ở chế độ Local mà gặp lỗi kết nối/timeout -> thử dự phòng sang Cloud nếu có API Key hợp lệ
    if (isLocal) {
      const cloudFallback = resolveCloudFallbackConfig(latestConfig);
      if (cloudFallback) {
        console.info(`[HybridFallback] Chuyển hướng dự phòng từ Local Ollama sang Cloud (${cloudFallback.provider})...`);
        const step = await brain.planNextMove(goal, screenContext, cloudFallback);
        return { ...step, usedFallback: true };
      }
    }
    // Trường hợp 2: Đang ở chế độ Cloud mà gặp lỗi 429 Rate Limit hoặc lỗi mạng -> thử dự phòng sang Local Ollama
    else {
      const isRateLimitOrNetwork =
        errMsg.includes('429') ||
        /rate limit|quota|timeout|network|failed to fetch/i.test(errMsg);

      if (isRateLimitOrNetwork) {
        console.info("[HybridFallback] Cloud API bị giới hạn (429/Network), chuyển hướng dự phòng sang Local Ollama...");
        const localFallback: LLMConfig = {
          type: 'local',
          mode: 'local',
          provider: 'ollama',
          model: latestConfig?.localModel || 'auto',
          localModel: latestConfig?.localModel || 'auto',
          maxPower: latestConfig?.maxPower ?? true,
        };
        const step = await brain.planNextMove(goal, screenContext, localFallback);
        return { ...step, usedFallback: true };
      }
    }

    throw primaryErr;
  }
}

export class OrbisOrchestrator {
  private brain = new AgentBrain();
  private isRunning = false;
  private readonly maxSteps = 15;

  async startTask(goal: string) {
    this.isRunning = true;
    let stepCount = 0;
    console.log("Starting task:", goal);

    while (this.isRunning && stepCount < this.maxSteps) {
      stepCount++;
      try {
        // 1. Perceive: Capture primary monitor screen
        events.emitPetState({ state: 'thinking', message: `Bước ${stepCount}/${this.maxSteps}: Đang phân tích màn hình...` }).catch(() => {});
        let screenContext: string | undefined = undefined;
        try {
          const layout = await commands.getOverlayLayout();
          const primary = layout.monitors.find((m) => m.primary) || layout.monitors[0];
          if (primary) {
            screenContext = await commands.captureScreenRegion(
              primary.x,
              primary.y,
              primary.width,
              primary.height
            );
          }
        } catch (capErr) {
          console.warn("Screen capture skipped:", capErr);
        }

        // 2. Plan: Đọc cấu hình mới nhất từ agentStore & gọi LLM kèm Hybrid Fallback
        const step = await planStepWithHybridFallback(this.brain, goal, screenContext);

        if (step.action.type === 'done') {
          console.log("Task completed:", step.message);
          events.emitPetState({ state: 'done', message: step.message || 'Tác vụ hoàn tất! ✨' }).catch(() => {});
          addCatExp(15);
          this.isRunning = false;
          break;
        }

        // 3. Act: Execute OS / Sandbox action
        events.emitPetState({ state: 'executing', message: `Đang thực hiện: ${step.action.type}...` }).catch(() => {});
        await this.brain.executeAction(step.action);

        // Độ trễ ngắn giữa các bước để giao diện OS kịp phản hồi
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (e: any) {
        console.error("Loop error:", e);
        events.emitPetState({ state: 'wake', message: `Lỗi: ${e?.message || e}` }).catch(() => {});
        this.isRunning = false;
        break;
      }
    }

    if (stepCount >= this.maxSteps && this.isRunning) {
      console.warn(`Đã chạm giới hạn số bước tối đa (${this.maxSteps} bước). Tự động ngắt vòng lặp an toàn.`);
      events.emitPetState({
        state: 'done',
        message: `Đã dừng sau ${this.maxSteps} bước để tránh lặp vô hạn.`,
      }).catch(() => {});
      this.isRunning = false;
    }
  }

  stop() {
    this.isRunning = false;
  }
}

