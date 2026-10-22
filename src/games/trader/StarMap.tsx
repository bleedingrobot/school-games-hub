/**
 * The star chart: a grid from -10 to +10 each way, with 0, 0 in the middle and the planets on the crossing points,
 * drawn with the same pictures as the game. Every planet has coordinates (x across, y up). Pick one to see a route along
 * the grid lines (across, then up). Fuel for a jump is across + up, worked out from the two sets of coordinates. The pupil
 * can count the squares or subtract, and check their sum; either way the jump goes ahead (docs/TRADER-PLAN.md, section 5).
 */
import { useMemo, useState } from 'react';
import { EVENTS, GOODS, GOOD_RULES, GOVERNMENTS, GRID_HALF, GRID_SIZE, RESOURCES, SIZE_NAMES, SHIPS } from '../../../shared/trader/config';
import { chartPoint, coordText, distance, signed, type Galaxy, type Planet } from '../../../shared/trader/galaxy';
import { eventOn, isBanned } from '../../../shared/trader/market';
import { fuelCost, fuelNeeded, type Trader } from '../../../shared/trader/state';
import { drawPlanet, lookOf } from './art/planets';
import { EVENT_NEWS, GOVERNMENT_LINES, PLANET_FACTS, goodIcon } from './text';

const icons = new Map<string, string>();
/** A small picture of a planet for the map (drawn once and kept). */
export function planetIcon(name: string): string {
  let url = icons.get(name);
  if (!url) {
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 96;
    const g = c.getContext('2d');
    if (g) {
      const look = lookOf(name);
      const r = 18 + 11 * Math.min(1.3, look.size);
      drawPlanet(g, look, 48, 48, Math.min(r, 36), { t: 0, still: true, plain: false, lights: 0 });
    }
    url = c.toDataURL();
    icons.set(name, url);
  }
  return url;
}

/** Where a planet sits in the picture, as a percentage (the picture has a 1.5-line border all round for the numbers). */
const VIEW = GRID_SIZE - 1 + 3;
const pos = (n: number): number => ((n + 1.5) / VIEW) * 100;

