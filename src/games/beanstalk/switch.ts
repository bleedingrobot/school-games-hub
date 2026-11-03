import { useEffect, useState } from 'react';
import { fetchBeanstalkEnabled } from '../../data/beanstalk';

/**
 * Is Kiwi's Beanstalk in the hub at all? Off until James says to go live (docs/BEANSTALK-PLAN.md, Stage 5).
 * `VITE_BEANSTALK_ON=true` in .env.local shows it on your own computer. Even when on, the card hides until the teacher
 * switches the game on for the class.
 */
const ON = false;

export const beanstalkOn = (): boolean => ON || import.meta.env.VITE_BEANSTALK_ON === 'true';

/** Is Kiwi's Beanstalk switched on for this pupil's class? null while loading (treated as off, so the card never flashes up). */
export function useBeanstalkEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!beanstalkOn()) return;
    let current = true;
    fetchBeanstalkEnabled().then((v) => current && setOn(v), () => current && setOn(false));
    return () => {
      current = false;
    };
  }, []);
  return on;
}
