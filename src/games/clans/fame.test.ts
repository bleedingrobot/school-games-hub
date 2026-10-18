import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, measures, NO_STATS } from '../../../shared/clans/rewards';
import { achievementList, awardNext, giveFame, newSeason, PRETEND_CLANS, pretendBoard } from './fame';
import { earn, finishFight, makeClan, newSession, startingDrafts } from './session';
import { newFight } from './../../../shared/clans/fight';

const fresh = () => newSession(makeClan('Red Banner', startingDrafts(77)), 77);

describe('fame on the test page', () => {
  it('starts with none and only goes up', () => {
    let s = fresh();
    expect(s.fame).toBe(0);
    s = earn(s, { wins: 1 });
    expect(s.fame).toBe(1);
    s = earn(s, { bosses: 1, wars: 1, kingdomRaids: 1, classRaids: 1 });
    expect(s.fame).toBe(1 + 5 + 2 + 2 + 3);
    s = earn(s, {});
    expect(s.fame).toBe(13);
  });

  it('earns a won fight 1 fame (5 for a boss) and a lost fight nothing', () => {
    const s = fresh();
    const won = newFight(s.clan.members, 0, 5, false);
    won.result = 'won';
    expect(finishFight(s, won).fame).toBe(1);
    expect(finishFight(s, won, true).fame).toBe(5);
    expect(finishFight(finishFight(s, won, true).session, won, true).session.fame).toBe(10);
    const lost = newFight(s.clan.members, 0, 5, false);
    lost.result = 'lost';
    expect(finishFight(s, lost).fame).toBe(0);
    expect(finishFight(s, lost).session.fame).toBe(0);
  });

  it('starts a new season at 0 and keeps the clan, its gold and its achievements', () => {
    let s = awardNext(giveFame(fresh(), 40));
    const gold = s.clan.gold;
    s = newSeason(s);
    expect(s.fame).toBe(0);
    expect(s.season).toBe(2);
    expect(s.clan.gold).toBe(gold);
    expect(s.achievements).toEqual(['cq-first-win']);
  });
});

describe('the pretend scoreboard', () => {
  it('lists the top ten and you, by fame, with only names and fame', () => {
    const rows = pretendBoard(giveFame(fresh(), 100));
    expect(rows.length).toBeLessThanOrEqual(11);
    expect(rows.filter((r) => r.isMe)).toHaveLength(1);
    expect(rows.map((r) => r.fame)).toEqual([...rows.map((r) => r.fame)].sort((a, b) => b - a));
    for (const r of rows) expect(Object.keys(r).sort()).toEqual(['fame', 'isMe', 'name', 'place']);
    expect(rows.find((r) => r.isMe)!.place).toBe(1 + PRETEND_CLANS.filter((c) => c.fame > 100).length);
  });

  it('shows your clan even with no fame, and puts tied clans in the same place', () => {
    const none = pretendBoard(fresh());
    expect(none.find((r) => r.isMe)).toMatchObject({ fame: 0, place: PRETEND_CLANS.length + 1 });
    const tied = pretendBoard(giveFame(fresh(), PRETEND_CLANS[0].fame));
    expect(tied.filter((r) => r.place === 1)).toHaveLength(2);
    expect(tied[2].place).toBe(3);
  });
});

describe('the test page\'s achievements', () => {
  it('earns all eight, one at a time in order, never twice', () => {
    let s = fresh();
    for (let i = 1; i <= ACHIEVEMENTS.length; i++) {
      s = awardNext(s);
      expect(s.achievements!.length).toBeGreaterThanOrEqual(i);
    }
    expect(new Set(s.achievements).size).toBe(ACHIEVEMENTS.length);
    expect(achievementList(s).every((a) => a.earned)).toBe(true);
    expect(awardNext(s)).toBe(s);
    expect(Object.values(measures(s.clan, s.stats ?? NO_STATS)).every((n) => n > 0)).toBe(true);
  });

  it('earns the first win with a win, and not with a raid', () => {
    expect(earn(fresh(), { wins: 1 }).achievements).toEqual(['cq-first-win']);
    expect(earn(fresh(), { kingdomRaids: 1, classRaids: 1 }).achievements).toEqual([]);
  });
});
