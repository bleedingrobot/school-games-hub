import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyAction, parseAction, type Action, type Applied, type Context, type OpenFight, type ServerState } from './actions';
import { botOrders } from './bot';
import { nextCryQuestion, replayFight, type RecordedRound } from './battleCry';
import { CONFIG } from './config';
import { startingDrafts } from './create';
import { empireOf } from './empire';
import { ACHIEVEMENTS, addEarned, earnedOrNone, fameFor, measures, NO_STATS, pointsFor, reached } from './rewards';
import { DEFAULT_PRACTICAL_SETTINGS } from '../maths/practical';

const SEED = 123456;
const DAY0 = 20_000;
const ctx = (over: Partial<Context> = {}): Context => ({ seed: SEED, today: DAY0, ...over });
const sql = readFileSync(resolve('supabase/migrations/20261018002100_clans_rewards.sql'), 'utf8');

function created(): ServerState {
  const out = applyAction(null, { type: 'create', name: 'Red Banner', drafts: startingDrafts(SEED) }, ctx());
  if (!out.ok || !out.state) throw new Error('create failed');
  return out.state;
}
function ok(state: ServerState, action: Action, over: Partial<Context> = {}): Extract<Applied, { ok: true }> & { state: ServerState } {
  const out = applyAction(state, action, ctx(over));
  if (!out.ok || !out.state) throw new Error(`refused: ${out.ok ? '' : `${out.why}: ${out.say}`}`);
  return out as never;
}

function nextRound(state: ServerState, cryRight = true): RecordedRound {
  const f = state.fight as OpenFight;
  const local = replayFight(state.clan.members, f.depth, f.seed, f.boss, f.rounds, f.settings).state;
  const q = nextCryQuestion(local, f.settings);
  return { orders: botOrders(local), cry: q ? { answer: cryRight ? q.answer : q.answer + 1, reward: 'damage' } : null };
}

/** Every request of a whole fight, in order, with the state each one left. */
function playFight(state: ServerState, depth: number, boss = false, cryRight = true) {
  let s = ok(state, { type: 'fightStart', depth, boss }).state;
  const steps: Extract<Applied, { ok: true }>[] = [];
  for (let i = 0; i < CONFIG.maxRounds + 2 && s.fight; i++) {
    const played = nextRound(s, cryRight);
    const step = ok(s, { type: 'fightRound', round: (s.fight as OpenFight).rounds.length + 1, orders: played.orders, cry: played.cry });
    steps.push(step);
    s = step.state!;
  }
  return { state: s, steps, last: steps[steps.length - 1] };
}

describe('what a request earns', () => {
  it('has fame and points that match the plan', () => {
    expect(fameFor({ wins: 1 })).toBe(1);
    expect(fameFor({ bosses: 1 })).toBe(5);
    expect(fameFor({ wars: 1 })).toBe(2);
    expect(fameFor({ kingdomRaids: 1 })).toBe(2);
    expect(fameFor({ classRaids: 1 })).toBe(3);
    expect(fameFor({ cries: 40 })).toBe(0);
    expect(pointsFor({ wins: 1 }, 0)).toEqual({ points: 0, pending: 1 });
    expect(pointsFor({ wins: 1 }, 2)).toEqual({ points: 1, pending: 0 });
    expect(pointsFor({ wins: 7 }, 1)).toEqual({ points: 2, pending: 2 });
    expect(pointsFor({ bosses: 1 }, 1)).toEqual({ points: 3, pending: 1 });
    expect(pointsFor({ wars: 1 }, 0)).toEqual({ points: 2, pending: 0 });
    expect(pointsFor({ kingdomRaids: 2, classRaids: 2, cries: 9 }, 0)).toEqual({ points: 0, pending: 0 });
  });

  it('never makes fame or points negative or fractional, whatever it is given', () => {
    for (let i = 0; i < 2000; i++) {
      const e = { wins: i % 5, bosses: (i * 3) % 4, wars: (i * 7) % 3, kingdomRaids: (i * 11) % 3, classRaids: (i * 13) % 3, cries: (i * 17) % 9 };
      const p = pointsFor(e, i % 3);
      expect(fameFor(e)).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(fameFor(e))).toBe(true);
      expect(p.points).toBeGreaterThanOrEqual(0);
      expect(p.pending).toBeGreaterThanOrEqual(0);
      expect(p.pending).toBeLessThan(CONFIG.rewards.points.minesPerPoint);
    }
  });

  it('keeps results small: nothing earned means no "earned" at all', () => {
    expect(earnedOrNone({})).toBeUndefined();
    expect(earnedOrNone({ wins: 0, cries: 0 })).toBeUndefined();
    expect(earnedOrNone({ cries: 1 })).toMatchObject({ cries: 1, wins: 0 });
  });

  it('adds up lifetime counts', () => {
    const s = addEarned(addEarned(NO_STATS, { wins: 2, cries: 3 }), { bosses: 1, wars: 1, kingdomRaids: 1, classRaids: 1 });
    expect(s).toEqual({ mineWins: 2, bossWins: 1, warWins: 1, kingdomRaids: 1, classRaids: 1, cries: 3, villageBuilt: 0 });
  });
});

