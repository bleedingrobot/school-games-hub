/**
 * The hold view at the top of the market (docs/plans/trader-hold/PLAN.md, H.1): the ship from above with a box for
 * every hold, cargo pods clamped alongside, and each box showing what's in it. While a trade is picked but not done,
 * boxes about to be bought show faintly and boxes about to be sold fade. Big ships on a narrow phone show a strip
 * instead: one tile per good with how many. Tap or hover a good (H.2) for a card: the two best places in reach to sell
 * it today, and what it sells for here.
 */
import { useMemo, useState, type KeyboardEvent } from 'react';
import { GOODS, SHIPS } from '../../../shared/trader/config';
import type { Galaxy } from '../../../shared/trader/galaxy';
import { topSales, type BestSale } from '../../../shared/trader/priceGuide';
import type { Pushes } from '../../../shared/trader/schoolMarket';
import { holdsOf, usedHolds, type Trader } from '../../../shared/trader/state';
import { goodArt, podArt, shipTopArt } from './art/paint';
import { fillHold, holdBoxes, holdViewBox, podPlaces, POD, SHIP_HOLDS, type Box, type Filled } from './holdLayout';
import { goodIcon } from './text';

/** Ships with more holds than this show the strip on a narrow phone, where their boxes would be too small to see. */
export const STRIP_OVER = 25;

function Stand({ ship }: { ship: number }) {
  // Drawn stand-in for a ship whose painting isn't in yet: a plain hull round the deck.
  const s = SHIP_HOLDS[ship];
  const [top, bottom] = s.hull;
  const mid = (top + bottom) / 2;
  return (
    <g className="st-hold__stand">
      <path d={`M ${s.w * 0.06} ${top + 20} Q ${s.w * 0.06} ${top} ${s.w * 0.12} ${top} L ${s.w * 0.78} ${top} Q ${s.w * 0.97} ${mid} ${s.w * 0.78} ${bottom} L ${s.w * 0.12} ${bottom} Q ${s.w * 0.06} ${bottom} ${s.w * 0.06} ${bottom - 20} Z`} />
      <rect x={s.deck[0] - 8} y={s.deck[1] - 8} width={s.deck[2] - s.deck[0] + 16} height={s.deck[3] - s.deck[1] + 16} rx={14} className="st-hold__deck" />
    </g>
  );
}

function Item({ box, fill }: { box: Box; fill: Filled }) {
  const name = GOODS[fill.good];
  const art = goodArt(name);
  const pad = Math.min(box.w, box.h) * 0.1;
  const size = Math.min(box.w, box.h) - 2 * pad;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return (
    <g className={`st-hold__item st-hold__item--${fill.kind}`}>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={Math.min(box.w, box.h) * 0.16} className="st-hold__full" />
      {art ? (
        <image href={art} x={cx - size / 2} y={cy - size / 2} width={size} height={size} preserveAspectRatio="xMidYMid meet" />
      ) : (
        <text x={cx} y={cy} fontSize={size * 0.8} textAnchor="middle" dominantBaseline="central">{goodIcon(fill.good)}</text>
      )}
    </g>
  );
}

