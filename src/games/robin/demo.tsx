/**
 * "Show me first" (maths review 2, S12): the first time How many? or One more comes up, the pointing hand does one made-up go
 * with Bella's voice before the real one. The examples are keys no step asks (DEMO_KEYS), so they never give a real answer away.
 * A demo is not an answer: nothing here adds a tap to the round. The timing, Skip and "seen" are the kit's (useKindDemo, DemoBar).
 */
import type { DemoStep } from '../../kit/useKindDemo';
import { PointingHand } from '../../kit/PointingHand';
import { layoutPoints, type GoKind } from '../../../shared/robin/round';
import { Berry, Plate } from './art';
import { countLine } from './voiceLines';
import { WORDS } from './words';

/** The kinds that have a demo. Any other kind (give) just gets marked seen when a go of it is finished. */
export type DemoKind = Extract<GoKind, 'howmany' | 'counton'>;
export const isDemoKind = (kind: GoKind): kind is DemoKind => kind === 'howmany' || kind === 'counton';

/** The hand's target on each step: `b0`, `b1`, `b2` (a berry), `plate`, `more` (the plate with one more) or `card`. */
export const DEMO_STEPS: Record<DemoKind, DemoStep[]> = {
  howmany: [
    { line: WORDS.demoHowMany, target: 'b0' },
    { line: countLine(1), target: 'b0', holdMs: 500 },
    { line: countLine(2), target: 'b1', holdMs: 500 },
    { line: countLine(3), target: 'b2', holdMs: 500 },
    { line: WORDS.demoPickCard, target: 'card' },
    { line: WORDS.nowTry },
  ],
  counton: [
    { line: WORDS.demoCountOn, target: 'plate' },
    { line: WORDS.oneMore, target: 'more' },
    { line: WORDS.demoCountOnAnswer, target: 'card' },
    { line: WORDS.nowTry },
  ],
};

const RING = layoutPoints('ring', 3, () => 0);

/** The demo's picture: the made-up go, with the hand and what has happened so far. */
export function DemoScene({ kind, step }: { kind: DemoKind; step: number }) {
  const target = DEMO_STEPS[kind][step]?.target;
  const card = (n: number) => (
    <div className="rb-cards">
      <span className={`rb-choice${target === 'card' ? ' rb-choice--hint' : ''}`} aria-hidden="true">
        <span className="rb-choice__value">{n}</span>
        {target === 'card' && <PointingHand prefix="rb" />}
      </span>
    </div>
  );
  if (kind === 'counton') {
    return (
      <>
        <div className="rb-demo__plate">
          <Plate n={3} more={step >= 1} />
          {(target === 'plate' || target === 'more') && <PointingHand prefix="rb" />}
        </div>
        {step >= 2 && card(4)}
      </>
    );
  }
  const counted = Math.min(step, 3);
  return (
    <>
      <div className="rb-group" aria-hidden="true">
        {RING.map((p, i) => (
          <span key={i} className="rb-berrybtn" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
            <Berry dim={i < counted} mark={i < counted ? i + 1 : null} />
            {target === `b${i}` && <PointingHand prefix="rb" />}
          </span>
        ))}
      </div>
      {step >= 4 && card(3)}
    </>
  );
}
