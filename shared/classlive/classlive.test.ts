import { describe, expect, it } from 'vitest';
import { markQuestion } from '../maths/serverQuestions';
import { classLiveStep, cleanHost } from './server';
import { lockedBecause, type OpenGame } from './limits';
import { liveName } from '../liveNames';
import { memoryAutoRoom, memoryDb, memoryServices } from './memoryServices';
import { PRETEND_CLASS, PRETEND_TEACHER, pretendClass, pretendClock, rng } from './pretendClass';
import { answerBox, apply, BODY, makeChain, newSerpent, SERPENT_LEVELS } from './serpent';
import { gridFor, maxOpen, openCap, UNTIMED_PACE_MS, type MuralGame } from './mural';
import { ARMS, armCounts, isTrue, laggingArm, linkOf, newStars, readFact, tryFact, type Anchor } from './stars';
import { lagHint } from '../../src/games/classlive/arms';
import { boatAt, inBay, isShark, makeBayRound, newShark, quarterMid, quarterOf, sharkAdvance, spinAt, type BayRound, type SharkGame } from './shark';
import { advance, clampMove, cornerOf, freeAt, freshMine, grab, makeRound, ROLL_MS, SHOW_MS, MAX_SPEED, newCorners, rollerAt, rollersOf, startSpot, stepMove, type CornersGame } from './corners';

const k: Anchor = { x: 6, y: 7, p: 42 };
const arm = (text: string) => {
  const f = readFact(text);
  if (!f || !isTrue(f)) return 'false';
  const l = linkOf(f, k);
  return l === null ? 'none' : l === 'same' ? 'same' : l.arm;
};

