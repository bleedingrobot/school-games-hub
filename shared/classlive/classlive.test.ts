import { describe, expect, it } from 'vitest';
import { markQuestion } from '../maths/serverQuestions';
import { classLiveStep } from './server';
import { PRETEND_CLASS, PRETEND_TEACHER, pretendClass, pretendClock, rng } from './pretendClass';
import { answerBox, apply, BODY, makeChain, newSerpent, SERPENT_LEVELS } from './serpent';
import { ARMS, armCounts, isTrue, laggingArm, linkOf, newStars, readFact, tryFact, type Anchor } from './stars';
import { lagHint } from '../../src/games/classlive/arms';

const k: Anchor = { x: 6, y: 7, p: 42 };
const arm = (text: string) => {
  const f = readFact(text);
  if (!f || !isTrue(f)) return 'false';
  const l = linkOf(f, k);
  return l === null ? 'none' : l === 'same' ? 'same' : l.arm;
};

describe('Star Web rules', () => {
  it('reads facts written many ways and checks them exactly, decimals too', () => {
    expect(readFact('12 x 7 = 84')).toEqual({ a: 1200, op: '×', b: 700, c: 8400 });
    expect(readFact('84=12×7')).toEqual({ a: 1200, op: '×', b: 700, c: 8400 });
    expect(readFact('6 × 7')).toBeNull();
    expect(readFact('abc')).toBeNull();
    for (const t of ['0.6×7=4.2', '6×3.5=21', '42÷0.6=70', '42−7=35', '4.2÷7=0.6']) expect(isTrue(readFact(t)!), t).toBe(true);
    for (const t of ['6×7=43', '0.6×7=42', '42÷6=8']) expect(isTrue(readFact(t)!), t).toBe(false);
  });

  it('puts each true fact on the right arm, and says how it links', () => {
    const want: Record<string, string> = {
      '6×7=42': 'same', '7×6=42': 'turn', '42÷6=7': 'divide', '42÷7=6': 'divide', '84÷6=14': 'divide', '420÷6=70': 'divide',
      '12×7=84': 'double', '6×14=84': 'double', '12×14=168': 'double', '42+42=84': 'double',
      '3×7=21': 'halve', '6×3.5=21': 'halve', '12×3.5=42': 'halve',
      '60×7=420': 'tens', '6×70=420': 'tens', '60×70=4200': 'tens', '0.6×7=4.2': 'tens', '600×7=4200': 'tens',
      '6×8=48': 'near', '5×7=35': 'near', '42+6=48': 'near', '42−7=35': 'near', '7×7=49': 'near',
      '21×2=42': 'wild', '168÷4=42': 'wild', '2+2=4': 'none', '42×1=42': 'none', '6×7=43': 'false',
    };
    for (const [t, a] of Object.entries(want)) expect(arm(t), t).toBe(a);
    const how = linkOf(readFact('12×7=84')!, k);
    expect(how !== 'same' && how?.how).toBe('6 → 12 is double, so 42 → 84.');
  });

  it('a new fact makes a star, the same fact again makes it glow, and every arm lit draws the creature', () => {
    const g = newStars(k, 'middle');
    let t = 0;
    const go = (who: string, text: string) => tryFact(g, who, text, (t += 2000));
    expect(go('a', '7×6=42')).toMatchObject({ ok: true, reply: { result: 'new' } });
    expect(go('b', '6×7=42')).toMatchObject({ reply: { result: 'same' } });
    expect(go('b', '7 × 6 = 42')).toMatchObject({ reply: { result: 'again' }, events: [{ type: 'glow' }] });
    expect(go('b', '6×7=40')).toMatchObject({ reply: { result: 'wrong' }, events: [] });
    expect(tryFact(g, 'b', '42÷6=7', t + 100)).toEqual({ ok: false, reason: 'too_soon' });
    const facts = ['42÷6=7', '42÷7=6', '84÷6=14', '12×7=84', '6×14=84', '24×7=168', '3×7=21', '6×3.5=21', '12×3.5=42',
      '60×7=420', '6×70=420', '0.6×7=4.2', '6×8=48', '5×7=35', '42+6=48', '21×2=42', '168÷4=42'];
    const events = facts.flatMap((f) => (go('c', f) as { events: { type: string }[] }).events.map((e) => e.type));
    expect(events).toContain('arm_lit');
    expect(g.creature).toBe(false); // wild has 2
    expect((go('d', '84÷2=42') as { events: { type: string }[] }).events.map((e) => e.type)).toEqual(['star', 'arm_lit', 'creature']);
    expect(ARMS.every((a) => g.stars.some((s) => s.arm === a))).toBe(true);
    // An arm lagging well behind the rest gets a hint on how, never the fact itself.
    expect(laggingArm(armCounts(g), g.stars.length)).toBeNull();
    const lagging = { turn: 1, divide: 3, double: 3, halve: 0, tens: 2, near: 3, wild: 2 };
    expect(laggingArm(lagging, 14)).toBe('halve');
    expect(laggingArm(lagging, 4)).toBeNull();
    expect(laggingArm({ ...lagging, halve: 2 }, 16)).toBeNull();
    for (const a of ARMS) expect(lagHint(a, k)).not.toMatch(/=|\b(21|84|420|48|36|3 ×|12 ×)\b/);
  });
});

