/**
 * The pictures, painted (./art.ts) or, until James paints them, paper cut-out stand-ins drawn here: flat colours, a few
 * layers, and a small hard shadow under each piece as if cut from card. Numbers are always drawn here, never painted.
 */
import type { Friend as FriendName, Metal } from '../../../shared/pipi/progress';
import { FRIEND_NAMES, paint, type FriendPose, type PipiPose } from './art';

const METAL: Record<Metal, [string, string]> = {
  sand: ['#ead2a4', '#d6b880'],
  bronze: ['#d38a4f', '#a8622f'],
  silver: ['#d9e1e8', '#9aa8b5'],
  gold: ['#f6c945', '#c9951a'],
};

/** One pipi: a little striped wedge shell with a face. Digging tips it into the sand; popping up and waving lifts its foot. */
export function Pipi({ pose = 'sit' }: { pose?: PipiPose }) {
  const art = paint(`pipi/pipi-${pose}`);
  if (art) return <img className={`pp-pipi pp-pipi--${pose}`} src={art} alt="" />;
  return (
    <svg className={`pp-pipi pp-pipi--${pose}`} viewBox="0 0 60 50" aria-hidden="true">
      {(pose === 'wave' || pose === 'pop') && <path className="pp-pipi__foot" d="M44 26 Q58 14 54 4" stroke="#e98b7a" strokeWidth="6" fill="none" strokeLinecap="round" />}
      <path d="M6 40 Q4 16 30 8 Q56 16 54 40 Z" fill="#c98b6b" />
      <path d="M8 38 Q7 18 30 11 Q53 18 52 38 Z" fill="#f1c9a5" />
      <path d="M16 36 Q15 22 30 14 M30 14 Q45 22 44 36 M30 14 L30 37" stroke="#dca37f" strokeWidth="2.5" fill="none" />
      <rect x="5" y="37" width="50" height="6" rx="3" fill="#b8775a" />
      <circle cx="23" cy="27" r="4" fill="#fff" />
      <circle cx="37" cy="27" r="4" fill="#fff" />
      <circle cx="23.5" cy="27.5" r="2" fill="#2b2233" />
      <circle cx="37.5" cy="27.5" r="2" fill="#2b2233" />
      <path d="M25 33 Q30 37 35 33" stroke="#2b2233" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Where a pipi dug in: a little heap of sand, with a dashed outline on bronze days and a faint one on silver days. */
export function Hidden({ outline }: { outline: 'full' | 'faint' | 'none' }) {
  return (
    <svg className={`pp-hidden pp-hidden--${outline}`} viewBox="0 0 60 50" aria-hidden="true">
      <path d="M2 46 Q30 30 58 46 Z" fill="#d9bb83" />
      <path d="M8 46 Q30 34 52 46 Z" fill="#e7cd99" />
      {outline !== 'none' && <path className="pp-hidden__outline" d="M8 40 Q7 18 30 11 Q53 18 52 40 Z" fill="none" stroke="#7a5a3a" strokeWidth="2.5" strokeDasharray="5 4" />}
    </svg>
  );
}

/** A number shell to tap: the painted sand shell (or a paper scallop) with its number drawn on it. */
export function NumberShell({ value }: { value: number }) {
  const art = paint('shells/shell-sand');
  if (art) {
    return (
      <svg className="pp-shell pp-shell--painted" viewBox="0 0 100 90" aria-hidden="true">
        <image href={art} x="0" y="0" width="100" height="90" preserveAspectRatio="xMidYMid meet" />
        <text x="50" y="54" textAnchor="middle" className="pp-shell__number">{value}</text>
      </svg>
    );
  }
  return (
    <svg className="pp-shell" viewBox="0 0 100 90" aria-hidden="true">
      <path d="M50 4 C82 4 98 30 94 60 L62 84 L38 84 L6 60 C2 30 18 4 50 4 Z" fill="#e89a8c" />
      <path d="M50 9 C78 9 92 31 89 58 L60 79 L40 79 L11 58 C8 31 22 9 50 9 Z" fill="#fbe3d6" />
      <path d="M50 12 L50 76 M50 12 L28 72 M50 12 L72 72 M50 12 L14 56 M50 12 L86 56" stroke="#f3c6b4" strokeWidth="3" />
      <rect x="40" y="80" width="20" height="8" rx="3" fill="#c97b6e" />
      <text x="50" y="58" textAnchor="middle" className="pp-shell__number">{value}</text>
    </svg>
  );
}

/** One of the ten magic shells along the high-tide line. */
export function MagicShell({ metal, glow = false }: { metal: Metal; glow?: boolean }) {
  const art = paint(`shells/shell-${metal}`);
  const cls = `pp-magic pp-magic--${metal}${glow ? ' pp-magic--glow' : ''}`;
  if (art) return <img className={cls} src={art} alt="" />;
  const [face, edge] = METAL[metal];
  return (
    <svg className={cls} viewBox="0 0 60 54" aria-hidden="true">
      <path d="M30 3 C50 3 59 18 57 36 L38 50 L22 50 L3 36 C1 18 10 3 30 3 Z" fill={edge} />
      <path d="M30 7 C47 7 54 20 52 34 L36 46 L24 46 L8 34 C6 20 13 7 30 7 Z" fill={face} />
      <path d="M30 9 L30 44 M30 9 L18 42 M30 9 L42 42 M30 9 L10 32 M30 9 L50 32" stroke={edge} strokeWidth="2" opacity="0.6" />
    </svg>
  );
}

/** The Golden Pearl, alone or on its cushion. */
export function Pearl({ cushion = false }: { cushion?: boolean }) {
  const art = paint(cushion ? 'things/pearl-cushion' : 'things/pearl');
  if (art) return <img className="pp-pearl" src={art} alt="" />;
  return (
    <svg className="pp-pearl" viewBox="0 0 80 70" aria-hidden="true">
      {cushion && <ellipse cx="40" cy="56" rx="36" ry="12" fill="#c0392b" />}
      {cushion && <ellipse cx="40" cy="52" rx="32" ry="10" fill="#e74c3c" />}
      <circle cx="40" cy="34" r="20" fill="#d9a21a" />
      <circle cx="40" cy="33" r="17" fill="#f7d35c" />
      <circle cx="33" cy="26" r="5" fill="#fff6c8" />
    </svg>
  );
}

const FRIEND_COLOUR: Record<FriendName, [string, string]> = {
  pipi: ['#f1c9a5', '#c98b6b'],
  korora: ['#6f86a8', '#3f5574'],
  tuatara: ['#8aa05a', '#5d7238'],
  weta: ['#a8673d', '#6e3f22'],
  kiwi: ['#9a7a55', '#6b5236'],
  tui: ['#3c5f6e', '#22394a'],
};

/** The beach's friend, big beside the sand. Pipi is a big pipi; the others are paper stand-ins until painted. */
export function Friend({ friend, pose = 'wait' }: { friend: FriendName; pose?: FriendPose }) {
  const art = paint(`friends/${friend}-${pose}`) ?? paint(`friends/${friend}-wait`);
  if (art) return <img className={`pp-friend pp-friend--${pose}`} src={art} alt={FRIEND_NAMES[friend]} />;
  if (friend === 'pipi') {
    return (
      <span className={`pp-friend pp-friend--${pose}`} role="img" aria-label={FRIEND_NAMES[friend]}>
        <Pipi pose={pose === 'wait' ? 'sit' : 'wave'} />
      </span>
    );
  }
  const [body, edge] = FRIEND_COLOUR[friend];
  return (
    <svg className={`pp-friend pp-friend--${pose}`} viewBox="0 0 80 80" role="img" aria-label={FRIEND_NAMES[friend]}>
      <ellipse cx="40" cy="50" rx="28" ry="24" fill={edge} />
      <ellipse cx="40" cy="48" rx="24" ry="21" fill={body} />
      <ellipse cx="40" cy="56" rx="13" ry="10" fill="#f6efe2" />
      <circle cx="31" cy="40" r="5" fill="#fff" />
      <circle cx="49" cy="40" r="5" fill="#fff" />
      <circle cx="31.5" cy="40.5" r="2.4" fill="#2b2233" />
      <circle cx="49.5" cy="40.5" r="2.4" fill="#2b2233" />
      <path d="M36 48 L44 48 L40 53 Z" fill="#e0a43a" />
      {pose !== 'wait' && <path d="M66 46 Q78 34 72 22" stroke={edge} strokeWidth="7" fill="none" strokeLinecap="round" />}
    </svg>
  );
}
