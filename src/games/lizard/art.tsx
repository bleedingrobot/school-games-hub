/**
 * Lizard's Bundles' pictures. Stand-ins drawn in code (a painted pass comes later, docs/lizard-art/config.json): the sticks, the
 * bundles of ten, the raft of a hundred, Lizard and the friends, the den's bundles and the Golden Raft are plain SVG.
 */
import type { Friend as FriendName, Metal } from '../../../shared/lizard/progress';
import { FRIEND_NAMES } from '../../../shared/lizard/progress';

export type Pose = 'sit' | 'eat' | 'cheer';
export type Scenery = 'bronze' | 'silver' | 'gold';

const BODY: Record<FriendName, { body: string; belly: string }> = {
  lizard: { body: '#5aa23a', belly: '#e9f3b8' },
  kiwi: { body: '#7a5a3a', belly: '#c9a46a' },
  fantail: { body: '#4a4a4f', belly: '#f4efe6' },
  bellbird: { body: '#7b8f2a', belly: '#c9d27a' },
  kea: { body: '#6b7a2b', belly: '#d8742a' },
};

/** Lizard, a long green lizard with a curly tail, or a round friend in their own colours. */
export function Friend({ friend, pose }: { friend: FriendName; pose: Pose }) {
  const c = BODY[friend];
  return (
    <span className={`lz-friend lz-friend--${pose}`}>
      {friend === 'lizard' ? (
        <svg viewBox="0 0 100 60" width="100%" height="100%" aria-hidden="true">
          <path d="M4 40 Q-2 24 14 26 Q8 36 20 38 Q34 22 62 28 Q80 20 92 26 L98 32 L90 38 Q76 44 60 42 Q44 48 28 46 Z" fill={c.body} />
          <path d="M26 45 Q44 50 60 43 Q44 42 26 45 Z" fill={c.belly} />
          <path d="M34 44 L30 54 M50 45 L48 55 M70 40 L74 50" stroke={c.body} strokeWidth="5" strokeLinecap="round" />
          <circle cx="86" cy="28" r="3" fill="#fff" />
          <circle cx="86.8" cy="28" r="1.5" fill="#111" />
          <path d="M92 34 Q96 36 99 34" stroke="#2a5a1a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      ) : (
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
      )}
      <span className="lz-sr">{FRIEND_NAMES[friend]}</span>
    </span>
  );
}

const METAL: Record<Metal, string> = { twine: '#c9a46a', bronze: '#c8803a', silver: '#c9ced6', gold: '#f4c20d' };

/** One loose stick. */
export function Stick({ tone = 'plain' }: { tone?: 'plain' | 'new' | 'gone' }) {
  return (
    <span className={`lz-stick lz-stick--${tone}`} aria-hidden="true">
      <svg viewBox="0 0 12 60" width="100%" height="100%">
        <rect x="2" y="2" width="8" height="56" rx="4" fill="#d9a85a" stroke="#8a5d22" strokeWidth="1.5" />
        <path d="M5 8 V50" stroke="#f1cf8e" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** Ten sticks tied with a band. The band is twine at first, and bronze, silver or gold in the den. */
export function Bundle({ metal = 'twine', tone = 'plain', glow = false }: { metal?: Metal; tone?: 'plain' | 'new' | 'gone'; glow?: boolean }) {
  return (
    <span className={`lz-bundle lz-bundle--${tone}${glow ? ' lz-bundle--glow' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 60 64" width="100%" height="100%">
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={3 + i * 5.4} y="2" width="4.6" height="60" rx="2.3" fill="#d9a85a" stroke="#8a5d22" strokeWidth="1" />
        ))}
        <rect x="1" y="26" width="58" height="12" rx="4" fill={METAL[metal]} stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" />
        <path d="M6 32 H54" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>
    </span>
  );
}

/** A raft: ten bundles lashed side by side, a hundred. */
export function Raft({ tone = 'plain' }: { tone?: 'plain' | 'new' | 'gone' }) {
  return (
    <span className={`lz-raft lz-raft--${tone}`} aria-hidden="true">
      <svg viewBox="0 0 100 64" width="100%" height="100%">
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={2 + i * 9.6} y="2" width="8" height="60" rx="3" fill="#d9a85a" stroke="#8a5d22" strokeWidth="1.2" />
        ))}
        <rect x="0" y="14" width="100" height="8" rx="3" fill="#c8803a" stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" />
        <rect x="0" y="42" width="100" height="8" rx="3" fill="#c8803a" stroke="rgba(0,0,0,0.35)" strokeWidth="1.2" />
      </svg>
    </span>
  );
}

export function GoldenRaft() {
  return (
    <span className="lz-golden" role="img" aria-label="The Golden Raft">
      <svg viewBox="0 0 120 60" width="100%" height="100%" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={4 + i * 11} y="6" width="9" height="48" rx="3.5" fill="#f4c20d" stroke="#b8860b" strokeWidth="1.5" />
        ))}
        <rect x="2" y="16" width="116" height="8" rx="3" fill="#ffe27a" stroke="#b8860b" strokeWidth="1.5" />
        <rect x="2" y="38" width="116" height="8" rx="3" fill="#ffe27a" stroke="#b8860b" strokeWidth="1.5" />
      </svg>
    </span>
  );
}
