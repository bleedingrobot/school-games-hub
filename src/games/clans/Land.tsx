import { useState } from 'react';
import { CONFIG } from '../../../shared/clans/config';
import { BUILDING_BLURBS, BUILDING_NAMES, area, claimCost, empireOf, energyLeft as energyPercentLeft, fence, plotCost } from '../../../shared/clans/empire';
import { energyLeft, landPlot } from '../../../shared/clans/moments';
import { BUILDING_KINDS, type BuildingKind } from '../../../shared/clans/types';
import { Moment } from './Moment';
import { buildOn, canBuildOn, canClaim, canDevelop, claimMoreLand, developLand, whyNot } from './places';
import type { Session, Change } from './session';

const E = CONFIG.empire;
const SIDES = Array.from({ length: E.plotSide.max - E.plotSide.min + 1 }, (_, i) => E.plotSide.min + i);

type Phase =
  | { t: 'idle' }
  | { t: 'area' | 'fence' | 'price'; w: number; l: number }
  | { t: 'energy'; plot: number; kind: BuildingKind }
  | { t: 'done'; text: string };

/** Land and buildings: develop a plot (area and fence maths, then the price), claim more land, build with the energy maths. */
export function Land({ session, onChange, onBack }: { session: Session; onChange: Change; onBack: () => void }) {
  const { clan, settings } = session;
  const e = empireOf(clan);
  const [w, setW] = useState(4);
  const [l, setL] = useState(5);
  const [plot, setPlot] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>({ t: 'idle' });
  const idle = () => setPhase({ t: 'idle' });
  const q = landPlot(settings, w, l);
  const developCheck = canDevelop(session, w, l);
  const freeBuildPlots = e.plots.map((p, i) => ({ p, i })).filter(({ p }) => !p.building);

  const develop = (pw: number, pl: number) => {
    const cost = plotCost(e, pw, pl);
    const next = developLand(session, pw, pl);
    if (!next) return;
    onChange(next, { type: 'develop', width: pw, length: pl });
    setPhase({ t: 'done', text: `A ${pw} by ${pl} plot is ready. That cost ${cost} gold.` });
  };
  const claim = () => {
    const cost = claimCost(e);
    const next = claimMoreLand(session);
    if (!next) return;
    onChange(next, { type: 'claim' });
    setPhase({ t: 'done', text: `You claimed one more plot of wild land for ${cost} gold.` });
  };
  const construct = (index: number, kind: BuildingKind) => {
    const next = buildOn(session, index, kind);
    if (!next) return;
    onChange(next, { type: 'build', plot: index, kind });
    setPhase({ t: 'done', text: `The ${BUILDING_NAMES[kind]} is built. ${energyPercentLeft(empireOf(next.clan))}% of today's work is left.` });
  };
  const startBuild = (index: number, kind: BuildingKind) => {
    const used = e.energyUsed > 0 ? [e.energyUsed, E.buildings[kind].energy] : [E.buildings[kind].energy];
    if (energyLeft(settings, ...used)) setPhase({ t: 'energy', plot: index, kind });
    else construct(index, kind);
  };

  let body: React.ReactNode;
  if (phase.t === 'area' && q) {
    body = <Moment key="area" question={q.area} title="How big is the plot?" note={`A plot ${phase.w} squares by ${phase.l} squares.`} doneLabel="Next question" onDone={() => setPhase({ t: 'fence', w: phase.w, l: phase.l })} />;
  } else if (phase.t === 'fence' && q) {
    body = <Moment key="fence" question={q.fence} title="How much fence?" note={`The same plot, ${phase.w} by ${phase.l}.`} doneLabel="Work out the price" onDone={() => setPhase({ t: 'price', w: phase.w, l: phase.l })} />;
  } else if (phase.t === 'price') {
    const cost = plotCost(e, phase.w, phase.l);
    const check = canDevelop(session, phase.w, phase.l);
    body = (
      <div className="cq-panel" role="group" aria-label="The price">
        <p>{phase.w} × {phase.l} is <strong>{area(phase.w, phase.l)}</strong> squares at {E.landPerSquare} gold each, plus <strong>{fence(phase.w, phase.l)}</strong> for the fence at {E.fencePerUnit} gold a unit.</p>
        <p>Price: <strong>{cost} gold</strong>{cost !== area(phase.w, phase.l) * E.landPerSquare + fence(phase.w, phase.l) * E.fencePerUnit && " (a Developer's Hall is making it cheaper)"}. The vault has {e.vault}.</p>
        {!check.ok && <p className="cq-warn">{check.say}</p>}
        <div className="cq-actions">
          <button type="button" className="cq-btn cq-btn--hot" autoFocus disabled={!check.ok} onClick={() => develop(phase.w, phase.l)}>Develop it for {cost} gold</button>
          <button type="button" className="cq-btn" onClick={idle}>Not now</button>
        </div>
      </div>
    );
  } else if (phase.t === 'energy') {
    const def = E.buildings[phase.kind];
    const used = e.energyUsed > 0 ? [e.energyUsed, def.energy] : [def.energy];
    body = (
      <Moment
        key="energy" question={energyLeft(settings, ...used)!} title={`Building the ${BUILDING_NAMES[phase.kind]}`}
        note={`Your workers have 100% a day.${e.energyUsed > 0 ? ` Today they have already used ${e.energyUsed}%.` : ''} The ${BUILDING_NAMES[phase.kind]} uses ${def.energy}% and costs ${def.gold} gold.`}
        doneLabel={`Build it for ${def.gold} gold`} onDone={() => construct(phase.plot, phase.kind)}
      />
    );
  } else if (phase.t === 'done') {
    body = <div className="cq-panel" role="status"><p className="cq-note">{phase.text} Vault: {empireOf(clan).vault} gold.</p><button type="button" className="cq-btn cq-btn--hot" autoFocus onClick={() => { idle(); setPlot(null); }}>Carry on</button></div>;
  } else {
    body = (
      <div className="cq-land">
        <div className="cq-panel">
          <h3>Develop wild land</h3>
          <p className="cq-soft">You have {e.wild} {e.wild === 1 ? 'plot' : 'plots'} of wild land. Pick the sides of the plot ({E.plotSide.min} to {E.plotSide.max} squares).</p>
          <div className="cq-sides" role="group" aria-label="Width">Width {SIDES.map((n) => <button key={n} type="button" className="cq-btn" aria-pressed={w === n} aria-label={`Width ${n}`} onClick={() => setW(n)}>{n}</button>)}</div>
          <div className="cq-sides" role="group" aria-label="Length">Length {SIDES.map((n) => <button key={n} type="button" className="cq-btn" aria-pressed={l === n} aria-label={`Length ${n}`} onClick={() => setL(n)}>{n}</button>)}</div>
          <div className="cq-actions">
            <button type="button" className="cq-btn cq-btn--hot" disabled={!developCheck.ok && developCheck.why === 'land'} onClick={() => setPhase(q ? { t: 'area', w, l } : { t: 'price', w, l })}>Work out the price</button>
          </div>
          {!developCheck.ok && developCheck.why === 'land' && <p className="cq-warn">{developCheck.say} You can claim more below.</p>}
          {e.wild === 0 && (
            <div className="cq-actions">
              {(() => { const c = canClaim(session); return (
                <>
                  <button type="button" className="cq-btn" disabled={!c.ok} onClick={claim}>Claim more land ({e.claimed >= E.claim.max ? 'none left' : `${claimCost(e)} gold`})</button>
                  {!c.ok && <span className="cq-warn">{whyNot(c)}</span>}
                </>
              ); })()}
            </div>
          )}
        </div>
        <div className="cq-panel">
          <h3>Build on a plot</h3>
          <p className="cq-soft">Workers: <strong>{energyPercentLeft(e)}%</strong> of today's work left.</p>
          {freeBuildPlots.length === 0 ? <p>Develop a plot first, then you can build on it.</p> : (
            <>
              <div className="cq-sides" role="group" aria-label="Which plot?">
                {freeBuildPlots.map(({ p, i }) => <button key={i} type="button" className="cq-btn" aria-pressed={plot === i} onClick={() => setPlot(i)}>Plot {i + 1}: {p.width}×{p.length} ({area(p.width, p.length)} squares)</button>)}
              </div>
              {plot !== null && e.plots[plot] && !e.plots[plot].building && (
                <ul className="cq-buildings">
                  {BUILDING_KINDS.map((k) => {
                    const c = canBuildOn(session, plot, k);
                    const d = E.buildings[k];
                    return (
                      <li key={k}>
                        <button type="button" className="cq-btn" disabled={!c.ok} aria-label={`Build ${BUILDING_NAMES[k]}`} onClick={() => startBuild(plot, k)}>{BUILDING_NAMES[k]}</button>
                        <span><small className="cq-soft">{d.size} squares · {d.energy}% work · {d.gold} gold. {BUILDING_BLURBS[k]}</small>{!c.ok && <small className="cq-warn"> {c.say}</small>}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
          {e.plots.some((p) => p.building) && <p className="cq-soft">Built: {e.plots.filter((p) => p.building).map((p) => BUILDING_NAMES[p.building!]).join(', ')}</p>}
        </div>
      </div>
    );
  }

  return (
    <section className="cq-place" aria-label="Land and buildings">
      <div className="cq-place__head">
        <h2>Land and buildings</h2>
        <button type="button" className="cq-btn" onClick={onBack}>Back to the empire</button>
      </div>
      <p className="cq-soft">The vault has <strong>{e.vault} gold</strong>.</p>
      {body}
    </section>
  );
}
