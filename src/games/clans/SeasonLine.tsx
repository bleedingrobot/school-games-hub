import { CONFIG } from '../../../shared/clans/config';
import { phaseOf, type SeasonClock } from '../../../shared/clans/season';

/** "Season 2 · day 12 of 35", and a kind heads-up before the season ends. Nothing shows until the school has set a season. */
export function SeasonLine({ clock }: { clock?: SeasonClock | null }) {
  if (!clock || clock.number <= 0) return null;
  const phase = phaseOf(clock.day);
  const warn = clock.clockOn && (phase === 'warning' || phase === 'monster');
  const total = CONFIG.season.length;
  return (
    <div aria-label="Season">
      <p className="cq-soft">Season {clock.number} · day {clock.day} of {total}</p>
      {warn && <p className="cq-note">New season in {clock.daysLeft + 1} {clock.daysLeft + 1 === 1 ? 'day' : 'days'}: your clan starts fresh, your trophies stay forever.</p>}
    </div>
  );
}
