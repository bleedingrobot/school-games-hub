import { describe, expect, it } from 'vitest';
import { MASTERS, MAX_LEVEL, SEASON_DAYS, baseStats, expNeeded } from '../../../shared/lord/data';
import { COMPUTER_HEROES, computerDeeds, computerHeroes } from '../../../shared/lord/computer';
import { arenaExp, duelistOf, newHero, playDuel, type Duelist } from '../../../shared/lord/engine';
import { VILLAGE_EVENTS, dailyNews, villageEventFor } from '../../../shared/lord/news';
import type { LordState } from '../../../shared/lord/server';
import type { Hero } from '../../../shared/lord/types';
import { DRAGON_SLAYER, Game, NZ_MIDNIGHT, STRONG, play, proof } from './testKit';

const WEAK = { strength: 1, defence: 0, hp: 1, maxHp: 1 };

describe('the computer heroes', () => {
  it('are eight clearly labelled village heroes with their own names', () => {
    expect(COMPUTER_HEROES).toHaveLength(8);
    expect(new Set(COMPUTER_HEROES.map((h) => h.name)).size).toBe(8);
    const deeds = computerDeeds(1, 14).concat(computerDeeds(1, 20), computerDeeds(1, 28));
    expect(deeds.length).toBeGreaterThan(0);
    for (const d of deeds) expect(d.text).toContain('(computer hero)');
  });

  it('are made by the very same engine and simulator as the pupils’ pace, so their numbers are the engine’s numbers', () => {
    for (const day of [1, 9, 20, 35]) {
      for (const c of computerHeroes(1, day)) {
        expect(c.hero.maxHp).toBe(baseStats(c.hero.level).maxHp);
        expect(c.hero.level).toBeGreaterThanOrEqual(1);
        expect(c.hero.level).toBeLessThanOrEqual(MAX_LEVEL);
        expect(c.duelist.maxHp).toBe(c.hero.maxHp);
      }
    }
  });

  it('level up on a schedule: a steady hero is stronger in week 3 than on day 2, and the same every time they are asked', () => {
    const early = computerHeroes(1, 2).find((h) => h.id === 'gareth')!;
    const later = computerHeroes(1, 16).find((h) => h.id === 'gareth')!;
    expect(later.hero.level).toBeGreaterThan(early.hero.level);
    expect(computerHeroes(1, 16).map((h) => h.hero)).toEqual(computerHeroes(1, 16).map((h) => h.hero));
    // A new season is a new season for them too.
    expect(computerHeroes(2, 16).map((h) => h.hero.level)).not.toEqual(computerHeroes(1, 16).map((h) => h.hero.level));
  });

  it('level up by beating real masters, and a level-up line says which', () => {
    const lines = Array.from({ length: SEASON_DAYS }, (_, d) => computerDeeds(1, d + 1)).flat().filter((d) => d.kind === 'level');
    expect(lines.length).toBeGreaterThan(10);
    for (const l of lines) expect(MASTERS.some((m) => l.text.includes(m.name))).toBe(true);
  });

  it('write a village line and their own deeds into the day’s news, all keyed so a line is only kept once', () => {
    const news = dailyNews('2026-10-25', { number: 1, dayOfSeason: 7 });
    expect(news[0]).toMatchObject({ kind: 'village', dedupe: 'village', player: null });
    expect(new Set(news.map((n) => n.dedupe)).size).toBe(news.length);
    expect(news.every((n) => n.player === null)).toBe(true);
    expect(villageEventFor('2026-10-25')).toBe(villageEventFor('2026-10-25'));
    expect(new Set(Array.from({ length: VILLAGE_EVENTS.length }, (_, d) => villageEventFor(`2026-11-${String(d + 1).padStart(2, '0')}`))).size).toBe(VILLAGE_EVENTS.length);
  });
});

