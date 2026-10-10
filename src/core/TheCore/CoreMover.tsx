import { useMemo, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { arcPath, type Point } from "./arcPath";

const SPRING = { type: "spring", stiffness: 220, damping: 24, mass: 0.9 } as const;

interface CoreMoverProps {
  position: Point; target: Point; flying: boolean;
  onFlyComplete?: () => void; children: ReactNode;
}

export function CoreMover({
  position, target, flying, onFlyComplete, children,
}: CoreMoverProps) {
  const reduceMotion = useReducedMotion();
  const flight = useMemo(
    () => (flying ? arcPath(position, target, 32, 0.22) : null),
    [flying, position.x, position.y, target.x, target.y],
  );
  return (
    <motion.div
      className="pointer-events-none absolute left-0 top-0 will-change-transform"
      initial={{ x: position.x, y: position.y }}
      animate={flight ? { x: flight.xs, y: flight.ys }
                      : { x: position.x, y: position.y }}
      transition={flight
        ? { duration: reduceMotion ? 0.01 : flight.duration, ease: "linear" }
        : SPRING}
      onAnimationComplete={() => { if (flying) onFlyComplete?.(); }}
      style={{ transform: "translate3d(0,0,0)" }}
    >
      {children}
    </motion.div>
  );
}
