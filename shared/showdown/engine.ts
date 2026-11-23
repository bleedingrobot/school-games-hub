/**
 * Class Showdown's rules as plain functions on one plain-JSON round (docs/SHOWDOWN-PLAN.md). The server holds the
 * round and calls these with the time in ms from the start; every call first brings the round up to that time, so a
 * slow or refreshed projector can't change anything. Functions change the round they're given (the server loads a
 * row, applies one call, saves it) and return the events for the projector and iPads to animate.
 */
import { SHOWDOWN } from './config';
import { bossHealth } from './bossHealth';
import { makeSchedule, hashSeed } from './schedule';
import { reshuffle, teamForLateJoiner } from './teams';
import { dig, openSeams } from './goldrush';
import { blowBack, jump, setSummit } from './skyclimb';
import { setRaft, tide, wade, wave } from './island';
import { crownTick, knockCrown, notePoints, setHill } from './hill';
import { auctionDue, auctionTick, setAuction, thieves } from './auction';
import type { Mode, Outcome, Player, Role, Round, ShowdownEvent, TeamId } from './types';

export function newRound(opts: { seed: number; mode: Mode; lengthMin?: number; bossHealth?: number }): Round {
  const lengthMin = (SHOWDOWN.lengths as readonly number[]).includes(opts.lengthMin ?? -1) ? opts.lengthMin! : SHOWDOWN.defaultLength;
  const teams: TeamId[] = opts.mode === 'teams2' ? [...SHOWDOWN.teams[2]] : opts.mode === 'teams4' ? [...SHOWDOWN.teams[4]] : [];
  return {
    seed: opts.seed >>> 0,
    mode: opts.mode,
    lengthMin,
    state: 'lobby',
    result: null,
    t: 0,
    boss: { max: 0, hp: 0, phase: 1 },
    players: {},
    order: [],
    teams,
    teamPoints: Object.fromEntries(teams.map((k) => [k, 0])),
    teamDamage: Object.fromEntries(teams.map((k) => [k, 0])),
    schedule: makeSchedule(opts.seed >>> 0, lengthMin),
    nextPlanned: 0,
    windUp: null,
    bank: {},
    weakSpotUntil: 0,
    goldenFrom: null,
    goldenUntil: 0,
    enrageUntil: 0,
    lastEnrageAt: null,
    finalStarted: false,
    roleSwapUntil: 0,
    tug: 0,
    tugShown: 0,
    facing: null,
    facingSince: 0,
    lastHit: null,
    nextRankAt: 60000,
    bossOverride: opts.bossHealth ?? null,
    teamsByHand: false,
  };
}

export const roundMs = (r: Round) => r.lengthMin * 60000;

/** A pupil joins (before or during the round). Late joiners go to the smallest team and make the boss a little bigger. */
export function join(r: Round, p: { id: string; name: string; ladder: number }, t = r.t): Outcome {
  const events = r.state === 'live' ? advance(r, t) : [];
  if (r.state === 'over') return { ok: false, reason: 'not_live', events };
  if (r.players[p.id]) return { ok: true, events };
  const now = r.state === 'live' ? r.t : 0;
  const team = r.teams.length ? teamForLateJoiner(r) : null;
  r.players[p.id] = {
    id: p.id, name: p.name, ladder: p.ladder, team, role: 'striker', joinedAt: now, nextAt: now, dazedUntil: 0,
    lastActive: now, score: 0, damage: 0, streak: 0, bestStreak: 0, correct: 0, wrong: 0, shields: 0, revives: 0,
    chests: 0, goldenUsed: false, goldenRightAt: null, worstRank: null,
  };
  r.order.push(p.id);
  // In the lobby teams are re-mixed by ladder place as pupils join, until the teacher moves someone by hand.
  if (r.state === 'lobby' && r.teams.length && !r.teamsByHand) reshuffle(r, r.seed);
  events.push({ type: 'join', t: now, pupil: p.id, team: r.players[p.id].team });
  if (r.state === 'live' && r.bossOverride === null) {
    // The boss grows by one pupil's share of the time that's left, so a late joiner doesn't make it easier or harder.
    const n = r.order.length;
    const extra = (bossHealth(r.mode, r.lengthMin, n) - bossHealth(r.mode, r.lengthMin, n - 1)) * (1 - now / roundMs(r));
    if (extra > 0) {
      r.boss.max += extra;
      r.boss.hp += extra;
      events.push({ type: 'boss_grows', t: now, bossMax: r.boss.max });
    }
  }
  return { ok: true, events };
}

