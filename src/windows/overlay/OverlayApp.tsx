import React, { useEffect, useState } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { CyberCat, CatActionState } from "@/components/CyberCat/CyberCat";
import { commands } from "@/ipc/commands";
import { events } from "@/ipc/events";

export function OverlayApp() {
  const [catAction, setCatAction] = useState<CatActionState>('idle');
  const [customMsg, setCustomMsg] = useState<string | undefined>(undefined);

  useEffect(() => {
    let disposed = false;
    const unlisteners: UnlistenFn[] = [];
    const track = (pending: Promise<UnlistenFn>) =>
      pending
        .then((un) => (disposed ? un() : unlisteners.push(un)))
        .catch(() => {});

    // Lắng nghe sự kiện wake (hotkey Ctrl+Alt+Space hoặc tray)
    track(
      events.onWake(() => {
        setCatAction((prev) => (prev === 'sleep' ? 'wake' : 'sleep'));
      })
    );

    // Lắng nghe sự kiện từ Dashboard và Agent Loop
    track(
      events.onPetState(({ state, message }) => {
        setCatAction(state);
        if (message) setCustomMsg(message);
      })
    );

    track(
      events.onDemo(({ action }) => {
        if (action === "think") setCatAction("thinking");
        else if (action === "idle") setCatAction("idle");
      })
    );

    return () => {
      disposed = true;
      unlisteners.forEach((un) => un());
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden select-none">
      {/* Viền sáng Accent vi tính khi Agent đang thao tác máy */}
      <div 
        className={`absolute inset-0 pointer-events-none border-2 transition-opacity duration-300 ${
          catAction === 'executing' 
            ? 'border-amber-400/50 opacity-100 shadow-[inset_0_0_25px_rgba(251,191,36,0.2)]' 
            : catAction === 'thinking'
            ? 'border-cyan-500/40 opacity-80 shadow-[inset_0_0_15px_rgba(0,240,255,0.15)]'
            : 'border-transparent opacity-0'
        }`} 
      />

      {/* Mèo Xanh Cyber Cat trên Desktop */}
      <CyberCat 
        actionState={catAction}
        customMessage={customMsg}
        onOpenDashboard={() => commands.openDashboard().catch(() => {})}
      />
    </div>
  );
}
