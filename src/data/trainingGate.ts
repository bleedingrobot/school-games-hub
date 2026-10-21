/**
 * Training before games (James, 22 Oct 2026): is this student's class asking for a Training session before the games, and
 * have they done one in the last 6 hours? shared/training/gate.ts has the rule; this asks the server and remembers its
 * answer for a minute, so going from the home page into a game costs no extra request.
 *
 * The lock is only on the website. If the server can't be asked, the games stay open: a slow or broken connection must never
 * lock a class out of everything. Teachers are never locked (the server says so too, but they aren't even asked).
 */
import { useEffect, useState } from 'react';
import { OPEN, trainingGate, type Gate } from '../../shared/training/gate';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';
import { forgetTrainingLock, trainingLockMemory } from './trainingLockMemory';
import { localFinishedAt } from './training';

/** What my_training_lock() returns. */
export interface TrainingLock {
  on: boolean;
  lastFinishedAt: number | null;
}

const KEEP_MS = 60_000;
const memory = trainingLockMemory as { kept: { player: string; lock: TrainingLock | null; at: number } | null; pending: { player: string; promise: Promise<TrainingLock | null> } | null };

/**
 * The lock for this student, remembered for a minute; null if it couldn't be worked out (the games stay open). The class's
 * switch comes from the settings row every page already shares (settingsMemory.ts), so a class with it off costs no request
 * at all. Only when it is on is the server asked when the student last finished a session.
 */
export function fetchTrainingLock(player: string): Promise<TrainingLock | null> {
  const { kept, pending } = memory;
  if (kept && kept.player === player && Date.now() - kept.at < KEEP_MS) return Promise.resolve(kept.lock);
  if (pending && pending.player === player) return pending.promise;
  const promise = (async (): Promise<TrainingLock | null> => {
    try {
      const settings = await readSettings(['training_first']);
      if (!settings) return null;
      if (settings.training_first !== true) return { on: false, lastFinishedAt: null };
      const { data, error } = await supabase.rpc('my_training_lock');
      if (error || !data || typeof data !== 'object') return null;
      const raw = data as { on?: unknown; lastFinishedAt?: unknown };
      return { on: raw.on === true, lastFinishedAt: typeof raw.lastFinishedAt === 'number' ? raw.lastFinishedAt : null };
    } catch {
      return null;
    }
  })();
  memory.pending = { player, promise };
  void promise.then((lock) => {
    if (memory.pending?.promise !== promise) return; // forgotten while it was on its way
    memory.pending = null;
    // A failed ask isn't remembered, so the next page tries again.
    if (lock) memory.kept = { player, lock, at: Date.now() };
  });
  return promise;
}

export { forgetTrainingLock };

export function gateFor(player: string, lock: TrainingLock | null, now = Date.now()): Gate {
  if (!lock) return OPEN;
  return trainingGate({ on: lock.on, lastFinishedAt: lock.lastFinishedAt, localFinishedAt: localFinishedAt(player), now });
}

export type GateState = { ready: false } | ({ ready: true } & Gate);

/**
 * The lock for the signed-in person, worked out again every minute (so the home page locks when the time runs out) and asked
 * again when the tab comes back. `live: false` decides once and then never changes, for a game page: a game that is already
 * open is never closed by the lock (James).
 */
export function useTrainingGate({ live = true }: { live?: boolean } = {}): GateState {
  const { profile } = useAuth();
  const player = profile?.id;
  const teacher = profile?.role === 'teacher';
  const [lock, setLock] = useState<{ player: string; lock: TrainingLock | null } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!player || teacher) return;
    let current = true;
    const ask = () =>
      void fetchTrainingLock(player).then((l) => {
        if (!current) return;
        setLock({ player, lock: l });
        setNow(Date.now());
      });
    ask();
    if (!live) return () => void (current = false);
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    const back = () => document.visibilityState === 'visible' && ask();
    document.addEventListener('visibilitychange', back);
    window.addEventListener('focus', ask);
    return () => {
      current = false;
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', back);
      window.removeEventListener('focus', ask);
    };
  }, [player, teacher, live]);

  if (!player || teacher) return { ready: true, ...OPEN };
  if (!lock || lock.player !== player) return { ready: false };
  return { ready: true, ...gateFor(player, lock.lock, now) };
}

// ---------------------------------------------------------------------------
// The teacher's switch
// ---------------------------------------------------------------------------

/** Whether this class must do a Training session before the games. Off unless a teacher turned it on. */
export async function fetchTrainingFirst(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['training_first'], classId);
  if (!row) throw new Error('We couldn’t load this setting.');
  return row.training_first === true;
}

export async function saveTrainingFirst(enabled: boolean, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_training_first', { enabled, target_class: classId ?? null });
  forgetSettings();
  forgetTrainingLock();
  if (error) throw new FriendlyError('We couldn’t change that.');
}
