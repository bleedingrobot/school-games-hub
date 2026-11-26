import { useEffect, useState } from 'react';
import type { Action, AskFor } from '../../../shared/clans/actions';
import type { PublicQuestion } from '../../../shared/maths/serverQuestions';
import { QuestionModal, type MarkedAnswer, type ShownQuestion } from '../../maths/QuestionModal';
import type { ServerReply } from './remote';

/** Sends an action and gives back the server's answer (ClanQuest's `ask`). Missing in Practice (no server). */
export type Asker = (action: Action) => Promise<ServerReply>;

const shown = (q: PublicQuestion): ShownQuestion => ({ id: q.slot, parts: q.parts, spoken: q.spoken, prompt: q.prompt, choices: q.choices, choiceLabels: q.choiceLabels, maxLength: q.maxLength, input: q.input, figure: q.figure });

/**
 * Ladder questions from the child's own maths for the shop discount, the quest or the siege. The server makes them (`ask`)
 * and marks each one as it is answered (`askCheck`), so the box can say right or wrong; the shop, quest or siege then uses
 * the server's marks. `onDone` gets how each question went (false for one left out). If the questions can't be had,
 * it says so and carries on without them.
 */
export function LadderAsk({ kind, title, note, ask, onDone, onSkip }: { kind: AskFor; title: string; note?: string; ask: Asker; onDone: (right: boolean[]) => void; onSkip: () => void }) {
  const [questions, setQuestions] = useState<PublicQuestion[] | null>(null);
  const [slot, setSlot] = useState(0);
  const [right, setRight] = useState<boolean[]>([]);
  const [trouble, setTrouble] = useState('');

  useEffect(() => {
    let live = true;
    ask({ type: 'ask', for: kind }).then(
      (reply) => {
        if (!live) return;
        if (!reply.ok || reply.result.type !== 'ask') return setTrouble(reply.ok ? "We couldn't get your questions just now." : reply.say);
        // Back after a refresh: questions already answered keep their marks.
        const marks = reply.state?.ask?.marks ?? [];
        const done = reply.result.questions.findIndex((_, i) => !marks[i]);
        setRight(marks.slice(0, done < 0 ? marks.length : done).map((m) => !!m?.correct));
        if (done < 0) return onDone(marks.map((m) => !!m?.correct));
        setSlot(done);
        setQuestions(reply.result.questions);
      },
      () => live && setTrouble("We couldn't reach the server for your questions."),
    );
    return () => { live = false; };
    // Asked once, when the box opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (trouble) {
    return (
      <div className="cq-panel" role="status">
        <p>{trouble}</p>
        <button data-key="enter" type="button" className="cq-btn cq-btn--hot" autoFocus onClick={onSkip}>Carry on without it</button>
      </div>
    );
  }
  const q = questions?.[slot];
  if (!questions || !q) return <p className="cq-soft" role="status">Getting your question…</p>;

  const check = async (answer: number, ms: number): Promise<MarkedAnswer> => {
    const reply = await ask({ type: 'askCheck', slot, answer, ms });
    if (!reply.ok || reply.result.type !== 'askCheck') throw new Error(reply.ok ? 'We couldn’t check that one. Try again.' : reply.say);
    const r = reply.result;
    const label = q.choices && q.choiceLabels ? q.choiceLabels[q.choices.indexOf(r.answer)] ?? String(r.answer) : String(r.answer);
    return { correct: r.correct, fact: `The answer was ${label}.`, boxBefore: 0, boxAfter: 0, answer: r.answer };
  };
  const next = (result: MarkedAnswer) => {
    const now = [...right, result.correct];
    setRight(now);
    if (slot + 1 >= questions.length) return onDone(now);
    setSlot(slot + 1);
  };
  const count = questions.length > 1 ? ` (${slot + 1} of ${questions.length})` : '';
  return <QuestionModal key={slot} question={shown(q)} title={`${title}${count}`} note={note} onSubmit={check} onDone={next} onClose={onSkip} closeLabel="No thanks" />;
}
