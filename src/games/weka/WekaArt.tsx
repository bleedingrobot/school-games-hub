/**
 * Weka, the stepping stones, the big rock, the magic stones on the far bank and the Golden Picnic Basket. Each uses its
 * painted picture once there is one (art.ts) and a soft clay stand-in drawn in code until then (the look of Kiwi's
 * Beanstalk), so the game can be tried before the art is painted. Numbers are always drawn in code, dark on light.
 */
import type { Friend as FriendName, Metal } from '../../../shared/weka/progress';
import { FRIEND_NAMES, friendArt, paint, type Pose } from './art';

/** Shared clay shading: a soft light from the top left. */
function ClayDefs({ id, light, base, dark }: { id: string; light: string; base: string; dark: string }) {
  return (
    <radialGradient id={id} cx="35%" cy="30%" r="75%">
      <stop offset="0%" stopColor={light} />
      <stop offset="55%" stopColor={base} />
      <stop offset="100%" stopColor={dark} />
    </radialGradient>
  );
}

/** A stand-in Weka in clay: a round brown bird with streaky feathers, a strong grey beak, red eyes and long legs. */
function DrawnWeka({ pose }: { pose: Pose }) {
  const up = pose === 'cheer';
  const hop = pose === 'hop';
  return (
    <svg viewBox="0 0 100 110" className="wk-drawn" aria-hidden="true">
      <defs>
        <ClayDefs id="wk-brown" light="#c99a6a" base="#8a5a32" dark="#55361c" />
        <ClayDefs id="wk-breast" light="#d8b48a" base="#a87a4e" dark="#6e4a2a" />
      </defs>
      {/* legs: standing, or tucked for a hop */}
      {hop ? (
        <path d="M40 82 L34 92 M60 82 L66 92" stroke="#c46a5a" strokeWidth="5" strokeLinecap="round" />
      ) : (
        <path d="M42 80 L40 104 L32 106 M58 80 L60 104 L68 106" stroke="#c46a5a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      )}
      {/* tail, then body */}
      <path d="M78 58 Q96 50 94 38 Q86 52 74 52 Z" fill="url(#wk-brown)" />
      <ellipse cx="50" cy="60" rx="32" ry="26" fill="url(#wk-brown)" />
      <ellipse cx="44" cy="66" rx="20" ry="17" fill="url(#wk-breast)" />
      <path d="M58 52 Q66 58 62 66 M66 50 Q74 56 72 64 M48 70 Q50 76 46 80" stroke="#3e2512" strokeWidth="2" fill="none" opacity="0.5" />
      {/* wings: down, or up and out for a cheer */}
      <path d={up ? 'M62 44 Q78 24 88 26 Q80 40 70 52 Z' : 'M60 50 Q80 56 82 70 Q66 66 58 60 Z'} fill="url(#wk-brown)" />
      {/* head and beak */}
      <circle cx="30" cy="38" r="17" fill="url(#wk-brown)" />
      <path d="M16 38 L2 42 L16 45 Z" fill="#8c8a86" />
      <circle cx="26" cy="33" r="5" fill="#fff" />
      <circle cx="25" cy="33.5" r="3" fill="#b0332a" />
      <circle cx="24.4" cy="32.6" r="1" fill="#fff" />
      <path d="M22 40 Q30 42 38 38" stroke="#d9c39a" strokeWidth="2" fill="none" opacity="0.7" />
      {pose === 'land' && <circle cx="36" cy="44" r="3.2" fill="#f59ab0" opacity="0.6" />}
    </svg>
  );
}

const FRIEND_EMOJI: Record<FriendName, string> = { weka: '🐦', kiwi: '🥝', takahe: '🦃', kakapo: '🦜', pukeko: '🐦', kea: '🦜' };

/** Whoever is crossing the stream: Weka, or a later friend. */
export function Friend({ friend, pose, className = '' }: { friend: FriendName; pose: Pose; className?: string }) {
  const src = friendArt(friend, pose);
  const cls = `wk-friend wk-friend--${pose} ${className}`;
  if (src) return <img className={cls} src={src} alt="" />;
  if (friend === 'weka') return <span className={cls}><DrawnWeka pose={pose} /></span>;
  return (
    <span className={`${cls} wk-friend--emoji`} aria-hidden="true" title={FRIEND_NAMES[friend]}>
      {FRIEND_EMOJI[friend]}
    </span>
  );
}

/** The two shades of a stepping stone: 1 to 5 of each ten light, 6 to 10 darker, so fives and tens show at a glance. */
export type Shade = 'light' | 'dark';

/**
 * One stepping stone in the stream, flat grey clay, with its number when shown. Stone 10 is the big flat rock. `mark`
 * colours the hops: 'to' the hops to the big rock, 'on' the hops after it.
 */
export function StepStone({ n, big, shade, number, mark }: { n: number; big?: boolean; shade: Shade; number: boolean; mark?: 'to' | 'on' | null }) {
  const src = paint(big ? 'things/big-rock' : 'things/stone');
  const [light, base, dark] = big ? ['#f2e6c8', '#c9b48a', '#8a7650'] : shade === 'light' ? ['#eef0f0', '#b9bec2', '#848b92'] : ['#c9ced3', '#8d959d', '#5e666e'];
  return (
    <span className={`wk-step${big ? ' wk-step--big' : ''}${mark ? ` wk-step--${mark}` : ''}`}>
      {src ? (
        <img className="wk-step__art" src={src} alt="" />
      ) : (
        <svg viewBox="0 0 100 60" className="wk-step__art" aria-hidden="true" preserveAspectRatio="none">
          <defs>
            <ClayDefs id={`wk-st-${n}`} light={light} base={base} dark={dark} />
          </defs>
          <path d="M6 34 Q4 10 48 8 Q94 6 95 32 Q96 54 50 54 Q8 56 6 34 Z" fill={`url(#wk-st-${n})`} />
        </svg>
      )}
      {number && <span className="wk-step__num">{n}</span>}
    </span>
  );
}

const STONE: Record<Metal, [string, string, string]> = {
  grey: ['#d9d6cf', '#a8a39a', '#7c776e'],
  bronze: ['#f0b98a', '#c97a3a', '#8a4a1a'],
  silver: ['#ffffff', '#c9d3de', '#8b96a3'],
  gold: ['#fff6b0', '#f5c518', '#b98a00'],
};

/** A magic stone on the far bank (or, with a value, an answer stone with its number on a light disc). */
export function Stone({ metal, value, glow }: { metal: Metal; value?: number; glow?: boolean }) {
  const src = paint(`stones/${metal}`);
  const [light, base, dark] = STONE[metal];
  return (
    <span className={`wk-stone wk-stone--${metal}${glow ? ' wk-stone--glow' : ''}`}>
      {src ? (
        <img className="wk-stone__art" src={src} alt="" />
      ) : (
        <svg viewBox="0 0 100 70" className="wk-stone__art" aria-hidden="true">
          <defs>
            <ClayDefs id={`wk-pb-${metal}`} light={light} base={base} dark={dark} />
          </defs>
          <path d="M8 40 Q6 12 46 8 Q92 6 94 36 Q96 64 52 64 Q10 66 8 40 Z" fill={`url(#wk-pb-${metal})`} />
        </svg>
      )}
      {value != null && <span className="wk-stone__num">{value}</span>}
    </span>
  );
}

/** A hop: a little clay footprint dot, warm for the hops to the big rock, cool for the hops after it. */
export function Hop({ part }: { part: 'to' | 'on' }) {
  return <span className={`wk-hop wk-hop--${part}`} aria-hidden="true" />;
}

/** The Golden Picnic Basket (or, alone on the shelf, a small one). */
export function Basket() {
  const src = paint('things/golden-basket');
  if (src) return <img className="wk-basket__art" src={src} alt="" />;
  return (
    <svg viewBox="0 0 80 70" className="wk-basket__art" aria-hidden="true">
      <defs>
        <ClayDefs id="wk-gold" light="#fff6b0" base="#f5c518" dark="#b98a00" />
      </defs>
      <path d="M18 30 Q40 -4 62 30" stroke="url(#wk-gold)" strokeWidth="6" fill="none" />
      <path d="M8 30 L72 30 L64 64 L16 64 Z" fill="url(#wk-gold)" />
      <path d="M12 42 L68 42 M14 53 L66 53 M28 30 L30 64 M40 30 L40 64 M52 30 L50 64" stroke="#b98a00" strokeWidth="2" opacity="0.7" />
      <path d="M10 30 Q24 22 40 30 Q56 22 70 30" fill="#e8554e" />
    </svg>
  );
}
