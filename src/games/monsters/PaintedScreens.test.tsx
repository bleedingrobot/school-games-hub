import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { BattleSetup } from '../../../shared/monsters/engine';
import { WORLD_MAPS } from '../../../shared/monsters/maps';
import { makeMonster } from '../../../shared/monsters/rules';
import { newWorld } from '../../../shared/monsters/world/world';
import { BattleScreen } from './BattleScreen';
import { DEFAULT_MONSTER_SETTINGS } from './settings';
import { StartScreen } from './StartScreen';
import { BagList } from './ui';
import { MapMenu } from './world/MapMenu';
import { WorldGame } from './world/WorldGame';

// Pretend every person, place, badge, item and look has its picture (monsters keep their drawings), so these tests don't depend on which files have arrived.
vi.mock('./art/painted', async (actual) => {
  const real = await actual<typeof import('./art/painted')>();
  return {
    ...real,
    monsterPic: () => undefined,
    personPic: (name: string, small?: boolean) => `/people/${real.slug(name)}${small ? '-small' : ''}.webp`,
    scenePic: (map: string) => ({ wide: `/scenes/${real.sceneFor(map)}.webp`, small: `/scenes/${real.sceneFor(map)}-800.webp` }),
    badgePic: (badge: string) => `/badges/${badge}.webp`,
    itemPic: (id: string) => `/items/${id}.webp`,
    lookPic: (look: string, small?: boolean) => `/looks/${look}${small ? '-small' : ''}.webp`,
    preload: vi.fn(),
  };
});

const battle = (setup: Partial<BattleSetup>, props: { place?: string; trainer?: string } = {}) =>
  render(
    <BattleScreen
      setup={{ kind: 'wild', area: 1, team: [makeMonster('plusplash-1', 10)], foes: [makeMonster('digibud-1', 5)], ...setup }}
      settings={{ calm: false, multipleChoice: true }}
      onFinish={() => {}}
      timeScale={0}
      {...props}
    />,
  );
const arena = () => document.querySelector<HTMLElement>('.mb-arena')!;
const message = () => screen.getByTestId('message').textContent ?? '';

