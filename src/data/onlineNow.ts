/**
 * Online now (James, 25 Nov 2026): how many pupils have the hub open right now. Counts only, never names.
 * A pupil counts for 75 seconds after the hub's "I'm here" (hub_here, every 30 seconds while the hub is showing).
 * Teachers: `teacher_online_now(class)` gives their class and the school. Pupils: `hub_online_now()` gives the school.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface OnlineNow {
  school: number;
  /** Only for a teacher's class. */
  class?: number;
}

export const ONLINE_NOW_EVERY_MS = 30_000;

const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);

export function parseOnlineNow(data: unknown): OnlineNow | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { school?: unknown; class?: unknown };
  const school = count(d.school);
  if (school === null) return null;
  const cls = count(d.class);
  return cls === null ? { school } : { school, class: cls };
}

export async function fetchOnlineNow(classId?: string): Promise<OnlineNow | null> {
  try {
    const { data, error } = classId
      ? await supabase.rpc('teacher_online_now', { target_class: classId })
      : await supabase.rpc('hub_online_now');
    return error ? null : parseOnlineNow(data);
  } catch {
    return null;
  }
}

/** Read now, then every 30 seconds while the page is showing (and again when it comes back). Null until the first answer. */
export function useOnlineNow(classId?: string, enabled = true, fetcher: typeof fetchOnlineNow = fetchOnlineNow): OnlineNow | null {
  const [online, setOnline] = useState<OnlineNow | null>(null);
  useEffect(() => {
    setOnline(null);
    if (!enabled) return;
    let stopped = false;
    const read = async () => {
      if (document.visibilityState === 'hidden') return;
      const got = await fetcher(classId);
      if (!stopped && got) setOnline(got);
    };
    void read();
    const timer = setInterval(() => void read(), ONLINE_NOW_EVERY_MS);
    const again = () => document.visibilityState === 'visible' && void read();
    document.addEventListener('visibilitychange', again);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', again);
    };
  }, [classId, enabled, fetcher]);
  return online;
}
