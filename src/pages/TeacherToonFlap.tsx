/**
 * Toon Flap on the teacher pages (docs/TOON-FLAP-PLAN.md, stage F.5): the Games table's drawer with the maths and read-time
 * settings for the header's class, and one line on a student's page that opens to their levels and medals. Loaded only when
 * opened. The on/off switch is in the Games table row (src/games/toonflap/teacher.ts).
 */
import { FLYERS, levelsFinished, golds } from '../../shared/toonflap/collection';
import { LEVELS } from '../../shared/toonflap/levels';
import { fetchToonFlapSettings, fetchToonFlapStudent, saveToonFlapSetting } from '../data/toonflap';
import { SettingToggle, useSetting } from '../teacher/Settings';

/** The drawer on the Games table, for the header's class. */
export function ToonFlapTeacherSettings({ classId }: { classId: string }) {
  const settings = useSetting(() => fetchToonFlapSettings(classId), [classId]);
  return (
    <div className="panel teacher__switch">
      <SettingToggle
        label="Maths in flight"
        about="Checks on the perches (a question from each student's focus, right = 3 seconds off) and answer gaps from level 3. Off: the perches are plain rests and the gaps show arrows, and the medal times allow for it."
        value={settings.value ? settings.value.maths !== 'off' : null}
        loadFailed={settings.failed}
        save={(on) => saveToonFlapSetting({ maths: on ? 'on' : 'off' }, classId)}
      />
      <SettingToggle
        label="Read time at answer signs"
        about="On levels 3 to 5 the flight pauses at each answer sign until the student taps Go (or a few seconds pass), so slower readers aren't rushed."
        value={settings.value?.readTime ?? null}
        loadFailed={settings.failed}
        save={(readTime) => saveToonFlapSetting({ readTime }, classId)}
      />
      {settings.value?.enabled === false && <p className="panel__empty">Toon Flap is off for this class, so these only matter once it’s on.</p>}
    </div>
  );
}

/** "4 of 10 levels · 2 golds · 31 checks right · flies the Puppy Plane", or null if they haven't played. */
export async function toonFlapStudentSummary(student: string): Promise<string | null> {
  const s = await fetchToonFlapStudent(student);
  if (!s) return null;
  const parts = [`${levelsFinished(s.progress)} of ${LEVELS.length} levels`, `${golds(s.progress)} gold${golds(s.progress) === 1 ? '' : 's'}`, `${s.progress.checksRight} checks right`];
  const flyer = FLYERS.find((f) => f.id === s.flyer);
  if (flyer) parts.push(`flies the ${flyer.name}`);
  return parts.join(' · ');
}

const MEDAL = { gold: 'gold', silver: 'silver', bronze: 'bronze' } as const;

/** A student's levels and medals (the line on their page opens to this). */
export function ToonFlapStudentPanel({ student }: { student: string }) {
  // Wrapped, because useSetting's null means "still loading" and the server's null means "not played".
  const loaded = useSetting(async () => ({ s: await fetchToonFlapStudent(student) }), [student]);
  if (loaded.failed) return <p className="panel__empty">We couldn’t load Toon Flap for this student.</p>;
  if (!loaded.value) return <p className="panel__empty">Loading…</p>;
  const s = loaded.value.s;
  if (!s) return <p className="panel__empty">Not played yet.</p>;
  const played = LEVELS.filter((l) => (s.progress.levels[l.id]?.finishes ?? 0) > 0);
  return (
    <section aria-label="Toon Flap">
      <p>
        {s.runs} flights finished. Last played {new Date(s.lastPlayed).toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' })}.
        {' '}{s.progress.checksRight} checks right and {s.progress.rightGaps} answer gaps picked right in all.
      </p>
      {played.length ? (
        <ul>
          {played.map((l) => {
            const r = s.progress.levels[l.id];
            return (
              <li key={l.id}>
                {l.name}: {r.finishes} finish{r.finishes === 1 ? '' : 'es'}{r.medal ? `, ${MEDAL[r.medal]}` : ''}{r.best !== null ? `, best ${r.best.toFixed(1)} s` : ''}
              </li>
            );
          })}
        </ul>
      ) : (
        <p>No level finished yet.</p>
      )}
    </section>
  );
}
