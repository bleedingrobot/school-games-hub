import { MemberCard } from './MemberCard';
import { repickDone, repickMember } from './places';
import { CLASS_NAMES, RACE_NAMES, type Change, type Session } from './session';

/**
 * A new season: the clan starts fresh, and each member's race and class may be picked again before they have played
 * (the server refuses it once they have). Or keep them all with one tap. The server does the same sums, so what is
 * shown here is what it keeps.
 */
export function Repick({ session, onChange }: { session: Session; onChange: Change }) {
  const pick = (i: number, race: string, cls: string) => {
    const next = repickMember(session, i, race, cls);
    if (next) onChange(next, { type: 'repick', member: i, race, cls });
  };
  return (
    <section className="cq-repick" aria-label="A new season">
      <h2>A new season!</h2>
      <p>Your clan starts fresh. Pick each member's race and class again, or keep them. Your trophies and badges stay forever.</p>
      <div className="cq-cards">
        {session.clan.members.map((m, i) => {
          const started = m.level !== 1 || m.xp !== 0;
          return (
            <MemberCard key={`${i}-${m.race}-${m.cls}`} member={m} leader={i === 0}>
              <div className="cq-pickers">
                <label>
                  Race
                  <select value={m.race} disabled={started} onChange={(e) => pick(i, e.target.value, m.cls)}>
                    {RACE_NAMES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </label>
                <label>
                  Class
                  <select value={m.cls} disabled={started} onChange={(e) => pick(i, m.race, e.target.value)}>
                    {CLASS_NAMES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
              </div>
              {started && <p className="cq-soft">{m.name} has already started this season, so stays as they are.</p>}
            </MemberCard>
          );
        })}
      </div>
      <div className="cq-actions">
        <button type="button" className="cq-btn cq-btn--hot" onClick={() => onChange(repickDone(session), { type: 'repickDone' })}>Keep going</button>
      </div>
    </section>
  );
}
