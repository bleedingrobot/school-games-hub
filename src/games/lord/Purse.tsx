import { createContext, useContext } from 'react';
import { expNeeded } from '../../../shared/lord/data';
import type { Hero } from '../../../shared/lord/types';
import { UNLIMITED_LABEL } from '../../../shared/unlimited';

/** The hero the screens are showing, so any painting can carry the purse without passing it down every screen. */
export const HudContext = createContext<{ hero: Hero; unlimited: boolean } | null>(null);

/**
 * The hero at a glance, as small chips on a painting (James, 17 Nov 2026: no stats rows above the art). Level,
 * health, gold carried, experience and forest fights left: what a pupil checks before deciding where to go.
 */
export function Purse() {
  const hud = useContext(HudContext);
  if (!hud) return null;
  const { hero, unlimited } = hud;
  const need = expNeeded(hero.level);
  return (
    <ul className="lord-purse" aria-label="Your hero at a glance">
      <li title="Level">Lv <strong>{hero.level}</strong>{hero.dragonKills > 0 && <span className="lord-purse__stars"> {'★'.repeat(Math.min(hero.dragonKills, 5))}</span>}</li>
      <li title="Health"><span aria-hidden="true">❤</span> <strong>{hero.hp}</strong>/{hero.maxHp}<span className="lord-sr"> health</span></li>
      <li title="Gold you are carrying"><span aria-hidden="true">🪙</span> <strong>{hero.gold}</strong><span className="lord-sr"> gold</span></li>
      <li title="Experience">XP <strong>{hero.exp}</strong>{Number.isFinite(need) ? `/${need}` : ''}</li>
      <li title="Forest fights left today"><span aria-hidden="true">🌲</span> <strong>{unlimited && hero.forestLeft <= 0 ? UNLIMITED_LABEL : hero.forestLeft}</strong><span className="lord-sr"> forest fights left</span></li>
    </ul>
  );
}
