/**
 * Teachers' trophy tools (docs/plans/profile/PLAN.md card P12):
 * - TrophySeasonPanel: on the admin Overview, the hub's season number, days left, its length and a pause for the holidays.
 * - PupilTrophies: on a pupil's page, every trophy they hold, and "Reset avatar".
 * - NewTrophiesThisWeek: on Today, the class's game feats from the last 7 days, for shout-outs.
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AvatarImage } from '../avatar/AvatarImage';
import {
  fetchClassNewTrophies,
  fetchPupilTrophies,
  fetchTrophySeason,
  resetAvatar,
  saveTrophySeason,
  type ClassNewTrophy,
  type PupilTrophy,
  type TrophySeason,
} from '../data/trophyTools';
import { FriendlyError } from '../data/profile';
import { trophyPlace } from './cabinet';
import { TrophyArt } from './TrophyArt';
import './teacherTrophies.css';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const METAL: Record<string, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };

/** "Mon 17 Nov" from an NZ day (YYYY-MM-DD) or a timestamp. */
export function dayText(when: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(when) ? new Date(`${when}T12:00:00`) : new Date(when);
  return date.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Pacific/Auckland' });
}

/** The panel's main line, in plain words. */
export function seasonLine(s: TrophySeason): string {
  if (s.season < 1) return `Season 1 starts in ${plural(s.daysLeft, 'day')}.`;
  const left = s.daysLeft <= 1 ? 'Last day today' : `${plural(s.daysLeft, 'day')} left`;
  return `Season ${s.season}: ${left}${s.seasonEnd ? ` (ends ${dayText(s.seasonEnd)})` : ''}.`;
}

// ---------------------------------------------------------------- Admin: Trophy season

