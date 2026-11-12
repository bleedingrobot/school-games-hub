import { useId } from 'react';
import { AvatarImage } from '../avatar/AvatarImage';
import { TIER_COLOURS, type Tier } from '../avatar/earnedPictures';
import { trophyGame } from './cabinet';

/**
 * A trophy drawn in its metal: a cup with the game's own icon on the front, or (for a picture trophy) the picture in its
 * ring on a little stand. `tier: null` is a grey "not won yet" shape with a question mark. Stand-in art until card P2's
 * paintings land; the size is the drawing's width.
 */
export function TrophyArt({
  id: trophyId,
  game,
  kind,
  tier,
  size = 88,
}: {
  id: string;
  game: string;
  kind: 'trophy' | 'picture';
  tier: Tier | null;
  size?: number;
}) {
  const id = useId();
  const [light, main, dark] = tier ? TIER_COLOURS[tier] : (['#d7dce4', '#a9b1bf', '#7c8595'] as const);
  const Icon = trophyGame(game)?.Icon;
  const height = Math.round(size * 1.2);

  if (kind === 'picture' && tier) {
    return (
      <span className="trophy-art trophy-art--picture" data-tier={tier} style={{ width: size, height }} aria-hidden="true">
        <PictureOnStand id={trophyId} tier={tier} size={size} />
      </span>
    );
  }

  return (
    <span className={`trophy-art${tier ? '' : ' trophy-art--locked'}`} data-tier={tier ?? 'none'} style={{ width: size, height }} aria-hidden="true">
      <svg width={size} height={height} viewBox="0 0 100 120">
        <defs>
          <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={dark} />
            <stop offset="0.3" stopColor={light} />
            <stop offset="0.55" stopColor={main} />
            <stop offset="1" stopColor={dark} />
          </linearGradient>
          <linearGradient id={`${id}-base`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5b3a1e" />
            <stop offset="1" stopColor="#2e1c0c" />
          </linearGradient>
        </defs>
        {/* Handles */}
        <path d="M24 22 C6 22 6 52 30 56" fill="none" stroke={`url(#${id}-metal)`} strokeWidth="7" strokeLinecap="round" />
        <path d="M76 22 C94 22 94 52 70 56" fill="none" stroke={`url(#${id}-metal)`} strokeWidth="7" strokeLinecap="round" />
        {/* Bowl */}
        <path d="M20 12 H80 V30 C80 54 66 68 50 68 C34 68 20 54 20 30 Z" fill={`url(#${id}-metal)`} stroke={dark} strokeWidth="1.5" />
        <ellipse cx="50" cy="12" rx="30" ry="4.5" fill={light} stroke={dark} strokeWidth="1.2" />
        {/* Stem and foot */}
        <path d="M44 68 H56 L58 84 H42 Z" fill={`url(#${id}-metal)`} />
        <rect x="32" y="84" width="36" height="7" rx="3" fill={`url(#${id}-metal)`} />
        {/* Wooden plinth */}
        <rect x="24" y="91" width="52" height="22" rx="4" fill={tier ? `url(#${id}-base)` : '#8a919c'} />
        <rect x="34" y="96" width="32" height="11" rx="2" fill={tier ? main : '#b6bcc6'} opacity="0.9" />
        {/* Shine */}
        {tier && <path d="M31 17 C29 34 33 48 41 58" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round" />}
        {!tier && (
          <text x="50" y="44" textAnchor="middle" dominantBaseline="central" fontSize="30" fontWeight="900" fill="#eef1f5">
            ?
          </text>
        )}
      </svg>
      {tier && (
        <span className="trophy-art__emblem" style={{ color: dark, width: size * 0.3, height: size * 0.3, top: size * 0.24 }}>
          {Icon ? <Icon size={Math.round(size * 0.3)} /> : <span style={{ fontSize: size * 0.22 }}>★</span>}
        </span>
      )}
    </span>
  );
}

/** A picture trophy: the picture in its metal ring, standing on a little wooden stand. */
function PictureOnStand({ id, tier, size }: { id: string; tier: Tier; size: number }) {
  const [, main] = TIER_COLOURS[tier];
  return (
    <>
      <span className="trophy-art__pic" style={{ width: size * 0.86, height: size * 0.86 }}>
        <AvatarImage avatar={{ pic: id, picTier: tier }} size={Math.round(size * 0.86)} />
      </span>
      <svg className="trophy-art__stand" width={size} height={size * 0.34} viewBox="0 0 100 34">
        <path d="M44 0 H56 L58 12 H42 Z" fill={main} />
        <rect x="24" y="12" width="52" height="20" rx="4" fill="#4a2f17" />
        <rect x="34" y="17" width="32" height="10" rx="2" fill={main} opacity="0.9" />
      </svg>
    </>
  );
}
