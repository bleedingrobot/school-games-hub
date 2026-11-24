/**
 * A gallery of ladder questions as pupils see them, for the Year 7-8 plan's card pages (docs/plans/ladder-7-8/PLAN.md).
 * ?keys=a,b,c shows one question per generated question type (?mc=1 as choices); ?demo=y1 shows Card Y1's sample questions.
 * Each question is in its own box with data-shot="<key>" so a script can take one picture per question.
 *   npx vite --config vite.ladder-cards-preview.config.ts
 */
import { createRoot } from 'react-dom/client';
import { generatedPack } from '../../shared/maths/skillPacks/generated';
import { seededRandom } from '../../shared/maths/serverQuestions';
import type { Question } from '../../shared/maths/skillPack';
import { QuestionModal } from '../../src/maths/QuestionModal';
import '../../src/styles.css';

const url = new URL(location.href);
const keys = (url.searchParams.get('keys') ?? '').split(',').filter(Boolean);
const mc = url.searchParams.get('mc') === '1';
const seed = url.searchParams.get('seed') ?? 'gallery';

const Y1: Question[] = [
  { id: 1, skill: 'demo', factKey: 'demo:power', kind: 'demo', parts: ['10⁴', '=', '?'], spoken: '10 to the power of 4 equals what?', answer: 10000, maxLength: 6, band: 'focus' },
  { id: 2, skill: 'demo', factKey: 'demo:root', kind: 'demo', parts: ['√81', '=', '?'], spoken: 'the square root of 81 equals what?', answer: 9, band: 'focus' },
  { id: 3, skill: 'demo', factKey: 'demo:primes', kind: 'demo', parts: ['36', '=', '?'], spoken: 'Which is 36 written as prime factors?', answer: 0, band: 'focus', prompt: 'Which is 36 as prime factors?', choices: [0, 1, 2, 3], choiceLabels: ['2² × 3²', '2 × 3³', '2² × 9', '4 × 3²'] },
  { id: 4, skill: 'demo', factKey: 'demo:neg', kind: 'demo', parts: ['−4', '−', '5', '=', '?'], spoken: 'negative 4 minus 5 equals what?', answer: 0, band: 'focus', choices: [0, 1, 2, 3], choiceLabels: ['−9', '−1', '1', '9'] },
  { id: 5, skill: 'demo', factKey: 'demo:tri', kind: 'demo', parts: ['50°', '+', '60°', '+', '?°', '=', '180°'], spoken: 'A triangle has angles of 50 degrees and 60 degrees. What is the third angle?', prompt: 'The angles in a triangle', answer: 70, band: 'focus', figure: { kind: 'triangle', angles: ['50°', '60°', '?'] } },
  { id: 6, skill: 'demo', factKey: 'demo:line', kind: 'demo', parts: ['115°', '+', '?°', '=', '180°'], spoken: 'Angles on a straight line: 115 degrees and what?', prompt: 'Angles on a straight line', answer: 65, band: 'focus', figure: { kind: 'line', angles: ['115°', '?'] } },
  { id: 7, skill: 'demo', factKey: 'demo:rect', kind: 'demo', parts: ['Area', '=', '?', 'cm²'], spoken: 'A rectangle is 6 centimetres by 4 centimetres. What is its area in square centimetres?', prompt: 'A rectangle 6 cm by 4 cm', answer: 24, band: 'focus', figure: { kind: 'rectangle', width: '6 cm', height: '4 cm', inside: '?' } },
  { id: 8, skill: 'demo', factKey: 'demo:cube', kind: 'demo', parts: ['Volume', '=', '?', 'cm³'], spoken: 'A cube has sides of 3 centimetres. What is its volume in cubic centimetres?', prompt: 'A cube with 3 cm sides', answer: 27, band: 'focus', figure: { kind: 'cuboid', length: '3 cm', width: '', height: '', cube: true } },
  { id: 9, skill: 'demo', factKey: 'demo:poly', kind: 'demo', parts: ['Exterior angle', '=', '?°'], spoken: 'What is the exterior angle of a regular hexagon?', prompt: 'A regular hexagon', answer: 60, band: 'focus', figure: { kind: 'polygon', sides: 6, label: '?' } },
  { id: 10, skill: 'demo', factKey: 'demo:compass', kind: 'demo', parts: ['N', 'to', 'SE', '=', '?°'], spoken: 'Turning clockwise from north to south-east is how many degrees?', prompt: 'Turn clockwise', answer: 135, band: 'focus', figure: { kind: 'compass', from: 'N', to: 'SE' } },
];

function questions(): Question[] {
  if (url.searchParams.get('demo') === 'y1') return Y1;
  const pack = generatedPack([], seededRandom(seed));
  return keys.map((key, i) => ({ ...pack.questionFor(key, 'focus', { multipleChoice: mc }), id: i + 1 }));
}

function App() {
  const list = questions();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: 16 }}>
      {list.map((q) => (
        <div key={q.id} data-shot={q.factKey} style={{ width: 400 }}>
          <QuestionModal question={q} title="Question" inline scribble={false} onSubmit={() => ({ correct: true, fact: '', boxBefore: 0, boxAfter: 0 })} onDone={() => {}} />
        </div>
      ))}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
