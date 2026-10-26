import { render, screen, within } from '@testing-library/react';
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
});
