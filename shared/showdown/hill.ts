/**
 * King of the Hill, Class Showdown's fifth arena (docs/SHOWDOWN-PLAN.md section 4.5). Same round, modes, roles and big
 * events as Boss Bounty (the engine), with the boss's health standing in for the castle the class builds on the hilltop:
 * every right answer adds stones, and the class wins when it's finished.
 *
 * What's different: there is one crown. Every few seconds it goes to whoever scored the most points in the last 30
 * seconds (a pupil; a team in team modes), and whoever wears it earns crown points while they hold it. So the lead keeps
 * swinging: a burst of right answers takes the crown, and keeping it means keeping going. The wind-up is a challenger
 * charging the hill (a shield check): if it breaks, the crown is knocked off and goes back up for grabs. The weak spot is
 * "double crown" (double stones, and the crown pays double), from the engine.
 */
import type { Player, Round, ShowdownEvent, TeamId } from './types';

export interface Crown {
  /** Who wears it: a pupil id, or a team (team modes), or null while it's up for grabs. */
  holder: string | null;
  team: boolean;
  /** Round time they took it. */
  since: number;
  /** Round time the crown is next checked. */
  nextAt: number;
  /** Points scored in the last `windowMs`, newest last: [round time, who (pupil or team), points]. */
  recent: [number, string, number][];
  /** Ms each holder has worn it, all round. */
  held: Record<string, number>;
}

export const HILL = {
  /** The castle needs this much more than the boss has health (tuned with the simulator to about 80% won). */
  castle: { class: 1.05, teams2: 1.01, teams4: 1.03, solo: 1.02 } as Record<Round['mode'], number>,
  /** The crown goes to the most points in this long. */
  windowMs: 30000,
  /** How often the crown is checked (and pays). */
  everyMs: 5000,
  /** What the crown pays its holder each check (doubled during the weak spot). */
  crownPoints: 5,
  /** A pupil must have at least this many recent points to take the crown. */
  minPoints: 10,
} as const;

/** Who a point counts for: the pupil, or their team in team modes. */
const whoOf = (r: Round, p: Player): string => (r.teams.length && p.team ? p.team : p.id);

/** At the start: the castle is set and the crown is up for grabs. */
export function setHill(r: Round) {
  r.boss.max = Math.round(r.boss.max * HILL.castle[r.mode]);
  r.boss.hp = r.boss.max;
  r.crown = { holder: null, team: r.teams.length > 0, since: 0, nextAt: HILL.everyMs, recent: [], held: {} };
}

/** A right answer's points count towards the crown. */
export function notePoints(r: Round, p: Player, points: number) {
  if (!r.crown || points <= 0) return;
  r.crown.recent.push([r.t, whoOf(r, p), points]);
}

/** The points each pupil (or team) scored in the last 30 seconds, most first. */
export function contenders(r: Round, t = r.t): [string, number][] {
  const c = r.crown;
  if (!c) return [];
  const sums = new Map<string, number>();
  for (const [at, who, pts] of c.recent) if (t - at <= HILL.windowMs) sums.set(who, (sums.get(who) ?? 0) + pts);
  return [...sums.entries()].sort((a, b) => b[1] - a[1]);
}

function pay(r: Round, holder: string, amount: number) {
  if (r.crown?.team) {
    const team = holder as TeamId;
    r.teamPoints[team] = (r.teamPoints[team] ?? 0) + amount;
    // Spread over the team's pupils so it shows in their scores too, a point at a time from the first joiner.
    const members = r.order.filter((id) => r.players[id].team === team);
    members.forEach((id, i) => { r.players[id].score += Math.floor(amount / members.length) + (i < amount % members.length ? 1 : 0); });
  } else if (r.players[holder]) {
    r.players[holder].score += amount;
  }
}

/** Every 5 seconds: the crown pays whoever wears it, then goes to whoever scored most in the last 30 seconds. */
export function crownTick(r: Round, events: ShowdownEvent[]) {
  const c = r.crown;
  if (!c) return;
  c.recent = c.recent.filter(([at]) => r.t - at <= HILL.windowMs);
  if (c.holder) {
    const amount = HILL.crownPoints * (r.t < r.weakSpotUntil ? 2 : 1);
    pay(r, c.holder, amount);
    c.held[c.holder] = (c.held[c.holder] ?? 0) + HILL.everyMs;
    events.push({ type: 'crown_paid', t: r.t, holder: c.holder, points: amount });
  }
  const [best, second] = contenders(r);
  const top = best && best[1] >= HILL.minPoints && (!second || best[1] > second[1]) ? best[0] : null;
  // A tie keeps the crown where it is; nobody close enough leaves it where it is too.
  if (top && top !== c.holder) {
    events.push({ type: 'crown', t: r.t, holder: top, from: c.holder, team: c.team });
    c.holder = top;
    c.since = r.t;
  }
  c.nextAt += HILL.everyMs;
}

/** The challenger broke through: the crown is knocked off and up for grabs again. */
export function knockCrown(r: Round, events: ShowdownEvent[]) {
  const c = r.crown;
  if (!c || !c.holder) return;
  events.push({ type: 'crown', t: r.t, holder: null, from: c.holder, team: c.team });
  c.holder = null;
  c.since = r.t;
  c.recent = [];
}
