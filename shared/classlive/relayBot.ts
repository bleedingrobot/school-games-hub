/**
 * A pretend Toon Flap Relay pupil (for `?pretend=30` and the tests). On its turn it flies like a pupil: a simple aim rule
 * for the next gap (worse pupils aim worse and react late), sending its flap list every 0.8 s as an iPad does. Off its
 * turn it answers questions and now and then spends its sparks on a perk or a trouble.
 */
import { BIRD_HALF, WALL_WIDTH } from '../toonflap/config';
import { encodeFlaps } from '../toonflap/engine';
import { markQuestion } from '../maths/serverQuestions';
import { flyStep, newFly, PERK_UNLOCK, PERKS, teamCourse, relayCourse, TROUBLES, TURN_STEPS, type Effect, type FlyState } from './relay';
import type { MemoryDb } from './memoryServices';
import { classLiveStep, type ClassLiveServices } from './server';
import type { Course } from '../toonflap/levels';

type Later = (fn: () => void | Promise<void>, ms: number) => void;

/** The aim rule: flap when the bird will soon be below the middle of the next gap. */
export function relayAim(course: Course, effects: readonly Effect[], s: FlyState, aimOff = 0): boolean {
  const wall = course.walls[s.nextWall];
  let target = 5;
  if (wall) {
    target = wall.gaps[0].y;
    const prev = course.walls[s.nextWall - 1];
    if (prev && prev.x + WALL_WIDTH >= s.x - BIRD_HALF - 0.1) target = prev.gaps[0].y;
  }
  const look: FlyState = { ...s, used: [...s.used] };
  let low = look.y;
  for (let k = 0; k < 4 && look.mode === 'fly'; k++) {
    flyStep(course, effects, look, false);
    low = Math.min(low, look.y);
  }
  return low < target + aimOff - 0.45 && s.vy < 1;
}

export function relayBot(o: { db: MemoryDb; services: ClassLiveServices; later: Later; now: () => number; rand: () => number }, room: number, id: string, skill: number) {
  const { db, services, later, now, rand } = o;
  let fly: { n: number; team: number; s: FlyState; flaps: number[]; sentAt: number; fxKey: string } | null = null;
  let busy = false;
  let late = 0;
  let aimOff = 0;
  const think = async () => {
    const row = db.rooms.get(room);
    if (!row || row.session.state === 'over') return;
    const g = row.session.game;
    if (g.kind !== 'relay' || row.startedAt === null) return later(think, 500);
    const at = now();
    const t = at - row.startedAt;
    const mine = g.mine[id];
    const r = g.race;
    const ti = g.teams.findIndex((tm) => tm.turn?.flyer === id);
    if (busy || !mine || !r) return later(think, 200);
    if (ti >= 0 && r.endT === null) {
      const team = g.teams[ti];
      const turn = team.turn!;
      const course = teamCourse(relayCourse(r.n, r.seed), team.effects);
      const fxKey = team.effects.map((e) => e.id).join(',');
      if (!fly || fly.n !== turn.n || fly.team !== ti) fly = { n: turn.n, team: ti, s: newFly(turn), flaps: [], sentAt: at, fxKey };
      if (fly.fxKey !== fxKey) {
        // New effects: fly the same flaps again on the new course (as the iPad does).
        const s = newFly(turn);
        let k = 0;
        while (s.t < fly.s.t && s.mode !== 'done') {
          const f = fly.flaps[k] === s.t;
          if (f) k++;
          if (flyStep(course, team.effects, s, f) === 'wait') break;
        }
        fly.s = s;
        fly.fxKey = fxKey;
      }
      // 200 ms of flying (12 steps); a hovering bird taps after a moment.
      for (let k = 0; k < 12 && fly.s.mode !== 'done' && fly.s.t < TURN_STEPS; k++) {
        let flap = false;
        if (fly.s.mode === 'hover') flap = rand() < 0.25;
        else {
          if (fly.s.t % 30 === 0) aimOff = (rand() * 2 - 1) * (1 - skill) * 1.6;
          flap = relayAim(course, team.effects, fly.s, aimOff);
          if (flap && late === 0 && rand() < (1 - skill) * 0.12) late = 1 + Math.floor(rand() * 9);
          if (late > 0) {
            late--;
            flap = false;
          }
        }
        if (flap) fly.flaps.push(fly.s.t);
        flyStep(course, team.effects, fly.s, flap);
      }
      const finished = fly.s.mode === 'done' || fly.s.t >= TURN_STEPS;
      if (at - fly.sentAt >= 800 || finished) {
        fly.sentAt = at;
        busy = true;
        await classLiveStep(services, id, { action: 'play', room, fly: encodeFlaps(fly.flaps), turn: turn.n, at: fly.s.t });
        busy = false;
      }
      return later(think, 200);
    }
    fly = null;
    if (r.endT === null && t >= r.goT && mine.sparks >= 2 && t - mine.sendAt > 10_000 && rand() < 0.04) {
      const perks = PERKS.filter((p) => PERK_UNLOCK[p] <= r.n);
      const kind = mine.sparks >= 3 && rand() < 0.45 ? TROUBLES[Math.floor(rand() * TROUBLES.length)] : perks[Math.floor(rand() * perks.length)];
      busy = true;
      await classLiveStep(services, id, { action: 'play', room, spend: kind });
      busy = false;
      return later(think, 300);
    }
    if (r.endT === null && t - mine.lastAt > 2500 + rand() * 3000) {
      busy = true;
      const asked = await classLiveStep(services, id, { action: 'ask', room });
      const q = asked.body.question as { slot: number } | undefined;
      if (q) {
        const kept = db.questions.get(`${room}:${id}`)?.find((k) => k.slot === q.slot);
        const right = markQuestion(kept?.question)?.answer ?? 0;
        await classLiveStep(services, id, { action: 'answer', room, slot: q.slot, answer: rand() < skill ? right : right + 1, ms: 2500 });
      }
      busy = false;
    }
    later(think, 250);
  };
  later(think, 200 + rand() * 400);
}
