import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";

export const EVENTS = {
  wake: "orbis:wake",
  demo: "orbis:demo",
  petState: "orbis:pet_state",
} as const;

export type DemoAction = "think" | "idle" | "fly";

export interface DemoPayload {
  action: DemoAction;
}

export type PetActionState = 'idle' | 'sleep' | 'wake' | 'thinking' | 'executing' | 'done' | 'feed' | 'drink' | 'petting';

export interface PetEventPayload {
  state: PetActionState;
  message?: string;
}

export const events = {
  /** Giống nhấn hotkey: bật/tắt The Core hoặc gọi mèo. */
  wake: () => emit(EVENTS.wake),
  demo: (action: DemoAction) => emit(EVENTS.demo, { action } satisfies DemoPayload),
  emitPetState: (payload: PetEventPayload) => emit(EVENTS.petState, payload),

  onWake: (cb: () => void): Promise<UnlistenFn> => listen(EVENTS.wake, () => cb()),
  onDemo: (cb: (payload: DemoPayload) => void): Promise<UnlistenFn> =>
    listen<DemoPayload>(EVENTS.demo, (e) => cb(e.payload)),
  onPetState: (cb: (payload: PetEventPayload) => void): Promise<UnlistenFn> =>
    listen<PetEventPayload>(EVENTS.petState, (e) => cb(e.payload)),
};

