/**
 * The Star Forge's pure helpers (docs/TRADER-SYSTEM-PLAN.md, section 2): editing a design, listing the pieces that can be
 * built, the goal bar and Bolt's Forge words. No React here. The rules themselves live in `shared/trader/system.ts`.
 */
import {
  BELTS, COMET_PRICE, EFFECTS, LIFE, MAX_PLANETS, PLANETS, SIZES, SUNS, SYSTEM_TECH, TECH, designProblem, emptyDesign, forgeCost, inZone, pieceName, newPlanet,
  type EffectKind, type PlanetKind, type PlanetPick, type SunKind, type SystemDesign,
} from '../../../../shared/trader/system';

export const cr = (n: number): string => `${n.toLocaleString('en-NZ')} cr`;

// ---------------------------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------------------------

export const mapPlanet = (d: SystemDesign, id: number, f: (p: PlanetPick) => PlanetPick): SystemDesign => ({ ...d, planets: d.planets.map((p) => (p.id === id ? f(p) : p)) });

/** A new planet at the far end (the lowest id not in use, so a built planet's id never changes). */
export function addPlanet(d: SystemDesign, kind: PlanetKind = 'rocky'): SystemDesign {
  if (d.planets.length >= MAX_PLANETS) return d;
  const used = new Set(d.planets.map((p) => p.id));
  let id = 0;
  while (used.has(id)) id++;
  return { ...d, planets: [...d.planets, newPlanet(id, kind)] };
}

export function movePlanet(d: SystemDesign, id: number, by: -1 | 1): SystemDesign {
  const i = d.planets.findIndex((p) => p.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= d.planets.length) return d;
  const planets = [...d.planets];
  [planets[i], planets[j]] = [planets[j], planets[i]];
  return { ...d, planets };
}

export const removePlanet = (d: SystemDesign, id: number): SystemDesign => ({ ...d, planets: d.planets.filter((p) => p.id !== id) });

/** After a planet's type changes: drop what the new type can't have (rings on a ring world, sea life on a gas giant, ...). */
export function fitPlanet(p: PlanetPick): PlanetPick {
  const info = PLANETS[p.kind];
  const q: PlanetPick = { ...p };
  if (info.wonder) {
    q.ring = null;
    q.moons = [];
  }
  q.effects = q.effects.filter((e) => {
    const need = EFFECTS[e.kind].needs;
    return !((need === 'water' && !info.water) || (need === 'solid' && !info.solid));
  });
  q.tech = q.tech.filter((t) => TECH[t.kind].needs !== 'solid' || info.solid);
  if (q.life && !info.life.includes(q.life.kind)) q.life = null;
  return q;
}

/** Why an effect can't go on this planet in this slot, or null. */
export function effectWhy(p: PlanetPick, slot: number, kind: EffectKind): string | null {
  const info = PLANETS[p.kind];
  const need = EFFECTS[kind].needs;
  if (need === 'water' && !info.water) return 'Needs a world with water';
  if (need === 'solid' && !info.solid) return 'Needs solid ground';
  if (need === 'near' && slot > 1) return 'Only on planets close to the sun';
  return null;
}

// ---------------------------------------------------------------------------------------------
// The pieces that can be built
// ---------------------------------------------------------------------------------------------

export type Where = 'sun' | 'extras' | number;

export interface Piece {
  key: string;
  /** The sun, the planet's id, or the whole system. */
  where: Where;
  label: string;
  /** What the goal bar calls it: "your sun", "Nova Prime". */
  short: string;
  built: boolean;
  /** The design with this one piece built. */
  build: (d: SystemDesign) => SystemDesign;
}

/** Every piece of a design, planned or built, in building order (sun, then each planet and what's on it, then the extras). */
export function listPieces(d: SystemDesign): Piece[] {
  const out: Piece[] = [];
  if (d.sun) out.push({ key: 'sun', where: 'sun', label: `${SUNS[d.sun.kind].name} (your sun)`, short: 'your sun', built: !!d.sun.built, build: (x) => (x.sun ? { ...x, sun: { ...x.sun, built: true } } : x) });
  for (const p of d.planets) {
    const id = p.id;
    const n = pieceName(p);
    const add = (key: string, label: string, built: boolean | undefined, f: (q: PlanetPick) => PlanetPick) =>
      out.push({ key: `${key}:${id}`, where: id, label, short: n, built: !!built, build: (x) => mapPlanet(x, id, f) });
    add('planet', `${n}, ${SIZES[p.size].toLowerCase()} ${PLANETS[p.kind].name.toLowerCase()}`, p.built, (q) => ({ ...q, built: true }));
    if (p.ring) add('ring', `Rings for ${n}`, p.ring.built, (q) => (q.ring ? { ...q, ring: { ...q.ring, built: true } } : q));
    for (const m of p.moons) add(`moon${m.id}`, m.yours ? 'Your moon' : `A moon for ${n}`, m.built, (q) => ({ ...q, moons: q.moons.map((y) => (y.id === m.id ? { ...y, built: true } : y)) }));
    for (const e of p.effects) add(`fx-${e.kind}`, `${EFFECTS[e.kind].name} on ${n}`, e.built, (q) => ({ ...q, effects: q.effects.map((y) => (y.kind === e.kind ? { ...y, built: true } : y)) }));
    if (p.life) add('life', `${LIFE[p.life.kind].name} on ${n}`, p.life.built, (q) => (q.life ? { ...q, life: { ...q.life, built: true } } : q));
    for (const t of p.tech) add(`tech-${t.kind}`, `${TECH[t.kind].name} at ${n}`, t.built, (q) => ({ ...q, tech: q.tech.map((y) => (y.kind === t.kind ? { ...y, built: true } : y)) }));
  }
  if (d.belt) out.push({ key: 'belt', where: 'extras', label: BELTS[d.belt.kind].name, short: 'your asteroid belt', built: !!d.belt.built, build: (x) => (x.belt ? { ...x, belt: { ...x.belt, built: true } } : x) });
  if (d.comets) out.push({ key: 'comets', where: 'extras', label: d.comets.count === 1 ? 'A comet' : `${d.comets.count} comets`, short: 'your comets', built: !!d.comets.built, build: (x) => (x.comets ? { ...x, comets: { ...x.comets, built: true } } : x) });
  for (const t of d.tech) out.push({ key: `stech-${t.kind}`, where: 'extras', label: SYSTEM_TECH[t.kind].name, short: SYSTEM_TECH[t.kind].name.toLowerCase(), built: !!t.built, build: (x) => ({ ...x, tech: x.tech.map((y) => (y.kind === t.kind ? { ...y, built: true } : y)) }) });
  return out;
}

