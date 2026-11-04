/**
 * Sky Isles on the teacher pages (docs/ISLES-PLAN.md, section 10). The Games table's drawer, for the header's class:
 * Sky Races on or off, the class's islands this season and its Hall of the Skies. One student's island on their page,
 * with "start their island again". And every class's Hall of the Skies in "Seasons and end of year". Loaded only when
 * opened. The on/off switch is in the Games table row (src/games/isles/teacher.ts). Never anything about maths: the sky
 * pilot's answers are in the hub's focus reports with every other game's.
 */
import { useEffect, useState } from 'react';
import { LIGHTHOUSE } from '../../shared/isles/config';
import {
  fetchIslesClass, fetchIslesHalls, fetchIslesSettings, fetchIslesStudent, resetIslesIsland, saveIslesSetting,
  type HallSeason, type IslesClassReport, type IslesStudent,
} from '../data/isles';
import { FriendlyError } from '../data/profile';
import { SettingToggle, useSetting } from '../teacher/Settings';
import { whenPlayed } from './Dashboard';
import './teacher-gem-keep.css';

const errorText = (error: unknown) => (error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');
const PLACE = ['', '1st', '2nd', '3rd'];
const lighthouseText = (stages: number) => (stages >= LIGHTHOUSE.length ? 'lit' : `${stages} of ${LIGHTHOUSE.length}`);
const when = (ended: string) => new Date(`${ended}T12:00:00Z`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** A class's Hall of the Skies: each season's top 3 islands by island worth, and every lit Lighthouse. */
function HallTable({ seasons, caption }: { seasons: HallSeason[]; caption: string }) {
  if (!seasons.length) return <p className="panel__empty">No Hall of the Skies yet: the first is made at the next New Season.</p>;
  return (
    <table className="stats-table">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Season ending</th>
          <th scope="col">Place</th>
          <th scope="col">Student</th>
          <th scope="col">Island</th>
          <th scope="col">Worth</th>
        </tr>
      </thead>
      <tbody>
        {seasons.flatMap((s) =>
          s.entries.map((e, i) => (
            <tr key={`${s.ended}-${i}`}>
              <td>{when(s.ended)}</td>
              <td>{e.place ? PLACE[e.place] : 'Lit the Lighthouse'}</td>
              <th scope="row">{e.name}</th>
              <td>{e.islandName ?? '–'}</td>
              <td>{e.worth}</td>
            </tr>
          )),
        )}
      </tbody>
    </table>
  );
}

/** The drawer on the Games table, for the header's class. */
export function IslesTeacherSettings({ classId }: { classId: string }) {
  const settings = useSetting(() => fetchIslesSettings(classId), [classId]);
  return (
    <>
      <div className="panel teacher__switch">
        <SettingToggle
          label="Sky Races"
          about="On: students can race their sky-boat against the Gull Riders or a classmate’s island, twice a day. Each right answer is a gust of wind. Nobody loses anything in a race."
          value={settings.value?.races ?? null}
          loadFailed={settings.failed}
          save={(on) => saveIslesSetting({ races: on }, classId)}
        />
        {settings.value?.enabled === false && <p className="panel__empty">Sky Isles is off for this class, so this only matters once it’s on.</p>}
      </div>
      <IslesClassReportPanel classId={classId} />
    </>
  );
}

function IslesClassReportPanel({ classId }: { classId: string }) {
  const [data, setData] = useState<IslesClassReport | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    setData(null);
    setFailed(null);
    fetchIslesClass(classId)
      .then((d) => current && setData(d))
      .catch((error) => current && setFailed(errorText(error)));
    return () => {
      current = false;
    };
  }, [classId]);

  return (
    <section className="panel gk-teacher" aria-labelledby="si-class-title">
      <h2 id="si-class-title" className="panel__title">Sky Isles: this class</h2>
      {failed && <p className="panel__empty">{failed}</p>}
      {data && (
        <>
          {data.students.length ? (
            <table className="stats-table">
              <caption>Each student’s island this season</caption>
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">Island</th>
                  <th scope="col">Building spots</th>
                  <th scope="col">Lighthouse</th>
                  <th scope="col">Turns</th>
                  <th scope="col">Last played</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((s) => (
                  <tr key={s.id}>
                    <th scope="row">{s.name}</th>
                    <td>{s.islandName ?? '–'}</td>
                    <td>{s.spots}</td>
                    <td>{lighthouseText(s.lighthouse)}</td>
                    <td>{s.turns}</td>
                    <td>{s.lastPlayed ? whenPlayed(s.lastPlayed) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="panel__empty">Nobody in this class has an island yet.</p>
          )}
          <h3 className="gk-teacher__heading">Hall of the Skies</h3>
          <HallTable seasons={data.hall} caption="This class’s Hall of the Skies" />
        </>
      )}
    </section>
  );
}

/** One line for the student's folded Games row: "11 building spots, Lighthouse 2 of 4, 30 turns", or nothing before they've played. */
export async function islesStudentSummary(student: string): Promise<string | null> {
  const s = await fetchIslesStudent(student);
  if (!s) return null;
  return `${s.spots} building spots, Lighthouse ${lighthouseText(s.lighthouse)}, ${s.turns} turn${s.turns === 1 ? '' : 's'}`;
}

/** One student's island, inside their panel on the teacher page, with "start their island again". */
export function IslesStudentPanel({ student }: { student: string }) {
  const [data, setData] = useState<IslesStudent | null | undefined>(undefined);
  const [failed, setFailed] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    fetchIslesStudent(student)
      .then((d) => current && setData(d))
      .catch((error) => current && setFailed(errorText(error)));
    return () => {
      current = false;
    };
  }, [student]);

  async function reset() {
    setStatus('Starting again…');
    try {
      await resetIslesIsland(student);
      setConfirming(false);
      setData(null);
      setStatus('Done. They get a fresh island next time they play. Their achievements, points, island name and Sky Keeper stay.');
    } catch (error) {
      setStatus(errorText(error));
    }
  }

  if (failed) return <p className="panel__empty">{failed}</p>;
  if (data === undefined) return null;
  return (
    <section className="gk-teacher__student" aria-label="Sky Isles">
      {data ? (
        <>
          <h3 className="gk-teacher__heading">
            Sky Isles: {data.islandName ?? 'an island with no name yet'}, {data.spots} building spots
          </h3>
          <p>
            Sky Lighthouse {lighthouseText(data.lighthouse)}. {data.turns} turns played this season, {data.islanders} islanders, {data.decorations} decorations,{' '}
            {data.racesWon} Sky Races won.{data.lastPlayed && ` Last played ${whenPlayed(data.lastPlayed)}.`}
          </p>
          {confirming ? (
            <p>
              Start this student’s island again? They lose this season’s island. Achievements, points, the island’s name and the Hall of the Skies stay.{' '}
              <button type="button" className="button button--danger" onClick={() => void reset()}>Yes, start again</button>{' '}
              <button type="button" className="button button--light" onClick={() => setConfirming(false)}>Cancel</button>
            </p>
          ) : (
            <button type="button" className="button button--light" onClick={() => setConfirming(true)}>Start this student’s island again…</button>
          )}
        </>
      ) : (
        <p className="gk-teacher__none">Sky Isles: no island this season yet.</p>
      )}
      {status && <p role="status">{status}</p>}
    </section>
  );
}

/** Every class's Hall of the Skies, in "Seasons and end of year". Hidden until there is one. */
export function IslesSeasonPanel() {
  const [halls, setHalls] = useState<Awaited<ReturnType<typeof fetchIslesHalls>> | null>(null);
  useEffect(() => {
    fetchIslesHalls().then(setHalls, () => setHalls([]));
  }, []);
  if (!halls?.length) return null;
  return (
    <section className="panel gk-teacher teacher__switch" aria-labelledby="si-hall-title">
      <h2 id="si-hall-title" className="panel__title">Sky Isles: Hall of the Skies</h2>
      <p>
        Each New Season adds each class’s top 3 islands by island worth (building spots, building levels, islanders, decorations and the Sky Lighthouse;
        never maths), and everyone who lit their Sky Lighthouse. It is kept for good, and students see their own class’s in the game.
      </p>
      {halls.map((h) => (
        <HallTable key={h.classId} seasons={h.seasons} caption={h.className} />
      ))}
    </section>
  );
}
