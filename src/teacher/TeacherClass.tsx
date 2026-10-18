/**
 * Which class the Teacher page's switches are for.
 *
 * Settings are per class (F.2). A teacher with several classes picks one here, and every switch below the picker reads and
 * changes that class only. A teacher with one class sees its name and nothing to pick. A teacher with none sees a nudge to make
 * one; the switches then behave as they always have (the database says "make a class first" if they try to change one).
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { fetchClasses, type ClassSummary } from '../data/classes';
import { FriendlyError } from '../data/profile';

interface TeacherClassValue {
  /** The picked class, or null when there is none to pick (or no provider: switches work the way they always did). */
  classId: string | null;
  /** False until the list of classes has loaded, so no switch is read or changed for the wrong class. */
  ready: boolean;
  classes: ClassSummary[];
  pick(id: string): void;
  failed: string | null;
}

const Context = createContext<TeacherClassValue>({ classId: null, ready: true, classes: [], pick: () => {}, failed: null });

export const useTeacherClass = () => useContext(Context);

const REMEMBER = 'sgh-teacher-class';

function remembered(): string | null {
  try {
    return sessionStorage.getItem(REMEMBER);
  } catch {
    return null;
  }
}

export function TeacherClassProvider({ children }: { children: ReactNode }) {
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [picked, setPicked] = useState<string | null>(remembered);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    fetchClasses()
      .then((list) => current && setClasses(list))
      .catch((error) => {
        if (!current) return;
        setFailed(error instanceof FriendlyError ? error.message : 'We couldn’t load your classes.');
        setClasses([]);
      });
    return () => {
      current = false;
    };
  }, []);

  const value = useMemo<TeacherClassValue>(() => {
    const list = classes ?? [];
    // Mine first, then (for a school admin) the others.
    const sorted = [...list].sort((a, b) => Number(b.teaching) - Number(a.teaching));
    const chosen = sorted.find((c) => c.id === picked) ?? sorted[0] ?? null;
    return {
      classId: chosen?.id ?? null,
      ready: classes !== null,
      classes: sorted,
      pick(id) {
        setPicked(id);
        try {
          sessionStorage.setItem(REMEMBER, id);
        } catch {
          // Not remembered: the picker still works.
        }
      },
      failed,
    };
  }, [classes, picked, failed]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** "Settings for: Room 12". The switches below it change only this class. */
export function TeacherClassPicker() {
  const { classId, ready, classes, pick, failed } = useTeacherClass();
  if (!ready) return null;
  if (classes.length === 0) {
    return (
      <p className="teacher__classes-link teacher__picker" role="status">
        {failed ?? 'You don’t teach a class yet.'} <Link to="/classes">Make one on the My classes page</Link> before changing these switches.
      </p>
    );
  }
  if (classes.length === 1) {
    return (
      <p className="teacher__picker">
        Switches below are for <strong>{classes[0].name}</strong>.
      </p>
    );
  }
  return (
    <div className="teacher__picker">
      <label>
        <span>Switches below are for the class</span>{' '}
        <select value={classId ?? ''} onChange={(e) => pick(e.target.value)}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.teaching ? '' : ' (not mine)'}
            </option>
          ))}
        </select>
      </label>
      <p className="teacher__picker-note">Each class has its own switches. A change here only affects this class.</p>
    </div>
  );
}
