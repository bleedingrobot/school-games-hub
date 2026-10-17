import { useEffect, useState } from 'react';
import { fetchMathsSwitch } from '../../data/spaceGames';
import type { MathsMode } from './prefs';

/**
 * What the teacher allows for Mission Control maths (the switch on the Teacher page), read the
 * way the emoji reactions switch is. Null while it loads. The bot game and the classmates
 * lobby both ask here; the server checks the switch too, so this only decides what's shown.
 */
export function useMathsMode(): MathsMode | null {
  const [mode, setMode] = useState<MathsMode | null>(null);
  useEffect(() => {
    let current = true;
    void fetchMathsSwitch()
      .catch(() => 'off' as const)
      .then((value) => current && setMode(value));
    return () => {
      current = false;
    };
  }, []);
  return mode;
}
