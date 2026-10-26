/**
 * The year's decisions, one place at a time: the Market (buy or sell land), the Granary (feed the people), the Fields
 * (plant), then a last look over the valley map before the year turns. Every sum on these screens comes from plan()
 * in shared/kingdom/engine.ts, the same one the server checks with. The screens show the sums and say kindly what
 * will happen; they never say what's "right".
 */
import { useId, type ReactNode } from 'react';
import { ACRES_PER_BUSHEL, ACRES_PER_PERSON, FOOD_PER_PERSON, HUNGRY_LIMIT, MOST_TYPED } from '../../../shared/kingdom/config';
import { plan, problemWith, PROBLEM_TEXT, type Adviser, type City, type Decisions } from '../../../shared/kingdom/engine';
import type { Look } from '../../../shared/kingdom/reign';
import { MAP_SPOTS, sceneArt, type SceneId } from './art';
import { Courtier, Ruler, Stage } from './Stage';

export const STEPS = ['Market', 'Granary', 'Fields', 'Check'] as const;
const STEP_SCENES: SceneId[] = ['market', 'granary', 'fields', 'map'];

const n = (v: number) => v.toLocaleString('en-NZ');

/** A number box with − and + buttons. */
function Amount({ label, value, step, onChange, hint }: { label: string; value: number; step: number; onChange: (v: number) => void; hint?: ReactNode }) {
  const id = useId();
  const set = (v: number) => onChange(Math.max(0, Math.min(MOST_TYPED, Math.round(v))));
  return (
    <div className="kk-amount">
      <label htmlFor={id}>{label}</label>
      <div className="kk-amount__row">
        <button type="button" className="kk-btn kk-btn--step" aria-label={`${step} less`} onClick={() => set(value - step)} disabled={value <= 0}>−{step}</button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          max={MOST_TYPED}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => set(e.target.value === '' ? 0 : Number(e.target.value))}
          onFocus={(e) => e.target.select()}
        />
        <button type="button" className="kk-btn kk-btn--step" aria-label={`${step} more`} onClick={() => set(value + step)}>+{step}</button>
      </div>
      {hint && <p className="kk-hint">{hint}</p>}
    </div>
  );
}

/** The store, before and after this year's choices so far: always on screen while deciding. */
function Ledger({ city, d, boons }: { city: City; d: Decisions; boons: Adviser[] }) {
  const p = plan(city, d, boons);
  return (
    <ul className="kk-ledger" aria-label="Your plans so far">
      <li>Grain now: <strong>{n(city.grain)}</strong></li>
      <li>Land: <strong>{n(p.landAfter)}</strong> acres</li>
      <li>Food: <strong>{n(d.feed)}</strong></li>
      <li>Seed: <strong>{n(p.seed)}</strong></li>
      <li className={p.grainAfterSeed < 0 ? 'kk-ledger__short' : ''}>Grain left: <strong>{n(p.grainAfterSeed)}</strong></li>
    </ul>
  );
}

