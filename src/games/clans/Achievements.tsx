import { CONFIG } from '../../../shared/clans/config';
import { achievementList } from './fame';
import type { Session } from './session';

/** The eight Clan Quest achievements, and which ones this clan has earned. */
export function Achievements({ session, onBack }: { session: Session; onBack: () => void }) {
  const list = achievementList(session);
  return (
    <section className="cq-achievements" aria-label="Achievements">
      <h2>Achievements</h2>
      <p className="cq-soft">Each one you earn is worth 10 points on the hub. {list.filter((a) => a.earned).length} of {list.length} earned.</p>
      <ul className="cq-achievement-list">
        {list.map(({ def, earned }) => (
          <li key={def.id} className={earned ? 'cq-achievement cq-achievement--earned' : 'cq-achievement'}>
            <span aria-hidden="true" className="cq-achievement__emoji">{def.emoji}</span>
            <span>
              <strong>{def.name}</strong> – {def.how}
              <span className="cq-soft"> {earned ? '(Earned!)' : '(Not yet)'}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="cq-actions"><button data-key="esc" type="button" className="cq-btn" onClick={onBack}>Back to the clan</button></div>
    </section>
  );
}

/** The small dialog for finishing the whole village. Gentle: no sound, and the sparkle stops with reduced motion. */
export function VillageDone({ onClose }: { onClose: () => void }) {
  return (
    <div className="cq-celebrate cq-celebrate--village" role="dialog" aria-label="Village complete" aria-modal="false">
      <p>
        <span aria-hidden="true" className="cq-celebrate__spark">🏰</span>{' '}
        Your whole village is built! +{CONFIG.season.villageReward.fame} fame and the Master Builder badge.
      </p>
      <button data-key="enter" type="button" className="cq-btn cq-btn--hot" autoFocus onClick={onClose}>OK</button>
    </div>
  );
}
