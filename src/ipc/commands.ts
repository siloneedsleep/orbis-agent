import { invoke } from "@tauri-apps/api/core";

/** Toạ độ & kích thước theo physical px; x/y đã quy về gốc = góc trên-trái overlay. */
export interface MonitorInfo {
  name: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  primary: boolean;
}

export interface OverlayLayout {
  originX: number;
  originY: number;
  width: number;
  height: number;
  monitors: MonitorInfo[];
}

export interface SystemInfo {
  isAdmin: boolean;
  idleMs: number;
}

export const commands = {
  getOverlayLayout: () => invoke<OverlayLayout>("get_overlay_layout"),
  getSystemInfo: () => invoke<SystemInfo>("get_system_info"),
  openDashboard: () => invoke<void>("open_dashboard"),
};
