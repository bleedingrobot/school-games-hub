import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { QuestionContext, SkillPack } from '../../../shared/maths/skillPack';
import type { TopicId } from '../../../shared/maths/skillPacks';
import type { BattleSetup } from '../../../shared/monsters/engine';
import { makeMonster, maxHpOf } from '../../../shared/monsters/rules';
import { BattleScreen, type BattleResult } from './BattleScreen';
import type { MonsterSettings } from './settings';

const choose: MonsterSettings = { calm: false, multipleChoice: true };

/** A pretend maths pack: every question is 2 + 2, so tests know the answer (4). */
function fakePacks() {
  const asked: { topic: TopicId; level?: number; multipleChoice?: boolean }[] = [];
  let n = 0;
  const packFor = (topic: TopicId) =>
    ({
      id: topic,
      label: topic,
      curriculumTags: [],
      nextQuestion: (ctx: QuestionContext) => {
        asked.push({ topic, level: ctx.level, multipleChoice: ctx.multipleChoice });
        return { id: ++n, skill: topic, factKey: 'k', kind: 'k', parts: ['2', '+', '2', '=', '?'], spoken: '2 plus 2', answer: 4, choices: [3, 4, 5, 6], band: 1 };
      },
      recordAnswer: (_q: unknown, answer: number) => ({ correct: answer === 4, fact: '2 + 2 = 4', boxBefore: 1, boxAfter: 2 }),
    }) as unknown as SkillPack;
  return { asked, packFor };
}

const wild = (over: Partial<BattleSetup> = {}): BattleSetup => ({
  kind: 'wild',
  area: 1,
  team: [makeMonster('plusplash-1', 10), makeMonster('factorch-1', 10)],
  bag: { potion: 2, ball: 3 },
  foes: [makeMonster('digibud-1', 5)],
  ...over,
});

function setup(s: BattleSetup, settings: MonsterSettings = choose, random = () => 0.5) {
  const user = userEvent.setup();
  const packs = fakePacks();
  const onFinish = vi.fn<(r: BattleResult) => void>();
  render(<BattleScreen setup={s} settings={settings} onFinish={onFinish} random={random} packFor={packs.packFor} timeScale={0} />);
  return { user, onFinish, ...packs };
}

/** Taps Next through the messages until the menu (or a sheet) shows. */
async function passMessages(user: ReturnType<typeof userEvent.setup>) {
  for (let i = 0; i < 40; i++) {
    const next = screen.queryByRole('button', { name: /Next/ });
    if (!next) return;
    await user.click(next);
  }
  throw new Error('Messages never ended');
}
const message = () => screen.getByTestId('message').textContent ?? '';
async function answer(user: ReturnType<typeof userEvent.setup>, right: boolean) {
  const box = await screen.findByRole('dialog', { name: /./ });
  await user.click(within(box).getByRole('button', { name: right ? '4' : '3' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: /Choose|./ })).not.toBeInTheDocument());
}

