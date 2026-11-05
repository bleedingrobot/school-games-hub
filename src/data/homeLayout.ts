/**
 * The home page's own layout for each person: the game sections they folded away and the games they pinned to the top
 * (James, 4 Nov 2026). Kept on the server (home_layouts, migration 20261105000700) so it follows them to any Chromebook,
 * and in this browser too, so the page opens the right way at once and still works if the server can't be reached.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface HomeLayout {
  /** Section ids folded away ('pinned', 'foundational', 'no-maths', 'training', 'easy-maths', 'complex-maths'). */
  collapsed: string[];
  /** Game ids pinned to the top, in the order they were pinned. */
  pinned: string[];
}

const EMPTY: HomeLayout = { collapsed: [], pinned: [] };
const MAX = 40;

const keyFor = (me: string) => `home-layout:${me}`;

const ids = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= 40))].slice(0, MAX) : [];

/** A layout from anywhere (the server, this browser), with anything odd left out. */
export function layoutFrom(value: unknown): HomeLayout {
  if (!value || typeof value !== 'object') return EMPTY;
  const v = value as Record<string, unknown>;
  return { collapsed: ids(v.collapsed), pinned: ids(v.pinned) };
}

function readLocal(me: string): HomeLayout | null {
  try {
    const saved = window.localStorage.getItem(keyFor(me));
    return saved ? layoutFrom(JSON.parse(saved)) : null;
  } catch {
    return null;
  }
}

function writeLocal(me: string, layout: HomeLayout) {
  try {
    window.localStorage.setItem(keyFor(me), JSON.stringify(layout));
  } catch {
    /* the server still has it */
  }
}

export async function fetchMyHomeLayout(): Promise<HomeLayout | null> {
  const { data, error } = await supabase.rpc('my_home_layout');
  if (error) throw error;
  // Nothing saved yet: null, so this browser's copy (if any) is kept.
  return data && typeof data === 'object' && Object.keys(data).length > 0 ? layoutFrom(data) : null;
}

export async function saveMyHomeLayout(layout: HomeLayout): Promise<void> {
  const { error } = await supabase.rpc('save_my_home_layout', { layout });
  if (error) throw error;
}

/**
 * Asked once per person while the site is open (not every time the home page opens: the home page keeps to its one
 * request). After that this browser's copy is up to date, as every change goes into it.
 */
const askedFor = new Set<string>();

/** Adds the id if it is missing, takes it out if it is there. */
const flip = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id].slice(-MAX));

/**
 * The signed-in person's layout, and ways to change it. Opens with this browser's copy, then takes the server's (unless
 * they have already changed something). Each change is kept here at once and sent to the server a moment later.
 */
export function useHomeLayout(me: string | undefined) {
  const [layout, setLayout] = useState<HomeLayout>(() => (me && readLocal(me)) || EMPTY);
  const changed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!me) return;
    changed.current = false;
    setLayout(readLocal(me) ?? EMPTY);
    if (askedFor.has(me)) return;
    askedFor.add(me);
    let current = true;
    fetchMyHomeLayout().then(
      (saved) => {
        if (!current || changed.current) return;
        if (saved) {
          setLayout(saved);
          writeLocal(me, saved);
        } else {
          // Nothing on the server yet: send this browser's copy, if there is one.
          const local = readLocal(me);
          if (local && (local.collapsed.length || local.pinned.length)) saveMyHomeLayout(local).catch(() => undefined);
        }
      },
      () => askedFor.delete(me), // this browser's copy will do; ask again next time
    );
    return () => {
      current = false;
    };
  }, [me]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const change = useCallback(
    (make: (old: HomeLayout) => HomeLayout) => {
      changed.current = true;
      setLayout((old) => {
        const next = make(old);
        if (me) {
          writeLocal(me, next);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => saveMyHomeLayout(next).catch(() => undefined), 500);
        }
        return next;
      });
    },
    [me],
  );

  return {
    layout,
    isCollapsed: (section: string) => layout.collapsed.includes(section),
    isPinned: (game: string) => layout.pinned.includes(game),
    toggleCollapsed: (section: string) => change((old) => ({ ...old, collapsed: flip(old.collapsed, section) })),
    togglePinned: (game: string) => change((old) => ({ ...old, pinned: flip(old.pinned, game) })),
  };
}
