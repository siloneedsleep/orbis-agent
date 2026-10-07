export type CoreState =
  | 'spawning'
  | 'idle'
  | 'docked'
  | 'listening'
  | 'thinking'
  | 'executing'
  | 'sonic_flying'
  | 'shielded'
  | 'glitched'
  | 'quarantine'
  | 'time_rewind'
  | 'sleeping';

export type Privilege = 'standard' | 'elevated' | 'admin';

export interface Point {
  x: number;
  y: number;
}

export interface CoreModel {
  state: CoreState;
  privilege: Privilege;
  /** Góc trên-trái của ô The Core. Khi đang bay thì là điểm xuất phát. */
  position: Point;
  target: Point;
  /** Đang bay về dock để đi ngủ; hạ cánh xong sẽ chuyển sang 'sleeping'. */
  goingToSleep: boolean;
}

/** Overlay khởi động ở trạng thái ngủ (không render gì) cho tới khi hotkey/tray đánh thức. */
export const initialCoreModel: CoreModel = {
  state: 'sleeping',
  privilege: 'standard',
  position: { x: 100, y: 100 },
  target: { x: 100, y: 100 },
  goingToSleep: false,
};

export type CoreAction =
  | { type: 'SET_STATE'; state: CoreState }
  | { type: 'SET_PRIVILEGE'; privilege: Privilege }
  | { type: 'SET_POSITION'; x: number; y: number }
  /** Hotkey/tray: đang ngủ → bay từ `dock` lên `home`; đang thức → bay về `dock` rồi ngủ. */
  | { type: 'TOGGLE'; dock: Point; home: Point }
  | { type: 'THINK' }
  | { type: 'IDLE' }
  | { type: 'FLY_TO'; target: Point }
  | { type: 'LANDED' };

export function coreReducer(state: CoreModel, action: CoreAction): CoreModel {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, state: action.state };
    case 'SET_PRIVILEGE':
      return { ...state, privilege: action.privilege };
    case 'SET_POSITION':
      return { ...state, position: { x: action.x, y: action.y } };

    case 'TOGGLE':
      if (state.state === 'sleeping') {
        return {
          ...state,
          state: 'sonic_flying',
          position: action.dock,
          target: action.home,
          goingToSleep: false,
        };
      }
      // Đang bay thì bỏ qua: đổi target giữa chuyến sẽ làm Core giật về điểm xuất phát.
      if (state.state === 'sonic_flying') return state;
      return { ...state, state: 'sonic_flying', target: action.dock, goingToSleep: true };

    case 'THINK':
      return state.state === 'idle' ? { ...state, state: 'thinking' } : state;

    case 'IDLE':
      return state.state === 'thinking' ? { ...state, state: 'idle' } : state;

    case 'FLY_TO':
      if (state.state === 'sleeping' || state.state === 'sonic_flying') return state;
      return { ...state, state: 'sonic_flying', target: action.target, goingToSleep: false };

    case 'LANDED':
      if (state.state !== 'sonic_flying') return state;
      return {
        ...state,
        state: state.goingToSleep ? 'sleeping' : 'idle',
        position: state.target,
        goingToSleep: false,
      };

    default:
      return state;
  }
}
