export type AgentAction = 
  | { type: 'mouse_move', x: number, y: number }
  | { type: 'mouse_click', button: 'left' | 'right' }
  | { type: 'keyboard_type', text: string }
  | { type: 'done', message: string };

export class AgentBrain {
  private systemPrompt = `Bạn là Orbis Agent. Nhiệm vụ của bạn là điều khiển máy tính.
  Dựa vào yêu cầu của user và tọa độ màn hình hiện tại, trả về ĐÚNG 1 JSON object chứa action.
  Format: {"action": "mouse_move", "x": 100, "y": 200}`;

  async planNextMove(userPrompt: string, screenContext: string): Promise<AgentAction> {
    // Chỗ này sẽ call API Gemini/Claude/Ollama thực tế. Giả lập logic trả về:
    console.log("Analyzing screen context...", screenContext);
    
    if (userPrompt.includes("click")) {
      return { type: 'mouse_click', button: 'left' };
    }
    return { type: 'done', message: 'Đã hoàn thành phân tích' };
  }

  executeAction(action: AgentAction) {
    // Bắn command xuống Rust qua Tauri IPC
    // import { invoke } from '@tauri-apps/api/core';
    // invoke('execute_os_action', { action });
    console.log("Executing OS Action:", action);
  }
}
