/**
 * When Bella talks about the Storm Lands' twists (voiceLines.ts STORM_LINES). Read after each step of a run, from the
 * run and that step's events only, so it never changes the run. Each kind of line has a limit a run, so she warns
 * without nagging: the map's own line once, the first two lightning rings, every turn of the tide, the Storm King's
 * rage and Second Wind (each happens rarely).
 */
import { STORM, STEPS_PER_SECOND } from '../../../shared/goblinstorm/config';
import type { RunState } from '../../../shared/goblinstorm/engine';
import type { StormLine } from './voiceLines';

/** How many times a run each line may be said. */
const LIMIT: Partial<Record<StormLine, number>> = { ring: 2 };
/** The map's own line comes this long after the run starts. */
const INTRO_AT = Math.round(1.5 * STEPS_PER_SECOND);

/** The line to say after this step, if any. `said` counts the lines said so far this run (kept by the caller). */
export function stormLine(s: RunState, said: Map<StormLine, number>): StormLine | null {
  const storm = s.setup.map.storm;
  if (!storm) return null;
  const want = (line: StormLine): StormLine | null => {
    const n = said.get(line) ?? 0;
    if (n >= (LIMIT[line] ?? Infinity) || (line === s.setup.map.id && n >= 1)) return null;
    said.set(line, n + 1);
    return line;
  };
  if (s.t === INTRO_AT) return want(s.setup.map.id as StormLine);
  for (const ev of s.events) {
    if (ev.k === 'revive') return want('revive');
    if (ev.k === 'rage') return want('rage');
    if (ev.k === 'current' && s.t > 1) return want('tide');
  }
  // A new set of lightning rings (the first is always under the hero) appeared this step.
  if (storm === 'lightning' && s.storm.strikes.some((k) => k.at === s.t - 1 + STORM.lightning.warn)) return want('ring');
  return null;
}
