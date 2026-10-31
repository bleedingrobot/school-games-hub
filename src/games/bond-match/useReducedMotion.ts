import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** Has this device asked for less movement? The cards then change without the 3D flip. */
export function useReducedMotion(): boolean {
  const ask = () => typeof window !== 'undefined' && window.matchMedia?.(QUERY).matches === true;
  const [reduced, setReduced] = useState(ask);
  useEffect(() => {
    const query = window.matchMedia?.(QUERY);
    if (!query?.addEventListener) return;
    const change = () => setReduced(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  return reduced;
}
