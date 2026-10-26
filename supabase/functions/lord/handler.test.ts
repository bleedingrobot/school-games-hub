import { describe, expect, it } from 'vitest';
import { MAX_REQUESTS_PER_MINUTE } from './handler';
import { Game, STRONG, play, proof } from './testKit';

describe('the lord server function', () => {
  it('needs a signed-in student, and refuses junk, unknown actions, teacher tools and too many requests', async () => {
    const g = new Game();
    expect((await g.raw({ action: 'load' }, null)).status).toBe(401);
    expect((await g.raw({ action: 'load' }, 'fake')).status).toBe(401);
    expect((await g.raw('hello')).status).toBe(400);
    expect((await g.raw({ action: 'cheat' })).body).toMatchObject({ ok: false, reason: 'bad-request' });
    await g.start();
    expect((await g.raw({ action: 'forest', version: 1 })).body).toMatchObject({ ok: false, reason: 'bad-request' }); // no request id
    expect((await g.send({ action: 'tools', tool: 'jump', value: 12 })).body).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(g.hero().level).toBe(1);
    const fresh = new Game();
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) await fresh.raw({ action: 'load' });
    expect((await fresh.raw({ action: 'load' })).status).toBe(429);
  });
});

describe('a finished fight is paid once, and only if it checks out', () => {
  async function ready() {
    const g = new Game();
    await g.start();
    g.patch(STRONG);
    const open = await g.fight();
    const { actions } = play(open.start);
    return { g, open, actions };
  }

  it('counts the same finish sent twice once, whether the id is repeated or new', async () => {
    const { g, open, actions } = await ready();
    const requestId = crypto.randomUUID();
    const first = await g.send({ action: 'fight-finish', fightId: open.id, actions }, { requestId });
    expect(first.body.ok).toBe(true);
    const gold = g.hero().gold;
    const exp = g.hero().exp;
    const repeated = await g.send({ action: 'fight-finish', fightId: open.id, actions }, { requestId });
    expect(repeated.body).toMatchObject({ ok: false, reason: 'duplicate' });
    const fresh = await g.send({ action: 'fight-finish', fightId: open.id, actions });
    expect(fresh.body).toMatchObject({ ok: false, reason: 'no-fight' });
    expect(g.hero().gold).toBe(gold);
    expect(g.hero().exp).toBe(exp);
  });

  it('refuses tampered actions, and pays what the replay says rather than what the browser claims', async () => {
    const { g, open } = await ready();
    const gold = g.hero().gold;
    for (const lie of [[], 'win', Array.from({ length: 400 }, () => ({ type: 'attack' }))]) {
      const out = await g.send({ action: 'fight-finish', fightId: open.id, actions: lie });
      expect(out.body).toMatchObject({ ok: false, reason: 'tampered' });
    }
    expect(g.hero().gold).toBe(gold);

    const weak = new Game();
    await weak.start();
    weak.patch({ strength: 1, hp: 1, maxHp: 20, gold: 40 });
    const lost = await weak.fight();
    const real = play(lost.start);
    expect(real.fight.outcome).toBe('lost');
    const out = await weak.send({ action: 'fight-finish', fightId: lost.id, actions: real.actions, outcome: 'won', gold: 99999 });
    expect(out.body.result.outcome).toBe('lost');
    expect(weak.hero().gold).toBe(0);
  });

  it('counts a forged right answer to "size it up" as wrong, with no error shown', async () => {
    const g = new Game();
    await g.start();
    g.patch({ ...STRONG, strength: 900 });
    const open = await g.fight(true);
    expect(open.sizeUp).toBe(true);
    const lie = proof('add-sub', 1, false); // a wrong answer, with a "correct" flag stuck on
    const { actions } = play(open.start);
    const out = await g.send({ action: 'fight-finish', fightId: open.id, actions, sizeUp: { ...lie, correct: true } });
    expect(out.body.ok).toBe(true);
    expect(out.body.result.sizeUp).toBe('wrong');
  });
});
