/**
 * Gem Keep on the teacher page: the school-wide settings, the class's hardest facts, and each
 * student's levels and 12 × 12 times-table grid. Loaded only when the teacher page opens, so
 * the levels and maths code stay out of everyone else's download.
 */
import { useEffect, useState } from 'react';
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
import { useTeacherClass } from '../teacher/TeacherClass';
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

/** The school-wide Gem Keep settings and the class view. */
export function GemKeepTeacherPanels() {
  return (
    <>
      <GemKeepSettingsPanel />
      <GemKeepClassPanel />
    </>
  );
}

function GemKeepSettingsPanel() {
  const { classId, ready } = useTeacherClass();
  const [settings, setSettings] = useState<GemKeepSettings | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    setSettings(null);
    setStatus(null);
    fetchGemKeepSettings(classId)
      .then(setSettings)
      .catch((error) => setStatus(errorText(error)));
  }, [ready, classId]);

  async function change(next: GemKeepSettings) {
    const before = settings;
    setSettings(next);
    setStatus('Saving…');
    try {
      await saveGemKeepSettings(next, classId);
      setStatus('Saved. Students get the new settings next time they open Gem Keep.');
    } catch (error) {
      setSettings(before);
      setStatus(errorText(error));
    }
  }

  return (
    <section className="panel gk-teacher" aria-labelledby="gk-settings-title">
      <h2 id="gk-settings-title" className="panel__title">
        Gem Keep settings
      </h2>
      <p>For every student. The levels decide which times tables come up; here you can switch tables off.</p>
      {settings && (
        <div className="gk-teacher__settings">
          <fieldset className="choice-group">
            <legend>Questions</legend>
            <div className="choice-group__chips">
              {(['calm', 'challenge'] as const).map((mode) => (
                <label key={mode} className="chip">
                  <input
                    type="radio"
                    name="gk-mode"
                    checked={settings.mode === mode}
                    onChange={() => void change({ ...settings, mode })}
                  />
                  <span>{mode === 'calm' ? 'Calm: the game pauses' : 'Challenge: the game keeps going, slowly'}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="choice-group">
            <legend>Times tables on</legend>
            <div className="choice-group__chips">
              {TABLES.map((t) => {
                const on = settings.enabledTables.includes(t);
                return (
                  <label key={t} className="chip">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={on && settings.enabledTables.length === 1}
                      onChange={() =>
                        void change({
                          ...settings,
                          enabledTables: on
                            ? settings.enabledTables.filter((x) => x !== t)
                            : [...settings.enabledTables, t].sort((a, b) => a - b),
                        })
                      }
                    />
                    <span>×{t}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="choice-group">
            <legend>Missing-number questions (? × 8 = 56)</legend>
            <div className="choice-group__chips">
              {([
                [undefined, 'From level 4'],
                [true, 'Always'],
                [false, 'Never'],
              ] as const).map(([value, label]) => (
                <label key={label} className="chip">
                  <input
                    type="radio"
                    name="gk-missing"
                    checked={settings.missingFactor === value}
                    onChange={() => void change({ ...settings, missingFactor: value })}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="gk-teacher__row">
            <label className="chip">
              <input
                type="checkbox"
                checked={settings.division}
                onChange={() => void change({ ...settings, division: !settings.division })}
              />
              <span>Division questions (56 ÷ 8)</span>
            </label>
            <label className="chip">
              <input
                type="checkbox"
                checked={settings.multipleChoice}
                onChange={() => void change({ ...settings, multipleChoice: !settings.multipleChoice })}
              />
              <span>Multiple choice instead of typing</span>
            </label>
            <label className="gk-teacher__pass">
              <span>Level Key pass mark</span>
              <select
                value={settings.keyPassMark}
                onChange={(e) => void change({ ...settings, keyPassMark: Number(e.target.value) })}
              >
                {[5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>
                    {n} out of 10
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}
      <p role="status" className="teacher__status">
        {status}
      </p>
    </section>
  );
}

function GemKeepClassPanel() {
  const [data, setData] = useState<ClassGemKeep | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    fetchClassGemKeep()
      .then(setData)
      .catch((error) => setFailed(errorText(error)));
  }, []);

  return (
    <section className="panel gk-teacher" aria-labelledby="gk-class-title">
      <h2 id="gk-class-title" className="panel__title">
        Gem Keep: the class
        {data && <span className="panel__count">{data.players} playing</span>}
      </h2>
      {failed ? (
        <p className="panel__empty">{failed}</p>
      ) : !data ? (
        <p className="panel__empty">Loading…</p>
      ) : data.players === 0 ? (
        <p className="panel__empty">No students have played Gem Keep since the new season started.</p>
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
        Gem Keep: {stars} of {CAMPAIGN.length * 3} stars, {keys} Level Key{keys === 1 ? '' : 's'} passed
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
