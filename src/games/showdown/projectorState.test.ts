import { describe, expect, it } from 'vitest';
import type { FeedEvent } from '../../../shared/showdown/server';
import { initialState, projectorReduce } from './projectorState';
import { sayAllowed } from './audio';

describe('projectorReduce', () => {
  it('follows joins, hits, a wind-up that breaks, a revive, a phase change and the recap', () => {
    const feed: FeedEvent[] = [
      { type: 'join', t: 0, pupil: 'a', team: null, names: { a: 'Aroha' } },
      { type: 'join', t: 0, pupil: 'l', team: null, names: { l: 'Leo' } },
      { type: 'hit', t: 1000, pupil: 'a', team: null, role: 'striker', points: 15, damage: 1.5, streak: 3, times: 3, weakSpot: true, golden: false },
      { type: 'wind_up', t: 2000, endsAt: 17000, enraged: false, groups: [{ group: 'all', needed: 10 }] },
      { type: 'shield_progress', t: 3000, group: 'all', got: 4, needed: 10 },
      { type: 'shield_broke', t: 17000, group: 'all', dazed: ['a'], dazedUntil: 22000 },
      { type: 'revive', t: 18000, pupil: 'l', woke: 'a' },
      { type: 'phase', t: 19000, phase: 2, roleSwapUntil: 34000 },
      { type: 'recap', t: 60000, recap: { result: 'time', winner: null, teams: [], top: [], awards: [] } },
    ];
    let s = initialState();
    const seen: string[] = [];
    for (const e of feed) {
      s = projectorReduce(s, e);
      if (e.type === 'shield_broke') seen.push(`dazed:${Object.keys(s.dazed)}`);
    }
    expect(Object.values(s.roster).map((r) => r.name)).toEqual(['Aroha', 'Leo']);
    expect(s.roster.a.score).toBe(15);
    expect(s.bursts[0]).toMatchObject({ name: 'Aroha', times: 3, weakSpot: true });
    expect(s.bigHitSeq).toBe(1);
    expect(seen).toEqual(['dazed:a']);
    expect(s.dazed).toEqual({});
    expect(s.heals[0].text).toBe('Leo woke up Aroha!');
    expect(s.shield).toMatchObject({ state: 'broke', got: 4, needed: 10 });
    expect(s.phase).toBe(2);
    expect(s.phaseAt).toBe(19000);
    expect(s.recap?.result).toBe('time');
    expect(s.ended && s.timeUp).toBe(true);
    // The announcer never talks over itself or repeats a line straight away (solo: 19 shields held at once said it 19 times).
    const said = new Map<string, number>();
    expect(sayAllowed(10000, 'Shield held!', 0, said)).toBe(true);
    said.set('Shield held!', 10000);
    expect(sayAllowed(10100, 'Shield held!', 10000, said)).toBe(false);
    expect(sayAllowed(10100, 'Boss beaten!', 10000, said)).toBe(false);
    expect(sayAllowed(10100, 'Boss beaten!', -Infinity, said)).toBe(true);
    expect(sayAllowed(12000, 'Shield held!', 10000, said)).toBe(false);
    expect(sayAllowed(18500, 'Shield held!', 10000, said)).toBe(true);
  });
});
