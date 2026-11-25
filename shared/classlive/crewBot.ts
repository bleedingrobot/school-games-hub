/**
 * Glitches in memory: the database's classlive_crew_move (`memoryCrewMove`) and a pretend pupil (`crewBot`) for the
 * `?pretend=30` preview and the tests (docs/CREW-PLAN.md).
 */
import { markQuestion } from '../maths/serverQuestions';
import { canAsk, LIGHT_R, MACHINES, phaseOf, pretendDir, speedOf, stepCrew, type CrewGame, type CrewMove } from './crew';
import { memoryMove, type MemoryDb } from './memoryServices';
import { classLiveStep, type ClassLiveServices } from './server';

/**
 * What a device gets back from saving its spot: my role, and every other spot with its kind (0 player, 1 drone, 2 a
 * fellow Glitch), factory name (or first name) and colour number (so pupils can tell who is where on their own map, as on the big screen).
 */
export interface CrewSpots {
  me: { glitch: boolean; drone: boolean };
  spots: [number, number, 0 | 1 | 2, string, number][];
}

/**
 * Same rules as classlive_crew_move (migration 20261126000400_classlive_crew_names.sql): factory names, no ids; fellow Glitches are
 * marked only for a Glitch; in the dark (lights out) Crew on the floor only see players within LIGHT_R, unless their camera is on.
 */
export function crewSpotsOf(g: CrewGame, t: number, all: Record<string, { x: number; y: number }>, me: string, people: Record<string, { name: string; colour: number }> = {}): CrewSpots {
  const mine = g.mine[me];
  const dark = !!g.round && g.round.lightsTo > t && !!mine && !mine.glitch && !mine.drone && mine.cameraTo <= t;
  const at = all[me];
  const spots: CrewSpots['spots'] = [];
  for (const [id, p] of Object.entries(all)) {
    const m = g.mine[id];
    if (id === me || !m) continue;
    if (dark && (!at || Math.hypot(p.x - at.x, p.y - at.y) > LIGHT_R)) continue;
    const kind: 0 | 1 | 2 = m.drone ? 1 : mine?.glitch && m.glitch ? 2 : 0;
    const who = people[id];
    spots.push([Math.round(p.x * 1e4) / 1e4, Math.round(p.y * 1e4) / 1e4, kind, m.nick ?? firstOf(who?.name ?? ''), who?.colour ?? 0]);
  }
  return { me: { glitch: !!mine?.glitch, drone: !!mine?.drone }, spots };
}

/** A first name, as the server's views show it (split_part(btrim(name), ' ', 1) in the database). */
const firstOf = (name: string) => name.trim().split(/\s+/)[0]?.slice(0, 20) ?? '';

export function memoryCrewMove(db: MemoryDb, now: number, room: number, player: string, x: number, y: number): CrewSpots | null {
  const r = db.rooms.get(room);
  if (!r || r.session.game.kind !== 'crew' || r.startedAt === null) return null;
  if (!memoryMove(db, now, room, player, x, y)) return null;
  return crewSpotsOf(r.session.game, now - r.startedAt, db.spots.get(room) ?? {}, player, r.session.players);
}

/**
 * A pretend pupil: Crew walk to a sparking machine (or their next job) and answer there (right at their own rate);
 * Glitches walk to machines, jam when they can, and do pretend jobs. Everyone votes in meetings (at random, sometimes
 * Skip). Moves every 200 ms as a device.
 */
export function crewBot(o: { db: MemoryDb; services: ClassLiveServices; later: (fn: () => void | Promise<void>, ms: number) => void; now: () => number; rand: () => number }, room: number, id: string, skill: number) {
  const { db, services, later, rand } = o;
  let m: CrewMove | null = null;
  let placedSeen = -1;
  let busy = false;
  let target: number | null = null;
  let votedIn = -1;
  const think = async () => {
    const row = db.rooms.get(room);
    if (!row || row.session.state === 'over') return;
    const g = row.session.game;
    if (g.kind !== 'crew' || row.startedAt === null) return;
    const mine = g.mine[id];
    if (!mine) return later(think, 500);
    const now = o.now();
    const t = now - row.startedAt;
    const r = g.round;
    if (!m || mine.placed !== placedSeen) {
      m = { p: { ...mine.spot } };
      placedSeen = mine.placed;
    }
    const phase = phaseOf(r, t);
    if (r && phase === 'vote' && !mine.drone && votedIn !== r.meetings && !busy && rand() < 0.3) {
      votedIn = r.meetings;
      const others = row.session.order.filter((x) => x !== id && !g.mine[x]?.drone);
      // Crew guess (a Glitch is a bit likelier to be picked: pretend pupils "noticed" something); Glitches pick Crew.
      const guess = rand() < 0.25 ? 'skip' : !mine.glitch && rand() < 0.35 ? (r.glitches.find((x) => !g.mine[x]?.drone) ?? 'skip') : others[Math.floor(rand() * others.length)] ?? 'skip';
      busy = true;
      await classLiveStep(services, id, { action: 'play', room, vote: guess });
      busy = false;
    }
    if (r && phase === 'work') {
      const sparkingAt = MACHINES.filter((mc) => r.machines[mc.id].sparked).map((mc) => mc.id);
      if (target === null || (!mine.glitch && !sparkingAt.includes(target) && !mine.jobs.includes(target)) || rand() < 0.01) {
        target = !mine.glitch && sparkingAt.length && rand() < 0.7 ? sparkingAt[Math.floor(rand() * sparkingAt.length)] : mine.jobs[0] ?? MACHINES[Math.floor(rand() * MACHINES.length)].id;
      }
      const mc = MACHINES[target];
      const goal = { x: mc.x + (mc.x < 0.5 ? 1 : -1) * (mc.r + 0.045), y: mc.y };
      m = stepCrew(m, pretendDir(m.p, goal, rand), 200, r, t, { drone: mine.drone, speed: speedOf(mine, t) * (0.7 + skill * 0.3) });
      memoryCrewMove(db, now, room, id, m.p.x, m.p.y);
      const close = Math.hypot(m.p.x - goal.x, m.p.y - goal.y) < 0.05;
      if (close && !busy) {
        busy = true;
        if (mine.glitch && !mine.drone) {
          if (t >= mine.jamTo && rand() < 0.5) await classLiveStep(services, id, { action: 'play', room, jam: mc.id });
          else if (mine.jobs.includes(mc.id) && t >= mine.lastWork + 3000) await classLiveStep(services, id, { action: 'play', room, work: mc.id });
          else if (r.lights && mine.lightsIn !== r.n && rand() < 0.05) await classLiveStep(services, id, { action: 'play', room, lights: true });
          target = null;
        } else if (canAsk(g, id, m.p, t) && rand() < 0.3) {
          const asked = await classLiveStep(services, id, { action: 'ask', room });
          const q = asked.body.question as { slot: number } | undefined;
          if (q) {
            const kept = db.questions.get(`${room}:${id}`)?.find((k) => k.slot === q.slot);
            const right = markQuestion(kept?.question)?.answer ?? 0;
            await classLiveStep(services, id, { action: 'answer', room, slot: q.slot, answer: rand() < skill ? right : right + 1, ms: 2500 });
          }
        }
        busy = false;
      }
      const it = !mine.glitch && !mine.held ? r.items.find((x) => !x.by && Math.hypot(x.x - m!.p.x, x.y - m!.p.y) < 0.08) : undefined;
      if (it && !busy) {
        busy = true;
        await classLiveStep(services, id, { action: 'play', room, grab: it.id });
        busy = false;
      }
    }
    later(think, 200);
  };
  later(think, 200 + rand() * 400);
}