/** Countdown done: the boss wakes. Its health comes from the tuned table for the pupils who have joined. */
export function start(r: Round): Outcome {
  if (r.state !== 'lobby') return { ok: false, reason: 'not_now', events: [] };
  r.state = 'live';
  r.t = 0;
  r.boss.max = r.bossOverride ?? bossHealth(r.mode, r.lengthMin, r.order.length);
  r.boss.hp = r.boss.max;
  r.roleSwapUntil = SHOWDOWN.roleSwapMs;
  if (r.arena === 'goldrush') openSeams(r);
  if (r.arena === 'skyclimb') setSummit(r);
  if (r.arena === 'island') setRaft(r);
  if (r.arena === 'hill') setHill(r);
  if (r.arena === 'auction') setAuction(r);
  return { ok: true, events: [{ type: 'start', t: 0, bossMax: r.boss.max }] };
}

/** Pick a role: in the lobby, in the first seconds, or just after a phase change. Solo has Strikers only. */
export function chooseRole(r: Round, id: string, role: Role, t = r.t): Outcome {
  const events = r.state === 'live' ? advance(r, t) : [];
  const p = r.players[id];
  if (!p) return { ok: false, reason: 'not_playing', events };
  if (r.mode === 'solo' || r.state === 'over') return { ok: false, reason: 'not_now', events };
  const joinedLate = r.state === 'live' && r.t - p.joinedAt < SHOWDOWN.roleSwapMs;
  if (r.state === 'live' && r.t >= r.roleSwapUntil && !joinedLate) return { ok: false, reason: 'not_now', events };
  p.role = role;
  events.push({ type: 'role', t: r.t, pupil: id, role });
  return { ok: true, events };
}

/** Is this pupil's next question the golden one? (The server then asks from their easiest skill, boxes 3 and 4.) */
export function goldenNext(r: Round, id: string, t = r.t): boolean {
  const p = r.players[id];
  return !!p && r.goldenFrom !== null && t >= r.goldenFrom && t < r.goldenUntil && !p.goldenUsed;
}

/** Streak multiplier: 3 in a row = 1.5x, 5 in a row = 2x, capped. */
export function streakTimes(streak: number): number {
  return SHOWDOWN.streaks.find((s) => streak >= s.from)?.times ?? 1;
}

/** Is this pupil (or their team) at the back? They get catch-up help, never shown as help. */
export function behind(r: Round, id: string): boolean {
  const p = r.players[id];
  if (!p) return false;
  if (p.team && r.teams.length) {
    const pts = r.teams.map((k) => r.teamPoints[k] ?? 0);
    const low = Math.min(...pts);
    return low < Math.max(...pts) && (r.teamPoints[p.team] ?? 0) === low;
  }
  const playing = r.order.map((k) => r.players[k]).filter((q) => q.correct + q.wrong > 0);
  if (playing.length < 4) return false;
  const cut = [...playing].sort((a, b) => a.score - b.score)[Math.floor(playing.length * SHOWDOWN.catchUp.bottomShare) - 1];
  return cut !== undefined && p.score <= cut.score && p.correct + p.wrong > 0;
}

/**
 * A pupil's marked answer (the server marks it, way A). `golden` says the question was the golden one.
 * Refused while dazed or before the 4-second ring has filled.
 */
