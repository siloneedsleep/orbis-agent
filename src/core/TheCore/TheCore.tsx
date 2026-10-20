import React from 'react';
import type { CoreState, Privilege } from '../../state/coreMachine';

export interface TheCoreProps {
  state: CoreState;
  privilege?: Privilege;
  isAdmin?: boolean;
}

export const TheCore: React.FC<TheCoreProps> = ({ 
  state, 
  privilege = 'standard', 
  isAdmin = false 
}) => {
  const isHighPerm = isAdmin || privilege === 'admin' || privilege === 'elevated';
  const color = isHighPerm ? '#FACC15' : '#00F0FF';

  return (
    <div className="flex items-center gap-2 rounded-full border border-zinc-700/80 bg-zinc-900/90 px-3 py-1 shadow-2xl backdrop-blur-md transition-colors">
      <span
        className="h-2.5 w-2.5 rounded-full shadow-sm"
        style={{ backgroundColor: color }}
      />
      <span className="font-mono text-xs font-bold text-white tracking-wider">
        ORBIS
      </span>
      <span className="text-[10px] uppercase font-mono text-zinc-400">
        {state}
      </span>
    </div>
  );
};
