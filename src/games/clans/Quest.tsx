import { useState } from 'react';
import { bestCharm, choiceOpen, type QuestDef, type QuestPrize } from '../../../shared/clans/quests';
import { LadderAsk, type Asker } from './LadderAsk';
import { doQuest, questToday, questUsed } from './places';
import type { Session, Change } from './session';

type Phase = { t: 'story'; shown: number } | { t: 'puzzle'; choice: number } | { t: 'result'; text: string; prize: QuestPrize; right: boolean | null };

const LETTERS = 'ABC';

/** What the prize was, in plain words. */
function prizeLine(p: QuestPrize): string {
  const bits = [
    p.gold > 0 && `${p.gold} gold`,
    p.followers > 0 && `${p.followers} new follower${p.followers === 1 ? '' : 's'}`,
    p.points > 0 && `${p.points} training point${p.points === 1 ? '' : 's'} for everyone`,
    p.item && `${p.item.name} for ${p.item.member}`,
  ].filter(Boolean) as string[];
  return bits.length ? `You got: ${bits.join(', ')}.` : 'This one is just for the story.';
}

/** One quest a day: the story one paragraph at a time, big choice buttons, sometimes a puzzle, and a plain result. */
export function Quest({ session, ask, onChange, onBack }: { session: Session; ask?: Asker; onChange: Change; onBack: () => void }) {
  const quest = questToday(session);
  const [phase, setPhase] = useState<Phase>({ t: 'story', shown: 1 });
  const used = questUsed(session) && phase.t !== 'result';

  // The server marks the two questions itself (`askCheck`), so the answers are not sent again here.
  const finish = (q: QuestDef, choice: number, right: boolean | null) => {
    const res = doQuest(session, q, choice, right);
    if ('ok' in res) return;
    onChange(res.session, { type: 'quest', choice, answers: [] });
    setPhase({ t: 'result', text: res.done.text, prize: res.done.prize, right });
  };
  const pick = (q: QuestDef, choice: number) => {
    const c = q.choices[choice];
    if (!choiceOpen(session.clan, c).open) return;
    // Practice (no server): no questions, and the story goes the good way.
    if (c.puzzle && ask) setPhase({ t: 'puzzle', choice });
    else finish(q, choice, c.puzzle ? true : null);
  };

  const choosing = !!quest && !used && phase.t === 'story' && phase.shown >= quest.story.length;

  /** Letters pick a choice when the choices are showing. */
  const keys = (event: React.KeyboardEvent) => {
    if (!choosing || !quest || event.ctrlKey || event.metaKey || event.altKey) return;
    const index = LETTERS.indexOf(event.key.toUpperCase());
    if (event.key.length === 1 && index >= 0 && index < quest.choices.length) {
      event.preventDefault();
      pick(quest, index);
    }
  };

  let body: React.ReactNode;
  if (!quest) {
    body = <p>There is no quest that suits today's settings. Try again tomorrow.</p>;
  } else if (used) {
    body = (
      <div className="cq-panel" role="status">
        <p>Your clan has already done its quest today. Well done! A new one is waiting tomorrow.</p>
      </div>
    );
  } else if (phase.t === 'result') {
    body = (
      <div className="cq-panel" role="status">
        {phase.right !== null && <p className="cq-soft">{phase.right ? 'Both right! You solved it.' : 'Not both right this time, but the story carries on.'}</p>}
        <p>{phase.text}</p>
        <p className="cq-note">{prizeLine(phase.prize)}</p>
        <button type="button" className="cq-btn cq-btn--hot" autoFocus onClick={onBack}>Carry on</button>
      </div>
    );
  } else if (phase.t === 'puzzle') {
    const choice = phase.choice;
    body = <LadderAsk key={`${quest.id}-${choice}`} kind="quest" ask={ask!} title={quest.title} note={`${quest.choices[choice].label}. Get both right for the big prize.`} onDone={(right) => finish(quest, choice, right.length === 2 && right.every(Boolean))} onSkip={() => finish(quest, choice, false)} />;
  } else {
    const shown = phase.shown;
    const { value: charm, member } = bestCharm(session.clan);
    body = (
      <>
        <div className="cq-story">
          {quest.story.slice(0, shown).map((p, i) => <p key={i}>{p}</p>)}
        </div>
        {shown < quest.story.length ? (
          <button type="button" className="cq-btn cq-btn--hot" autoFocus onClick={() => setPhase({ t: 'story', shown: shown + 1 })}>Read on</button>
        ) : (
          <div role="group" aria-label="What will you do? Press the letter shown, or tap a choice" className="cq-quest-choices">
            {quest.choices.map((c, i) => {
              const open = choiceOpen(session.clan, c);
              const why = !open.open ? open.say : undefined;
              return (
                <div key={i}>
                  <button type="button" className={`cq-btn cq-quest-choice${open.open ? '' : ' cq-quest-choice--locked'}`} aria-disabled={!open.open || undefined} aria-describedby={why ? `qwhy-${i}` : undefined} autoFocus={i === 0} onClick={() => pick(quest, i)}>
                    <strong>{LETTERS[i]}</strong> {c.label}{c.charm && ' (charm)'}
                  </button>
                  {why && <p id={`qwhy-${i}`} className="cq-soft cq-quest-why">{why}</p>}
                </div>
              );
            })}
            {quest.choices.some((c) => c.charm) && <p className="cq-soft">Your most charming member is {member?.name} (charisma {charm}).</p>}
          </div>
        )}
      </>
    );
  }

  return (
    <section className="cq-place" aria-label="The Quest" onKeyDown={keys}>
      <div className="cq-place__head">
        <h2>{quest && !used ? quest.title : 'Today’s quest'}</h2>
        <button type="button" className="cq-btn" onClick={onBack}>Back to the clan</button>
      </div>
      {session.questPick && <p className="cq-soft">Test pick: quest number {session.questPick}.</p>}
      {body}
    </section>
  );
}
