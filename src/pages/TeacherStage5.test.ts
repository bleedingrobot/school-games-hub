import { beforeEach, describe, expect, it, vi } from 'vitest';

const data = vi.hoisted(() => ({ fetchClassMonsters: vi.fn() }));
vi.mock('../data/monsters', async (original) => ({ ...(await original<typeof import('../data/monsters')>()), ...data }));

import { monstersAlerts, monstersHardest, TOPIC_LABEL } from './TeacherMonsters';

const recent = new Date().toISOString();
const old = new Date(Date.now() - 10 * 86_400_000).toISOString();

beforeEach(() => {
  data.fetchClassMonsters.mockReset();
  data.fetchClassMonsters.mockResolvedValue({
    players: 3,
    badges: [],
    topics: [],
    hardest: [
      { pack: 'times-tables', key: 'mul:7x8', students: 3, attempts: 9, correct: 3 },
      { pack: 'add-sub', key: 'add:7+8', students: 2, attempts: 7, correct: 2 },
    ],
    refusals: [
      { name: 'Speedy Otter 27', realName: 'ana', reason: 'badge', at: recent },
      { name: 'Speedy Otter 27', realName: 'ana', reason: 'badge', at: recent },
      { name: 'Old Kiwi 1', realName: 'ben', reason: 'badge', at: old },
    ],
  });
});

describe('Maths Monsters in the teacher stage 5 contract', () => {
  it('maps hardest facts to readable rows', async () => {
    const rows = await monstersHardest('c1');
    expect(data.fetchClassMonsters).toHaveBeenCalledWith('c1');
    expect(rows[0]).toMatchObject({ question: '7 × 8', attempts: 9, correct: 3, students: 3 });
    expect(rows[0].topic).toBe(TOPIC_LABEL['times-tables']);
    expect(rows[1].topic).toBe(TOPIC_LABEL['add-sub']);
    expect(rows[1].question).toBe('7 + 8');
  });

  it('turns this week\'s refusals into "turned down" lines', async () => {
    const alerts = await monstersAlerts('c1');
    expect(alerts).toEqual([
      { id: 'monsters:Speedy Otter 27', text: 'Maths Monsters turned down 2 saves from Speedy Otter 27 this week', section: 'games/monsters' },
    ]);
  });

  it('asks the database once for both (shared for a few seconds)', async () => {
    await Promise.all([monstersHardest('c1'), monstersAlerts('c1')]);
    expect(data.fetchClassMonsters).toHaveBeenCalledTimes(1);
  });
});
