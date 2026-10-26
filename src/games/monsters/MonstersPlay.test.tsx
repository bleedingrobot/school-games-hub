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
});