export function Decide({ city, d, setD, boons, step, setStep, look, onDone, busy, problem, heading }: {
  city: City;
  d: Decisions;
  setD: (d: Decisions) => void;
  boons: Adviser[];
  step: number;
  setStep: (s: number) => void;
  look: Look;
  onDone: () => void;
  busy: boolean;
  problem: string | null;
  heading: React.RefObject<HTMLHeadingElement | null>;
}) {
  const p = plan(city, d, boons);
  const wrong = problemWith(city, d, boons);
  const name = STEPS[step];
  const traderOn = boons.includes('trader');

  return (
    <section className="kk-screen" aria-labelledby="kk-step-title">
      {step === 3 && sceneArt('map').wide ? (
        <div className="kk-map">
          <h2 id="kk-step-title" className="kk-sign" ref={heading} tabIndex={-1}>The valley: ready to end the year?</h2>
          <div className="kk-map__paper">
            <picture>
              <source media="(max-width: 900px)" srcSet={sceneArt('map').small} />
              <img src={sceneArt('map').wide} alt="A map of the valley around Riverstone" draggable={false} />
            </picture>
            {(['market', 'granary', 'fields'] as const).map((place, i) => (
              <button
                key={place}
                type="button"
                className="kk-map-spot"
                style={{ left: `${MAP_SPOTS[place][0]}%`, top: `${MAP_SPOTS[place][1]}%` }}
                onClick={() => setStep(i)}
              >
                <span>{STEPS[i]}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Stage scene={STEP_SCENES[step]} size="short">
          <h2 id="kk-step-title" className="kk-sign" ref={heading} tabIndex={-1}>
            {step === 3 ? 'The valley: ready to end the year?' : `The ${name}`}
          </h2>
          {step === 0 && <Courtier who="trader" />}
          {step === 2 && <Courtier who="reeve" />}
          {step === 1 && <Ruler look={look} side="right" />}
        </Stage>
      )}

      <ol className="kk-steps" aria-label="This year's plans">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" className="kk-btn kk-btn--tab" aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}>
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>

      <div className="kk-panel kk-decide">
        {step === 0 && (
          <>
            <p className="kk-lead">
              Land costs <strong>{p.buyPrice}</strong> bushels an acre to buy{traderOn ? ' (Quince got you a better price)' : ''}, and sells for <strong>{p.sellPrice}</strong>.
              You can buy or sell this year, not both.
            </p>
            <div className="kk-two">
              <Amount
                label="Acres to buy"
                value={d.buy}
                step={10}
                onChange={(v) => setD({ ...d, buy: v, sell: v > 0 ? 0 : d.sell })}
                hint={d.buy > 0 ? <>{n(d.buy)} × {p.buyPrice} = <strong>{n(d.buy * p.buyPrice)}</strong> bushels</> : 'Leave at 0 to keep your land.'}
              />
              <Amount
                label="Acres to sell"
                value={d.sell}
                step={10}
                onChange={(v) => setD({ ...d, sell: v, buy: v > 0 ? 0 : d.buy })}
                hint={d.sell > 0 ? <>{n(d.sell)} × {p.sellPrice} = <strong>{n(d.sell * p.sellPrice)}</strong> bushels for the store</> : `The city owns ${n(city.land)} acres.`}
              />
            </div>
            <p>
              The store will have <strong>{n(p.grainAfterLand)}</strong> bushels and the city <strong>{n(p.landAfter)}</strong> acres.
            </p>
          </>
        )}

        {step === 1 && (
          <>
            <p className="kk-lead">
              Each person eats <strong>{FOOD_PER_PERSON}</strong> bushels a year. {n(city.people)} × {FOOD_PER_PERSON} = <strong>{n(p.feedEveryone)}</strong> bushels feeds everyone.
            </p>
            <Amount
              label="Bushels to feed the people"
              value={d.feed}
              step={FOOD_PER_PERSON * 5}
              onChange={(v) => setD({ ...d, feed: v })}
              hint={<>{n(d.feed)} ÷ {FOOD_PER_PERSON} feeds <strong>{n(p.fed)}</strong> {p.fed === 1 ? 'person' : 'people'}.</>}
            />
            <div className="kk-actions">
              <button type="button" className="kk-btn" onClick={() => setD({ ...d, feed: Math.max(0, Math.min(p.feedEveryone, p.grainAfterLand)) })}>
                Feed everyone
              </button>
            </div>
            {p.hungry > 0 && (
              <p className="kk-warn" role="status">
                Only {n(p.fed)} of {n(city.people)} people will be fed, so {n(p.hungry)} will go hungry and leave.
                {p.hungry > HUNGRY_LIMIT * city.people && (city.warned ? ' That many leaving would end your reign!' : ' That many leaving would worry the people.')}
              </p>
            )}
            <p>Grain left in the store: <strong>{n(p.grainAfterFood)}</strong>.</p>
          </>
        )}

        {step === 2 && (
          <>
            <p className="kk-lead">
              One bushel of seed plants <strong>{ACRES_PER_BUSHEL}</strong> acres, and one person can farm <strong>{ACRES_PER_PERSON}</strong> acres.
              You have {n(p.landAfter)} acres and {n(city.people)} people ({n(city.people)} × {ACRES_PER_PERSON} = {n(city.people * ACRES_PER_PERSON)} acres).
            </p>
            <Amount
              label="Acres to plant"
              value={d.plant}
              step={50}
              onChange={(v) => setD({ ...d, plant: v })}
              hint={<>{n(d.plant)} ÷ {ACRES_PER_BUSHEL} = <strong>{n(p.seed)}</strong> bushels of seed, and {n(p.farmers)} farmers.</>}
            />
            <div className="kk-actions">
              <button type="button" className="kk-btn" onClick={() => setD({ ...d, plant: p.plantMost })}>Plant all you can ({n(p.plantMost)})</button>
            </div>
            <p>Grain left after seed: <strong>{n(p.grainAfterSeed)}</strong>.</p>
            <p className="kk-tip">Hale’s tip: keep some grain in the store in case of a poor harvest or rats.</p>
          </>
        )}

        {step === 3 && (
          <>
            <ul className="kk-report">
              <li>{d.buy > 0 ? `Buy ${n(d.buy)} acres for ${n(d.buy * p.buyPrice)} bushels.` : d.sell > 0 ? `Sell ${n(d.sell)} acres for ${n(d.sell * p.sellPrice)} bushels.` : 'Keep the land as it is.'}</li>
              <li>Feed the people {n(d.feed)} bushels: {p.hungry > 0 ? `${n(p.fed)} of ${n(city.people)} fed.` : 'everyone fed.'}</li>
              <li>Plant {n(d.plant)} acres with {n(p.seed)} bushels of seed.</li>
              <li>The store keeps <strong>{n(Math.max(0, p.grainAfterSeed))}</strong> bushels.</li>
            </ul>
            <p className="kk-tip">Hale’s tip: keep some grain in the store in case of a poor harvest or rats.</p>
            {wrong && <p className="kk-warn" role="alert">{PROBLEM_TEXT[wrong]}</p>}
          </>
        )}

        {problem && <p className="kk-warn" role="alert">{problem}</p>}
        <Ledger city={city} d={d} boons={boons} />

        <div className="kk-actions">
          {step > 0 && <button type="button" className="kk-btn" onClick={() => setStep(step - 1)}>Back</button>}
          {step < 3 && <button type="button" className="kk-btn kk-btn--hot" onClick={() => setStep(step + 1)}>Next: {STEPS[step + 1]}</button>}
          {step === 3 && (
            <button type="button" className="kk-btn kk-btn--hot" onClick={onDone} disabled={busy || wrong !== null}>
              {busy ? 'The year is turning…' : 'End the year'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