function GoodCard({ galaxy, t, good, tops, onClose }: { galaxy: Galaxy; t: Trader; good: number; tops: readonly BestSale[]; onClose: () => void }) {
  const name = GOODS[good];
  const pic = goodArt(name);
  const here = t.market.find((l) => l.good === good)?.sell ?? 0;
  return (
    <div className="st-hold__card" role="status">
      <div className="st-hold__cardhead">
        {pic ? <img src={pic} alt="" /> : <span aria-hidden="true">{goodIcon(good)}</span>}
        <strong>{name} × {t.cargo[good]}</strong>
        <button type="button" className="st-hold__close" aria-label="Close" onClick={onClose}>×</button>
      </div>
      {tops.length === 0 ? (
        <p>Nowhere you can reach on a full tank buys {name} today.</p>
      ) : (
        <ol className="st-hold__sales">
          {tops.map((s, i) => {
            const gain = here > 0 ? s.sell - here : 0;
            return (
              <li key={s.planet}>
                <span>{i === 0 ? '🥇' : '🥈'} <strong>{galaxy.planets[s.planet].name}</strong> pays <strong>{s.sell}</strong></span>
                {gain > 0 && <span className="st-hold__gain">+{gain} each</span>}
                <small className="st-soft">{s.fuel} fuel away</small>
              </li>
            );
          })}
        </ol>
      )}
      <p className="st-hold__here">{here > 0 ? <>Here it sells for <strong>{here}</strong>.{(tops[0]?.sell ?? 0) <= here && <> That's the best price in reach: sell it here!</>}</> : <>This planet doesn't buy {name}.</>}</p>
      <p className="st-soft st-hold__note">Today's prices. They can change before you land.</p>
    </div>
  );
}

/** Groups the filled boxes by good (fillHold keeps each good's boxes together). */
function byGood(fills: readonly Filled[]): { good: number; at: number[] }[] {
  const out: { good: number; at: number[] }[] = [];
  fills.forEach((f, i) => {
    const last = out[out.length - 1];
    if (last && last.good === f.good) last.at.push(i);
    else out.push({ good: f.good, at: [i] });
  });
  return out;
}

export function HoldView({ t, after, galaxy, pushes }: { t: Trader; after?: Trader | null; galaxy?: Galaxy; pushes?: Pushes }) {
  // The card: `pinned` from a tap or the keyboard stays until closed; `hover` follows the mouse.
  const [pinned, setPinned] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const tops = useMemo(() => (galaxy ? topSales(galaxy, t, pushes, 2) : null), [galaxy, t, pushes]);
  const shown = [hover, pinned].find((g) => g !== null && t.cargo[g] > 0) ?? null;
  const pick = (good: number) => setPinned((p) => (p === good ? null : good));
  const keys = (good: number) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(good);
    }
  };

  const capacity = holdsOf(t);
  const used = usedHolds(t);
  const fills = fillHold(t.cargo, capacity, after?.cargo);
  const boxes = holdBoxes(t.ship, t.pods);
  const [vx, vy, vw, vh] = holdViewBox(t.ship, t.pods);
  const ship = SHIPS[t.ship];
  const art = shipTopArt(ship.name);
  const pod = podArt();
  const pods = podPlaces(t.ship, t.pods);
  const big = capacity > STRIP_OVER;
  const afterUsed = after ? usedHolds(after) : used;
  const held = t.cargo.flatMap((q, good) => (q > 0 ? [`${q} ${GOODS[good]}`] : []));
  const label = `Your hold: ${held.length ? held.join(', ') : 'empty'}. ${used} of ${capacity} holds full.`;

  return (
    <div className={`st-hold ${big ? 'st-hold--big' : ''}`}>
      <div className="st-hold__head">
        <strong className="st-hold__title">Your hold</strong>
        <span className="st-hold__count">
          <strong>{used} of {capacity}</strong> full{afterUsed !== used && <> → <strong>{afterUsed}</strong> after trade</>}
        </span>
        <span className="st-hold__bar" aria-hidden="true">
          <span className="st-hold__barfill" style={{ width: `${(100 * used) / capacity}%` }} />
        </span>
      </div>
      <svg className="st-hold__ship" viewBox={`${vx} ${vy} ${vw} ${vh}`} role="img" aria-label={label}>
        {pods.map((p, i) => {
          const clampTop = i === 0 ? p.y + POD.body[1] * p.scale - 10 : SHIP_HOLDS[t.ship].hull[1] - 10;
          const clampBottom = i === 0 ? SHIP_HOLDS[t.ship].hull[0] + 10 : p.y + POD.body[0] * p.scale + 10;
          return [0.3, 0.68].map((f) => (
            <rect key={`c${i}-${f}`} className="st-hold__clamp" x={p.x + POD.w * p.scale * f} y={clampTop} width={18} height={clampBottom - clampTop} rx={5} />
          ));
        })}
        {art ? <image href={art} x={0} y={0} width={SHIP_HOLDS[t.ship].w} height={SHIP_HOLDS[t.ship].h} /> : <Stand ship={t.ship} />}
        {pods.map((p, i) =>
          pod ? (
            <image key={`p${i}`} href={pod} x={p.x} y={p.y} width={POD.w * p.scale} height={POD.h * p.scale} />
          ) : (
            <rect key={`p${i}`} className="st-hold__stand" x={p.x} y={p.y + POD.body[0] * p.scale} width={POD.w * p.scale} height={(POD.body[1] - POD.body[0]) * p.scale} rx={20} />
          ),
        )}
        {boxes.map((b, i) => (
          <rect key={`e${i}`} className="st-hold__empty" x={b.x} y={b.y} width={b.w} height={b.h} rx={Math.min(b.w, b.h) * 0.16} />
        ))}
        {byGood(fills).map(({ good, at }) => {
          const held = t.cargo[good];
          const items = at.map((i) => boxes[i] && <Item key={`${good}-${fills[i].n}`} box={boxes[i]} fill={fills[i]} />);
          // Only goods already in the hold open a card (a planned buy isn't yours yet).
          if (!tops || held === 0) return <g key={good}>{items}</g>;
          return (
            <g
              key={good}
              role="button"
              tabIndex={0}
              aria-label={`${GOODS[good]}, ${held} in hold. Where it sells best`}
              aria-pressed={pinned === good}
              className={`st-hold__group ${shown === good ? 'st-hold__group--lit' : ''}`}
              onClick={() => pick(good)}
              onKeyDown={keys(good)}
              onMouseEnter={() => setHover(good)}
              onMouseLeave={() => setHover(null)}
            >
              {items}
            </g>
          );
        })}
      </svg>
      {big && (
        <ul className="st-hold__strip">
          {t.cargo.map((q, good) => {
            const next = after?.cargo[good] ?? q;
            if (q === 0 && next === 0) return null;
            const pic = goodArt(GOODS[good]);
            return (
              <li key={GOODS[good]} className={next > q ? 'st-hold__tile--buying' : next < q ? 'st-hold__tile--selling' : ''}>
                <button type="button" disabled={!tops || q === 0} aria-pressed={pinned === good} onClick={() => pick(good)}>
                  {pic ? <img src={pic} alt="" /> : <span aria-hidden="true">{goodIcon(good)}</span>}
                  <span>{GOODS[good]}</span>
                  <strong>× {q}{next !== q && ` → ${next}`}</strong>
                </button>
              </li>
            );
          })}
          {used === 0 && afterUsed === 0 && <li className="st-soft">Empty</li>}
        </ul>
      )}
      {galaxy && tops && shown !== null && <GoodCard galaxy={galaxy} t={t} good={shown} tops={tops[shown] ?? []} onClose={() => { setPinned(null); setHover(null); }} />}
    </div>
  );
}
