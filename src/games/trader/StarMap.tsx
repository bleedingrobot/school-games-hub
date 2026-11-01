/**
 * The star chart: a grid from -10 to +10 each way, with 0, 0 in the middle and the planets on the crossing points,
 * drawn with the same pictures as the game. Every planet has coordinates (x across, y up). To jump, the pupil TYPES the
 * coordinates of where they want to go (reading a point off the chart, with its sign); the chart shows where the typed
 * point lands, the game works out the fuel, and nothing is counted by hand. A wrong or empty spot just says so and
 * helps (which of x and y to check). (docs/TRADER-PLAN.md, section 5.)
 */
import { useEffect, useMemo, useState } from 'react';
import { eventLine, newsAbout, type NewsItem } from '../../../shared/trader/news';
import { pricesAt } from '../../../shared/trader/priceGuide';
import type { Pushes } from '../../../shared/trader/schoolMarket';
import { GOODS, GOVERNMENTS, GRID_HALF, GRID_SIZE, RESOURCES, SIZE_NAMES, SHIPS } from '../../../shared/trader/config';
import { chartPoint, coordText, distance, signed, type Galaxy, type Planet } from '../../../shared/trader/galaxy';
import { isBanned } from '../../../shared/trader/market';
import { fuelCost, fuelNeeded, type Trader } from '../../../shared/trader/state';
import { drawPlanet, loadSmallPlanetMaps, lookOf, planetPainted } from './art/planets';
import { GOVERNMENT_LINES, PLANET_FACTS, goodIcon } from './text';

const icons = new Map<string, string>();
/** A small picture of a planet for the map (drawn once and kept; drawn again once its painting has arrived). */
export function planetIcon(name: string): string {
  const look = lookOf(name);
  const r = Math.min(18 + 11 * Math.min(1.3, look.size), 36);
  const key = `${name}:${planetPainted(name, r * 2)}`;
  let url = icons.get(key);
  if (!url) {
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 96;
    const g = c.getContext('2d');
    if (g) drawPlanet(g, look, 48, 48, r, { t: 0, still: true, plain: false, lights: 0 });
    url = c.toDataURL();
    icons.set(key, url);
  }
  return url;
}

/** Downloads the planets' paintings, and draws the chart again when they have arrived (so the icons swap to them). */
function usePaintedIcons(names: readonly string[]): void {
  const [, setArrived] = useState(0);
  const key = names.join(',');
  useEffect(() => {
    let current = true;
    void loadSmallPlanetMaps(key.split(',')).then(() => current && setArrived((n) => n + 1));
    return () => {
      current = false;
    };
  }, [key]);
}

/** Where a planet sits in the picture, as a percentage (the picture has a 1.5-line border all round for the numbers). */
const VIEW = GRID_SIZE - 1 + 3;
const pos = (n: number): number => ((n + 1.5) / VIEW) * 100;

