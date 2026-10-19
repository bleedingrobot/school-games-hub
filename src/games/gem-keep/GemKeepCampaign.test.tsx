import { spokenLabel } from '../../../shared/maths/banded';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CAMPAIGN } from '../../../shared/gem-keep/levels';
import { AUTO_FOCUS, isFocusKey, packIdOfKey, type MathsFocus } from '../../../shared/maths/focus';
import type { Question } from '../../../shared/maths/skillPack';
import type { GameEngine } from './engine/GameEngine';
import { isUnlocked, loadProgress, totalStars, withKey, withWin } from './progress';
import { GemKeepCampaign, type FinishedLevel } from './ui/GemKeepCampaign';
import { FEEDBACK_MS } from '../../maths/QuestionModal';

const IDS = CAMPAIGN.map((l) => l.id);

// Each Level Key is 10 questions, and the right/wrong message stays up for most of a second after each one. These tests
// are about which questions are asked and what is reported, not that pause (QuestionModal.test covers it), so skip it.
const SHOWN = { ...FEEDBACK_MS };
beforeAll(() => Object.assign(FEEDBACK_MS, { right: 0, wrong: 0 }));
afterAll(() => Object.assign(FEEDBACK_MS, SHOWN));

/** The latest question the game's pack made, so a test can answer ones whose spoken text it can't read (rounding, order of operations). */
const latest: { question: Question | null } = { question: null };
vi.mock('../../../shared/maths/focus', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../shared/maths/focus')>();
  return {
    ...real,
    makeFocusPack: (...args: Parameters<typeof real.makeFocusPack>) => {
      const pack = real.makeFocusPack(...args);
      const next = pack.nextQuestion.bind(pack);
      pack.nextQuestion = (ctx) => {
        const q = next(ctx);
        if (q) latest.question = q;
        return q;
      };
      return pack;
    },
  };
});

function solve(spoken: string): number {
  const [a, op, b, , c] = spoken.replace('?', '').replace('times', '×').replace('equals', '=').split(' ');
  if (c === 'what') return op === '×' ? Number(a) * Number(b) : Number(a) / Number(b);
  return a === 'what' ? Number(c) / Number(b) : Number(c) / Number(a);
}

describe('campaign progress', () => {
  it('keeps the best stars, and a passed Level Key opens the next level', () => {
    let p = withWin({}, 'level-1', 2);
    p = withWin(p, 'level-1', 1);
    expect(p['level-1']).toEqual({ stars: 2, keyPassed: false });
    expect(isUnlocked(p, IDS, 0)).toBe(true);
    expect(isUnlocked(p, IDS, 1)).toBe(false);
    p = withKey(p, 'level-1');
    expect(isUnlocked(p, IDS, 1)).toBe(true);
    expect(isUnlocked(p, IDS, 2)).toBe(false);
    expect(totalStars(withWin(p, 'level-2', 3))).toBe(5);
  });

  it('copes with nothing saved, or junk', () => {
    expect(loadProgress()).toEqual({});
    localStorage.setItem('sgh-gem-keep-progress', '{oops');
    expect(loadProgress()).toEqual({});
  });
});

