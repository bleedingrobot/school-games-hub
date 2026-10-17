import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { QuestionContext, SkillPack } from '../../../../shared/maths/skillPack';
import type { TopicId } from '../../../../shared/maths/skillPacks';
import { WalkPage } from '../../../../preview/monsters/WalkPage';
import { WorldGame } from './WorldGame';
import { WORLD_MAPS } from '../../../../shared/monsters/maps';
import { makeMonster, maxHpOf } from '../../../../shared/monsters/rules';
import { newWorld, type WorldOptions } from '../../../../shared/monsters/world/world';
import { DEFAULT_MONSTER_SETTINGS } from '../settings';
import type { WorldSettings } from './settings';

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
const talkText = () => document.querySelector('.mw-talk__text')?.textContent ?? '';

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
  it('starts with a small start box, and then you are in the home town with two level-5 monsters', async () => {
    const user = userEvent.setup();
    render(<WalkPage testing={{ packFor, timeScale: 0 }} />);
    expect(screen.getByRole('heading', { name: 'Walk around' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Monster 1'), 'leaf');
    await user.selectOptions(screen.getByLabelText('Monster 2'), 'ice');
    await user.click(screen.getByRole('button', { name: 'Start walking' }));
    expect(where()).toMatchObject({ map: 'harbour-town', x: 11, y: 15 });
    const team = screen.getByRole('list', { name: 'Your team' });
    expect(within(team).getAllByRole('listitem').map((li) => li.getAttribute('aria-label'))).toEqual([
      'Digibud, level 5, full health',
      'Divvy, level 5, full health',
    ]);
    expect(screen.getByText('You are in Harbour Town.')).toBeInTheDocument();
  });

  it('walks a step, turns on the spot, and is stopped by a wall', async () => {
    const user = userEvent.setup();
    await startWalking(user);
    press('ArrowUp');
    await waitFor(() => expect(where().y).toBe(14));
    press('ArrowLeft'); // a new way: only turns
    await waitFor(() => expect(where().facing).toBe('left'));
    expect(where().x).toBe(11);
    press('a');
    await waitFor(() => expect(where().x).toBe(10));
    press('ArrowDown');
    press('ArrowDown');
    await waitFor(() => expect(where().y).toBe(15));
    press('s'); // (10,16) is free; (10,17) is the edge of the map
    await waitFor(() => expect(where().y).toBe(16));
    press('s');
    press('s');
    expect(where().y).toBe(16);
  });

  it('talks to a sign and to the teacher: the words are in a live region, one tap on Next at a time', async () => {
    const user = userEvent.setup();
    await startWalking(user);
    expect(document.querySelector('.mw-talk__text')).toHaveAttribute('aria-live', 'polite');
    press('ArrowRight'); // turn: the teacher is at (13,15), two to the right
    await waitFor(() => expect(where().facing).toBe('right'));
    press('ArrowRight');
    await waitFor(() => expect(where().x).toBe(12));
    press(' ');
    await waitFor(() => expect(talkText()).toMatch(/^Teacher: Hello! I am your teacher/));
    // Walking waits while the box is open.
    press('ArrowUp');
    expect(where().y).toBe(15);
    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toHaveFocus();
    await user.click(next);
    expect(talkText()).toMatch(/Every monster stands for one kind of maths/);
    await user.keyboard(' '); // Space on the focused button goes on
    expect(talkText()).toMatch(/In a battle/);
    for (let i = 0; i < 20 && screen.queryByRole('button', { name: 'Next' }); i++) await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(talkText()).toBe('');
    press('ArrowUp'); // turns first
    press('ArrowUp');
    await waitFor(() => expect(where().y).toBe(14)); // walking again
  });

  it('settings: Calm, choose answers and on-screen arrows (off at first)', async () => {
    const user = userEvent.setup();
    await startWalking(user);
    expect(screen.queryByRole('button', { name: 'Walk up' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const box = screen.getByRole('dialog', { name: 'Settings' });
    await user.click(within(box).getByLabelText(/On-screen arrows/));
    await user.click(within(box).getByLabelText(/Calm/));
    await user.click(within(box).getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('button', { name: 'Walk up' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Talk' })).toBeInTheDocument();
    // The arrows work (the keyboard can press them too).
    await user.click(screen.getByRole('button', { name: 'Walk up' }));
    await waitFor(() => expect(where().y).toBe(14));
    expect(localStorage.getItem('sgh-monsters-dpad')).toBe('1');
    expect(JSON.parse(localStorage.getItem('sgh-monsters-settings')!)).toMatchObject({ calm: true });
  });

  it('teleports, and "More battles" makes the grass start a battle within 3 steps; a win comes back to the map', async () => {
    const user = userEvent.setup();
    await startWalking(user);
    await user.selectOptions(screen.getByLabelText('Teleport to'), 'Next to the long grass');
    await user.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() => expect(where()).toMatchObject({ map: 'kauri-bush', x: 12, y: 15 }));
    await user.click(screen.getByLabelText(/More battles/));
    for (let i = 0; i < 3; i++) press('ArrowRight');
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

describe('losing', () => {
  const settings: WorldSettings = { ...DEFAULT_MONSTER_SETTINGS, multipleChoice: true, dpad: false };
  it('wakes you up at the healing centre, team healed, nothing lost', async () => {
    const user = userEvent.setup();
    const opts: WorldOptions = { maps: WORLD_MAPS };
    const weak = makeMonster('plusplash-1', 1);
    weak.hp = 1;
    const start = newWorld(opts, [weak], 5);
    const initial = { ...start, map: 'kauri-bush', x: 3, y: 5, facing: 'right' as const, grassSteps: 1, bag: { potion: 2, ball: 3 } };
    render(<WorldGame initial={initial} settings={settings} onSettingsChange={() => {}} packFor={packFor} timeScale={0} random={() => 0.5} />);
    press('ArrowRight');
    await screen.findByText(/A wild .* appeared!/);
    await passMessages(user);
    // Wrong answers only: a graze at best, and the wild monster hits back.
    for (let round = 0; round < 40 && !screen.queryByRole('button', { name: 'Continue' }); round++) {
      const fight = screen.queryByRole('button', { name: 'Fight' });
      if (!fight) {
        await passMessages(user);
        continue;
      }
      await user.click(fight);
      await user.click(screen.getAllByRole('button', { name: /power/ })[0]);
      const q = await screen.findByRole('dialog', { name: /./ });
      await user.click(within(q).getByRole('button', { name: '3' }));
      await passMessages(user);
    }
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(where()).toMatchObject({ map: 'healing-centre', x: 4, y: 3 }));
    expect(talkText()).toMatch(/Your team is tired.*nothing was lost/);
    const li = screen.getByRole('list', { name: 'Your team' }).querySelector('li')!;
    expect(li).toHaveAttribute('aria-label', 'Plusplash, level 1, full health');
    expect(maxHpOf(weak)).toBeGreaterThan(1);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    // The nurse is right in front of you now.
    press(' ');
    await waitFor(() => expect(talkText()).toMatch(/^Nurse Joy: Welcome to the Healing Centre/));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(talkText()).toMatch(/fully rested/);
  });
});
