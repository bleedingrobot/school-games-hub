/**
 * A building spot: what it makes, and (in a turn's Build step) the choices for it: raise it, or build or change it.
 * Each greyed-out button says why. The tax words are here too, for the Tax step.
 */
import { BUILD_COINS, PEOPLE_PER_TAX_COIN, HAPPY_REST, PLOT_KINDS, type TaxLevel } from '../../../shared/isles/config';
import { raisePrice, type Action, type Island, type Prices } from '../../../shared/isles/engine';
import { Choice } from './Choice';
import { spotName } from './Island';
import { KIND_JOB, KIND_NAME, costOf, makes, n } from './words';

export const TAX_WORDS: Record<TaxLevel, string> = {
  low: `1 coin from every ${PEOPLE_PER_TAX_COIN.low} people. Happiness slowly goes up to ${HAPPY_REST.low}.`,
  fair: `1 coin from every ${PEOPLE_PER_TAX_COIN.fair} people. Happiness stays near ${HAPPY_REST.fair}.`,
  high: `1 coin from every ${PEOPLE_PER_TAX_COIN.high} people. Happiness drops to ${HAPPY_REST.high}, and fewer people move in.`,
};

/** Raise, build or change the building on one spot. */
export function SpotChoices({ island, spot, prices, onChoose }: { island: Island; spot: number; prices: Prices; onChoose: (a: Action) => void }) {
  const here = island.spots[spot];
  if (!here) return null;
  const price = raisePrice(island, spot);
  return (
    <>
      <p>{here.kind === 'empty' ? 'An empty spot, ready to build on.' : `It makes ${makes(island, spot)}.`}</p>
      {here.kind !== 'empty' && (
        <Choice island={island} prices={prices} action={{ kind: 'raise', spot }} onChoose={onChoose} kind="button--light">
          {price ? `Raise to level ${here.level + 1}: ${costOf(island, { kind: 'raise', spot })}` : 'Top level'}
        </Choice>
      )}
      <p className="si-note">{here.kind === 'empty' ? 'Build:' : 'Or change it (it starts again at level 1):'}</p>
      <div className="si-buildgrid">
        {PLOT_KINDS.filter((k) => k !== here.kind).map((kind) => (
          <Choice key={kind} island={island} prices={prices} action={{ kind: 'build', spot, plot: kind }} onChoose={onChoose} kind="button--light">
            <span className="si-build__name">{KIND_NAME[kind]}: {n(BUILD_COINS[kind])} coins</span>
            <span className="si-build__job">{KIND_JOB[kind]}</span>
          </Choice>
        ))}
      </div>
    </>
  );
}

/** A spot tapped on My island, between turns: what it makes. Building waits for a turn. */
export function SpotPanel({ island, spot, onClose }: { island: Island; spot: number; onClose: () => void }) {
  const here = island.spots[spot];
  if (!here) return null;
  return (
    <section className="si-panel si-spotpanel" aria-label={`Spot ${spot + 1}`}>
      <div className="si-panel__head">
        <h3>Spot {spot + 1}: {spotName(here.kind, here.level)}</h3>
        <button type="button" className="button button--light si-close" onClick={onClose}>Close</button>
      </div>
      <p>{here.kind === 'empty' ? 'An empty spot, ready to build on.' : `It makes ${makes(island, spot)}.`}</p>
      <p className="si-note">Play a turn to build, change or raise.</p>
    </section>
  );
}
