import { useEffect, useState } from 'react';
import { fetchTuiEnabled } from '../../data/tui';

/**
 * Is Tūī’s Ten Tree in the hub at all? `VITE_TUI_ON=true` in .env.local shows it on your own computer. Even when on, the
 * card hides until the teacher switches the game on for the class (on by default for every class).
 */
const TUI_ON = true;

export const tuiOn = (): boolean => TUI_ON || import.meta.env.VITE_TUI_ON === 'true';

/** Is Tūī’s Ten Tree switched on for this pupil's class? null while loading (treated as off, so the card never flashes up). */
export function useTuiEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!tuiOn()) return;
    let current = true;
    fetchTuiEnabled().then((v) => current && setOn(v), () => current && setOn(false));
    return () => {
      current = false;
    };
  }, []);
  return on;
}
