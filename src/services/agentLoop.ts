import { commands } from "@/ipc/commands";
import { getStoredProfile, getStoredLLMConfig, buildSystemPrompt, LLMConfig } from "@/state/agentStore";

export type AgentAction = 
  | { type: 'mouse_move', x: number, y: number }
  | { type: 'mouse_click', button: 'left' | 'right' }
  | { type: 'keyboard_type', text: string }
  | { type: 'sandbox_exec', command: string, requireCheckpoint?: boolean }
  | { type: 'done', message: string };

export interface AgentStepResult {
  thought: string;
  action: AgentAction;
  message: string;
  rawResponse?: string;
  usedFallback?: boolean;
}

export class AgentBrain {
  private getSystemPrompt(): string {
    const profile = getStoredProfile();
    return buildSystemPrompt(profile);
  }

  /**
   * Tiền xử lý và chuẩn hóa đầu ra JSON từ LLM:
   * - Cắt bỏ toàn bộ thẻ ```json và ``` ở hai đầu chuỗi
   * - Tương thích ngược: gán parsed.type = parsed.action nếu thiếu trường type
   * - Kiểm tra sự tồn tại và kiểu dữ liệu của các trường bắt buộc theo từng loại action
   */
  public preprocessAndParseLLMOutput(rawText: string): AgentStepResult {
    let thought = "Đang xử lý yêu cầu...";
    let action: AgentAction = { type: 'done', message: 'Tác vụ hoàn tất' };
    let message = "Đã hoàn thành.";

    if (!rawText || !rawText.trim()) {
      return { thought, action, message, rawResponse: rawText };
    }

    try {
      // 1. Cắt bỏ toàn bộ thẻ ```json và ``` ở hai đầu chuỗi
      let cleaned = rawText
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      // Trích xuất khối JSON object nếu LLM vẫn chèn text phụ xung quanh
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : cleaned;
      const parsed: any = JSON.parse(jsonStr);

      if (typeof parsed.thought === "string" && parsed.thought.trim()) {
        thought = parsed.thought.trim();
      }
      if (typeof parsed.message === "string" && parsed.message.trim()) {
        message = parsed.message.trim();
      } else if (typeof parsed.response === "string" && parsed.response.trim()) {
        message = parsed.response.trim();
      } else if (typeof parsed.reply === "string" && parsed.reply.trim()) {
        message = parsed.reply.trim();
      } else if (typeof parsed.answer === "string" && parsed.answer.trim()) {
        message = parsed.answer.trim();
      }

      // 2. Cơ chế tương thích ngược: nếu có trường `action` nhưng thiếu trường `type`
      if (!parsed.type && parsed.action) {
        if (typeof parsed.action === "string") {
          parsed.type = parsed.action;
        } else if (typeof parsed.action === "object" && parsed.action !== null) {
          parsed.type = parsed.action.type || parsed.action.action;
          Object.assign(parsed, parsed.action);
        }
      }

      // Nếu thông số nằm trong `params`, gộp lên cấp trên nếu chưa có
      if (parsed.params && typeof parsed.params === "object") {
        for (const [k, v] of Object.entries(parsed.params)) {
          if (parsed[k] === undefined) {
            parsed[k] = v;
          }
        }
      }

      // 3. Kiểm tra sự tồn tại của các trường bắt buộc theo từng loại action
      switch (parsed.type) {
        case 'mouse_move': {
          const x = Number(parsed.x);
          const y = Number(parsed.y);
          if (typeof x === 'number' && !Number.isNaN(x) && typeof y === 'number' && !Number.isNaN(y)) {
            action = { type: 'mouse_move', x: Math.round(x), y: Math.round(y) };
          } else {
            throw new Error("Action mouse_move thiếu tọa độ x, y hợp lệ kiểu số.");
          }
          break;
        }
        case 'mouse_click': {
          const button = parsed.button === 'right' ? 'right' : parsed.button === 'left' ? 'left' : null;
          if (!button) {
            throw new Error("Action mouse_click thiếu trường button ('left' | 'right').");
          }
          action = { type: 'mouse_click', button };
          break;
        }
        case 'keyboard_type': {
          if (typeof parsed.text !== 'string') {
            throw new Error("Action keyboard_type thiếu trường text kiểu chuỗi.");
          }
          action = { type: 'keyboard_type', text: parsed.text };
          break;
        }
        case 'sandbox_exec': {
          if (typeof parsed.command !== 'string' || !parsed.command.trim()) {
            throw new Error("Action sandbox_exec thiếu trường command hợp lệ.");
          }
          action = {
            type: 'sandbox_exec',
            command: parsed.command,
            requireCheckpoint: parsed.requireCheckpoint ?? true,
          };
          break;
        }
        case 'done': {
          const doneMsg =
            typeof parsed.message === 'string' && parsed.message.trim()
              ? parsed.message.trim()
              : message !== "Đã hoàn thành."
              ? message
              : thought || 'Hoàn tất bước này.';
          message = doneMsg;
          action = { type: 'done', message: doneMsg };
          break;
        }
        default: {
          const fallbackMsg =
            typeof parsed.message === 'string' && parsed.message.trim()
              ? parsed.message.trim()
              : message !== "Đã hoàn thành."
              ? message
              : thought !== "Đang xử lý yêu cầu..."
              ? thought
              : 'Hoàn tất bước này.';
          message = fallbackMsg;
          action = { type: 'done', message: fallbackMsg };
          break;
        }
      }
    } catch {
      message = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim() || "Đã hoàn thành.";
      action = { type: 'done', message };
    }

    return { thought, action, message, rawResponse: rawText };
  }