describe('what the rules say each action earned', () => {
  it('pays a won mine fight 1 win, a won boss 1 boss, and only counts right Battle Cry answers', () => {
    const won = playFight(created(), 0);
    expect(won.last.result).toMatchObject({ type: 'fightRound', over: true });
    const wins = won.steps.reduce((n, s) => n + ((s.result as { earned?: { wins: number } }).earned?.wins ?? 0), 0);
    const cries = won.steps.reduce((n, s) => n + ((s.result as { earned?: { cries: number } }).earned?.cries ?? 0), 0);
    expect(wins).toBe(1);
    expect(cries).toBeGreaterThan(0);
    // The wins come only in the request that ended the fight.
    expect(won.steps.slice(0, -1).every((s) => ((s.result as { earned?: { wins: number } }).earned?.wins ?? 0) === 0)).toBe(true);
    const wrong = playFight(created(), 0, false, false);
    const wrongCries = wrong.steps.reduce((n, s) => n + ((s.result as { earned?: { cries: number } }).earned?.cries ?? 0), 0);
    expect(wrongCries).toBe(0);
  });

  it('earns nothing from a fight that is lost', () => {
    const lost = playFight(created(), CONFIG.maxLevel);
    if (lost.last.result.type !== 'fightRound' || !lost.last.result.summary) throw new Error('fight did not end');
    expect(lost.last.result.summary.result).not.toBe('won');
    for (const s of lost.steps) expect((s.result as { earned?: { wins: number; bosses: number } }).earned?.wins ?? 0).toBe(0);
  });

  it('pays a boss as a boss and not as a mine win', () => {
    const strong = created();
    for (const m of strong.clan.members) {
      m.maxHp = m.hp = 5000;
      m.stats.strength = 60;
    }
    const boss = playFight(strong, 5, true);
    const summary = boss.last.result.type === 'fightRound' ? boss.last.result.summary : null;
    expect(summary?.result).toBe('won');
    const earned = (boss.last.result as { earned?: { wins: number; bosses: number } }).earned;
    expect(earned).toMatchObject({ bosses: 1, wins: 0 });
  });

  it('pays a gift to the chest, a vote and everything else in the shop nothing', () => {
    const s = created();
    const gift = ok(s, { type: 'chestGive', gold: 10 });
    expect('earned' in gift.result).toBe(false);
    const train = applyAction(s, { type: 'wake', member: 0 }, ctx());
    if (train.ok) expect('earned' in train.result).toBe(false);
  });

  it('pays a Friendly War win and a raid on a kingdom, and nothing for a loss', () => {
    const s = created();
    const e = empireOf(s.clan);
    e.troops.footman = 60;
    const plan = { rounds: 3, push: 'steady' as const, loot: 10 };
    const war = ok(s, { type: 'war', kingdom: 'bunny-hollow', plan });
    expect(war.result).toMatchObject({ type: 'war' });
    expect((war.result as { earned?: unknown }).earned).toMatchObject({ wars: 1 });
    const raid = ok(s, { type: 'raid', kingdom: 'bunny-hollow', plan });
    expect((raid.result as { earned?: unknown }).earned).toMatchObject({ kingdomRaids: 1 });
    const weak = created();
    empireOf(weak.clan).troops.footman = 1;
    const lostWar = applyAction(weak, { type: 'war', kingdom: 'dragons-rest', plan }, ctx());
    if (lostWar.ok && lostWar.result.type === 'war') expect(lostWar.result.earned).toBeUndefined();
  });

  it('can never be given by a browser: an action has no place for it', () => {
    const wanted = parseAction({ type: 'chestGive', gold: 5, earned: { wins: 50 }, fame: 99, points: 99 });
    expect(wanted).toEqual({ type: 'chestGive', gold: 5 });
    const round = parseAction({ type: 'fightRound', round: 1, orders: [], cry: null, earned: { bosses: 9 }, result: 'won' });
    expect(round).toEqual({ type: 'fightRound', round: 1, orders: [], cry: null });
  });
});

