export type CoreState = 
  | 'spawning'
  | 'idle'
  | 'docked'         // Hút sát mép màn hình
  | 'listening'      // Nhận diện giọng nói (Audio-reactive)
  | 'thinking'       // Bắn vệ tinh Photon
  | 'executing'
  | 'sonic_flying'   // Phóng xuyên màn hình
  | 'shielded'       // Bật khiên bảo mật
  | 'glitched'       // Ngắt khẩn cấp (Panic)
  | 'sleeping';

export interface CoreContext {
  isAdmin: boolean;
  position: { x: number; y: number };
  audioAmplitude: number;
}
