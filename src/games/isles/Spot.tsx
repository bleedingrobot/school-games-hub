/**
 * A building spot in a turn's Build step: what it makes, and the choices for it that can be made now: raise it, or
 * build or change it. Build choices the island can't pay for aren't shown (James, 16 Nov 2026); the upgrade is
 * always shown, greyed out with the reason when it can't be paid for (James, 18 Nov 2026).
 */
import { MAX_LEVEL } from '../../../shared/isles/config';
import { BUILD_COINS, type PlotKind } from '../../../shared/isles/config';
import type { Action, Island } from '../../../shared/isles/engine';
import { spotActions } from './canDo';
import { Choice } from './Choice';
import { KIND_JOB, KIND_NAME, costOf, makes, n } from './words';

/** Raise, build or change the building on one spot. */
export function SpotChoices({ island, spot, onChoose, lit, upgradeOnly }: {
  island: Island;
  spot: number;
  onChoose: (a: Action) => void;
  lit?: string | null;
  /** Reached from "Upgrade a building": only the upgrade, as the main button. */
  upgradeOnly?: boolean;
}) {
  const here = island.spots[spot];
  if (!here) return null;
  const can = spotActions(island, spot);
  const raise: Action | null = here.kind !== 'empty' && here.level < MAX_LEVEL ? { kind: 'raise', spot } : null;
  const builds = upgradeOnly ? [] : can.flatMap((a) => (a.kind === 'build' ? [a.plot as PlotKind] : []));
  return (
    <>
      <p>{here.kind === 'empty' ? 'An empty spot, ready to build on.' : `It makes ${makes(island, spot)}.`}</p>
      {!can.length && !raise && <p className="si-step__why">You can't change this spot yet. Save up your coins.</p>}
      {here.kind !== 'empty' && !raise && <p className="si-note">It's at the top level. Amazing!</p>}
      {raise && (
        <Choice island={island} action={raise} onChoose={onChoose} kind={upgradeOnly ? 'button--primary' : 'button--light'}>
          <span aria-hidden="true">⬆ </span>Upgrade to level {here.level + 1}: {costOf(island, raise)}
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