export function MapPanel({ galaxy, t, busy, onJump, onRefuel }: {
  galaxy: Galaxy;
  t: Trader;
  busy: boolean;
  onJump: (dest: number) => void;
  onRefuel: (units: number) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [guess, setGuess] = useState('');
  const [shown, setShown] = useState(false);
  const here = galaxy.planets[t.location];
  const dest = picked !== null ? galaxy.planets[picked] : null;
  const need = dest ? fuelNeeded(galaxy, t, dest.id) : 0;
  const across = dest ? Math.abs(dest.x - here.x) : 0;
  const up = dest ? Math.abs(dest.y - here.y) : 0;
  const tank = SHIPS[t.ship].fuelTank;
  const short = Math.max(0, need - t.fuel);
  const tooFar = need > tank;

  function pick(id: number) {
    setPicked(id === t.location ? null : id);
    setGuess('');
    setShown(false);
  }
  const reach = t.fuel;
  const diamond = useMemo(() => {
    const cx = here.x;
    const cy = here.y;
    const r = reach;
    return `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
  }, [here.x, here.y, reach]);

  const guessNum = Number(guess);
  const checked = shown || guess !== '';
  return (
    <section className="st-panel st-panel--map" aria-labelledby="st-map-h">
      <h2 id="st-map-h" className="st-h">Star chart</h2>
      <p className="st-sub">Every planet has a place on the grid: <strong>x</strong> says how far across and <strong>y</strong> says how far up, with (0, 0) in the middle. You are ringed in blue. The glowing diamond shows how far your fuel can take you. The planets sit in made-up places on our map.</p>
      <div className="st-mapwrap">
        <div className="st-map">
          <svg viewBox={`-1.5 -1.5 ${VIEW} ${VIEW}`} className="st-mapsvg" aria-hidden="true">
            <rect x="0" y="0" width={GRID_SIZE - 1} height={GRID_SIZE - 1} fill="rgba(8,14,34,0.72)" stroke="#5b6aa8" strokeWidth="0.06" />
            {Array.from({ length: GRID_SIZE }, (_, i) => (
              <g key={i}>
                <line x1={i} y1="0" x2={i} y2={GRID_SIZE - 1} stroke="#33407a" strokeWidth={i === GRID_HALF ? 0.13 : i % 5 === 0 ? 0.07 : 0.03} />
                <line x1="0" y1={i} x2={GRID_SIZE - 1} y2={i} stroke="#33407a" strokeWidth={i === GRID_HALF ? 0.13 : i % 5 === 0 ? 0.07 : 0.03} />
              </g>
            ))}
            <line x1="0" y1={GRID_HALF} x2={GRID_SIZE - 1} y2={GRID_HALF} stroke="#8aa0ff" strokeWidth="0.1" />
            <line x1={GRID_HALF} y1="0" x2={GRID_HALF} y2={GRID_SIZE - 1} stroke="#8aa0ff" strokeWidth="0.1" />
            {Array.from({ length: GRID_SIZE }, (_, i) => (
              <g key={`n${i}`} fill={i === GRID_HALF ? '#fde047' : '#a9b6e8'} fontSize="0.5" textAnchor="middle" fontWeight={i === GRID_HALF ? 700 : 400}>
                <text x={i} y="-0.5">{signed(i - GRID_HALF)}</text>
                <text x="-0.75" y={i + 0.18}>{signed(GRID_HALF - i)}</text>
              </g>
            ))}
            <text x={GRID_SIZE - 0.2} y={GRID_HALF - 0.25} fill="#fde047" fontSize="0.65" fontWeight="700" textAnchor="end">x</text>
            <text x={GRID_HALF + 0.3} y="0.7" fill="#fde047" fontSize="0.65" fontWeight="700">y</text>
            <clipPath id="st-gridclip"><rect x="0" y="0" width={GRID_SIZE - 1} height={GRID_SIZE - 1} /></clipPath>
            <polygon points={diamond} clipPath="url(#st-gridclip)" fill="rgba(56,189,248,0.12)" stroke="#38bdf8" strokeWidth="0.09" strokeDasharray="0.35 0.25" />
            {dest && (
              <g clipPath="url(#st-gridclip)">
                <path d={`M ${here.x} ${here.y} H ${dest.x} V ${dest.y}`} fill="none" stroke="#fde047" strokeWidth="0.18" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.01 0.42" />
                {checked && (
                  <g fill="#fde047" fontSize="0.8" fontWeight="700" textAnchor="middle" stroke="#0b1020" strokeWidth="0.12" paintOrder="stroke">
                    <text x={(here.x + dest.x) / 2} y={here.y - 0.4}>{across} across</text>
                    <text x={dest.x + (dest.x >= here.x ? 0.5 : -0.5)} y={(here.y + dest.y) / 2} textAnchor={dest.x >= here.x ? 'start' : 'end'}>{up} up</text>
                  </g>
                )}
              </g>
            )}
          </svg>
          {galaxy.planets.map((p) => {
            const d = distance(here, p);
            const far = p.id !== t.location && d > t.fuel;
            return (
              <button
                key={p.id}
                type="button"
                className={`st-planet ${p.id === t.location ? 'st-planet--here' : ''} ${picked === p.id ? 'st-planet--picked' : ''} ${far ? 'st-planet--far' : ''}`}
                style={{ left: `${pos(p.x)}%`, top: `${pos(p.y)}%` }}
                onClick={() => pick(p.id)}
                aria-pressed={picked === p.id}
                aria-label={`${p.name}, x ${chartPoint(p).x}, y ${chartPoint(p).y}${p.id === t.location ? ', you are here' : `, ${d} fuel away${far ? ', too far for your fuel' : ''}`}`}
              >
                <img src={planetIcon(p.name)} alt="" draggable={false} />
                <span className="st-planet__name">{p.name}<span className="st-planet__xy">{coordText(p)}</span></span>
              </button>
            );
          })}
        </div>
        <div className="st-mapinfo">
          {!dest ? (
            <p className="st-sub">Pick a planet to plan a jump. Fuel is <strong>across + up</strong>.</p>
          ) : (
            <PlanetCard
              galaxy={galaxy}
              t={t}
              here={here}
              dest={dest}
              need={need}
              across={across}
              up={up}
              guess={guess}
              setGuess={(v) => setGuess(v.replace(/\D/g, '').slice(0, 2))}
              reveal={() => setShown(true)}
              checked={checked}
              right={guess !== '' && guessNum === need}
              short={short}
              tooFar={tooFar}
              busy={busy}
              onRefuel={() => onRefuel(short)}
              refuelCost={fuelCost(t.ship, short)}
              canPay={fuelCost(t.ship, short) <= t.credits}
              onJump={() => onJump(dest.id)}
              jumpsLeft={t.jumpsLeft}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function PlanetCard(props: {
  galaxy: Galaxy; t: Trader; here: Planet; dest: Planet; need: number; across: number; up: number; guess: string; setGuess: (v: string) => void;
  reveal: () => void; checked: boolean; right: boolean; short: number; tooFar: boolean; busy: boolean; onRefuel: () => void;
  refuelCost: number; canPay: boolean; onJump: () => void; jumpsLeft: number;
}) {
  const { galaxy, t, here, dest, need, across, up, guess, setGuess, reveal, checked, right, short, tooFar, busy, onRefuel, refuelCost, canPay, onJump, jumpsLeft } = props;
  const gov = GOVERNMENTS[dest.government];
  const event = eventOn(galaxy, dest, t.day);
  const eventGood = event > 0 ? GOODS[GOOD_RULES.findIndex((r) => r.event === event)] : '';
  const banned = GOODS.filter((_, i) => isBanned(dest, i));
  return (
    <div className="st-card">
      <h3 className="st-h3">{dest.name} <span className="st-xy">{coordText(dest)}</span></h3>
      <p className="st-soft">{PLANET_FACTS[dest.name]}</p>
      <ul className="st-stats st-stats--tight">
        <li><span className="st-soft">Government</span> <strong>{gov.name}</strong></li>
        <li><span className="st-soft">Size</span> <strong>{SIZE_NAMES[dest.size]}</strong></li>
        <li><span className="st-soft">Tech level</span> <strong>{dest.tech}</strong></li>
        {dest.resource > 0 && <li><span className="st-soft">Special</span> <strong>{RESOURCES[dest.resource]}</strong></li>}
        <li><span className="st-soft">Wants</span> <strong>{gov.wants >= 0 ? `${goodIcon(gov.wants)} ${GOODS[gov.wants]}` : 'nothing special'}</strong></li>
      </ul>
      <p className="st-soft">{GOVERNMENT_LINES[gov.name]}</p>
      {banned.length > 0 && <p className="st-warn">🚫 Banned here: {banned.join(' and ')}. Customs will take them.</p>}
      {event > 0 && <p className="st-news">📰 {EVENT_NEWS[EVENTS[event]](eventGood)}</p>}
      <div className="st-fuel">
        <label htmlFor="st-fuelguess">How much fuel? You are at {coordText(here)} and {dest.name} is at {coordText(dest)}. Work out how far across, then how far up.</label>
        <div className="st-fuelrow">
          <input id="st-fuelguess" inputMode="numeric" autoComplete="off" value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="?" className="st-input" />
          <button type="button" className="st-btn" onClick={reveal}>Show me</button>
        </div>
        {checked && (
          <p className={right ? 'st-good-note' : 'st-note'} role="status">
            {right ? '✓ Yes! ' : ''}Across: x goes from {signed(chartPoint(here).x)} to {signed(chartPoint(dest).x)}, which is {across}. Up: y goes from {signed(chartPoint(here).y)} to {signed(chartPoint(dest).y)}, which is {up}. {across} + {up} = <strong>{need} fuel</strong>.
          </p>
        )}
      </div>
      {tooFar && <p className="st-warn">Your tank is too small to jump that far in one go. Plan a stop on the way.</p>}
      {!tooFar && short > 0 && (
        <div className="st-actions">
          <p className="st-warn">You have {t.fuel} fuel and need {need}.</p>
          <button type="button" className="st-btn" disabled={busy || !canPay} onClick={onRefuel}>Buy {short} fuel ({refuelCost} cr)</button>
        </div>
      )}
      <div className="st-actions">
        <button type="button" className="st-btn st-btn--primary st-btn--big" disabled={busy || tooFar || short > 0 || jumpsLeft < 1} onClick={onJump}>
          Jump! ({need} fuel)
        </button>
        {jumpsLeft < 1 && <span className="st-soft">No jumps left today.</span>}
      </div>
    </div>
  );
}
