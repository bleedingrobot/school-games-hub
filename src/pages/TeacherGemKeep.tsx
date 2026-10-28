/**
 * Gem Keep on the teacher pages: its settings and class report in the Games table's drawer (for the header's class), and each
 * student's levels and 12 × 12 times-table grid. Loaded only when opened, so the levels and maths code stay out of everyone
 * else's download.
 */
import { useEffect, useRef, useState } from 'react';
import { CAMPAIGN } from '../../shared/gem-keep/levels';
import { TABLES } from '../../shared/maths/config';
import { factKey, parseFactKey } from '../../shared/maths/facts';
import { mastery, type FactStats, type Mastery } from '../../shared/maths/leitner';
import {
  fetchClassGemKeep,
  fetchGemKeepSettings,
  fetchStudentGemKeep,
  saveGemKeepSettings,
  type ClassGemKeep,
  type StudentGemKeep,
} from '../data/gemKeep';
import { FriendlyError } from '../data/profile';
import { SettingChips, SettingChoice, SettingNumber, SettingToggle, useSetting, type Choice } from '../teacher/Settings';
import type { GemKeepSettings } from '../games/gem-keep/settings';
import './teacher-gem-keep.css';

function errorText(error: unknown) {
  return error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.';
}

const levelName = (id: string) => {
  const i = CAMPAIGN.findIndex((l) => l.id === id);
  return i < 0 ? id : `${i + 1}. ${CAMPAIGN[i].name}`;
};

const factLabel = (key: string) => {
  const f = parseFactKey(key);
  return f ? `${f.a} × ${f.b}` : key;
};

const share = (right: number, asked: number) => (asked ? `${Math.round((right / asked) * 100)}%` : '–');

export const MASTERY: Record<Mastery, { label: string; mark: string; about: string }> = {
  'not-tried': { label: 'Not tried', mark: '', about: 'not asked yet' },
  learning: { label: 'Learning', mark: 'L', about: 'still getting it wrong or slow' },
  secure: { label: 'Secure', mark: 'S', about: 'right, getting quicker' },
  fluent: { label: 'Fluent', mark: 'F', about: 'right and quick on two different days' },
};

/**
 * The drawer on the Games table (docs/TEACHER-VIEW-PLAN.md, 4.5), for the header's class: Gem Keep's settings, then its class
 * report. Gem Keep is always on, so there is no switch here.
 */
export function GemKeepTeacherSettings({ classId }: { classId: string }) {
  return (
    <>
      <GemKeepSettingsPanel classId={classId} />
      <GemKeepClassReport classId={classId} />
    </>
  );
}

const MODES: Choice<GemKeepSettings['mode']>[] = [
  { value: 'calm', label: 'Calm', detail: 'The game pauses while a question is up.' },
  { value: 'challenge', label: 'Challenge', detail: 'The game keeps going, slowly, while a question is up.' },
];

type Missing = 'level-4' | 'always' | 'never';
const MISSING: Choice<Missing>[] = [
  { value: 'level-4', label: 'From level 4' },
  { value: 'always', label: 'Always' },
  { value: 'never', label: 'Never' },
];
const toMissing = (m: GemKeepSettings['missingFactor']): Missing => (m === undefined ? 'level-4' : m ? 'always' : 'never');
const fromMissing = (m: Missing): GemKeepSettings['missingFactor'] => (m === 'level-4' ? undefined : m === 'always');

type Answer = 'typing' | 'choice';
const ANSWERS: Choice<Answer>[] = [
  { value: 'typing', label: 'Typing', detail: 'Students type each answer.' },
  { value: 'choice', label: 'Multiple choice', detail: 'Students pick from four answers.' },
];

const TABLE_CHIPS = TABLES.map((t) => ({ value: t as number, label: `×${t}` }));

