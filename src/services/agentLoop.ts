import { commands } from "@/ipc/commands";
import { getStoredProfile, getStoredLLMConfig, getStoredN8nConfig, getStoredMcpServers, buildSystemPrompt, LLMConfig } from "@/state/agentStore";

export type AgentAction = 
  | { type: 'mouse_move', x: number, y: number }
  | { type: 'mouse_click', button: 'left' | 'right' | 'middle' | 'double', x?: number, y?: number }
  | { type: 'keyboard_type', text: string }
  | { type: 'sandbox_exec', command: string, requireCheckpoint?: boolean }
  | { type: 'n8n_execute', workflow: string, payload?: Record<string, any>, summary?: string }
  | { type: 'mcp_call', tool: string, arguments?: Record<string, any>, server?: string, serverUrl?: string, summary?: string }
  | { type: 'done', message: string };

export interface AgentStepResult {
  thought: string;
  action: AgentAction;
  message: string;
  rawResponse?: string;
  usedFallback?: boolean;
}

export type ExecutionMode = 'computer_use' | 'sandbox' | 'chat' | 'teach_cat';

function extractValidJsonObject(text: string): any | null {
  try {
    const direct = JSON.parse(text);
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
      return direct;
    }
  } catch {
    // scan balanced braces below
  }

  for (let start = 0; start < text.length; start++) {
    if (text[start] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (inString) {
        if (ch === '\\') {
          escape = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(start, i + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              return parsed;
            }
          } catch {
            // keep scanning
          }
          break;
        }
      }
    }
  }
  return null;
}

export class AgentBrain {
  private getSystemPrompt(): string {
    const profile = getStoredProfile();
    return buildSystemPrompt(profile);
  }

