import { useState } from 'react';
import { CLASS_NAMES, draftMember, MAX_ROLLS, RACE_NAMES, rollAgain, startingDrafts, makeClan, type Draft } from './session';
import { MemberCard } from './MemberCard';
import { CLAN_ADJECTIVES, CLAN_NOUNS, MEMBER_NAMES, clanNameFrom } from './words';
import type { Clan } from '../../../shared/clans/types';

/** Pick race and class for four members, see the stats, roll again (up to 3 times), choose names from a list. */
export function Creator({ seed, onDone }: { seed: number; onDone: (clan: Clan, choices: { name: string; drafts: Draft[] }) => void }) {
  const [drafts, setDrafts] = useState<Draft[]>(() => startingDrafts(seed));
  const [adj, setAdj] = useState(Math.abs(seed) % CLAN_ADJECTIVES.length);
  const [noun, setNoun] = useState(Math.abs(seed >> 3) % CLAN_NOUNS.length);
  const set = (i: number, patch: Partial<Draft>) => setDrafts((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const taken = (i: number, name: string) => drafts.some((d, j) => j !== i && d.name === name);

  return (
    <section className="cq-creator" aria-label="Make your clan">
      <h2>Make your clan</h2>
      <p className="cq-soft">Pick a race and a class for each of your four adventurers. Don't like the numbers? Roll again (up to {MAX_ROLLS} times each). The first one is your clan leader, with a little extra.</p>
      <div className="cq-cards">
        {drafts.map((d, i) => (
          <MemberCard key={i} member={draftMember(d, i)} leader={i === 0}>
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
              <label>
                Name
                <select value={d.name} onChange={(e) => set(i, { name: e.target.value })}>
                  {MEMBER_NAMES.map((n) => <option key={n} disabled={taken(i, n)}>{n}</option>)}
                </select>
              </label>
            </div>
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
        <button type="button" className="cq-btn cq-btn--hot" onClick={() => { const name = clanNameFrom(adj, noun); onDone(makeClan(name, drafts), { name, drafts }); }}>
          Start the adventure
        </button>
      </div>
    </section>
  );
}
