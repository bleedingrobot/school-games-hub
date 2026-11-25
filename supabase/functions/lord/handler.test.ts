import { describe, expect, it } from 'vitest';
import { expNeeded } from '../../../shared/lord/data';
import { MAX_REQUESTS_PER_MINUTE } from './handler';
import { Game, STRONG, answer, play } from './testKit';

describe('the lord server function', () => {
  it('needs a signed-in student, and refuses things that are not requests, unknown actions and too many requests', async () => {
    const g = new Game();
    expect((await g.raw({ action: 'load' }, null)).status).toBe(401);
    expect((await g.raw({ action: 'load' }, 'fake')).status).toBe(401);
    expect((await g.raw('hello')).status).toBe(400);
    expect((await g.raw({ action: 'cheat' })).body).toMatchObject({ ok: false, reason: 'bad-request' });
    await g.start();
    expect((await g.raw({ action: 'forest', version: 1 })).body).toMatchObject({ ok: false, reason: 'bad-request' }); // no request id
    expect((await g.raw({ action: 'forest', version: 1, requestId: 'not-an-id' })).body).toMatchObject({ ok: false, reason: 'bad-request' });
    // Test tools are for teachers only: a student is turned away and it is noted.
    const tools = await g.send({ action: 'tools', tool: 'jump', value: 12 });
    expect(tools.body).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(g.hero().level).toBe(1);
    expect(g.db.refusals).toContainEqual({ reason: 'tools', action: 'tools' });
    const fresh = new Game();
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) await fresh.raw({ action: 'load' });
    expect((await fresh.raw({ action: 'load' })).status).toBe(429);
  });

  it('opens a waiting quest pouch on load: gold for five forest wins at the hero level, version moved, pouch in the reply', async () => {
    const g = new Game();
    await g.start();
    const asked: { version: number; perUnit: number }[] = [];
    let waiting = true;
    g.services.openPouches = async (_p, version, perUnit) => {
      asked.push({ version, perUnit });
      if (!waiting) return null;
      waiting = false;
      const amount = 5 * perUnit;
      g.patch({ gold: g.hero().gold + amount });
      g.db.row = { ...g.db.row!, version: version + 1 };
      return { amount, version: version + 1 };
    };
    const before = g.hero().gold;
    const versionBefore = g.db.row!.version;
    const out = await g.send({ action: 'load' });
    expect(asked[0]).toEqual({ version: versionBefore, perUnit: 11 }); // level 1: friendly(10 * 1.08)
    expect(out.body.pouch).toEqual({ amount: 55 });
    expect(out.body.state.hero.gold).toBe(before + 55);
    expect(out.body.state.version).toBe(versionBefore + 1);
    const again = await g.send({ action: 'load' });
    expect(again.body.pouch).toBeUndefined();
    expect(again.body.state.hero.gold).toBe(before + 55);
    expect(again.body.state.version).toBe(versionBefore + 1);
  });

  it('hands out a fight, uses a turn, and pays gold and experience only after the played actions check out', async () => {
    const g = new Game();
    await g.start();
    g.patch(STRONG);
    const open = await g.fight();
    expect(g.hero().forestLeft).toBe(9);
    expect(open.kind).toBe('forest');
    expect(g.db.fights).toHaveLength(1);
    const { actions, fight } = play(open.start);
    expect(fight.outcome).toBe('won');
    const goldBefore = g.hero().gold;
    const out = await g.send({ action: 'fight-finish', fightId: open.id, actions });
    expect(out.body.ok).toBe(true);
    expect(out.body.result).toMatchObject({ outcome: 'won', gold: fight.monster.gold, exp: fight.monster.exp });
    expect(g.hero().gold).toBe(goldBefore + fight.monster.gold);
    expect(g.hero().exp).toBe(fight.monster.exp);
    expect(g.hero().forestWins).toBe(1);
    expect(out.body.state.openFight).toBeNull();
    expect(g.db.fights[0]).toMatchObject({ status: 'finished' });
  });

  it('pays a finished fight once, refuses a tampered result, and pays what the replay says rather than what the browser says', async () => {
    // Tampered results are refused and pay nothing.
    const a = new Game();
    await a.start();
    a.patch(STRONG);
    const open = await a.fight();
    const { actions } = play(open.start);
    const goldBefore = a.hero().gold;
    const lies: unknown[] = [
      [],
      [...actions, { type: 'attack' }], // keeps going after it ended
      [{ type: 'skill', skill: 'zap' }, ...actions], // a skill a knight does not have
      'win',
      Array.from({ length: 400 }, () => ({ type: 'attack' })),
    ];
    for (const lie of lies) {
      const out = await a.send({ action: 'fight-finish', fightId: open.id, actions: lie });
      expect(out.body.ok).toBe(false);
      expect(a.hero().gold).toBe(goldBefore);
    }
    expect(a.db.fights[0].status).toBe('open');
    // The real result is paid; sending it again (same id or new) pays nothing more.
    const requestId = crypto.randomUUID();
    expect((await a.send({ action: 'fight-finish', fightId: open.id, actions }, { requestId })).body.ok).toBe(true);
    const gold = a.hero().gold;
    const exp = a.hero().exp;
    expect((await a.send({ action: 'fight-finish', fightId: open.id, actions }, { requestId })).body).toMatchObject({ ok: false, reason: 'duplicate' });
    expect((await a.send({ action: 'fight-finish', fightId: open.id, actions })).body).toMatchObject({ ok: false, reason: 'no-fight' });
    expect((await a.send({ action: 'fight-finish', fightId: crypto.randomUUID(), actions })).body).toMatchObject({ ok: false, reason: 'no-fight' });
    expect(a.hero().gold).toBe(gold);
    expect(a.hero().exp).toBe(exp);
    expect(a.db.events.filter((e) => e.action === 'fight-finish')).toHaveLength(1);

    // A browser that claims a win for a fight that is really lost is not believed.
    const g = new Game();
    await g.start();
    g.patch({ strength: 1, hp: 1, maxHp: 20, gold: 40 });
    const lost = await g.fight();
    const real = play(lost.start);
    expect(real.fight.outcome).toBe('lost');
    const out = await g.send({ action: 'fight-finish', fightId: lost.id, actions: real.actions, outcome: 'won', gold: 99999 });
    expect(out.body.result.outcome).toBe('lost');
    expect(g.hero().gold).toBe(0);
  });

  it('marks maths itself: the three trial questions (level and bonus only after the replay) and a wrong bank-interest answer', async () => {
    const g = new Game();
    await g.start();
    g.patch({ exp: expNeeded(1), ...STRONG, strength: 200 });
    await g.refresh();
    const strength = g.hero().strength;
    // Ladder questions from the pupil's maths (way A): each answer is marked and recorded once, and each mark is used once.
    const trial = await answer(g, 'master-trial', true, true, false);
    expect(Object.values(g.db.batches).flatMap((b) => b.answers.map((a) => a.correct))).toEqual([true, true, false]);
    const again = await g.send({ action: 'ask-check', no: trial[0].no, slot: 0, answer: -1 });
    expect(again.body.result.correct).toBe(true);
    expect((await g.send({ action: 'ask', moment: 'inn-guess' })).body.reason).toBe('bad-request');
    const out = await g.send({ action: 'master-start', trial: [trial[0], trial[1], trial[2]] });
    expect(out.body.ok).toBe(true);
    expect(out.body.result.trial).toEqual(['right', 'right', 'wrong']);
    expect(g.db.row!.extra.ask!.marks.every((m) => m?.used)).toBe(true);
    expect(g.hero().masterTried).toBe(true);
    const open = out.body.state.openFight;
    expect(open.kind).toBe('master');
    const { actions, fight } = play(open.start);
    expect(fight.outcome).toBe('won');
    const done = await g.send({ action: 'master-finish', fightId: open.id, actions });
    expect(done.body.result).toMatchObject({ outcome: 'won', level: 2 });
    expect(g.hero().level).toBe(2);
    expect(g.hero().strength).toBeGreaterThan(strength);
    expect(done.body.result.bonusStrength).toBeGreaterThan(0);
    expect(g.hero().hp).toBe(g.hero().maxHp);

    // The banker's question: a wrong answer earns nothing and is told the right answer.
    g.patch({ level: 4, bank: 259 });
    await g.refresh();
    await g.send({ action: 'bank', op: 'interest-ask' });
    const stored = g.db.row!.extra.interestAsk!.question;
    const wrong = await g.send({ action: 'bank', op: 'interest', answer: stored.answer + 1 });
    expect(wrong.body.result).toMatchObject({ interest: 0, right: false, answer: stored.answer });
    expect(g.hero().bank).toBe(259);
    expect(g.state!.interestDone).toBe(true);
  });
});
