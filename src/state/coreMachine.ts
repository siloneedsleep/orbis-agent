export type CoreState = 
  | 'spawning'
  | 'idle'
  | 'docked'         // Hút sát mép màn hình
  | 'listening'      // Voice Input (Audio-reactive)
  | 'thinking'       // Bắn vệ tinh Photon
  | 'executing'
  | 'sonic_flying'   // Phóng xuyên màn hình
  | 'shielded'       // Bật khiên bảo mật
  | 'glitched'       // Ngắt khẩn cấp (Panic)
  | 'quarantine'     // Ném task vào Hyper-V (Amber Alert)
  | 'time_rewind'    // Hoàn tác snapshot sạch
  | 'sleeping';

export interface CoreContext {
  isAdmin: boolean;
  position: { x: number; y: number };
  audioAmplitude: number;
}
