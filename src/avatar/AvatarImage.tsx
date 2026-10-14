import { useId, type ReactNode } from 'react';
import { normaliseAvatar, type Avatar } from './avatarParts';

const INK = '#1d1b3a';

function star(cx: number, cy: number, r: number) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.45;
    return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
  });
  return <polygon points={points.join(' ')} fill="#ffcf4a" stroke={INK} strokeWidth="1.2" />;
}

function Head({ a }: { a: Avatar }) {
  switch (a.kind) {
    case 'bear':
      return (
        <>
          <circle cx="27" cy="31" r="11" fill={a.colour} />
          <circle cx="73" cy="31" r="11" fill={a.colour} />
          <circle cx="27" cy="31" r="5" fill="rgba(0,0,0,0.18)" />
          <circle cx="73" cy="31" r="5" fill="rgba(0,0,0,0.18)" />
          <circle cx="50" cy="56" r="29" fill={a.colour} />
          <ellipse cx="50" cy="67" rx="13" ry="10" fill="rgba(255,255,255,0.45)" />
        </>
      );
    case 'cat':
      return (
        <>
          <path d="M23 42 L27 13 L45 30 Z" fill={a.colour} />
          <path d="M77 42 L73 13 L55 30 Z" fill={a.colour} />
          <circle cx="50" cy="56" r="29" fill={a.colour} />
          <g stroke={INK} strokeWidth="1.5" strokeLinecap="round" opacity="0.5">
            <path d="M22 62 L35 64 M22 69 L35 67 M78 62 L65 64 M78 69 L65 67" />
          </g>
        </>
      );
    case 'robot':
      return (
        <>
          <rect x="16" y="48" width="8" height="16" rx="3" fill={INK} opacity="0.6" />
          <rect x="76" y="48" width="8" height="16" rx="3" fill={INK} opacity="0.6" />
          <rect x="22" y="28" width="56" height="54" rx="13" fill={a.colour} />
          <rect x="29" y="44" width="42" height="20" rx="8" fill="rgba(255,255,255,0.35)" />
        </>
      );
    case 'alien':
      return <ellipse cx="50" cy="57" rx="31" ry="27" fill={a.colour} />;
    default:
      return (
        <>
          <circle cx="21" cy="57" r="7" fill={a.colour} />
          <circle cx="79" cy="57" r="7" fill={a.colour} />
          <circle cx="50" cy="56" r="29" fill={a.colour} />
        </>
      );
  }
}

function Eye({ type, x }: { type: Avatar['eyes'] | 'arc'; x: number }) {
  const y = 54;
  switch (type) {
    case 'happy':
    case 'arc':
      return <path d={`M${x - 5} ${y + 1} Q${x} ${y - 6} ${x + 5} ${y + 1}`} stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />;
    case 'sleepy':
      return <path d={`M${x - 5} ${y} Q${x} ${y + 4} ${x + 5} ${y}`} stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />;
    case 'star':
      return star(x, y, 6);
    default:
      return (
        <>
          <circle cx={x} cy={y} r="4.5" fill={INK} />
          <circle cx={x + 1.5} cy={y - 1.5} r="1.5" fill="#fff" />
        </>
      );
  }
}

function Mouth({ type }: { type: Avatar['mouth'] }) {
  switch (type) {
    case 'grin':
      return (
        <>
          <path d="M38 64 Q50 80 62 64 Z" fill={INK} />
          <path d="M40.5 65 L59.5 65 L58 68 L42 68 Z" fill="#fff" />
        </>
      );
    case 'open':
      return <ellipse cx="50" cy="68" rx="5" ry="6" fill={INK} />;
    case 'tongue':
      return (
        <>
          <ellipse cx="53" cy="71" rx="4.5" ry="4" fill="#ff6f8a" />
          <path d="M40 66 Q50 75 60 66" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        </>
      );
    default:
      return <path d="M40 66 Q50 75 60 66" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />;
  }
}

