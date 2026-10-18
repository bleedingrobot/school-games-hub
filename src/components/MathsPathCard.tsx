/**
 * "My maths path" on a student's home page: where they are on the maths ladder, a short "you moved up!" when they pass a skill, and
 * (until it is done or skipped) an offer of the warm-up that finds their starting place. It only appears when the class has auto
 * switched on, so a class that has not turned it on sees nothing new. Loaded on its own so the maths code stays out of the home
 * page's first download.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { fetchMyLadder, type MyLadder } from '../data/ladder';
import { hasFocus, isTeacherFocus } from '../../shared/maths/focus';
import { LADDER } from '../../shared/maths/ladder';
import { placeProgress } from '../../shared/maths/place';
import { LadderPath } from '../maths/LadderPath';
import '../maths/ladderPath.css';

const seenKey = (id: string) => `maths-path-seen:${id}`;
const read = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* the message just comes back next time */
  }
};

export default function MathsPathCard() {
  const { profile } = useAuth();
  const [data, setData] = useState<MyLadder | null>(null);
  const [passed, setPassed] = useState<string[] | null>(null);

  useEffect(() => {
    let current = true;
    fetchMyLadder().then(
      (d) => current && setData(d),
      () => undefined, // no path is better than a broken home page
    );
    return () => {
      current = false;
    };
  }, []);

  const ladder = data?.focus.ladder;
  const progress = data && ladder?.on ? placeProgress(data.facts, ladder, data.settings) : null;
  const where = progress?.current ?? null;
  const myId = profile?.id;

  // "You moved up!": the skill they were on last time, against the one they are on now.
  useEffect(() => {
    if (!progress || !myId) return;
    const now = where ? LADDER.indexOf(where) : LADDER.length;
    const before = read(seenKey(myId));
    const was = before === null ? -1 : before === 'done' ? LADDER.length : LADDER.findIndex((s) => s.id === before);
    if (before === null || was < 0) {
      write(seenKey(myId), where ? where.id : 'done');
      return;
    }
    if (now > was) {
      const names = progress.skills.filter((p) => p.skill.built && LADDER.indexOf(p.skill) >= was && LADDER.indexOf(p.skill) < now).map((p) => p.skill.label);
      if (names.length) setPassed(names);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress?.current?.id, progress?.secureCount, myId]);

  if (!data || !progress) return null;
  const teacherSkills = hasFocus(data.focus) && isTeacherFocus(data.focus) ? data.focus.skills : [];

  function dismiss() {
    if (myId) write(seenKey(myId), where ? where.id : 'done');
    setPassed(null);
  }

  return (
    <section className="panel" aria-labelledby="path-title">
      <h2 id="path-title" className="panel__title">
        <span aria-hidden="true">🪜</span> My maths path
      </h2>
      {passed && (
        <div className="moved-up" role="status">
          <p>
            <span aria-hidden="true">🎉</span> <strong>You moved up!</strong> {passed.length === 1 ? passed[0] : `${passed[0]} and more`} {passed.length === 1 ? 'is' : 'are'} secure now.
          </p>
          <button type="button" className="button button--light-outline" onClick={dismiss}>
            Great!
          </button>
        </div>
      )}
      {!ladder!.placed && (
        <div className="placement-offer">
          <p>Want the games to start in the right place? Answer about 10 quick questions. You can skip them.</p>
          <Link to="/placement" className="button button--primary">
            Find my starting place
          </Link>
        </div>
      )}
      <LadderPath progress={progress} facts={data.facts} teacherSkills={teacherSkills} />
    </section>
  );
}