export function answer(r: Round, id: string, correct: boolean, t: number, opts: { golden?: boolean } = {}): Outcome {
  const events = advance(r, t);
  const p = r.players[id];
  if (r.state !== 'live') return { ok: false, reason: 'not_live', events };
  if (!p) return { ok: false, reason: 'not_playing', events };
  if (r.t < p.dazedUntil) return { ok: false, reason: 'dazed', events };
  if (r.t < p.nextAt) return { ok: false, reason: 'too_soon', events };
  const golden = !!opts.golden && r.goldenFrom !== null && !p.goldenUsed;
  if (golden) p.goldenUsed = true;
  p.lastActive = r.t;

  if (!correct) {
    p.wrong++;
    p.streak = 0;
    p.nextAt = r.t + SHOWDOWN.paceMs + SHOWDOWN.wrongWaitMs;
    events.push({ type: 'wrong', t: r.t, pupil: id, waitUntil: p.nextAt });
    return { ok: true, events };
  }

  p.correct++;
  p.streak++;
  p.bestStreak = Math.max(p.bestStreak, p.streak);
  p.nextAt = r.t + SHOWDOWN.paceMs;
  if (golden) p.goldenRightAt ??= r.t;
  const isBehind = behind(r, id);
  const weakSpot = r.t < r.weakSpotUntil;
  const times =
    streakTimes(p.streak) *
    (weakSpot ? (isBehind && r.teams.length ? SHOWDOWN.weakSpot.catchUpTimes : SHOWDOWN.weakSpot.times) : 1) *
    (golden ? SHOWDOWN.golden.times : 1);
  let points = Math.round(SHOWDOWN.pointsPerCorrect * times);

  // What the role does with it.
  let damage = SHOWDOWN.damage[p.role] * times;
  if (p.role === 'healer') {
    const woke = wakeOne(r, p);
    if (woke) {
      damage = 0;
      p.revives++;
      events.push({ type: 'revive', t: r.t, pupil: id, woke });
    }
  }
  // Gold Rush: what the dig is worth depends on the seam (rich pays more, a crowded one splits).
  let seam: number | undefined;
  if (r.arena === 'goldrush' && damage > 0) {
    const before = damage;
    damage = dig(r, p, damage, events);
    seam = p.seam ?? undefined;
    // Gold is the score in Gold Rush too, so picking a good seam counts in every mode.
    points = Math.max(1, Math.round(points * (damage / before)));
  }
  // Shrinking Island: a step towards the middle, or half planks from a rock while swimming back.
  if (r.arena === 'island' && damage > 0) {
    const k = wade(r, p, events);
    damage *= k;
    points = Math.max(1, Math.round(points * k));
  }
  // Sky Climb: every 3rd right answer in a row is a jump.
  if (r.arena === 'skyclimb') damage += jump(r, p, damage, events);
  const group = groupOf(r, p);
  if (r.windUp && group && r.windUp.groups[group] && !r.windUp.groups[group].done) {
    const g = r.windUp.groups[group];
    if (!g.counted.includes(id)) g.counted.push(id);
    g.got += p.role === 'guard' ? SHOWDOWN.windUp.guardCounts : 1;
    events.push({ type: 'shield_progress', t: r.t, group, got: g.got, needed: g.needed });
    if (g.got >= g.needed) holdShield(r, group, events);
  } else if (p.role === 'guard' && group && r.mode !== 'solo') {
    const cap = SHOWDOWN.windUp.bankCap * shieldNeeded(r, group);
    r.bank[group] = Math.min(cap, (r.bank[group] ?? 0) + SHOWDOWN.windUp.bankPerGuardAnswer);
  }

  p.score += points;
  p.damage += damage;
  if (p.team) {
    r.teamPoints[p.team] = (r.teamPoints[p.team] ?? 0) + points;
    r.teamDamage[p.team] = (r.teamDamage[p.team] ?? 0) + damage;
  }
  events.push({ type: 'hit', t: r.t, pupil: id, team: p.team, role: p.role, points, damage, streak: p.streak, times, weakSpot, golden, ...(seam !== undefined ? { seam } : {}) });
  // King of the Hill: these points count towards the crown.
  if (r.arena === 'hill') notePoints(r, p, points);
  if (p.streak === 3 || p.streak % 5 === 0) events.push({ type: 'streak', t: r.t, pupil: id, streak: p.streak });

  // Catch-up: a lucky chest now and then for pupils (or a team) at the back.
  if (isBehind && (p.correct + hashSeed(r.seed, id)) % SHOWDOWN.catchUp.chestEvery === 0) {
    const bonus = SHOWDOWN.catchUp.chestPoints;
    p.score += bonus;
    p.chests++;
    if (p.team) r.teamPoints[p.team] = (r.teamPoints[p.team] ?? 0) + bonus;
    events.push({ type: 'lucky_chest', t: r.t, pupil: id, points: bonus });
  }

  if (damage > 0) hurtBoss(r, id, damage, events);
  if (r.mode === 'teams2') tugOfWar(r, events);
  if (r.mode === 'teams4') chaseLeader(r, events);
  return { ok: true, events };
}

/** The teacher's enrage button: a fast wind-up now, then a bigger weak spot. At most once a minute. */
export function enrage(r: Round, t: number): Outcome {
  const events = advance(r, t);
  if (r.state !== 'live') return { ok: false, reason: 'not_live', events };
  if (r.lastEnrageAt !== null && r.t - r.lastEnrageAt < SHOWDOWN.enrage.cooldownMs) return { ok: false, reason: 'cooldown', events };
  if (r.t >= roundMs(r) - SHOWDOWN.finalMs) return { ok: false, reason: 'not_now', events };
  r.lastEnrageAt = r.t;
  r.enrageUntil = r.t + SHOWDOWN.enrage.ms;
  events.push({ type: 'enrage', t: r.t, endsAt: r.enrageUntil });
  if (r.windUp) r.windUp.enraged = true;
  else startWindUp(r, SHOWDOWN.enrage.windUpMs, true, events);
  return { ok: true, events };
}

