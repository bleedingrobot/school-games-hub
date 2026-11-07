/**
 * Pigeon's Number Line's pictures: the painted ones (scripts/game_art.py pigeon, tidied into ./art/paint/, picks in
 * docs/pigeon-art/picks.json) and, as a fallback when a picture is missing, the plain SVG stand-ins drawn in code. Every
 * number, mark and label is drawn by the NumberLine kit. Only the pictures' addresses are bundled; they download when shown.
 */
import type { CSSProperties } from 'react';
import type { Friend as FriendName, Metal } from '../../../shared/pigeon/progress';
import { FRIEND_NAMES } from '../../../shared/pigeon/progress';

const FILES = import.meta.glob('./art/paint/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export const paint = (path: string): string | undefined => FILES[`./art/paint/${path}.webp`];

/** The branch background for a day's colour, as CSS variables (a full and a small copy). Nothing if it is not painted. */
export function sceneStyle(scenery: Scenery): CSSProperties | undefined {
  const full = paint(`back/${scenery}`);
  if (!full) return undefined;
  const small = paint(`back/${scenery}-800`) ?? full;
  return { '--pg-back': `url(${full})`, '--pg-back-small': `url(${small})` } as CSSProperties;
}

export type Pose = 'sit' | 'eat' | 'cheer';
export type Scenery = 'bronze' | 'silver' | 'gold';

const BODY: Record<FriendName, { body: string; belly: string }> = {
  pigeon: { body: '#3f7d5a', belly: '#f6f1e4' },
  sparrow: { body: '#1f5f6f', belly: '#2b3b55' },
  fantail: { body: '#4a4a4f', belly: '#f4efe6' },
  bellbird: { body: '#7b8f2a', belly: '#c9d27a' },
  parrot: { body: '#7a5a3a', belly: '#c4572f' },
};

/** A round bird with a beak, in each friend's colours. */
export function Friend({ friend, pose }: { friend: FriendName; pose: Pose }) {
  const c = BODY[friend];
  const src = paint(`friends/${friend}-${pose}`);
  if (src) {
    return (
      <span className={`pg-friend pg-friend--${pose} pg-friend--painted`}>
        <img src={src} alt="" aria-hidden="true" draggable={false} />
        <span className="pg-sr">{FRIEND_NAMES[friend]}</span>
      </span>
    );
  }
  return (
    <span className={`pg-friend pg-friend--${pose}`}>
      <svg viewBox="0 0 80 80" width="100%" height="100%" aria-hidden="true">
        <ellipse cx="38" cy="48" rx="24" ry="22" fill={c.body} />
        <ellipse cx="40" cy="54" rx="15" ry="14" fill={c.belly} />
        <circle cx="52" cy="28" r="14" fill={c.body} />
        <path d="M63 27 L75 32 L63 35 Z" fill="#e8a317" />
        <circle cx="55" cy="25" r="2.6" fill="#fff" />
        <circle cx="55.6" cy="25" r="1.3" fill="#111" />
        <path d="M14 52 L2 60 L16 62 Z" fill={c.body} />
        <path d="M32 68 L30 76 M44 68 L46 76" stroke="#8a6a2c" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="pg-sr">{FRIEND_NAMES[friend]}</span>
    </span>
  );
}

const METAL: Record<Metal, string> = { green: '#6a9a45', bronze: '#c8803a', silver: '#c9ced6', gold: '#f4c20d' };

/** One cluster of berries: green until it changes. */
export function Cluster({ metal, glow = false }: { metal: Metal; glow?: boolean }) {
  const fill = METAL[metal];
  const src = paint(`berries/${metal}`);
  if (src) {
    return (
      <span className={`pg-cluster pg-cluster--${metal}${glow ? ' pg-cluster--glow' : ''}`}>
        <img src={src} alt="" aria-hidden="true" draggable={false} />
      </span>
    );
  }
  return (
    <span className={`pg-cluster pg-cluster--${metal}${glow ? ' pg-cluster--glow' : ''}`}>
      <svg viewBox="0 0 40 44" width="100%" height="100%" aria-hidden="true">
        <path d="M20 2 Q24 8 22 12" stroke="#4a6b2b" strokeWidth="3" fill="none" strokeLinecap="round" />
        {[[12, 18], [28, 18], [20, 28], [10, 34], [30, 34]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="7.5" fill={fill} stroke="rgba(0,0,0,0.25)" strokeWidth="1.2" />
        ))}
        <circle cx="10" cy="15" r="2" fill="rgba(255,255,255,0.55)" />
      </svg>
    </span>
  );
}

export function GoldenBranch() {
  const src = paint('berries/golden-branch');
  if (src) {
    return (
      <span className="pg-golden" role="img" aria-label="The Golden Berry Branch">
        <img src={src} alt="" draggable={false} />
      </span>
    );
  }
  return (
    <span className="pg-golden" role="img" aria-label="The Golden Berry Branch">
      <svg viewBox="0 0 120 50" width="100%" height="100%" aria-hidden="true">
        <path d="M4 40 Q60 20 116 36" stroke="#8a6a2c" strokeWidth="5" fill="none" strokeLinecap="round" />
        {[22, 44, 66, 88, 108].map((x, i) => (
          <circle key={x} cx={x} cy={i % 2 ? 32 : 24} r="7" fill="#f4c20d" stroke="#b8860b" strokeWidth="1.5" />
        ))}
      </svg>
    </span>
  );
}
