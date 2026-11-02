import { startAgent, stopAgent } from '@/state/orbisBridge';
export class OrbisOrchestrator {
  startTask(goal: string) { return startAgent(goal); }
  stop() { return stopAgent(); }
}
