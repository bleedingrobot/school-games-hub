/**
 * Pictures for the maths over a fight (docs/ARCHERY-QUESTIONS-PLAN.md), in the game's own style (thick dark outlines,
 * warm wood): a loot chest whose lid opens wider and fills with more coins for each right answer, and a quiver that
 * fills with arrows for a restock. Decorative: the words beside them say the same thing.
 */
const OL = '#2a1c14';

/** A loot chest. `filled` right answers so far (0 = shut), out of `of`. */
export function LootChest({ filled, of }: { filled: number; of: number }) {
  const open = Math.min(1, filled / Math.max(1, of));
  const lid = -55 * open; // degrees: the lid swings back as answers come in
  const coins = Array.from({ length: Math.min(filled * 3, 9) }, (_, i) => i);
  return (
    <svg className="ar-loot" viewBox="0 0 120 100" width="120" height="100" aria-hidden="true">
      {/* glow when it's open */}
      {filled > 0 && <ellipse cx="60" cy="52" rx={30 + 14 * open} ry={14 + 8 * open} fill="#fff3a6" opacity={0.35 + 0.4 * open} />}
      {/* coins spilling over the top */}
      {coins.map((i) => {
        const x = 34 + (i % 5) * 13 + (i >= 5 ? 6 : 0);
        const y = 56 - Math.floor(i / 5) * 8 - (i % 2) * 3;
        return (
          <g key={i}>
            <ellipse cx={x} cy={y} rx="7" ry="5" fill="#ffd23f" stroke={OL} strokeWidth="2" />
            <ellipse cx={x} cy={y - 1} rx="3" ry="2" fill="#fff4b0" />
          </g>
        );
      })}
      {/* the box */}
      <rect x="22" y="56" width="76" height="36" rx="5" fill="#a8612a" stroke={OL} strokeWidth="3.5" />
      <rect x="22" y="66" width="76" height="6" fill="#7a3f17" />
      <rect x="34" y="56" width="8" height="36" fill="#d9a520" stroke={OL} strokeWidth="2.5" />
      <rect x="78" y="56" width="8" height="36" fill="#d9a520" stroke={OL} strokeWidth="2.5" />
      <rect x="53" y="62" width="14" height="14" rx="3" fill="#ffd23f" stroke={OL} strokeWidth="2.5" />
      <circle cx="60" cy="69" r="2.3" fill={OL} />
      {/* the lid, hinged at the back */}
      <g transform={`rotate(${lid} 98 56)`}>
        <path d="M22 56 V44 Q60 26 98 44 V56 Z" fill="#c07a3a" stroke={OL} strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M34 54 V38.5 M86 54 V38.5" stroke="#d9a520" strokeWidth="8" />
        <path d="M34 54 V38.5 M86 54 V38.5" stroke={OL} strokeWidth="1.5" strokeDasharray="0" opacity="0.4" />
      </g>
    </svg>
  );
}

/** A quiver for a restock, with one more arrow for each right answer (`filled` of `of`). */
export function RestockQuiver({ filled, of }: { filled: number; of: number }) {
  const arrows = Array.from({ length: Math.max(0, Math.min(filled, of)) }, (_, i) => i);
  return (
    <svg className="ar-loot" viewBox="0 0 120 100" width="120" height="100" aria-hidden="true">
      {arrows.map((i) => {
        const x = 50 + i * 10;
        return (
          <g key={i} transform={`rotate(${(i - (of - 1) / 2) * 8} ${x} 70)`}>
            <line x1={x} y1="70" x2={x} y2="16" stroke={OL} strokeWidth="4" strokeLinecap="round" />
            <line x1={x} y1="70" x2={x} y2="16" stroke="#e9a866" strokeWidth="2" strokeLinecap="round" />
            <path d={`M${x - 5} 20 L${x} 8 L${x + 5} 20 Z`} fill="#c8d0d8" stroke={OL} strokeWidth="2" strokeLinejoin="round" />
          </g>
        );
      })}
      <path d="M40 40 L80 40 L74 94 L46 94 Z" fill="#3d6b2f" stroke={OL} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M42 50 L78 50" stroke="#a8d860" strokeWidth="4" />
      <path d="M44 82 L76 82" stroke="#a8d860" strokeWidth="4" />
      <rect x="38" y="36" width="44" height="8" rx="3" fill="#a8612a" stroke={OL} strokeWidth="3" />
    </svg>
  );
}