/** Teacher: move a pupil to another team (points already scored stay with the old team). */
export function moveToTeam(r: Round, id: string, team: TeamId): Outcome {
  const p = r.players[id];
  if (!p) return { ok: false, reason: 'not_playing', events: [] };
  if (!r.teams.includes(team)) return { ok: false, reason: 'no_such_team', events: [] };
  if (r.state === 'over') return { ok: false, reason: 'not_live', events: [] };
  p.team = team;
  r.teamsByHand = true;
  return { ok: true, events: [{ type: 'team_move', t: r.t, pupil: id, team }] };
}

/** Bring the round up to time t: planned events, wind-ups ending, weak spots closing, the final 30 seconds, time up. */
export function advance(r: Round, t: number): ShowdownEvent[] {
  const events: ShowdownEvent[] = [];
  if (r.state !== 'live') return events;
  const end = roundMs(r);
  const target = Math.min(Math.max(t, r.t), end);
  for (;;) {
    const due: [number, () => void][] = [];
    const planned = r.schedule[r.nextPlanned];
    if (r.windUp) due.push([r.windUp.endsAt, () => endWindUp(r, events)]);
    if (r.weakSpotUntil && r.weakSpotUntil <= target) due.push([r.weakSpotUntil, () => { r.weakSpotUntil = 0; events.push({ type: 'weak_spot_end', t: r.t }); }]);
    if (r.goldenUntil && r.goldenUntil <= target) due.push([r.goldenUntil, () => { r.goldenUntil = 0; events.push({ type: 'golden_end', t: r.t }); }]);
    if (r.enrageUntil && r.enrageUntil <= target) due.push([r.enrageUntil, () => { r.enrageUntil = 0; events.push({ type: 'enrage_end', t: r.t }); }]);
    if (r.arena === 'hill' && r.crown) { const c = r.crown; due.push([c.nextAt, () => crownTick(r, events)]); }
    if (r.arena === 'auction' && r.auction) due.push([auctionDue(r), () => auctionTick(r, events)]);
    if (planned) due.push([planned.at, () => { r.nextPlanned++; runPlanned(r, planned.kind, events); }]);
    if (!r.finalStarted) due.push([end - SHOWDOWN.finalMs, () => { r.finalStarted = true; events.push({ type: 'final', t: r.t, endsAt: end }); }]);
    due.push([r.nextRankAt, () => { snapshotRanks(r); r.nextRankAt += SHOWDOWN.rankEveryMs; }]);
    due.push([end, () => { r.state = 'over'; r.result = 'time'; events.push({ type: 'time_up', t: r.t }); }]);
    const next = due.filter(([at]) => at <= target).sort((a, b) => a[0] - b[0])[0];
    if (!next || r.state !== 'live') break;
    r.t = Math.max(r.t, next[0]);
    next[1]();
  }
  r.t = target;
  // Shrinking Island: the water rises with the clock.
  if (r.arena === 'island' && r.state === 'live') tide(r, events);
  return events;
}

// ---- inside the rules ----

/** Which shield group a pupil is in: the whole class, their team, or (solo) just themselves. */
function groupOf(r: Round, p: Player): string | null {
  if (r.mode === 'class') return 'all';
  if (r.mode === 'solo') return p.id;
  return p.team;
}

function activeIn(r: Round, group: string): Player[] {
  return r.order
    .map((k) => r.players[k])
    .filter((p) => groupOf(r, p) === group && r.t - p.lastActive <= SHOWDOWN.idleMs);
}

function shieldNeeded(r: Round, group: string): number {
  if (r.mode === 'solo') return 1;
  return Math.max(1, Math.ceil(activeIn(r, group).length * SHOWDOWN.windUp.perPupil));
}

