import { MONSTER_LOOKS } from '../../../shared/clans/monster';
import type { MonsterKind } from '../../../shared/clans/types';

/**
 * The season monster's picture. The painted portrait (made on James's PC, see docs/CLANS-ART-PLAN.md) replaces this framed emoji
 * later; nothing else on the screens needs to change when it does.
 */
export function MonsterArt({ kind, size = 'big' }: { kind: MonsterKind; size?: 'big' | 'small' }) {
  const look = MONSTER_LOOKS[kind];
  return (
    <div className={`cq-monster-art cq-monster-art--${size}`} role="img" aria-label={look.name} data-monster={kind}>
      <span aria-hidden="true">{look.emoji}</span>
      {size === 'big' && <strong aria-hidden="true">{look.name}</strong>}
    </div>
  );
}
