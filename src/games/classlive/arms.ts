/** Star Web's arms on screen: a colour and a hint for each (docs/CLASSLIVE-PLAN.md section 2). */
import { useEffect, useState } from 'react';
import type { Anchor, Arm } from '../../../shared/classlive/stars';

export const ARM_COLOURS: Record<Arm, string> = {
  turn: '#7dd3fc', divide: '#c4b5fd', double: '#fcd34d', halve: '#f9a8d4', tens: '#86efac', near: '#fdba74', wild: '#e2e8f0',
};

/** A nudge for the pupil when nobody has found this kind yet. */
export const ARM_HINTS: Record<Arm, string> = {
  turn: 'Try turning the fact around.',
  divide: 'Try a division fact that undoes it.',
  double: 'Try doubling one of the numbers.',
  halve: 'Try halving one of the numbers.',
  tens: 'Try making one number ten times bigger (or smaller).',
  near: 'Try one more group, or one less.',
  wild: 'Find a new way to make the answer.',
};

/**
 * How to find facts for an arm that is lagging behind, using the known fact's own numbers. It shows the way, never a
 * finished fact or its answer.
 */
export function lagHint(arm: Arm, { x, y, p }: Anchor): string {
  switch (arm) {
    case 'turn': return `Swap the two numbers round. Does the answer change?`;
    case 'divide': return `Division undoes times. Start from ${p} and share it into ${x} or ${y} equal groups.`;
    case 'double': return `Double one number and the answer doubles too. Try doubling the ${x} or the ${y}.`;
    case 'halve': return `Halve one number and the answer halves too.${x % 2 && y % 2 ? ' Half of an odd number ends in .5, and that is fine!' : ` Which of ${x} or ${y} splits in half?`}`;
    case 'tens': return `Make ${x} or ${y} ten times bigger (or smaller). What happens to ${p}?`;
    case 'near': return `${x} × ${y} is ${x} groups of ${y}. One more group adds ${y}; one less group takes ${y} away.`;
    case 'wild': return `Can you make ${p} another way, with + or −, or with different numbers?`;
  }
}

/** Wait this long (ms) with the same arm lagging before its hint shows, so a hint never flickers in and out. */
export const LAG_SHOW_MS = 12_000;

/** The lagging arm once it has lagged for LAG_SHOW_MS (the big screen and the pupils' screens both use it). */
export function useHeldLag(arm: Arm | null): Arm | null {
  const [shown, setShown] = useState<Arm | null>(null);
  useEffect(() => {
    if (arm === null) { setShown(null); return; }
    if (shown === arm) return;
    const id = window.setTimeout(() => setShown(arm), LAG_SHOW_MS);
    return () => window.clearTimeout(id);
  }, [arm, shown]);
  return shown !== null && shown === arm ? shown : null;
}
