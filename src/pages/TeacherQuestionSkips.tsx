/**
 * "Skipped questions" on the teacher page (docs/QUESTION-SKIPS-PLAN.md, stage S.1): for the picked class, how many maths
 * questions each student was shown in the games and how many they closed without answering, and which kinds of question get
 * skipped most. Counted by the question box itself (src/maths/questionLog.ts), so every game is included.
 *
 * The class's "Skip button" switch (stage S.3: On, 3 per game, or Off) lives on Today with the other lesson controls; this
 * page links to it.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchQuestionSkips, type QuestionSkips } from '../data/questionLog';
import { SKIPS_PER_GAME, type SkipMode } from '../maths/questionLog';
import { gameLabel } from '../games/registry';
import { useTeacherClass } from '../teacher/TeacherClass';
import './teacher-question-skips.css';

const DAYS = [
  { days: 1, label: 'Today' },
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
] as const;

/** At or above this share of skips, a row is marked. */
export const HIGH_SKIP_SHARE = 0.3;

const OTHER_GAMES: Record<string, string> = {
  placement: 'Warm-up',
  training: 'Training',
  'clan-quest': 'Clan Quest',
  space: 'Wormholes & Black Holes',
};

export const gameName = (id: string) => gameLabel(id) ?? OTHER_GAMES[id] ?? id;

/** Dragon Maths notes its questions by moment ("size-it-up"); everything else by the box's title. */
export const spotName = (spot: string) => (/^[a-z]+(-[a-z]+)*$/.test(spot) ? (spot.charAt(0).toUpperCase() + spot.slice(1)).replace(/-/g, ' ') : spot);

export const share = (part: number, whole: number) => (whole > 0 ? `${Math.round((100 * part) / whole)}%` : '–');
const high = (part: number, whole: number) => whole >= 5 && part / whole >= HIGH_SKIP_SHARE;

export const SKIP_CHOICES: { value: SkipMode; label: string; detail: string }[] = [
  { value: 'on', label: 'On', detail: 'Students may skip any question, as before.' },
  {
    value: 'limited',
    label: `${SKIPS_PER_GAME} per game`,
    detail: `Each student has ${SKIPS_PER_GAME} skips each time they open a game, and sees how many are left. After that, every question needs an answer.`,
  },
  {
    value: 'off',
    label: 'Off',
    detail:
      'No skip button: every question needs an answer (a wrong answer still costs nothing). In Mission Control, Roll waits for the question.',
  },
];

/** Which buttons the Skip button switch leaves alone. Shown behind the switch's "?" on Today. */
export const SKIP_NOTE =
  'Some buttons stay whatever this says: Gem Keep’s “Well done” and “Cancel”, Maths Monsters’ “Back”, Clan Quest’s “Show me how”, and Dragon Maths’ choice to size up a monster. Timers still run out. Teachers can always skip.';

export function QuestionSkipsPanel() {
  const { classId, ready } = useTeacherClass();
  const [days, setDays] = useState<number>(7);
  const [data, setData] = useState<QuestionSkips | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let current = true;
    setData(null);
    setFailed(null);
    fetchQuestionSkips(classId, days).then(
      (d) => current && setData(d),
      () => current && setFailed('We couldn’t load the skip counts.'),
    );
    return () => {
      current = false;
    };
  }, [ready, classId, days]);

  const shown = data?.students.reduce((n, s) => n + s.shown, 0) ?? 0;
  const skipped = data?.students.reduce((n, s) => n + s.skipped, 0) ?? 0;

  return (
    <section className="panel qs-teacher" aria-labelledby="qs-title">
      <h2 id="qs-title" className="panel__title">
        Skipped questions
      </h2>
      {classId && (
        <p className="qs-teacher__switch-note">
          The Skip button switch for this class is on <Link to={`/teacher/${classId}`}>Today</Link>, with the other lesson controls.
        </p>
      )}
      <p>
        Every maths question the games show, and how many each student closed without answering (a skip button, running out of
        time, or carrying on without it). Stopping a Mana Well round early counts as one skip.
      </p>
      <fieldset className="choice-group">
        <legend>When</legend>
        <div className="choice-group__chips">
          {DAYS.map((d) => (
            <label key={d.days} className="chip">
              <input type="radio" name="qs-days" checked={days === d.days} onChange={() => setDays(d.days)} />
              <span>{d.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {failed ? (
        <p className="panel__empty">{failed}</p>
      ) : !data ? (
        <p className="panel__empty">Loading…</p>
      ) : data.students.length === 0 ? (
        <p className="panel__empty">No questions shown in this time yet.</p>
      ) : (
        <>
          <p className="qs-teacher__summary">
            <strong>{shown}</strong> questions shown, <strong>{skipped}</strong> skipped ({share(skipped, shown)}).
          </p>
          <div className="qs-teacher__scroll">
            <table className="stats-table qs-teacher__table">
              <caption>Each student (most skips first)</caption>
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">Shown</th>
                  <th scope="col">Skipped</th>
                  <th scope="col">Skips most at</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((s) => (
                  <tr key={s.id} data-high={high(s.skipped, s.shown) || undefined}>
                    <th scope="row">
                      {s.name}
                      <span className="qs-teacher__real">{s.realName}</span>
                    </th>
                    <td>{s.shown}</td>
                    <td>
                      {s.skipped} <span className="qs-teacher__share">({share(s.skipped, s.shown)})</span>
                    </td>
                    <td className="qs-teacher__where">{s.topSkip ? `${spotName(s.topSkip.spot)}, ${gameName(s.topSkip.game)}` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="stats-table qs-teacher__table">
              <caption>Each kind of question</caption>
              <thead>
                <tr>
                  <th scope="col">Question</th>
                  <th scope="col">Game</th>
                  <th scope="col">Shown</th>
                  <th scope="col">Skipped</th>
                </tr>
              </thead>
              <tbody>
                {data.spots.map((s) => (
                  <tr key={`${s.game}:${s.spot}`} data-high={high(s.skipped, s.shown) || undefined}>
                    <th scope="row">{spotName(s.spot)}</th>
                    <td className="qs-teacher__where">{gameName(s.game)}</td>
                    <td>{s.shown}</td>
                    <td>
                      {s.skipped} <span className="qs-teacher__share">({share(s.skipped, s.shown)})</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="qs-teacher__key">Rows with 30% or more skipped (out of at least 5 questions) are marked.</p>
        </>
      )}
    </section>
  );
}
