import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { WORLD_MAPS } from '../../../../shared/monsters/maps';
import { makeMonster, maxHpOf } from '../../../../shared/monsters/rules';
import type { WorldState } from '../../../../shared/monsters/world/types';
import { newWorld, refreshBook, type WorldOptions } from '../../../../shared/monsters/world/world';
import { DEFAULT_MONSTER_SETTINGS } from '../settings';
import { WorldGame } from './WorldGame';
import type { WorldSettings } from './settings';

const opts: WorldOptions = { maps: WORLD_MAPS };
const settings: WorldSettings = { ...DEFAULT_MONSTER_SETTINGS, dpad: false };
const stage = () => screen.getByTestId('mw-stage');
const press = (key: string) => act(() => { fireEvent.keyDown(window, { key }); fireEvent.keyUp(window, { key }); });
const talkText = () => document.querySelector('.mw-talk__text')?.textContent ?? '';

function game(extra: Partial<WorldState> = {}) {
  const hurt = { ...makeMonster('plusplash-1', 8) };
  hurt.hp = 5;
  const base = newWorld(opts, [hurt, makeMonster('multipup-1', 8), makeMonster('divvy-1', 6)], 3);
  const start = WORLD_MAPS['kauri-bush'].spots.find((s) => s.name === 'entrance')!;
  const initial = refreshBook({
    ...base, map: 'kauri-bush', x: start.x, y: start.y, facing: start.facing, bag: { potion: 2, 'super-potion': 1, ball: 4, repel: 2 },
    box: [makeMonster('coinrock-1', 4)], ...extra,
  });
  let latest = initial;
  render(<WorldGame initial={initial} settings={settings} onSettingsChange={() => {}} timeScale={0} random={() => 0.5} onState={(s) => { latest = s; }} />);
  return { state: () => latest };
}

