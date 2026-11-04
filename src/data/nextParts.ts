/**
 * The home page's "next part" chips (src/components/NextPartChip.tsx): for each daily Foundational skills game, has the pupil
 * already moved on today? Read through my_next_parts() (migration 20261105000400). Only a nicety: any trouble just means no chips.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/** Game id → true when today's part is done (come back tomorrow), false when it is ready. */
export type NextParts = Record<string, boolean>;

export async function fetchNextParts(): Promise<NextParts> {
  const { data, error } = await supabase.rpc('my_next_parts');
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return {};
  const out: NextParts = {};
  for (const [game, done] of Object.entries(data as Record<string, unknown>)) if (typeof done === 'boolean') out[game] = done;
  return out;
}

/** The chips for the signed-in pupil, asked once when the page opens. Empty while loading or if it fails. */
export function useNextParts(me: string | undefined, wanted: boolean): NextParts {
  const [parts, setParts] = useState<NextParts>({});
  useEffect(() => {
    if (!me || !wanted) return;
    let current = true;
    fetchNextParts().then(
      (p) => current && setParts(p),
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [me, wanted]);
  return parts;
}
