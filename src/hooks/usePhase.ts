import { useEffect, useState } from 'react';
import { getPhase, parsePhaseOverride, type Phase } from '../lib/phase';

export const PHASE_TICK_MS = 60_000;

export function usePhase(): Phase {
  const [override] = useState(() => parsePhaseOverride(window.location.search));
  const [phase, setPhase] = useState<Phase>(() => override ?? getPhase(new Date()));

  useEffect(() => {
    if (override) return;
    const update = () => setPhase(getPhase(new Date()));
    const interval = window.setInterval(update, PHASE_TICK_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') update();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [override]);

  useEffect(() => {
    document.documentElement.dataset.phase = phase;
  }, [phase]);

  return phase;
}
