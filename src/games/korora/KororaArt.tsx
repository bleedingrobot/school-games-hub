/**
 * Kororā, the chicks, the fish and the pebbles. Each uses its painted picture once there is one (art.ts) and a soft clay
 * stand-in drawn in code until then (the look James chose, like Kiwi's Beanstalk), so the game can be tried before the
 * art is painted. Numbers are always drawn in code, dark on light.
 */
import type { Friend as FriendName, Metal } from '../../../shared/korora/progress';
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

/** A stand-in Kororā: a little blue penguin in clay, slate-blue back, white front, pink feet. */
function DrawnPenguin({ pose }: { pose: Pose }) {
  const up = pose === 'cheer';
  const dive = pose === 'dive';
  return (
    <svg viewBox="0 0 100 110" className="kr-drawn" aria-hidden="true" style={dive ? { rotate: '35deg' } : undefined}>
      <defs>
        <ClayDefs id="kr-blue" light="#9cc0e6" base="#5d86b8" dark="#34557f" />
        <ClayDefs id="kr-white" light="#ffffff" base="#f3f0ea" dark="#d6d0c6" />
      </defs>
      <ellipse cx="38" cy="104" rx="11" ry="5" fill="#f2a0a8" />
      <ellipse cx="62" cy="104" rx="11" ry="5" fill="#f2a0a8" />
      {/* flippers: down, or up and out for a cheer */}
      <path d={up ? 'M22 52 Q6 34 8 18 Q18 34 28 46 Z' : 'M22 50 Q8 66 12 84 Q22 70 28 58 Z'} fill="url(#kr-blue)" />
      <path d={up ? 'M78 52 Q94 34 92 18 Q82 34 72 46 Z' : 'M78 50 Q92 66 88 84 Q78 70 72 58 Z'} fill="url(#kr-blue)" />
      <ellipse cx="50" cy="62" rx="30" ry="40" fill="url(#kr-blue)" />
      <ellipse cx="50" cy="70" rx="21" ry="30" fill="url(#kr-white)" />
      <circle cx="40" cy="38" r="6" fill="#fff" />
      <circle cx="60" cy="38" r="6" fill="#fff" />
      <circle cx="41" cy="39" r="3.4" fill="#1b2340" />
      <circle cx="61" cy="39" r="3.4" fill="#1b2340" />
      <circle cx="42.4" cy="37.6" r="1.2" fill="#fff" />
      <circle cx="62.4" cy="37.6" r="1.2" fill="#fff" />
      {pose === 'gulp' ? (
        <>
          <path d="M44 46 L56 46 L50 56 Z" fill="#3a3a44" />
          <path d="M56 50 Q66 46 70 52 Q66 56 58 52 Z" fill="#f59a3c" />
        </>
      ) : (
        <path d="M44 46 Q50 44 56 46 L50 54 Z" fill="#3a3a44" />
      )}
      <circle cx="34" cy="48" r="3.4" fill="#f59ab0" opacity="0.6" />
      <circle cx="66" cy="48" r="3.4" fill="#f59ab0" opacity="0.6" />
    </svg>
  );
}

const FRIEND_EMOJI: Record<FriendName, string> = { korora: '🐧', hoiho: '🐧', kiwi: '🥝', pukeko: '🐦', kereru: '🕊️', takahe: '🦃' };

/** Whoever is fishing at the pool: Kororā, or a later friend. */
export function Friend({ friend, pose, className = '' }: { friend: FriendName; pose: Pose; className?: string }) {
  const src = friendArt(friend, pose);
  const cls = `kr-friend kr-friend--${pose} ${className}`;
  if (src) return <img className={cls} src={src} alt="" />;
  if (friend === 'korora') return <span className={cls}><DrawnPenguin pose={pose} /></span>;
  return (
    <span className={`${cls} kr-friend--emoji`} aria-hidden="true" title={FRIEND_NAMES[friend]}>
      {FRIEND_EMOJI[friend]}
    </span>
  );
}