describe('the map menu', () => {
  it('opens with the Menu button and with M, closes with Escape and "Back to the map", and walking waits while it is open', async () => {
    const user = userEvent.setup();
    game();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    const menu = screen.getByRole('dialog', { name: 'Menu' });
    for (const name of ['Team', 'Bag', 'Monster book', 'Badges', 'Settings']) expect(within(menu).getByRole('button', { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    press('ArrowUp'); // locked
    expect(stage().dataset.y).toBe('18');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    press('m');
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to the map' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    press('Escape'); // from the map too
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument();
    await user.keyboard('m'); // M closes it again
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    press('ArrowUp'); // you already face up, so this steps
    await waitFor(() => expect(stage().dataset.y).toBe('17'));
  });

  it('Team: one tap on Go first sends that monster out first', async () => {
    const user = userEvent.setup();
    const g = game();
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('button', { name: /^Team/ }));
    const team = screen.getByRole('dialog', { name: 'Team' });
    expect(within(team).getByRole('button', { name: 'Goes first Plusplash' })).toBeDisabled();
    await user.click(within(team).getByRole('button', { name: 'Go first Divvy' }));
    expect(g.state().team.map((m) => m.species)).toEqual(['divvy-1', 'plusplash-1', 'multipup-1']);
    expect(document.querySelector('.mm-msg')?.textContent).toBe('Divvy goes first in the next battle.');
    expect(within(team).getByRole('button', { name: 'Goes first Divvy' })).toBeDisabled();
    await user.click(within(team).getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeInTheDocument();
  });

  it('Bag: a potion heals a hurt monster (and only a hurt one), a ball cannot be used, a Repel switches battles off', async () => {
    const user = userEvent.setup();
    const g = game();
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('button', { name: /^Bag/ }));
    const bag = screen.getByRole('dialog', { name: 'Bag' });
    expect(within(bag).getByRole('button', { name: /^Ball/ })).toBeDisabled();
    await user.click(within(bag).getByRole('button', { name: /^Potion/ }));
    expect(within(bag).getByRole('button', { name: 'Heal Plusplash' })).toBeEnabled();
    expect(within(bag).getByRole('button', { name: 'Heal Multipup' })).toBeDisabled(); // full health
    await user.click(within(bag).getByRole('button', { name: 'Heal Plusplash' }));
    expect(g.state().team[0].hp).toBeGreaterThan(5);
    expect(g.state().team[0].hp).toBeLessThanOrEqual(maxHpOf(g.state().team[0]));
    expect(g.state().bag.potion).toBe(1);
    expect(document.querySelector('.mm-msg')?.textContent).toMatch(/health/);
    await user.click(within(bag).getByRole('button', { name: /^Repel/ }));
    expect(g.state().repel).toBe(50);
    expect(g.state().bag.repel).toBe(1);
    expect(within(bag).getByText(/Repel is working: 50 more steps/)).toBeInTheDocument();
  });

  it('Monster book: all 54 entries, owned and met ones in full, the rest a dark shape with a question mark', async () => {
    const user = userEvent.setup();
    game();
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('button', { name: /^Monster book/ }));
    const book = screen.getByRole('dialog', { name: 'Monster book' });
    const tiles = within(book).getByRole('list', { name: 'All the monsters' }).querySelectorAll('li');
    expect(tiles).toHaveLength(54);
    // The team and the box are owned; their earlier forms too.
    expect(within(book).getByRole('button', { name: 'Number 10, Plusplash, owned' })).toBeInTheDocument();
    expect(within(book).getByRole('button', { name: /Coinrock, owned/ })).toBeInTheDocument();
    // Everything else is a mystery, and its name is not given away.
    const unknown = within(book).getAllByRole('button', { name: /not met yet/ });
    expect(unknown.length).toBe(54 - 4);
    expect(book.textContent).not.toMatch(/Emperor Quotient/);
    await user.click(unknown[0]);
    expect(within(book).getByText(/You have not met this monster yet/)).toBeInTheDocument();
    await user.click(within(book).getByRole('button', { name: 'Number 10, Plusplash, owned' }));
    const detail = within(book).getByRole('region', { name: 'About this monster' });
    expect(within(detail).getByText('Adding and taking away')).toBeInTheDocument();
    expect(within(detail).getByText(/Plus Puddle/)).toBeInTheDocument();
    expect(within(detail).getByText(/Grows into Sumsplash at level 16/)).toBeInTheDocument();
    expect(within(book).getByText(/owned/)).toBeInTheDocument();
  });

  it('Badges: shows which are earned and where to win the others', async () => {
    const user = userEvent.setup();
    game({ badges: ['leaf', 'water'] });
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('button', { name: /^Badges/ }));
    const list = within(screen.getByRole('dialog', { name: 'Badges' })).getByRole('list', { name: 'Badges' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(6);
    expect(items[0]).toHaveTextContent('Leaf badge');
    expect(items[0]).toHaveTextContent('Earned!');
    expect(items[2]).toHaveTextContent('Fire badge');
    expect(items[2]).toHaveTextContent('Win it in the Fire Tower, Fire Mountain');
  });

  it('Settings: the same choices as before, kept from the map', async () => {
    const user = userEvent.setup();
    let saved: WorldSettings = settings;
    render(<WorldGame initial={newWorld(opts, [makeMonster('plusplash-1', 5)], 3)} settings={saved} onSettingsChange={(s) => { saved = s; }} timeScale={0} />);
    await user.click(screen.getByRole('button', { name: 'Menu' }));
    await user.click(screen.getByRole('button', { name: /^Settings/ }));
    await user.click(within(screen.getByRole('dialog', { name: 'Settings' })).getByLabelText(/Calm/));
    expect(saved.calm).toBe(true);
  });
});

describe('the box and the book in Harbour Town open their screens', () => {
  const nextTo = (name: string, extra: Partial<WorldState> = {}) => {
    const s = WORLD_MAPS['harbour-town'].spots.find((p) => p.name === name)!;
    return { map: 'harbour-town', x: s.x, y: s.y, facing: s.facing, ...extra };
  };
  const finishTalk = async (user: ReturnType<typeof userEvent.setup>) => {
    for (let i = 0; i < 6; i++) {
      const next = screen.queryByRole('button', { name: /^(Next|Done)$/ });
      if (!next) return;
      await user.click(next);
    }
  };

  it('the box: talk, then the screen; move monsters between team and box, never below 1 or above 6', async () => {
    const user = userEvent.setup();
    const g = game(nextTo('box'));
    press(' ');
    await waitFor(() => expect(talkText()).toMatch(/Monster box/));
    expect(talkText()).not.toMatch(/coming soon/);
    await finishTalk(user);
    const box = screen.getByRole('dialog', { name: 'Monster box' });
    expect(within(box).getByRole('heading', { name: 'Your team (3 of 6)' })).toBeInTheDocument();
    await user.click(within(box).getByRole('button', { name: 'Move to team Coinrock' }));
    expect(g.state().team).toHaveLength(4);
    expect(g.state().box).toHaveLength(0);
    await user.click(within(box).getByRole('button', { name: 'Move to box Divvy' }));
    await user.click(within(box).getByRole('button', { name: 'Move to box Multipup' }));
    expect(g.state().team).toHaveLength(2);
    await user.click(within(box).getByRole('button', { name: 'Move to box Plusplash' }));
    expect(g.state().team).toHaveLength(1);
    // The last one cannot leave.
    expect(within(box).getByRole('button', { name: /Move to box Coinrock/ })).toBeDisabled();
    await user.click(within(box).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('the book: talk, then the same book screen as the menu', async () => {
    const user = userEvent.setup();
    game(nextTo('book'));
    press(' ');
    await waitFor(() => expect(talkText()).toMatch(/Monster book/));
    expect(talkText()).not.toMatch(/coming soon/);
    await finishTalk(user);
    expect(screen.getByRole('dialog', { name: 'Monster book' })).toBeInTheDocument();
  });
});

describe('chests, gates and badges on the map', () => {
  it('a chest gives its items once and says it is empty after', async () => {
    const user = userEvent.setup();
    const s = WORLD_MAPS['kauri-bush'].spots.find((p) => p.name === 'chest')!;
    const g = game({ x: s.x, y: s.y, facing: s.facing, bag: { potion: 1 } });
    press(' ');
    await waitFor(() => expect(talkText()).toMatch(/lift the lid/));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(talkText()).toMatch(/You found 4 balls!/);
    expect(g.state().bag).toEqual({ potion: 1, ball: 4 });
    await user.click(screen.getByRole('button', { name: 'Done' }));
    press(' ');
    await waitFor(() => expect(talkText()).toBe('The chest is empty now.'));
    expect(g.state().bag).toEqual({ potion: 1, ball: 4 });
  });

  it('a shut gate says which badge is missing; with the badge you walk through to the next area', async () => {
    const user = userEvent.setup();
    const s = WORLD_MAPS['kauri-bush'].spots.find((p) => p.name === 'gate')!;
    game({ x: s.x, y: s.y, facing: s.facing });
    press(' ');
    await waitFor(() => expect(talkText()).toMatch(/rope fence/));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(talkText()).toMatch(/You need the Leaf badge/);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    press('ArrowUp');
    expect(stage().dataset.y).toBe('2'); // still shut
  });

  it('with the badge the gate is open', async () => {
    const s = WORLD_MAPS['kauri-bush'].spots.find((p) => p.name === 'gate')!;
    game({ x: s.x, y: s.y, facing: s.facing, badges: ['leaf'] });
    press('ArrowUp');
    await waitFor(() => expect(stage().dataset.y).toBe('1'));
    press('ArrowUp');
    await waitFor(() => expect(stage().dataset.map).toBe('shell-beach'));
  });
});
