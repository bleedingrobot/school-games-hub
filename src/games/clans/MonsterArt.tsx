import { MONSTER_LOOKS } from '../../../shared/clans/monster';
import type { MonsterKind } from '../../../shared/clans/types';
import { seasonMonsterArt } from './art';

/**
 * The season monster's picture: the painted portrait (art/season-monsters/<kind>.webp) when there is one, otherwise a framed
 * emoji. Monsters not painted yet keep the emoji; nothing else on the screens changes when a painting is added.
 */
export function MonsterArt({ kind, size = 'big' }: { kind: MonsterKind; size?: 'big' | 'small' }) {
  const look = MONSTER_LOOKS[kind];
  const painted = seasonMonsterArt(kind);
  if (painted) return <img className={`cq-monster-art cq-monster-art--painted cq-monster-art--${size}`} src={painted} alt={look.name} data-monster={kind} />;
  return (
    <div className={`cq-monster-art cq-monster-art--${size}`} role="img" aria-label={look.name} data-monster={kind}>
      <span aria-hidden="true">{look.emoji}</span>
      {size === 'big' && <strong aria-hidden="true">{look.name}</strong>}
    </div>
  );
}
