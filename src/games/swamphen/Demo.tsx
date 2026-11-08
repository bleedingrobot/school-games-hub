/**
 * Show me first: the picture for a demo of one kind of go, played the first time that kind comes up (src/kit/useKindDemo.ts).
 * Each example is made up and fixed, and is a size the real round cannot ask (see DEMO_KEYS), so it is never the answer to a
 * real go. The hand points; nothing here can be tapped and nothing is added to the round's taps.
 */
import { useEffect, useState } from 'react';
import { PointingHand } from '../../kit/PointingHand';
import type { DemoStep } from '../../kit/useKindDemo';
import type { Kind } from '../../../shared/swamphen/round';
import { DealLanes, Garden, Pile } from './art';
import { WORDS } from './words';

/** The kinds that have a demo. */
export type DemoKind = 'mat' | 'share' | 'cut';
export const isDemoKind = (kind: Kind): kind is DemoKind => kind === 'mat' || kind === 'share' || kind === 'cut';

/** The keys the examples stand for: none of them is in the game's own KEYS. */
export const DEMO_KEYS: Record<DemoKind, string> = { mat: 'rows:6x4', share: 'share:12/6', cut: 'cut:6x2' };

export const demoSteps = (kind: DemoKind): DemoStep[] => WORDS.demo[kind].map((line, i) => ({ line, holdMs: i === 2 ? 600 : 1200 }));

const SHARE_LANES = 6;
const SHARE_TOTAL = 12;

export function DemoPicture({ kind, step }: { kind: DemoKind; step: number }) {
  const [dealt, setDealt] = useState(0);
  useEffect(() => {
    if (kind !== 'share' || step < 1) return;
    const t = window.setInterval(() => setDealt((n) => Math.min(SHARE_TOTAL, n + 1)), 450);
    return () => window.clearInterval(t);
  }, [kind, step]);
  const hand = (where: 'a' | 'b' | 'c') => <PointingHand prefix="sh" className={`sh-hand--${where}`} />;

  if (kind === 'mat') {
    return (
      <>
        <Garden rows={6} cols={4} view="count" mat={step !== 1} label="A garden of 6 rows with 4 shoots in each row, under a mat." />
        {step === 0 && hand('a')}
        {step === 1 && hand('b')}
      </>
    );
  }
  if (kind === 'cut') {
    return (
      <>
        <Garden rows={6} cols={2} view="count" cutAt={step >= 1 ? 5 : undefined} label="A garden of 6 rows with 2 shoots in each row, cut in two." />
        {step === 1 && hand('c')}
      </>
    );
  }
  const counts = Array.from({ length: SHARE_LANES }, (_, i) => Math.floor(dealt / SHARE_LANES) + (i < dealt % SHARE_LANES ? 1 : 0));
  const left = SHARE_TOTAL - dealt;
  return (
    <div className="sh-share">
      <DealLanes counts={counts} glow={step >= 1 && left > 0 ? dealt % SHARE_LANES : null} still laneLabel={WORDS.lane} />
      {left > 0 && <Pile n={left} label={WORDS.pile(left)} />}
    </div>
  );
}
