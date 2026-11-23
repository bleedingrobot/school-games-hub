import { describe, expect, it } from 'vitest';
import { classLiveStep } from './server';
import { PRETEND_CLASS, PRETEND_TEACHER, pretendClass, pretendClock } from './pretendClass';
import { ARMS, isTrue, linkOf, newStars, readFact, tryFact, type Anchor } from './stars';

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
    expect(live.session.game.stars.length).toBeGreaterThan(15);
    expect(live.screen.people.find((p) => p.id === pc.ids[0])?.name).toBe('Aroha');
    expect(live.screen.events.length).toBeGreaterThan(5);
    // The clock ends it by itself at 5 minutes.
    await clock.run(clock.now() + 70_000);
    const late = await classLiveStep(pc.services, pc.ids[1], { action: 'play', room, fact: '7×6=42' });
    expect(late.status).toBe(409);
    expect(pc.db.rooms.get(room)!.session.state).toBe('over');
    expect(pc.db.rooms.get(room)!.screen.events.at(-1)).toMatchObject({ type: 'over', why: 'time' });
  });
});
