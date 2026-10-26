import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { QuestionContext, SkillPack } from '../../../shared/maths/skillPack';
import type { TopicId } from '../../../shared/maths/skillPacks';
import type { BattleSetup } from '../../../shared/monsters/engine';
import { makeMonster } from '../../../shared/monsters/rules';
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
  it('asks the attacker’s topic at the area’s band, and a right answer attacks', async () => {
    const { user, asked } = setup(wild({ area: 4, far: true }));
    await passMessages(user);
    await user.click(screen.getByRole('button', { name: 'Fight' }));
    await user.click(screen.getByRole('button', { name: /Plus Puddle/ }));
    await answer(user, true);
    // Water = adding and taking away; area 4 = band 3 (see bands.ts).
    expect(asked).toEqual([{ topic: 'add-sub', level: 3, multipleChoice: true }]);
    expect(message()).toMatch(/Plusplash used Plus Puddle!/);
    expect(message()).toMatch(/Quick answer: critical hit!/);
    await passMessages(user);
    expect(message()).toBe('What will Plusplash do?');
  });
});
