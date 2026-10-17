/**
 * Preview only: try every maths topic on its own. Pick a topic and a band, answer a round of
 * 10, and see how each kind of question is going. "Every kind" lists one example of each.
 * Nothing is saved: reloading the page starts fresh.
 */
import { StrictMode, useCallback, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BandedPack } from '../../shared/maths/banded';
import { mastery, type Mastery } from '../../shared/maths/leitner';
import type { AnswerResult, Question, SkillPack } from '../../shared/maths/skillPack';
import { makePack, TOPICS, type TopicId } from '../../shared/maths/skillPacks';
import { QuestionModal } from '../../src/maths/QuestionModal';
import '../../src/styles.css';
import './maths-preview.css';

const ROUND = 10;
const LABEL: Record<Mastery, string> = { 'not-tried': 'Not tried', learning: 'Learning', secure: 'Secure', fluent: 'Fluent' };

function Practice() {
  const packs = useMemo(() => new Map(TOPICS.map((t) => [t.id, makePack(t.id)] as [TopicId, SkillPack])), []);
  const [topic, setTopic] = useState<TopicId>('add-sub');
  const [band, setBand] = useState(1);
  const [choices, setChoices] = useState(false);
  const [question, setQuestion] = useState<Question | null>(null);
  const [round, setRound] = useState<boolean[]>([]);
  const [last, setLast] = useState<boolean[] | null>(null);
  const [, redraw] = useState(0);
  const pack = packs.get(topic)!;
  const banded = pack instanceof BandedPack ? pack : null;
  const bands = banded ? banded.bandCount : 10;

  const ask = useCallback(() => setQuestion(pack.nextQuestion({ level: band, multipleChoice: choices })), [pack, band, choices]);
  const done = useCallback(
    (result: AnswerResult) => {
      const results = [...round, result.correct];
      redraw((n) => n + 1);
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
    <section className="mp">
      <h1>Maths topics practice</h1>
      <p>The six Maths Monsters topics. Answer {ROUND} questions at a time; the list below shows how each kind of question is going.</p>
      <div className="mp__settings">
        <label>
          Topic{' '}
          <select
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value as TopicId);
              setBand(1);
              setLast(null);
            }}
          >
            {TOPICS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {banded ? 'Band' : 'Level'}{' '}
          <select value={band} onChange={(e) => setBand(Number(e.target.value))}>
            {Array.from({ length: bands }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input type="checkbox" checked={choices} onChange={(e) => setChoices(e.target.checked)} /> Multiple choice
        </label>
        <button type="button" className="button button--primary" onClick={() => { setLast(null); ask(); }}>
          Answer {ROUND} questions
        </button>
      </div>
      {last && (
        <p className="mp__result" role="status">
          You got {last.filter(Boolean).length} out of {ROUND}.
        </p>
      )}
      {banded && <Kinds pack={banded} />}
      {question && (
        <QuestionModal
          question={question}
          title={TOPICS.find((t) => t.id === topic)!.label}
          note={`Question ${round.length + 1} of ${ROUND}`}
          onSubmit={(answer, ms) => pack.recordAnswer(question, answer, ms)}
          onDone={done}
        />
      )}
    </section>
  );
}

/** Each band's kinds of question, with how they're going (fact families: counts per mastery). */
function Kinds({ pack }: { pack: BandedPack }) {
  const def = pack.definition;
  return (
    <div className="mp__bands">
      {def.bands.map((names, i) => (
        <div key={i} className="mp__band">
          <h2>Band {i + 1}</h2>
          <ul>
            {names.map((name) => {
              const family = def.families[name];
              const counts = new Map<Mastery, number>();
              for (const key of family.keys) {
                const m = mastery(pack.statsFor(key));
                counts.set(m, (counts.get(m) ?? 0) + 1);
              }
              const example = pack.rebuild(family.keys[Math.floor(family.keys.length / 2)], family.roll(family.keys[Math.floor(family.keys.length / 2)], Math.random));
              return (
                <li key={name}>
                  <strong>{family.label}</strong>
                  <span className="mp__example">e.g. {example?.choiceLabels ? `${example.parts.join(' ')} ${example.choiceLabels.join(' or ')}` : example?.parts.join(' ')}</span>
                  <span className="mp__mastery">
                    {family.keys.length === 1
                      ? <i data-mastery={mastery(pack.statsFor(family.keys[0]))}>{LABEL[mastery(pack.statsFor(family.keys[0]))]}</i>
                      : (Object.keys(LABEL) as Mastery[]).filter((m) => counts.get(m)).map((m) => (
                          <i key={m} data-mastery={m}>{counts.get(m)} {LABEL[m].toLowerCase()}</i>
                        ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Practice />
  </StrictMode>,
);


