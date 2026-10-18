import { useState } from 'react';
import { goalOf, goalQuestion, VILLAGE_BLURBS, VILLAGE_KINDS, VILLAGE_NAMES, villageMax, voteOptions } from '../../../shared/clans/village';
import { Bar } from './Bars';
import { giveToChest, voteFor } from './places';
import type { Session, Change } from './session';

const GIFTS = [10, 25, 50, 100];

/** A small maths moment about the class goal. Marked by code; a wrong answer blocks nothing and shows the working. */
function GoalMoment({ goal }: { goal: NonNullable<ReturnType<typeof goalOf>> }) {
  const q = goalQuestion(goal);
  const [typed, setTyped] = useState('');
  const [done, setDone] = useState<'right' | 'wrong' | null>(null);
  if (!q) return <p role="status">The chest has enough! The class can build it when the week ends.</p>;
  return (
    <div className="cq-moment" aria-label="Class goal question">
      <p>{q.text}</p>
      {done === null ? (
        <div className="cq-actions">
          <label>Gold needed <input type="number" inputMode="numeric" value={typed} aria-label="Gold needed" onChange={(e) => setTyped(e.target.value)} /></label>
          <button type="button" className="cq-btn" onClick={() => setDone(Number(typed) === q.answer ? 'right' : 'wrong')}>Check</button>
          <button type="button" className="cq-btn" onClick={() => setDone('wrong')}>Show me</button>
        </div>
      ) : (
        <p role="status">{done === 'right' ? 'Yes! ' : 'Here is the working: '}{q.working}</p>
      )}
    </div>
  );
}

/** The class village: the chest and the class goal, the weekly vote, and what has been built. Everything here is shared with the class. */
export function Village({ session, onChange, onBack, onNews }: { session: Session; onChange: Change; onBack: () => void; onNews: () => void }) {
  const v = session.village;
  const [said, setSaid] = useState('');
  if (!v) {
    return (
      <section className="cq-place" aria-label="The Village">
        <div className="cq-place__head"><h2>The Village</h2><button type="button" className="cq-btn" onClick={onBack}>Back to the clan</button></div>
        <p className="cq-panel">Your village is not ready yet.</p>
      </section>
    );
  }
  const options = voteOptions(v.levels);
  const goal = goalOf(v.levels, v.chest, v.votes);
  const give = (gold: number) => {
    const next = giveToChest(session, gold);
    if (!next) return setSaid(`The clan purse has ${session.clan.gold} gold.`);
    onChange(next, { type: 'chestGive', gold });
    setSaid(`${gold} gold went into the village chest. Thank you!`);
  };
  const vote = (kind: (typeof VILLAGE_KINDS)[number]) => {
    const next = voteFor(session, kind);
    if (!next) return;
    onChange(next, { type: 'vote', kind });
    setSaid(`You voted for the ${VILLAGE_NAMES[kind]}.`);
  };
  const totalVotes = VILLAGE_KINDS.reduce((t, k) => t + (v.votes[k] ?? 0), 0);
  return (
    <section className="cq-place" aria-label="The Village">
      <div className="cq-place__head">
        <h2>The Village: {v.name}</h2>
        <button type="button" className="cq-btn" onClick={onBack}>Back to the clan</button>
      </div>
      <div className="cq-land">
        <div className="cq-panel">
          <h3>The class goal</h3>
          {goal ? (
            <>
              <p><strong>{goal.text}</strong></p>
              <Bar label="Chest" value={goal.have} max={goal.cost} kind="sp" />
              <p className="cq-soft">{goal.percent}% of the way there. The class gives, and votes each week on what to build.</p>
              <GoalMoment key={`${goal.kind}-${goal.level}-${goal.have}`} goal={goal} />
            </>
          ) : (
            <p>The village has built everything. What a class!</p>
          )}
        </div>
        <div className="cq-panel">
          <h3>The village chest</h3>
          <p>The chest has <strong>{v.chest} gold</strong>. Your clan purse has <strong>{session.clan.gold} gold</strong>.</p>
          <p className="cq-soft">Anyone can give. Nobody can take gold out, and nobody has to give. The class spends it on the building that wins the vote.</p>
          <div className="cq-sides" role="group" aria-label="Give gold">
            {GIFTS.map((g) => <button key={g} type="button" className="cq-btn" disabled={g > session.clan.gold || !goal} onClick={() => give(g)}>Give {g}</button>)}
          </div>
          <p role="status" className="cq-soft">{said}</p>
        </div>
        <div className="cq-panel">
          <h3>This week's vote</h3>
          {options.length === 0 ? <p>Everything is built.</p> : (
            <ul className="cq-kingdoms">
              {options.map((o) => (
                <li key={o.kind}>
                  <button type="button" className="cq-btn" aria-pressed={v.myVote === o.kind} onClick={() => vote(o.kind)}>
                    {VILLAGE_NAMES[o.kind]} level {o.level}: {o.cost} gold · {v.votes[o.kind] ?? 0} {(v.votes[o.kind] ?? 0) === 1 ? 'vote' : 'votes'}{v.myVote === o.kind ? ' · your vote' : ''}
                    <br /><span className="cq-soft">{VILLAGE_BLURBS[o.kind]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="cq-soft">{totalVotes === 0 ? 'Nobody has voted yet.' : `${totalVotes} ${totalVotes === 1 ? 'vote' : 'votes'} so far.`} One vote each, and you can change yours. The vote closes on Monday morning, and the winner is built if the chest has enough gold.</p>
        </div>
        <div className="cq-panel">
          <h3>What the village has built</h3>
          <ul>
            {VILLAGE_KINDS.map((k) => <li key={k}>{VILLAGE_NAMES[k]}: level {v.levels[k]} of {villageMax(k)} <span className="cq-soft">({VILLAGE_BLURBS[k]})</span></li>)}
          </ul>
          <div className="cq-actions"><button type="button" className="cq-btn" onClick={onNews}>Village news</button></div>
        </div>
      </div>
    </section>
  );
}
