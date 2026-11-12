/**
 * Students waiting for a teacher's yes to join a class (Class Warp set to "asks you first"). Before this, they only showed on
 * My classes, inside the right class, so a teacher on any other page never knew. Now the nav's Teacher link shows how many
 * are waiting, and Today's "Needs you" lists them with Yes and No (docs/TEACHER-VIEW-PLAN.md, stages 0 and 1).
 *
 * The list is fetched once for the whole site (the Layout, teachers only) and shared, so answering on the Teacher page
 * updates the nav count at once. Students never fetch it.
 *
 * Typed player names waiting for a Yes (card P11, earn your own name) come in the same way: in the nav count and in "Needs you".
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { answerWarp, fetchWarpRequests, type WarpRequest } from '../data/classes';
import { answerName, fetchNameRequests, type NameRequest } from '../data/ownName';
import { FriendlyError } from '../data/profile';
import type { TeacherAlert } from '../games/types';
import { ago, LIVE_MS } from '../data/ago';
import '../pages/teacher-page.css';

interface WaitingValue {
  requests: WarpRequest[];
  /** Typed names waiting for a teacher's Yes. */
  names: NameRequest[];
  refresh(): Promise<void>;
}

const Context = createContext<WaitingValue | null>(null);

/** Looks every 30 seconds while the page is showing, and straight away when the tab comes back (like My classes). */
function usePolledRequests(enabled: boolean): WaitingValue {
  const [requests, setRequests] = useState<WarpRequest[]>([]);
  const [names, setNames] = useState<NameRequest[]>([]);

  const refresh = useCallback(async () => {
    // Each list shows as soon as it's here. A count we can't load is just not shown; My classes still has the full list.
    await Promise.allSettled([fetchWarpRequests().then(setRequests), fetchNameRequests().then((typed) => setNames(typed ?? []))]);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setRequests([]);
      setNames([]);
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

  return { requests, names, refresh };
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
  const { requests, names } = useWaitingToJoin();
  const total = requests.length + names.length;
  if (total === 0) return null;
  return (
    <span className="topnav__count">
      <span aria-hidden="true">{total}</span>
      <span className="sr-only">, {names.length === 0 ? `${total} waiting to join a class` : `${total} waiting for you`}</span>
    </span>
  );
}

/**
 * Today's "Needs you" (docs/TEACHER-VIEW-PLAN.md, section 4.2): each student waiting to join this class, with Yes and No, and a
 * line for each of my other classes with someone waiting, then the class's other alerts (stage 5: saves a game turned down, a
 * lot of skipping), each with a link to look. Only there when something is waiting; otherwise one quiet line.
 */
export function NeedsYou({ classId, alerts = [] }: { classId: string; alerts?: TeacherAlert[] }) {
  const { requests, names, refresh } = useWaitingToJoin();
  const [status, setStatus] = useState<string | null>(null);

  async function answerTyped(r: NameRequest, approve: boolean) {
    setStatus('Saving…');
    try {
      const result = await answerName(r.id, approve);
      setStatus(
        result === 'approved'
          ? `${r.student_name} is now ${r.wanted}.`
          : result === 'taken'
            ? `Someone else has ${r.wanted} now, so ${r.student_name} keeps their name and can try another.`
            : `${r.student_name} keeps their name.`,
      );
      await refresh();
    } catch (error) {
      setStatus(error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');
    }
  }

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

  // Pupils in no class only reach a school admin: show them with this class's names.
  const namesHere = names.filter((r) => r.class_id === classId || r.class_id === null);
  const namesElsewhere = new Map<string, { name: string; count: number }>();
  for (const r of names) {
    if (r.class_id === classId || r.class_id === null) continue;
    const now = namesElsewhere.get(r.class_id) ?? { name: r.class_name ?? 'another class', count: 0 };
    namesElsewhere.set(r.class_id, { ...now, count: now.count + 1 });
  }

  const count = requests.length + names.length + alerts.length;
  if (count === 0) {
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
        <span className="panel__count">{count}</span>
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
      {namesHere.length > 0 && (
        <>
          <p className="teacher-waiting__lead">
            New player name{namesHere.length === 1 ? '' : 's'} to check. Say No to a real name or anything unkind:
          </p>
          <ul className="teacher-waiting__list">
            {namesHere.map((r) => (
              <li key={r.id}>
                <span>
                  <strong>{r.student_name}</strong>
                  {r.real_name ? ` (${r.real_name})` : ''} wants to be <strong>{r.wanted}</strong> · {ago(r.asked_at)}
                </span>
                <span className="person-panel__actions">
                  <button
                    type="button"
                    className="button button--primary"
                    aria-label={`Yes, ${r.student_name} can be ${r.wanted}`}
                    onClick={() => void answerTyped(r, true)}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className="button button--light-outline"
                    aria-label={`No, ${r.student_name} can't be ${r.wanted}`}
                    onClick={() => void answerTyped(r, false)}
                  >
                    No
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {namesElsewhere.size > 0 && (
        <ul className="teacher-waiting__elsewhere">
          {[...namesElsewhere].map(([id, c]) => (
            <li key={id}>
              {c.count} new player name{c.count === 1 ? '' : 's'} to check in <Link to={`/teacher/${id}`}>{c.name}</Link>
            </li>
          ))}
        </ul>
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
      {alerts.length > 0 && (
        <ul className="teacher-waiting__elsewhere">
          {alerts.map((a) => (
            <li key={a.id}>
              {a.text}
              {a.section && (
                <>
                  {' '}
                  <Link to={`/teacher/${classId}/${a.section}`} aria-label={`See: ${a.text}`}>
                    See ›
                  </Link>
                </>
              )}
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
