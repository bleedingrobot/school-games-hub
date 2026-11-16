/**
 * A building spot in a turn's Build step: what it makes, and the choices for it that can be made now: raise it, or
 * build or change it. Choices the island can't pay for aren't shown (James, 16 Nov 2026).
 */
import { BUILD_COINS, type PlotKind } from '../../../shared/isles/config';
import type { Action, Island } from '../../../shared/isles/engine';
import { spotActions } from './canDo';
import { Choice } from './Choice';
import { KIND_JOB, KIND_NAME, costOf, makes, n } from './words';

/** Raise, build or change the building on one spot. */
export function SpotChoices({ island, spot, onChoose, lit }: { island: Island; spot: number; onChoose: (a: Action) => void; lit?: string | null }) {
  const here = island.spots[spot];
  if (!here) return null;
  const can = spotActions(island, spot);
  const raise = can.find((a) => a.kind === 'raise');
  const builds = can.flatMap((a) => (a.kind === 'build' ? [a.plot as PlotKind] : []));
  return (
    <>
      <p>{here.kind === 'empty' ? 'An empty spot, ready to build on.' : `It makes ${makes(island, spot)}.`}</p>
      {!can.length && <p className="si-step__why">You can't change this spot yet. Save up your coins.</p>}
      {raise && (
        <Choice island={island} action={raise} onChoose={onChoose} kind="button--light">
          Raise to level {here.level + 1}: {costOf(island, raise)}
        </Choice>
      )}
      {builds.length > 0 && (
        <>
          <p className="si-note">{here.kind === 'empty' ? 'Build:' : 'Or change it (it starts again at level 1):'}</p>
          <div className="si-buildgrid">
            {builds.map((kind) => (
              <Choice key={kind} island={island} action={{ kind: 'build', spot, plot: kind }} onChoose={onChoose} kind="button--light" pip={`build-${kind}`} lit={lit}>
                <span className="si-build__name">{KIND_NAME[kind]}: {n(BUILD_COINS[kind])} coins</span>
                <span className="si-build__job">{KIND_JOB[kind]}</span>
              </Choice>
            ))}
          </div>
        </>
      )}
    </>
  );
}
