/** Star Web's arms on screen: a colour and a hint for each (docs/CLASSLIVE-PLAN.md section 2). */
import type { Arm } from '../../../shared/classlive/stars';

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
