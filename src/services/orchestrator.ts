import { AgentBrain, AgentAction } from "./agentLoop";
import { commands } from "@/ipc/commands";

export class OrbisOrchestrator {
  private brain = new AgentBrain();
  private isRunning = false;

  async startTask(goal: string) {
    this.isRunning = true;
    console.log("Starting task:", goal);

    while (this.isRunning) {
      try {
        // 1. Perceive: Capture screen
        // For simplicity, capture full screen or specific region. 
        // Here we capture the primary monitor region.
        const layout = await commands.getOverlayLayout();
        const primary = layout.monitors.find(m => m.primary) || layout.monitors[0];
        
        const screenContext = await commands.captureScreenRegion(
          primary.x, primary.y, primary.width, primary.height
        );

        const step = await this.brain.planNextMove(goal, screenContext);
        
        if (step.action.type === 'done') {
          console.log("Task completed:", step.message);
          this.isRunning = false;
          break;
        }

        // 3. Act: Execute
        await this.brain.executeAction(step.action);
        
        // Small delay between steps to avoid overloading
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.error("Loop error:", e);
        this.isRunning = false;
        break;
      }
    }
  }

  stop() {
    this.isRunning = false;
  }
}
