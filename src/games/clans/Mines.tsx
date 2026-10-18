import { bossAt } from '../../../shared/clans/fight';
import { CONFIG } from '../../../shared/clans/config';
import { fightsLabel } from './fightView';
import { hintFor, type FightSummary, type Session } from './session';
import { ZONE_TEXT, zoneForDepth } from './text';
import type { Member } from '../../../shared/clans/types';

const HINT_TEXT = { 'too easy': 'Too easy', 'just right': 'Just right', tough: 'Tough', 'too hard': 'Too hard' } as const;

/** Choose how deep to go. */
export function Mines({ session, onDepth, onGo, onBack, locked }: { session: Session; onDepth: (d: number) => void; onGo: (boss: boolean) => void; onBack: () => void; locked?: string }) {
  const hint = hintFor(session);
  const boss = bossAt(session.depth);
  const awake = session.clan.members.some((m) => !m.knockedOut);
  const canGo = session.fightsLeft > 0 && awake && !locked;
  const set = (d: number) => onDepth(Math.max(0, Math.min(CONFIG.maxLevel, d)));
  return (
    <section className="cq-mines" aria-label="The Mines">
      <h2>The Mines</h2>
      <p>Fights left today: <strong>{fightsLabel(session.fightsLeft, session.fightsPerDay)}</strong></p>
      <div className="cq-depth">
        <button type="button" className="cq-btn" aria-label="Go less deep" onClick={() => set(session.depth - 1)}>−</button>
        <label>
          Depth
          <input type="number" min={0} max={CONFIG.maxLevel} value={session.depth} onChange={(e) => set(Number(e.target.value) || 0)} />
        </label>
        <button type="button" className="cq-btn" aria-label="Go deeper" onClick={() => set(session.depth + 1)}>+</button>
        <span className={`cq-hint cq-hint--${hint.replace(' ', '-')}`}>{HINT_TEXT[hint]}</span>
      </div>
      <p className="cq-soft">{ZONE_TEXT[zoneForDepth(session.depth)]}</p>
      <div className="cq-actions">
        <button type="button" className="cq-btn cq-btn--hot" disabled={!canGo} onClick={() => onGo(false)}>Into the Mines!</button>
        {boss && <button type="button" className="cq-btn" disabled={!canGo} onClick={() => onGo(true)}>Take on the boss: {boss.name}</button>}
        <button type="button" className="cq-btn" onClick={onBack}>Back to the clan</button>
      </div>
      {locked && <p className="cq-note">{locked}</p>}
      {session.fightsLeft === 0 && <p className="cq-note">That's all the fights for today. Come back tomorrow!</p>}
      {session.fightsLeft > 0 && !awake && <p className="cq-note">Everyone is resting. They wake up tomorrow.</p>}
    </section>
  );
}

/** How the fight went, member by member. */
export function Results({ summary, members, fame = 0, onDone }: { summary: FightSummary; members: Member[]; fame?: number; onDone: () => void }) {
  return (
    <section className="cq-results" aria-label="Fight results">
      <h2>{summary.result === 'won' ? 'Victory!' : summary.result === 'lost' ? 'A rest is needed' : 'Back safe'}</h2>
      <p>Gold: <strong>+{summary.gold}</strong>{summary.followers > 0 && <> · Followers: <strong>+{summary.followers}</strong></>}{fame > 0 && <> · Fame: <strong>+{fame}</strong></>}</p>
      <ul className="cq-xp">
        {members.map((m, i) => (
          <li key={m.name}>
            {m.name}: +{summary.xp[i]} experience{summary.levels[i] > 0 && <strong className="cq-levelup"> · Level up! Now level {m.level}</strong>}
          </li>
        ))}
      </ul>
      <button type="button" className="cq-btn cq-btn--hot" autoFocus onClick={onDone}>Back to the clan</button>
    </section>
  );
}
