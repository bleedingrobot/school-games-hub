/**
 * Dragon Maths on the teacher page: the game switch (which also pauses the season clock for the holidays), forest
 * fights a day and the first season date; the class view (where the season is, how many heroes at each level, the
 * hardest questions, the requests the game turned down, and the Hall of Heroes); and each pupil's hero, with a
 * button to start their hero again. Loaded only when the teacher page opens.
 */
import { useEffect, useState } from 'react';
import { MAX_LEVEL } from '../../shared/lord/data';
import { ALL_TOPICS } from '../../shared/lord/maths';
import { TOPICS } from '../../shared/maths/skillPacks';
import {
  fetchClassLord, fetchLordSettings, fetchStudentLord, resetLordHero, saveLordSettings,
  type ClassLord, type LordSettings, type StudentLord,
} from '../data/lord';
import { FriendlyError } from '../data/profile';
import { useTeacherClass } from '../teacher/TeacherClass';
import { whenPlayed } from './Dashboard';
import { keyLabel } from './TeacherMonsters';
import './teacher-gem-keep.css';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');
const TOPIC_LABEL: Record<string, string> = { ...Object.fromEntries(TOPICS.map((t) => [t.id, t.label])), money: 'Gold and shopping', patterns: 'Number patterns' };
const topicLabel = (pack: string) => TOPIC_LABEL[pack] ?? pack;
const share = (right: number, asked: number) => (asked ? `${Math.round((right / asked) * 100)}%` : '–');

const REASON: Record<string, string> = {
  tampered: 'a fight that didn’t play out the way it was sent',
  stale: 'saved from an out-of-date copy (another Chromebook?)',
  'bad-request': 'a request the game could not read',
  tools: 'tried the test tools',
  proof: 'a maths answer the game could not read',
  'proof-pack': 'a question from the wrong topic',
  'proof-key': 'a question the game never asked',
  'proof-answer': 'an answer that was not a number',
  'proof-level': 'a question too hard or too easy for the hero',
  'proof-params': 'a question with numbers that did not fit',
  'proof-kind': 'a times-table question of an unknown kind',
};
const reasonText = (code: string) => REASON[code] ?? `check failed (${code})`;

export function LordTeacherPanels() {
  return (
    <>
      <LordSettingsPanel />
      <LordClassPanel />
    </>
  );
}

