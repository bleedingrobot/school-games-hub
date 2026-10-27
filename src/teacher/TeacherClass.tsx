/**
 * Which class the teacher pages are for.
 *
 * Settings are per class (F.2). Every teacher page sits under /teacher/:classId (docs/TEACHER-VIEW-PLAN.md, stage 1), so the
 * class is in the address: links and the back button keep it. The shell (TeacherShell.tsx) hands it to this provider as
 * `chosen`, and every panel reads it with useTeacherClass(), as the switches always have. The last class is remembered for the
 * visit, so /teacher and the old links open on it.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchClasses, type ClassSummary } from '../data/classes';
import { FriendlyError } from '../data/profile';

interface TeacherClassValue {
  /** The picked class, or null when there is none to pick (or no provider: switches work the way they always did). */
  classId: string | null;
  /** The picked class's summary (name, members, code), or null. */
  current: ClassSummary | null;
  /** False until the list of classes has loaded, so no switch is read or changed for the wrong class. */
  ready: boolean;
  classes: ClassSummary[];
  pick(id: string): void;
  /** Loads the list again (after a class is renamed, made or archived). */
  reload(): Promise<void>;
  failed: string | null;
}

const Context = createContext<TeacherClassValue>({
  classId: null,
  current: null,
  ready: true,
  classes: [],
  pick: () => {},
  reload: async () => {},
  failed: null,
});

export const useTeacherClass = () => useContext(Context);

const REMEMBER = 'sgh-teacher-class';

export function rememberedClass(): string | null {
  try {
    return sessionStorage.getItem(REMEMBER);
  } catch {
    return null;
  }
}

function remember(id: string) {
  try {
    if (sessionStorage.getItem(REMEMBER) !== id) sessionStorage.setItem(REMEMBER, id);
  } catch {
    // Not remembered: the picker still works.
  }
}

/** Mine first, then (for a school admin) the others. */
export const mineFirst = (list: ClassSummary[]) => [...list].sort((a, b) => Number(b.teaching) - Number(a.teaching));

export function TeacherClassProvider({
  children,
  chosen,
  onPick,
}: {
  children: ReactNode;
  /** The class in the address. Without it, the remembered class (or the first) is used. */
  chosen?: string | null;
  /** What picking another class does (the shell changes the address). Without it, the pick is kept here. */
  onPick?: (id: string) => void;
}) {
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [picked, setPicked] = useState<string | null>(rememberedClass);
  const [failed, setFailed] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setClasses(await fetchClasses());
      setFailed(null);
    } catch (error) {
      setFailed(error instanceof FriendlyError ? error.message : 'We couldn’t load your classes.');
      setClasses((now) => now ?? []);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const wanted = chosen ?? picked;
  const value = useMemo<TeacherClassValue>(() => {
    const sorted = mineFirst(classes ?? []);
    const current = sorted.find((c) => c.id === wanted) ?? sorted[0] ?? null;
    return {
      classId: current?.id ?? null,
      current,
      ready: classes !== null,
      classes: sorted,
      pick(id) {
        remember(id);
        if (onPick) onPick(id);
        else setPicked(id);
      },
      reload,
      failed,
    };
  }, [classes, wanted, failed, onPick, reload]);

  // A class opened from a link is remembered too, so /teacher comes back to it.
  useEffect(() => {
    if (chosen && value.classId === chosen) remember(chosen);
  }, [chosen, value.classId]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** The class switcher in the teacher header. A teacher with one class sees just its name (in the header), so no dropdown. */
export function TeacherClassPicker() {
  const { classId, ready, classes, pick } = useTeacherClass();
  if (!ready || classes.length < 2) return null;
  return (
    <label className="teacher-head__switch">
      <span className="sr-only">Class</span>
      <select value={classId ?? ''} onChange={(e) => pick(e.target.value)}>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.teaching ? '' : ' (not mine)'}
          </option>
        ))}
      </select>
    </label>
  );
}
