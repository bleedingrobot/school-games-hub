import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MonstersData } from '../../data/monsters';
import { ALL_TOPICS } from '../../data/monsters';

const data = vi.hoisted(() => ({
  loadMonsters: vi.fn(),
  enqueueSave: vi.fn(),
  flushQueue: vi.fn(async () => 'done'),
  writeTail: vi.fn(),
  readTail: vi.fn(() => null),
  savingStopped: vi.fn(() => false),
}));
vi.mock('../../data/monsters', async (original) => ({ ...(await original<typeof import('../../data/monsters')>()), ...data }));
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ profile: { id: 'ana' } }) }));

import { MonstersPlay, WORDS } from './MonstersPlay';

const opened = (over: Partial<MonstersData> = {}): MonstersData => ({
  tail: null, settings: { enabled: true, topics: ALL_TOPICS }, facts: [], offline: false, ...over,
});

beforeEach(() => {
  Object.values(data).forEach((f) => f.mockClear());
  data.flushQueue.mockResolvedValue('done');
});

describe('Maths Monsters opening', () => {
  it('says it is not open yet while the teacher has it switched off', async () => {
    data.loadMonsters.mockResolvedValue(opened({ settings: { enabled: false, topics: ALL_TOPICS } }));
    render(<MonstersPlay />);
    expect(await screen.findByText(WORDS.closed)).toBeInTheDocument();
    expect(data.enqueueSave).not.toHaveBeenCalled();
  });

  it('a new student picks two monsters, and the first save is made straight away saying which', async () => {
    data.loadMonsters.mockResolvedValue(opened());
    render(<MonstersPlay />);
    await userEvent.click(await screen.findByRole('button', { name: 'Start walking' }));
    await waitFor(() => expect(data.enqueueSave).toHaveBeenCalledTimes(1));
    const [player, item] = data.enqueueSave.mock.calls[0];
    expect(player).toBe('ana');
    expect(item).toMatchObject({ seq: 1, start: ['water', 'fire'], battles: [], world: { map: 'harbour-town' } });
    expect(item.world.team).toHaveLength(2);
    expect(data.writeTail).toHaveBeenCalled();
    expect(data.flushQueue).toHaveBeenCalled();
    expect(await screen.findByText(WORDS.saved)).toBeInTheDocument();
  });

  it('says so quietly when saving has to wait, and when the server turned a save down', async () => {
    data.loadMonsters.mockResolvedValue(opened());
    data.flushQueue.mockResolvedValue('later');
    const { unmount } = render(<MonstersPlay />);
    await userEvent.click(await screen.findByRole('button', { name: 'Start walking' }));
    expect(await screen.findByText(WORDS.later)).toBeInTheDocument();
    unmount();
    data.flushQueue.mockResolvedValue('refused');
    render(<MonstersPlay />);
    await userEvent.click(await screen.findByRole('button', { name: 'Start walking' }));
    expect(await screen.findByText(WORDS.stopped)).toBeInTheDocument();
    expect(WORDS.stopped).not.toMatch(/cheat|error|wrong|bad|fail/i);
  });

  it('carries on from the saved game, without a new save until something happens', async () => {
    const { newWorld } = await import('../../../shared/monsters/world/world');
    const { WORLD_MAPS } = await import('../../../shared/monsters/maps');
    const { startTeam } = await import('../../../shared/monsters/world/start');
    const world = newWorld({ maps: WORLD_MAPS }, startTeam(['leaf', 'ice']), 5);
    data.loadMonsters.mockResolvedValue(opened({ tail: { base: 4, world, battles: [] } }));
    render(<MonstersPlay />);
    expect(await screen.findByTestId('mw-stage')).toHaveAttribute('data-map', 'harbour-town');
    expect(data.enqueueSave).not.toHaveBeenCalled();
  });

  it('offers to try again when nothing can be loaded', async () => {
    data.loadMonsters.mockResolvedValue(opened({ offline: true }));
    render(<MonstersPlay />);
    expect(await screen.findByText(WORDS.cantLoad)).toBeInTheDocument();
    data.loadMonsters.mockResolvedValue(opened());
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Start walking' })).toBeInTheDocument();
  });
});
