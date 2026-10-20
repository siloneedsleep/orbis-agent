import { useMemo, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { arcPath, type Point } from "./arcPath";

const SPRING = { type: "spring", stiffness: 260, damping: 26 } as const;

interface CoreMoverProps {
  /** Góc trên-trái của ô The Core (px, toạ độ overlay). Khi bay: điểm xuất phát. */
  position: Point;
  target: Point;
  flying: boolean;
  /** Gọi khi chuyến bay kết thúc; parent dispatch LANDED. */
  onFlyComplete?: () => void;
  children: ReactNode;
}

/** Đặt The Core ở một toạ độ và bay cong (Bézier) tới `target`; TheCore tự lo phần hình dạng/animation. */
export function CoreMover({ position, target, flying, onFlyComplete, children }: CoreMoverProps) {
  const reduceMotion = useReducedMotion();

  const flight = useMemo(
    () => (flying ? arcPath(position, target) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flying, position.x, position.y, target.x, target.y],
  );

  return (
    <motion.div
      className="pointer-events-none absolute left-0 top-0"
      // initial = điểm xuất phát: mount ngay ở trạng thái bay thì chuyến bay vẫn chạy từ `position`.
      initial={{ x: position.x, y: position.y }}
      animate={flight ? { x: flight.xs, y: flight.ys } : { x: position.x, y: position.y }}
      transition={
        flight
          ? ({ duration: reduceMotion ? 0.01 : flight.duration, ease: "linear" } as const)
          : SPRING
      }
      onAnimationComplete={() => {
        if (flying) onFlyComplete?.();
      }}
    >
      {children}
    </motion.div>
  );
}