function GemKeepSettingsPanel({ classId }: { classId: string }) {
  const loaded = useSetting(() => fetchGemKeepSettings(classId), [classId]);
  const s = loaded.value;
  // Gem Keep saves all its settings at once, so each control's save starts from the newest settings, one save at a time
  // (two quick changes to different controls can't undo each other).
  const latest = useRef<GemKeepSettings | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    latest.current = loaded.value;
  }, [loaded.value]);

  function saver<K extends keyof GemKeepSettings>(key: K) {
    return (value: GemKeepSettings[K]) => {
      const run = queue.current.then(async () => {
        const before = latest.current;
        if (!before) throw new Error('not loaded');
        const next = { ...before, [key]: value };
        latest.current = next;
        try {
          await saveGemKeepSettings(next, classId);
        } catch (error) {
          if (latest.current) latest.current = { ...latest.current, [key]: before[key] };
          throw error;
        }
      });
      queue.current = run.catch(() => undefined);
      return run;
    };
  }
  const failed = loaded.failed;

  return (
    <section className="panel gk-teacher teacher__switch" aria-labelledby="gk-settings-title">
      <h2 id="gk-settings-title" className="panel__title">
        Gem Keep settings
      </h2>
      <p>Changes reach students the next time they open Gem Keep.</p>
      <SettingChoice label="Questions" options={MODES} value={s?.mode ?? null} loadFailed={failed} save={saver('mode')} />
      <SettingChips
        label="Times tables on"
        about="The levels decide which times tables come up; here you can switch tables off."
        options={TABLE_CHIPS}
        value={s?.enabledTables ?? null}
        loadFailed={failed}
        save={saver('enabledTables')}
      />
      <SettingChoice
        label="Missing numbers"
        about="Questions like ? × 8 = 56. From level 4 means they start at the fourth level of the campaign."
        options={MISSING}
        value={s ? toMissing(s.missingFactor) : null}
        loadFailed={failed}
        save={(m) => saver('missingFactor')(fromMissing(m))}
      />
      <SettingToggle label="Division questions" about="Questions like 56 ÷ 8." value={s?.division ?? null} loadFailed={failed} save={saver('division')} />
      <SettingChoice
        label="How students answer"
        options={ANSWERS}
        value={s ? (s.multipleChoice ? 'choice' : 'typing') : null}
        loadFailed={failed}
        save={(a) => saver('multipleChoice')(a === 'choice')}
      />
      <SettingNumber
        label="Level Key pass mark"
        about="Right answers out of 10 a student needs to pass a Level Key, which opens the next level."
        min={5}
        max={10}
        suffix="out of 10"
        value={s?.keyPassMark ?? null}
        loadFailed={failed}
        save={saver('keyPassMark')}
      />
    </section>
  );
}