describe('the arena duel', () => {
  const a: Duelist = { name: 'A', heroClass: 'knight', level: 4, attack: 40, defence: 10, maxHp: 80 };
  const b: Duelist = { name: 'B', heroClass: 'mage', level: 4, attack: 40, defence: 10, maxHp: 80 };

  it('is the same every time from the same two heroes and seed, and always finishes', () => {
    for (let seed = 1; seed < 50; seed++) {
      const one = playDuel(a, b, seed);
      expect(playDuel(a, b, seed)).toEqual(one);
      expect(one.rounds).toBeGreaterThan(0);
      expect(one.rounds).toBeLessThanOrEqual(30);
      expect(one.hpA > 0 || one.hpB > 0).toBe(true);
    }
  });

  it('is fair between equals, and a much stronger hero nearly always wins', () => {
    let wins = 0;
    let strongWins = 0;
    for (let seed = 1; seed <= 400; seed++) {
      if (playDuel(a, b, seed).winner === 'a') wins += 1;
      if (playDuel({ ...a, attack: 200, maxHp: 400 }, b, seed).winner === 'a') strongWins += 1;
    }
    expect(wins).toBeGreaterThan(120);
    expect(wins).toBeLessThan(280);
    expect(strongWins).toBeGreaterThan(390);
  });

  it('gives a Trickster’s dodge, a Knight’s power strike and a Mage’s zap in round 2', () => {
    const k = playDuel(a, { ...b, heroClass: 'knight' }, 3).log.filter((e) => e.type === 'hit' && e.move);
    expect(k.some((e) => e.type === 'hit' && e.move === 'power-strike')).toBe(true);
    const m = playDuel({ ...a, heroClass: 'mage' }, b, 3).log.filter((e) => e.type === 'hit' && e.move);
    expect(m.some((e) => e.type === 'hit' && e.move === 'zap')).toBe(true);
    const t = playDuel({ ...a, heroClass: 'trickster' }, b, 3).log;
    expect(t.some((e) => e.type === 'miss')).toBe(true);
  });
});

