import { useState } from 'react';
import { markAnswer, type PracticalQuestion } from '../../../shared/maths/practical';
import { PracticalAsk, Working } from '../../maths/PracticalAsk';

/**
 * One maths moment in a place: ask, then say right or not quite (with the worked answer), then a button
 * that carries on. Right, wrong or skipped, the caller does the same thing with the real numbers:
 * maths is how you check the bill, never a gate. `onDone` says whether it was answered right, and what was typed (null if skipped).
 */
export function Moment({ question, title, note, doneLabel, onDone }: { question: PracticalQuestion; title: string; note?: string; doneLabel: string; onDone: (right: boolean, answer: number | null) => void }) {
  const [result, setResult] = useState<'right' | 'wrong' | 'skipped' | null>(null);
  const [answer, setAnswer] = useState<number | null>(null);
  if (!result) {
    return <PracticalAsk question={question} title={title} note={note} onSubmit={(n) => { setAnswer(n); setResult(markAnswer(question, n) ? 'right' : 'wrong'); }} onNoThanks={() => setResult('skipped')} noThanksLabel="Show me how" noThanksIsSkip={false} />;
  }
  return (
    <div className="cq-panel cq-moment" role="group" aria-label={title}>
      <p className={result === 'right' ? 'cq-note' : undefined} role="status">
        {result === 'right' ? 'Right! Well done.' : result === 'wrong' ? 'Not quite, but no harm done. Here is how it works:' : 'No problem. Here is how it works:'}
      </p>
      {result !== 'right' && <Working question={question} />}
      <button type="button" className="cq-btn cq-btn--hot" autoFocus onClick={() => onDone(result === 'right', answer)}>{doneLabel}</button>
    </div>
  );
}
