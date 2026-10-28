/**
 * Dragon Maths on the teacher pages: the school's seasons (one date for the whole school, set by a school admin), forest
 * fights a day, the topics and the class report (where the
 * class's season is, how many heroes at each level, the hardest questions, the requests the game turned down, and the Hall
 * of Heroes) in the Games table's drawer, for the header's class; and each pupil's hero, with a button to start their hero
 * again. Loaded only when opened. The on/off switch, which pauses the season clock, is in the Games table row
 * (src/games/lord/teacher.ts).
 */
import { useEffect, useState } from 'react';
import { MAX_LEVEL } from '../../shared/lord/data';
import { ALL_TOPICS } from '../../shared/lord/maths';
import { TOPICS } from '../../shared/maths/skillPacks';
import {
  fetchClassLord, fetchLordSchoolSeason, fetchLordSettings, fetchStudentLord, resetLordHero, saveLordChange, saveLordHoliday,
  saveLordSchoolSeason, type ClassLord, type LordSchoolSeason, type StudentLord,
} from '../data/lord';
import { FriendlyError } from '../data/profile';
import { SettingChips, SettingDate, SettingNumber, SettingToggle, useSetting } from '../teacher/Settings';
import { whenPlayed } from './Dashboard';
import { keyLabel, TOPIC_LABEL as LADDER_LABELS } from './TeacherMonsters';
import './teacher-gem-keep.css';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');
const TOPIC_LABEL: Record<string, string> = { ...Object.fromEntries(TOPICS.map((t) => [t.id, t.label])), ...LADDER_LABELS, money: 'Gold and shopping', patterns: 'Number patterns' };
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

/**
 * The drawer on the Games table (docs/TEACHER-VIEW-PLAN.md, 4.5), for the header's class: forest fights, the season date and
 * the topics, then the class report. The on/off switch (which pauses the season clock) is in the table row.
 */
export function LordTeacherSettings({ classId }: { classId: string }) {
  return (
    <>
      <LordSettingsPanel classId={classId} />
      <LordClassReport classId={classId} />
    </>
  );
}

const TOPIC_CHIPS = ALL_TOPICS.map((t) => ({ value: t, label: topicLabel(t) }));

function LordSettingsPanel({ classId }: { classId: string }) {
  const settings = useSetting(() => fetchLordSettings(classId), [classId]);
  const school = useSetting(() => fetchLordSchoolSeason(), []);
  const s = settings.value;
  // Before the school season is live (or while it loads), the class keeps its own date, as before.
  const schoolSeason = school.value?.live ? school.value.season : null;
  const live = schoolSeason !== null;
  return (
    <>
      {schoolSeason && <SchoolSeasonBox first={schoolSeason} />}
      <section className="panel gk-teacher teacher__switch" aria-labelledby="dm-settings-title">
        <h2 id="dm-settings-title" className="panel__title">
          {live ? 'Dragon Maths for this class' : 'Dragon Maths settings'}
        </h2>
        {s && !s.enabled && (
          <p className="panel__empty">
            {live
              ? 'Dragon Maths is off for this class, so this only matters once it’s on. The school’s seasons carry on while it’s off.'
              : s.pausedSince
                ? `Dragon Maths has been off for this class since ${s.pausedSince}, so its season clock is paused. Switch it on in the Games table to carry on the season where it left off.`
                : 'Dragon Maths is off for this class, so this only matters once it’s on.'}
          </p>
        )}
        <SettingNumber
          label="Forest fights a day"
          about="Pupils get the new number from their next day. Unused fights pile up for a missed day or two."
          min={1}
          max={30}
          value={s?.forestPerDay ?? null}
          loadFailed={settings.failed}
          save={(forestPerDay) => saveLordChange({ forestPerDay }, classId)}
        />
        {!live && (
          <SettingDate
            label="First day of season 1"
            about="Seasons run 35 days, one after the other, from this day. Each new season everyone starts again at level 1 (dragon stars, achievements and the Hall of Heroes stay). Saving a date also ends a pause: the seasons count from the new date."
            value={school.value ? (s?.seasonStart ?? null) : null}
            loadFailed={settings.failed || school.failed}
            save={(seasonStart) => saveLordChange({ seasonStart }, classId)}
          />
        )}
        <SettingChips
          label="Topics on"
          about="A topic switched off is never asked: a question comes from a topic that is still on, and forest events about it stay out of the forest. Pupils get the new topics the next time they open Dragon Maths."
          options={TOPIC_CHIPS}
          value={s?.topics ?? null}
          loadFailed={settings.failed}
          save={(topics) => saveLordChange({ topics }, classId)}
        />
      </section>
    </>
  );
}

