/**
 * Attack effects, drawn over the monster that is hit. One for each animation id in the monster
 * book ("leaf-1" to "stone-3"): a swirl of leaves, a splash, flames, snowflakes, sparks and
 * falling rocks, each in three sizes. Plus the "critical!" pop and floating damage numbers.
 * Effects are decoration only (hidden from screen readers; the message box says what happened)
 * and are switched off for reduced motion.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { Effect } from '../../../../shared/monsters/rules';
import type { TypeId } from '../../../../shared/monsters/types';
import { Bolt, Flame, Leaf, PALETTES, OUTLINE, type Palette } from './parts';

/** How many pieces each size has. */
const COUNT = [5, 9, 14] as const;
/** How long each size plays, in milliseconds. */
export const EFFECT_MS = [650, 850, 1100] as const;

const rand = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const vars = (v: Record<string, string | number>) => v as CSSProperties;

export function parseAnim(anim: string): { type: TypeId; size: 1 | 2 | 3 } {
  const [type, size] = anim.split('-');
  return { type: type as TypeId, size: Number(size) as 1 | 2 | 3 };
}

function Snowflake({ c }: { c: Palette }) {
  return (
    <g stroke={c.dark} strokeWidth="2" strokeLinecap="round" fill="none">
      <path d="M0 -7 V7 M-6 -3.5 L6 3.5 M-6 3.5 L6 -3.5" stroke="#fff" strokeWidth="3.2" />
      <path d="M0 -7 V7 M-6 -3.5 L6 3.5 M-6 3.5 L6 -3.5" />
    </g>
  );
}

function pieces(type: TypeId, size: 1 | 2 | 3, c: Palette): ReactNode {
  const n = COUNT[size - 1];
  const items = Array.from({ length: n }, (_, i) => i);
  switch (type) {
    case 'leaf':
      return items.map((i) => (
        <g key={i} className="fx-swirl" style={vars({ '--a': `${(i / n) * 360}deg`, '--r': `${34 + rand(i, 1) * 18}px`, '--t': `${rand(i, 2) * 0.25}s` })}>
          <Leaf x={0} y={0} len={12 + size * 3} rot={rand(i, 3) * 360} c={c} />
        </g>
      ));
    case 'water':
      return (
        <>
          {size >= 2 && <circle className="fx-ring" cx="60" cy="64" r="24" fill="none" stroke={c.main} strokeWidth="5" />}
          {size === 3 && <circle className="fx-ring fx-ring--late" cx="60" cy="64" r="24" fill="none" stroke={c.light} strokeWidth="4" />}
          {items.map((i) => (
            <path
              key={i}
              className="fx-drop"
              d="M0 -7 C5 -1 6 2 6 4 A6 6 0 0 1 -6 4 C-6 2 -5 -1 0 -7Z"
              fill={c.main}
              stroke={c.dark}
              strokeWidth="1.5"
              style={vars({ '--dx': `${(rand(i, 4) - 0.5) * 80}px`, '--dy': `${-10 - rand(i, 5) * 35}px`, '--t': `${rand(i, 6) * 0.2}s`, transformOrigin: '60px 64px' })}
              transform="translate(60 64)"
            />
          ))}
        </>
      );
    case 'fire':
      return items.map((i) => (
        <g key={i} className="fx-flame" style={vars({ '--x': `${(rand(i, 7) - 0.5) * 70}px`, '--t': `${rand(i, 8) * 0.35}s` })}>
          <Flame x={60} y={96 - rand(i, 9) * 26} h={18 + size * 6 + rand(i, 10) * 10} c={c} />
        </g>
      ));
    case 'ice':
      return items.map((i) => (
        <g key={i} className="fx-snow" style={vars({ '--x': `${(rand(i, 11) - 0.5) * 80}px`, '--t': `${rand(i, 12) * 0.4}s`, '--s': 0.8 + rand(i, 13) * 0.8 })}>
          <g transform={`translate(${60 + (rand(i, 14) - 0.5) * 30} 24)`}>
            <Snowflake c={c} />
          </g>
        </g>
      ));
    case 'spark':
      return (
        <>
          <circle className="fx-glow" cx="60" cy="64" r={24 + size * 8} fill={c.main} opacity="0.55" />
          {items.slice(0, size * 2 + 1).map((i) => (
            <g key={i} className="fx-bolt" style={vars({ '--t': `${rand(i, 15) * 0.4}s` })}>
              <Bolt x={30 + rand(i, 16) * 60} y={20 + rand(i, 17) * 44} s={0.8 + size * 0.25} rot={(rand(i, 18) - 0.5) * 50} fill={c.accent} stroke={OUTLINE} />
            </g>
          ))}
        </>
      );
    case 'stone':
      return items.map((i) => (
        <g key={i} className="fx-rock" style={vars({ '--t': `${rand(i, 19) * 0.45}s`, '--spin': `${(rand(i, 20) - 0.5) * 240}deg` })}>
          <polygon
            transform={`translate(${28 + rand(i, 21) * 64} ${40 + rand(i, 22) * 40}) scale(${0.8 + size * 0.3})`}
            points="-6,-3 -2,-7 5,-5 7,1 3,6 -4,5"
            fill={i % 3 === 0 ? c.light : c.main}
            stroke={c.dark}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </g>
      ));
  }
}

/** The effect for one animation id, covering the box it is placed in. Re-key it to replay it. */
export function AttackEffect({ anim }: { anim: string }) {
  const { type, size } = parseAnim(anim);
  const c = PALETTES[type];
  if (!c || !size) return null;
  return (
    <svg className={`fx fx--${type} fx--${size}`} viewBox="0 0 120 120" aria-hidden="true" focusable="false" data-anim={anim}>
      {pieces(type, size, c)}
    </svg>
  );
}

/** A quick white flash over a monster that was hit. */
export function HitFlash() {
  return <span className="fx-hit" aria-hidden="true" />;
}

/** "Critical!" pop for a quick right answer. */
export function CriticalPop() {
  return (
    <span className="fx-crit" aria-hidden="true">
      Critical!
    </span>
  );
}

/** A number that floats up from the monster that was hurt (or healed, with `heal`). */
export function DamageNumber({ amount, effect, heal }: { amount: number; effect?: Effect; heal?: boolean }) {
  return (
    <span className={`fx-num${heal ? ' fx-num--heal' : ''}${effect === 'strong' ? ' fx-num--strong' : effect === 'weak' ? ' fx-num--weak' : ''}`} aria-hidden="true">
      {heal ? '+' : '-'}
      {amount}
    </span>
  );
}