export function MapPanel({ galaxy, t, busy, news = [], pushes, onJump, onRefuel }: {
  galaxy: Galaxy;
  t: Trader;
  busy: boolean;
  /** The school news today (a planet's own lines go on its card). */
  news?: readonly NewsItem[];
  /** The school's pushes on prices now (for a planet's price list). */
  pushes?: Pushes;
  onJump: (dest: number) => void;
  onRefuel: (units: number) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [xs, setXs] = useState('');
  const [ys, setYs] = useState('');
  usePaintedIcons(galaxy.planets.map((p) => p.name));
  const here = galaxy.planets[t.location];
  const px = parseCoord(xs);
  const py = parseCoord(ys);
  const aimed = px !== null && py !== null;
  const target = aimed ? galaxy.planets.find((p) => chartPoint(p).x === px && chartPoint(p).y === py) ?? null : null;
  const pickedPlanet = picked !== null ? galaxy.planets[picked] : null;
  const dest = target ?? null;
  const need = dest ? fuelNeeded(galaxy, t, dest.id) : 0;
  const tank = SHIPS[t.ship].fuelTank;
  const short = Math.max(0, need - t.fuel);
  const tooFar = need > tank;
  const here0 = chartPoint(here);

  function pick(id: number) {
    setPicked(id === t.location ? null : id);
  }
  const reach = t.fuel;
  const diamond = useMemo(() => {
    const cx = here.x;
    const cy = here.y;
    const r = reach;
    return `${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`;
  }, [here.x, here.y, reach]);

  // Where the typed point lands on the grid (if both numbers make sense).
  const aim = aimed ? { x: (px as number) + GRID_HALF, y: GRID_HALF - (py as number) } : null;

  return (
    <section className="st-panel st-panel--map" aria-labelledby="st-map-h">
      <h2 id="st-map-h" className="st-h">Star chart</h2>
      <p className="st-sub">Every planet has a place on the grid: <strong>x</strong> says how far across and <strong>y</strong> says how far up, with (0, 0) in the middle. To jump, type the coordinates of where you want to go. You are ringed in blue and the glowing diamond shows how far your fuel can take you. The planets sit in made-up places on our map.</p>
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
            {aim && (
              <g>
                {/* Where the typed numbers land: lines in from the x and y axes and a crosshair. */}
                <line x1={aim.x} y1={GRID_HALF} x2={aim.x} y2={aim.y} stroke="#fde047" strokeWidth="0.1" strokeDasharray="0.3 0.2" />
                <line x1={GRID_HALF} y1={aim.y} x2={aim.x} y2={aim.y} stroke="#fde047" strokeWidth="0.1" strokeDasharray="0.3 0.2" />
                <circle cx={aim.x} cy={aim.y} r="0.7" fill="none" stroke="#fde047" strokeWidth="0.12" />
                <path d={`M ${aim.x - 1.1} ${aim.y} H ${aim.x - 0.4} M ${aim.x + 0.4} ${aim.y} H ${aim.x + 1.1} M ${aim.x} ${aim.y - 1.1} V ${aim.y - 0.4} M ${aim.x} ${aim.y + 0.4} V ${aim.y + 1.1}`} stroke="#fde047" strokeWidth="0.12" />
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
                className={`st-planet ${p.id === t.location ? 'st-planet--here' : ''} ${picked === p.id ? 'st-planet--picked' : ''} ${dest?.id === p.id ? 'st-planet--aimed' : ''} ${far ? 'st-planet--far' : ''}`}
                style={{ left: `${pos(p.x)}%`, top: `${pos(p.y)}%` }}
                onClick={() => pick(p.id)}
                aria-pressed={picked === p.id}
                aria-label={`${p.name}, x ${chartPoint(p).x}, y ${chartPoint(p).y}${p.id === t.location ? ', you are here' : ''}. Tap to read about it.`}
              >
                <img src={planetIcon(p.name)} alt="" draggable={false} />
                <span className="st-planet__name">{p.name}<span className="st-planet__xy">{coordText(p)}</span></span>
              </button>
            );
          })}
        </div>
        <div className="st-mapinfo">
          <JumpBox
            t={t}
            here={here}
            xs={xs}
            ys={ys}
            setXs={setXs}
            setYs={setYs}
            px={px}
            py={py}
            target={target}
            pickedPlanet={pickedPlanet}
            need={need}
            short={short}
            tooFar={tooFar}
            busy={busy}
            canPay={fuelCost(t.ship, short) <= t.credits}
            refuelCost={fuelCost(t.ship, short)}
            onRefuel={() => onRefuel(short)}
            onJump={() => target && onJump(target.id)}
            here0={here0}
          />
          {pickedPlanet ? <PlanetCard galaxy={galaxy} t={t} dest={pickedPlanet} news={newsAbout(news, pickedPlanet.id).filter((n) => n.kind !== 'event')} pushes={pushes} /> : <p className="st-sub">Tap a planet to read about it and see its coordinates.</p>}
        </div>
      </div>
    </section>
  );
}

/** "-3" or "7" within -10 to 10, or null while it is blank or wrong. */
export function parseCoord(text: string): number | null {
  if (!/^-?\d{1,2}$/.test(text)) return null;
  const n = Number(text);
  return n >= -GRID_HALF && n <= GRID_HALF ? n : null;
}

/** One number box with a plus/minus button (a phone's number keypad often has no minus). */
function CoordField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const flip = () => onChange(value.startsWith('-') ? value.slice(1) : `-${value}`);
  return (
    <div className="st-coord">
      <label htmlFor={id}>{label}</label>
      <div className="st-coord__row">
        <button type="button" className="st-btn st-btn--round" onClick={flip} aria-label={`Make ${label} negative or positive`}>±</button>
        <input
          id={id}
          className="st-input"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d-]/g, '').replace(/(?!^)-/g, '').slice(0, 3))}
          placeholder="0"
          aria-describedby="st-coord-help"
        />
      </div>
    </div>
  );
}