describe('the arena', () => {
  async function ready(patch: Partial<Hero> = STRONG) {
    const g = new Game();
    await g.start();
    g.patch(patch);
    await g.refresh();
    return g;
  }

  it('plays a fight for you, pays a little experience for a win and stores it finished, in one request', async () => {
    const g = await ready();
    const before = g.hero();
    const out = await g.send({ action: 'arena' });
    expect(out.body.ok).toBe(true);
    expect(out.body.result.outcome).toBe('won');
    expect(out.body.result.exp).toBe(arenaExp(before.level));
    expect(out.body.result.opponent).toMatchObject({ computer: true });
    expect(out.body.result.log.length).toBeGreaterThan(0);
    expect(g.hero()).toMatchObject({ arenaLeft: 2, exp: before.exp + arenaExp(before.level), arenaWins: 1, gold: before.gold, hp: before.hp, bank: before.bank });
    const fight = g.db.fights.at(-1)!;
    expect(fight).toMatchObject({ status: 'finished', kind: 'arena' });
    expect(fight.monster).toMatch(/^computer-/);
    expect(g.db.openFight).toBeNull();
  });

  it('can be played again from what was stored and comes out the same', async () => {
    const g = await ready();
    await g.send({ action: 'arena' });
    const fight = g.db.fights.at(-1)!;
    const start = fight.start as { a: Duelist; b: Duelist };
    const again = playDuel(start.a, start.b, fight.seed!);
    const result = fight.result as { outcome: string; rounds: number; hpYou: number; hpThem: number; log: unknown[] };
    expect(again.winner === 'a' ? 'won' : 'lost').toBe(result.outcome);
    expect(again).toMatchObject({ rounds: result.rounds, hpA: result.hpYou, hpB: result.hpThem });
    expect(again.log).toEqual(result.log);
  });

  it('gives three fights a day, then asks you to come back tomorrow, and the turns come back with the new day', async () => {
    const g = await ready();
    for (let i = 0; i < 3; i++) expect((await g.send({ action: 'arena' })).body.ok).toBe(true);
    expect(g.hero().arenaLeft).toBe(0);
    const out = await g.send({ action: 'arena' });
    expect(out.body).toMatchObject({ ok: false, reason: 'no-turns' });
    expect(g.db.fights.filter((f) => f.kind === 'arena')).toHaveLength(3);
    g.clock = NZ_MIDNIGHT + 1000;
    expect((await g.send({ action: 'arena' })).body.ok).toBe(true);
    expect(g.hero().arenaLeft).toBe(2);
  });

  it('costs nothing to lose: no gold, health, bank or experience goes, and the fight is still used', async () => {
    const g = await ready({ ...WEAK, gold: 80, bank: 30, exp: 12 });
    const out = await g.send({ action: 'arena' });
    expect(out.body.result).toMatchObject({ outcome: 'lost', exp: 0 });
    expect(g.hero()).toMatchObject({ gold: 80, bank: 30, exp: 12, hp: 1, arenaWins: 0, arenaLeft: 2, level: 1 });
  });

  it('picks opponents near your level when there are any', async () => {
    const g = await ready({ ...STRONG, level: 6, exp: 2000 });
    for (let day = 1; day <= 3; day++) {
      g.patch({ arenaLeft: 3 });
      for (let i = 0; i < 3; i++) {
        const out = await g.send({ action: 'arena' });
        const level = out.body.result.opponent.level as number;
        const near = computerHeroes(1, 1).some((c) => Math.abs(c.hero.level - 6) <= 1);
        if (near) expect(Math.abs(level - 6)).toBeLessThanOrEqual(1);
      }
      g.patch({ arenaLeft: 3 });
    }
  });

  it('can meet a classmate’s saved hero, and nothing at all happens to the classmate', async () => {
    const g = await ready();
    const mate: Hero = { ...newHero('mage', '2026-10-19'), ...baseStats(1), hp: 20 };
    g.db.classmates.push({ player: '3a1b2c3d-0000-4000-8000-000000000001', name: 'Quiet Tui', hero: mate });
    const copy = structuredClone(g.db.classmates);
    let met = false;
    for (let seed = 1; seed < 400 && !met; seed++) {
      g.patch({ arenaLeft: 3 });
      g.forced.push(seed);
      const out = await g.send({ action: 'arena' });
      if (out.body.result.opponent.name === 'Quiet Tui') {
        met = true;
        expect(out.body.result.opponent.computer).toBe(false);
        expect(g.db.fights.at(-1)!.monster).toBe('pupil-3a1b2c3d0000');
      }
    }
    expect(met).toBe(true);
    expect(g.db.classmates).toEqual(copy);
  });

  it('never trusts a classmate’s hero that makes no sense, and never fights you against yourself', async () => {
    const g = await ready();
    g.db.classmates.push(
      { player: 'pupil-1', name: 'Broken', hero: { ...newHero('knight', 'x'), weapon: 99 } },
      { player: 'pupil-2', name: 'Strange', hero: { ...newHero('knight', 'x'), maxHp: Number.NaN } },
      { player: 'pupil-3', name: 'Missing', hero: null as unknown as Hero },
      { player: 'pupil-1', name: 'Me', hero: newHero('knight', 'x') },
    );
    for (let seed = 1; seed < 40; seed++) {
      g.patch({ arenaLeft: 3 });
      g.forced.push(seed);
      const out = await g.send({ action: 'arena' });
      expect(out.body.ok).toBe(true);
      expect(['Broken', 'Strange', 'Missing']).not.toContain(out.body.result.opponent.name);
    }
  });

  it('is refused without a hero, in the middle of a fight, from an old copy, or sent twice', async () => {
    const g = new Game();
    await g.send({ action: 'load' });
    expect((await g.send({ action: 'arena' })).body.reason).toBe('no-hero');
    await g.start();
    expect((await g.send({ action: 'arena' }, { version: 0 })).body.reason).toBe('stale');
    const id = crypto.randomUUID();
    expect((await g.send({ action: 'arena' }, { requestId: id })).body.ok).toBe(true);
    const twice = await g.send({ action: 'arena' }, { requestId: id, version: 1 });
    expect(twice.body.reason).toBe('duplicate');
    expect(g.hero().arenaLeft).toBe(2);
    await g.fight();
    expect((await g.send({ action: 'arena' })).body.reason).toBe('fight-open');
  });

  it('gives no points, but counts toward the arena achievement', async () => {
    const g = await ready();
    const scores = g.db.scores.length;
    await g.send({ action: 'arena' });
    expect(g.db.scores).toHaveLength(scores);
    expect((g.db.row!.extra.stats.arenaWins)).toBe(1);
  });
});