function Top({ a }: { a: Avatar }) {
  const c = a.topColour;
  switch (a.top) {
    case 'short':
    case 'long':
      return <path d="M21 50 C21 28 35 20 50 20 C65 20 79 28 79 50 C72 40 62 35 50 35 C38 35 28 40 21 50 Z" fill={c} />;
    case 'curly':
      return (
        <g fill={c}>
          <circle cx="27" cy="40" r="9" />
          <circle cx="37" cy="29" r="10" />
          <circle cx="50" cy="25" r="11" />
          <circle cx="63" cy="29" r="10" />
          <circle cx="73" cy="40" r="9" />
        </g>
      );
    case 'cap':
      return (
        <>
          <path d="M22 44 C22 24 36 17 50 17 C64 17 78 24 78 44 Z" fill={c} />
          <path d="M50 40 L90 42 Q92 47 86 48 L50 46 Z" fill={c} />
          <path d="M50 40 L90 42 Q92 47 86 48 L50 46 Z" fill="rgba(0,0,0,0.2)" />
          <circle cx="50" cy="18" r="3" fill="rgba(0,0,0,0.25)" />
        </>
      );
    case 'beanie':
      return (
        <>
          <path d="M22 42 C22 22 36 15 50 15 C64 15 78 22 78 42 Z" fill={c} />
          <rect x="20" y="35" width="60" height="11" rx="5" fill={c} />
          <rect x="20" y="35" width="60" height="11" rx="5" fill="rgba(0,0,0,0.18)" />
          <circle cx="50" cy="13" r="6.5" fill="#fff" />
        </>
      );
    case 'crown':
      return (
        <>
          <path d="M29 33 L29 15 L39.5 25 L50 11 L60.5 25 L71 15 L71 33 Z" fill="#ffcf4a" stroke="#c99400" strokeWidth="1.5" />
          <circle cx="50" cy="27" r="3.5" fill={c} />
          <circle cx="37" cy="29" r="2.5" fill={c} />
          <circle cx="63" cy="29" r="2.5" fill={c} />
        </>
      );
    case 'bow':
      return (
        <>
          <path d="M70 27 L57 18 L58 36 Z" fill={c} />
          <path d="M70 27 L83 18 L82 36 Z" fill={c} />
          <circle cx="70" cy="27" r="4.5" fill={c} />
          <circle cx="70" cy="27" r="4.5" fill="rgba(0,0,0,0.2)" />
        </>
      );
    case 'antenna':
      return (
        <>
          <path d="M50 30 L50 11" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <circle cx="50" cy="10" r="5.5" fill={c} />
        </>
      );
    default:
      return null;
  }
}

function Extras({ a, layer }: { a: Avatar; layer: 'face' | 'over' }) {
  if (layer === 'face') {
    if (a.extra === 'blush')
      return (
        <g fill="#ff6f8a" opacity="0.45">
          <ellipse cx="31" cy="64" rx="5" ry="3.5" />
          <ellipse cx="69" cy="64" rx="5" ry="3.5" />
        </g>
      );
    if (a.extra === 'freckles')
      return (
        <g fill="#7a4a26" opacity="0.55">
          {[[30, 62], [34, 65], [28, 66], [70, 62], [66, 65], [72, 66]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" />
          ))}
        </g>
      );
    return null;
  }
  if (a.extra === 'glasses')
    return (
      <g stroke={INK} strokeWidth="2.5" fill="rgba(255,255,255,0.15)">
        <circle cx="39" cy="54" r="8" />
        <circle cx="61" cy="54" r="8" />
        <path d="M47 54 L53 54" />
      </g>
    );
  if (a.extra === 'headphones')
    return (
      <>
        <path d="M19 56 C19 20 81 20 81 56" stroke={INK} strokeWidth="5" fill="none" />
        <rect x="12" y="47" width="11" height="19" rx="4" fill={a.topColour} stroke={INK} strokeWidth="2" />
        <rect x="77" y="47" width="11" height="19" rx="4" fill={a.topColour} stroke={INK} strokeWidth="2" />
      </>
    );
  return null;
}

/** Draws an avatar from its saved codes. */
export function AvatarImage({ avatar, size = 96, label }: { avatar: unknown; size?: number; label?: string }) {
  const a = normaliseAvatar(avatar);
  const clipId = useId();
  const layers: ReactNode = (
    <>
      {a.top === 'long' && (
        <path d="M19 50 C19 26 33 18 50 18 C67 18 81 26 81 50 L83 88 L17 88 Z" fill={a.topColour} />
      )}
      <Head a={a} />
      <Extras a={a} layer="face" />
      <Eye type={a.eyes === 'wink' ? 'round' : a.eyes} x={39} />
      <Eye type={a.eyes === 'wink' ? 'arc' : a.eyes} x={61} />
      <Mouth type={a.mouth} />
      <Top a={a} />
      <Extras a={a} layer="over" />
    </>
  );
  return (
    <svg
      className="avatar"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="100" height="100" fill={a.bg} />
        {layers}
      </g>
    </svg>
  );
}