describe('campaign map', () => {
  it('shows 10 levels; only level 1 is open at first', () => {
    render(<GemKeepCampaign />);
    const stops = within(screen.getByRole('list')).getAllByRole('button');
    expect(stops).toHaveLength(10);
    expect(stops[0]).toBeEnabled();
    expect(stops[0]).toHaveAccessibleName(/Level 1: Crystal Valley\. 0 stars\. Times tables: 2, 5, 10/);
    expect(stops[1]).toBeDisabled();
    expect(stops[1]).toHaveAccessibleName(/Pass level 1's Level Key to open this/);
    expect(screen.getByText(/0 of 30 stars/)).toBeInTheDocument();
  });

  it('win, pass the Level Key, go on to level 2, and the map remembers', async () => {
    const user = userEvent.setup();
    let engine!: GameEngine;
    render(<GemKeepCampaign onEngine={(e) => (engine = e)} />);
    await user.click(screen.getByRole('button', { name: /Level 1: Crystal Valley/ }));
    expect(screen.getByRole('heading', { name: 'Level 1 · Crystal Valley' })).toBeInTheDocument();
    engine.state.phase = 'won';
    engine.state.stars = 3;
    engine.setPaused(false);
    await user.click(await screen.findByRole('button', { name: 'Try the Level Key' }));
    for (let i = 0; i < 10; i++) {
      const fact = await screen.findByLabelText(/equals/);
      await user.keyboard(`${solve(fact.getAttribute('aria-label')!)}{Enter}`);
      await waitFor(() => expect(document.querySelector('.question[data-result]')).toBeNull(), { timeout: 3000 });
    }
    await user.click(await screen.findByRole('button', { name: 'Next level' }, { timeout: 4000 }));
    expect(screen.getByRole('heading', { name: 'Level 2 · Sunny Meadow' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to the map' }));
    expect(screen.getByRole('button', { name: /Level 1: Crystal Valley\. 3 stars/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Level 2: Sunny Meadow/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Level 3: River Bend/ })).toBeDisabled();
    expect(loadProgress()).toEqual({ 'level-1': { stars: 3, keyPassed: true } });
  }, 30_000);

  it('reports each level, Level Key and the maths records, for saving', async () => {
    const user = userEvent.setup();
    let engine!: GameEngine;
    const ended: FinishedLevel[] = [];
    const onKey = vi.fn();
    const onAnswers = vi.fn();
    const onProgress = vi.fn();
    render(
      <GemKeepCampaign
        initialProgress={{}}
        initialFacts={[{ key: 'mul:2x5', attempts: 9, correct: 9, avgMs: 1500, box: 3, lastSeen: 1, quickDays: [] }]}
        onEngine={(e) => (engine = e)}
        onLevelEnd={(l) => ended.push(l)}
        onKey={onKey}
        onAnswers={onAnswers}
        onProgress={onProgress}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Level 1: Crystal Valley/ }));
    engine.state.phase = 'won';
    engine.state.stars = 2;
    engine.state.wave = CAMPAIGN[0].waves.length;
    engine.state.time = 321.4;
    engine.setPaused(false);
    await user.click(await screen.findByRole('button', { name: 'Try the Level Key' }));
    expect(ended).toEqual([
      { levelId: 'level-1', result: 'won', stars: 2, waves: CAMPAIGN[0].waves.length, gameSeconds: 321, asked: 0, right: 0 },
    ]);
    expect(onProgress).toHaveBeenLastCalledWith({ 'level-1': { stars: 2, keyPassed: false } });
    for (let i = 0; i < 10; i++) {
      const fact = await screen.findByLabelText(/equals/);
      await user.keyboard(`${solve(fact.getAttribute('aria-label')!)}{Enter}`);
      await waitFor(() => expect(document.querySelector('.question[data-result]')).toBeNull(), { timeout: 3000 });
    }
    await screen.findByRole('button', { name: 'Next level' }, { timeout: 4000 });
    expect(onKey).toHaveBeenCalledWith('level-1', 10);
    // The 10 Key answers are reported once each, and the records carried on from the saved ones.
    const [answers, facts] = onAnswers.mock.lastCall! as [{ key: string; correct: boolean }[], { attempts: number }[]];
    expect(answers).toHaveLength(10);
    expect(answers.every((a) => a.correct)).toBe(true);
    expect(onAnswers.mock.calls.flatMap((c) => c[0])).toHaveLength(10);
    expect(facts.reduce((n, f) => n + f.attempts, 0)).toBe(19);
    // Nothing goes to this browser's own storage when the progress is saved elsewhere.
    expect(localStorage.getItem('sgh-gem-keep-progress')).toBeNull();
  }, 30_000);
});


/** Reads a question the way a screen reader does ("3 plus what equals 10") and works out the answer. */
function solveSpokenAny(spoken: string): number {
  const t = spoken.replace(/\?$/, '');
  let m = /^(\d+) plus what equals (\d+)$/.exec(t);
  if (m) return +m[2] - +m[1];
  m = /^what plus (\d+) equals (\d+)$/.exec(t);
  if (m) return +m[2] - +m[1];
  m = /^(\d+) plus (\d+) equals what$/.exec(t);
  if (m) return +m[1] + +m[2];
  m = /^(\d+) minus (\d+) equals what$/.exec(t);
  if (m) return +m[1] - +m[2];
  m = /^(\d+) minus what equals (\d+)$/.exec(t);
  if (m) return +m[1] - +m[2];
  m = /^what minus (\d+) equals (\d+)$/.exec(t);
  if (m) return +m[1] + +m[2];
  m = /^Double (\d+) equals what$/.exec(t);
  if (m) return 2 * +m[1];
  m = /^Half of (\d+) equals what$/.exec(t);
  if (m) return +m[1] / 2;
  m = /^(\d+) divided by (\d+) equals what$/.exec(t);
  if (m) return +m[1] / +m[2];
  const out = solve(spoken);
  if (Number.isNaN(out)) throw new Error(`cannot solve: ${spoken}`);
  return out;
}

const teacherFocus = (skills: string[], extra: Partial<MathsFocus> = {}): MathsFocus => ({
  source: 'teacher-class', skills, onlyThese: true, endsAt: '2099-01-01T00:00:00Z', canChoose: true, own: null, ...extra,
});

/** Wins level 1 and plays the Level Key with right answers; returns the keys of the answers reported. */
async function playKey(user: ReturnType<typeof userEvent.setup>, getEngine: () => GameEngine) {
  await user.click(screen.getByRole('button', { name: /Level 1: Crystal Valley/ }));
  const engine = getEngine();
  engine.state.phase = 'won';
  engine.state.stars = 3;
  engine.setPaused(false);
  await user.click(await screen.findByRole('button', { name: 'Try the Level Key' }));
  const asked: string[] = [];
  for (let i = 0; i < 10; i++) {
    // Wait for this question to be the one on screen (not the one just answered).
    await screen.findByText(new RegExp(`Question ${i + 1} of 10`));
    const fact = await screen.findByLabelText(/equals/);
    asked.push(fact.getAttribute('aria-label')!);
    await user.keyboard(`${solveSpokenAny(fact.getAttribute('aria-label')!)}{Enter}`);
    await waitFor(() => expect(document.querySelector('.question[data-result]')).toBeNull(), { timeout: 8000 });
  }
  return asked;
}

describe('Gem Keep with a maths focus', () => {
  it('says on the map why the maths is what it is', () => {
    render(<GemKeepCampaign focus={teacherFocus(['tables-6-9'], { endsAt: '2099-01-01T11:00:00Z' })} />);
    expect(screen.getByText(/Your teacher picked ×6, ×9/)).toBeInTheDocument();
    expect(screen.getByText(/The maths in every level follows this/)).toBeInTheDocument();
  });

  it('shows nothing extra with no focus', () => {
    render(<GemKeepCampaign focus={AUTO_FOCUS} />);
    expect(screen.queryByText(/follows this/)).not.toBeInTheDocument();
  });

  it('picks up a focus set after Gem Keep opened when the next level starts, and not before', async () => {
    const user = userEvent.setup();
    let engine!: GameEngine;
    const loadFocus = vi.fn(async () => teacherFocus(['dbl-half-10']));
    render(<GemKeepCampaign focus={AUTO_FOCUS} loadFocus={loadFocus} onEngine={(e) => (engine = e)} onProgress={vi.fn()} />);
    expect(screen.queryByText(/follows this/)).not.toBeInTheDocument();
    expect(loadFocus).not.toHaveBeenCalled();
    const asked = await playKey(user, () => engine);
    expect(loadFocus).toHaveBeenCalledTimes(1);
    expect(asked.every((a) => /^(Double|Half of|\d+ plus \d+ equals what|\d+ divided by 2 equals what)/.test(a))).toBe(true);
  }, 30_000);

  it('asks the generated skills in the Level Key: choices to tap for order of operations, a point key for tenths, and records them under their question type', async () => {
    const user = userEvent.setup();
    let engine!: GameEngine;
    const onAnswers = vi.fn();
    render(<GemKeepCampaign focus={teacherFocus(['round-big', 'bedmas', 'bonds-100'])} onEngine={(e) => (engine = e)} onProgress={vi.fn()} onAnswers={onAnswers} />);
    await user.click(screen.getByRole('button', { name: /Level 1: Crystal Valley/ }));
    engine.state.phase = 'won';
    engine.state.stars = 3;
    engine.setPaused(false);
    await user.click(await screen.findByRole('button', { name: 'Try the Level Key' }));
    const kinds = new Set<string>();
    for (let i = 0; i < 10; i++) {
      await screen.findByText(new RegExp(`Question ${i + 1} of 10`));
      await waitFor(() => expect(document.querySelector('.question__fact')).not.toBeNull());
      const q = latest.question!;
      kinds.add(q.factKey.split(':')[0]);
      if (q.choices) {
        await user.click(screen.getByRole('button', { name: String(q.answer) }));
      } else {
        expect(Boolean(screen.queryByRole('button', { name: 'Point' }))).toBe(q.input === 'decimal');
        await user.keyboard(`${q.answer}{Enter}`);
      }
      await waitFor(() => expect(document.querySelector('.question[data-result]')).toBeNull(), { timeout: 8000 });
    }
    expect([...kinds].every((k) => ['round', 'bedmas', 'bond100'].includes(k))).toBe(true);
    // Each answer is reported under its question type, ready for the generated pack.
    await waitFor(() => expect(onAnswers).toHaveBeenCalled());
    const keys = onAnswers.mock.calls.flatMap(([answers]) => (answers as { key: string }[]).map((a) => a.key));
    expect(keys.length).toBe(10);
    expect(keys.every((k) => isFocusKey(k) && packIdOfKey(k) === 'generated')).toBe(true);
  }, 60_000);

  it('asks the fraction, decimal and percentage skills in the Level Key: fractions to tap, a point key for decimals, all recorded under their question type', async () => {
    const user = userEvent.setup();
    let engine!: GameEngine;
    const onAnswers = vi.fn();
    const skills = ['unit-fraction-of', 'tenths', 'add-tenths', 'decimal-equivalents', 'percent-basic', 'fraction-of', 'times-decimals', 'equivalent-fractions', 'fdp-equivalents', 'percent-of', 'whole-from-fraction'];
    render(<GemKeepCampaign focus={teacherFocus(skills)} onEngine={(e) => (engine = e)} onProgress={vi.fn()} onAnswers={onAnswers} />);
    await user.click(screen.getByRole('button', { name: /Level 1: Crystal Valley/ }));
    engine.state.phase = 'won';
    engine.state.stars = 3;
    engine.setPaused(false);
    await user.click(await screen.findByRole('button', { name: 'Try the Level Key' }));
    for (let i = 0; i < 10; i++) {
      await screen.findByText(new RegExp(`Question ${i + 1} of 10`));
      await waitFor(() => expect(document.querySelector('.question__fact')).not.toBeNull());
      const q = latest.question!;
      if (q.choices) {
        const label = q.choiceLabels ? spokenLabel(q.choiceLabels[q.answer]) : String(q.answer);
        await user.click(screen.getByRole('button', { name: label }));
      } else {
        expect(Boolean(screen.queryByRole('button', { name: 'Point' }))).toBe(q.input === 'decimal');
        await user.keyboard(`${q.answer}{Enter}`);
      }
      await waitFor(() => expect(document.querySelector('.question[data-result]')).toBeNull(), { timeout: 8000 });
    }
    await waitFor(() => expect(onAnswers).toHaveBeenCalled());
    const answers = onAnswers.mock.calls.flatMap(([a]) => a as { key: string; correct: boolean }[]);
    expect(answers.length).toBe(10);
    expect(answers.every((a) => isFocusKey(a.key) && packIdOfKey(a.key) === 'generated' && a.correct)).toBe(true);
  }, 60_000);

  it('keeps the focus it has when the lookup fails', async () => {
    const user = userEvent.setup();
    let engine!: GameEngine;
    const loadFocus = vi.fn(async () => {
      throw new Error('offline');
    });
    render(<GemKeepCampaign focus={teacherFocus(['dbl-half-10'])} loadFocus={loadFocus} onEngine={(e) => (engine = e)} onProgress={vi.fn()} />);
    const asked = await playKey(user, () => engine);
    expect(loadFocus).toHaveBeenCalled();
    expect(asked.every((a) => /^(Double|Half of|\d+ plus \d+ equals what|\d+ divided by 2 equals what)/.test(a))).toBe(true);
  }, 30_000);

  it('drops a teacher focus that has already ended (a copy kept for offline play)', async () => {
    const user = userEvent.setup();
    let engine!: GameEngine;
    render(<GemKeepCampaign focus={teacherFocus(['dbl-half-10'], { endsAt: '2020-01-01T00:00:00Z' })} onEngine={(e) => (engine = e)} onProgress={vi.fn()} />);
    expect(screen.queryByText(/follows this/)).not.toBeInTheDocument();
    const asked = await playKey(user, () => engine);
    expect(asked.every((a) => /times|divided/.test(a) || /equals/.test(a))).toBe(true);
    expect(asked.some((a) => /^Double|^Half of/.test(a))).toBe(false);
  }, 30_000);

  describe('on auto (the class has the switch on)', () => {
    const autoFocus = (furthest: string | null, extra: Partial<MathsFocus> = {}): MathsFocus => ({
      ...AUTO_FOCUS,
      ladder: { on: true, placed: null, placement: null, furthest },
      ...extra,
    });

    it('asks from the whole ladder, from the student’s place: early facts for a new student', async () => {
      const user = userEvent.setup();
      let engine!: GameEngine;
      render(<GemKeepCampaign focus={autoFocus(null)} onEngine={(e) => (engine = e)} onProgress={vi.fn()} />);
      const asked = await playKey(user, () => engine);
      // Number facts to 10 are the main questions at the start; a few review/stretch come from the next skill up.
      expect(asked.filter((a) => /plus|minus/.test(a)).length).toBeGreaterThanOrEqual(6);
      expect(asked.some((a) => /times/.test(a))).toBe(false);
    }, 30_000);

    it('asks times tables for a student whose place is on a times-table skill', async () => {
      const user = userEvent.setup();
      let engine!: GameEngine;
      render(<GemKeepCampaign focus={autoFocus('tables-3-4-8')} onEngine={(e) => (engine = e)} onProgress={vi.fn()} />);
      const asked = await playKey(user, () => engine);
      expect(asked.filter((a) => /times|divided/.test(a)).length).toBeGreaterThanOrEqual(6);
    }, 30_000);

    it('keeps the campaign’s own tables with the switch off', async () => {
      const user = userEvent.setup();
      let engine!: GameEngine;
      render(<GemKeepCampaign focus={{ ...AUTO_FOCUS, ladder: { ...autoFocus(null).ladder!, on: false } }} onEngine={(e) => (engine = e)} onProgress={vi.fn()} />);
      const asked = await playKey(user, () => engine);
      expect(asked.every((a) => /times/.test(a))).toBe(true);
    }, 30_000);

    it('lets a teacher’s focus win over auto', async () => {
      const user = userEvent.setup();
      let engine!: GameEngine;
      render(<GemKeepCampaign focus={autoFocus('tables-3-4-8', teacherFocus(['dbl-half-10']))} onEngine={(e) => (engine = e)} onProgress={vi.fn()} />);
      const asked = await playKey(user, () => engine);
      expect(asked.every((a) => /^(Double|Half of|\d+ plus \d+ equals what|\d+ divided by 2 equals what)/.test(a))).toBe(true);
    }, 30_000);

    it('picks up auto being turned on when the next level starts', async () => {
      const user = userEvent.setup();
      let engine!: GameEngine;
      const loadFocus = vi.fn(async () => autoFocus(null));
      render(<GemKeepCampaign focus={AUTO_FOCUS} loadFocus={loadFocus} onEngine={(e) => (engine = e)} onProgress={vi.fn()} />);
      const asked = await playKey(user, () => engine);
      expect(asked.some((a) => /plus|minus/.test(a))).toBe(true);
    }, 30_000);
  });
});
