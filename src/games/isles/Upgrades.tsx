/**
 * The upgrades: what each does, the ideas it needs, and how close the island is (docs/ISLES-PLAN.md, section 3). In a
 * turn each one can be unlocked; between turns the list just shows where things stand.
 */
import { UPGRADES } from '../../../shared/isles/config';
import { has, type Action, type Island, type Prices } from '../../../shared/isles/engine';
import { Choice } from './Choice';
import { n, plural } from './words';

export function Upgrades({ island, prices, onChoose, lit }: { island: Island; prices: Prices; onChoose?: (a: Action) => void; lit?: string | null }) {
  return (
    <div className="si-upgrades">
      <p className="si-upgrades__ideas">You have <strong>{n(Math.floor(island.ideas))}</strong> {Math.floor(island.ideas) === 1 ? 'idea' : 'ideas'}{island.ideas % 1 ? ' and a half' : ''}. Libraries think of more each turn.</p>
      <ul className="si-upgrades__list">
        {UPGRADES.map((u) => {
          const got = has(island, u.id);
          return (
            <li key={u.id} className={`si-upgrade${got ? ' si-upgrade--got' : ''}`}>
              <div>
                <strong>{u.name}</strong>
                <span className="si-upgrade__does">{u.does[0].toUpperCase() + u.does.slice(1)}.</span>
                {!got && (
                  <span className="si-bar" role="img" aria-label={`${n(Math.min(island.ideas, u.ideas))} of ${plural(u.ideas, 'idea')}`}>
                    <span style={{ width: `${Math.min(100, (island.ideas / u.ideas) * 100)}%` }} />
                  </span>
                )}
              </div>
              {got ? (
                <span className="si-upgrade__got">Unlocked</span>
              ) : onChoose ? (
                <Choice island={island} prices={prices} action={{ kind: 'upgrade', id: u.id }} onChoose={onChoose} pip={`upgrade-${u.id}`} lit={lit}>
                  Unlock: {plural(u.ideas, 'idea')}
                </Choice>
              ) : (
                <span className="si-upgrade__need" data-pip={`upgrade-${u.id}`}>Needs {plural(u.ideas, 'idea')}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