function startWindUp(r: Round, ms: number, enraged: boolean, events: ShowdownEvent[]) {
  if (r.windUp) return;
  let keys: string[];
  if (r.mode === 'class') keys = ['all'];
  else if (r.mode === 'solo') keys = r.order.filter((k) => r.t - r.players[k].lastActive <= SHOWDOWN.idleMs);
  // 4 teams: the boss attacks only the team in front. 2 teams: both.
  else if (r.mode === 'teams4' && r.facing) keys = [r.facing];
  else keys = [...r.teams];
  keys = keys.filter((k) => r.mode === 'solo' || activeIn(r, k).length > 0);
  if (keys.length === 0) return;
  const groups: NonNullable<Round['windUp']>['groups'] = {};
  for (const k of keys) {
    const needed = shieldNeeded(r, k);
    const banked = Math.floor(r.bank[k] ?? 0);
    groups[k] = { needed, got: banked, counted: [], done: null };
    r.bank[k] = 0;
  }
  r.windUp = { endsAt: r.t + ms, enraged, groups };
  events.push({ type: 'wind_up', t: r.t, endsAt: r.windUp.endsAt, enraged, groups: keys.map((group) => ({ group, needed: groups[group].needed })) });
  for (const k of keys) if (groups[k].got >= groups[k].needed) holdShield(r, k, events);
}

function holdShield(r: Round, group: string, events: ShowdownEvent[]) {
  const w = r.windUp!;
  const g = w.groups[group];
  g.done = 'held';
  const guards = g.counted.filter((k) => r.players[k].role === 'guard');
  for (const k of guards) r.players[k].shields++;
  events.push({ type: 'shield_held', t: r.t, group, guards });
  if (Object.values(w.groups).every((x) => x.done)) finishWindUp(r, events);
}

function endWindUp(r: Round, events: ShowdownEvent[]) {
  const w = r.windUp!;
  let broke = 0;
  const keys = Object.keys(w.groups);
  for (const group of keys) {
    const g = w.groups[group];
    if (g.done) continue;
    g.done = 'broke';
    broke++;
    const dazedUntil = r.t + SHOWDOWN.dazedMs;
    // Healers aren't dazed: they're the ones who wake everyone up.
    const dazed = r.order.filter((k) => groupOf(r, r.players[k]) === group && r.players[k].role !== 'healer');
    for (const k of dazed) r.players[k].dazedUntil = Math.max(r.players[k].dazedUntil, dazedUntil);
    events.push({ type: 'shield_broke', t: r.t, group, dazed, dazedUntil });
  }
  // The boss heals once if the class (or any team) failed; in solo, if fewer than 60% held their own.
  const heals = r.mode === 'solo' ? keys.length > 0 && (keys.length - broke) / keys.length < SHOWDOWN.windUp.soloHealShare : broke > 0;
  if (heals) {
    const amount = Math.min(r.boss.max - r.boss.hp, r.boss.max * SHOWDOWN.windUp.healShare);
    r.boss.hp += amount;
    if (amount > 0) events.push({ type: 'boss_heals', t: r.t, amount, hp: r.boss.hp });
  }
  finishWindUp(r, events);
}

function finishWindUp(r: Round, events: ShowdownEvent[]) {
  const w = r.windUp!;
  const enraged = w.enraged;
  r.windUp = null;
  // Sky Climb: the storm has passed; anyone who wasn't answering slips back down.
  if (r.arena === 'skyclimb') blowBack(r, events);
  // Shrinking Island: the big wave pushes anyone who wasn't answering back towards the water.
  // King of the Hill: a challenger who breaks through knocks the crown off.
  if (r.arena === 'hill' && Object.values(w.groups).some((g) => g.done === 'broke')) knockCrown(r, events);
  // Auction House: thieves who get past the guards steal the treasure on sale (any team letting them in; in solo, when
  // fewer than 60% held their own, the same rule as the boss healing).
  if (r.arena === 'auction') {
    const gs = Object.values(w.groups);
    const broke = gs.filter((g) => g.done === 'broke').length;
    if (r.mode === 'solo' ? gs.length > 0 && (gs.length - broke) / gs.length < SHOWDOWN.windUp.soloHealShare : broke > 0) thieves(r, events);
  }
  if (r.arena === 'island') {
    const broke = new Set(Object.keys(w.groups).filter((k) => w.groups[k].done === 'broke'));
    wave(r, events, (p) => broke.has(groupOf(r, p) ?? ''));
  }
  if (enraged) openWeakSpot(r, SHOWDOWN.enrage.weakSpotMs, events);
}

function openWeakSpot(r: Round, ms: number, events: ShowdownEvent[]) {
  r.weakSpotUntil = Math.max(r.weakSpotUntil, r.t + ms);
  events.push({ type: 'weak_spot', t: r.t, endsAt: r.weakSpotUntil, times: SHOWDOWN.weakSpot.times });
}

