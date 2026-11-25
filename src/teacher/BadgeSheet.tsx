/**
 * /teacher/:classId/badges: the class's QR sign-in badges, to print and cut out (docs/BADGE-SIGN-IN-PLAN.md), and a search
 * for any pupil the teacher may see, to show or print one card (docs/plans/badge-review/ADD-PUPILS.md). Each card signs in
 * one pupil when scanned. "Lost card" makes that pupil a new one, so the old card stops working, and signs them out on every
 * device.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { findPupils, type FoundPupil } from '../data/addPupils';
import { fetchClassBadges, renewBadge, type PupilBadge } from '../data/badge';
import { FriendlyError } from '../data/profile';
import { BadgeCard, BigBadge, cardName, type CardPupil } from './BadgeCard';
import { printBadges } from './badgePrint';
import { useTeacherClass } from './TeacherClass';
import './badges.css';

export { QrCode, cardName } from './BadgeCard';

const errorText = (e: unknown) => (e instanceof FriendlyError ? e.message : 'Something went wrong. Please try again.');

/** Search any pupil I may see (a school admin: the whole school) and show or print their badge. */
export function FindPupil({ onShow }: { onShow: (p: CardPupil) => void }) {
  const [words, setWords] = useState('');
  const [found, setFound] = useState<FoundPupil[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const q = words.trim();
    if (q.length < 2) {
      setFound(null);
      return;
    }
    let live = true;
    const wait = window.setTimeout(() => {
      findPupils(q).then(
        (f) => {
          if (!live) return;
          setFound(f);
          setProblem(null);
        },
        (e: unknown) => live && setProblem(errorText(e)),
      );
    }, 300);
    return () => {
      live = false;
      window.clearTimeout(wait);
    };
  }, [words]);

  return (
    <div className="badges__find">
      <label className="badges__find-label">
        Find a pupil
        <input
          type="search"
          value={words}
          onChange={(e) => setWords(e.target.value)}
          placeholder="Name, email or player name"
          autoComplete="off"
        />
      </label>
      {problem && <p role="alert">{problem}</p>}
      {found?.length === 0 && <p role="status">No pupils found. Not signed in yet? Add them with <strong>Add new pupils</strong>.</p>}
      {found && found.length > 0 && (
        <ul className="badges__sheet badges__sheet--found" aria-label="Pupils found">
          {found.map((p) => (
            <BadgeCard key={p.player} pupil={p} className={p.className} onShow={() => onShow(p)} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function BadgeSheet() {
  const { classId, current } = useTeacherClass();
  const [badges, setBadges] = useState<PupilBadge[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [big, setBig] = useState<CardPupil | null>(null);
  const sheet = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!classId) return;
    let live = true;
    setBadges(null);
    fetchClassBadges(classId).then(
      (b) => live && setBadges(b),
      (e: unknown) => live && setProblem(errorText(e)),
    );
    return () => {
      live = false;
    };
  }, [classId]);

  const renew = async (b: PupilBadge) => {
    const name = cardName(b.realName) || b.displayName;
    if (!window.confirm(`Make a new badge for ${name}? Their old card will stop working, and they’ll be signed out on every device until they scan the new one.`)) return;
    try {
      const code = await renewBadge(b.player);
      setBadges((all) => all?.map((x) => (x.player === b.player ? { ...x, code } : x)) ?? null);
      setNotice(`New badge made for ${name}. Tap “Print this card” on it, and throw the old one away.`);
    } catch (e) {
      setNotice(errorText(e));
    }
  };

  if (!classId || !current) return null;
  return (
    <section className="panel badges" aria-labelledby="badges-title">
      <div className="badges__head">
        <h2 id="badges-title" className="panel__title">
          Sign-in badges: {current.name}
        </h2>
        <div className="badges__actions">
          <Link className="button button--light" to={`/teacher/${classId}/add-pupils`}>
            ➕ Add new pupils
          </Link>
          <button type="button" className="button button--primary" onClick={() => printBadges(sheet.current)} disabled={!badges?.length}>
            Print class badges
          </button>
        </div>
      </div>
      <p className="badges__note">
        Each card signs in one pupil, with no typing. They tap <strong>Scan my badge</strong> on the sign-in page and hold the
        card up to the camera, or point the iPad’s Camera app at it. A card is like a password: keep them in the classroom. If
        one is lost, tap <strong>Lost card</strong> to make a new one: the old card stops working and the pupil is signed out
        everywhere (within the hour), so nobody can keep playing as them.
      </p>
      <FindPupil onShow={setBig} />
      <p className="badges__note">
        Pupils who have never played can be added by school email with <Link to={`/teacher/${classId}/add-pupils`}>Add new pupils</Link>.
        Back to <Link to={`/teacher/${classId}/students`}>Students</Link>.
      </p>
      {notice && (
        <p role="status" className="badges__notice">
          {notice}
        </p>
      )}
      {problem && <p role="alert">{problem}</p>}
      {!badges && !problem && <p role="status">Loading…</p>}
      {badges?.length === 0 && <p>No pupils in this class yet.</p>}
      {badges && badges.length > 0 && (
        <ul ref={sheet} className="badges__sheet" aria-label={`Badges for ${current.name}`}>
          {badges.map((b) => (
            <BadgeCard key={b.player} pupil={b} className={current.name} onShow={() => setBig(b)}>
              <button type="button" className="button button--light badge-card__renew" onClick={() => void renew(b)}>
                Lost card
              </button>
            </BadgeCard>
          ))}
        </ul>
      )}
      {big && <BigBadge pupil={big} onClose={() => setBig(null)} />}
    </section>
  );
}