describe('Star Web rules', () => {
  it('reads facts written many ways, puts each on the right arm, makes stars and glows, and lights the creature', () => {
    expect(readFact('12 x 7 = 84')).toEqual({ a: 1200, op: '×', b: 700, c: 8400 });
    expect(readFact('84=12×7')).toEqual({ a: 1200, op: '×', b: 700, c: 8400 });
    expect(readFact('6 × 7')).toBeNull();
    expect(readFact('abc')).toBeNull();
    for (const t of ['0.6×7=4.2', '6×3.5=21', '42÷0.6=70', '42−7=35', '4.2÷7=0.6']) expect(isTrue(readFact(t)!), t).toBe(true);
    for (const t of ['6×7=43', '0.6×7=42', '42÷6=8']) expect(isTrue(readFact(t)!), t).toBe(false);
    // Each true fact goes on the right arm, and says how it links.
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
    // A new fact makes a star, the same fact again makes it glow, and every arm lit draws the creature.
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
    // Every device looks at the room at once (they ask every 2 s instead of each listening to every room change, which
    // went over Realtime's limit with a class): all 30 see the game, and no names.
    const looks = await Promise.all(pc.ids.map((id) => classLiveStep(pc.services, id, { action: 'look', room })));
    expect(looks.every((l) => l.status === 200 && (l.body.view as { state: string; players: number }).state === 'live')).toBe(true);
    expect(JSON.stringify(looks.map((l) => l.body.view))).not.toContain('Aroha');
    expect((looks[0].body.me as { player: string }).player).toBe(pc.ids[0]);
    expect((await classLiveStep(pc.services, 'stranger', { action: 'look', room })).status).toBe(403);
    // The clock ends it by itself at 5 minutes.
    await clock.run(clock.now() + 70_000);
    const late = await classLiveStep(pc.services, pc.ids[1], { action: 'play', room, fact: '7×6=42' });
    expect(late.status).toBe(409);
    expect((late.body.view as { state: string }).state).toBe('over'); // the refusal brings the finished room back
    expect(pc.db.rooms.get(room)!.session.state).toBe('over');
    const after = await Promise.all(pc.ids.map((id) => classLiveStep(pc.services, id, { action: 'look', room })));
    expect(after.every((l) => (l.body.view as { state: string }).state === 'over')).toBe(true);
    expect(pc.db.rooms.get(room)!.screen.events.at(-1)).toMatchObject({ type: 'over', why: 'time' });
    // Paid once when it ended: everyone who played gets 3 points (5 with the sky creature), and more calls change nothing.
    const paid = [...pc.db.paid.values()];
    expect(paid).toHaveLength(1);
    expect(paid[0].players).toHaveLength(30);
    expect(paid[0].players.every((p) => p.points >= 3 && p.points <= 10)).toBe(true);
    await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'view', room });
    expect(pc.db.paid.size).toBe(1);

    // Serpent Chain ends by itself once every pupil has reached the head (and is paid then too).
    const sRoom = (await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'open', classId: PRETEND_CLASS, activity: 'serpent', level: 'green' })).body.room as number;
    const two = pc.ids.slice(0, 2);
    for (const id of two) await classLiveStep(pc.services, id, { action: 'join', room: sRoom });
    await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'start', room: sRoom });
    const chainOf = () => (pc.db.rooms.get(sRoom)!.session.game as { chain: { values: number[] } }).chain.values;
    for (const id of two) {
      for (let box = 0; box < BODY; box++) {
        await clock.run(clock.now() + 1000);
        await classLiveStep(pc.services, id, { action: 'play', room: sRoom, box, value: chainOf()[box + 1] });
      }
      expect(pc.db.rooms.get(sRoom)!.session.state).toBe(id === two[0] ? 'live' : 'over');
    }
    expect(pc.db.rooms.get(sRoom)!.screen.events.at(-1)).toMatchObject({ type: 'over', why: 'heads' });
    expect(pc.db.paid.size).toBe(2);
  });

  it('Mystery Mural: right answers flip a random tile, a question counts once, everyone picks a riddle at the end', async () => {
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
    expect(first.body).toMatchObject({ right: true, me: { game: { tiles: 1 } }, view: { game: { flipped: 1 } } });
    expect((await classLiveStep(pc.services, a, { action: 'answer', room, slot: q.slot, answer, ms: 2000 })).status).toBe(409);
    expect(pc.db.answers.filter((x) => x.player === a)).toHaveLength(1);
    pc.play(room);
    await clock.run(clock.now() + 60_000);
    const half = pc.db.rooms.get(room)!.session.game as MuralGame;
    // A full class answers faster than the pace: tiles flip steadily (about 26 a minute untimed), the rest queue up.
    expect(half.tiles.filter(Boolean).length).toBeGreaterThan(20);
    expect(half.tiles.filter(Boolean).length).toBeLessThanOrEqual(openCap(65_000, UNTIMED_PACE_MS, half.tiles.length));
    // The grid fits the class and the time (James, 25 Nov 2026): 30 pupils untimed (as 5 minutes) get 42 by 28.
    expect([half.cols, half.rows, half.tiles.length]).toEqual([42, 28, 1176]);
    expect(gridFor(24, 2)).toEqual({ cols: 24, rows: 16 });
    expect(gridFor(1, 2)).toEqual({ cols: 9, rows: 6 });
    expect(gridFor(30, 15)).toEqual({ cols: 60, rows: 40 });
    expect(half.queue!.length).toBeGreaterThan(0);
    await clock.run(clock.now() + 5 * 60_000);
    const g = pc.db.rooms.get(room)!.session.game;
    if (g.kind !== 'mural') throw new Error('not a mural');
    expect(g.tiles.filter(Boolean).length).toBe(maxOpen(g.tiles.length));
    // Shared fairly: everyone who answered gets tiles, nobody hogs them.
    const counts = Object.values(g.mine).map((m) => m.tiles);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(3);
    // No guessing while the tiles flip (James, 24 Nov 2026): everyone guesses once, at the end, from six riddles.
    expect(g.phase).toBe('flip');
    expect(g.solvers).toHaveLength(0);
    expect((await classLiveStep(pc.services, a, { action: 'play', room, guess: g.picture })).status).toBe(409);
    // Each pupil sees the tiles they flipped (on the picture), the class does not see the picture.
    const mine = (await classLiveStep(pc.services, a, { action: 'look', room })).body.me as { game: { myTiles: number[]; picture: string } };
    expect(mine.game.myTiles.length).toBe(g.mine[a].tiles);
    expect(mine.game.picture).toBe(g.picture);
    expect((await classLiveStep(pc.services, pc.ids[2], { action: 'play', room, reveal: true })).status).not.toBe(200);
    // The teacher's first press ends the flipping and opens the guessing.
    expect((await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'reveal', room })).status).toBe(200);
    expect(g.phase === undefined ? null : (pc.db.rooms.get(room)!.session.game as typeof g).phase).toBe('guess');
    expect(pc.db.rooms.get(room)!.view.game).toMatchObject({ kind: 'mural', phase: 'guess', picture: null });
    expect(g.choices).toHaveLength(6);
    expect(g.choices).toContain(g.picture);
    // One pick each; when everyone has picked it shows the picture and ends.
    await clock.run(clock.now() + 30_000);
    const done = pc.db.rooms.get(room)!;
    const dg = done.session.game as typeof g;
    expect(done.session.state).toBe('over');
    expect(Object.values(dg.mine).filter((m) => m.pick)).toHaveLength(30);
    expect(dg.solvers.length).toBeGreaterThan(0);
    expect(done.screen.events.at(-1)).toMatchObject({ type: 'over', why: 'guessed' });
    const view = done.view.game;
    expect(view.kind === 'mural' && view.picture).toBe(g.picture);
  });

  it('Mystery Mural: a 2 minute game flips until the time, then guesses for its own time, then shows the picture', async () => {
    const clock = pretendClock();
    const pc = pretendClass({ size: 4, seed: 5, clock, later: clock.later });
    const room = (await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'open', classId: PRETEND_CLASS, activity: 'mural', length: 2 })).body.room as number;
    expect(pc.db.rooms.get(room)!.session.lengthMin).toBe(2);
    await pc.joinAll();
    await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'start', room });
    clock.later(() => {}, 2 * 60_000 + 1000);
    await clock.run(clock.now() + 2 * 60_000 + 1000);
    await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'view', room });
    expect(pc.db.rooms.get(room)!.session).toMatchObject({ state: 'live', game: { phase: 'guess' } });
    // Nobody picks: the guessing's own time ends it.
    clock.later(() => {}, 50_000);
    await clock.run(clock.now() + 50_000);
    await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'view', room });
    expect(pc.db.rooms.get(room)!.session).toMatchObject({ state: 'over', game: { revealed: true } });
    expect(pc.db.rooms.get(room)!.screen.events.at(-1)).toMatchObject({ type: 'over', why: 'time' });
  });

  it('Four Corners: rounds run on the clock, the dice catches pupils by their saved spots, jail, power-ups, time ends it', async () => {
    // Rules: corners, moves clamped to the fastest speed, storms slow, a grab needs to be close.
    expect([cornerOf({ x: 0.1, y: 0.1 }), cornerOf({ x: 0.9, y: 0.95 }), cornerOf({ x: 0.5, y: 0.1 })]).toEqual([0, 2, null]);
    const cut = clampMove({ x: 0.5, y: 0.5, at: 0 }, { x: 0, y: 0 }, 500, []);
    expect(Math.hypot(cut.x - 0.5, cut.y - 0.5)).toBeCloseTo(MAX_SPEED * 0.5 + 0.05, 5);
    expect(clampMove({ x: 0.92, y: 0.4, at: 0 }, { x: 0.08, y: 0.6 }, 100, [{ a: { x: 0.08, y: 0.6 }, b: { x: 0.92, y: 0.4 } }])).toEqual({ x: 0.08, y: 0.6 });
    const g: CornersGame = newCorners('snow');
    const r = makeRound(g, 3, 0, rng(3), 20);
    expect([r.runEnd, makeRound(newCorners('snow', 3), 1, 0, rng(1), 5).runEnd, newCorners('space', 40).runS]).toEqual([10_000, 6000, 12]);
    expect(r.storms.length).toBeGreaterThan(0);
    const storm = r.storms[0];
    const slow = stepMove({ p: { x: storm.x, y: storm.y }, v: { x: 0, y: 0 } }, { x: 1, y: 0 }, 100, { ...r, teleports: [], ice: [], hole: false, roller: null }, 0, { boost: false, ghost: false });
    expect(slow.p.x - storm.x).toBeLessThan(0.3 * 0.1 * 0.5);
    // Rollers (round 7 on): two, one each way, through the corners; one knocks a pupil standing in its path flying.
    const rr = makeRound(newCorners('space'), 7, 0, rng(7), 20);
    expect(rollersOf(rr).map((x) => x.axis)).toEqual(['x', 'y']);
    expect(rollersOf(rr).every((x) => x.at < 0.26 || x.at > 0.74)).toBe(true);
    const ro = rr.roller!;
    const at = rollerAt(ro, 1000);
    const still = { storms: [], ice: [], teleports: [], roller: ro, hole: false, gate: null, runEnd: 99_999 };
    const hit = stepMove({ p: { x: at.x, y: at.y + 0.02 }, v: { x: 0, y: 0 } }, { x: 0, y: 0 }, 16, still, 1000, { boost: false, ghost: false });
    expect([hit.hitAt, hit.stun]).toEqual([1000, 1550]);
    let fly = hit;
    for (let i = 0; i < 30; i++) fly = stepMove(fly, { x: 0, y: -1 }, 20, { ...still, roller: null }, 1000 + i * 20, { boost: false, ghost: false });
    expect(Math.abs(fly.p.y - at.y)).toBeGreaterThan(0.3);
    expect(stepMove({ p: { x: at.x, y: at.y }, v: { x: 0, y: 0 } }, { x: 0, y: 0 }, 16, still, 1000, { boost: false, ghost: true }).hitAt).toBeUndefined();
    g.round = r;
    g.mine.a = { ...(await import('./corners')).freshMine(0) };
    const item = r.items[0];
    expect(grab(g, 'a', item.id, { x: item.x + 0.3, y: item.y }, 10)).toEqual({ ok: false, reason: 'far' });
    expect(grab(g, 'a', item.id, { x: item.x, y: item.y }, 10)).toMatchObject({ ok: true });
    expect(g.mine.a.held).toBe(item.power);

    // A pretend class of 20 runs about; the projector asks at each deadline.
    const clock = pretendClock();
    const pc = pretendClass({ size: 20, seed: 11, clock, later: clock.later });
    const room = (await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'open', classId: PRETEND_CLASS, activity: 'corners', map: 'jungle', length: 3 })).body.room as number;
    await pc.joinAll();
    await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'start', room });
    pc.play(room);
    const game = () => pc.db.rooms.get(room)!.session.game as CornersGame;
    let hidden = false;
    for (let s = 0; s < 3 * 60 + 40; s += 0.5) {
      await clock.run(clock.now() + 500);
      await classLiveStep(pc.services, PRETEND_TEACHER, { action: 'view', room });
      const gr = game().round;
      // Pupils' devices don't learn the corner until the dice lands (the projector's screen does).
      if (gr && gr.caught !== null && clock.now() - pc.db.rooms.get(room)!.startedAt! < gr.rollEnd) {
        const look = await classLiveStep(pc.services, pc.ids[0], { action: 'look', room });
        const pr = (look.body.view as { game: { round: { rolled: unknown } } }).game.round;
        hidden ||= pr.rolled === null;
      }
    }
    expect(hidden).toBe(true);
    const done = pc.db.rooms.get(room)!;
    expect(done.session.state).toBe('over');
    const cg = game();
    expect(cg.map).toBe('jungle');
    expect(cg.round!.n).toBeGreaterThan(6);
    const mines = Object.values(cg.mine);
    expect(mines.some((m) => m.safe > 0) && mines.some((m) => m.caught > 0)).toBe(true);
    expect(mines.some((m) => m.escapes > 0)).toBe(true);
    expect(mines.some((m) => m.grabs > 0)).toBe(true);
    // End-of-game stats: answers, streaks, timings and the dice's favourite corners are kept.
    expect(mines.some((m) => (m.right ?? 0) > 0 && (m.bestStreak ?? 0) > 0 && m.fastMs === 3000) && (cg.caughtAll ?? 0) > 0).toBe(true);
    expect((cg.rolls ?? []).reduce((a, b) => a + b, 0)).toBeGreaterThan(3);
    // The second half (from 1.5 of 3 minutes): change corners every round, or be caught for staying put.
    const halves = [cg.halfAt, makeRound({ ...newCorners('snow'), halfAt: 1000 }, 2, 999, rng(2), 5).swap, makeRound({ ...newCorners('snow'), halfAt: 1000 }, 2, 1000, rng(2), 5).swap];
    expect(halves).toEqual([90_000, undefined, true]);
    expect(cg.round!.swap).toBe(true);
    const sw = newCorners('snow');
    sw.mine = { a: { ...freshMine(0), lastCorner: 0 }, b: { ...freshMine(1), lastCorner: 0 } };
    sw.round = { ...makeRound(sw, 9, 0, rng(9), 2), swap: true, twist: null, rolled: [2] };
    advance(sw, sw.round.runEnd, ['a', 'b'], { a: { x: 0.05, y: 0.05 }, b: { x: 0.95, y: 0.05 } }, rng(1));
    expect([sw.round.stayed, sw.round.caught, sw.mine.b.lastCorner]).toEqual([['a'], ['a'], 1]);
    // Out of jail with all 3 right: free when the round after the one they sit out starts.
    sw.mine.a.jailRight = 3;
    expect([freeAt(sw, sw.mine.a), freeAt(sw, sw.mine.b)]).toEqual([sw.round.showEnd + 10_000 + ROLL_MS + SHOW_MS, null]);
    // Everyone let out of jail was put back in the middle (their saved spot moved by the server).
    const escaped = pc.ids.find((id) => cg.mine[id].escapes > 0)!;
    expect(pc.db.spots.get(room)![escaped]).toBeDefined();
    expect(done.screen.events.some((e) => e.type === 'roll')).toBe(true);
    expect(JSON.stringify(done.view)).not.toContain(pc.ids[0]);
    // Paid once: the podium gets 2 more points.
    const paid = [...pc.db.paid.values()].find((p) => p.activity === 'corners')!;
    expect(paid.players.filter((p) => p.champion).length).toBeGreaterThan(0);
    expect(paid.players.every((p) => p.points >= 1 && p.points <= 10)).toBe(true);
    expect(startSpot(0)).not.toEqual(startSpot(1));

    // Shark Bay (docs/SHARK-PLAN.md) runs on the same engine: quarters spin, the jetty and the struck quarter are caught,
    // and the pupils nearest a boat's middle fit under it (up to its seats).
    expect([quarterOf({ x: 0.2, y: 0.2 }, 0), quarterOf({ x: 0.8, y: 0.8 }, 0), quarterOf({ x: 0.5, y: 0.52 }, 0), quarterOf({ x: 0.2, y: 0.2 }, Math.PI / 2)]).toEqual([0, 2, null, 3]);
    const bayG = newShark('reef');
    const br = { ...makeBayRound(bayG, 2, 0, rng(5), 4), twist: null, rolled: [0 as const] };
    expect([makeBayRound(bayG, 1, 0, rng(1), 4).spinRate, br.spinRate !== 0, br.boats.length, br.boats[0].seats]).toEqual([0, true, 1, 2]);
    const boatSpot = boatAt(br.boats[0], br, br.runEnd);
    const tl = quarterMid(0, spinAt(br, br.runEnd));
    const near = (d: number) => ({ x: boatSpot.x + d, y: boatSpot.y });
    bayG.round = br;
    bayG.mine = Object.fromEntries(['j', 'q', 'b1', 'b2', 'b3'].map((id, i) => [id, freshMine(i)]));
    sharkAdvance(bayG, br.runEnd, Object.keys(bayG.mine), { j: { x: 0.5, y: 0.5 }, q: tl, b1: near(0), b2: near(0.01), b3: near(0.06) }, rng(2));
    const boatQ = quarterOf(near(0.06), spinAt(br, br.runEnd));
    expect(br.caught).toEqual(['j', 'q', ...(boatQ === 0 ? ['b3'] : [])]);
    expect([[...(br as BayRound).boated!].sort(), (bayG.mine.b1 as { boats?: number }).boats]).toEqual([['b1', 'b2'], 1]);
    expect(inBay({ x: 0, y: 0 }).x).toBeGreaterThan(0.1);
    // A pretend class plays a 2-minute game; Shark Bay pays its own trophies, not Four Corners'.
    const sc = pretendClass({ size: 12, seed: 4, clock, later: clock.later });
    const sroom = (await classLiveStep(sc.services, PRETEND_TEACHER, { action: 'open', classId: PRETEND_CLASS, activity: 'shark', map: 'pirate', length: 2 })).body.room as number;
    await sc.joinAll();
    await classLiveStep(sc.services, PRETEND_TEACHER, { action: 'start', room: sroom });
    sc.play(sroom);
    for (let s = 0; s < 2 * 60 + 40; s += 0.5) {
      await clock.run(clock.now() + 500);
      await classLiveStep(sc.services, PRETEND_TEACHER, { action: 'view', room: sroom });
    }
    const sg = sc.db.rooms.get(sroom)!.session.game as SharkGame;
    expect([sc.db.rooms.get(sroom)!.session.state, sg.bay, isShark(sg), sg.round!.n > 4]).toEqual(['over', 'pirate', true, true]);
    expect(Object.values(sg.mine).some((m) => m.caught > 0) && Object.values(sg.mine).some((m) => m.safe > 0)).toBe(true);
    const spaid = [...sc.db.paid.values()].find((p) => p.activity === 'shark')!;
    expect(spaid.players.every((p) => p.safe === 0 && p.extra && p.extra.shark_safe >= 0)).toBe(true);
    expect(spaid.players.some((p) => (p.extra?.shark_safe ?? 0) > 0)).toBe(true);
  });

  it('a lobby game: any pupil of the school joins by its room or code; a class game and other schools stay closed', async () => {
    const T = 'teacher-1', A = '00000000-0000-4000-8000-00000000000a', B = '00000000-0000-4000-8000-00000000000b', FAR = '00000000-0000-4000-8000-0000000000ff';
    const db = memoryDb({
      pupils: [{ id: 'ana', name: 'Brave Kiwi 7', classId: A }, { id: 'bo', name: 'Brave Tui 7', classId: B }, { id: 'cy', name: 'Bob Lee', classId: B }, { id: 'di', name: 'Di', classId: FAR }],
      teachers: { [T]: [A] }, schools: { [FAR]: 2 },
    });
    let now = 1_000_000;
    const sv = memoryServices(db, { now: () => now, random: rng(3) });
    expect(cleanHost('  Mr  Riley!! ')).toBe('Mr Riley');
    // Limits (James, 26 Nov 2026 NZ): one live game at a time, of any kind; the class's own game doesn't count.
    const ghost: OpenGame = { room: 9, kind: 'classlive', activity: 'ghost', name: 'Ghost Tag', moving: true, classId: B, who: 'Room 5' };
    const duel: OpenGame = { room: 10, kind: 'showdown', activity: 'showdown', name: 'Class Showdown', moving: false, classId: FAR, who: 'Room 9' };
    expect(lockedBecause('clash', [ghost], A)).toContain('Room 5 (Ghost Tag)');
    expect(lockedBecause('clash', [ghost], B)).toBeNull();
    expect(lockedBecause('serpent', [ghost], A)).toContain('Only one live game');
    expect(lockedBecause('showdown', [duel], A)).toContain('Room 9 (Class Showdown)');
    expect(lockedBecause('serpent', [], A)).toBeNull();
    db.openGames = [ghost];
    const refused = await classLiveStep(sv, T, { action: 'open', classId: A, activity: 'lava' });
    expect([refused.status, refused.body.reason]).toEqual([409, 'locked']);
    db.openGames = [];
    expect(cleanHost('1234')).toBeNull();
    expect((await classLiveStep(sv, T, { action: 'open', classId: A, activity: 'mural', where: 'lobby' })).status).toBe(400);
    // A class game: another class can't join it, even knowing the room.
    const cls = (await classLiveStep(sv, T, { action: 'open', classId: A, activity: 'mural' })).body as { room: number; screen: { lobby: unknown } };
    expect(cls.screen.lobby).toBeNull();
    expect((await classLiveStep(sv, 'bo', { action: 'join', room: cls.room })).status).toBe(403);
    // Joining a running class game late with the code on the big screen: the class only.
    const late = (cls.screen as unknown as { joinCode: string }).joinCode;
    expect(late).toMatch(/^\d{4}$/);
    await classLiveStep(sv, T, { action: 'start', room: cls.room });
    expect((await classLiveStep(sv, 'ana', { action: 'join', code: late })).body.room).toBe(cls.room);
    expect((await classLiveStep(sv, 'bo', { action: 'join', code: late })).body.reason).toBe('bad-code');
    // Open in the lobby: a code on the screen, and the host's words.
    const lob = (await classLiveStep(sv, T, { action: 'open', classId: A, activity: 'serpent', where: 'lobby', host: 'Mr Riley' })).body as { room: number; screen: { lobby: { code: string; host: string } } };
    expect(lob.screen.lobby.host).toBe('Mr Riley');
    expect(lob.screen.lobby.code).toMatch(/^\d{4}$/);
    expect((await classLiveStep(sv, 'ana', { action: 'join' })).body.room).toBe(lob.room); // the class finds it as before
    expect((await classLiveStep(sv, 'bo', { action: 'join', room: lob.room })).status).toBe(200); // the home page's button
    const byCode = await classLiveStep(sv, 'cy', { action: 'join', code: lob.screen.lobby.code });
    expect(byCode.body.room).toBe(lob.room);
    expect((byCode.body.view as { lobby: { host: string } }).lobby.host).toBe('Mr Riley');
    expect((await classLiveStep(sv, 'cy', { action: 'look', room: lob.room })).status).toBe(200);
    expect((await classLiveStep(sv, 'bo', { action: 'join', code: '00' })).body.reason).toBe('bad-code');
    // Another school: not by room, not by code.
    expect((await classLiveStep(sv, 'di', { action: 'join', room: lob.room })).status).toBe(403);
    expect((await classLiveStep(sv, 'di', { action: 'join', code: lob.screen.lobby.code })).body.reason).toBe('bad-code');
    expect(db.rooms.get(lob.room)!.session.order).toEqual(['ana', 'bo', 'cy']);
    // Names (James, 25 Nov 2026 NZ): an own name as it is, a made-up name as first word + number, whole if two clash.
    expect(liveName('Calm Fox 9')).toBe('Calm 9');
    const named = (await classLiveStep(sv, T, { action: 'view', room: lob.room })).body as { screen: { people: { name: string }[] } };
    expect(named.screen.people.map((p) => p.name)).toEqual(['Brave Kiwi 7', 'Brave Tui 7', 'Bob Lee']);
    expect(((await classLiveStep(sv, 'cy', { action: 'look', room: lob.room })).body.me as { name: string }).name).toBe('Bob Lee');
    // A finished lobby game's code is free again.
    await classLiveStep(sv, T, { action: 'end', room: lob.room });
    now += 1000;
    expect((await classLiveStep(sv, 'bo', { action: 'join', code: lob.screen.lobby.code })).body.reason).toBe('bad-code');

    // A game the server opened at a set time (docs/plans/classlive-auto/PLAN.md): the school joins, it starts at its time
    // with enough players, ends on its clock and pays; with too few it is called off; no teacher can run it.
    const auto = memoryAutoRoom(db, now, { activity: 'serpent', lengthMin: 2, min: 2, startsAt: now + 60_000, code: '4321' });
    const joined = await classLiveStep(sv, 'ana', { action: 'join', room: auto });
    expect(joined.body.view).toMatchObject({ state: 'lobby', game: { kind: 'serpent' }, auto: { min: 2, calledOff: false }, padMusic: true });
    expect((await classLiveStep(sv, 'bo', { action: 'join', code: '4321' })).body.room).toBe(auto);
    expect((await classLiveStep(sv, 'di', { action: 'join', room: auto })).status).toBe(403);
    expect((await classLiveStep(sv, T, { action: 'view', room: auto })).status).toBe(403);
    expect((await classLiveStep(sv, 'ana', { action: 'look', room: auto })).body.view).toMatchObject({ state: 'lobby' });
    now += 60_000;
    expect((await classLiveStep(sv, 'bo', { action: 'look', room: auto })).body.view).toMatchObject({ state: 'live', startedAt: now });
    now += 2 * 60_000;
    expect((await classLiveStep(sv, 'ana', { action: 'look', room: auto })).body.view).toMatchObject({ state: 'over' });
    expect([...db.paid.keys()].some((k) => k.startsWith(`${auto}:`))).toBe(true);
    const few = memoryAutoRoom(db, now, { activity: 'mural', lengthMin: 5, min: 3, startsAt: now + 1000, code: '5555' });
    await classLiveStep(sv, 'cy', { action: 'join', code: '5555' });
    now += 1000;
    expect((await classLiveStep(sv, 'cy', { action: 'look', room: few })).body.view).toMatchObject({ state: 'over', auto: { calledOff: true } });
    expect([...db.paid.keys()].some((k) => k.startsWith(`${few}:`))).toBe(false);
    // Kids vote: three games to pick from, one changeable vote each, the most votes is the game that starts.
    const ballot = memoryAutoRoom(db, now, { activity: 'serpent', lengthMin: 5, min: 2, startsAt: now + 30_000, code: '7777', vote: true });
    const seen = (await classLiveStep(sv, 'ana', { action: 'join', room: ballot })).body.view as { auto: { vote: { choices: string[] } } };
    const [a1, a2] = seen.auto.vote.choices;
    expect(new Set(seen.auto.vote.choices).size).toBe(3);
    await classLiveStep(sv, 'bo', { action: 'join', room: ballot });
    await classLiveStep(sv, 'ana', { action: 'vote', room: ballot, pick: a1 });
    await classLiveStep(sv, 'ana', { action: 'vote', room: ballot, pick: a2 });
    expect((await classLiveStep(sv, 'bo', { action: 'vote', room: ballot, pick: a2 })).body.view).toMatchObject({ auto: { vote: { counts: [0, 2, 0] } } });
    expect((await classLiveStep(sv, 'bo', { action: 'vote', room: ballot, pick: 'stars' })).status).toBe(400);
    now += 30_000;
    expect((await classLiveStep(sv, 'ana', { action: 'look', room: ballot })).body.view).toMatchObject({ state: 'live', activity: a2, auto: { vote: { winner: a2 } } });
    expect((await classLiveStep(sv, 'bo', { action: 'vote', room: ballot, pick: a1 })).status).toBe(409);
  });
});
