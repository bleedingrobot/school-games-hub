/**
 * Maths Monsters on the teacher page: the game switch and the topics that are on, the class view
 * (each topic's answers, the hardest questions, badges, saves the server check turned down) and each
 * student's game. Loaded only when the teacher page opens.
 */
import { useEffect, useState } from 'react';
import { BandedPack } from '../../shared/maths/banded';
import { parseFactKey } from '../../shared/maths/facts';
import { BANDED_PACKS, TOPICS, type TopicId } from '../../shared/maths/skillPacks';
import { speciesOf } from '../../shared/monsters/monsterBook';
import {
  ALL_TOPICS, fetchClassMonsters, fetchMonstersSettings, fetchStudentMonsters, saveMonstersSettings,
  type ClassMonsters, type MonstersSettings, type StudentMonsters,
} from '../data/monsters';
import { FriendlyError } from '../data/profile';
import { useTeacherClass } from '../teacher/TeacherClass';
import { whenPlayed } from './Dashboard';
import './teacher-gem-keep.css';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');
const TOPIC_LABEL = Object.fromEntries(TOPICS.map((t) => [t.id, t.label])) as Record<TopicId, string>;
const share = (right: number, asked: number) => (asked ? `${Math.round((right / asked) * 100)}%` : '–');

const packs = new Map<string, BandedPack>();
/** A question's key in words a teacher can read: "7 + 8", "7 × 8" or what kind of question it is. */
export function keyLabel(pack: string, key: string): string {
  const times = parseFactKey(key);
  if (times) return `${times.a} × ${times.b}`;
  const sum = /^(add|sub):(\d+)([+-])(\d+)$/.exec(key);
  if (sum) return `${sum[2]} ${sum[3] === '+' ? '+' : '−'} ${sum[4]}`;
  if (pack in BANDED_PACKS) {
    if (!packs.has(pack)) packs.set(pack, new BandedPack(BANDED_PACKS[pack as keyof typeof BANDED_PACKS]));
    return packs.get(pack)!.labelOf(key) ?? key;
  }
  return key;
}

const REASON: Record<string, string> = {
  stale: 'saved from an out-of-date copy (another Chromebook?)',
  'pool-mismatch': 'monsters or exp that no battle explains',
  badge: 'a badge without a won Tower battle',
  paid: 'a prize without a won battle',
  bag: 'items that were never found',
  speed: 'walked faster than possible',
  pace: 'more battles than the steps allow',
  'answer-pace': 'answers faster than a person can give',
  'answer-time': 'answers with impossible times',
  'battle-answer': 'a battle answer that didn’t add up',
};
const reasonText = (code: string) => REASON[code] ?? `check failed (${code})`;

export function MonstersTeacherPanels() {
  return (
    <>
      <MonstersSettingsPanel />
      <MonstersClassPanel />
    </>
  );
}

function MonstersSettingsPanel() {
  const { classId, ready } = useTeacherClass();
  const [settings, setSettings] = useState<MonstersSettings | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    setSettings(null);
    setStatus(null);
    fetchMonstersSettings(classId)
      .then(setSettings)
      .catch((error) => setStatus(errorText(error)));
  }, [ready, classId]);

  async function change(next: MonstersSettings, message: string) {
    const before = settings;
    setSettings(next);
    setStatus('Saving…');
    try {
      await saveMonstersSettings(next, classId);
      setStatus(message);
    } catch (error) {
      setSettings(before);
      setStatus(errorText(error));
    }
  }

  return (
    <section className="panel gk-teacher teacher__switch" aria-labelledby="mm-settings-title">
      <h2 id="mm-settings-title" className="panel__title">
        Maths Monsters
      </h2>
      <p>
        A world to walk around where every attack and catch is a maths question. Switched off, it is hidden from students and nothing is saved.
      </p>
      {settings && (
        <>
          <p>{settings.enabled ? 'On: students can play it from the dashboard.' : 'Off: students can’t see it yet.'}</p>
          {settings.enabled ? (
            <button type="button" className="button button--danger" onClick={() => void change({ ...settings, enabled: false }, 'Maths Monsters is off.')}>
              Switch Maths Monsters off
            </button>
          ) : (
            <button type="button" className="button button--primary" onClick={() => void change({ ...settings, enabled: true }, 'Maths Monsters is on.')}>
              Switch Maths Monsters on
            </button>
          )}
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
                        void change(
                          { ...settings, topics: on ? settings.topics.filter((x) => x !== t) : ALL_TOPICS.filter((x) => x === t || settings.topics.includes(x)) },
                          'Saved. Students get the new topics next time they open Maths Monsters.',
                        )
                      }
                    />
                    <span>{TOPIC_LABEL[t]}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <p>
            A topic switched off is never asked: its questions come from the nearest topic that is on, so no area is ever blocked.
          </p>
        </>
      )}
      <p role="status" className="teacher__status">
        {status}
      </p>
    </section>
  );
}

