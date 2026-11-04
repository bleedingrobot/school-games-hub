/**
 * Hop, the lily pads and the glow-worms. Each uses its painted picture once there is one (art.ts) and a simple drawn
 * stand-in until then, so the game can be tried before the art is painted. Numbers are always drawn in code, dark on light.
 */
import type { Friend, Metal } from '../../../shared/hop/progress';
import { FRIEND_NAMES, friendArt, paint, type Pose } from './art';

/** A stand-in Hop: a round green clay-ish frog with big eyes and a blue scarf. */
function DrawnFrog({ pose }: { pose: Pose }) {
  const up = pose === 'cheer' || pose === 'wave';
  const stretched = pose === 'leap';
  return (
    <svg viewBox="0 0 100 100" className="hp-drawn" aria-hidden="true">
      {/* back legs: tucked, or stretched out behind in a leap */}
      {stretched ? (
        <>
          <path d="M30 70 Q12 88 4 96" stroke="#3c9a35" strokeWidth="9" strokeLinecap="round" fill="none" />
          <path d="M70 70 Q88 88 96 96" stroke="#3c9a35" strokeWidth="9" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <ellipse cx="22" cy="80" rx="16" ry="10" fill="#3c9a35" />
          <ellipse cx="78" cy="80" rx="16" ry="10" fill="#3c9a35" />
        </>
      )}
      {/* front arms: down, or up for a cheer */}
      {up ? (
        <>
          <path d="M30 58 Q18 40 14 26" stroke="#4fb045" strokeWidth="8" strokeLinecap="round" fill="none" />
          <path d="M70 58 Q82 40 86 26" stroke="#4fb045" strokeWidth="8" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <ellipse cx="34" cy="86" rx="7" ry="5" fill="#4fb045" />
          <ellipse cx="66" cy="86" rx="7" ry="5" fill="#4fb045" />
        </>
      )}
      <ellipse cx="50" cy="64" rx="32" ry={pose === 'crouch' ? 21 : 25} fill="#5cbf4a" />
      <ellipse cx="50" cy="72" rx="20" ry="13" fill="#d9f2b4" />
      <circle cx="44" cy="62" r="1.6" fill="#8a6a3a" />
      <circle cx="60" cy="58" r="1.4" fill="#8a6a3a" />
      <path d="M26 52 Q50 62 74 52 L72 58 Q50 68 28 58 Z" fill="#3d7fd6" />
      <circle cx="35" cy="38" r="13" fill="#5cbf4a" />
      <circle cx="65" cy="38" r="13" fill="#5cbf4a" />
      <circle cx="35" cy="37" r="9" fill="#f6c73c" />
      <circle cx="65" cy="37" r="9" fill="#f6c73c" />
      <circle cx="36" cy="38" r="5" fill="#1b2340" />
      <circle cx="66" cy="38" r="5" fill="#1b2340" />
      <circle cx="38" cy="36" r="1.8" fill="#fff" />
      <circle cx="68" cy="36" r="1.8" fill="#fff" />
      <path d="M38 50 Q50 58 62 50" stroke="#1b2340" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <circle cx="30" cy="49" r="3.5" fill="#f59ab0" opacity="0.7" />
      <circle cx="70" cy="49" r="3.5" fill="#f59ab0" opacity="0.7" />
    </svg>
  );
}

const FRIEND_EMOJI: Record<Friend, string> = { hop: '🐸', gecko: '🦎', weta: '🦗', tuatara: '🦎', kiwi: '🥝', ruru: '🦉' };

/** Whoever is crossing the pond: Hop, or a later friend. */
export function Friend({ friend, pose, className = '' }: { friend: Friend; pose: Pose; className?: string }) {
  const src = friendArt(friend, pose);
  const cls = `hp-friend hp-friend--${pose} ${className}`;
  if (src) return <img className={cls} src={src} alt="" />;
  if (friend === 'hop') return <span className={cls}><DrawnFrog pose={pose} /></span>;
  return (
    <span className={`${cls} hp-friend--emoji`} aria-hidden="true" title={FRIEND_NAMES[friend]}>
      {FRIEND_EMOJI[friend]}
    </span>
  );
}

/** A lily pad: a metal (or plain green), and its number on a light disc, or a glowing empty ring for the gap. */
export function LilyPad({ metal, value, gap, glow, className = '' }: { metal: Metal; value?: number | null; gap?: boolean; glow?: boolean; className?: string }) {
  const src = paint(gap ? 'pads/gap' : `pads/${metal}`);
  return (
    <span className={`hp-pad hp-pad--${gap ? 'gap' : metal}${glow ? ' hp-pad--glow' : ''} ${className}`}>
      {src ? (
        <img className="hp-pad__art" src={src} alt="" />
      ) : (
        <svg viewBox="0 0 100 70" className="hp-pad__art" aria-hidden="true">
          {gap ? (
            <ellipse cx="50" cy="35" rx="44" ry="29" fill="rgb(160 240 255 / 0.12)" stroke="#bff3ff" strokeWidth="4" strokeDasharray="10 7" />
          ) : (
            <path d="M50 35 L58 6 A46 31 0 1 1 42 6 Z" className="hp-pad__leaf" />
          )}
        </svg>
      )}
      {value != null && <span className="hp-pad__num">{value}</span>}
      {gap && value == null && <span className="hp-pad__num hp-pad__num--gap">?</span>}
    </span>
  );
}

/** A glow-worm carrying a number on its glowing bead. */
export function GlowWorm({ value, cheer }: { value: number; cheer?: boolean }) {
  const src = paint(cheer ? 'things/glowworm-cheer' : 'things/glowworm-float');
  return (
    <>
      {src ? (
        <img className="hp-worm__art" src={src} alt="" />
      ) : (
        <svg viewBox="0 0 60 30" className="hp-worm__bug" aria-hidden="true">
          <path d="M8 24 Q16 10 30 14 Q44 18 52 8" stroke="#eafbe0" strokeWidth="9" strokeLinecap="round" fill="none" />
          <circle cx="51" cy="8" r="2" fill="#1b2340" />
          <path d="M46 12 Q49 14 52 12" stroke="#1b2340" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </svg>
      )}
      <span className="hp-worm__bead">{value}</span>
    </>
  );
}
