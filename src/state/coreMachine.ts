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

export interface CoreModel {
  state: CoreState;
  privilege: Privilege;
  position: { x: number; y: number };
  target: { x: number; y: number };
}

export const initialCoreModel: CoreModel = {
  state: 'idle',
  privilege: 'standard',
  position: { x: 100, y: 100 },
  target: { x: 100, y: 100 }
};

export type CoreAction =
  | { type: 'SET_STATE'; state: CoreState }
  | { type: 'SET_PRIVILEGE'; privilege: Privilege }
  | { type: 'SET_POSITION'; x: number; y: number };

export function coreReducer(state: CoreModel, action: CoreAction): CoreModel {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, state: action.state };
    case 'SET_PRIVILEGE':
      return { ...state, privilege: action.privilege };
    case 'SET_POSITION':
      return { ...state, position: { x: action.x, y: action.y } };
    default:
      return state;
  }
}