describe('Serpent Chain rules', () => {
  it('makes whole-number chains in range, gives two tries then the working, and grows the tail and wakes the serpent', () => {
    for (const level of SERPENT_LEVELS) {
      for (let seed = 1; seed < 300; seed++) {
        const c = makeChain(level, rng(seed));
        c.steps.forEach((st, i) => expect(apply(c.values[i], st)).toBe(c.values[i + 1]));
        expect(c.values.every((v) => Number.isInteger(v) && v >= 0 && v <= 1000)).toBe(true);
      }
    }
    const g = newSerpent('gold', rng(3));
    const want = (i: number) => g.chain.values[i + 1];
    let t = 0;
    expect(answerBox(g, 'a', 0, want(0) + 1, (t += 1000), 1)).toMatchObject({ ok: true, reply: { result: 'again' } });
    expect(answerBox(g, 'a', 0, want(0) + 2, (t += 1000), 1)).toMatchObject({ reply: { result: 'shown', working: `${g.chain.values[0]} ${g.chain.steps[0].op === '-' ? '−' : g.chain.steps[0].op} ${g.chain.steps[0].by} = ${want(0)}` } });
    expect(answerBox(g, 'a', 0, want(0), t + 900, 1)).toEqual({ ok: false, reason: 'stale' });
    expect(answerBox(g, 'a', 1, want(1), t + 100, 1)).toEqual({ ok: false, reason: 'too_soon' });
    const types: string[] = [];
    for (let i = 1; i <= BODY; i++) {
      const out = answerBox(g, 'a', i, want(i), (t += 1000), 1);
      if (out.ok) types.push(...out.events.map((e) => e.type));
    }
    expect(types).toContain('awake');
    expect(types).toContain('head');
    expect(types).toContain('tail');
    expect(g.tail).toBe(4);
  });
});

