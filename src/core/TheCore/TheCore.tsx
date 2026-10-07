import { memo, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { arcPath, type Point } from "./arcPath";

export type CoreState = "idle" | "thinking" | "flying";
export type Privilege = "user" | "admin" | "error";

export interface TheCoreProps {
  state: CoreState;
  privilege?: Privilege;
  /** Góc trên-trái của Core (px, theo toạ độ overlay). */
  position: Point;
  /** Bắt buộc khi state === "flying". Thiếu thì Core giữ nguyên tại chỗ. */
  target?: Point;
  size?: number;
  /** Gọi khi chuyến bay kết thúc; parent nên set position = target và state = "idle". */
  onFlyComplete?: () => void;
}

const COLORS: Record<Privilege, string> = {
  user: "#00F0FF",
  admin: "#FACC15",
  error: "#EF4444",
};

const BLOB_RADII = [
  "50% 50% 50% 50% / 50% 50% 50% 50%",
  "62% 38% 55% 45% / 45% 62% 38% 55%",
  "40% 60% 38% 62% / 58% 42% 60% 40%",
  "55% 45% 62% 38% / 38% 55% 45% 62%",
  "50% 50% 50% 50% / 50% 50% 50% 50%",
];

const PHOTONS = [
  { duration: 1.6, orbit: 11, dot: 4, delay: 0 },
  { duration: 2.2, orbit: 14, dot: 3, delay: -0.7 },
  { duration: 2.9, orbit: 17, dot: 3, delay: -1.4 },
] as const;

const SPRING = { type: "spring", stiffness: 260, damping: 26 } as const;

function TheCoreBase({
  state,
  privilege = "user",
  position,
  target,
  size = 32,
  onFlyComplete,
}: TheCoreProps) {
  const reduceMotion = useReducedMotion();
  const color = COLORS[privilege];
  const isFlying = state === "flying" && target !== undefined;
  const isThinking = state === "thinking";

  const flight = useMemo(
    () => (isFlying && target ? arcPath(position, target) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isFlying, position.x, position.y, target?.x, target?.y],
  );

  // --- Wrapper: vị trí ---
  const wrapperAnimate = flight
    ? { x: flight.xs, y: flight.ys }
    : { x: position.x, y: position.y };

  const wrapperTransition = flight
    ? { duration: reduceMotion ? 0.01 : flight.duration, ease: "linear" as const }
    : SPRING;

  // --- Core: hình dạng + glow theo state ---
  const glow = (spread: number, alpha: string) =>
    `0 0 ${spread}px ${Math.round(spread / 4)}px ${color}${alpha}`;

  const coreAnimate = (() => {
    if (reduceMotion) {
      return { backgroundColor: color, boxShadow: glow(12, "88"), scale: 1 };
    }
    if (isThinking) {
      return {
        backgroundColor: color,
        borderRadius: BLOB_RADII,
        scale: [1, 1.12, 0.96, 1.08, 1],
        boxShadow: [glow(14, "88"), glow(22, "bb"), glow(14, "88")],
      };
    }
    if (isFlying) {
      return {
        backgroundColor: color,
        borderRadius: BLOB_RADII[0],
        scale: [1, 0.8, 1],
        boxShadow: glow(26, "cc"),
      };
    }
    return {
      backgroundColor: color,
      borderRadius: BLOB_RADII[0],
      scale: [1, 1.08, 1],
      boxShadow: [glow(10, "66"), glow(18, "aa"), glow(10, "66")],
    };
  })();

  const coreTransition = reduceMotion
    ? { duration: 0.01 }
    : isThinking
      ? { duration: 3.2, ease: "easeInOut" as const, repeat: Infinity }
      : isFlying
        ? { duration: flight?.duration ?? 0.6, ease: "easeInOut" as const }
        : { duration: 2.6, ease: "easeInOut" as const, repeat: Infinity };

  const tailLength = size * 2.4;

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-0 top-0"
      style={{ width: size, height: size }}
      // initial = vị trí xuất phát: nếu mount ngay ở state "flying" thì chuyến bay vẫn chạy từ `position`.
      initial={{ x: position.x, y: position.y }}
      animate={wrapperAnimate}
      transition={wrapperTransition}
      onAnimationComplete={() => {
        if (isFlying) onFlyComplete?.();
      }}
    >
      {/* Vệt sáng khi bay: mount theo từng chuyến để animation chạy lại */}
      {flight && !reduceMotion && (
        <div
          className="absolute left-1/2 top-1/2"
          style={{ width: 0, height: 0, transform: `rotate(${flight.angleDeg}deg)` }}
        >
          <motion.div
            key={`${position.x}:${position.y}->${target?.x}:${target?.y}`}
            className="absolute right-0"
            style={{
              top: -size * 0.3,
              height: size * 0.6,
              borderRadius: size,
              background: `linear-gradient(to left, ${color}, transparent)`,
              filter: "blur(2px)",
            }}
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: [0, tailLength, 0], opacity: [0, 0.75, 0] }}
            transition={{ duration: flight.duration, ease: "easeInOut" }}
          />
        </div>
      )}

      {/* Photon xoay quanh khi Thinking */}
      {isThinking &&
        !reduceMotion &&
        PHOTONS.map((p, i) => (
          <motion.div
            key={i}
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{ duration: p.duration, delay: p.delay, ease: "linear", repeat: Infinity }}
          >
            <span
              className="absolute rounded-full"
              style={{
                width: p.dot,
                height: p.dot,
                left: "50%",
                top: -(p.orbit - size / 2),
                marginLeft: -p.dot / 2,
                background: color,
                boxShadow: `0 0 6px 1px ${color}`,
              }}
            />
          </motion.div>
        ))}

      <motion.div
        className="h-full w-full"
        style={{ willChange: "transform, border-radius" }}
        animate={coreAnimate}
        transition={coreTransition}
      />
    </motion.div>
  );
}

export const TheCore = memo(TheCoreBase);