describe('the battle screen', () => {
  it('opens with the wild monster and both name cards, then shows the menu', async () => {
    const { user } = setup(wild());
    expect(message()).toBe('A wild Digibud appeared!');
    expect(screen.getByText('Digibud', { selector: '.mb-card__name' })).toBeInTheDocument();
    expect(screen.getByText('Plusplash', { selector: '.mb-card__name' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Plusplash health' })).toHaveAttribute('aria-valuenow', String(maxHpOf(makeMonster('plusplash-1', 10))));
    expect(screen.getByRole('progressbar', { name: 'Plusplash experience' })).toBeInTheDocument();
    await passMessages(user);
    expect(message()).toBe('What will Plusplash do?');
    for (const name of ['Fight', 'Team', 'Bag', 'Run']) expect(screen.getByRole('button', { name })).toBeInTheDocument();
    expect(screen.getByTestId('message').closest('[aria-live], p')).toHaveAttribute('aria-live', 'polite');
  });

  it('asks the attacker’s topic at the area’s band, and a right answer attacks', async () => {
    const { user, asked } = setup(wild({ area: 4, far: true }));
    await passMessages(user);
    await user.click(screen.getByRole('button', { name: 'Fight' }));
    // Plusplash's moves are listed with their power and type.
    expect(screen.getByRole('button', { name: /Splash Add/ })).toHaveTextContent('Water · power 35');
    await user.click(screen.getByRole('button', { name: /Plus Puddle/ }));
    await answer(user, true);
    // Water = adding and taking away; area 4 = band 3 (see bands.ts).
    expect(asked).toEqual([{ topic: 'add-sub', level: 3, multipleChoice: true }]);
    expect(message()).toMatch(/Plusplash used Plus Puddle!/);
    expect(message()).toMatch(/Quick answer: critical hit!/);
    await passMessages(user);
    expect(message()).toBe('What will Plusplash do?');
  });

  it('works from the keyboard: 1 for Fight, 2 for the second move', async () => {
    const { user, asked } = setup(wild());
    await passMessages(user);
    await user.keyboard('1');
    expect(message()).toBe('Choose a move.');
    await user.keyboard('2');
    await screen.findByRole('dialog');
    expect(asked).toHaveLength(1);
  });

  it('Calm switches the quick bonus off', async () => {
    const { user } = setup(wild(), { calm: true, multipleChoice: true });
    await passMessages(user);
    await user.click(screen.getByRole('button', { name: 'Fight' }));
    await user.click(screen.getByRole('button', { name: /Splash Add/ }));
    expect(screen.queryByText(/hits extra hard/)).not.toBeInTheDocument();
    await answer(user, true);
    expect(message()).toMatch(/Plusplash used Splash Add!/);
    expect(message()).not.toMatch(/critical/);
  });

  it('after a wrong answer, the right answer is in the message and the hit is small', async () => {
    const { user } = setup(wild());
    await passMessages(user);
    await user.keyboard('1');
    await user.keyboard('1');
    await answer(user, false);
    expect(message()).toMatch(/Not quite: 2 \+ 2 = 4\. A small hit\./);
    expect(message()).not.toMatch(/critical/);
  });

  it('switches monsters from the team list', async () => {
    const { user } = setup(wild());
    await passMessages(user);
    await user.click(screen.getByRole('button', { name: 'Team' }));
    const team = screen.getByRole('dialog', { name: 'Your team' });
    expect(within(team).getByRole('button', { name: 'Switch to Plusplash' })).toBeDisabled();
    expect(within(team).getAllByText(/\/ \d+ health/, { selector: '.mb-team__hp' })).toHaveLength(2);
    await user.click(within(team).getByRole('button', { name: 'Switch to Factorch' }));
    expect(message()).toBe('Go, Factorch!');
    await passMessages(user);
    expect(message()).toBe('What will Factorch do?');
  });

  it('uses a potion on a hurt monster', async () => {
    const hurt = makeMonster('plusplash-1', 10);
    hurt.hp = 5;
    const { user } = setup(wild({ team: [hurt, makeMonster('factorch-1', 10)] }));
    await passMessages(user);
    await user.click(screen.getByRole('button', { name: 'Bag' }));
    expect(screen.getByRole('button', { name: /Potion/ })).toHaveTextContent('×2');
    await user.click(screen.getByRole('button', { name: /^Potion/ }));
    const list = screen.getByRole('dialog', { name: /Use Potion on/ });
    expect(within(list).getByRole('button', { name: 'Heal Factorch' })).toBeDisabled();
    await user.click(within(list).getByRole('button', { name: 'Heal Plusplash' }));
    expect(message()).toMatch(/Plusplash got better \(\+40 health\)/);
    await passMessages(user);
    await user.click(screen.getByRole('button', { name: 'Bag' }));
    expect(screen.getByRole('button', { name: /^Potion/ })).toHaveTextContent('×1');
  });

  it('catches with a question from the wild monster’s topic', async () => {
    const { user, asked, onFinish } = setup(wild(), choose, () => 0.01);
    await passMessages(user);
    await user.click(screen.getByRole('button', { name: 'Bag' }));
    await user.click(screen.getByRole('button', { name: /^Ball/ }));
    await answer(user, true);
    // Digibud is a Leaf: place value and rounding.
    expect(asked).toEqual([{ topic: 'place-value', level: 1, multipleChoice: true }]);
    expect(message()).toMatch(/worked/);
    await passMessages(user);
    const end = screen.getByRole('dialog', { name: 'Caught!' });
    expect(within(end).getByText(/Digibud is yours/)).toBeInTheDocument();
    await user.click(within(end).getByRole('button', { name: 'Continue' }));
    const result = onFinish.mock.calls[0][0];
    expect(result.outcome).toBe('caught');
    expect(result.team.map((m) => m.species)).toContain('digibud-1');
    expect(result.bag.ball).toBe(2);
  });

  it('runs away from a wild monster, but trainers cannot be run from or caught', async () => {
    const a = setup(wild());
    await passMessages(a.user);
    await a.user.click(screen.getByRole('button', { name: 'Run' }));
    expect(message()).toMatch(/got away/);
    await passMessages(a.user);
    await a.user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(a.onFinish.mock.calls[0][0].outcome).toBe('ran');
  });

  it('has no Run button against a trainer, and balls are switched off', async () => {
    const { user } = setup(wild({ kind: 'trainer', foes: [makeMonster('digibud-1', 5), makeMonster('roundroot-1', 5)] }));
    await passMessages(user);
    expect(screen.queryByRole('button', { name: 'Run' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bag' }));
    expect(screen.getByRole('button', { name: /^Ball/ })).toBeDisabled();
  });

  it('wins: exp, a level up and an evolution, then the results sheet', async () => {
    const ready = makeMonster('plusplash-1', 15);
    ready.exp = 15 ** 2.5 + 0; // so close that this battle levels it, and level 16 grows it
    ready.exp = Math.round(16 ** 2.5) - 1;
    const { user, onFinish } = setup(wild({ team: [ready], foes: [makeMonster('digibud-1', 3)] }));
    await passMessages(user);
    await user.keyboard('1');
    await user.keyboard('2');
    await answer(user, true);
    const seen: string[] = [message()];
    for (let i = 0; i < 30 && screen.queryByRole('button', { name: /Next/ }); i++) {
      await user.click(screen.getByRole('button', { name: /Next/ }));
      seen.push(message());
    }
    expect(seen.some((m) => /was beaten/.test(m))).toBe(true);
    expect(seen.some((m) => /gained \d+ exp/.test(m))).toBe(true);
    expect(seen.some((m) => /grew to level 16/.test(m))).toBe(true);
    expect(seen.some((m) => /What\? Plusplash is changing/.test(m))).toBe(true);
    expect(seen.some((m) => /grew into Sumsplash/.test(m))).toBe(true);
    const end = screen.getByRole('dialog', { name: 'You won!' });
    expect(within(end).getByText(/grew into Sumsplash/)).toBeInTheDocument();
    await user.click(within(end).getByRole('button', { name: 'Continue' }));
    const result = onFinish.mock.calls[0][0];
    expect(result.outcome).toBe('won');
    expect(result.team[0].species).toBe('plusplash-2');
  });

  it('Skip jumps to the end of the messages', async () => {
    const { user } = setup(wild());
    await passMessages(user);
    await user.keyboard('1');
    await user.keyboard('1');
    await answer(user, true);
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(message()).toBe('What will Plusplash do?');
  });

  it('forces a new monster after one is tired, and heals everyone after a loss', async () => {
    const weak = makeMonster('plusplash-1', 1);
    const weak2 = makeMonster('factorch-1', 1);
    const strong = makeMonster('digibud-3', 40);
    const { user, onFinish } = setup(wild({ team: [weak, weak2], foes: [strong] }), choose, () => 0.5);
    await passMessages(user);
    await user.keyboard('1');
    await user.keyboard('1');
    await answer(user, true);
    await passMessages(user);
    // The first monster is tired: choose the next one (no Back button).
    const sheet = screen.getByRole('dialog', { name: 'Choose your next monster' });
    expect(within(sheet).queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Send out Plusplash' })).toBeDisabled();
    await user.click(within(sheet).getByRole('button', { name: 'Send out Factorch' }));
    expect(message()).toBe('Go, Factorch!');
    await passMessages(user);
    await user.keyboard('1');
    await user.keyboard('1');
    await answer(user, true);
    await passMessages(user);
    const end = screen.getByRole('dialog', { name: 'Your team is tired' });
    expect(within(end).getByText(/healed, and you keep everything/)).toBeInTheDocument();
    await user.click(within(end).getByRole('button', { name: 'Continue' }));
    const result = onFinish.mock.calls[0][0];
    expect(result.outcome).toBe('lost');
    expect(result.team.every((m) => m.hp === maxHpOf(m))).toBe(true);
  });

  it('steps a three-monster trainer battle through each new monster', async () => {
    const { user } = setup(wild({ kind: 'trainer', team: [makeMonster('plusplash-3', 40)], foes: [makeMonster('digibud-1', 2), makeMonster('roundroot-1', 2)] }));
    expect(message()).toMatch(/A trainer wants to battle/);
    await passMessages(user);
    await user.keyboard('1');
    await user.keyboard('4');
    await answer(user, true);
    const seen: string[] = [];
    for (let i = 0; i < 20 && screen.queryByRole('button', { name: /Next/ }); i++) {
      seen.push(message());
      await user.click(screen.getByRole('button', { name: /Next/ }));
    }
    expect(seen.some((m) => /send out Roundroot/.test(m))).toBe(true);
    expect(screen.getByText('Roundroot', { selector: '.mb-card__name' })).toBeInTheDocument();
  });

  it('saves the Calm and multiple choice settings when no settings are passed in', async () => {
    const user = userEvent.setup();
    const packs = fakePacks();
    render(<BattleScreen setup={wild()} onFinish={() => {}} packFor={packs.packFor} timeScale={0} />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('checkbox', { name: /Calm/ }));
    await user.click(screen.getByRole('checkbox', { name: /Multiple choice/ }));
    expect(JSON.parse(localStorage.getItem('sgh-monsters-settings')!)).toEqual({ calm: true, multipleChoice: true });
  });
});
