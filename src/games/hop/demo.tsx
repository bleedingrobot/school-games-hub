/**
 * "Show me first" (maths review 2, S31): the first time a hop counts back, or starts off a multiple ("from 7"), Hop does one
 * made-up hop with Bella's voice before the real one. The examples are keys no round asks (DEMO_KEYS). A demo is not an answer:
 * nothing here adds a tap. The timing, Skip and "seen" are the kit's (useKindDemo, DemoBar).
 */
import type { DemoStep } from '../../kit/useKindDemo';
import { Friend, LilyPad } from './HopArt';
import type { Friend as FriendName, Metal } from '../../../shared/hop/progress';
import type { HopKind } from '../../../shared/hop/round';
import { WORDS } from './words';

/** The kinds that have a demo (counting forward is what every child starts with). */
export type DemoKind = Extract<HopKind, 'back' | 'offset'>;
export const isDemoKind = (kind: HopKind | null): kind is DemoKind => kind === 'back' || kind === 'offset';

/** What the hop looks like: the pads (the gap is the answer), the size of the hop and which way. */
const EXAMPLES: Record<DemoKind, { pads: number[]; gap: number; size: number; back: boolean; hand: number }> = {
  back: { pads: [9, 8, 7, 6], gap: 2, size: 1, back: true, hand: 0 },
  offset: { pads: [7, 12, 17, 22], gap: 2, size: 5, back: false, hand: 0 },
};

/** The hand's target on each step: `start` (the first pad) or `gap` (the missing pad). */
export const DEMO_STEPS: Record<DemoKind, DemoStep[]> = {
  back: [{ line: WORDS.demoBack[0], target: 'start' }, { line: WORDS.demoBack[1], target: 'gap' }, { line: WORDS.nowTry }],
  offset: [{ line: WORDS.demoFrom[0], target: 'start' }, { line: WORDS.demoFrom[1], target: 'gap' }, { line: WORDS.nowTry }],
};

/** The demo's picture: a row of pads like the real one, with the hand and the missing pad filled in as Hop says it. */
export function DemoScene({ kind, step, padMetal, friend }: { kind: DemoKind; step: number; padMetal: Metal; friend: FriendName }) {
  const ex = EXAMPLES[kind];
  const target = DEMO_STEPS[kind][step]?.target;
  const filled = step >= 1;
  return (
    <div className="hp-row" aria-hidden="true" style={{ ['--hp-n' as string]: ex.pads.length }}>
      {ex.pads.slice(0, -1).map((_, i) => (
        <span key={`arc${i}`} className="hp-arc hp-arc--full" style={{ ['--hp-i' as string]: i }}>
          <span className="hp-arc__label">{ex.back ? '−' : '+'}{ex.size}</span>
        </span>
      ))}
      {ex.pads.map((n, i) => (
        <span key={i} className="hp-row__spot" style={{ ['--hp-i' as string]: i }}>
          <LilyPad metal={padMetal} value={i === ex.gap && !filled ? null : n} gap={i === ex.gap && !filled} glow={i === ex.gap && filled} />
          {((target === 'start' && i === ex.hand) || (target === 'gap' && i === ex.gap)) && <span className="hp-hand hp-hand--pad">👆</span>}
        </span>
      ))}
      <span className="hp-row__frog" style={{ ['--hp-i' as string]: filled ? ex.gap : ex.gap - 1 }}>
        <Friend friend={friend} pose={filled ? 'leap' : 'wait'} />
      </span>
    </div>
  );
}
