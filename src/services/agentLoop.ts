import { commands } from "@/ipc/commands";

export type AgentAction = 
  | { type: 'mouse_move', x: number, y: number }
  | { type: 'mouse_click', button: 'left' | 'right' }
  | { type: 'keyboard_type', text: string }
  | { type: 'sandbox_exec', command: string, requireCheckpoint: boolean }
  | { type: 'done', message: string };

export class AgentBrain {
  private systemPrompt = `Bạn là Orbis Agent, một AI điều khiển Desktop Windows. 
  Bạn nhận được ảnh chụp màn hình và yêu cầu người dùng.
  Hãy suy luận và trả về hành động tiếp theo dưới dạng JSON nghiêm ngặt:
  { "action": "mouse_move", "x": 100, "y": 200 }
  { "action": "mouse_click", "button": "left" }
  { "action": "keyboard_type", "text": "Hello" }
  { "action": "sandbox_exec", "command": "...", "requireCheckpoint": true }
  { "action": "done", "message": "Hoàn thành" }
  
  Nguyên tắc an toàn: Nếu lệnh yêu cầu thực thi mã, cài đặt phần mềm hoặc can thiệp hệ thống, BẮT BUỘC dùng sandbox_exec.`;

  private async callGemini(prompt: string, imageBase64: string): Promise<string> {
    const apiKey = localStorage.getItem('orbis_gemini_key');
    if (!apiKey) throw new Error("Thiếu Gemini API Key");

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: "image/jpeg", data: imageBase64.split(',')[1] } }
          ]
        }]
      })
    });
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  async planNextMove(userPrompt: string, screenContext: string): Promise<AgentAction> {
    const prompt = `${this.systemPrompt}\n\nUser Request: ${userPrompt}`;
    
    try {
      // 1. Try Ollama Local first
      console.log("Attempting local inference with Ollama...");
      const ollamaResponse = await commands.ollamaChat([
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: prompt, images: [screenContext.split(',')[1]] }
      ]);
      
      const action = this.parseAction(ollamaResponse.content);
      if (action) return action;
    } catch (e) {
      console.warn("Ollama failed or not available, falling back to Gemini...", e);
    }

    try {
      // 2. Fallback to Gemini Cloud
      console.log("Falling back to Gemini Cloud...");
      const geminiResponse = await this.callGemini(prompt, screenContext);
      const action = this.parseAction(geminiResponse);
      if (action) return action;
    } catch (e) {
      console.error("Gemini fallback also failed:", e);
    }

    return { type: 'done', message: 'Không thể xác định hành động tiếp theo.' };
  }

  private parseAction(text: string): AgentAction | null {
    try {
      const jsonMatch = text.match(/\{.*\}/s);
      if (!jsonMatch) return null;
      const parsed = JSON.parse(jsonMatch[0]);
      
      switch (parsed.action) {
        case 'mouse_move': return { type: 'mouse_move', x: parsed.x, y: parsed.y };
        case 'mouse_click': return { type: 'mouse_click', button: parsed.button };
        case 'keyboard_type': return { type: 'keyboard_type', text: parsed.text };
        case 'sandbox_exec': return { type: 'sandbox_exec', command: parsed.command, requireCheckpoint: parsed.requireCheckpoint };
        case 'done': return { type: 'done', message: parsed.message };
        default: return null;
      }
    } catch {
      return null;
    }
  }

  async executeAction(action: AgentAction) {
    console.log("Executing OS Action:", action);
    switch (action.type) {
      case 'mouse_move': 
        await commands.moveMouseBezier(action.x, action.y); 
        break;
      case 'mouse_click': 
        await commands.mouseClick(action.button); 
        break;
      case 'keyboard_type': 
        await commands.sendKeystroke(action.text); 
        break;
      case 'sandbox_exec': 
        // Implementation for sandbox execution
        console.log("Executing in sandbox:", action.command);
        break;
      case 'done': 
        console.log("Task completed:", action.message);
        break;
    }
  }
}
