/**
 * The spend part of a turn (docs/ISLES-PLAN.md, section 2): the pupil's choices are collected here, checked against
 * the rules as they go (each greyed-out button says why), and sent all together with End turn.
 */
import { BUILD_COINS, FESTIVAL_COINS, FESTIVAL_HAPPINESS, GRAND_ISLE, HAPPY_REST, LIGHTHOUSE, PEOPLE_PER_TAX_COIN, PLOT_KINDS, type TaxLevel } from '../../../shared/isles/config';
import { count, isGrandIsle, raisePrice, type Action, type Island, type Prices } from '../../../shared/isles/engine';
import { Choice } from './Choice';
import { spotName } from './Island';
import { KIND_JOB, KIND_NAME, costOf, makes, n } from './words';

const TAX_WORDS: Record<TaxLevel, string> = {
  low: `1 coin from every ${PEOPLE_PER_TAX_COIN.low} people. They get happier (towards ${HAPPY_REST.low}).`,
  fair: `1 coin from every ${PEOPLE_PER_TAX_COIN.fair} people. They stay content (towards ${HAPPY_REST.fair}).`,
  high: `1 coin from every ${PEOPLE_PER_TAX_COIN.high} people. They get grumpy (towards ${HAPPY_REST.high}) and fewer move in.`,
};

/** The building spot that's been tapped: build, change or raise. */
export function SpotPanel({ island, spot, prices, onChoose, inTurn, onClose }: {
  island: Island; spot: number; prices: Prices; onChoose: (a: Action) => void; inTurn: boolean; onClose: () => void;
}) {
  const here = island.spots[spot];
  if (!here) return null;
  const price = raisePrice(island, spot);
  return (
    <section className="si-panel si-spotpanel" aria-label={`Spot ${spot + 1}`}>
      <div className="si-panel__head">
        <h3>Spot {spot + 1}: {spotName(here.kind, here.level)}</h3>
        <button type="button" className="button button--light si-close" onClick={onClose}>Close</button>
      </div>
      <p>{here.kind === 'empty' ? 'An empty spot, ready to build on.' : `It makes ${makes(island, spot)}.`}</p>
      {!inTurn ? (
        <p className="si-note">Play a turn to build, change or raise.</p>
      ) : (
        <>
          {here.kind !== 'empty' && (
            <Choice island={island} prices={prices} action={{ kind: 'raise', spot }} onChoose={onChoose} kind="button--primary">
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
      )}
    </section>
  );
}

export function Spend({
  island,
  prices,
  choiceLines,
  onChoose,
  onUndo,
  onClear,
  onUpgrades,
  onEnd,
  onLeave,
  busy,
  lit,
}: {
  /** The island as it will be after the choices so far. */
  island: Island;
  prices: Prices;
  /** Each choice so far, in words. */
  choiceLines: string[];
  onChoose: (a: Action) => void;
  onUndo: () => void;
  onClear: () => void;
  onUpgrades: () => void;
  onEnd: () => void;
  /** Back to My island without playing (the choices are dropped; the turn isn't used). */
  onLeave: () => void;
  busy: boolean;
  lit: string | null;
}) {
  const stage = LIGHTHOUSE[island.lighthouse];
  return (
    <div className="si-spend">
      <section className="si-panel">
        <h3>Land</h3>
        {island.driftLeft > 0 ? (
          <Choice island={island} prices={prices} action={{ kind: 'anchor' }} onChoose={onChoose} pip="drift" lit={lit} kind="button--primary">
            Anchor a chunk: {costOf(island, { kind: 'anchor' })}
          </Choice>
        ) : (
          <p className="si-note" data-pip="drift">No land in the drift today. More drifts by tomorrow.</p>
        )}
        <p className="si-note">Each chunk is one more building spot. Tap a spot on your island to build on it.</p>
      </section>

      <section className="si-panel">
        <h3>Tax</h3>
        <div className="si-tax" role="radiogroup" aria-label="Tax">
          {(['low', 'fair', 'high'] as TaxLevel[]).map((level) => (
            <button key={level} type="button" role="radio" aria-checked={island.tax === level} className={`si-tax__option${island.tax === level ? ' si-tax__option--on' : ''}`} onClick={() => onChoose({ kind: 'tax', level })}>
              <strong>{level[0].toUpperCase() + level.slice(1)}</strong>
              <span>{TAX_WORDS[level]}</span>
            </button>
          ))}
        </div>
      </section>

      {count(island, 'workshop') > 0 && (
        <section className="si-panel">
          <h3>Workshops</h3>
          <label className="si-slider">
            <span>Sky-boats {island.boatShare}% · goods {100 - island.boatShare}%</span>
            <input type="range" min={0} max={100} step={25} value={island.boatShare} onChange={(e) => onChoose({ kind: 'workshop', boatShare: Number(e.target.value) })} />
          </label>
          <p className="si-note">Sky-boats make you faster in races. Goods raise buildings to level 3 and build the Lighthouse.</p>
        </section>
      )}

      <section className="si-panel si-panel--row">
        <Choice island={island} prices={prices} action={{ kind: 'festival' }} onChoose={onChoose} kind="button--light">
          Festival: {n(FESTIVAL_COINS)} coins, +{FESTIVAL_HAPPINESS} happiness
        </Choice>
        <button type="button" className={`button button--light${lit?.startsWith('upgrade-') ? ' si-lit' : ''}`} onClick={onUpgrades}>Upgrades</button>
        {isGrandIsle(island) && stage ? (
          <Choice island={island} prices={prices} action={{ kind: 'lighthouse' }} onChoose={onChoose} pip="lighthouse" lit={lit} kind="button--light">
            Lighthouse stage {island.lighthouse + 1}: {costOf(island, { kind: 'lighthouse' })}
          </Choice>
        ) : (
          <p className="si-note" data-pip="lighthouse">{stage ? `The Sky Lighthouse needs a Grand Isle (${GRAND_ISLE} spots).` : 'Your Sky Lighthouse is lit!'}</p>
        )}
        <button type="button" className={`button button--light${lit === 'market' ? ' si-lit' : ''}`} data-pip="market" disabled aria-describedby="si-market-soon">Market</button>
        <span id="si-market-soon" className="si-choice__why">The class market opens soon.</span>
      </section>

      <section className="si-panel si-choices" aria-live="polite">
        <h3>Your choices this turn</h3>
        {choiceLines.length ? (
          <ol>{choiceLines.map((line, i) => <li key={i}>{line}</li>)}</ol>
        ) : (
          <p className="si-note">Nothing yet. You can also end the turn and save your coins.</p>
        )}
        <div className="si-row">
          {choiceLines.length > 0 && <button type="button" className="button button--light" onClick={onUndo}>Undo last</button>}
          {choiceLines.length > 1 && <button type="button" className="button button--light" onClick={onClear}>Clear all</button>}
          <button type="button" className="button button--light" onClick={onLeave}>Back without playing</button>
          <button type="button" className={`button button--primary si-end${lit === 'end-turn' ? ' si-lit' : ''}`} data-pip="end-turn" onClick={onEnd} disabled={busy}>
            {busy ? 'Ending the turn…' : 'End turn'}
          </button>
        </div>
      </section>
    </div>
  );
}
