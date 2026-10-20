import { useEffect, useReducer, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { TheCore } from "@/core/TheCore";
import { CoreMover } from "@/core/TheCore/CoreMover";
import { coreReducer, initialCoreModel } from "@/state/coreMachine";
import { OnboardingFlow } from "./OnboardingFlow";
import { ChatBar } from "./ChatBar";
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

/** TheCore render trong ô 128×128 (w-32 h-32); toạ độ trong overlay là góc trên-trái của ô này. */
const CORE_BOX = 128;

export function OverlayApp() {
  const [model, dispatch] = useReducer(coreReducer, initialCoreModel);
  const [showOnboarding, setShowOnboarding] = useState(!localStorage.getItem('orbis_onboarded'));
  const [showChat, setShowChat] = useState(false);

  // Handler event nằm trong effect chạy một lần, nên đọc state mới nhất qua ref.
  const modelRef = useRef(model);
  modelRef.current = model;
  const monitorsRef = useRef<CssMonitor[]>([]);

  useEffect(() => {
    if (showOnboarding) {
      commands.setOverlayInteractive(true);
    }
  }, [showOnboarding]);

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
        monitorsRef.current = toCssMonitors(layout.monitors);
        dispatch({ type: "SET_PRIVILEGE", privilege: sys.isAdmin ? "admin" : "standard" });
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
        const willBeAwake = modelRef.current.state === "sleeping";
        dispatch({
          type: "TOGGLE",
          dock: dockOf(primary, CORE_BOX),
          home: centerOf(primary, CORE_BOX),
        });
        if (willBeAwake) {
          setShowChat(true);
          commands.setOverlayInteractive(true);
        } else {
          setShowChat(false);
          commands.setOverlayInteractive(false);
        }
      }),
    );

    track(
      events.onDemo(({ action }) => {
        if (action === "think") dispatch({ type: "THINK" });
        else if (action === "idle") dispatch({ type: "IDLE" });
        else {
          dispatch({
            type: "FLY_TO",
            target: nextFlightTarget(modelRef.current.position, monitors(), CORE_BOX),
          });
        }
      }),
    );

    return () => {
      disposed = true;
      unlisteners.forEach((un) => un());
    };
  }, []);

  const awake = model.state !== "sleeping";

  return (
    <div className="fixed inset-0 overflow-hidden">
      {showOnboarding && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <OnboardingFlow 
            onComplete={(data) => {
              console.log("Onboarding complete:", data);
              localStorage.setItem('orbis_onboarded', 'true');
              setShowOnboarding(false);
              commands.setOverlayInteractive(false);
            }} 
          />
        </div>
      )}
      <ChatBar visible={showChat} onClose={() => {
        setShowChat(false);
        commands.setOverlayInteractive(false);
      }} />
      {/* Ngủ = unmount hẳn: không còn animation nào chạy, overlay 0% GPU. */}
      <AnimatePresence>
        {awake && (
          <motion.div
            key="core-layer"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <CoreMover
              position={model.position}
              target={model.target}
              flying={model.state === "sonic_flying"}
              onFlyComplete={() => dispatch({ type: "LANDED" })}
            >
              <div 
                className="pointer-events-auto cursor-pointer"
                onMouseEnter={() => commands.setOverlayInteractive(true)}
                onMouseLeave={() => {
                  if (!showChat && !showOnboarding) {
                    commands.setOverlayInteractive(false);
                  }
                }}
                onClick={() => { 
                  setShowChat(true); 
                  commands.setOverlayInteractive(true); 
                }}
              >
                <TheCore state={model.state} privilege={model.privilege} />
              </div>
            </CoreMover>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