  async planNextMove(
    userPrompt: string,
    screenBase64?: string,
    overrideConfig?: LLMConfig | null
  ): Promise<AgentStepResult> {
    const config = overrideConfig || getStoredLLMConfig();
    const systemPrompt = this.getSystemPrompt();
    const userInstruction =
      `Yêu cầu hiện tại của người dùng: "${userPrompt}"\n` +
      `Hãy trả về DUY NHẤT 1 JSON object hợp lệ có khóa "type" ("done" | "mouse_move" | "mouse_click" | "keyboard_type" | "sandbox_exec"), "thought" và "message".\n` +
      `Ví dụ nếu trả lời hoặc báo cáo kết quả: {"type": "done", "thought": "Đã phân tích yêu cầu của người dùng", "message": "Nội dung câu trả lời chi tiết tại đây"}`;

    let replyContent = "";
    const isLocalMode = !config || config.mode === 'local' || config.type === 'local' || config.provider === 'ollama';

    // 1. Local Ollama (Mode === "local")
    if (isLocalMode) {
      const rawLocalModel = config?.localModel || config?.model;
      const targetModel =
        !rawLocalModel ||
        rawLocalModel === 'auto' ||
        /^(deepseek|gemini|gpt-|claude)/i.test(rawLocalModel)
          ? undefined
          : rawLocalModel;
      const isVision = targetModel ? /vision|vl|llava|minicpm|bakllava/i.test(targetModel) : false;

      const userMsg: any = { role: 'user', content: userInstruction };
      if (screenBase64 && isVision) {
        userMsg.images = [screenBase64.replace(/^data:image\/[a-z]+;base64,/, '')];
      }

      const msgs: any[] = [
        { role: 'system', content: systemPrompt },
        userMsg,
      ];

      try {
        // Ưu tiên gọi qua IPC Rust (tránh CORS trên WebView, tự khớp model và đặt num_ctx: 4096 an toàn)
        const res = await commands.ollamaChat(msgs, {
          model: targetModel,
          maxPower: config?.maxPower ?? true,
        });
        replyContent = res.content;
      } catch (ipcErr: any) {
        console.warn("IPC ollamaChat gặp lỗi, thử gọi HTTP fallback tới 127.0.0.1:11434/api/chat...", ipcErr);
        try {
          await commands.startOllamaServer().catch(() => {});
          let resolvedHttpModel = targetModel;
          if (!resolvedHttpModel) {
            const tagsRes = await fetch("http://127.0.0.1:11434/api/tags");
            if (tagsRes.ok) {
              const tagsData = await tagsRes.json();
              const modelsList: any[] = tagsData?.models || [];
              const nonEmbed = modelsList.filter((m) => !String(m?.name || '').toLowerCase().includes('embed'));
              const preferred =
                nonEmbed.find((m) => !String(m?.name || '').startsWith('hf.co/')) ||
                nonEmbed[0] ||
                modelsList[0];
              if (preferred?.name) {
                resolvedHttpModel = preferred.name;
              }
            }
          }

          const httpRes = await fetch("http://127.0.0.1:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: resolvedHttpModel || "qwen2.5-coder:14b",
              messages: msgs.map((m) => ({ role: m.role, content: m.content })),
              stream: false,
              format: "json",
              options: {
                num_gpu: 999,
                num_ctx: 4096,
                temperature: 0.2,
              },
            }),
          });
          if (!httpRes.ok) {
            throw new Error(`Ollama HTTP ${httpRes.status}`);
          }
          const data = await httpRes.json();
          replyContent = data?.message?.content || "";
        } catch (retryErr: any) {
          throw new Error(`Không gọi được Local Ollama: ${ipcErr?.message || ipcErr || retryErr?.message || retryErr}`);
        }
      }
    }
    // 2. Cloud API (Gemini / OpenAI / Claude / DeepSeek) -> Ưu tiên đi qua Rust Backend (cloudLlmChat)
    else {
      const provider = config.provider;
      const storageKeyName = `orbis_${provider}_key`;
      const apiKey = (
        config.apiKey ||
        (typeof window !== 'undefined' ? localStorage.getItem(storageKeyName) : '') ||
        ''
      ).trim();

      if (!apiKey) {
        throw new Error(`Chưa cấu hình ${provider.toUpperCase()} API Key trong Cài đặt`);
      }

      const requestedModel = config.cloudModel || config.model;

      try {
        const cloudRes = await commands.cloudLlmChat({
          provider,
          apiKey,
          model: requestedModel,
          systemPrompt,
          userPrompt: userInstruction,
          imageBase64: provider === 'deepseek' ? undefined : screenBase64,
        });
        replyContent = cloudRes.content;
      } catch (rustCloudErr: any) {
        const errStr = String(rustCloudErr?.message || rustCloudErr || '');
        // Nếu lỗi là lỗi xác thực / hết tiền / rate limit từ API thật, ném ra ngay để HybridFallback xử lý
        if (
          errStr.includes('429') ||
          errStr.includes('402') ||
          errStr.includes('401') ||
          errStr.includes('403') ||
          errStr.includes('API Error') ||
          errStr.includes('Insufficient Balance')
        ) {
          throw new Error(errStr);
        }

        console.warn(`[agentLoop] IPC cloudLlmChat (${provider}) lỗi, thử gọi WebView fetch fallback:`, errStr);
        replyContent = await this.callCloudFetchFallback(
          provider,
          apiKey,
          requestedModel,
          systemPrompt,
          userInstruction,
          screenBase64
        );
      }
    }

    return this.preprocessAndParseLLMOutput(replyContent);
  }

  private async callCloudFetchFallback(
    provider: string,
    apiKey: string,
    rawModel: string | undefined,
    systemPrompt: string,
    userInstruction: string,
    screenBase64?: string
  ): Promise<string> {
    if (provider === 'gemini') {
      const model =
        rawModel && rawModel.toLowerCase().includes('gemini')
          ? rawModel.replace(/^models\//, '')
          : 'gemini-2.0-flash';
      const encodedKey = encodeURIComponent(apiKey);
      const parts: any[] = [{ text: userInstruction }];

      if (screenBase64) {
        parts.push({
          inlineData: {
            mimeType: "image/png",
            data: screenBase64.replace(/^data:image\/[a-z]+;base64,/, ''),
          },
        });
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodedKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2,
            },
          }),
        }
      );

      if (res.status === 429) throw new Error("429 Rate Limit: Gemini API đã chạm giới hạn tần suất.");
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || `Gemini API Error (${res.status})`);
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    if (provider === 'openai') {
      const model =
        rawModel && /^(gpt-|o1|o3|o4|chatgpt)/i.test(rawModel) ? rawModel : 'gpt-4o-mini';
      const userContent: any[] = [{ type: "text", text: userInstruction }];
      if (screenBase64) {
        const cleanB64 = screenBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        userContent.push({
          type: "image_url",
          image_url: { url: `data:image/png;base64,${cleanB64}` },
        });
      }

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        }),
      });

      if (res.status === 429) throw new Error("429 Rate Limit: OpenAI API đã chạm giới hạn tần suất.");
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || "OpenAI API Error");
      return data.choices?.[0]?.message?.content || "";
    }

    if (provider === 'claude') {
      const model =
        rawModel && rawModel.toLowerCase().startsWith('claude-')
          ? rawModel
          : 'claude-3-5-sonnet-20241022';
      const contentParts: any[] = [];
      if (screenBase64) {
        contentParts.push({
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: screenBase64.replace(/^data:image\/[a-z]+;base64,/, ''),
          },
        });
      }
      contentParts.push({ type: "text", text: userInstruction });

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: contentParts }],
        }),
      });

      if (res.status === 429) throw new Error("429 Rate Limit: Claude API đã chạm giới hạn tần suất.");
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || "Claude API Error");
      return data.content?.[0]?.text || "";
    }

    if (provider === 'deepseek') {
      const model =
        rawModel && rawModel.toLowerCase().startsWith('deepseek-')
          ? rawModel
          : 'deepseek-chat';
      const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userInstruction },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        }),
      });

      if (res.status === 429) throw new Error("429 Rate Limit: DeepSeek API đã chạm giới hạn tần suất.");
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || "DeepSeek API Error");
      return data.choices?.[0]?.message?.content || "";
    }

    throw new Error(`Provider không hỗ trợ: ${provider}`);
  }

  async executeAction(action: AgentAction): Promise<any> {
    switch (action.type) {
      case 'mouse_move':
        return await commands.moveMouseBezier(action.x, action.y);
      case 'mouse_click':
        return await commands.mouseClick(action.button);
      case 'keyboard_type':
        return await commands.sendKeystroke(action.text);
      case 'sandbox_exec':
        return await commands.execInSandbox(action.command);
      case 'done':
        return action.message;
    }
  }
}