/** A fluffy grey chick waiting for its share. */
export function Chick({ happy }: { happy?: boolean }) {
  const src = paint(`things/chick-${happy ? 'happy' : 'wait'}`);
  if (src) return <img className="kr-chick__art" src={src} alt="" />;
  return (
    <svg viewBox="0 0 80 80" className="kr-chick__art" aria-hidden="true">
      <defs>
        <ClayDefs id="kr-fluff" light="#e4e9ef" base="#a9b4c2" dark="#77849a" />
      </defs>
      <ellipse cx="40" cy="48" rx="28" ry="26" fill="url(#kr-fluff)" />
      <circle cx="40" cy="28" r="18" fill="url(#kr-fluff)" />
      <circle cx="33" cy="26" r="3" fill="#1b2340" />
      <circle cx="47" cy="26" r="3" fill="#1b2340" />
      <path d={happy ? 'M35 33 L45 33 L40 40 Z' : 'M36 32 L44 32 L40 37 Z'} fill="#3a3a44" />
      {happy && <path d="M14 40 Q6 30 10 22 M66 40 Q74 30 70 22" stroke="#a9b4c2" strokeWidth="6" strokeLinecap="round" fill="none" />}
    </svg>
  );
}

/** One clay fish. */
export function Fish({ golden }: { golden?: boolean }) {
  const src = paint(golden ? 'things/golden-fish' : 'things/fish');
  if (src) return <img className="kr-fish__art" src={src} alt="" />;
  const id = golden ? 'kr-gold' : 'kr-orange';
  return (
    <svg viewBox="0 0 60 36" className="kr-fish__art" aria-hidden="true">
      <defs>
        {golden ? <ClayDefs id={id} light="#fff6b0" base="#f5c518" dark="#b98a00" /> : <ClayDefs id={id} light="#ffd2a0" base="#f39a4a" dark="#c0622a" />}
      </defs>
      <path d="M44 18 L58 6 L56 18 L58 30 Z" fill={`url(#${id})`} />
      <ellipse cx="26" cy="18" rx="22" ry="14" fill={`url(#${id})`} />
      <circle cx="14" cy="15" r="3.2" fill="#fff" />
      <circle cx="13.5" cy="15.5" r="1.8" fill="#1b2340" />
      <path d="M22 8 Q28 18 22 28" stroke="rgb(0 0 0 / 0.15)" strokeWidth="2" fill="none" />
    </svg>
  );
}

const PEBBLE: Record<Metal, [string, string, string]> = {
  grey: ['#d9d6cf', '#a8a39a', '#7c776e'],
  bronze: ['#f0b98a', '#c97a3a', '#8a4a1a'],
  silver: ['#ffffff', '#c9d3de', '#8b96a3'],
  gold: ['#fff6b0', '#f5c518', '#b98a00'],
};

/** A magic pebble by the pool (or, with a value, an answer pebble with its number on a light disc). */
export function Pebble({ metal, value, glow }: { metal: Metal; value?: number; glow?: boolean }) {
  const src = paint(`pebbles/${metal}`);
  const [light, base, dark] = PEBBLE[metal];
  return (
    <span className={`kr-pebble kr-pebble--${metal}${glow ? ' kr-pebble--glow' : ''}`}>
      {src ? (
        <img className="kr-pebble__art" src={src} alt="" />
      ) : (
        <svg viewBox="0 0 100 70" className="kr-pebble__art" aria-hidden="true">
          <defs>
            <ClayDefs id={`kr-pb-${metal}`} light={light} base={base} dark={dark} />
          </defs>
          <path d="M8 40 Q6 12 46 8 Q92 6 94 36 Q96 64 52 64 Q10 66 8 40 Z" fill={`url(#kr-pb-${metal})`} />
        </svg>
      )}
      {value != null && <span className="kr-pebble__num">{value}</span>}
    </span>
  );
}
