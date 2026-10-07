export type AgentAction = 
  | { type: 'mouse_move', x: number, y: number }
  | { type: 'mouse_click', button: 'left' | 'right' }
  | { type: 'keyboard_type', text: string }
  | { type: 'sandbox_exec', command: string, requireCheckpoint: boolean }
  | { type: 'done', message: string };

export class AgentBrain {
  private systemPrompt = `Bạn là Orbis Agent. Nhiệm vụ của bạn là điều khiển máy tính an toàn.
  Nếu phát hiện lệnh nguy hiểm hoặc không an toàn, yêu cầu thực thi trong Sandbox (sandbox_exec).
  Format: {"action": "sandbox_exec", "command": "python script.py", "requireCheckpoint": true}`;

  async planNextMove(userPrompt: string, screenContext: string): Promise<AgentAction> {
    console.log("Analyzing screen context...", screenContext);
    
    if (userPrompt.includes("run untrusted") || userPrompt.includes("test")) {
      return { 
        type: 'sandbox_exec', 
        command: 'Get-Process', 
        requireCheckpoint: true 
      };
    }

    if (userPrompt.includes("click")) {
      return { type: 'mouse_click', button: 'left' };
    }

    return { type: 'done', message: 'Tác vụ an toàn đã hoàn thành' };
  }

  executeAction(action: AgentAction) {
    console.log("Executing OS Action:", action);
  }
}