function MonstersClassPanel() {
  const [data, setData] = useState<ClassMonsters | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    fetchClassMonsters()
      .then(setData)
      .catch((error) => setFailed(errorText(error)));
  }, []);

  return (
    <section className="panel gk-teacher" aria-labelledby="mm-class-title">
      <h2 id="mm-class-title" className="panel__title">
        Maths Monsters: the class
        {data && <span className="panel__count">{data.players} playing</span>}
      </h2>
      {failed ? (
        <p className="panel__empty">{failed}</p>
      ) : !data ? (
        <p className="panel__empty">Loading…</p>
      ) : data.players === 0 ? (
        <p className="panel__empty">No students have started Maths Monsters yet.</p>
      ) : (
        <div className="gk-teacher__class">
          <table className="stats-table">
            <caption>Each topic</caption>
            <thead>
              <tr>
                <th scope="col">Topic</th>
                <th scope="col">Right</th>
                <th scope="col">Asked</th>
                <th scope="col">Students</th>
              </tr>
            </thead>
            <tbody>
              {data.topics.map((t) => (
                <tr key={t.pack}>
                  <th scope="row">{TOPIC_LABEL[t.pack] ?? t.pack}</th>
                  <td>{share(t.correct, t.attempts)}</td>
                  <td>{t.attempts}</td>
                  <td>{t.students}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
                    <td>{TOPIC_LABEL[f.pack] ?? f.pack}</td>
                    <td>{share(f.correct, f.attempts)}</td>
                    <td>{f.attempts}</td>
                    <td>{f.students}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <table className="stats-table">
            <caption>Topic Tower badges</caption>
            <thead>
              <tr>
                <th scope="col">Students with at least</th>
                <th scope="col">Students</th>
              </tr>
            </thead>
            <tbody>
              {data.badges.map((n, i) => (
                <tr key={i}>
                  <th scope="row">
                    {i + 1} badge{i === 0 ? '' : 's'}
                  </th>
                  <td>{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.refusals.length > 0 && (
            <table className="stats-table">
              <caption>Saves the game turned down (last 2 weeks). Their last good save is untouched.</caption>
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

/** One student's Maths Monsters, inside their panel on the teacher page. */
export function MonstersStudentPanel({ student }: { student: string }) {
  const [data, setData] = useState<StudentMonsters | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    fetchStudentMonsters(student)
      .then((d) => current && setData(d))
      .catch((error) => current && setFailed(errorText(error)));
    return () => {
      current = false;
    };
  }, [student]);

  if (failed) return <p className="panel__empty">{failed}</p>;
  if (!data) return null;
  if (!data.save) return <p className="gk-teacher__none">Maths Monsters: not played yet.</p>;
  const { save } = data;
  return (
    <div className="gk-teacher__student">
      <h3 className="gk-teacher__heading">
        Maths Monsters: {save.owned} of 54 monsters, {save.badges} of 6 badges
      </h3>
      <p>
        Team: {save.team.map((m) => `${speciesOf(m.species).name} (level ${m.level})`).join(', ')}. Last saved {whenPlayed(save.savedAt)}.
        {data.refused > 0 && ` ${data.refused} save${data.refused === 1 ? '' : 's'} turned down this week.`}
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
                <th scope="row">{TOPIC_LABEL[t.pack] ?? t.pack}</th>
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
    </div>
  );
}
