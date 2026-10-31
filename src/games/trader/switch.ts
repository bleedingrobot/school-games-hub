import { useEffect, useState } from 'react';
import { fetchTraderEnabled } from '../../data/trader';

/**
 * Is Star Trader in the hub at all? OFF until James says go (docs/TRADER-PLAN.md, stage T.7): while false there is no
 * dashboard card and no /trader page. `VITE_TRADER_ON=true` in .env.local shows it on your own computer only.
 */
const ON = false;

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
