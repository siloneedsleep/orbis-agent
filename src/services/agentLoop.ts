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
              : thought || 'Hoàn tất bước này.';
          message = doneMsg;
          action = { type: 'done', message: doneMsg };
          break;
        }
        default: {
          const fallbackMsg =
            typeof parsed.message === 'string' && parsed.message.trim()
              ? parsed.message.trim()
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
    const userInstruction = `Yêu cầu hiện tại của người dùng: "${userPrompt}"\nHãy phân tích màn hình (nếu có) và trả về DUY NHẤT 1 JSON object có khóa "type" khớp định nghĩa AgentAction.`;

    let replyContent = "";
    const isLocalMode = !config || config.mode === 'local' || config.type === 'local' || config.provider === 'ollama';

    // 1. Local Ollama (Mode === "local")
    if (isLocalMode) {
      const targetModel =
        !config?.localModel && !config?.model
          ? undefined
          : (config.localModel || config.model) === 'auto'
          ? undefined
          : config.localModel || config.model;
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
        // Ưu tiên gọi qua IPC Rust (tránh CORS trên WebView, đã ép stream: false & format: "json")
        const res = await commands.ollamaChat(msgs, {
          model: targetModel,
          maxPower: config?.maxPower ?? true,
        });
        replyContent = res.content;
      } catch (ipcErr) {
        console.warn("IPC ollamaChat gặp lỗi, thử gọi HTTP fallback tới 127.0.0.1:11434/api/chat...", ipcErr);
        try {
          await commands.startOllamaServer().catch(() => {});
          const httpRes = await fetch("http://127.0.0.1:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: targetModel || "llama3",
              messages: msgs,
              stream: false,
              format: "json",
              options: {
                num_gpu: 999,
                num_ctx: 32768,
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
          throw new Error(`Không gọi được Local Ollama: ${ipcErr || retryErr?.message || retryErr}`);
        }
      }
    }
    // 2. Cloud API: Gemini
    else if (config.provider === 'gemini') {
      const apiKey = (config.apiKey || localStorage.getItem('orbis_gemini_key') || '').trim();
      if (!apiKey) throw new Error("Chưa cấu hình Gemini API Key trong Cài đặt");

      const rawModel = config.cloudModel || config.model || "gemini-2.0-flash";
      const model = rawModel.replace(/^models\//, "");
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
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents: [{ role: 'user', parts }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2,
            },
          }),
        }
      );

      if (res.status === 429) {
        throw new Error("429 Rate Limit: Gemini API đã chạm giới hạn tần suất.");
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || `Gemini API Error (${res.status})`);
      replyContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }
    // 3. Cloud API: OpenAI
    else if (config.provider === 'openai') {
      const apiKey = (config.apiKey || localStorage.getItem('orbis_openai_key') || '').trim();
      if (!apiKey) throw new Error("Chưa cấu hình OpenAI API Key trong Cài đặt");

      const userContent: any[] = [{ type: "text", text: userInstruction }];
      if (screenBase64) {
        const cleanB64 = screenBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        userContent.push({
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${cleanB64}`,
          },
        });
      }

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: config.cloudModel || config.model || "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        }),
      });

      if (res.status === 429) {
        throw new Error("429 Rate Limit: OpenAI API đã chạm giới hạn tần suất.");
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || "OpenAI API Error");
      replyContent = data.choices?.[0]?.message?.content || "";
    }
    // 4. Cloud API: Claude (Anthropic)
    else if (config.provider === 'claude') {
      const apiKey = (config.apiKey || localStorage.getItem('orbis_claude_key') || '').trim();
      if (!apiKey) throw new Error("Chưa cấu hình Claude API Key trong Cài đặt");

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
          model: config.cloudModel || config.model || "claude-3-5-sonnet-20241022",
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: contentParts }],
        }),
      });

      if (res.status === 429) {
        throw new Error("429 Rate Limit: Claude API đã chạm giới hạn tần suất.");
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || "Claude API Error");
      replyContent = data.content?.[0]?.text || "";
    }
    // 5. Cloud API: DeepSeek
    else if (config.provider === 'deepseek') {
      const apiKey = (config.apiKey || localStorage.getItem('orbis_deepseek_key') || '').trim();
      if (!apiKey) throw new Error("Chưa cấu hình DeepSeek API Key trong Cài đặt");

      const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: config.cloudModel || config.model || "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userInstruction },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        }),
      });

      if (res.status === 429) {
        throw new Error("429 Rate Limit: DeepSeek API đã chạm giới hạn tần suất.");
      }
      const data = await res.json();
      if (data.error) {
        const fallbackRes = await fetch("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: config.cloudModel || config.model || "deepseek-chat",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userInstruction },
            ],
          }),
        });
        const fallbackData = await fallbackRes.json();
        if (fallbackData.error) throw new Error(fallbackData.error.message || "DeepSeek API Error");
        replyContent = fallbackData.choices?.[0]?.message?.content || "";
      } else {
        replyContent = data.choices?.[0]?.message?.content || "";
      }
    }

    return this.preprocessAndParseLLMOutput(replyContent);
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

