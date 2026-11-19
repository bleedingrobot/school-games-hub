/**
 * The hold view at the top of the market (docs/plans/trader-hold/PLAN.md, H.1): the ship from above with a box for
 * every hold, cargo pods clamped alongside, and each box showing what's in it. While a trade is picked but not done,
 * boxes about to be bought show faintly and boxes about to be sold fade. Big ships on a narrow phone show a strip
 * instead: one tile per good with how many.
 */
import { GOODS, SHIPS } from '../../../shared/trader/config';
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

export function HoldView({ t, after }: { t: Trader; after?: Trader | null }) {
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
        {fills.map((f, i) => boxes[i] && <Item key={`${f.good}-${f.n}`} box={boxes[i]} fill={f} />)}
      </svg>
      {big && (
        <ul className="st-hold__strip" aria-hidden="true">
          {t.cargo.map((q, good) => {
            const next = after?.cargo[good] ?? q;
            if (q === 0 && next === 0) return null;
            const pic = goodArt(GOODS[good]);
            return (
              <li key={GOODS[good]} className={next > q ? 'st-hold__tile--buying' : next < q ? 'st-hold__tile--selling' : ''}>
                {pic ? <img src={pic} alt="" /> : <span>{goodIcon(good)}</span>}
                <span>{GOODS[good]}</span>
                <strong>× {q}{next !== q && ` → ${next}`}</strong>
              </li>
            );
          })}
          {used === 0 && afterUsed === 0 && <li className="st-soft">Empty</li>}
        </ul>
      )}
    </div>
  );
}
