/**
 * Preview only: try the maths engine on its own. Pick a campaign level, answer a round of
 * 10 questions, and watch the 12 × 12 grid fill in (the same grid teachers will see).
 * Nothing is saved: reloading the page starts fresh.
 */
import { useCallback, useRef, useState } from 'react';
import { factKey } from '../../shared/maths/facts';
import { mastery, type Mastery } from '../../shared/maths/leitner';
import type { AnswerResult, Question } from '../../shared/maths/skillPack';
import { TimesTables } from '../../shared/maths/skillPacks/timesTables';
import { QuestionModal } from '../../src/maths/QuestionModal';

const ROUND = 10;
const MASTERY_LABEL: Record<Mastery, string> = {
  'not-tried': 'Not tried',
  learning: 'Learning',
  secure: 'Secure',
  fluent: 'Fluent',
};

export function MathsPractice() {
  const pack = useRef(new TimesTables()).current;
  const [level, setLevel] = useState(1);
  const [division, setDivision] = useState(false);
  const [choices, setChoices] = useState(false);
  const [question, setQuestion] = useState<Question | null>(null);
  const [round, setRound] = useState<boolean[]>([]);
  const [last, setLast] = useState<boolean[] | null>(null);

  const ask = useCallback(() => {
    setQuestion(pack.nextQuestion({ level, division, multipleChoice: choices }));
  }, [pack, level, division, choices]);

  const done = useCallback(
    (result: AnswerResult) => {
      const results = [...round, result.correct];
      if (results.length >= ROUND) {
        setQuestion(null);
        setRound([]);
        setLast(results);
      } else {
        setRound(results);
        ask();
      }
    },
    [round, ask],
  );

  return (
    <section className="practice">
      <h2>Maths practice</h2>
      <p>Answer {ROUND} questions at a time. The grid shows how well each fact is known.</p>
      <div className="practice__settings">
        <label>
          Campaign level{' '}
          <select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            {Array.from({ length: 10 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input type="checkbox" checked={division} onChange={(e) => setDivision(e.target.checked)} /> Division
        </label>
        <label>
          <input type="checkbox" checked={choices} onChange={(e) => setChoices(e.target.checked)} /> Multiple choice
        </label>
        <button type="button" className="button button--primary" onClick={() => { setLast(null); ask(); }}>
          Answer {ROUND} questions
        </button>
      </div>
      {last && (
        <p className="practice__result" role="status">
          You got {last.filter(Boolean).length} out of {ROUND}.
        </p>
      )}
      <div className="practice__grid-wrap">
        <table className="practice__grid">
          <caption>Times-table grid</caption>
          <thead>
            <tr>
              <th scope="col">×</th>
              {Array.from({ length: 12 }, (_, i) => (
                <th key={i} scope="col">{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, r) => (
              <tr key={r}>
                <th scope="row">{r + 1}</th>
                {Array.from({ length: 12 }, (_, c) => {
                  const m = mastery(pack.statsFor(factKey(r + 1, c + 1)));
                  return (
                    <td key={c} data-mastery={m} title={`${r + 1} × ${c + 1}: ${MASTERY_LABEL[m]}`}>
                      {(r + 1) * (c + 1)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="practice__legend">
        {(Object.keys(MASTERY_LABEL) as Mastery[]).map((m) => (
          <span key={m}>
            <i data-mastery={m} /> {MASTERY_LABEL[m]}
          </span>
        ))}
      </p>
      <p className="practice__hint">Fluent needs quick right answers on two different days, so it can't happen in one go.</p>
      {question && (
        <QuestionModal
          question={question}
          title="Practice"
          note={`Question ${round.length + 1} of ${ROUND}`}
          onSubmit={(answer, ms) => pack.recordAnswer(question, answer, ms)}
          onDone={done}
        />
      )}
    </section>
  );
}