function LordSettingsPanel() {
  const { classId, ready } = useTeacherClass();
  const [settings, setSettings] = useState<LordSettings | null>(null);
  const [perDay, setPerDay] = useState('10');
  const [start, setStart] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    setSettings(null);
    setStatus(null);
    fetchLordSettings(classId)
      .then((s) => {
        setSettings(s);
        setPerDay(String(s.forestPerDay));
        setStart(s.seasonStart ?? '');
      })
      .catch((error) => setStatus(errorText(error)));
  }, [ready, classId]);

  async function save(change: Partial<LordSettings> & { enabled: boolean }, message: string) {
    setStatus('Saving…');
    try {
      const next = await saveLordSettings(change, classId);
      setSettings(next);
      setPerDay(String(next.forestPerDay));
      setStart(next.seasonStart ?? '');
      setStatus(message);
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  return (
    <section className="panel gk-teacher teacher__switch" aria-labelledby="dm-settings-title">
      <h2 id="dm-settings-title" className="panel__title">
        Dragon Maths
      </h2>
      <p>
        A fantasy adventure with a few fights a day and maths to help win them. Every five weeks everyone starts again. Switched off, pupils
        see the village gates closed, nothing is saved, and the season clock waits.
      </p>
      {settings && (
        <>
          <p>
            {settings.enabled
              ? 'On: pupils can play it.'
              : settings.pausedSince
                ? `Off since ${settings.pausedSince}: the season clock is paused (for the holidays).`
                : 'Off: pupils can’t play it yet.'}
          </p>
          {settings.enabled ? (
            <button type="button" className="button button--danger" onClick={() => void save({ enabled: false }, 'Dragon Maths is off, and the season clock is paused.')}>
              Switch Dragon Maths off (pause the season)
            </button>
          ) : (
            <button
              type="button"
              className="button button--primary"
              onClick={() => void save({ enabled: true }, settings.pausedSince ? 'Dragon Maths is on. The season carries on where it left off.' : 'Dragon Maths is on.')}
            >
              {settings.pausedSince ? 'Switch Dragon Maths on (carry on the season)' : 'Switch Dragon Maths on'}
            </button>
          )}
          <div className="gk-teacher__row">
            <label className="gk-teacher__pass">
              <span>Forest fights a day</span>
              <input type="number" min={1} max={30} value={perDay} onChange={(e) => setPerDay(e.target.value)} />
            </label>
            <button
              type="button"
              className="button button--light-outline"
              onClick={() => void save({ enabled: settings.enabled, forestPerDay: Number(perDay) }, 'Saved. Pupils get the new number from their next day.')}
            >
              Save forest fights
            </button>
          </div>
          <div className="gk-teacher__row">
            <label className="gk-teacher__pass">
              <span>First day of season 1</span>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <button
              type="button"
              className="button button--light-outline"
              disabled={!start}
              onClick={() => void save({ enabled: settings.enabled, seasonStart: start }, 'Saved. Seasons now run back to back from that day, 5 weeks each.')}
            >
              Save the date
            </button>
          </div>
          <fieldset className="choice-group">
            <legend>Topics on</legend>
            <div className="choice-group__chips">
              {ALL_TOPICS.map((t) => {
                const on = settings.topics.includes(t);
                return (
                  <label key={t} className="chip">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={on && settings.topics.length === 1}
                      onChange={() =>
                        void save(
                          { enabled: settings.enabled, topics: on ? settings.topics.filter((x) => x !== t) : ALL_TOPICS.filter((x) => x === t || settings.topics.includes(x)) },
                          'Saved. Pupils get the new topics the next time they open Dragon Maths.',
                        )
                      }
                    />
                    <span>{topicLabel(t)}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <p>
            A topic switched off is never asked: a question comes from a topic that is still on, and forest events about it stay out of the forest. Leave at least one on.
          </p>
          <p>
            Seasons run 35 days, one after the other, and everyone starts again at level 1 (dragon stars, achievements and the Hall of Heroes stay).
            Switch the game off for the school holidays and on again after: the season carries on where it left off.
          </p>
        </>
      )}
      <p role="status" className="teacher__status">
        {status}
      </p>
    </section>
  );
}

function LordClassPanel() {
  const [data, setData] = useState<ClassLord | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    fetchClassLord()
      .then(setData)
      .catch((error) => setFailed(errorText(error)));
  }, []);

  return (
    <section className="panel gk-teacher" aria-labelledby="dm-class-title">
      <h2 id="dm-class-title" className="panel__title">
        Dragon Maths: the class
        {data && <span className="panel__count">{data.thisSeason} playing this season</span>}
      </h2>
      {failed ? (
        <p className="panel__empty">{failed}</p>
      ) : !data ? (
        <p className="panel__empty">Loading…</p>
      ) : (
        <div className="gk-teacher__class">
          <p>
            {data.season.number
              ? `Season ${data.season.number}, ${data.season.daysLeft === 0 ? 'last day' : `${data.season.daysLeft} days left`}. ${data.players} ${data.players === 1 ? 'pupil has' : 'pupils have'} a hero.`
              : 'The first season has not started yet.'}
          </p>
          {data.season.number && data.thisSeason > 0 && (
            <table className="stats-table">
              <caption>Heroes at each level this season</caption>
              <thead>
                <tr>
                  <th scope="col">Level</th>
                  <th scope="col">Heroes</th>
                </tr>
              </thead>
              <tbody>
                {data.levels.map((n, i) => (
                  <tr key={i}>
                    <th scope="row">{i + 1 === MAX_LEVEL ? `${i + 1} (the dragon is next)` : i + 1}</th>
                    <td>{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <table className="stats-table">
            <caption>Hardest questions (most often wrong)</caption>
            <thead>
              <tr>
                <th scope="col">Question</th>
                <th scope="col">Topic</th>
                <th scope="col">Right</th>
                <th scope="col">Asked</th>
                <th scope="col">Students</th>
              </tr>
            </thead>
            <tbody>
              {data.hardest.length === 0 ? (
                <tr>
                  <td colSpan={5}>Not enough answers yet.</td>
                </tr>
              ) : (
                data.hardest.map((f) => (
                  <tr key={`${f.pack}/${f.key}`}>
                    <th scope="row">{keyLabel(f.pack, f.key)}</th>
                    <td>{topicLabel(f.pack)}</td>
                    <td>{share(f.correct, f.attempts)}</td>
                    <td>{f.attempts}</td>
                    <td>{f.students}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <table className="stats-table">
            <caption>Hall of Heroes</caption>
            <thead>
              <tr>
                <th scope="col">Season</th>
                <th scope="col">Hero</th>
                <th scope="col">Dragons beaten</th>
              </tr>
            </thead>
            <tbody>
              {data.hall.length === 0 ? (
                <tr>
                  <td colSpan={3}>Nobody has beaten the Red Dragon yet.</td>
                </tr>
              ) : (
                data.hall.map((h, i) => (
                  <tr key={i}>
                    <th scope="row">{h.season}</th>
                    <td>{h.realName || h.name}</td>
                    <td>{h.kills}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {data.refusals.length > 0 && (
            <table className="stats-table">
              <caption>Requests the game turned down (last 2 weeks). Nothing was changed for them.</caption>
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">What was wrong</th>
                  <th scope="col">When</th>
                </tr>
              </thead>
              <tbody>
                {data.refusals.map((r, i) => (
                  <tr key={i}>
                    <th scope="row">{r.realName || r.name}</th>
                    <td>{reasonText(r.reason)}</td>
                    <td>{whenPlayed(r.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}

/** One student's Dragon Maths, inside their panel on the teacher page. */
export function LordStudentPanel({ student }: { student: string }) {
  const [data, setData] = useState<StudentLord | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let current = true;
    fetchStudentLord(student)
      .then((d) => current && setData(d))
      .catch((error) => current && setFailed(errorText(error)));
    return () => {
      current = false;
    };
  }, [student, version]);

  async function reset() {
    setStatus('Resetting…');
    try {
      await resetLordHero(student);
      setConfirming(false);
      setStatus('Done. They will pick a class next time they play.');
      setVersion((v) => v + 1);
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  if (failed) return <p className="panel__empty">{failed}</p>;
  if (!data) return null;
  if (!data.hero) {
    return (
      <>
        <p className="gk-teacher__none">Dragon Maths: no hero.</p>
        {status && <p role="status" className="teacher__status">{status}</p>}
      </>
    );
  }
  const { hero } = data;
  const stats = hero.stats;
  return (
    <div className="gk-teacher__student">
      <h3 className="gk-teacher__heading">
        Dragon Maths: level {hero.level} {hero.heroClass}, season {hero.season}
        {hero.stars > 0 && `, ${hero.stars} dragon ${hero.stars === 1 ? 'star' : 'stars'}`}
      </h3>
      <p>
        Last saved {whenPlayed(hero.savedAt)}.
        {stats &&
          ` All seasons: ${stats.forestWins} forest wins, ${stats.masterWins} masters, ${stats.arenaWins} arena wins, ${stats.riddles} right answers, ${stats.dragons} dragons.`}
        {data.refused > 0 && ` ${data.refused} request${data.refused === 1 ? '' : 's'} turned down this week.`}
      </p>
      {data.topics.length > 0 && (
        <table className="stats-table">
          <caption>How they are getting on in each topic</caption>
          <thead>
            <tr>
              <th scope="col">Topic</th>
              <th scope="col">Right</th>
              <th scope="col">Asked</th>
              <th scope="col">Fluent facts</th>
            </tr>
          </thead>
          <tbody>
            {data.topics.map((t) => (
              <tr key={t.pack}>
                <th scope="row">{topicLabel(t.pack)}</th>
                <td>{share(t.correct, t.attempts)}</td>
                <td>{t.attempts}</td>
                <td>
                  {t.fluent} of {t.facts}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data.hardest.length > 0 && (
        <table className="stats-table">
          <caption>Their hardest questions (most often wrong)</caption>
          <thead>
            <tr>
              <th scope="col">Question</th>
              <th scope="col">Topic</th>
              <th scope="col">Right</th>
              <th scope="col">Asked</th>
            </tr>
          </thead>
          <tbody>
            {data.hardest.map((f) => (
              <tr key={`${f.pack}/${f.key}`}>
                <th scope="row">{keyLabel(f.pack, f.key)}</th>
                <td>{topicLabel(f.pack)}</td>
                <td>{share(f.correct, f.attempts)}</td>
                <td>{f.attempts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {confirming ? (
        <p>
          Start this hero again from level 1? Their points, achievements and Hall of Heroes entries stay.{' '}
          <button type="button" className="button button--danger" onClick={() => void reset()}>
            Yes, reset the hero
          </button>{' '}
          <button type="button" className="button button--light-outline" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </p>
      ) : (
        <button type="button" className="button button--light-outline" onClick={() => setConfirming(true)}>
          Reset this hero…
        </button>
      )}
      {status && (
        <p role="status" className="teacher__status">
          {status}
        </p>
      )}
    </div>
  );
}
