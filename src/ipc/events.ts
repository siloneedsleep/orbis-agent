import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";

export const EVENTS = {
  wake: "orbis:wake",
  demo: "orbis:demo",
} as const;

export type DemoAction = "think" | "idle" | "fly";

export interface DemoPayload {
  action: DemoAction;
}

export const events = {
  /** Giống nhấn hotkey: bật/tắt The Core. */
  wake: () => emit(EVENTS.wake),
  demo: (action: DemoAction) => emit(EVENTS.demo, { action } satisfies DemoPayload),

  onWake: (cb: () => void): Promise<UnlistenFn> => listen(EVENTS.wake, () => cb()),
  onDemo: (cb: (payload: DemoPayload) => void): Promise<UnlistenFn> =>
    listen<DemoPayload>(EVENTS.demo, (e) => cb(e.payload)),
};
