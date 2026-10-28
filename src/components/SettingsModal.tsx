import React from 'react';
import { UserProfile, LLMConfig } from '@/state/agentStore';
import { UnifiedSettingsView, SettingsTab } from './Settings/UnifiedSettingsView';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile?: UserProfile | null;
  config?: LLMConfig | null;
  onUpdate?: (profile: UserProfile, config: LLMConfig) => void;
  initialTab?: SettingsTab;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'mcp',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-5xl h-[85vh] rounded-3xl border border-zinc-700 bg-zinc-950 shadow-2xl overflow-hidden flex flex-col">
        <UnifiedSettingsView initialTab={initialTab} onClose={onClose} />
      </div>
    </div>
  );
};
