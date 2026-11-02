/**
 * A building spot in a turn's Build step: what it makes, and the choices for it: raise it, or build or change it.
 * Each greyed-out button says why.
 */
import { BUILD_COINS, PLOT_KINDS } from '../../../shared/isles/config';
import { raisePrice, type Action, type Island } from '../../../shared/isles/engine';
import { Choice } from './Choice';
import { KIND_JOB, KIND_NAME, costOf, makes, n } from './words';

/** Raise, build or change the building on one spot. */
export function SpotChoices({ island, spot, onChoose }: { island: Island; spot: number; onChoose: (a: Action) => void }) {
  const here = island.spots[spot];
  if (!here) return null;
  const price = raisePrice(island, spot);
  return (
    <>
      <p>{here.kind === 'empty' ? 'An empty spot, ready to build on.' : `It makes ${makes(island, spot)}.`}</p>
      {here.kind !== 'empty' && (
        <Choice island={island} action={{ kind: 'raise', spot }} onChoose={onChoose} kind="button--light">
          {price ? `Raise to level ${here.level + 1}: ${costOf(island, { kind: 'raise', spot })}` : 'Top level'}
        </Choice>
      )}
      <p className="si-note">{here.kind === 'empty' ? 'Build:' : 'Or change it (it starts again at level 1):'}</p>
      <div className="si-buildgrid">
        {PLOT_KINDS.filter((k) => k !== here.kind).map((kind) => (
          <Choice key={kind} island={island} action={{ kind: 'build', spot, plot: kind }} onChoose={onChoose} kind="button--light">
            <span className="si-build__name">{KIND_NAME[kind]}: {n(BUILD_COINS[kind])} coins</span>
            <span className="si-build__job">{KIND_JOB[kind]}</span>
          </Choice>
        ))}
      </div>
    </>
  );
}
