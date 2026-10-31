import { useState } from 'react';
import { CLASS_NAMES, draftMember, MAX_ROLLS, RACE_NAMES, rollAgain, startingDrafts, makeClan, type Draft } from './session';
import { LookPicker, MemberCard } from './MemberCard';
import { lookOf } from '../../../shared/clans/looks';
import { HowToPlayBody } from './HowToPlay';
import { CLAN_ADJECTIVES, CLAN_NOUNS, MEMBER_NAMES, TYPED_NAME_MAX, checkTypedName, clanNameFrom } from './words';
import type { Clan } from '../../../shared/clans/types';

/**
 * Pick race and class for four members, see the stats, roll again (up to 3 times), choose names from a list.
 * With the teacher's `typedNames` switch on, each member can have a made-up name instead (the list stays the default).
 */
export function Creator({ seed, typedNames = false, onDone }: { seed: number; typedNames?: boolean; onDone: (clan: Clan, choices: { name: string; drafts: Draft[] }) => void }) {
  const [drafts, setDrafts] = useState<Draft[]>(() => startingDrafts(seed));
  // What each member's "make up my own" box holds, or null while they use the list.
  const [typed, setTyped] = useState<(string | null)[]>(() => drafts.map(() => null));
  const [adj, setAdj] = useState(Math.abs(seed) % CLAN_ADJECTIVES.length);
  const [noun, setNoun] = useState(Math.abs(seed >> 3) % CLAN_NOUNS.length);
  const set = (i: number, patch: Partial<Draft>) => setDrafts((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setOwn = (i: number, text: string | null) => setTyped((t) => t.map((x, j) => (j === i ? text : x)));

  // Each member's name as it will be saved, or why it can't be used yet.
  const checks = drafts.map((d, i) => (typedNames && typed[i] !== null ? checkTypedName(typed[i]) : { ok: true as const, name: d.name }));
  const nameOf = (i: number) => { const c = checks[i]; return c.ok ? c.name : drafts[i].name; };
  const sameAs = (i: number, name: string) => drafts.some((_, j) => j !== i && nameOf(j).toLowerCase() === name.toLowerCase());
  const problems = checks.map((c, i) => (!c.ok ? c.say : sameAs(i, c.name) ? 'Another member has this name.' : null));
  const ready = problems.every((p) => p === null);
  const final = drafts.map((d, i) => ({ ...d, name: nameOf(i) }));

  return (
    <section className="cq-creator" aria-label="Make your clan">
      <h2>Make your clan</h2>
      <p className="cq-soft">
        Pick a race, a class and a look for each of your four adventurers. Don't like the numbers? Roll again (up to {MAX_ROLLS} times each). The first one is your clan leader, with a little extra.
        {typedNames && ' Pick a name from the list, or make up your own.'}
      </p>
      <details className="cq-panel cq-creator__help">
        <summary>How to play</summary>
        <HowToPlayBody />
      </details>
      <div className="cq-cards">
        {final.map((d, i) => (
          <MemberCard key={i} member={draftMember(d, i)} leader={i === 0}>
            <LookPicker race={d.race} cls={d.cls} value={lookOf(draftMember(d, i))} onPick={(look) => set(i, { look })} />
            <div className="cq-pickers">
              <label>
                Race
                <select value={d.race} onChange={(e) => set(i, { race: e.target.value })}>
                  {RACE_NAMES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </label>
              <label>
                Class
                <select value={d.cls} onChange={(e) => set(i, { cls: e.target.value })}>
                  {CLASS_NAMES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              {typedNames && typed[i] !== null ? (
                <label>
                  Name
                  <input
                    type="text"
                    value={typed[i] ?? ''}
                    maxLength={TYPED_NAME_MAX}
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={problems[i] !== null}
                    aria-describedby={problems[i] ? `cq-name-problem-${i}` : undefined}
                    onChange={(e) => setOwn(i, e.target.value)}
                  />
                </label>
              ) : (
                <label>
                  Name
                  <select value={drafts[i].name} onChange={(e) => set(i, { name: e.target.value })}>
                    {MEMBER_NAMES.map((n) => <option key={n} disabled={sameAs(i, n)}>{n}</option>)}
                  </select>
                </label>
              )}
            </div>
            {typedNames && typed[i] !== null && problems[i] && <p id={`cq-name-problem-${i}`} className="cq-warn">{problems[i]}</p>}
            {typedNames && (
              <button
                type="button"
                className="cq-link"
                onClick={() => {
                  // Keep the look the member has now, so it doesn't change with every letter typed.
                  if (typed[i] === null) set(i, { look: lookOf(draftMember(d, i)) });
                  setOwn(i, typed[i] === null ? '' : null);
                }}
              >
                {typed[i] === null ? 'Make up my own name' : 'Pick from the list instead'}
              </button>
            )}
            <button type="button" className="cq-btn" disabled={d.rolls >= MAX_ROLLS} onClick={() => setDrafts((all) => all.map((x, j) => (j === i ? rollAgain(x) : x)))}>
              Roll again <small>({MAX_ROLLS - d.rolls} left)</small>
            </button>
          </MemberCard>
        ))}
      </div>
      <div className="cq-actions">
        <label>
          Clan name
          <select value={adj} onChange={(e) => setAdj(Number(e.target.value))}>
            {CLAN_ADJECTIVES.map((a, i) => <option key={a} value={i}>{a}</option>)}
          </select>{' '}
          <select value={noun} aria-label="Clan name, second word" onChange={(e) => setNoun(Number(e.target.value))}>
            {CLAN_NOUNS.map((n, i) => <option key={n} value={i}>{n}</option>)}
          </select>
        </label>
        <button type="button" className="cq-btn cq-btn--hot" disabled={!ready} onClick={() => { const name = clanNameFrom(adj, noun); onDone(makeClan(name, final), { name, drafts: final }); }}>
          Start the adventure
        </button>
        {!ready && <span className="cq-warn">Fix the names marked above first.</span>}
      </div>
    </section>
  );
}