/** How the class is getting on: its hardest facts and how far its students have got. */
function GemKeepClassReport({ classId }: { classId: string }) {
  const [data, setData] = useState<ClassGemKeep | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setData(null);
    setFailed(null);
    fetchClassGemKeep(classId)
      .then((d) => current && setData(d))
      .catch((error) => current && setFailed(errorText(error)));
    return () => {
      current = false;
    };
  }, [classId]);

  return (
    <section className="panel gk-teacher" aria-labelledby="gk-class-title">
      <h2 id="gk-class-title" className="panel__title">
        Gem Keep: this class
        {data && <span className="panel__count">{data.players} playing</span>}
      </h2>
      {failed ? (
        <p className="panel__empty">{failed}</p>
      ) : !data ? (
        <p className="panel__empty">Loading…</p>
      ) : data.players === 0 ? (
        <p className="panel__empty">
          No students in this class have played Gem Keep since the new season started.
        </p>
      ) : (
        <div className="gk-teacher__class">
          <table className="stats-table">
            <caption>Hardest facts (most often wrong)</caption>
            <thead>
              <tr>
                <th scope="col">Fact</th>
                <th scope="col">Right</th>
                <th scope="col">Asked</th>
                <th scope="col">Students</th>
              </tr>
            </thead>
            <tbody>
              {data.hardest.length === 0 ? (
                <tr>
                  <td colSpan={4}>Not enough answers yet.</td>
                </tr>
              ) : (
                data.hardest.map((f) => (
                  <tr key={f.key}>
                    <th scope="row">{factLabel(f.key)}</th>
                    <td>{share(f.correct, f.attempts)}</td>
                    <td>{f.attempts}</td>
                    <td>{f.students}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <table className="stats-table">
            <caption>How far students have got</caption>
            <thead>
              <tr>
                <th scope="col">Level</th>
                <th scope="col">Won</th>
                <th scope="col">Key passed</th>
              </tr>
            </thead>
            <tbody>
              {CAMPAIGN.map((level) => {
                const row = data.levels.find((l) => l.levelId === level.id);
                return (
                  <tr key={level.id}>
                    <th scope="row">{levelName(level.id)}</th>
                    <td>{row?.won ?? 0}</td>
                    <td>{row?.keys ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const keysText = (keys: number) => `${keys} Level Key${keys === 1 ? '' : 's'} passed`;

/** One line for the student's folded Games row: "12 of 30 stars, 4 Level Keys passed", or nothing before they've played. */
export async function gemKeepStudentSummary(student: string): Promise<string | null> {
  const data = await fetchStudentGemKeep(student);
  if (data.levels.length === 0) return null;
  const stars = data.levels.reduce((n, l) => n + l.stars, 0);
  return `${stars} of ${CAMPAIGN.length * 3} stars, ${keysText(data.levels.filter((l) => l.keyPassed).length)}`;
}

/** One student's Gem Keep, inside their panel on the teacher page. */
export function GemKeepStudentPanel({ student }: { student: string }) {
  const [data, setData] = useState<StudentGemKeep | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    fetchStudentGemKeep(student)
      .then((d) => current && setData(d))
      .catch((error) => current && setFailed(errorText(error)));
    return () => {
      current = false;
    };
  }, [student]);

  if (failed) return <p className="panel__empty">{failed}</p>;
  if (!data) return null;
  if (data.levels.length === 0 && data.facts.length === 0) {
    return <p className="gk-teacher__none">Gem Keep: not played yet.</p>;
  }
  const stars = data.levels.reduce((n, l) => n + l.stars, 0);
  const keys = data.levels.filter((l) => l.keyPassed).length;
  return (
    <div className="gk-teacher__student">
      <h3 className="gk-teacher__heading">
        Gem Keep: {stars} of {CAMPAIGN.length * 3} stars, {keysText(keys)}
      </h3>
      <ol className="gk-teacher__levels" aria-label="Gem Keep levels">
        {CAMPAIGN.map((level) => {
          const row = data.levels.find((l) => l.levelId === level.id);
          return (
            <li key={level.id} data-played={!!row || undefined}>
              <span className="gk-teacher__level-name">{levelName(level.id)}</span>
              <span aria-label={`${row?.stars ?? 0} stars`}>{'★'.repeat(row?.stars ?? 0) || '–'}</span>
              {row?.keyPassed && <span aria-label="Level Key passed">🗝️</span>}
            </li>
          );
        })}
      </ol>
      <FactGrid facts={data.facts} />
    </div>
  );
}

/** The 12 × 12 grid: each square is one fact, coloured by how well it's known. */
export function FactGrid({ facts }: { facts: FactStats[] }) {
  const byKey = new Map(facts.map((f) => [f.key, f]));
  return (
    <div className="gk-grid-wrap">
      <table className="gk-grid">
        <caption>Times tables: how well each fact is known</caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">times</span>×
            </th>
            {TABLES.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TABLES.map((r) => (
            <tr key={r}>
              <th scope="row">{r}</th>
              {TABLES.map((c) => {
                const stats = byKey.get(factKey(r, c));
                const m = mastery(stats);
                const detail = stats?.attempts ? `, ${stats.correct} of ${stats.attempts} right` : '';
                return (
                  <td key={c} data-mastery={m} title={`${r} × ${c}: ${MASTERY[m].label}${detail}`}>
                    <span aria-hidden="true">{MASTERY[m].mark}</span>
                    <span className="sr-only">
                      {r} × {c}: {MASTERY[m].label}
                      {detail}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="gk-grid__legend" aria-label="Key">
        {(Object.keys(MASTERY) as Mastery[]).map((m) => (
          <li key={m}>
            <span className="gk-grid__swatch" data-mastery={m} aria-hidden="true">
              {MASTERY[m].mark}
            </span>
            <span>
              <strong>{MASTERY[m].label}</strong>: {MASTERY[m].about}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