function runPlanned(r: Round, kind: 'wind_up' | 'weak_spot' | 'golden', events: ShowdownEvent[]) {
  if (kind === 'wind_up') startWindUp(r, SHOWDOWN.windUp.ms, r.t < r.enrageUntil, events);
  else if (kind === 'weak_spot') openWeakSpot(r, r.t < r.enrageUntil ? SHOWDOWN.enrage.weakSpotMs : SHOWDOWN.weakSpot.ms, events);
  else {
    r.goldenFrom = r.t;
    r.goldenUntil = r.t + SHOWDOWN.golden.ms;
    events.push({ type: 'golden', t: r.t, endsAt: r.goldenUntil });
  }
}

/** A Healer wakes the classmate (same group) who has been dazed longest. */
function wakeOne(r: Round, healer: Player): string | null {
  const group = groupOf(r, healer);
  const dazed = r.order
    .map((k) => r.players[k])
    .filter((p) => p.id !== healer.id && p.dazedUntil > r.t && (r.mode !== 'teams2' && r.mode !== 'teams4' ? true : groupOf(r, p) === group))
    .sort((a, b) => a.dazedUntil - b.dazedUntil);
  if (!dazed[0]) return null;
  dazed[0].dazedUntil = r.t;
  return dazed[0].id;
}

function hurtBoss(r: Round, id: string, damage: number, events: ShowdownEvent[]) {
  r.boss.hp = Math.max(0, r.boss.hp - damage);
  r.lastHit = id;
  const share = r.boss.hp / r.boss.max;
  const phase = share <= SHOWDOWN.phases[1] ? 3 : share <= SHOWDOWN.phases[0] ? 2 : 1;
  while (r.boss.phase < phase) {
    r.boss.phase = (r.boss.phase + 1) as 2 | 3;
    r.roleSwapUntil = r.t + SHOWDOWN.roleSwapMs;
    events.push({ type: 'phase', t: r.t, phase: r.boss.phase as 2 | 3, roleSwapUntil: r.roleSwapUntil });
  }
  if (r.boss.hp <= 0) {
    r.state = 'over';
    r.result = 'beaten';
    events.push({ type: 'boss_beaten', t: r.t, lastHit: id });
  }
}

/** 2 teams: team damage pushes the boss along the bridge towards the other team's side. */
function tugOfWar(r: Round, events: ShowdownEvent[]) {
  const red = r.teamDamage.red ?? 0;
  const blue = r.teamDamage.blue ?? 0;
  r.tug = (red - blue) / (red + blue + SHOWDOWN.tugSoftness);
  const shown = Math.round(r.tug / SHOWDOWN.tugStep) * SHOWDOWN.tugStep;
  if (Math.abs(shown - r.tugShown) >= SHOWDOWN.tugStep - 1e-9) {
    r.tugShown = shown;
    events.push({ type: 'tug', t: r.t, position: Number(shown.toFixed(2)), leading: red === blue ? null : red > blue ? 'red' : 'blue' });
  }
}

/** 4 teams: the boss turns to face whichever team is in front. */
function chaseLeader(r: Round, events: ShowdownEvent[]) {
  const pts = (k: TeamId) => r.teamPoints[k] ?? 0;
  const leader = [...r.teams].sort((a, b) => pts(b) - pts(a))[0];
  if (leader === r.facing) return;
  // Not too twitchy: only turn to a clear leader, and not more than once every 15 seconds.
  if (r.facing && (pts(leader) - pts(r.facing) < SHOWDOWN.chase.margin || r.t - r.facingSince < SHOWDOWN.chase.minMs)) return;
  if (!r.facing && pts(leader) < SHOWDOWN.chase.margin) return;
  r.facing = leader;
  r.facingSince = r.t;
  events.push({ type: 'boss_turns', t: r.t, team: leader });
}

/** Ranks by score (1 = top); used for "best comeback". */
export function ranks(r: Round): Record<string, number> {
  const sorted = r.order.map((k) => r.players[k]).sort((a, b) => b.score - a.score);
  const out: Record<string, number> = {};
  sorted.forEach((p, i) => { out[p.id] = i > 0 && p.score === sorted[i - 1].score ? out[sorted[i - 1].id] : i + 1; });
  return out;
}

function snapshotRanks(r: Round) {
  const rk = ranks(r);
  for (const [id, place] of Object.entries(rk)) {
    const p = r.players[id];
    p.worstRank = Math.max(p.worstRank ?? 0, place);
  }
}
