import type { Point } from "@/core/TheCore";
import type { MonitorInfo } from "@/ipc/commands";

/** Monitor theo toạ độ CSS px của overlay (gốc = góc trên-trái virtual desktop). */
export interface CssMonitor {
  x: number;
  y: number;
  width: number;
  height: number;
  primary: boolean;
}

export function toCssMonitors(monitors: MonitorInfo[], dpr: number): CssMonitor[] {
  return monitors.map((m) => ({
    x: m.x / dpr,
    y: m.y / dpr,
    width: m.width / dpr,
    height: m.height / dpr,
    primary: m.primary,
  }));
}

/** Dùng khi chưa nạp được layout từ Rust: coi cả viewport là một màn hình. */
export function viewportMonitor(): CssMonitor {
  return { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight, primary: true };
}

export function pickPrimary(monitors: CssMonitor[]): CssMonitor {
  return monitors.find((m) => m.primary) ?? monitors[0] ?? viewportMonitor();
}

export function centerOf(m: CssMonitor, coreSize: number): Point {
  return { x: m.x + m.width / 2 - coreSize / 2, y: m.y + m.height / 2 - coreSize / 2 };
}

/** Điểm "taskbar" giả định: giữa mép dưới màn hình. */
export function dockOf(m: CssMonitor, coreSize: number): Point {
  return { x: m.x + m.width / 2 - coreSize / 2, y: m.y + m.height - coreSize - 8 };
}

/**
 * Điểm đến cho chuyến bay demo: tâm màn hình kế tiếp (vòng tròn).
 * Chỉ có một màn hình thì nhảy qua lại giữa 25% và 75% chiều ngang.
 */
export function nextFlightTarget(current: Point, monitors: CssMonitor[], coreSize: number): Point {
  const cx = current.x + coreSize / 2;
  const cy = current.y + coreSize / 2;

  if (monitors.length > 1) {
    const idx = monitors.findIndex(
      (m) => cx >= m.x && cx < m.x + m.width && cy >= m.y && cy < m.y + m.height,
    );
    return centerOf(monitors[(idx + 1) % monitors.length], coreSize);
  }

  const m = monitors[0] ?? viewportMonitor();
  const nextCx = cx < m.x + m.width / 2 ? m.x + m.width * 0.75 : m.x + m.width * 0.25;
  return { x: nextCx - coreSize / 2, y: current.y };
}