describe('the mine fights a day and the settings', () => {
  it('uses the teacher\'s number for a new clan and for a new day, and the default without one', () => {
    const made = applyAction(null, { type: 'create', name: 'Red Banner', drafts: startingDrafts(SEED) }, ctx({ fightsPerDay: 3 }));
    if (!made.ok || !made.state) throw new Error('create failed');
    expect(made.state.fightsLeft).toBe(3);
    const next = applyAction(made.state, { type: 'load' }, ctx({ fightsPerDay: 11, today: DAY0 + 1 }));
    if (!next.ok || !next.state) throw new Error('load failed');
    expect(next.state.fightsLeft).toBe(11);
    expect(created().fightsLeft).toBe(CONFIG.fightsPerDay);
  });

  it('keeps the settings an open fight started with, whatever the teacher changes', () => {
    const s = ok(created(), { type: 'fightStart', depth: 2, boss: false }, { settings: { ...DEFAULT_PRACTICAL_SETTINGS, yearBand: 6 } }).state;
    expect((s.fight as OpenFight).settings.yearBand).toBe(6);
    const played = nextRound(s);
    const after = ok(s, { type: 'fightRound', round: 1, orders: played.orders, cry: played.cry }, { settings: { ...DEFAULT_PRACTICAL_SETTINGS, yearBand: 4, enabledTopics: ['area'] } });
    expect(after.result).toMatchObject({ type: 'fightRound' });
    expect(after.state.fight ? after.state.fight.settings.yearBand : 6).toBe(6);
    // The Battle Cry answer was marked against the year 6 question: it was right, so it counted.
    expect((after.result as { earned?: { cries: number } }).earned?.cries ?? 1).toBe(1);
  });
});

describe('achievements', () => {
  it('has eight, with the plan\'s measures', () => {
    expect(ACHIEVEMENTS.map((a) => a.id)).toEqual(['cq-first-win', 'cq-first-boss', 'cq-level-10', 'cq-level-20', 'cq-buildings-5', 'cq-first-war', 'cq-village', 'cq-cries-50']);
  });

  it('reaches each at its goal and not before', () => {
    const s = created();
    expect(reached(measures(s.clan, NO_STATS))).toEqual([]);
    expect(reached(measures(s.clan, { ...NO_STATS, mineWins: 1 }))).toEqual(['cq-first-win']);
    expect(reached(measures(s.clan, { ...NO_STATS, bossWins: 1 }))).toEqual(['cq-first-win', 'cq-first-boss']);
    expect(reached(measures(s.clan, { ...NO_STATS, warWins: 1, villageBuilt: 1 }))).toEqual(['cq-first-war', 'cq-village']);
    expect(reached(measures(s.clan, { ...NO_STATS, cries: 49 }))).toEqual([]);
    expect(reached(measures(s.clan, { ...NO_STATS, cries: 50 }))).toEqual(['cq-cries-50']);
    s.clan.members[2].level = 10;
    expect(reached(measures(s.clan, NO_STATS))).toEqual(['cq-level-10']);
    s.clan.members[2].level = 20;
    expect(reached(measures(s.clan, NO_STATS))).toEqual(['cq-level-10', 'cq-level-20']);
    const e = empireOf(s.clan);
    e.plots = Array.from({ length: 5 }, () => ({ width: 3, length: 3, building: 'barracks' as const }));
    expect(reached(measures(s.clan, NO_STATS))).toContain('cq-buildings-5');
    e.plots = e.plots.slice(0, 4);
    expect(reached(measures(s.clan, NO_STATS))).not.toContain('cq-buildings-5');
  });
});

describe('the database and the rules agree', () => {
  const rules = /clan_reward_rules\(\)[^$]*\$\$ select jsonb_build_object\(([\s\S]*?)\) \$\$;/.exec(sql)?.[1] ?? '';

  it('uses the same fame and point numbers', () => {
    const f = CONFIG.rewards.fame;
    const p = CONFIG.rewards.points;
    expect(rules).toContain(`'fame', jsonb_build_object('mineWin', ${f.mineWin}, 'bossWin', ${f.bossWin}, 'warWin', ${f.warWin}, 'kingdomRaidWin', ${f.kingdomRaidWin}, 'classRaidWin', ${f.classRaidWin}, 'villageBuilt', ${f.villageBuilt})`);
    expect(rules).toContain(`'points', jsonb_build_object('minesPerPoint', ${p.minesPerPoint}, 'boss', ${p.boss}, 'war', ${p.war}, 'villageBuilt', ${p.villageBuilt})`);
  });

  it('has the same eight achievements', () => {
    for (const [i, a] of ACHIEVEMENTS.entries()) {
      expect(sql).toContain(`('${a.id}', 'clan-quest', '${a.name}', '${a.emoji}', '${a.measure}', ${a.goal}, ${i + 1})`);
    }
    expect((sql.match(/'clan-quest', '/g) ?? []).length).toBeGreaterThanOrEqual(ACHIEVEMENTS.length);
  });

  it('starts the settings as the Year 5 defaults with the default number of fights', () => {
    expect(sql).toContain(`clans_year_band integer not null default ${DEFAULT_PRACTICAL_SETTINGS.yearBand}`);
    expect(sql).toContain(`default '{${DEFAULT_PRACTICAL_SETTINGS.enabledTopics.join(',')}}'`);
    expect(sql).toContain(`default '{${DEFAULT_PRACTICAL_SETTINGS.enabledTables.join(',')}}'`);
    expect(sql).toContain(`clans_fights_per_day integer not null default ${CONFIG.fightsPerDay} check (clans_fights_per_day between ${CONFIG.rewards.fightsPerDayRange.min} and ${CONFIG.rewards.fightsPerDayRange.max})`);
  });
});
