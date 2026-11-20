/**
 * Which stories this pupil has seen (docs/plans/stories/PLAN.md). Saved on the server (`story_seen`) so a story shown on one
 * Chromebook is not shown again on another. Loaded once for every game; marking is saved at once and never blocks play.
 * Signed out (the preview) it is remembered for this visit only. Nothing here counts towards points or rewards.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { STORY_ID } from '../../shared/kit/stories';

let loaded: Promise<Set<string>> | null = null;
const seen = new Set<string>();
const listeners = new Set<() => void>();

function load(): Promise<Set<string>> {
  if (!loaded) {
    loaded = (async () => {
      try {
        const { data, error } = await supabase.rpc('my_stories_seen');
        if (!error && Array.isArray(data)) for (const id of data) if (typeof id === 'string') seen.add(id);
      } catch {
        // Offline or signed out: start with nothing seen.
      }
      return seen;
    })();
  }
  return loaded;
}

/** Marks a story seen now, then saves it. If the save fails it is seen for this visit and may show once more next time. */
export function markStorySeen(id: string): void {
  if (!STORY_ID.test(id) || seen.has(id)) return;
  seen.add(id);
  listeners.forEach((l) => l());
  void Promise.resolve(supabase.rpc('mark_story_seen', { story: id })).catch(() => undefined);
}

/** For tests: forget everything loaded. */
export function resetStoriesForTest(ids: string[] = []): void {
  seen.clear();
  ids.forEach((id) => seen.add(id));
  loaded = Promise.resolve(seen);
}

/**
 * `ready` is false until the list has loaded (so a story never flashes up for someone who has seen it).
 * `shouldShow(id)` is true when loaded and not seen.
 */
export function useStories() {
  const [, bump] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    const tick = () => live && bump((n) => n + 1);
    listeners.add(tick);
    void load().then(() => live && setReady(true));
    return () => {
      live = false;
      listeners.delete(tick);
    };
  }, []);
  const hasSeen = useCallback((id: string) => seen.has(id), []);
  const shouldShow = useCallback((id: string) => ready && !seen.has(id), [ready]);
  return { ready, hasSeen, shouldShow, markSeen: markStorySeen };
}

/**
 * Shows a story by itself once: `open` turns true when the list has loaded, `when` is true and the pupil has not seen it.
 * `close()` hides it (StoryBook has already marked it seen). Change `id` to queue the next story.
 */
export function useStoryOnce(id: string | null, when = true) {
  const { ready, hasSeen } = useStories();
  const [closed, setClosed] = useState<string | null>(null);
  const open = Boolean(id && when && ready && !hasSeen(id) && closed !== id);
  const close = useCallback(() => {
    if (id) {
      markStorySeen(id);
      setClosed(id);
    }
  }, [id]);
  return { open, close };
}
