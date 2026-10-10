import React, { useMemo } from "react";
import { motion, type Variants } from "framer-motion";
import type { CoreState, Privilege } from "../../state/coreMachine";
import { useVoicePulse } from "../../hooks/useVoicePulse";

export interface TheCoreProps {
  state: CoreState;
  privilege?: Privilege;
  isAdmin?: boolean;
  size?: number;
}

const COLORS: Record<string, string> = {
  standard: "#00F0FF", admin: "#FACC15",
  quarantine: "#F59E0B", rewind: "#A855F7",
};

export const TheCore: React.FC<TheCoreProps> = ({
  state, privilege = "standard", isAdmin = false, size = 96,
}) => {
  const isHighPerm = isAdmin || privilege === "admin" || privilege === "elevated";
  const coreColor =
    state === "quarantine" ? COLORS.quarantine :
    state === "time_rewind" ? COLORS.rewind :
    isHighPerm ? COLORS.admin : COLORS.standard;
  const audioPulse = useVoicePulse(state === "listening");

  const coreVariants: Variants = useMemo(() => ({
    spawning: { scale: [0.2, 1.15, 1], opacity: 1,
      transition: { duration: 0.6, ease: [0.2, 0.9, 0.2, 1] } },
    idle: { scale: 1, borderRadius: "50%", x: 0, opacity: 1,
      transition: { type: "spring", stiffness: 260, damping: 24 } },
    docked: { scale: 0.78, borderRadius: "12px 50% 50% 12px", x: -12, opacity: 1 },
    listening: {
      scale: 1 + audioPulse * 0.28, borderRadius: "42%", opacity: 0.95,
      boxShadow: `0 0 ${34 + audioPulse * 40}px ${coreColor}, 0 0 ${80 + audioPulse * 60}px ${coreColor}88`,
      transition: { type: "spring", stiffness: 260, damping: 18 },
    },
    thinking: { scale: 0.94, transition: { duration: 0.3 } },
    executing: { scale: [1, 1.08, 1],
      transition: { repeat: Infinity, duration: 0.9, ease: "easeInOut" } },
    sonic_flying: { scale: [1, 0.72, 1],
      transition: { duration: 0.9, ease: "easeInOut" } },
    glitched: { x: [-10, 10, -10, 10, 0], filter: "hue-rotate(90deg)",
      transition: { duration: 0.22 } },
    shielded: { scale: 1.22, boxShadow: `0 0 30px ${coreColor}, inset 0 0 14px #fff` },
    quarantine: { scale: 1.14,
      filter: `drop-shadow(0 0 26px ${COLORS.quarantine})`,
      transition: { repeat: Infinity, repeatType: "reverse", duration: 0.85 } },
    time_rewind: { rotate: -720, scale: [1, 0.7, 1.1, 1],
      transition: { duration: 1.3, ease: "easeInOut" } },
    sleeping: { scale: 0.5, opacity: 0, transition: { duration: 0.4 } },
  }), [audioPulse, coreColor]);

  const halo = size * 2.1;
  return (
    <div className="relative flex items-center justify-center"
      style={{ width: halo, height: halo }}>
      <motion.div className="pointer-events-none absolute rounded-full"
        style={{
          width: halo, height: halo,
          background: `radial-gradient(circle, ${coreColor}40 0%, ${coreColor}10 42%, transparent 68%)`,
        }}
        animate={{ scale: [1, 1.08, 1], opacity: [0.7, 0.95, 0.7] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />
      {state === "thinking" && (
        <>
          <motion.div className="absolute rounded-full border-t-2"
            style={{ width: size * 1.35, height: size * 1.35,
              borderColor: `${coreColor}aa`,
              borderRightColor: "transparent", borderBottomColor: "transparent",
              borderLeftColor: "transparent" }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
          />
          <motion.div className="absolute rounded-full border-b-2"
            style={{ width: size * 1.65, height: size * 1.65,
              borderColor: `${coreColor}77`,
              borderRightColor: "transparent", borderTopColor: "transparent",
              borderLeftColor: "transparent" }}
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 2.2, ease: "linear" }}
          />
        </>
      )}
      {state === "quarantine" && (
        <motion.div animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
          className="absolute rounded-full border-2 border-dashed"
          style={{ width: size * 1.55, height: size * 1.55,
            borderColor: `${COLORS.quarantine}bb` }}
        />
      )}
      {state === "time_rewind" && (
        <motion.div initial={{ scale: 2, opacity: 1 }}
          animate={{ scale: 0.2, opacity: 0 }}
          transition={{ repeat: Infinity, duration: 0.7 }}
          className="absolute rounded-full border-2"
          style={{ width: size * 1.2, height: size * 1.2,
            borderColor: `${COLORS.rewind}cc` }}
        />
      )}
      {state === "shielded" && (
        <motion.div initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 0.55, scale: 1.5 }}
          className="absolute rounded-full border-2 border-dashed"
          style={{ width: size, height: size, borderColor: `${coreColor}cc` }}
        />
      )}
      <motion.div variants={coreVariants} initial="idle" animate={state}
        style={{
          width: size, height: size,
          background: `radial-gradient(circle at 32% 28%, #ffffffcc 0%, ${coreColor} 42%, ${coreColor}bb 78%)`,
          boxShadow: `0 0 34px ${coreColor}aa, 0 0 90px ${coreColor}44, inset 0 0 22px #ffffff44`,
        }}
        className="relative z-10"
      >
        <div className="absolute inset-0 rounded-[inherit] opacity-70"
          style={{ background:
            `radial-gradient(circle at 30% 25%, #ffffff88 0%, transparent 42%)` }}
        />
      </motion.div>
    </div>
  );
};
