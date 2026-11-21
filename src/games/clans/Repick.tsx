import { useState } from 'react';
import { MemberCard } from './MemberCard';
import { changeLook, renameMember, repickDone, repickMember } from './places';
import { CLASS_NAMES, RACE_NAMES, type Change, type Session } from './session';
import { MEMBER_NAMES, TYPED_NAME_MAX } from '../../../shared/clans/words';
import { bannerArt } from './art';

/**
 * A new season: the clan starts fresh, and each member's race and class may be picked again before they have played
 * (the server refuses it once they have). Names may be changed too (James, 22 Nov 2026): from the list, or made up when
 * the teacher's switch is on. Or keep them all with one tap. The server does the same sums, so what is shown here is what it keeps.
 */
export function Repick({ session, typedNames = false, onChange }: { session: Session; typedNames?: boolean; onChange: Change }) {
  // What each member's "make up my own" box holds, or null while they use the list.
  const [typed, setTyped] = useState<(string | null)[]>(() => session.clan.members.map(() => null));
  const [problems, setProblems] = useState<(string | null)[]>(() => session.clan.members.map(() => null));
  const setAt = <T,>(set: (f: (a: T[]) => T[]) => void, i: number, v: T) => set((a) => a.map((x, j) => (j === i ? v : x)));

  const pick = (i: number, race: string, cls: string) => {
    const next = repickMember(session, i, race, cls);
    if (next) onChange(next, { type: 'repick', member: i, race, cls });
  };
  const rename = (i: number, name: string) => {
    const out = renameMember(session, i, name, typedNames);
    setAt(setProblems, i, out.ok ? null : out.say);
    if (out.ok && out.name !== session.clan.members[i].name) onChange(out.session, { type: 'rename', member: i, name: out.name });
    return out.ok;
  };
  const taken = (i: number, name: string) => session.clan.members.some((m, j) => j !== i && m.name.toLowerCase() === name.toLowerCase());

  return (
    <section className="cq-repick" aria-label="A new season">
      <header className="cq-repick__head">
        {bannerArt(session.clan.name) && <img className="cq-repick__banner" src={bannerArt(session.clan.name)} alt="" />}
        <div>
          <p className="cq-repick__kicker">{session.clan.season ? `Season ${session.clan.season} begins` : 'A new season begins'}</p>
          <h2>{session.clan.name}</h2>
          <p>Your clan starts fresh. Pick each member's name, look, race and class again, or keep them. Your trophies and badges stay forever.</p>
        </div>
      </header>
      <div className="cq-cards cq-cards--heroes">
        {session.clan.members.map((m, i) => {
          const started = m.level !== 1 || m.xp !== 0;
          const own = typed[i];
          return (
            <MemberCard key={`${i}-${m.race}-${m.cls}`} member={m} leader={i === 0} hero onLook={(look) => { const next = changeLook(session, i, look); if (next) onChange(next, { type: 'look', member: i, look }); }}>
              <div className="cq-pickers">
                {typedNames && own !== null ? (
                  <label>
                    Name
                    <input
                      type="text"
                      value={own}
                      maxLength={TYPED_NAME_MAX}
                      autoComplete="off"
                      spellCheck={false}
                      aria-invalid={problems[i] !== null}
                      aria-describedby={problems[i] ? `cq-rename-problem-${i}` : undefined}
                      onChange={(e) => setAt(setTyped, i, e.target.value)}
                      onBlur={() => { if (own.trim() !== '') rename(i, own); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); rename(i, own); } }}
                    />
                  </label>
                ) : (
                  <label>
                    Name
                    <select value={MEMBER_NAMES.includes(m.name) ? m.name : ''} onChange={(e) => rename(i, e.target.value)}>
                      {!MEMBER_NAMES.includes(m.name) && <option value="">{m.name}</option>}
                      {MEMBER_NAMES.map((n) => <option key={n} disabled={taken(i, n)}>{n}</option>)}
                    </select>
                  </label>
                )}
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
              {problems[i] && <p id={`cq-rename-problem-${i}`} className="cq-warn">{problems[i]}</p>}
              {typedNames && (
                <button
                  type="button"
                  className="cq-link"
                  onClick={() => { setAt(setTyped, i, own === null ? '' : null); setAt(setProblems, i, null); }}
                >
                  {own === null ? 'Make up my own name' : 'Pick from the list instead'}
                </button>
              )}
              {started && <p className="cq-soft">{m.name} has already started this season, so keeps their race and class.</p>}
            </MemberCard>
          );
        })}
      </div>
      <div className="cq-actions">
        <button data-key="enter" type="button" className="cq-btn cq-btn--hot" onClick={() => onChange(repickDone(session), { type: 'repickDone' })}>Keep going</button>
      </div>
    </section>
  );
}
