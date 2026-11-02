import { useEffect, useState } from 'react';
import { events } from '@/ipc/events';
import { AvatarContainer } from '@/components/AvatarShell/AvatarContainer';
import { SpatialCommandBar } from '@/components/CommandHud/SpatialCommandBar';
import { SomPreviewOverlay } from '@/components/CommandHud/SomPreviewOverlay';
import { useInteractiveRegions } from '@/state/useInteractiveRegions';

export function OverlayApp() {
  const [open, setOpen] = useState(false);
  useInteractiveRegions();
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    events.onWake(() => setOpen(value => !value)).then(fn => { if (disposed) fn(); else unlisten = fn; }).catch(console.error);
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown',escape);
    return () => { disposed=true; unlisten?.(); window.removeEventListener('keydown',escape); };
  }, []);
  return <div className="pointer-events-none fixed inset-0 overflow-hidden select-none">
    <SomPreviewOverlay />
    <AvatarContainer commandOpen={open} onCommand={() => setOpen(value=>!value)} />
    <SpatialCommandBar open={open} onClose={()=>setOpen(false)} />
  </div>;
}