describe('the Daily News', () => {
  it('has the village line and the computer heroes’ deeds written once a day by whoever opens the game first', async () => {
    const g = new Game();
    const first = await g.send({ action: 'load' });
    expect(first.body.ok).toBe(true);
    const village = g.db.news.filter((n) => n.kind === 'village');
    expect(village).toHaveLength(1);
    expect(village[0].text).toBe(villageEventFor('2026-10-19'));
    const count = g.db.news.length;
    await g.send({ action: 'load' });
    await g.raw({ action: 'load' });
    expect(g.db.news).toHaveLength(count);
    g.clock = Date.parse('2026-10-22T00:00:00Z');
    await g.send({ action: 'load' });
    expect(g.db.news.filter((n) => n.kind === 'village')).toHaveLength(2);
    expect(g.db.news.filter((n) => n.kind === 'computer').every((n) => n.text.includes('(computer hero)'))).toBe(true);
  });

  it('says when a master is beaten, once, naming the pupil with {p} and the real master', async () => {
    const g = new Game();
    await g.start();
    g.patch({ ...STRONG, exp: 99999 });
    await g.refresh();
    const out = await g.send({ action: 'master-start', trial: [] });
    const open = out.body.state.openFight;
    const { actions, fight } = play(open.start);
    expect(fight.outcome).toBe('won');
    await g.send({ action: 'master-finish', fightId: open.id, actions });
    const line = g.db.news.find((n) => n.kind === 'master')!;
    expect(line.text).toBe('{p} beat Brother Bramble and reached level 2!'.replace('Brother Bramble', MASTERS[0].name));
    expect(line.player).toBe('pupil-1');
    expect(line.dedupe).toBe('master:pupil-1:2');
  });

  it('says when a pupil is flattened by a monster, only once a day, and not at all for a win', async () => {
    const g = new Game();
    await g.start();
    g.patch({ ...WEAK, gold: 10 });
    for (let i = 0; i < 3; i++) {
      const open = await g.fight();
      const { actions, fight } = play(open.start);
      expect(fight.outcome).toBe('lost');
      await g.send({ action: 'fight-finish', fightId: open.id, actions });
      g.patch({ ...WEAK, hp: 1 });
    }
    expect(g.db.news.filter((n) => n.kind === 'flattened')).toHaveLength(1);
    const win = new Game();
    await win.start();
    win.patch(STRONG);
    const open = await win.fight();
    await win.send({ action: 'fight-finish', fightId: open.id, actions: play(open.start).actions });
    expect(win.db.news.filter((n) => n.kind === 'flattened')).toHaveLength(0);
  });

  it('says when the dragon is beaten, and keeps it in the Hall of Heroes for the season', async () => {
    const g = new Game();
    await g.start();
    g.patch(DRAGON_SLAYER);
    await g.refresh();
    for (const stage of [1, 2, 3] as const) {
      const out = await g.send({ action: 'dragon-stage', stage, riddle: proof('place-value', MAX_LEVEL, true) });
      const open = out.body.state.openFight;
      await g.send({ action: 'dragon-finish', fightId: open.id, actions: play(open.start).actions });
    }
    expect(g.db.hall).toEqual([{ season: 1, kills: 1 }]);
    const line = g.db.news.find((n) => n.kind === 'dragon')!;
    expect(line.text).toContain('Red Dragon');
    expect(line.text).toContain('star number 1');
    expect(g.db.scores.at(-1)).toEqual({ forest: 0, master: 0, dragon: 1 });
  });

  it('has only words the code wrote: nothing a pupil sends can end up in a line', async () => {
    const g = new Game();
    await g.start();
    await g.send({ action: 'forest', note: '<b>hello classmates</b>', name: 'Evil Eve', text: 'buy my stuff' } as never);
    await g.send({ action: 'arena', text: '<script>x</script>', news: [{ kind: 'master', text: 'I am the best', dedupe: 'x' }] } as never);
    g.patch(STRONG);
    await g.refresh();
    await g.send({ action: 'arena' });
    for (const n of g.db.news) {
      expect(n.text).not.toMatch(/hello classmates|Evil Eve|buy my stuff|script|I am the best/);
    }
  });
});

