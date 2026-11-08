/**
 * "Show me first" (maths review 2, S12): the first time a zoom go comes up, the pointing hand does one made-up go with Bella's
 * voice before the real one. The example is a lens no zoom key uses (DEMO_KEYS), so it never gives a real answer away.
 * A demo is not an answer: nothing here adds a tap to the round. The timing, Skip and "seen" are the kit's (useKindDemo, DemoBar).
 */
import type { DemoStep } from '../../kit/useKindDemo';
import { PointingHand } from '../../kit/PointingHand';
import { NumberLine } from '../../kit';
import { kindOfKey, type Go } from '../../../shared/pigeon/round';
import { lineFor } from './Goes';
import { WORDS } from './words';

/** The kind of go that has a demo. Every other kind is just marked seen when a go of it is finished. */
export const DEMO_KIND = 'zoom';
export const hasDemo = (go: Pick<Go, 'key'>) => kindOfKey(go.key) === DEMO_KIND;

/** The hand's target on each step: `line` (the whole branch), `lens` (the zoom lens) or `spot` (where 27 is on the lens). */
export const DEMO_STEPS: DemoStep[] = [
  { line: WORDS.demoTiny, target: 'line' },
  { line: WORDS.demoLens, target: 'lens' },
  { line: WORDS.demoFind, target: 'spot' },
  { line: WORDS.nowYouTry },
];

const GO = { n: 27, answer: 27, lo: 20, hi: 30, max: 100, lens: { lo: 20, hi: 30 }, kind: 'place' } as Go;
const WHOLE = { ...GO, lo: 0, hi: 100, lens: null } as Go;

/** The demo's picture: the made-up branch, then its lens, then the spot, with the hand. */
export function DemoScene({ step }: { step: number }) {
  const target = DEMO_STEPS[step]?.target;
  const go = step === 0 ? WHOLE : GO;
  const spot = step >= 2 ? [{ value: 27, label: '27', tone: 'landmark' as const }] : [];
  return (
    <div className="pg-branch">
      <NumberLine {...lineFor(go, 5, spot)} label="A branch from 0 to 100 with a zoom lens." className="pg-line" />
      {target && <PointingHand prefix="pg" className={`pg-hand--${target}`} />}
    </div>
  );
}
