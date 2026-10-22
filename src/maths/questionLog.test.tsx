import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildQuestion } from '../../shared/maths/practical';
import type { AnswerResult, Question } from '../../shared/maths/skillPack';
import { PracticalAsk } from './PracticalAsk';
import { QuestionModal } from './QuestionModal';
import { MIN_SHOWN_MS, noteQuestion, setQuestionSink, spotFromTitle, type QuestionSink } from './questionLog';

const question = (id = 1): Question => ({
  id,
  skill: 'times-tables',
  factKey: 'mul:7x8',
  kind: 'multiply',
  parts: ['7', '×', '8', '=', '?'],
  spoken: '7 times 8 equals what?',
  answer: 56,
  band: 'focus',
});
const marked = (answer: number): AnswerResult => ({ correct: answer === 56, fact: '7 × 8 = 56', boxBefore: 0, boxAfter: 1 });

let now = 0;
let notes: Parameters<QuestionSink>[0][] = [];
beforeEach(() => {
  now = 1000;
  notes = [];
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  setQuestionSink((n) => notes.push(n));
});
afterEach(() => {
  setQuestionSink(null);
  vi.restoreAllMocks();
});
const seen = () => notes.map((n) => `${n.spot}:${n.skipped ? 'skipped' : 'answered'}`);

describe('spotFromTitle', () => {
  it('keeps the kind of question and leaves out numbers and details', () => {
    expect(spotFromTitle('Pit stop')).toBe('Pit stop');
    expect(spotFromTitle('Power-up pad: Shield')).toBe('Power-up pad');
    expect(spotFromTitle('Question 3 of 10')).toBe('Question of');
    expect(spotFromTitle('12')).toBe('Question');
    expect(spotFromTitle('x'.repeat(60))).toHaveLength(40);
  });
});

describe('noteQuestion', () => {
  it('does nothing with no sink, and never breaks the game if the sink throws', () => {
    setQuestionSink(null);
    expect(() => noteQuestion({ spot: 'a', skipped: true, ms: 5000 })).not.toThrow();
    setQuestionSink(() => {
      throw new Error('full');
    });
    expect(() => noteQuestion({ spot: 'a', skipped: false, ms: 5000 })).not.toThrow();
  });

  it('ignores a skip of a box that was barely on screen', () => {
    noteQuestion({ spot: 'a', skipped: true, ms: MIN_SHOWN_MS - 1 });
    noteQuestion({ spot: 'a', skipped: false, ms: 10 });
    expect(seen()).toEqual(['a:answered']);
  });
});

describe('the question box notes each question once', () => {
  it('an answer is noted once, even if the server makes the student try again', async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error('No Wi-Fi')).mockResolvedValue(marked(56));
    const { unmount } = render(<QuestionModal question={question()} title="Rescue" onSubmit={onSubmit} onDone={() => {}} timeScale={0} />);
    now += 2000;
    await userEvent.keyboard('56{Enter}');
    await screen.findByText('No Wi-Fi');
    await userEvent.keyboard('{Enter}');
    await screen.findByText('Correct!');
    unmount();
    expect(seen()).toEqual(['Rescue:answered']);
    expect(notes[0].ms).toBe(2000);
  });

  it('the skip button and Escape are skips', async () => {
    const onClose = vi.fn();
    const { unmount } = render(<QuestionModal question={question()} title="Pit stop" onSubmit={marked} onDone={() => {}} onClose={onClose} closeLabel="Skip" />);
    now += 1500;
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onClose).toHaveBeenCalled();
    unmount(); // the game takes the box away
    expect(seen()).toEqual(['Pit stop:skipped']);
    expect(notes[0].ms).toBe(1500);

    notes = [];
    const second = render(<QuestionModal question={question(2)} title="Pit stop" onSubmit={marked} onDone={() => {}} onClose={() => second.unmount()} />);
    now += 1500;
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(seen()).toEqual(['Pit stop:skipped']);
  });

  it('a box the game takes away (the time ran out, the player rolled) is a skip; one barely seen is not', () => {
    const first = render(<QuestionModal question={question()} title="Mission Control" spot="Charge" onSubmit={marked} onDone={() => {}} inline />);
    now += 100;
    first.unmount();
    expect(notes).toEqual([]);
    const second = render(<QuestionModal question={question(2)} title="Mission Control" spot="Charge" onSubmit={marked} onDone={() => {}} inline />);
    now += 5000;
    second.unmount();
    expect(seen()).toEqual(['Charge:skipped']);
  });

  it('a new question in the same box: the old one counts as skipped unless it was answered', async () => {
    const { rerender, unmount } = render(<QuestionModal question={question(1)} title="Mana Well" onSubmit={marked} onDone={() => {}} timeScale={0} />);
    now += 1000;
    await userEvent.keyboard('56{Enter}');
    rerender(<QuestionModal question={question(2)} title="Mana Well" onSubmit={marked} onDone={() => {}} timeScale={0} />);
    now += 1000;
    rerender(<QuestionModal question={question(3)} title="Mana Well" onSubmit={marked} onDone={() => {}} timeScale={0} />);
    now += 1000;
    unmount();
    expect(seen()).toEqual(['Mana Well:answered', 'Mana Well:skipped', 'Mana Well:skipped']);
  });
});

describe('PracticalAsk notes its questions too', () => {
  it('an answer, then "No thanks", then a box taken away', async () => {
    const q = buildQuestion('percent-of', [10, 80]);
    const first = render(<PracticalAsk question={q} title="Battle Cry!" onSubmit={() => {}} onNoThanks={() => {}} />);
    now += 1000;
    await userEvent.keyboard('8{Enter}');
    first.unmount();

    const second = render(<PracticalAsk question={buildQuestion('percent-of', [20, 50])} title="Battle Cry!" onSubmit={() => {}} onNoThanks={() => {}} />);
    now += 1000;
    await userEvent.click(screen.getByRole('button', { name: 'No thanks' }));
    second.unmount();

    const third = render(<PracticalAsk question={buildQuestion('percent-of', [30, 50])} title="How many barracks?" onSubmit={() => {}} />);
    now += 1000;
    third.unmount();
    expect(seen()).toEqual(['Battle Cry!:answered', 'Battle Cry!:skipped', 'How many barracks?:skipped']);
  });
});

describe('right answers in a row', () => {
  const answerRight = async (id: number) => {
    const { unmount } = render(<QuestionModal question={question(id)} title="Rescue" onSubmit={marked} onDone={() => {}} timeScale={0} />);
    now += 1000;
    await userEvent.keyboard('56{Enter}');
    const shown = screen.queryByText(/in a row!/)?.textContent ?? null;
    unmount();
    return shown;
  };

  it('cheers from the third right answer, and a wrong answer or a skip starts again', async () => {
    // Earlier tests may have left a run going: a wrong answer clears it.
    const first = render(<QuestionModal question={question(90)} title="Rescue" onSubmit={marked} onDone={() => {}} timeScale={0} />);
    await userEvent.keyboard('1{Enter}');
    first.unmount();
    expect(await answerRight(91)).toBeNull();
    expect(await answerRight(92)).toBeNull();
    expect(await answerRight(93)).toBe(' 🔥 3 in a row!');
    expect(await answerRight(94)).toBe(' 🔥 4 in a row!');
    // A skip (the box taken away after a while, no answer).
    const skipped = render(<QuestionModal question={question(95)} title="Rescue" onSubmit={marked} onDone={() => {}} />);
    now += 2000;
    skipped.unmount();
    expect(await answerRight(96)).toBeNull();
  });
});
