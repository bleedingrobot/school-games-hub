/**
 * Robin's Berry Basket's pictures: stand-ins drawn in code (SVG) until the painted art pass (see art/CREDITS.md). Robin and
 * the friends, a berry, the basket with its numbered slots, the covered plate, the ten baskets on the log and the Golden
 * Berry Feast. Every number is drawn or counted here in code, so a count is always exact.
 */
import { FRIEND_NAMES, type Friend as FriendName } from '../../../shared/robin/config';
import type { Metal } from '../../../shared/robin/progress';

export type Pose = 'sit' | 'cheer' | 'laugh';

// ---------------------------------------------------------------- the birds

interface BirdLook { body: string; belly: string; wing: string; beak: string; bill: 'point' | 'long' | 'hook' | 'flat'; tufts?: boolean; crest?: string }

const LOOKS: Record<FriendName, BirdLook> = {
  robin: { body: '#8a7a5a', belly: '#e2552e', wing: '#6a5a3c', beak: '#3a3a3a', bill: 'point', tufts: true },
  kiwi: { body: '#8b6b4a', belly: '#a98a64', wing: '#6e5236', beak: '#e8d29a', bill: 'long' },
  kea: { body: '#6a8a3a', belly: '#a6c060', wing: '#4a6a2a', beak: '#4a4a4a', bill: 'hook', crest: '#f08a24' },
  weka: { body: '#7a5a3a', belly: '#b89a6a', wing: '#563c22', beak: '#c9a45a', bill: 'point' },
  pukeko: { body: '#2a4a9a', belly: '#4a6ac0', wing: '#1c3276', beak: '#e8462e', bill: 'flat' },
  tui: { body: '#233a4a', belly: '#35556a', wing: '#16262f', beak: '#2e2e2e', bill: 'point', crest: '#ffffff' },
};

function Bill({ look, open }: { look: BirdLook; open: boolean }) {
  const f = look.beak;
  switch (look.bill) {
    case 'hook': return open ? <path d="M64 28 Q82 26 76 42 Q72 36 64 36 Z M64 38 Q74 38 72 46 Q68 44 64 42 Z" fill={f} /> : <path d="M64 28 Q82 28 76 46 Q72 38 63 38 Z" fill={f} />;
    case 'long': return <path d="M64 32 L96 44 L64 38 Z" fill={f} stroke="#8a6a2c" strokeWidth="0.8" />;
    case 'flat': return <ellipse cx="73" cy="38" rx="11" ry="5" fill={f} />;
    default: return <path d="M64 30 L78 36 L64 40 Z" fill={f} />;
  }
}