export interface BuildOption {
  piece: Piece;
  /** The design once this is built. */
  target: SystemDesign;
  /** What it costs now (full price). */
  price: number;
  /** Why it can't be built yet (the server's own rule), or null. */
  problem: string | null;
}

/** The unbuilt pieces and what each one would cost and need. */
export function buildOptions(d: SystemDesign, ownsMoon: boolean): BuildOption[] {
  return listPieces(d)
    .filter((p) => !p.built)
    .map((piece) => {
      const target = piece.build(d);
      return { piece, target, price: forgeCost(d, target, ownsMoon).total, problem: designProblem(target) };
    });
}

/** Everything that can be built now with `credits`, cheapest first: the design to send, and how many pieces that is. */
export function buildWhatICan(d: SystemDesign, credits: number, ownsMoon: boolean): { target: SystemDesign; count: number } {
  let cur = d;
  let left = credits;
  let count = 0;
  for (;;) {
    const next = buildOptions(cur, ownsMoon)
      .filter((o) => !o.problem && o.price <= left)
      .sort((a, b) => a.price - b.price)[0];
    if (!next) return { target: cur, count };
    cur = next.target;
    left -= next.price;
    count++;
  }
}

// ---------------------------------------------------------------------------------------------
// The goal bar and Bolt
// ---------------------------------------------------------------------------------------------

export interface Goal {
  text: string;
  /** Credits needed and held, when the goal is a piece. */
  need: number;
  pct: number;
}

/** The cheapest planned piece that can be built next; failing that, the sun; failing that, "plan your first piece". */
export function nextPiece(d: SystemDesign, ownsMoon: boolean): BuildOption | null {
  const options = buildOptions(d, ownsMoon);
  const ready = options.filter((o) => !o.problem).sort((a, b) => a.price - b.price)[0];
  return ready ?? options.find((o) => o.piece.key === 'sun') ?? options[0] ?? null;
}

export function goalOf(d: SystemDesign, credits: number, ownsMoon: boolean): Goal {
  const next = nextPiece(d, ownsMoon);
  if (!next) return { text: d.sun ? 'Everything you planned is built. Plan something new in the Forge' : 'Plan your first piece in the Forge', need: 0, pct: d.sun ? 100 : 0 };
  const pct = next.price ? Math.min(100, Math.floor((credits * 100) / next.price)) : 100;
  if (credits >= next.price && !next.problem) return { text: `Next: ${next.piece.short} — ready to build (${next.price.toLocaleString('en-NZ')} credits)`, need: next.price, pct: 100 };
  return { text: `Next: ${next.piece.short} — ${credits.toLocaleString('en-NZ')} of ${next.price.toLocaleString('en-NZ')} credits`, need: next.price, pct };
}

/** Bolt's next-step line for the Forge tab. Never about the maths questions. */
export function forgeStep(d: SystemDesign, credits: number, ownsMoon: boolean): { say: string; target?: string } {
  const next = nextPiece(d, ownsMoon);
  if (!d.sun) return { say: 'Start by choosing your sun. Planning is free, so try anything you like!', target: 'forge-slots' };
  if (!next) return { say: d.planets.length ? 'Everything you planned is built. Add another planet, or press "View in full screen" to see it all.' : 'Your sun is built! Press + planet to plan your first world.', target: 'forge-slots' };
  if (next.problem) return { say: `${next.problem}`, target: 'forge-slots' };
  if (credits >= next.price) return { say: `You have enough to build ${next.piece.short} (${cr(next.price)}). Open it and press Build it!`, target: 'forge-slots' };
  return { say: `${next.piece.short[0].toUpperCase()}${next.piece.short.slice(1)} needs ${cr(next.price - credits)} more. Trade to earn it, then come back and build.`, target: 'tab-trade' };
}

/** A one-line science tip about the "just right" (Goldilocks) zone for the current sun. */
export function zoneTip(d: SystemDesign): string {
  const kind: SunKind | undefined = d.sun?.kind;
  if (!kind) return 'Pick a sun and I will show you where the "just right" zone is: where water can stay liquid.';
  const z = SUNS[kind].zone;
  if (!z) return `A ${SUNS[kind].name.toLowerCase()} has no "just right" zone, so life on its planets needs domes.`;
  const slots = z[0] === z[1] ? `planet ${z[0] + 1}` : `planets ${z[0] + 1} to ${z[1] + 1}`;
  return `The green band is the "just right" zone: for a ${SUNS[kind].name.toLowerCase()} it is ${slots}. Water stays liquid there, so life is easy.`;
}

export const zoneSlots = (d: SystemDesign, count: number): boolean[] => Array.from({ length: count }, (_, i) => inZone(d.sun?.kind, i));

export { COMET_PRICE, emptyDesign };
