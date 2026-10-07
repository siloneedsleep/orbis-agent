import { useEffect, useReducer, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { TheCore, type Privilege } from "@/core/TheCore";
import { coreReducer, initialCoreModel } from "@/state/coreMachine";
import {
  centerOf,
  dockOf,
  nextFlightTarget,
  pickPrimary,
  toCssMonitors,
  viewportMonitor,
  type CssMonitor,
} from "@/state/geometry";
import { commands } from "@/ipc/commands";
import { events } from "@/ipc/events";

const CORE_SIZE = 32;

export function OverlayApp() {
  const [model, dispatch] = useReducer(coreReducer, initialCoreModel);
  const [privilege, setPrivilege] = useState<Privilege>("user");

  // Handler event nằm trong effect chạy một lần, nên đọc state mới nhất qua ref.
  const modelRef = useRef(model);
  modelRef.current = model;
  const monitorsRef = useRef<CssMonitor[]>([]);

  // Nạp layout màn hình + quyền (Admin → Core đổi sang vàng).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [layout, sys] = await Promise.all([
          commands.getOverlayLayout(),
          commands.getSystemInfo(),
        ]);
        if (cancelled) return;
        monitorsRef.current = toCssMonitors(layout.monitors, window.devicePixelRatio);
        setPrivilege(sys.isAdmin ? "admin" : "user");
      } catch (err) {
        console.error("[orbis] không nạp được layout/quyền:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Lắng nghe hotkey/tray (wake) và dashboard (demo).
  useEffect(() => {
    let disposed = false;
    const unlisteners: UnlistenFn[] = [];
    const track = (pending: Promise<UnlistenFn>) =>
      pending
        .then((un) => (disposed ? un() : unlisteners.push(un)))
        .catch((err) => console.error("[orbis] listen thất bại:", err));

    const monitors = () => (monitorsRef.current.length ? monitorsRef.current : [viewportMonitor()]);

    track(
      events.onWake(() => {
        const primary = pickPrimary(monitors());
        dispatch({
          type: "toggle",
          dock: dockOf(primary, CORE_SIZE),
          home: centerOf(primary, CORE_SIZE),
        });
      }),
    );

    track(
      events.onDemo(({ action }) => {
        if (action === "think") dispatch({ type: "think" });
        else if (action === "idle") dispatch({ type: "idle" });
        else {
          dispatch({
            type: "flyTo",
            target: nextFlightTarget(modelRef.current.position, monitors(), CORE_SIZE),
          });
        }
      }),
    );

    return () => {
      disposed = true;
      unlisteners.forEach((un) => un());
    };
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Ngủ = unmount hẳn: không còn animation nào chạy, overlay 0% GPU. */}
      <AnimatePresence>
        {model.awake && (
          <motion.div
            key="core-layer"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <TheCore
              state={model.state}
              privilege={privilege}
              position={model.position}
              target={model.target}
              size={CORE_SIZE}
              onFlyComplete={() => dispatch({ type: "landed" })}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
