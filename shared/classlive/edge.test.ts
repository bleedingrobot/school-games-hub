import { describe, expect, it } from 'vitest';
import { EDGE_EVERYONE, EDGE_TEACHERS, EdgeRoom, edgeFor, edgeSync, ghostSync, makeTicket, readTicket, type EdgeServices } from './edge';
import type { GhostGame } from './ghost';
import { memoryAutoRoom } from './memoryServices';
import { PRETEND_CLASS, PRETEND_TEACHER, pretendClass, pretendClock } from './pretendClass';
import { classLiveStep } from './server';

describe('Class Live on Cloudflare (pilot)', () => {
  it('which games run on Cloudflare (set-time ones too), and what each game shows: every spot, or Glitches\' names and the dark', async () => {
    expect(edgeFor('any-teacher', 'ghost')).toBe(EDGE_EVERYONE);
    expect(edgeFor(EDGE_TEACHERS[0], 'ghost')).toBe(true);
    expect(edgeFor(EDGE_TEACHERS[0], 'corners')).toBe(false);
    const clock = pretendClock();
    const pc = pretendClass({ size: 4, seed: 5, clock, later: () => undefined });
    const cf = new EdgeRoom();
    const edge: EdgeServices = { allowed: () => false, positions: async () => cf.positions(), sync: async (_r, s) => cf.applySync(s, clock.now()), ticket: async () => ({ url: '', ticket: '' }) };
    const sv = { ...pc.services, edge };
    for (const [activity, on] of [['ghost', true], ['corners', false]] as const) {
      const room = memoryAutoRoom(pc.db, clock.now(), { activity, lengthMin: 2, min: 2, startsAt: clock.now() + 60_000, code: activity === 'ghost' ? '1111' : '2222' });
      await classLiveStep(sv, pc.ids[0], { action: 'join', room });
      expect(pc.db.rooms.get(room)!.session.edge).toBe(on ? true : undefined);
    }
    const corners = edgeSync(3, { state: 'live', order: ['a', 'b'], game: { kind: 'corners' } }, 0, []);
    expect(corners).toMatchObject({ view: 'all', width: 1, roles: { a: [0, 0, 0, 0], b: [0, 0, 0, 0] } });
    const room = new EdgeRoom();
    room.applySync(corners, 0);
    room.move('a', 0.2, 0.2, 0);
    room.move('b', 0.8, 0.8, 0);
    expect(room.frameFor('a', 100)).toEqual({ spots: [[0.2, 0.2], [0.8, 0.8]] });

    const crew = { kind: 'crew', round: { lightsTo: 0 }, mine: {
      a: { glitch: true, drone: false, cameraTo: 0, nick: 'Bolt' },
      b: { glitch: true, drone: false, cameraTo: 0 },
      c: { glitch: false, drone: false, cameraTo: 0, nick: 'Cog' },
    } };
    const people = { a: { name: 'Ann Lee', colour: 1 }, b: { name: 'Ben Ho', colour: 2 }, c: { name: 'Cat', colour: 3 } };
    const sync = edgeSync(4, { state: 'live', order: ['a', 'b', 'c'], game: crew, players: people } as never, 0, []);
    const r = new EdgeRoom();
    r.applySync(sync, 0);
    r.move('a', 0.5, 0.5, 0);
    r.move('b', 0.55, 0.5, 0);
    r.move('c', 0.9, 0.9, 0);
    expect(r.frameFor('a', 100)).toEqual({ me: { glitch: true, drone: false }, spots: [[0.55, 0.5, 2, 'Ben', 2], [0.9, 0.9, 0, 'Cog', 3]] });
    expect((r.frameFor('c', 100) as { spots: unknown[][] }).spots.map((p) => p[2])).toEqual([0, 0]);
    // Lights out: the crew see only who is near; Glitches still see everyone.
    r.applySync({ ...sync, crew: { ...sync.crew!, lightsTo: 5000 } }, 200);
    r.move('c', 0.6, 0.5, 1000);
    expect((r.frameFor('c', 1100) as { spots: unknown[] }).spots).toHaveLength(2);
    r.move('c', 0.95, 0.95, 2000);
    expect((r.frameFor('c', 2100) as { spots: unknown[] }).spots).toHaveLength(0);
    expect((r.frameFor('a', 2100) as { spots: unknown[] }).spots).toHaveLength(2);
  });

  it('tickets, the speed limit, teleports and what each device may see', async () => {
    const tk = await makeTicket('sec', { r: 7, u: 'a', k: 'p', e: 5000 });
    expect(await readTicket('sec', tk, 7, 1000)).toMatchObject({ u: 'a', k: 'p' });
    expect([await readTicket('sec', tk, 8, 1000), await readTicket('other', tk, 7, 1000), await readTicket('sec', tk, 7, 6000), await readTicket('sec', `${tk}x`, 7, 1000)]).toEqual([null, null, null, null]);

    const room = new EdgeRoom();
    expect(room.move('a', 0.5, 0.5, 0)).toBe(false); // nothing synced yet
    const roles = { a: [0, 0, 0, 0], b: [1, 0, 0, 0], c: [0, 9000, 0, 0] } as Record<string, [number, number, number, number]>;
    room.applySync({ room: 1, startedAt: 0, live: true, maxSpeed: 0.6, teleports: [{ a: { x: 0.1, y: 0.1 }, b: { x: 0.9, y: 0.9 } }], roles, places: [] }, 0);
    expect(room.move('zz', 0.5, 0.5, 0)).toBe(false); // not a player
    room.move('a', 0.5, 0.5, 1000);
    expect(room.move('a', 0.9, 0.5, 1030)).toBe(false); // too soon
    room.move('a', 0.9, 0.5, 1100); // 0.1 s: at most 0.06 + 0.05
    expect(room.spots.get('a')!.x).toBeCloseTo(0.61, 5);
    room.move('a', 0.1, 0.1, 6000);
    room.move('a', 0.9, 0.88, 6100); // through the teleport
    expect(room.spots.get('a')!.x).toBe(0.9);
    room.move('b', 0.85, 0.85, 6000);
    room.move('c', 0.88, 0.9, 6000);
    // A pupil sees the ghost, not the invisible pupil; the ghost with a lit lantern sees them near.
    expect(room.pupilView('a', 6200)).toEqual({ me: { ghost: false }, spots: [[0.85, 0.85, 1]] });
    roles.b[3] = 8000;
    expect(room.pupilView('b', 6200).spots.map((s) => s[2]).sort()).toEqual([0, 3]);
    expect(Object.keys(room.teacherView()).sort()).toEqual(['a', 'b', 'c']);
    // The server moves a pupil: an old far spot from their device is dropped, not dragged back.
    room.applySync({ room: 1, startedAt: 0, live: true, maxSpeed: 0.6, teleports: [], roles, places: [{ player: 'a', x: 0.2, y: 0.2 }] }, 7000);
    expect(room.move('a', 0.9, 0.88, 7200)).toBe(false);
    expect(room.spots.get('a')).toMatchObject({ x: 0.2, y: 0.2 });
  });

  it("a pilot room syncs Cloudflare, catches from its spots, and gives tickets only to the room's people", async () => {
    const clock = pretendClock();
    const pc = pretendClass({ size: 6, seed: 3, clock, later: () => undefined });
    const cf = new EdgeRoom();
    const edge: EdgeServices = {
      allowed: (teacher, activity) => teacher === PRETEND_TEACHER && activity === 'ghost',
      positions: async () => cf.positions(),
      sync: async (_room, s) => cf.applySync(s, clock.now()),
      ticket: async (room, who, kind) => ({ url: 'wss://edge.test/room', ticket: await makeTicket('s', { r: room, u: who, k: kind, e: clock.now() + 1000 }) }),
    };
    const kept: unknown[] = [];
    const sv = { ...pc.services, edge, saveStats: async (...a: unknown[]) => void kept.push(a) };
    // Another game, or Ghost Tag with "School server" picked, stays on the database.
    for (const body of [{ activity: 'shark' }, { activity: 'ghost', edge: false }]) {
      const plain = await classLiveStep(sv, PRETEND_TEACHER, { action: 'open', classId: PRETEND_CLASS, length: 3, ...body });
      expect(pc.db.rooms.get(plain.body.room as number)!.session.edge).toBeUndefined();
      await classLiveStep(sv, PRETEND_TEACHER, { action: 'end', room: plain.body.room });
    }
    const room = (await classLiveStep(sv, PRETEND_TEACHER, { action: 'open', classId: PRETEND_CLASS, activity: 'ghost', map: 'ship', length: 3 })).body.room as number;
    for (const id of pc.ids) await classLiveStep(sv, id, { action: 'join', room });
    expect((await classLiveStep(sv, pc.ids[0], { action: 'look', room })).body.view).toMatchObject({ edge: true });
    expect(Object.keys(cf.sync!.roles).sort()).toEqual([...pc.ids].sort());
    const tk = await classLiveStep(sv, pc.ids[0], { action: 'edge', room });
    expect(tk.status).toBe(200);
    expect((await readTicket('s', tk.body.ticket as string, room, clock.now()))?.k).toBe('p');
    expect((await classLiveStep(sv, PRETEND_TEACHER, { action: 'edge', room })).status).toBe(200);
    expect((await classLiveStep(sv, 'someone-else', { action: 'edge', room })).status).toBe(403);

    await classLiveStep(sv, PRETEND_TEACHER, { action: 'start', room });
    await classLiveStep(sv, PRETEND_TEACHER, { action: 'view', room });
    const g = () => pc.db.rooms.get(room)!.session.game as GhostGame;
    const r = g().round!;
    // The round's placings went to Cloudflare, not the database; the room knows the ghost.
    expect(cf.spots.size).toBe(pc.ids.length);
    expect(pc.db.spots.get(room) ?? {}).toEqual({});
    const [ghost] = r.starters;
    expect(cf.sync!.roles[ghost][0]).toBe(1);
    // The wide map: Cloudflare keeps spots across its whole width, no further.
    expect(cf.sync!.width).toBe(1.6);
    cf.spots.set(ghost, { x: 1.5, y: 0.5, at: 0, placedAt: null });
    cf.move(ghost, 1.9, 0.5, 2000);
    expect(cf.spots.get(ghost)!.x).toBe(1.6);
    // The hunt: the ghost runs onto a pupil (spots on Cloudflare only) and the server's check catches them.
    const prey = pc.ids.find((id) => id !== ghost)!;
    await clock.run(pc.db.rooms.get(room)!.startedAt! + r.startAt + 200);
    const p = cf.spots.get(prey)!;
    cf.spots.set(ghost, { x: p.x + 0.01, y: p.y, at: clock.now(), placedAt: null });
    await classLiveStep(sv, PRETEND_TEACHER, { action: 'view', room });
    expect(g().mine[prey].ghost).toBe(true);
    expect(cf.sync!.roles[prey][0]).toBe(1);
    expect(ghostSync(room, pc.db.rooms.get(room)!.session, 0, []).live).toBe(true);
    // Connection numbers for the before-and-after: only known numbers are kept, only from the room's people.
    expect((await classLiveStep(sv, prey, { action: 'stats', room, part: 'pad', version: 'edge', stats: { rttP50: 12.34, name: 'x', calls: 50 } })).status).toBe(200);
    expect(kept).toEqual([[room, prey, 'pad', 'edge', { rttP50: 12.3, calls: 50 }]]);
    expect((await classLiveStep(sv, 'someone-else', { action: 'stats', room, part: 'pad', version: 'edge', stats: {} })).status).toBe(403);
  });

});