describe('painted pictures on the screens', () => {
  it('a battle has the landscape of its place, a Tower’s rooms share the Tower’s, and the phone copy is there too', () => {
    const { unmount } = battle({}, { place: 'tower-2-top' });
    expect(arena()).toHaveClass('has-art');
    expect(arena().style.getPropertyValue('--arena-wide')).toContain('/scenes/tower-2.webp');
    expect(arena().style.getPropertyValue('--arena-small')).toContain('/scenes/tower-2-800.webp');
    unmount();
    battle({ area: 3 }); // no place given: the area's outdoor map
    expect(arena().style.getPropertyValue('--arena-wide')).toContain('/scenes/fire-mountain.webp');
  });

  it('a trainer says hello with their picture before their first monster comes out', async () => {
    const user = userEvent.setup();
    battle({ kind: 'trainer' }, { trainer: 'Ranger Kiri' });
    expect(message()).toBe('Ranger Kiri wants to battle!');
    const pic = document.querySelector('.mb-trainer')!;
    expect(pic.getAttribute('src')).toBe('/people/ranger-kiri.webp');
    expect(pic.getAttribute('alt')).toBe('');
    expect(document.querySelector('.mb-foe')).toHaveClass('is-gone');
    expect(document.querySelector('.mb-foe-card')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(message()).toBe('Ranger Kiri sends out Digibud!');
    expect(document.querySelector('.mb-trainer')).toBeNull();
    expect(document.querySelector('.mb-foe')).not.toHaveClass('is-gone');
  });

  it('a wild battle has no trainer hello', () => {
    battle({}, { trainer: 'Ranger Kiri' });
    expect(message()).toMatch(/A wild Digibud appeared/);
    expect(document.querySelector('.mb-trainer')).toBeNull();
  });

  it('the Bag shows each item’s picture beside its name', () => {
    render(<BagList bag={{ potion: 1, repel: 2 }} wild={false} items={['potion', 'repel']} onPick={() => {}} />);
    const pics = [...document.querySelectorAll('.mb-bag__pic')];
    expect(pics.map((p) => p.getAttribute('src'))).toEqual(['/items/potion.webp', '/items/repel.webp']);
    expect(pics.every((p) => p.getAttribute('alt') === '')).toBe(true);
    expect(screen.getByRole('button', { name: /Potion/ })).toBeInTheDocument();
  });

  it('the Badges page shows the six badges, greyed out until earned', () => {
    const world = { ...newWorld({ maps: WORLD_MAPS }, [makeMonster('plusplash-1', 8)], 3), badges: ['leaf'] };
    render(<MapMenu page="badges" from="menu" world={world} settings={{ ...DEFAULT_MONSTER_SETTINGS, dpad: false }} onSettingsChange={() => {}} onGo={() => {}} onClose={() => {}} onChange={() => {}} />);
    const rows = [...document.querySelectorAll('.mm-badge')];
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.querySelector('img')?.getAttribute('src'))).toEqual(['leaf', 'water', 'fire', 'ice', 'spark', 'stone'].map((b) => `/badges/${b}.webp`));
    expect(rows.map((r) => r.classList.contains('is-earned'))).toEqual([true, false, false, false, false, false]);
  });

  it('the talk box shows the speaker’s small portrait', async () => {
    const world = newWorld({ maps: WORLD_MAPS }, [makeMonster('plusplash-1', 8)], 3);
    render(<WorldGame initial={{ ...world, map: 'harbour-town', x: 12, y: 15, facing: 'right' }} settings={{ ...DEFAULT_MONSTER_SETTINGS, dpad: false }} onSettingsChange={() => {}} timeScale={0} />);
    expect(document.querySelector('.mw-talk__face')).toBeNull();
    act(() => {
      fireEvent.keyDown(window, { key: ' ' });
      fireEvent.keyUp(window, { key: ' ' });
    });
    await waitFor(() => expect(document.querySelector('.mw-talk__face')?.getAttribute('src')).toBe('/people/teacher-small.webp'));
    expect(document.querySelector('.mw-talk__face')!.getAttribute('alt')).toBe('');
  });
});

describe('choosing a look', () => {
  it('the start screen has the 24 looks as radio buttons the arrow keys move through, and starts with the one chosen', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<StartScreen onStart={onStart} />);
    const group = screen.getByRole('group', { name: 'Choose your look' });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(24);
    expect(radios.some((r) => (r as HTMLInputElement).checked)).toBe(false);
    await user.click(screen.getByRole('radio', { name: 'Girl 3' }));
    expect(screen.getByRole('radio', { name: 'Girl 3' })).toBeChecked();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Girl 4' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Girl 4' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Start walking' }));
    expect(onStart).toHaveBeenCalledWith(['water', 'fire'], expect.any(Array), 'girl-04');
  });

  it('starting without choosing is fine (no look)', async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(<StartScreen onStart={onStart} />);
    await user.click(screen.getByRole('button', { name: 'Start walking' }));
    expect(onStart.mock.calls[0][2]).toBeUndefined();
  });

  it('the Menu has "Change my look", which changes the look in the game', async () => {
    const user = userEvent.setup();
    const world = newWorld({ maps: WORLD_MAPS }, [makeMonster('plusplash-1', 8)], 3);
    const onGo = vi.fn();
    const onChange = vi.fn();
    const menu = (page: 'main' | 'look', w = world) => (
      <MapMenu page={page} from="menu" world={w} settings={{ ...DEFAULT_MONSTER_SETTINGS, dpad: false }} onSettingsChange={() => {}} onGo={onGo} onClose={() => {}} onChange={onChange} />
    );
    const { rerender } = render(menu('main'));
    await user.click(screen.getByRole('button', { name: /^Change my look/ }));
    expect(onGo).toHaveBeenCalledWith('look');
    rerender(menu('look', { ...world, look: 'boy-02' }));
    expect(screen.getByRole('radio', { name: 'Boy 2' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Boy 7' }));
    expect(onChange).toHaveBeenCalledWith({ ...world, look: 'boy-07' });
    expect(screen.getByRole('status')).toHaveTextContent('Your look is now Boy 7.');
  });
});
