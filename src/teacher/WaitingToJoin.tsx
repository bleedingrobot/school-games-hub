/**
 * Students waiting for a teacher's yes to join a class (Class Warp set to "asks you first"). Before this, they only showed on
 * My classes, inside the right class, so a teacher on any other page never knew. Now the nav's Teacher link shows how many
 * are waiting, and the top of the Teacher page lists them with Yes and No (docs/TEACHER-VIEW-PLAN.md, stage 0).
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

/** The top of the Teacher page: each student waiting, with Yes and No. Nothing at all while nobody is waiting. */
export function WaitingToJoin() {
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

  if (requests.length === 0 && !status) return null;
  return (
    <section className="panel teacher-waiting" aria-labelledby="waiting-title">
      <h2 id="waiting-title" className="panel__title">
        Waiting to join a class
        {requests.length > 0 && <span className="panel__count">{requests.length}</span>}
      </h2>
      {requests.length > 0 && (
        <ul className="teacher-waiting__list">
          {requests.map((r) => (
            <li key={r.id}>
              <span>
                <strong>{r.student_name}</strong> would like to join {r.class_name}
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
      )}
      <p className="teacher-waiting__more">
        <Link to="/classes">See the class on My classes</Link>
      </p>
      <p role="status" className="teacher__status">
        {status}
      </p>
    </section>
  );
}
