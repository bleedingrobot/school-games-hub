/**
 * Maths Monsters on the teacher pages: the topics that are on and the class report (each topic's answers, the hardest
 * questions, badges, saves the server check turned down) in the Games table's drawer, for the header's class; and each
 * student's game. Loaded only when opened. The on/off switch is in the Games table row (src/games/monsters/teacher.ts).
 */
import { useEffect, useState } from 'react';
import { BandedPack } from '../../shared/maths/banded';
import { parseFactKey } from '../../shared/maths/facts';
import { BANDED_PACKS, TOPICS, type TopicId } from '../../shared/maths/skillPacks';
import type { PackDefinition } from '../../shared/maths/banded';
import { EARLY_FACTS } from '../../shared/maths/skillPacks/earlyFacts';
import { GENERATED } from '../../shared/maths/skillPacks/generated';
import { speciesOf } from '../../shared/monsters/monsterBook';
import {
  ALL_TOPICS, fetchClassMonsters, fetchMonstersSettings, fetchStudentMonsters, saveMonstersTopics,
  type ClassMonsters, type StudentMonsters,
} from '../data/monsters';
import { FriendlyError } from '../data/profile';
import { SettingChips, useSetting } from '../teacher/Settings';
import { whenPlayed } from './Dashboard';
import './teacher-gem-keep.css';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');
/** The ladder's own packs, which Maths Monsters doesn't ask but whose records show here too. */
const LADDER_PACKS: Record<string, PackDefinition> = { 'early-facts': EARLY_FACTS, generated: GENERATED };
export const TOPIC_LABEL: Record<string, string> = {
  ...(Object.fromEntries(TOPICS.map((t) => [t.id, t.label])) as Record<TopicId, string>),
  ...Object.fromEntries(Object.entries(LADDER_PACKS).map(([id, def]) => [id, def.label])),
};
const share = (right: number, asked: number) => (asked ? `${Math.round((right / asked) * 100)}%` : '–');

const packs = new Map<string, BandedPack>();
/** A question's key in words a teacher can read: "7 + 8", "7 × 8" or what kind of question it is. */
export function keyLabel(pack: string, key: string): string {
  const times = parseFactKey(key);
  if (times) return `${times.a} × ${times.b}`;
  const sum = /^(add|sub):(\d+)([+-])(\d+)$/.exec(key);
  if (sum) return `${sum[2]} ${sum[3] === '+' ? '+' : '−'} ${sum[4]}`;
  const definition = pack in BANDED_PACKS ? BANDED_PACKS[pack as keyof typeof BANDED_PACKS] : LADDER_PACKS[pack];
  if (definition) {
    if (!packs.has(pack)) packs.set(pack, new BandedPack(definition));
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

/**
 * The drawer on the Games table (docs/TEACHER-VIEW-PLAN.md, 4.5), for the header's class: the topics, then the class report.
 * The on/off switch is in the table row.
 */
export function MonstersTeacherSettings({ classId }: { classId: string }) {
  return (
    <>
      <MonstersTopicsPanel classId={classId} />
      <MonstersClassReport classId={classId} />
    </>
  );
}

const TOPIC_CHIPS = ALL_TOPICS.map((t) => ({ value: t, label: TOPIC_LABEL[t] }));

function MonstersTopicsPanel({ classId }: { classId: string }) {
  const settings = useSetting(() => fetchMonstersSettings(classId), [classId]);
  return (
    <section className="panel gk-teacher teacher__switch" aria-labelledby="mm-settings-title">
      <h2 id="mm-settings-title" className="panel__title">
        Maths Monsters settings
      </h2>
      <SettingChips
        label="Topics on"
        about="A topic switched off is never asked: its questions come from the nearest topic that is on, so no area is ever blocked. Students get the new topics the next time they open Maths Monsters."
        options={TOPIC_CHIPS}
        value={settings.value?.topics ?? null}
        loadFailed={settings.failed}
        save={(topics) => saveMonstersTopics(topics, classId)}
      />
      {settings.value?.enabled === false && (
        <p className="panel__empty">Maths Monsters is off for this class, so this only matters once it’s on.</p>
      )}
    </section>
  );
}

/** How the class is getting on: each topic, the hardest questions, badges, and saves the server check turned down. */
function MonstersClassReport({ classId }: { classId: string }) {
  const [data, setData] = useState<ClassMonsters | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setData(null);
    setFailed(null);
    fetchClassMonsters(classId)
      .then((d) => current && setData(d))
      .catch((error) => current && setFailed(errorText(error)));
    return () => {
      current = false;
    };
  }, [classId]);

  return (
    <section className="panel gk-teacher" aria-labelledby="mm-class-title">
      <h2 id="mm-class-title" className="panel__title">
        Maths Monsters: this class
        {data && <span className="panel__count">{data.players} playing</span>}
      </h2>
      {failed ? (
        <p className="panel__empty">{failed}</p>
      ) : !data ? (
        <p className="panel__empty">Loading…</p>
      ) : data.players === 0 ? (
        <p className="panel__empty">No students in this class have started Maths Monsters yet.</p>
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
          {/* Five columns don't fit a phone: this one table scrolls sideways inside its card (and can be scrolled from the
              keyboard once focused). */}
          <div className="gk-teacher__wide" tabIndex={0} role="group" aria-label="Hardest questions">
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
          </div>
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

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** One line for the student's folded Games row: "12 of 54 monsters, 2 of 6 badges", or nothing before they've played. */
export async function monstersStudentSummary(student: string): Promise<string | null> {
  const data = await fetchStudentMonsters(student);
  if (!data.save) return null;
  return `${data.save.owned} of 54 monsters, ${data.save.badges} of 6 badges${data.refused > 0 ? `, ${plural(data.refused, 'save')} turned down` : ''}`;
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