  /**
   * Tiền xử lý và chuẩn hóa đầu ra JSON từ LLM:
   * - Cắt bỏ toàn bộ thẻ ```json và ``` ở hai đầu chuỗi
   * - Trích xuất khối JSON cân bằng dấu ngoặc nhọn đầu tiên hợp lệ
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

    const cleaned = rawText
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = extractValidJsonObject(cleaned);
    if (!parsed) {
      message = cleaned.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim() || "Đã hoàn thành.";
      action = { type: 'done', message };
      return { thought, action, message, rawResponse: rawText };
    }

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
    } else if (typeof parsed.content === "string" && parsed.content.trim()) {
      message = parsed.content.trim();
    }

    // Cơ chế tương thích ngược: nếu có trường `action` nhưng thiếu trường `type`
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

    const fallbackDoneMessage = () =>
      typeof parsed.message === 'string' && parsed.message.trim()
        ? parsed.message.trim()
        : message !== "Đã hoàn thành."
        ? message
        : thought !== "Đang xử lý yêu cầu..."
        ? thought
        : 'Hoàn tất bước này.';

    switch (parsed.type) {
      case 'mouse_move': {
        const rawX = parsed.x ?? (Array.isArray(parsed.coordinates) ? parsed.coordinates[0] : undefined);
        const rawY = parsed.y ?? (Array.isArray(parsed.coordinates) ? parsed.coordinates[1] : undefined);
        const x = Number(rawX);
        const y = Number(rawY);
        if (typeof rawX !== 'undefined' && typeof rawY !== 'undefined' && !Number.isNaN(x) && !Number.isNaN(y)) {
          action = { type: 'mouse_move', x: Math.round(x), y: Math.round(y) };
        } else {
          message = fallbackDoneMessage();
          action = { type: 'done', message };
        }
        break;
      }
      case 'mouse_click': {
        const rawBtn = typeof parsed.button === 'string' ? parsed.button.toLowerCase().trim() : 'left';
        const button: 'left' | 'right' | 'middle' | 'double' =
          rawBtn === 'right' || rawBtn === 'middle' || rawBtn === 'double' ? rawBtn : 'left';
        const rawX = parsed.x ?? (Array.isArray(parsed.coordinates) ? parsed.coordinates[0] : undefined);
        const rawY = parsed.y ?? (Array.isArray(parsed.coordinates) ? parsed.coordinates[1] : undefined);
        const x = typeof rawX !== 'undefined' ? Number(rawX) : NaN;
        const y = typeof rawY !== 'undefined' ? Number(rawY) : NaN;
        if (!Number.isNaN(x) && !Number.isNaN(y)) {
          action = { type: 'mouse_click', button, x: Math.round(x), y: Math.round(y) };
        } else {
          action = { type: 'mouse_click', button };
        }
        break;
      }
      case 'keyboard_type': {
        const textVal = typeof parsed.text === 'string' ? parsed.text : typeof parsed.value === 'string' ? parsed.value : null;
        if (textVal !== null) {
          action = { type: 'keyboard_type', text: textVal };
        } else {
          message = fallbackDoneMessage();
          action = { type: 'done', message };
        }
        break;
      }
      case 'sandbox_exec': {
        const cmdVal = typeof parsed.command === 'string' ? parsed.command.trim() : '';
        if (cmdVal) {
          action = {
            type: 'sandbox_exec',
            command: cmdVal,
            requireCheckpoint: parsed.requireCheckpoint ?? true,
          };
        } else {
          message = fallbackDoneMessage();
          action = { type: 'done', message };
        }
        break;
      }
      case 'n8n_execute': {
        const workflow = parsed.workflow || parsed.action || parsed.name || 'general_task';
        action = {
          type: 'n8n_execute',
          workflow: String(workflow),
          payload: typeof parsed.payload === 'object' && parsed.payload !== null ? parsed.payload : {},
          summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
        };
        break;
      }
      case 'mcp_call': {
        const tool = parsed.tool || parsed.toolName || parsed.name || 'search_workflows';
        action = {
          type: 'mcp_call',
          tool: String(tool),
          arguments: typeof parsed.arguments === 'object' && parsed.arguments !== null
            ? parsed.arguments
            : typeof parsed.params === 'object' && parsed.params !== null
            ? parsed.params
            : {},
          server: typeof parsed.server === 'string' ? parsed.server : typeof parsed.serverId === 'string' ? parsed.serverId : undefined,
          serverUrl: typeof parsed.serverUrl === 'string' ? parsed.serverUrl : undefined,
          summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
        };
        break;
      }
      case 'done':
      default: {
        const doneMsg = fallbackDoneMessage();
        message = doneMsg;
        action = { type: 'done', message: doneMsg };
        break;
      }
    }

    return { thought, action, message, rawResponse: rawText };
  }

  async planNextMove(
    userPrompt: string,
    screenBase64?: string,
    overrideConfig?: LLMConfig | null,
    executionMode: ExecutionMode = 'computer_use',
    actionHistory: string[] = []
  ): Promise<AgentStepResult> {
    const config = overrideConfig || getStoredLLMConfig();
    const profile = getStoredProfile();
    const pronoun = profile?.pronoun || 'anh';
    const userName = profile?.name || 'Silo';
    const systemPrompt = this.getSystemPrompt();

    const historySection =
      actionHistory.length > 0
        ? `\nLịch sử các bước đã thực hiện trước đó:\n${actionHistory.map((h, i) => `${i + 1}. ${h}`).join('\n')}\nNếu mục tiêu đã đạt được, hãy trả về "type": "done".`
        : '';

    const modeSection =
      executionMode === 'chat'
        ? `\n[CHẾ ĐỘ HIỆN TẠI: CHAT ASSISTANT - TRÒ CHUYỆN TRỰC TIẾP]\nBắt buộc trả về "type": "done" và viết câu trả lời tự nhiên, lễ phép, chi tiết cho ${pronoun} ${userName} vào trường "message". Tuyệt đối KHÔNG trả về mouse_move hay mouse_click trong chế độ Chat.`
        : executionMode === 'sandbox'
        ? `\n[CHẾ ĐỘ HIỆN TẠI: DETONATION SANDBOX]\nƯu tiên dùng "type": "sandbox_exec" nếu cần chạy lệnh kiểm thử cô lập, hoặc "type": "done" nếu trả lời trực tiếp.`
        : '';

    const userInstruction =
      `Yêu cầu hiện tại của ${pronoun} ${userName}: "${userPrompt}"${modeSection}${historySection}\n` +
      `Hãy trả về DUY NHẤT 1 JSON object hợp lệ có khóa "type" ("done" | "mouse_move" | "mouse_click" | "keyboard_type" | "sandbox_exec" | "n8n_execute" | "mcp_call"), "thought" và "message".\n` +
      `Ví dụ phản hồi chuẩn: {"type": "done", "thought": "Đã phân tích yêu cầu của ${pronoun} ${userName}", "message": "Dạ chào ${pronoun} ${userName}! Em có thể hỗ trợ gì cho ${pronoun} ạ?"}`;

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

      // Luôn đính kèm ảnh đã cắt data URI khi có screenBase64; Rust ollama_chat sẽ tự kiểm tra
      // is_ollama_vision_model sau khi phân giải model ("auto" -> model lớn nhất) để giữ hoặc bỏ images.
      const strippedImage = screenBase64
        ? screenBase64.replace(/^data:[^;]+;base64,/i, '')
        : undefined;

      const userMsg: any = { role: 'user', content: userInstruction };
      if (strippedImage) {
        userMsg.images = [strippedImage];
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

          const finalHttpModel = resolvedHttpModel || "qwen2.5-coder:14b";
          const httpIsVision = /vision|vl|llava|minicpm|bakllava|gemma3|pixtral|moondream/i.test(finalHttpModel);

          const httpRes = await fetch("http://127.0.0.1:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: finalHttpModel,
              messages: msgs.map((m) => ({
                role: m.role,
                content: m.content,
                ...(httpIsVision && m.images ? { images: m.images } : {}),
              })),
              stream: false,
              format: "json",
              options: {
                num_gpu: (config?.maxPower ?? true) ? 999 : -1,
                num_ctx: (config?.maxPower ?? true) ? 4096 : 2048,
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

    const result = this.preprocessAndParseLLMOutput(replyContent);
    if (executionMode === 'chat' && result.action.type !== 'done') {
      result.action = { type: 'done', message: result.message || result.thought };
    }
    return result;
  }

  private async callCloudFetchFallback(
    provider: string,
    apiKey: string,
    rawModel: string | undefined,
    systemPrompt: string,
    userInstruction: string,
    screenBase64?: string
  ): Promise<string> {
    const imgMime =
      screenBase64 && screenBase64.trimStart().startsWith('data:image/png')
        ? 'image/png'
        : 'image/jpeg';

    if (provider === 'gemini') {
      const model =
        rawModel && rawModel.toLowerCase().includes('gemini')
          ? rawModel.replace(/^models\//, '')
          : 'gemini-2.5-flash';
      const encodedKey = encodeURIComponent(apiKey);
      const parts: any[] = [{ text: userInstruction }];

      if (screenBase64) {
        parts.push({
          inlineData: {
            mimeType: imgMime,
            data: screenBase64.replace(/^data:[^;]+;base64,/i, ''),
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
      const isReasoning = /^(o1|o3|o4)/i.test(model);
      const userContent: any[] = [{ type: "text", text: userInstruction }];
      if (screenBase64) {
        const cleanB64 = screenBase64.replace(/^data:[^;]+;base64,/i, '');
        userContent.push({
          type: "image_url",
          image_url: { url: `data:${imgMime};base64,${cleanB64}` },
        });
      }

      const bodyPayload: Record<string, any> = {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      };
      if (!isReasoning) {
        bodyPayload.response_format = { type: "json_object" };
        bodyPayload.temperature = 0.2;
      }

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(bodyPayload),
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
            media_type: imgMime,
            data: screenBase64.replace(/^data:[^;]+;base64,/i, ''),
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
        if (typeof action.x === 'number' && typeof action.y === 'number') {
          await commands.moveMouseBezier(action.x, action.y);
        }
        return await commands.mouseClick(action.button);
      case 'keyboard_type':
        return await commands.sendKeystroke(action.text);
      case 'sandbox_exec':
        return await commands.execInSandbox(action.command);
      case 'n8n_execute': {
        const n8nConfig = getStoredN8nConfig();
        if (!n8nConfig.enabled) {
          throw new Error("Tích hợp n8n Webhook đang bị tắt trong Cài đặt.");
        }
        const webhookUrl = n8nConfig.webhookUrl || "https://siloneedsleep.app.n8n.cloud/webhook/orbis-bridge";
        const authToken = n8nConfig.apiKey || undefined;
        return await commands.triggerN8nWebhook({
          webhookUrl,
          action: action.workflow,
          payload: {
            workflow: action.workflow,
            ...(action.payload || {}),
            summary: action.summary,
          },
          authToken,
        });
      }
      case 'mcp_call': {
        const servers = getStoredMcpServers().filter((s) => s.enabled);
        if (servers.length === 0 && !action.serverUrl) {
          throw new Error("Không có máy chủ MCP nào đang bật trong Cài đặt.");
        }

        const serverKey = action.server?.trim().toLowerCase();
        const targetServer =
          (action.serverUrl ? servers.find((s) => s.serverUrl === action.serverUrl) : undefined) ||
          (serverKey
            ? servers.find(
                (s) =>
                  s.id.toLowerCase() === serverKey ||
                  s.name.toLowerCase() === serverKey ||
                  s.name.toLowerCase().includes(serverKey)
              )
            : undefined) ||
          servers[0];

        if (targetServer && targetServer.type === 'stdio' && !targetServer.serverUrl && !action.serverUrl) {
          throw new Error(`Máy chủ MCP "${targetServer.name}" là kiểu STDIO cục bộ và chưa có HTTP endpoint.`);
        }

        const serverUrl =
          action.serverUrl ||
          targetServer?.serverUrl ||
          "https://siloneedsleep.app.n8n.cloud/mcp-server/http";
        const authToken = targetServer?.authToken || undefined;
        return await commands.callMcpTool({
          serverUrl,
          toolName: action.tool,
          arguments: action.arguments,
          authToken,
          customHeaders: targetServer?.headers,
        });
      }
      case 'done':
        return action.message;
    }
  }
}