describe('points and counts', () => {
  it('give the server’s own count of wins to score: a forest win is one, a master is one, nothing else is', async () => {
    const g = new Game();
    await g.start();
    g.patch(STRONG);
    const open = await g.fight();
    await g.send({ action: 'fight-finish', fightId: open.id, actions: play(open.start).actions });
    expect(g.db.scores).toEqual([{ forest: 1, master: 0, dragon: 0 }]);
    g.patch({ exp: 99999, masterTried: false });
    await g.refresh();
    const m = await g.send({ action: 'master-start', trial: [] });
    await g.send({ action: 'master-finish', fightId: m.body.state.openFight.id, actions: play(m.body.state.openFight.start).actions });
    expect(g.db.scores).toEqual([{ forest: 1, master: 0, dragon: 0 }, { forest: 0, master: 1, dragon: 0 }]);
    // Shopping, healing and the inn earn no points.
    const before = g.db.scores.length;
    await g.send({ action: 'inn', game: 'guess-start' });
    expect(g.db.scores).toHaveLength(before);
  });

  it('earn nothing for a lost fight or a master who won', async () => {
    const g = new Game();
    await g.start();
    g.patch(WEAK);
    const open = await g.fight();
    await g.send({ action: 'fight-finish', fightId: open.id, actions: play(open.start).actions });
    expect(g.db.scores).toHaveLength(0);
  });

  it('keep lifetime counts: forest wins, masters, best level, right answers and dragons', async () => {
    const g = new Game();
    await g.start();
    g.patch(STRONG);
    const open = await g.fight(true);
    const sizeUp = proof('add-sub', 1, true);
    await g.send({ action: 'fight-finish', fightId: open.id, actions: play(open.start).actions, sizeUp });
    expect(g.db.row!.extra.stats).toMatchObject({ forestWins: 1, riddles: 1, bestLevel: 1 });
    g.patch({ exp: 99999, masterTried: false });
    await g.refresh();
    const m = await g.send({ action: 'master-start', trial: [proof('add-sub', 1, true), proof('add-sub', 1, false), null] });
    await g.send({ action: 'master-finish', fightId: m.body.state.openFight.id, actions: play(m.body.state.openFight.start).actions });
    expect(g.db.row!.extra.stats).toMatchObject({ forestWins: 1, masterWins: 1, riddles: 2, bestLevel: 2 });
  });

  it('keep the lifetime counts through a new run, a new season and a change of class', async () => {
    const g = new Game();
    await g.start('knight');
    g.patch({ ...STRONG, level: 7, exp: 4000 });
    const open = await g.fight();
    await g.send({ action: 'fight-finish', fightId: open.id, actions: play(open.start).actions });
    const counts = { ...g.db.row!.extra.stats };
    expect(counts.forestWins).toBe(1);
    expect(counts.bestLevel).toBe(7);
    g.clock = Date.parse('2026-11-23T00:00:00Z');
    const fresh = (await g.refresh()) as LordState;
    expect(fresh.hero!.level).toBe(1);
    expect(fresh.stats).toEqual(counts);
    const mage = await g.send({ action: 'start-hero', heroClass: 'mage' });
    expect(mage.body.state.stats).toEqual(counts);
    expect(g.db.row!.extra.stats).toEqual(counts);
  });

  it('write the Hall of Heroes entry under the season the dragon was beaten in', async () => {
    const g = new Game();
    await g.start();
    g.clock = Date.parse('2026-11-23T00:00:00Z');
    await g.refresh();
    g.patch(DRAGON_SLAYER);
    await g.refresh();
    for (const stage of [1, 2, 3] as const) {
      const out = await g.send({ action: 'dragon-stage', stage });
      const open = out.body.state.openFight;
      await g.send({ action: 'dragon-finish', fightId: open.id, actions: play(open.start).actions });
    }
    expect(g.db.hall).toEqual([{ season: 2, kills: 1 }]);
  });
});