export function TrophySeasonPanel() {
  const [season, setSeason] = useState<TrophySeason | null>(null);
  const [days, setDays] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchTrophySeason().then(
      (s) => {
        setSeason(s);
        setDays(String(s.days));
      },
      (error) => setStatus(errorText(error)),
    );
  }, []);

  const save = useCallback(async (change: { days?: number; paused?: boolean }, done: (s: TrophySeason) => string) => {
    setStatus('Saving…');
    try {
      const s = await saveTrophySeason(change);
      setSeason(s);
      setDays(String(s.days));
      setStatus(done(s));
    } catch (error) {
      setStatus(errorText(error));
    }
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const n = Number(days);
    if (!Number.isInteger(n) || n < 7 || n > 366) {
      setStatus('A season must be 7 to 366 days long.');
      return;
    }
    void save({ days: n }, (s) => `Saved. Seasons are now ${s.days} days long.`);
  }

  return (
    <section className="panel trophy-season" aria-labelledby="trophy-season-title">
      <h2 id="trophy-season-title" className="panel__title">
        Trophy season
      </h2>
      {!season ? (
        <p className="panel__empty">{status ?? 'Loading…'}</p>
      ) : (
        <>
          <p className="trophy-season__line">
            <strong>{seasonLine(season)}</strong>
            {season.pausedSince && <span className="tag">Paused since {dayText(season.pausedSince)}</span>}
          </p>
          <p className="trophy-season__note">
            Pupils can win most trophies again each season, and their metal goes up: bronze, then silver, then gold. Dragon Maths
            keeps its own seasons.
          </p>
          <form className="trophy-season__form" onSubmit={submit}>
            <label className="teacher__filter">
              <span>Season length (days)</span>
              <input type="number" min={7} max={366} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
            </label>
            <button type="submit" className="button button--light-outline" disabled={Number(days) === season.days}>
              Save length
            </button>
            {season.pausedSince ? (
              <button
                type="button"
                className="button button--primary"
                onClick={() => void save({ paused: false }, (s) => `The clock is going again. ${seasonLine(s)}`)}
              >
                ▶️ Start the clock again
              </button>
            ) : (
              <button
                type="button"
                className="button button--light-outline"
                onClick={() =>
                  void save({ paused: true }, () => 'Paused. The days left stand still until you start the clock again.')
                }
              >
                ⏸️ Pause for the holidays
              </button>
            )}
          </form>
          <p className="trophy-season__note">
            A new length only moves this season’s last day. It can’t be shorter than the days this season has already run.
          </p>
        </>
      )}
      {season && (
        <p role="status" className="teacher__status">
          {status}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Pupil page: their trophies and Reset avatar

export function PupilTrophies({ student, name, onChanged }: { student: string; name: string; onChanged: () => void }) {
  const [trophies, setTrophies] = useState<PupilTrophy[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    fetchPupilTrophies(student).then(
      (t) => current && setTrophies(t),
      (error) => current && setFailed(errorText(error)),
    );
    return () => {
      current = false;
    };
  }, [student]);

  async function reset() {
    setConfirming(false);
    setStatus('Saving…');
    try {
      await resetAvatar(student);
      setStatus(`${name}’s avatar is reset. They’ll be asked to make a new one.`);
      onChanged();
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  return (
    <section className="panel pupil-trophies" aria-labelledby="pupil-trophies-title">
      <h2 id="pupil-trophies-title" className="panel__title">
        Trophies and avatar
      </h2>
      {!trophies ? (
        <p className="panel__empty">{failed ?? 'Loading…'}</p>
      ) : trophies.length === 0 ? (
        <p className="panel__empty">No trophies yet.</p>
      ) : (
        <ul className="pupil-trophies__list">
          {trophies.map((t) => (
            <li key={t.id} title={t.how}>
              <TrophyArt id={t.id} game={t.game} kind={t.kind} tier={t.tier} size={40} />
              <span>
                <strong>{t.name}</strong>
                <span className="pupil-trophies__meta">
                  {METAL[t.tier]} · {trophyPlace(t.game)}
                  {t.count > 1 ? ` · won ${t.count} times` : ''} · {dayText(t.lastAt)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {confirming ? (
        <div className="chess-confirm" role="group" aria-label="Confirm reset avatar">
          <p>
            Reset {name}’s avatar? They’ll see “Make your avatar” and start their look again. Their trophies and earned pictures
            stay.
          </p>
          <div className="person-panel__actions">
            <button type="button" className="button button--primary" onClick={() => void reset()}>
              Yes, reset
            </button>
            <button type="button" className="button button--light-outline" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="person-panel__actions">
          <button type="button" className="button button--light-outline" onClick={() => setConfirming(true)}>
            🔄 Reset avatar
          </button>
        </div>
      )}
      {status && (
        <p role="status" className="teacher__status">
          {status}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Today: New trophies this week

export function NewTrophiesThisWeek({ classId }: { classId: string }) {
  const [wins, setWins] = useState<ClassNewTrophy[] | null>(null);

  useEffect(() => {
    let current = true;
    void fetchClassNewTrophies(classId).then((w) => current && setWins(w));
    return () => {
      current = false;
    };
  }, [classId]);

  if (!wins) return null;
  return (
    <section className="panel class-trophies" aria-labelledby="class-trophies-title">
      <h2 id="class-trophies-title" className="panel__title">
        New trophies this week
      </h2>
      {wins.length === 0 ? (
        <p className="panel__empty">No new trophies in the last 7 days.</p>
      ) : (
        <ul className="class-trophies__list">
          {wins.map((w) => (
            <li key={`${w.player}-${w.id}-${w.at}`}>
              <AvatarImage avatar={w.avatar} size={36} />
              <span className="class-trophies__who">
                <strong>{w.name}</strong>
                <span>
                  {w.trophy} ({METAL[w.tier].toLowerCase()}) · {trophyPlace(w.game)} · {dayText(w.at)}
                </span>
              </span>
              <TrophyArt id={w.id} game={w.game} kind={w.kind} tier={w.tier} size={36} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