const longDate = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "Season 3 for the whole school, 12 days left." and, while paused, since when. */
function schoolSeasonLine(season: LordSchoolSeason): string {
  if (season.pausedSince) {
    const where = season.number ? `Season ${season.number} for the whole school, ${season.daysLeft === 0 ? 'on its last day' : `${season.daysLeft} days left`}.` : '';
    return `Paused for the holidays since ${longDate(season.pausedSince)}. ${where}`.trim();
  }
  if (season.number) {
    return `Season ${season.number} for the whole school, ${season.daysLeft === 0 ? 'last day' : `${season.daysLeft} ${season.daysLeft === 1 ? 'day' : 'days'} left`}.`;
  }
  if (season.startsIn !== null) return `Season 1 starts in ${season.startsIn} ${season.startsIn === 1 ? 'day' : 'days'} for the whole school.`;
  return 'Season 1 starts for the whole school when a class switches Dragon Maths on.';
}

/**
 * The school's one season date and holiday pause (docs/DRAGON-SCHOOL-SEASON.md, 2.5). A school admin sets them here until the
 * Admin page (stage 6); every other teacher sees where the season is, read-only.
 */
function SchoolSeasonBox({ first }: { first: LordSchoolSeason }) {
  const [season, setSeason] = useState(first);
  useEffect(() => setSeason(first), [first]);
  return (
    <section className="panel gk-teacher teacher__switch" aria-labelledby="dm-school-title">
      <h2 id="dm-school-title" className="panel__title">
        Seasons (whole school)
      </h2>
      <p role="status">{schoolSeasonLine(season)}</p>
      {season.canChange ? (
        <>
          <SettingDate
            label="First day of season 1 (whole school)"
            about="Every class's seasons run 35 days, one after the other, from this day. Each new season everyone starts again at level 1 (dragon stars, achievements, points and the Hall of Heroes stay). You can move it earlier (the next season starts sooner) but not so late that the season number would go down."
            value={season.start ?? ''}
            save={async (start) => setSeason(await saveLordSchoolSeason(start))}
          />
          <SettingToggle
            label="Holiday pause (whole school)"
            about="On closes Dragon Maths for every class and stops the season clock. Off opens it again for every class that has it on, and the season carries on where it left off."
            value={season.pausedSince !== null}
            save={async (on) => setSeason(await saveLordHoliday(on))}
          />
        </>
      ) : (
        <p>Set by a school admin.</p>
      )}
    </section>
  );
}

/** How the class is getting on: its season, heroes at each level, the hardest questions, the Hall of Heroes and refused requests. */
function LordClassReport({ classId }: { classId: string }) {
  const [data, setData] = useState<ClassLord | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setData(null);
    setFailed(null);
    fetchClassLord(classId)
      .then((d) => current && setData(d))
      .catch((error) => current && setFailed(errorText(error)));
    return () => {
      current = false;
    };
  }, [classId]);

  return (
    <section className="panel gk-teacher" aria-labelledby="dm-class-title">
      <h2 id="dm-class-title" className="panel__title">
        Dragon Maths: this class
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
                      <td>{topicLabel(f.pack)}</td>
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

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** One line for the student's folded Games row: "Level 5 mage, season 2, 1 dragon star", or nothing without a hero. */
export async function lordStudentSummary(student: string): Promise<string | null> {
  const { hero, refused } = await fetchStudentLord(student);
  if (!hero) return null;
  return `Level ${hero.level} ${hero.heroClass}, season ${hero.season}${hero.stars > 0 ? `, ${plural(hero.stars, 'dragon star')}` : ''}${refused > 0 ? `, ${plural(refused, 'request')} turned down` : ''}`;
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
