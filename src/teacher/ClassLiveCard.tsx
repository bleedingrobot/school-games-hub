/**
 * The Class Live card near the top of the teacher's Today page (James, 25 Nov 2026 NZ): every Class Live game as a
 * small painted tile. A tile opens the Class Live page on that game's options; the button opens the game picker.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { fetchClassLiveTimes, type ClassLiveTime } from '../data/classliveTimes';
import { LIVE_GAMES, liveGame } from '../games/classlive/gameList';
import { classliveOn } from '../games/classlive/switch';
import { painted } from '../games/classlive/paintedArt';
import { showdownOn } from '../games/showdown/switch';
import './class-live-card.css';

export function ClassLiveCard({ classId }: { classId: string }) {
  if (!classliveOn()) return null;
  const base = `/teacher/${classId}/classlive`;
  const games = LIVE_GAMES.filter((g) => g.id !== 'showdown' || showdownOn());
  const hall = painted('pick', 'hall', true);
  return (
    <section className="panel cl-today" aria-labelledby="cl-today-title" style={hall ? { ['--hall' as string]: `url(${hall})` } : undefined}>
      <div className="cl-today__top">
        <div>
          <h2 id="cl-today-title" className="cl-today__title">🌟 Class Live</h2>
          <p className="cl-today__sub">Whole-class games on the big screen. Pupils join on their iPads.</p>
        </div>
        <Link className="cl-today__go" to={base}>Open Class Live →</Link>
      </div>
      <ul className="cl-today__games">
        {games.map((g) => {
          const pic = g.pic();
          return (
            <li key={g.id}>
              <Link className="cl-today__game" to={`${base}?pick=${g.id}`} style={{ ['--tint' as string]: g.tint }}>
                <span className="cl-today__pic" aria-hidden="true">{pic ? <img src={pic} alt="" loading="lazy" /> : <i>{g.emoji}</i>}</span>
                <b>{g.name}</b>
              </Link>
            </li>
          );
        })}
      </ul>
      <SetTimes />
    </section>
  );
}

const DAY_WORDS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SHOWN = 3;

/** NZ weekday (1 Monday to 7 Sunday) and minutes past midnight. */
function nzNow(at: number): { day: number; mins: number } {
  const parts = new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(at));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = DAY_WORDS.indexOf(get('weekday').slice(0, 3));
  return { day: day > 0 ? day : 1, mins: Number(get('hour')) * 60 + Number(get('minute')) };
}

const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};

/** The next starts of the school's set-time games (PR #831), soonest first. */
export function nextStarts(times: ClassLiveTime[], now: number): { key: string; activity: string; when: string; inMins: number }[] {
  const { day, mins } = nzNow(now);
  const out: { key: string; activity: string; when: string; inMins: number }[] = [];
  for (const t of times) {
    if (!t.on) continue;
    const [h, m] = t.at.split(':').map(Number);
    const at = h * 60 + m;
    // Only each time's next start.
    const ahead = Math.min(...t.days.map((d) => {
      const days = (d - day + 7) % 7;
      return (days === 0 && at <= mins ? 7 : days) * 1440 + at - mins;
    }));
    const daysOut = Math.floor((ahead + mins) / 1440);
    const when = daysOut === 0 ? `Today ${clock(t.at)}` : daysOut === 1 ? `Tomorrow ${clock(t.at)}` : `${DAY_WORDS[((day - 1 + daysOut) % 7) + 1]} ${clock(t.at)}`;
    out.push({ key: `${t.id}`, activity: t.activity, when, inMins: ahead });
  }
  return out.sort((a, b) => a.inMins - b.inMins);
}

/** School admins see the next set-time games and a link to change them (only admins can read the times). */
function SetTimes() {
  const { profile } = useAuth();
  const admin = profile?.school_admin === true;
  const [times, setTimes] = useState<ClassLiveTime[] | null>(null);
  useEffect(() => {
    if (!admin) return;
    let live = true;
    fetchClassLiveTimes().then((t) => { if (live) setTimes(t); }, () => { if (live) setTimes(null); });
    return () => { live = false; };
  }, [admin]);
  if (!admin) return null;
  const next = times ? nextStarts(times, Date.now()).slice(0, SHOWN) : [];
  return (
    <div className="cl-today__times">
      <span className="cl-today__times-label">⏰ Set-time games</span>
      {times && next.length === 0 && <span className="cl-today__none">None set yet</span>}
      {next.map((n) => {
        const g = liveGame(n.activity);
        return <span key={n.key} className="cl-today__time"><span aria-hidden="true">{g?.emoji}</span> {g?.name ?? n.activity} <b>{n.when}</b></span>;
      })}
      <Link className="cl-today__set" to="/teacher/admin/classlive">{times && next.length === 0 ? 'Set times' : 'Change times'} →</Link>
    </div>
  );
}