describe('the season countdown', () => {
  it('tells the screens how many days are left, down to the last day', async () => {
    const g = new Game();
    await g.start();
    g.clock = Date.parse('2026-11-18T00:00:00Z');
    expect((await g.refresh()).season).toMatchObject({ number: 1, dayOfSeason: 31, daysLeft: 4 });
    g.clock = Date.parse('2026-11-22T00:00:00Z');
    expect((await g.refresh()).season).toMatchObject({ number: 1, dayOfSeason: 35, daysLeft: 0 });
  });
});

describe('what the L.5 rules do not change', () => {
  it('still lets the duel use the engine’s own heroes: a hero’s duelist is its attack and defence with gear', () => {
    const hero = { ...newHero('knight', 'x'), weapon: 3, armour: 2 };
    const d = duelistOf(hero, 'You');
    expect(d.attack).toBeGreaterThan(hero.strength);
    expect(d.defence).toBeGreaterThan(hero.defence);
  });
});

describe('a fight left alone for a whole day', () => {
  const DAY3 = Date.parse('2026-10-21T00:00:00Z');

  it('is still waiting the next day, and counts as a loss after a whole day has gone by', async () => {
    const g = new Game();
    await g.start();
    g.patch({ gold: 80, bank: 30, exp: 12 });
    const open = await g.fight();
    g.clock = NZ_MIDNIGHT + 1000; // the next New Zealand day
    expect((await g.refresh()).openFight?.id).toBe(open.id);
    g.clock = DAY3;
    const out = await g.send({ action: 'load' });
    expect(out.body.ok).toBe(true);
    expect(out.body.result).toEqual({ abandoned: 'forest' });
    expect(out.body.state.openFight).toBeNull();
    expect(g.db.fights[0].status).toBe('abandoned');
    expect(g.hero()).toMatchObject({ gold: 0, bank: 30, exp: 12 });
    expect(g.hero().forestLeft).toBe(10); // a new day's turns; the abandoned fight's turn stays spent
    expect(g.db.events.at(-1)!.action === 'rollover' || g.db.events.some((e) => e.action === 'abandon')).toBe(true);
    // The pupil can go straight on.
    expect((await g.send({ action: 'forest' })).body.ok).toBe(true);
  });

  it('happens whatever the first request is, not only when the game is opened', async () => {
    const g = new Game();
    await g.start();
    await g.fight();
    g.clock = DAY3;
    const out = await g.send({ action: 'heal', hp: 1 }, { version: g.state!.version });
    expect(g.db.fights[0].status).toBe('abandoned');
    expect(out.body.reason === 'stale' || out.body.reason === 'rule' || out.body.ok).toBeTruthy();
  });

  it('heals you after an abandoned master fight, and sends you home after an abandoned dragon fight', async () => {
    const m = new Game();
    await m.start();
    m.patch({ exp: expNeeded(1), hp: 5, maxHp: 30 });
    await m.refresh();
    await m.send({ action: 'master-start', trial: [] });
    m.clock = DAY3;
    await m.send({ action: 'load' });
    expect(m.hero()).toMatchObject({ level: 1, hp: 30 });
    expect(m.db.fights[0].status).toBe('abandoned');

    const d = new Game();
    await d.start();
    d.patch(DRAGON_SLAYER);
    await d.refresh();
    await d.send({ action: 'dragon-stage', stage: 1 });
    d.clock = DAY3;
    const out = await d.send({ action: 'load' });
    expect(out.body.result.abandoned).toBe('dragon');
    expect(d.hero().level).toBe(MAX_LEVEL);
    expect(d.state!.dragon).toBeNull();
  });

  it('lets a new season start once the old fight is gone', async () => {
    const g = new Game();
    await g.start();
    await g.fight();
    g.clock = Date.parse('2026-11-23T00:00:00Z');
    const s = await g.refresh();
    expect(s.season.number).toBe(2);
    expect(s.openFight).toBeNull();
    expect(s.hero!.level).toBe(1);
  });
});