describe('Class Live server', () => {
  it('a pretend class of 30 joins, plays a whole Star Web and nobody else can run it', async () => {
    const clock = pretendClock();
    const pc = pretendClass({ size: 30, seed: 7, clock, later: clock.later });
    const opened = await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'open', classId: PRETEND_CLASS, activity: 'stars', x: 6, y: 7, length: 5 });
    expect(opened.status).toBe(200);
    const room = opened.body.room as number;
    await pc.joinAll();
    expect(pc.db.rooms.get(room)!.view.players).toBe(30);
    // Pupils can't start it, and the screen (with names) is the teacher's only.
    expect((await classLiveStep(pc.services, pc.ids[0], { action: 'start', room })).status).toBe(403);
    expect((await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'start', room })).status).toBe(200);
    expect(JSON.stringify(pc.db.rooms.get(room)!.view)).not.toContain('Aroha');
    pc.play(room);
    await clock.run(clock.now() + 4 * 60_000);
    const live = pc.db.rooms.get(room)!;
    expect(live.session.game.kind === 'stars' && live.session.game.stars.length).toBeGreaterThan(15);
    expect(live.screen.people.find((p) => p.id === pc.ids[0])?.name).toBe('Aroha');
    expect(live.screen.events.length).toBeGreaterThan(5);
    // The clock ends it by itself at 5 minutes.
    await clock.run(clock.now() + 70_000);
    const late = await classLiveStep(pc.services, pc.ids[1], { action: 'play', room, fact: '7×6=42' });
    expect(late.status).toBe(409);
    expect(pc.db.rooms.get(room)!.session.state).toBe('over');
    expect(pc.db.rooms.get(room)!.screen.events.at(-1)).toMatchObject({ type: 'over', why: 'time' });
    // Paid once when it ended: everyone who played gets 3 points (5 with the sky creature), and more calls change nothing.
    const paid = [...pc.db.paid.values()];
    expect(paid).toHaveLength(1);
    expect(paid[0].players).toHaveLength(30);
    expect(paid[0].players.every((p) => p.points >= 3 && p.points <= 10)).toBe(true);
    await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'view', room });
    expect(pc.db.paid.size).toBe(1);
  });

  it('Mystery Mural: right answers earn flips, a question counts once, guesses open later and the teacher reveals it', async () => {
    const clock = pretendClock();
    const pc = pretendClass({ size: 30, seed: 11, clock, later: clock.later });
    const room = (await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'open', classId: PRETEND_CLASS, activity: 'mural' })).body.room as number;
    await pc.joinAll();
    await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'start', room });
    // Pupils never see the picture (only the choices) before the reveal.
    expect(pc.db.rooms.get(room)!.view.game).toMatchObject({ kind: 'mural', picture: null });
    const a = pc.ids[0];
    expect((await classLiveStep(pc.services, a, { action: 'play', room, tile: 0 })).body.reason).toBe('no_flips');
    clock.later(() => {}, 5000);
    await clock.run(clock.now() + 5000);
    const q = (await classLiveStep(pc.services, a, { action: 'ask', room })).body.question as { slot: number };
    const kept = pc.db.questions.get(`${room}:${a}`)!.find((k) => k.slot === q.slot)!;
    const answer = markQuestion(kept.question)!.answer;
    const first = await classLiveStep(pc.services, a, { action: 'answer', room, slot: q.slot, answer, ms: 2000 });
    expect(first.body).toMatchObject({ right: true, me: { game: { flips: 1 } } });
    expect((await classLiveStep(pc.services, a, { action: 'answer', room, slot: q.slot, answer, ms: 2000 })).status).toBe(409);
    expect(pc.db.answers.filter((x) => x.player === a)).toHaveLength(1);
    expect((await classLiveStep(pc.services, a, { action: 'play', room, tile: 0 })).status).toBe(200);
    pc.play(room);
    await clock.run(clock.now() + 4 * 60_000);
    const g = pc.db.rooms.get(room)!.session.game;
    if (g.kind !== 'mural') throw new Error('not a mural');
    expect(g.tiles.filter(Boolean).length).toBeGreaterThan(20);
    expect(g.solvers.length).toBeGreaterThan(0);
    expect((await classLiveStep(pc.services, pc.ids[2], { action: 'play', room, reveal: true })).status).not.toBe(200);
    expect((await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'reveal', room })).status).toBe(200);
    const view = pc.db.rooms.get(room)!.view.game;
    expect(view.kind === 'mural' && view.picture).toBe(g.picture);
  });
});
