/**
 * Our own playing cards: big rank, big suit, nothing fussy, so a Year 4 can read them at
 * a glance on a Chromebook. (The plan's CC0 card set was checked first: its corner
 * numbers came out 6–10 pixels tall at table size, too small to read. See 101-PLAN.md.)
 *
 * Suits are drawn as shapes, not text, so they look the same on every computer, and
 * hearts and diamonds are red as usual: the shape tells them apart, not the colour.
 * Cards are pictures only (aria-hidden): the button around a card says what it is.
 */
import { rankOf, suitOf, type Card, type Suit } from '../../../shared/card101/cards';

const RED = '#c62828';
const BLACK = '#1d1b3a';

/** Each suit drawn in a 100 × 100 box. */
export function SuitShape({ suit, x, y, size, fill }: { suit: Suit; x: number; y: number; size: number; fill: string }) {
  const s = size / 100;
  const t = `translate(${x} ${y}) scale(${s})`;
  switch (suit) {
    case 'H':
      return (
        <path
          transform={t}
          fill={fill}
          d="M50 92 C22 70 4 54 4 33 C4 16 16 6 30 6 C40 6 46 12 50 21 C54 12 60 6 70 6 C84 6 96 16 96 33 C96 54 78 70 50 92 Z"
        />
      );
    case 'D':
      return <path transform={t} fill={fill} d="M50 2 L90 50 L50 98 L10 50 Z" />;
    case 'S':
      return (
        <path
          transform={t}
          fill={fill}
          d="M50 3 C32 28 6 42 6 62 C6 76 17 84 29 84 C37 84 43 80 46 74 C45 84 41 92 33 97 L67 97 C59 92 55 84 54 74 C57 80 63 84 71 84 C83 84 94 76 94 62 C94 42 68 28 50 3 Z"
        />
      );
    case 'C':
      return (
        <g transform={t} fill={fill}>
          <circle cx="50" cy="27" r="21" />
          <circle cx="25" cy="59" r="21" />
          <circle cx="75" cy="59" r="21" />
          <circle cx="50" cy="52" r="12" />
          <path d="M46 56 C45 76 41 88 33 97 L67 97 C59 88 55 76 54 56 Z" />
        </g>
      );
  }
}

const RANK_TEXT: Record<string, string> = { T: '10' };

/** A crown for the King and Queen: K gets five points, Q three. */
function Crown({ points, fill }: { points: 3 | 5; fill: string }) {
  const d =
    points === 5
      ? 'M28 62 L24 36 L36 48 L43 30 L50 46 L57 30 L64 48 L76 36 L72 62 Z'
      : 'M30 62 L26 38 L40 50 L50 30 L60 50 L74 38 L70 62 Z';
  return <path d={d} fill={fill} stroke={BLACK} strokeWidth="1.5" strokeLinejoin="round" />;
}

function Face({ card }: { card: Card }) {
  const rank = rankOf(card);
  const suit = suitOf(card);
  const ink = suit === 'H' || suit === 'D' ? RED : BLACK;
  const text = RANK_TEXT[rank] ?? rank;
  const court = rank === 'J' || rank === 'Q' || rank === 'K';
  return (
    <>
      <rect x="1.5" y="1.5" width="97" height="137" rx="9" fill="#fff" stroke="#b9b4d6" strokeWidth="3" />
      <text
        x="9"
        y="35"
        fill={ink}
        fontSize={text.length > 1 ? 30 : 34}
        fontWeight="900"
        letterSpacing={text.length > 1 ? -2 : 0}
        fontFamily="inherit"
      >
        {text}
      </text>
      <SuitShape suit={suit} x={10} y={41} size={22} fill={ink} />
      {court ? (
        <g>
          <rect x="34" y="50" width="56" height="78" rx="8" fill={ink === RED ? '#fde7e7' : '#e8e6f7'} />
          {rank !== 'J' && (
            <g transform="translate(37 32) scale(0.5)">
              <Crown points={rank === 'K' ? 5 : 3} fill="#ffd23f" />
            </g>
          )}
          <text x="62" y="102" textAnchor="middle" fill={ink} fontSize="40" fontWeight="900" fontFamily="inherit">
            {rank}
          </text>
          <SuitShape suit={suit} x={52} y={106} size={20} fill={ink} />
        </g>
      ) : (
        <SuitShape suit={suit} x={36} y={58} size={56} fill={ink} />
      )}
    </>
  );
}

function Back() {
  return (
    <>
      <defs>
        <linearGradient id="card101-back" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b3cc4" />
          <stop offset="1" stopColor="#2b1d7a" />
        </linearGradient>
        <pattern id="card101-dots" width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="5" cy="5" r="1.6" fill="rgba(255,255,255,0.18)" />
        </pattern>
      </defs>
      <rect x="1.5" y="1.5" width="97" height="137" rx="9" fill="url(#card101-back)" stroke="#fff" strokeWidth="3" />
      <rect x="9" y="9" width="82" height="122" rx="6" fill="url(#card101-dots)" stroke="rgba(255,255,255,0.45)" strokeWidth="2" />
      <text x="50" y="80" textAnchor="middle" fill="#ffd23f" fontSize="30" fontWeight="900" fontFamily="inherit">
        101
      </text>
    </>
  );
}

/** One card, face up (`card`) or face down (`card` null). Sized by its container's width. */
export function PlayingCard({ card, className = '' }: { card: Card | null; className?: string }) {
  return (
    <svg
      className={`playing-card ${card ? 'is-up' : 'is-down'} ${className}`}
      viewBox="0 0 100 140"
      aria-hidden="true"
      focusable="false"
    >
      {card ? <Face card={card} /> : <Back />}
    </svg>
  );
}
