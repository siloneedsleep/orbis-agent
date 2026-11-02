import { Channel, convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core';
import type { WorkstreamItem } from './agentStore';

export interface FrameRef { frameId: string; width: number; height: number; originX: number; originY: number; monitorScale: number }
export interface GroundedElement { id: number; name: string; controlType: string; x: number; y: number; width: number; height: number }
export interface DagNode { id: string; goal: string; role: string; dependsOn: string[]; status: string }
export interface OrbisSnapshot {
  seq: number; status: 'idle' | 'thinking' | 'executing' | 'awaiting_approval' | 'done' | 'error' | 'stopped';
  stage: 'analyzing' | 'planning' | 'executing' | 'verifying' | null;
  route: string; message: string; taskId: string | null; workstream: WorkstreamItem[];
  lastFrame: FrameRef | null; elements: GroundedElement[]; dag: DagNode[];
  settings: Record<string, string>; bridgeError?: string;
}
let snapshot: OrbisSnapshot = { seq: 0, status: 'idle', stage: null, route: 'reflex', message: 'Sẵn sàng', taskId: null, workstream: [], lastFrame: null, elements: [], dag: [], settings: {} };
const listeners = new Set<() => void>();
const preferenceListeners = new Set<() => void>();
const optimistic = new Map<string, { value: string | null; count: number }>();
let queue: Promise<void> = Promise.resolve();
let saveError: unknown;
let initialization: Promise<void> | undefined;
let stream: Channel<BridgeEvent> | undefined;
type BridgeEvent = { type: 'snapshot'; snapshot: OrbisSnapshot } | { type: 'state'; seq: number; delta: Partial<OrbisSnapshot> } | { type: 'item'; seq: number; item: WorkstreamItem } | { type: 'setting'; seq: number; key: string; value: string | null };
const emit = () => listeners.forEach(listener => listener());
const emitPreferences = () => preferenceListeners.forEach(listener => listener());

function receive(event: BridgeEvent) {
  if (event.type === 'snapshot') { snapshot = event.snapshot; emitPreferences(); }
  else if (event.seq <= snapshot.seq) return;
  else if (event.type === 'state') snapshot = { ...snapshot, ...event.delta, seq: event.seq };
  else if (event.type === 'item') {
    const index = snapshot.workstream.findIndex(item => item.id === event.item.id);
    const items = [...snapshot.workstream];
    if (index < 0) items.push(event.item); else items[index] = event.item;
    snapshot = { ...snapshot, seq: event.seq, workstream: items.slice(-300) };
  } else {
    const settings = { ...snapshot.settings };
    if (event.value === null) delete settings[event.key]; else settings[event.key] = event.value;
    snapshot = { ...snapshot, seq: event.seq, settings };
    emitPreferences();
  }
  emit();
}

export function initializeOrbis(): Promise<void> {
  return initialization ??= (async () => {
    if (!isTauri()) return;
    stream = new Channel<BridgeEvent>(); stream.onmessage = receive;
    await invoke('subscribe_agent', { channel: stream });
    // Legacy storage is read once; subsequent writes and cross-window sync use Rust.
    const values: Record<string, string> = {};
    if (!snapshot.settings.orbis_migrated_v1) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key?.startsWith('orbis_')) { const value = window.localStorage.getItem(key); if (value !== null) values[key] = value; }
      }
      await invoke('import_legacy_settings', { values });
    }
  })();
}

export const preferences = {
  getItem(key: string): string | null { return optimistic.has(key) ? optimistic.get(key)!.value : snapshot.settings[key] ?? null; },
  setItem(key: string, value: string) { writePreference(key, value); },
  removeItem(key: string) { writePreference(key, null); },
};
function writePreference(key: string, value: string | null) {
  if (!isTauri()) { const settings = { ...snapshot.settings }; if (value === null) delete settings[key]; else settings[key] = value; snapshot = { ...snapshot, settings }; emitPreferences(); emit(); return; }
  optimistic.set(key, { value, count: (optimistic.get(key)?.count ?? 0) + 1 });
  emitPreferences();
  queue = queue.then(async () => {
    try { await invoke('put_setting', { key, value }); }
    catch (error) { saveError = error; snapshot = { ...snapshot, bridgeError: `Không lưu được cấu hình: ${String(error)}` }; emit(); }
    finally { const pending = optimistic.get(key); if (pending && --pending.count === 0) optimistic.delete(key); emitPreferences(); }
  });
}
export async function flushPreferences() { await queue; if (saveError) { const error = saveError; saveError = undefined; throw error; } }
export const subscribePreferences = (listener: () => void) => { preferenceListeners.add(listener); return () => { preferenceListeners.delete(listener); }; };
export const subscribeOrbis = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getOrbisSnapshot = () => snapshot;
export const mediaUrl = (path: string) => {
  const base = isTauri() ? convertFileSrc('', 'orbis') : 'http://orbis.localhost/';
  return `${base.replace(/\/$/, '')}/${path.split('/').filter(Boolean).map(encodeURIComponent).join('/')}`;
};
export const frameUrl = (frame: FrameRef | string) => mediaUrl(`/frame/${typeof frame === 'string' ? frame : frame.frameId}`);
export async function startAgent(goal: string, mode = 'computer_use', route?: string) {
  if (!isTauri()) throw new Error('Hãy chạy bản desktop bằng npm run tauri dev để thực thi tác vụ.');
  await flushPreferences();
  return invoke<string>('start_agent', { request: { goal, mode, route } });
}
export const stopAgent = () => invoke<void>('stop_agent');
export const approveAction = (id: string, approved: boolean) => invoke<void>('approve_action', { id, approved });
export const clearWorkstream = () => invoke<void>('clear_workstream');
