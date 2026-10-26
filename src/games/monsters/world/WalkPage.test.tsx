import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { QuestionContext, SkillPack } from '../../../../shared/maths/skillPack';
import type { TopicId } from '../../../../shared/maths/skillPacks';
import { WalkPage } from '../../../../preview/monsters/WalkPage';

/** A pretend maths pack: every question is 2 + 2 and the right choice is 4. */
const packFor = (topic: TopicId) =>
  ({
    id: topic, label: topic, curriculumTags: [],
    nextQuestion: (_c: QuestionContext) => ({ id: 1, skill: topic, factKey: 'k', kind: 'k', parts: ['2', '+', '2', '=', '?'], spoken: '2 plus 2', answer: 4, choices: [3, 4, 5, 6], band: 1 }),
    recordAnswer: (_q: unknown, answer: number) => ({ correct: answer === 4, fact: '2 + 2 = 4', boxBefore: 1, boxAfter: 2 }),
  }) as unknown as SkillPack;

const stage = () => screen.getByTestId('mw-stage');
const where = () => ({ map: stage().dataset.map, x: Number(stage().dataset.x), y: Number(stage().dataset.y), facing: stage().dataset.facing });
const press = (key: string) => act(() => { fireEvent.keyDown(window, { key }); fireEvent.keyUp(window, { key }); });

async function passMessages(user: ReturnType<typeof userEvent.setup>) {
  for (let i = 0; i < 60; i++) {
    const next = screen.queryByRole('button', { name: /Next/ });
    if (!next) return;
    await user.click(next);
  }
  throw new Error('Messages never ended');
}

async function startWalking(user: ReturnType<typeof userEvent.setup>) {
  render(<WalkPage testing={{ packFor, timeScale: 0, random: () => 0.5 }} />);
  await user.click(screen.getByRole('button', { name: 'Start walking' }));
}

describe('the Walk around test page', () => {
  it('teleports, and "More battles" makes the grass start a battle within 3 steps; a win comes back to the map', async () => {
    const user = userEvent.setup();
    await startWalking(user);
    await user.selectOptions(screen.getByLabelText('Teleport to'), 'Area 1: Kauri Bush: Next to the long grass');
    await user.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() => expect(where()).toMatchObject({ map: 'kauri-bush', x: 17, y: 14 }));
    await user.click(screen.getByLabelText(/More battles/));
    for (let i = 0; i < 3; i++) press('ArrowDown');
    await screen.findByText(/A wild .* appeared!/);
    await passMessages(user);
    // Fight with the first move until it is over.
    for (let round = 0; round < 12 && !screen.queryByRole('button', { name: 'Continue' }); round++) {
      const fight = screen.queryByRole('button', { name: 'Fight' });
      if (!fight) {
        await passMessages(user);
        continue;
      }
      await user.click(fight);
      await user.click(screen.getAllByRole('button', { name: /power/ })[1]);
      const q = await screen.findByRole('dialog', { name: /./ });
      await user.click(within(q).getByRole('button', { name: '4' }));
      await passMessages(user);
    }
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByTestId('mw-stage')).toBeInTheDocument();
    expect(where().map).toBe('kauri-bush');
    expect(screen.getByRole('list', { name: 'Your team' }).querySelectorAll('li').length).toBeGreaterThanOrEqual(2);
  });
});
