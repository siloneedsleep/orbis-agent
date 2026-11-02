// Compatibility view. Positioning and persona transitions are owned by AvatarContainer.
import { CyberCatView } from '@/components/AvatarShell/CyberCatView';
export type CatActionState = 'idle' | 'sleep' | 'wake' | 'thinking' | 'executing' | 'done' | 'feed' | 'drink' | 'petting';
export const CyberCat = ({ actionState = 'idle' }: { actionState?: CatActionState }) => <CyberCatView state={actionState} />;
