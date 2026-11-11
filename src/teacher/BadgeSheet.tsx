/**
 * /teacher/:classId/badges: the class's QR sign-in badges, to print and cut out (docs/BADGE-SIGN-IN-PLAN.md). Each card
 * signs in one pupil when scanned. "Lost card" makes that pupil a new one, so the old card stops working, and signs
 * them out on every device.
 */
import qrcode from 'qrcode-generator';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { badgeLink, fetchClassBadges, renewBadge, type PupilBadge } from '../data/badge';
import { FriendlyError } from '../data/profile';
import { useTeacherClass } from './TeacherClass';
import './badges.css';

const errorText = (e: unknown) => (e instanceof FriendlyError ? e.message : 'Something went wrong. Please try again.');

/** "ava.kingi" → "Ava Kingi": the school email's name part, tidied for the card. */
export function cardName(realName: string): string {
  return realName
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** A QR code as one SVG path (black squares on white), with the usual 4-square quiet edge. */
export function QrCode({ text, label }: { text: string; label: string }) {
  const path = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    return { d, size: n + 8 };
  }, [text]);
  return (
    <svg className="badge-card__qr" viewBox={`0 0 ${path.size} ${path.size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={path.size} height={path.size} fill="#fff" />
      <path d={path.d} fill="#000" />
    </svg>
  );
}

export function BadgeSheet() {
  const { classId, current } = useTeacherClass();
  const [badges, setBadges] = useState<PupilBadge[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
      setNotice(`New badge made for ${name}. Print it and throw the old one away.`);
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
        <button type="button" className="button button--primary" onClick={() => window.print()} disabled={!badges?.length}>
          Print badges
        </button>
      </div>
      <p className="badges__note">
        Each card signs in one pupil, with no typing. They tap <strong>Scan my badge</strong> on the sign-in page and hold the
        card up to the camera, or point the iPad’s Camera app at it. A card is like a password: keep them in the classroom. If
        one is lost, tap <strong>Lost card</strong> to make a new one: the old card stops working and the pupil is signed out
        everywhere (within the hour), so nobody can keep playing as them.
      </p>
      <p className="badges__note">
        Only pupils in this class who have signed in once appear here. Back to <Link to={`/teacher/${classId}/students`}>Students</Link>.
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
        <ul className="badges__sheet">
          {badges.map((b) => {
            const name = cardName(b.realName) || b.displayName;
            return (
              <li key={b.player} className="badge-card">
                <QrCode text={badgeLink(b.code)} label={`Sign-in badge for ${name}`} />
                <div className="badge-card__words">
                  <p className="badge-card__name">{name}</p>
                  <p className="badge-card__player">{b.displayName}</p>
                  <p className="badge-card__class">{current.name} · School Games Hub</p>
                  <p className="badge-card__tip">📷 Scan me to play!</p>
                  <button type="button" className="button button--light badge-card__renew" onClick={() => void renew(b)}>
                    Lost card
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
