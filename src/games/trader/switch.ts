import { useEffect, useState } from 'react';
import { fetchTraderEnabled } from '../../data/trader';

/**
 * Is Star Trader in the hub at all? ON since 1 Nov 2026 (docs/TRADER-PLAN.md, "Went live"): each class still needs its
 * teacher to switch it on (`trader_enabled`, off to start). Set false to take the card and /trader page away again.
 * `VITE_TRADER_ON=true` in .env.local shows it on your own computer while this is false.
 */
const ON = true;

export const traderOn = (): boolean => ON || import.meta.env.VITE_TRADER_ON === 'true';

/** Is Star Trader switched on for this pupil's class? null while loading (treated as off, so the card never flashes up). */
export function useTraderEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!traderOn()) return;
    let current = true;
    fetchTraderEnabled().then((v) => current && setOn(v), () => current && setOn(false));
    return () => {
      current = false;
    };
  }, []);
  return on;
}
