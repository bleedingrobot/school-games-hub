import { describe, expect, it } from 'vitest';
import { refusalAlerts } from './alerts';

const now = Date.parse('2026-10-28T00:00:00Z');
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();
const game = { id: 'monsters', name: 'Maths Monsters' };

describe('refusalAlerts', () => {
  it('groups by name, with "a save" for one and "3 saves" for more', () => {
    const out = refusalAlerts(
      [
        { name: 'Speedy Otter 27', at: daysAgo(1) },
        { name: 'Speedy Otter 27', at: daysAgo(2) },
        { name: 'Speedy Otter 27', at: daysAgo(3) },
        { name: 'Lucky Tui 21', at: daysAgo(1) },
      ],
      game,
      'save',
      now,
    );
    expect(out.map((a) => a.text)).toEqual([
      'Maths Monsters turned down 3 saves from Speedy Otter 27 this week',
      'Maths Monsters turned down a save from Lucky Tui 21 this week',
    ]);
    expect(out[0]).toMatchObject({ id: 'monsters:Speedy Otter 27', section: 'games/monsters' });
  });

  it('uses the word for requests', () => {
    const out = refusalAlerts([{ name: 'A', at: daysAgo(0) }, { name: 'A', at: daysAgo(0) }], { id: 'dragon-maths', name: 'Dragon Maths' }, 'request', now);
    expect(out[0].text).toBe('Dragon Maths turned down 2 requests from A this week');
    expect(out[0].section).toBe('games/dragon-maths');
  });

  it('leaves out refusals older than 7 days', () => {
    const out = refusalAlerts([{ name: 'Old', at: daysAgo(8) }, { name: 'New', at: daysAgo(6) }], game, 'save', now);
    expect(out.map((a) => a.id)).toEqual(['monsters:New']);
  });

  it('gives nothing for no refusals', () => {
    expect(refusalAlerts([], game, 'save', now)).toEqual([]);
  });
});
