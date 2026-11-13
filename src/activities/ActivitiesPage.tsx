import { ActivityCard } from '../components/GameCard';
import { useClassSwitches } from '../data/classSwitches';
import { GAMES } from '../games/registry';
import type { GameDefinition } from '../games/types';

/** Every activity in the hub (games with `activity: true`), in GAMES order. */
export const ACTIVITIES: GameDefinition[] = GAMES.filter((game) => game.activity);

/**
 * The Activities page: calm practice of one skill, kept apart from the games on the home page (James, 13 Nov 2026;
 * docs/ORDERUP-PLAN.md). An activity with a teacher switch shows only while the class has it on, read in one request.
 */
export function Activities({ activities = ACTIVITIES }: { activities?: GameDefinition[] }) {
  const switched = activities.filter((a) => a.teacherSwitch).map((a) => a.id);
  const on = useClassSwitches(switched);
  const loading = switched.length > 0 && on === null;
  const shown = activities.filter((a) => !a.teacherSwitch || on?.has(a.id));
  return (
    <div className="activities-page">
      <h1 className="page-title">Activities</h1>
      <p>Practise one skill at a time, at your own pace.</p>
      {loading ? (
        <p className="panel__empty" role="status">
          Loading…
        </p>
      ) : shown.length === 0 ? (
        <p className="panel__empty">No activities are on for your class yet.</p>
      ) : (
        <div className="game-grid">
          {shown.map((a) => (
            <ActivityCard key={a.id} id={a.id} name={a.name} tagline={a.tagline} to={`/${a.id}`} colours={a.colours} verb="Start" />
          ))}
        </div>
      )}
    </div>
  );
}