/** A bird of the berry basket: Robin (round and owl-faced), or one of the friends. */
export function Bird({ friend, pose = 'sit' }: { friend: FriendName; pose?: Pose }) {
  const look = LOOKS[friend];
  const raised = pose === 'cheer';
  return (
    <svg className={`rb-bird rb-bird--${pose}`} viewBox="0 0 100 100" role="img" aria-label={FRIEND_NAMES[friend]}>
      <path d="M30 80 L14 96 L38 90 Z" fill={look.wing} />
      <ellipse cx="50" cy="62" rx="24" ry="28" fill={look.body} />
      <ellipse cx="53" cy="68" rx="14" ry="20" fill={look.belly} />
      {raised ? (
        <>
          <path d="M30 62 Q10 40 14 22 Q32 34 38 56 Z" fill={look.wing} />
          <path d="M70 62 Q90 40 86 22 Q68 34 62 56 Z" fill={look.wing} />
        </>
      ) : (
        <ellipse cx="36" cy="64" rx="9" ry="17" fill={look.wing} transform="rotate(8 36 64)" />
      )}
      <circle cx="50" cy="32" r="17" fill={look.body} />
      {look.crest && <path d="M44 16 L40 4 L50 12 L54 2 L58 14 Z" fill={look.crest} />}
      {look.tufts && <path d="M36 20 L34 8 L46 16 Z M64 20 L66 8 L54 16 Z" fill={look.wing} />}
      {friend === 'robin' ? (
        <>
          <circle cx="43" cy="31" r="8" fill="#fff" />
          <circle cx="58" cy="31" r="8" fill="#fff" />
          <circle cx="44" cy="31" r="4" fill="#111" />
          <circle cx="59" cy="31" r="4" fill="#111" />
        </>
      ) : (
        <>
          <circle cx="55" cy="29" r="5.5" fill="#fff" />
          <circle cx="56.5" cy="29" r="2.8" fill="#111" />
        </>
      )}
      <Bill look={look} open={pose === 'laugh'} />
      <path d="M42 90 L40 99 M58 90 L60 99" stroke="#e08a24" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Robin or a friend, sized by its box, with the name for screen readers. */
export function Friend({ friend, pose = 'sit' }: { friend: FriendName; pose?: Pose }) {
  return (
    <span className={`rb-friend rb-friend--${pose}`}>
      <Bird friend={friend} pose={pose} />
    </span>
  );
}

// ---------------------------------------------------------------- berries and baskets

/** One berry (a red berry with a green leaf). */
export function BerrySvg() {
  return (
    <svg className="rb-berrysvg" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="23" r="13" fill="#d8283c" stroke="#8c1224" strokeWidth="2" />
      <ellipse cx="15" cy="18" rx="3.5" ry="2.4" fill="#fff" fillOpacity="0.55" transform="rotate(-30 15 18)" />
      <path d="M20 10 C14 4 8 7 8 7 C10 13 16 13 20 10 Z" fill="#4f9a34" stroke="#2f6a1c" strokeWidth="1.5" />
    </svg>
  );
}

/** A berry button's picture: dimmed once counted. */
export function Berry({ dim = false, mark }: { dim?: boolean; mark?: number | null }) {
  return (
    <span className={`rb-berry${dim ? ' rb-berry--dim' : ''}`}>
      <BerrySvg />
      {mark != null && <span className="rb-berry__mark">{mark}</span>}
    </span>
  );
}

/** A woven basket, front view. */
export function BasketSvg({ gold = false }: { gold?: boolean }) {
  const [a, b] = gold ? ['#f2c53a', '#b88a00'] : ['#c79a5a', '#7a5a2a'];
  return (
    <svg className="rb-basketsvg" viewBox="0 0 120 70" aria-hidden="true">
      <path d="M8 20 L112 20 L100 64 Q60 72 20 64 Z" fill={a} stroke={b} strokeWidth="3" strokeLinejoin="round" />
      <path d="M14 32 H106 M18 44 H102 M22 56 H98" stroke={b} strokeWidth="2" opacity="0.7" />
      <rect x="4" y="14" width="112" height="10" rx="5" fill={a} stroke={b} strokeWidth="3" />
    </svg>
  );
}

/**
 * The basket for a give go: `placed` berries in it. With `slots`, ten numbered spaces in two rows of five (each berry
 * lands in its own space; `lit` marks the space to look at, and counted spaces show their number); without, the berries
 * just heap in. With `above`, the number so far shows over the basket.
 */
export function Basket({ placed, slots, above, lit = null, label }: { placed: number; slots: boolean; above: boolean; lit?: number | null; label: string }) {
  const spaces = Math.max(10, Math.ceil(placed / 5) * 5);
  return (
    <div className="rb-basket" role="img" aria-label={label}>
      {above && <span className="rb-basket__above">{placed}</span>}
      <div className={`rb-basket__spaces${slots ? '' : ' rb-basket__spaces--heap'}`}>
        {slots
          ? Array.from({ length: spaces }, (_, i) => (
              <span key={i} className={`rb-slot${i < placed ? ' rb-slot--full' : ''}${lit === i + 1 ? ' rb-slot--lit' : ''}${i % 5 === 4 ? ' rb-slot--end' : ''}`}>
                {i < placed ? <BerrySvg /> : <span className="rb-slot__n">{i + 1}</span>}
              </span>
            ))
          : Array.from({ length: placed }, (_, i) => <span key={i} className="rb-heapberry"><BerrySvg /></span>)}
      </div>
      <BasketSvg />
    </div>
  );
}

/** The covered plate of "one more": a cloth over `n` berries, with the number said on it, and one more berry beside it once added. */
export function Plate({ n, more }: { n: number; more: boolean }) {
  return (
    <div className="rb-plate" role="img" aria-label={`A plate with ${n} berries under a cloth${more ? ', and one more berry' : ''}`}>
      <svg viewBox="0 0 200 110" aria-hidden="true">
        <ellipse cx="100" cy="86" rx="90" ry="16" fill="#e8e2d2" stroke="#9a9078" strokeWidth="3" />
        <path d="M24 84 C24 24 176 24 176 84 Q100 98 24 84 Z" fill="#7aa8d8" stroke="#3a6aa0" strokeWidth="3" />
        <path d="M60 78 Q64 48 76 40 M100 78 V36 M140 78 Q136 48 124 40" stroke="#3a6aa0" strokeWidth="2" fill="none" opacity="0.6" />
      </svg>
      <span className="rb-plate__n">{n}</span>
      {more && <span className="rb-plate__more"><BerrySvg /></span>}
    </div>
  );
}

// ---------------------------------------------------------------- the baskets on the log

const METAL_FILL: Record<Metal, [string, string]> = { plain: ['#c9b48a', '#7a6a4a'], bronze: ['#d98b4a', '#8a4f1c'], silver: ['#dfe5ec', '#8d97a5'], gold: ['#ffd23f', '#b88a00'] };

/** One small basket on the log: plain wicker, or bronze, silver or gold. */
export function Small({ metal, glow = false }: { metal: Metal; glow?: boolean }) {
  const [a, b] = METAL_FILL[metal];
  return (
    <span className={`rb-small rb-small--${metal}${glow ? ' rb-small--glow' : ''}`}>
      <svg viewBox="0 0 60 50" aria-hidden="true">
        <path d="M6 16 L54 16 L48 44 Q30 50 12 44 Z" fill={a} stroke={b} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M9 26 H51 M11 35 H49" stroke={b} strokeWidth="1.5" opacity="0.7" />
        <path d="M10 16 C10 2 50 2 50 16" fill="none" stroke={b} strokeWidth="3" strokeLinecap="round" />
        {metal !== 'plain' && (
          <>
            <circle cx="24" cy="14" r="5" fill="#d8283c" stroke="#8c1224" strokeWidth="1.2" />
            <circle cx="36" cy="14" r="5" fill="#d8283c" stroke="#8c1224" strokeWidth="1.2" />
          </>
        )}
      </svg>
    </span>
  );
}

/** The ten baskets on the log, five to a row. */
export function BasketLog({ baskets, glowAt = null }: { baskets: { metal: Metal }[]; glowAt?: number | null }) {
  const changed = baskets.filter((t) => t.metal !== 'plain').length;
  return (
    <div className="rb-log" role="img" aria-label={`${changed} of ${baskets.length} baskets changed`}>
      {baskets.map((t, i) => (
        <span key={i} className="rb-log__spot">
          <Small metal={t.metal} glow={i === glowAt} />
        </span>
      ))}
    </div>
  );
}

/** The Golden Berry Feast, the grandest basket of all. */
export function GoldenFeast() {
  return (
    <svg className="rb-golden" viewBox="0 0 140 120" role="img" aria-label="The Golden Berry Feast">
      {[[40, 40], [60, 28], [80, 28], [100, 40], [50, 54], [70, 46], [90, 54]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="13" fill="#d8283c" stroke="#8c1224" strokeWidth="3" />
      ))}
      <path d="M10 56 L130 56 L116 110 Q70 120 24 110 Z" fill="#ffd23f" stroke="#b88a00" strokeWidth="4" strokeLinejoin="round" />
      <path d="M16 72 H124 M20 88 H120 M24 100 H116" stroke="#b88a00" strokeWidth="3" opacity="0.7" />
      <rect x="6" y="48" width="128" height="12" rx="6" fill="#f2b800" stroke="#b88a00" strokeWidth="4" />
      <path d="M118 10 l4 -10 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 Z" fill="#fff6b0" />
    </svg>
  );
}
