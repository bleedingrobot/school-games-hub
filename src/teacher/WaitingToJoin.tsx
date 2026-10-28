/**
 * Students waiting for a teacher's yes to join a class (Class Warp set to "asks you first"). Before this, they only showed on
 * My classes, inside the right class, so a teacher on any other page never knew. Now the nav's Teacher link shows how many
 * are waiting, and Today's "Needs you" lists them with Yes and No (docs/TEACHER-VIEW-PLAN.md, stages 0 and 1).
 *
 * The list is fetched once for the whole site (the Layout, teachers only) and shared, so answering on the Teacher page
 * updates the nav count at once. Students never fetch it.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { answerWarp, fetchWarpRequests, type WarpRequest } from '../data/classes';
import { FriendlyError } from '../data/profile';
import { ago, LIVE_MS } from '../pages/MyClasses';
import '../pages/teacher-page.css';

interface WaitingValue {
  requests: WarpRequest[];
  refresh(): Promise<void>;
}

const Context = createContext<WaitingValue | null>(null);

/** Looks every 30 seconds while the page is showing, and straight away when the tab comes back (like My classes). */
function usePolledRequests(enabled: boolean): WaitingValue {
  const [requests, setRequests] = useState<WarpRequest[]>([]);

  const refresh = useCallback(async () => {
    try {
      setRequests(await fetchWarpRequests());
    } catch {
      // A count we can't load is just not shown; My classes still has the full list.
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setRequests([]);
      return;
    }
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void refresh();
    }, LIVE_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, refresh]);

  return { requests, refresh };
}

/** In the Layout: fetches only for a teacher. */
export function WaitingToJoinProvider({ teacher, children }: { teacher: boolean; children: ReactNode }) {
  const value = usePolledRequests(teacher);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** The shared list, or (outside the Layout, as in a test) the page's own. */
export function useWaitingToJoin(): WaitingValue {
  const shared = useContext(Context);
  const own = usePolledRequests(shared === null);
  return shared ?? own;
}

/** The count beside "Teacher" in the nav. Nothing at all while nobody is waiting. */
export function WaitingCount() {
  const { requests } = useWaitingToJoin();
  if (requests.length === 0) return null;
  return (
    <span className="topnav__count">
      <span aria-hidden="true">{requests.length}</span>
      <span className="sr-only">, {requests.length} waiting to join a class</span>
    </span>
  );
}

/**
 * Today's "Needs you" (docs/TEACHER-VIEW-PLAN.md, section 4.2): each student waiting to join this class, with Yes and No, and a
 * line for each of my other classes with someone waiting. Only there when something is waiting; otherwise one quiet line.
 */
export function NeedsYou({ classId }: { classId: string }) {
  const { requests, refresh } = useWaitingToJoin();
  const [status, setStatus] = useState<string | null>(null);

  async function answer(r: WarpRequest, approve: boolean) {
    setStatus('Saving…');
    try {
      await answerWarp(r.id, approve);
      setStatus(approve ? `${r.student_name} is in ${r.class_name}.` : `${r.student_name} was turned down.`);
      await refresh();
    } catch (error) {
      setStatus(error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  const here = requests.filter((r) => r.class_id === classId);
  const elsewhere = new Map<string, { name: string; count: number }>();
  for (const r of requests) {
    if (r.class_id === classId) continue;
    const now = elsewhere.get(r.class_id) ?? { name: r.class_name, count: 0 };
    elsewhere.set(r.class_id, { ...now, count: now.count + 1 });
  }

  if (requests.length === 0) {
    return (
      <p className="today__quiet" role="status">
        {status ?? 'Nothing needs you right now.'}
      </p>
    );
  }
  return (
    <section className="panel teacher-waiting" aria-labelledby="needs-you-title">
      <h2 id="needs-you-title" className="panel__title">
        Needs you
        <span className="panel__count">{requests.length}</span>
      </h2>
      {here.length > 0 && (
        <>
          <p className="teacher-waiting__lead">
            {here.length} student{here.length === 1 ? ' wants' : 's want'} to join {here[0].class_name}:
          </p>
          <ul className="teacher-waiting__list">
            {here.map((r) => (
              <li key={r.id}>
                <span>
                  <strong>{r.student_name}</strong>
                  {r.group_name ? ` (${r.group_name})` : ''} · {ago(r.asked_at)}
                </span>
                <span className="person-panel__actions">
                  <button type="button" className="button button--primary" aria-label={`Yes, let ${r.student_name} in`} onClick={() => void answer(r, true)}>
                    Yes
                  </button>
                  <button
                    type="button"
                    className="button button--light-outline"
                    aria-label={`No, keep ${r.student_name} out`}
                    onClick={() => void answer(r, false)}
                  >
                    No
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {elsewhere.size > 0 && (
        <ul className="teacher-waiting__elsewhere">
          {[...elsewhere].map(([id, c]) => (
            <li key={id}>
              {c.count} student{c.count === 1 ? '' : 's'} waiting to join <Link to={`/teacher/${id}`}>{c.name}</Link>
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="teacher__status">
        {status}
      </p>
    </section>
  );
}
