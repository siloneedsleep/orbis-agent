import { useEffect } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';

/** Native cursor polling works even while WebView no longer receives mouse events. */
export function useInteractiveRegions() {
  useEffect(() => {
    if (!isTauri()) return;
    let queued = false;
    let disposed = false;
    const publish = () => {
      queued = false; if (disposed) return;
      const rects = Array.from(document.querySelectorAll<HTMLElement>('[data-orbis-interactive]')).filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden').map(node => {
        const rect = node.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }).filter(rect => rect.width > 0 && rect.height > 0);
      void invoke('update_interactive_rects', { rects }).catch(console.error);
    };
    const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(publish); } };
    const observer = new MutationObserver(schedule); observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
    const timer = window.setInterval(schedule, 500);
    window.addEventListener('resize', schedule); schedule();
    return () => { disposed = true; observer.disconnect(); clearInterval(timer); window.removeEventListener('resize', schedule); void invoke('update_interactive_rects', { rects: [] }); };
  }, []);
}
