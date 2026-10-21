import { commands } from "@/ipc/commands";
import { getStoredProfile, getStoredLLMConfig, buildSystemPrompt } from "@/state/agentStore";

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
}

export class AgentBrain {
  private getSystemPrompt(): string {
    const profile = getStoredProfile();
    return buildSystemPrompt(profile);
  }

  async planNextMove(userPrompt: string, screenBase64?: string): Promise<AgentStepResult> {
    const config = getStoredLLMConfig();
    const systemPrompt = this.getSystemPrompt();
    const prompt = `${systemPrompt}\n\nYêu cầu hiện tại của người dùng: "${userPrompt}"\n\nHãy phân tích màn hình (nếu có) và trả về kế hoạch hành động theo cấu trúc JSON.`;

    let replyContent = "";

    // 1. Local Ollama
    if (!config || config.type === 'local' || config.provider === 'ollama') {
      try {
        const targetModel = config?.model === 'auto' ? undefined : config?.model;
        const isVision = targetModel ? /vision|vl|llava|minicpm|bakllava/i.test(targetModel) : false;
        
        const userMsg: any = { role: 'user', content: prompt };
        if (screenBase64 && isVision) {
          userMsg.images = [screenBase64.replace(/^data:image\/[a-z]+;base64,/, '')];
        }

        const msgs: any[] = [
          { role: 'system', content: systemPrompt },
          userMsg
        ];
        const res = await commands.ollamaChat(msgs, {
          model: targetModel,
          maxPower: config?.maxPower ?? true
        });
        replyContent = res.content;
      } catch (err) {
        console.warn("Ollama call failed, checking fallback:", err);
        throw new Error(`Không gọi được Ollama: ${err}`);
      }
    } 
    // 2. DeepSeek API
    else if (config.provider === 'deepseek') {
      const apiKey = config.apiKey || localStorage.getItem('orbis_deepseek_key') || '';
      if (!apiKey) throw new Error("Chưa nhập DeepSeek API Key");

      const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: config.model || "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" }
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || "DeepSeek API Error");
      replyContent = data.choices[0].message.content;
    }
    // 3. Gemini API
    else if (config.provider === 'gemini') {
      const apiKey = config.apiKey || localStorage.getItem('orbis_gemini_key') || '';
      if (!apiKey) throw new Error("Chưa nhập Gemini API Key");

      const model = config.model || "gemini-2.0-flash";
      const parts: any[] = [{ text: prompt }];
      if (screenBase64) {
        parts.push({
          inline_data: {
            mime_type: "image/jpeg",
            data: screenBase64.replace(/^data:image\/[a-z]+;base64,/, '')
          }
        });
      }

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || "Gemini API Error");
      replyContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }
    // 4. OpenAI API
    else if (config.provider === 'openai') {
      const apiKey = config.apiKey || '';
      if (!apiKey) throw new Error("Chưa nhập OpenAI API Key");

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: config.model || "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ]
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || "OpenAI API Error");
      replyContent = data.choices[0].message.content;
    }

    return this.parseResponse(replyContent);
  }

  private parseResponse(text: string): AgentStepResult {
    let thought = "Đang xử lý yêu cầu...";
    let action: AgentAction = { type: 'done', message: 'Tác vụ hoàn tất' };
    let message = "Đã hoàn thành.";

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.thought) thought = parsed.thought;
        if (parsed.message) message = parsed.message;

        switch (parsed.action) {
          case 'mouse_move':
            action = { type: 'mouse_move', x: parsed.params?.x ?? parsed.x ?? 100, y: parsed.params?.y ?? parsed.y ?? 100 };
            break;
          case 'mouse_click':
            action = { type: 'mouse_click', button: parsed.params?.button ?? parsed.button ?? 'left' };
            break;
          case 'keyboard_type':
            action = { type: 'keyboard_type', text: parsed.params?.text ?? parsed.text ?? '' };
            break;
          case 'sandbox_exec':
            action = { type: 'sandbox_exec', command: parsed.params?.command ?? parsed.command ?? '', requireCheckpoint: true };
            break;
          case 'done':
          default:
            action = { type: 'done', message: parsed.message || 'Hoàn tất bước này.' };
            break;
        }
      } else {
        message = text;
      }
    } catch {
      message = text;
    }

    return { thought, action, message, rawResponse: text };
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
