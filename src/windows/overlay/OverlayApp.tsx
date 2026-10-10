import { useEffect, useReducer, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { TheCore } from "@/core/TheCore";
import { CoreMover } from "@/core/TheCore/CoreMover";
import { coreReducer, initialCoreModel } from "@/state/coreMachine";
import {
  centerOf, dockOf, nextFlightTarget, pickPrimary,
  toCssMonitors, viewportMonitor, type CssMonitor,
} from "@/state/geometry";
import { commands } from "@/ipc/commands";
import { events } from "@/ipc/events";

const CORE_BOX = 200;

export function OverlayApp() {
  const [model, dispatch] = useReducer(coreReducer, initialCoreModel);
  const modelRef = useRef(model); modelRef.current = model;
  const monitorsRef = useRef<CssMonitor[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [layout, sys] = await Promise.all([
          commands.getOverlayLayout(), commands.getSystemInfo(),
        ]);
        if (cancelled) return;
        monitorsRef.current = toCssMonitors(layout.monitors, window.devicePixelRatio);
        dispatch({ type: "SET_PRIVILEGE", privilege: sys.isAdmin ? "admin" : "standard" });
      } catch (err) { console.error("[orbis] load layout/quyền:", err); }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let disposed = false;
    const unlisteners: UnlistenFn[] = [];
    const track = (p: Promise<UnlistenFn>) =>
      p.then((un) => (disposed ? un() : unlisteners.push(un)))
       .catch((err) => console.error("[orbis] listen lỗi:", err));
    const monitors = () =>
      (monitorsRef.current.length ? monitorsRef.current : [viewportMonitor()]);

    track(events.onWake(() => {
      const primary = pickPrimary(monitors());
      dispatch({ type: "TOGGLE",
        dock: dockOf(primary, CORE_BOX), home: centerOf(primary, CORE_BOX) });
    }));
    track(events.onDemo(({ action }) => {
      if (action === "think") dispatch({ type: "THINK" });
      else if (action === "idle") dispatch({ type: "IDLE" });
      else dispatch({ type: "FLY_TO",
        target: nextFlightTarget(modelRef.current.position, monitors(), CORE_BOX) });
    }));
    return () => { disposed = true; unlisteners.forEach((un) => un()); };
  }, []);

  const awake = model.state !== "sleeping";
  return (
    <div className="fixed inset-0 overflow-hidden">
      <AnimatePresence>
        {awake && (
          <motion.div key="core-layer" className="absolute inset-0"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0.9, 0.2, 1] }}
          >
            <CoreMover position={model.position} target={model.target}
              flying={model.state === "sonic_flying"}
              onFlyComplete={() => dispatch({ type: "LANDED" })}
            >
              <TheCore state={model.state} privilege={model.privilege} size={96} />
            </CoreMover>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
