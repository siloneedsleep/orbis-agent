import React, { useEffect, useState } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { TheCore } from "@/core/TheCore";
import { commands, SystemInfo } from "@/ipc/commands";
import { events } from "@/ipc/events";

export function OverlayApp() {
  const [awake, setAwake] = useState(false);
  const [state, setState] = useState<'idle' | 'thinking' | 'executing'>('idle');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Load admin privilege
    commands.getSystemInfo()
      .then((sys) => {
        if (!cancelled) setIsAdmin(sys.isAdmin);
      })
      .catch(() => {});

    // Listen to wake & demo events
    let disposed = false;
    const unlisteners: UnlistenFn[] = [];
    const track = (pending: Promise<UnlistenFn>) =>
      pending
        .then((un) => (disposed ? un() : unlisteners.push(un)))
        .catch(() => {});

    track(
      events.onWake(() => {
        setAwake((prev) => !prev);
      })
    );

    track(
      events.onDemo(({ action }) => {
        if (action === "think") setState("thinking");
        else if (action === "idle") setState("idle");
      })
    );

    return () => {
      disposed = true;
      unlisteners.forEach((un) => un());
    };
  }, []);

  if (!awake) return null;

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden select-none">
      {/* Screen Focus Accent Border when active */}
      <div className={`absolute inset-0 pointer-events-none border-2 transition-opacity duration-300 ${
        state === 'executing' 
          ? 'border-amber-400/50 opacity-100 shadow-[inset_0_0_20px_rgba(251,191,36,0.15)]' 
          : 'border-cyan-500/30 opacity-70'
      }`} />

      {/* Floating Status Pill in corner */}
      <div className="absolute bottom-6 right-6 pointer-events-none">
        <TheCore state={state} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