function JumpBox(props: {
  t: Trader; here: Planet; here0: { x: number; y: number }; xs: string; ys: string; setXs: (v: string) => void; setYs: (v: string) => void;
  px: number | null; py: number | null; target: Planet | null; pickedPlanet: Planet | null; need: number; short: number; tooFar: boolean;
  busy: boolean; canPay: boolean; refuelCost: number; onRefuel: () => void; onJump: () => void;
}) {
  const { t, here, here0, xs, ys, setXs, setYs, px, py, target, pickedPlanet, need, short, tooFar, busy, canPay, refuelCost, onRefuel, onJump } = props;
  const aimed = px !== null && py !== null;
  const typedSomething = xs !== '' || ys !== '';
  const bad = (text: string) => text !== '' && text !== '-' && parseCoord(text) === null;
  // Gentle help: say which number to check, once a planet has been looked at and the typed point is not it.
  let help = '';
  if (bad(xs) || bad(ys)) help = 'Use whole numbers from −10 to 10.';
  else if (aimed && !target) {
    help = 'There is nothing at that spot, just empty space.';
    if (pickedPlanet) {
      const c = chartPoint(pickedPlanet);
      if (px !== c.x && py === c.y) help += ` Check x for ${pickedPlanet.name}.`;
      else if (px === c.x && py !== c.y) help += ` Check y for ${pickedPlanet.name}.`;
      else help += ` Check both numbers for ${pickedPlanet.name}.`;
    }
  } else if (target && target.id === here.id) help = 'You are already there!';
  return (
    <div className="st-card st-jumpbox">
      <h3 className="st-h3">Jump to…</h3>
      <p id="st-coord-help" className="st-soft">You are at <strong>{coordText(here)}</strong>. Type the x and y of the planet you want to visit.</p>
      <div className="st-coords">
        <CoordField id="st-x" label="x (across)" value={xs} onChange={setXs} />
        <CoordField id="st-y" label="y (up)" value={ys} onChange={setYs} />
      </div>
      <div className="st-jumpinfo" aria-live="polite">
        {target && target.id !== here.id ? (
          <p className="st-good-note">
            <strong>{target.name}</strong> is at {coordText(target)}. It needs <strong>{need} fuel</strong>; you have {t.fuel}.
          </p>
        ) : typedSomething && help ? (
          <p className="st-warn">{help}</p>
        ) : (
          <p className="st-soft">Fuel is worked out for you.</p>
        )}
        {target && tooFar && <p className="st-warn">Your tank is too small to jump that far in one go. Plan a stop on the way.</p>}
        {target && !tooFar && short > 0 && (
          <div className="st-actions">
            <button type="button" className="st-btn" disabled={busy || !canPay} onClick={onRefuel}>Buy {short} fuel ({refuelCost} cr)</button>
          </div>
        )}
      </div>
      <div className="st-actions">
        <button type="button" className="st-btn st-btn--primary st-btn--big" disabled={busy || !target || target.id === here.id || tooFar || short > 0 || t.jumpsLeft < 1} onClick={onJump}>
          Jump!{target && target.id !== here.id ? ` (${need} fuel)` : ''}
        </button>
        {t.jumpsLeft < 1 && <span className="st-soft">No jumps left today.</span>}
      </div>
      <span className="st-sr">You are at x {here0.x}, y {here0.y}.</span>
    </div>
  );
}

function PlanetCard({ galaxy, t, dest, news, pushes }: { galaxy: Galaxy; t: Trader; dest: Planet; news: readonly NewsItem[]; pushes?: Pushes }) {
  const gov = GOVERNMENTS[dest.government];
  const eventText = eventLine(galaxy, dest.id, t.day);
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
      {eventText && <p className="st-news">📰 {eventText}</p>}
      {news.map((n) => <p key={`${n.good}-${n.kind}`} className="st-news">📰 {n.text}</p>)}
      <PriceList galaxy={galaxy} t={t} dest={dest} pushes={pushes} />
    </div>
  );
}

/** A planet's prices today, and the profit on each good if you buy it where you are now and sell it there. */
function PriceList({ galaxy, t, dest, pushes }: { galaxy: Galaxy; t: Trader; dest: Planet; pushes?: Pushes }) {
  const lines = useMemo(() => pricesAt(galaxy, dest.id, t.day, pushes), [galaxy, dest.id, t.day, pushes]);
  if (dest.id === t.location) return null;
  return (
    <div className="st-prices">
      <h4 className="st-h4">Prices on {dest.name} today</h4>
      <table>
        <thead>
          <tr><th scope="col">Good</th><th scope="col">They pay</th><th scope="col">Buy here</th><th scope="col">Profit each</th></tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const hereBuy = t.market[line.good]?.buy ?? 0;
            const profit = line.sell > 0 && hereBuy > 0 ? line.sell - hereBuy : null;
            return (
              <tr key={line.good} className={line.sell > 0 ? '' : 'st-prices__off'}>
                <th scope="row"><span aria-hidden="true">{goodIcon(line.good)}</span> {GOODS[line.good]}</th>
                <td>{line.sell > 0 ? line.sell : '—'}</td>
                <td>{hereBuy > 0 ? hereBuy : '—'}</td>
                <td className={profit === null ? '' : profit > 0 ? 'st-prices__win' : 'st-prices__lose'}>{profit === null ? '—' : profit > 0 ? `+${profit}` : profit}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="st-soft st-prices__note">Today's prices. They can change before you land if lots of traders buy or sell there.</p>
    </div>
  );
}
