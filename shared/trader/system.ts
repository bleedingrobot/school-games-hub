/**
 * The Star Forge: your own solar system (docs/TRADER-SYSTEM-PLAN.md). Every piece a pupil can choose, its price and
 * its rules, and the one function the server and the screen both use to work out what a change costs (`forgeCost`).
 *
 * A pupil's system is a `SystemDesign`. Every piece in it is either planned (free, shown as a hologram) or built
 * (`built: true`, paid for with credits). Looks (surface, tint, clouds, sky colour, names, ring tilt, creature) can be
 * changed freely while planned; on a built piece they cost a repaint. Changing what a built piece *is* (a sun's kind, a
 * planet's type or size) is pulling it down (half back) and building the new one.
 *
 * Pure: no Date, no random. The viewer reads the same design to draw it.
 */

// ---------------------------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------------------------

export type SunKind = 'yellow' | 'red' | 'blue' | 'white' | 'pulsar' | 'binary' | 'blackhole' | 'baby';
export type PlanetKind =
  | 'rocky' | 'desert' | 'ice' | 'ocean' | 'lava' | 'jungle' | 'gas' | 'icegiant' | 'crystal' | 'toxic'
  | 'eyeball' | 'shattered' | 'cube' | 'donut' | 'ringworld';
export type RingKind = 'dusty' | 'icy' | 'crystal' | 'rainbow' | 'double';
export type EffectKind = 'aurora' | 'lightning' | 'volcano' | 'geysers' | 'meteors' | 'glowseas' | 'islands' | 'tail';
export type LifeKind = 'microbes' | 'plants' | 'sea' | 'animals' | 'floaters' | 'crystalfolk' | 'robots' | 'cities';
export type TechKind = 'satellites' | 'moonbase' | 'station' | 'telescope' | 'elevator' | 'domes' | 'terraformer' | 'orbitalring' | 'engine';
export type SystemTechKind = 'lanes' | 'miners' | 'sails' | 'dyson' | 'gate';
export type BeltKind = 'rocky' | 'icy' | 'golden';
export type CloudKind = 'none' | 'thin' | 'thick' | 'storms' | 'spot';

export interface SunInfo {
  name: string;
  price: number;
  /** Slots (0 = nearest) where water stays liquid: the Goldilocks zone. Null: nowhere (life needs domes). */
  zone: [number, number] | null;
  /** The colour its light gives everything (0xRRGGBB), and the colour plants grow to catch it. */
  light: number;
  plants: number;
  /** One line for the facts card and Bolt. */
  fact: string;
  silly?: true;
}

export const SUNS: Record<SunKind, SunInfo> = {
  yellow: { name: 'Yellow star', price: 3000, zone: [2, 3], light: 0xfff1d6, plants: 0x3f8f3a, fact: 'A star like our Sun. It will shine steadily for about 10 billion years.' },
  red: { name: 'Red dwarf', price: 2500, zone: [0, 1], light: 0xffb08a, plants: 0x2a1838, fact: 'The most common star in the galaxy. Small, cool and very long-lived, so its planets huddle close.' },
  blue: { name: 'Blue giant', price: 5000, zone: [5, 7], light: 0xcfe0ff, plants: 0xb8452c, fact: 'Huge and fierce. Its light is so strong that plants here would be red to keep from burning.' },
  white: { name: 'White dwarf', price: 3500, zone: [0, 0], light: 0xf2f6ff, plants: 0x2f7f6f, fact: 'The hot, tiny core left after a star like the Sun runs out of fuel. About the size of Earth.' },
  pulsar: { name: 'Pulsar', price: 6000, zone: null, light: 0xd8e6ff, plants: 0x5a6aa0, fact: 'A spinning dead star that sweeps two beams of light round, like a lighthouse, many times a second.' },
  binary: { name: 'Two suns', price: 8000, zone: [3, 5], light: 0xffe6c4, plants: 0x2f8f78, fact: 'Two stars circling each other. Most stars in the galaxy have a partner. Every planet gets two sunsets.' },
  blackhole: { name: 'Black hole', price: 12000, zone: null, light: 0xffc68a, plants: 0x6a3a8a, fact: 'So heavy that not even light escapes. A ring of hot gas glows as it swirls in, and it bends the starlight behind it.' },
  baby: { name: 'Baby star', price: 4000, zone: [2, 4], light: 0xffe0b8, plants: 0x7fa040, fact: 'A young star still wrapped in the cloud of dust and gas it was born from. Its planets are still forming.' },
};

/** Size names and how much each multiplies a planet's price by (tenths). */
export const SIZES = ['Small', 'Medium', 'Large', 'Huge'] as const;
export const SIZE_TENTHS = [8, 10, 13, 16] as const;

export interface PlanetInfo {
  name: string;
  price: number;
  /** Has ground to stand on (elevators, animals, cities). */
  solid: boolean;
  /** Has open water (sea life, glowing seas). */
  water: boolean;
  /** The life it can hold, before the Goldilocks rule. */
  life: LifeKind[];
  fact: string;
  silly?: true;
  /** A built ring round the sun (a tier 3 wonder): no rings or moons of its own. */
  wonder?: true;
}

const LAND_LIFE: LifeKind[] = ['microbes', 'plants', 'animals', 'robots', 'cities'];
export const PLANETS: Record<PlanetKind, PlanetInfo> = {
  rocky: { name: 'Rocky world', price: 1500, solid: true, water: false, life: LAND_LIFE, fact: 'Bare rock and craters, like Mercury or our Moon.' },
  desert: { name: 'Desert world', price: 1800, solid: true, water: false, life: LAND_LIFE, fact: 'Sand seas and canyons, like Mars.' },
  ice: { name: 'Ice world', price: 1800, solid: true, water: true, life: ['microbes', 'sea', 'robots'], fact: 'Frozen all over. There may be an ocean under the ice, like on Europa.' },
  ocean: { name: 'Ocean world', price: 2500, solid: false, water: true, life: ['microbes', 'plants', 'sea', 'cities'], fact: 'Water from pole to pole, hundreds of kilometres deep.' },
  lava: { name: 'Lava world', price: 2200, solid: true, water: false, life: ['microbes', 'robots'], fact: 'Rivers of molten rock and erupting volcanoes, like Io.' },
  jungle: { name: 'Jungle world', price: 3000, solid: true, water: true, life: ['microbes', 'plants', 'sea', 'animals', 'robots', 'cities'], fact: 'Warm and wet, covered in thick forest and rivers.' },
  gas: { name: 'Gas giant', price: 3500, solid: false, water: false, life: ['microbes', 'floaters'], fact: 'A huge ball of gas with no ground at all, like Jupiter. Storms here can be bigger than Earth.' },
  icegiant: { name: 'Ice giant', price: 3000, solid: false, water: false, life: ['microbes', 'floaters'], fact: 'Blue-green and cold, like Uranus and Neptune, with fierce winds.' },
  crystal: { name: 'Crystal world', price: 4000, solid: true, water: false, life: ['microbes', 'crystalfolk', 'robots'], fact: 'Mountains of glittering crystal. Some planets may really be rich in diamond.' },
  toxic: { name: 'Toxic swamp', price: 2000, solid: true, water: true, life: ['microbes', 'plants', 'sea', 'animals'], fact: 'Thick, cloudy air and bubbling swamps, a bit like Venus with puddles.' },
  eyeball: { name: 'Eyeball world', price: 3000, solid: true, water: true, life: ['microbes', 'plants', 'sea', 'animals', 'cities'], fact: 'One side always faces its sun and the other is always night. Life lives in the ring between.' },
  shattered: { name: 'Shattered world', price: 3500, solid: true, water: false, life: ['microbes', 'robots'], fact: 'A planet broken into pieces by a huge crash, slowly drifting apart.' },
  cube: { name: 'Cube planet', price: 3000, solid: true, water: false, life: LAND_LIFE, fact: 'Made up! Gravity would pull a real planet this big into a ball.', silly: true },
  donut: { name: 'Donut planet', price: 4000, solid: true, water: true, life: LAND_LIFE, fact: 'Scientists have worked out a spinning donut-shaped planet could hold together. Nobody has found one.', silly: true },
  ringworld: { name: 'Ring world', price: 15000, solid: true, water: true, life: ['plants', 'animals', 'robots', 'cities'], fact: 'A giant band built all the way round a star. An idea from science fiction.', wonder: true },
};

export interface Priced { name: string; price: number; silly?: true }
export const RINGS: Record<RingKind, Priced> = {
  dusty: { name: 'Dusty rings', price: 800 },
  icy: { name: 'Icy rings', price: 1000 },
  crystal: { name: 'Crystal rings', price: 1500 },
  rainbow: { name: 'Rainbow rings', price: 1800, silly: true },
  double: { name: 'Double rings', price: 2000 },
};
export const MOON_PRICE_PIECE = 700;

export interface EffectInfo extends Priced { needs?: 'water' | 'solid' | 'near' }
export const EFFECTS: Record<EffectKind, EffectInfo> = {
  aurora: { name: 'Auroras', price: 900 },
  lightning: { name: 'Lightning storms', price: 700 },
  volcano: { name: 'Glowing volcanoes', price: 800, needs: 'solid' },
  geysers: { name: 'Ice geysers', price: 900, needs: 'solid' },
  meteors: { name: 'Meteor showers', price: 700 },
  glowseas: { name: 'Glowing seas', price: 1000, needs: 'water' },
  islands: { name: 'Floating islands', price: 1500, silly: true },
  tail: { name: 'Dust tail', price: 1200, needs: 'near' },
};
export const MAX_EFFECTS = 3;

export interface LifeInfo extends Priced { fact: string; creatures: number }
export const LIFE: Record<LifeKind, LifeInfo> = {
  microbes: { name: 'Microbes', price: 1500, creatures: 3, fact: 'Tiny living things. The first life on Earth was like this, for billions of years.' },
  plants: { name: 'Plants and forests', price: 2500, creatures: 3, fact: 'Plants grow the colour that best catches their sun\'s light.' },
  sea: { name: 'Sea creatures', price: 3000, creatures: 5, fact: 'Life began in Earth\'s oceans.' },
  animals: { name: 'Land animals', price: 3500, creatures: 5, fact: 'Herds and hunters that roam the land.' },
  floaters: { name: 'Sky floaters', price: 3500, creatures: 4, fact: 'Giant jellies drifting in the clouds. Scientists have wondered if gas giants could hold life like this.' },
  crystalfolk: { name: 'Crystal beings', price: 5000, creatures: 3, fact: 'Made up! Living crystals that glow and hum.' },
  robots: { name: 'Robots', price: 6000, creatures: 4, fact: 'Machines that build and mend themselves.' },
  cities: { name: 'Cities', price: 7000, creatures: 4, fact: 'A whole civilisation, with lights on the night side.' },
};

export interface TechInfo extends Priced { tier: 1 | 2 | 3; needs?: 'solid' | 'moon' }
export const TECH: Record<TechKind, TechInfo> = {
  satellites: { name: 'Satellites', price: 1000, tier: 1 },
  moonbase: { name: 'Moon base', price: 1500, tier: 1, needs: 'moon' },
  station: { name: 'Space station', price: 2000, tier: 1 },
  telescope: { name: 'Giant telescope', price: 1500, tier: 1 },
  elevator: { name: 'Space elevator', price: 4000, tier: 2, needs: 'solid' },
  domes: { name: 'Domes', price: 4000, tier: 2 },
  terraformer: { name: 'Terraformer', price: 5000, tier: 2, needs: 'solid' },
  orbitalring: { name: 'Orbital ring', price: 20000, tier: 3 },
  engine: { name: 'Planet engine', price: 10000, tier: 3, needs: 'solid' },
};

export interface SystemTechInfo extends Priced { tier: 1 | 2 | 3; needs?: 'belt' | 'twoPlanets' }
export const SYSTEM_TECH: Record<SystemTechKind, SystemTechInfo> = {
  lanes: { name: 'Trade lanes', price: 2000, tier: 1, needs: 'twoPlanets' },
  sails: { name: 'Solar sail ships', price: 2500, tier: 2 },
  miners: { name: 'Asteroid miners', price: 3000, tier: 2, needs: 'belt' },
  gate: { name: 'Star gate', price: 12000, tier: 3 },
  dyson: { name: 'Dyson ring', price: 15000, tier: 3 },
};

export const BELTS: Record<BeltKind, Priced> = {
  rocky: { name: 'Rocky asteroid belt', price: 1500 },
  icy: { name: 'Icy asteroid belt', price: 1800 },
  golden: { name: 'Golden asteroid belt', price: 2500 },
};
export const COMET_PRICE = 1000;
export const MAX_COMETS = 3;

/** Looks: how many painted surfaces per planet type, colour tints, cloud kinds, sky colours, moon looks and backgrounds. */
export const SURFACES = 4;
export const TINTS = 8;
export const CLOUDS: CloudKind[] = ['none', 'thin', 'thick', 'storms', 'spot'];
export const SKY_COLOURS = 8;
export const MOON_LOOKS = 8;
export const BACKGROUNDS = 8;
export const MAX_PLANETS = 8;
export const MAX_MOONS = 3;
/** A repaint of a built piece costs this share of its price (percent), and pulling one down gives this share back. */
export const REPAINT_PCT = 10;
export const REFUND_PCT = 50;

/** Names are made from two word lists (no typing): [first, second]. */
export const NAME_FIRST = [
  'Aurora', 'Nova', 'Zephyr', 'Orion', 'Lumen', 'Vega', 'Astra', 'Cosmo', 'Echo', 'Ember', 'Frost', 'Gale', 'Halo', 'Iris', 'Juno',
  'Kepler', 'Lyra', 'Mira', 'Nebula', 'Onyx', 'Pixel', 'Quasar', 'Rigel', 'Sol', 'Tera', 'Umbra', 'Vortex', 'Wren', 'Xeno', 'Zenith',
  'Comet', 'Coral', 'Dusk', 'Dawn', 'Flint', 'Jade', 'Kiwi', 'Moana', 'Pounamu', 'Rangi', 'Tui', 'Kauri', 'Ruby', 'Sapphire', 'Storm',
  'Thunder', 'Velvet', 'Willow', 'Blaze', 'Breeze', 'Crystal', 'Glimmer', 'Marble', 'Nimbus', 'Opal', 'Pebble', 'Ripple', 'Sprout', 'Star', 'Twinkle',
] as const;
export const NAME_SECOND = [
  'Prime', 'Major', 'Minor', 'Nine', 'Seven', 'Alpha', 'Beta', 'Gamma', 'Delta', 'Omega', 'One', 'Two', 'Three', 'Four', 'Five',
  'Rise', 'Haven', 'Reach', 'Deep', 'Peak', 'Hollow', 'Gate', 'Spire', 'Drift', 'Bloom', 'Glow', 'Shine', 'Spark', 'Dream', 'Wonder',
  'Falls', 'Isle', 'Point', 'Ridge', 'Vale', 'World', 'Base', 'Star', 'Moon', 'Rock',
] as const;
export type NamePick = [number, number];
export const nameText = (n: NamePick): string => `${NAME_FIRST[n[0]] ?? NAME_FIRST[0]} ${NAME_SECOND[n[1]] ?? NAME_SECOND[0]}`;

// ---------------------------------------------------------------------------------------------
// A design
// ---------------------------------------------------------------------------------------------

export interface Built { built?: boolean }
export interface SunPick extends Built { kind: SunKind; name: NamePick }
export interface RingPick extends Built { kind: RingKind; tilt: number }
export interface MoonPick extends Built { id: number; look: number; /** The moon bought before the Forge (Star Trader's old goal): free, and painted as "Your moon". */ yours?: boolean }
export interface EffectPick extends Built { kind: EffectKind }
export interface LifePick extends Built { kind: LifeKind; creature: number }
export interface TechPick extends Built { kind: TechKind }
export interface PlanetPick extends Built {
  /** Stays the same when planets are moved, so a built planet is never charged twice. */
  id: number;
  kind: PlanetKind;
  size: number;
  surface: number;
  tint: number;
  clouds: CloudKind;
  sky: number;
  name: NamePick;
  ring: RingPick | null;
  moons: MoonPick[];
  effects: EffectPick[];
  life: LifePick | null;
  tech: TechPick[];
}
export interface BeltPick extends Built { kind: BeltKind }
export interface CometsPick extends Built { count: number }
export interface SystemTechPick extends Built { kind: SystemTechKind }

export interface SystemDesign {
  v: 1;
  name: NamePick;
  sun: SunPick | null;
  /** In order from the sun: index 0 is the nearest slot. */
  planets: PlanetPick[];
  belt: BeltPick | null;
  /** After this many planets (0 = inside the first). */
  beltAfter: number;
  comets: CometsPick | null;
  background: number;
  tech: SystemTechPick[];
}

export const emptyDesign = (): SystemDesign => ({ v: 1, name: [0, 0], sun: null, planets: [], belt: null, beltAfter: 2, comets: null, background: 0, tech: [] });

export const newPlanet = (id: number, kind: PlanetKind = 'rocky'): PlanetPick => ({
  id, kind, size: 1, surface: 0, tint: 0, clouds: 'thin', sky: 0, name: [id % NAME_FIRST.length, 0], ring: null, moons: [], effects: [], life: null, tech: [],
});

export const planetPrice = (p: Pick<PlanetPick, 'kind' | 'size'>): number => Math.round((PLANETS[p.kind].price * SIZE_TENTHS[p.size]) / 10 / 100) * 100;

/** True if a planet in this slot is in its sun's Goldilocks zone. */
export function inZone(sun: SunKind | undefined, slot: number): boolean {
  const z = sun ? SUNS[sun].zone : null;
  return !!z && slot >= z[0] && slot <= z[1];
}

/** The planet's slot is close to its sun (a dust tail can stream off it). */
export const nearSun = (slot: number): boolean => slot <= 1;

// ---------------------------------------------------------------------------------------------
// Checking a design
// ---------------------------------------------------------------------------------------------

const isInt = (n: unknown, lo: number, hi: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= lo && n <= hi;
const isName = (n: unknown): n is NamePick => Array.isArray(n) && n.length === 2 && isInt(n[0], 0, NAME_FIRST.length - 1) && isInt(n[1], 0, NAME_SECOND.length - 1);
const has = <K extends string>(table: Record<K, unknown>, k: unknown): k is K => typeof k === 'string' && Object.prototype.hasOwnProperty.call(table, k);
const bool = (b: unknown): boolean => b === undefined || typeof b === 'boolean';

/**
 * Why a design can't be saved, in pupil words, or null when it's fine. Checks shape (anything sent by a browser) and the
 * rules that keep the picture sensible. A planned piece may break a "needs" rule (it's just a plan); a built one may not.
 */
export function designProblem(d: unknown): string | null {
  const bad = 'That system could not be read.';
  if (!d || typeof d !== 'object') return bad;
  const s = d as SystemDesign;
  if (s.v !== 1 || !isName(s.name) || !isInt(s.background, 0, BACKGROUNDS - 1) || !isInt(s.beltAfter, 0, MAX_PLANETS)) return bad;
  if (s.sun !== null && (!s.sun || !has(SUNS, s.sun.kind) || !isName(s.sun.name) || !bool(s.sun.built))) return bad;
  if (!Array.isArray(s.planets) || s.planets.length > MAX_PLANETS) return bad;
  if (s.belt !== null && (!s.belt || !has(BELTS, s.belt.kind) || !bool(s.belt.built))) return bad;
  if (s.comets !== null && (!s.comets || !isInt(s.comets.count, 1, MAX_COMETS) || !bool(s.comets.built))) return bad;
  if (!Array.isArray(s.tech) || s.tech.length > Object.keys(SYSTEM_TECH).length) return bad;
  if (new Set(s.tech.map((x) => x?.kind)).size !== s.tech.length || !s.tech.every((x) => x && has(SYSTEM_TECH, x.kind) && bool(x.built))) return bad;
  const ids = new Set<number>();
  for (const p of s.planets) {
    if (!p || !isInt(p.id, 0, 999) || ids.has(p.id)) return bad;
    ids.add(p.id);
    if (!has(PLANETS, p.kind) || !isInt(p.size, 0, SIZES.length - 1) || !isInt(p.surface, 0, SURFACES - 1) || !isInt(p.tint, 0, TINTS - 1)) return bad;
    if (!CLOUDS.includes(p.clouds) || !isInt(p.sky, 0, SKY_COLOURS - 1) || !isName(p.name) || !bool(p.built)) return bad;
    if (p.ring !== null && (!p.ring || !has(RINGS, p.ring.kind) || !isInt(p.ring.tilt, 0, 4) || !bool(p.ring.built))) return bad;
    if (!Array.isArray(p.moons) || p.moons.length > MAX_MOONS) return bad;
    const moonIds = new Set<number>();
    for (const m of p.moons) {
      if (!m || !isInt(m.id, 0, 999) || moonIds.has(m.id) || !isInt(m.look, 0, MOON_LOOKS - 1) || !bool(m.built) || !bool(m.yours)) return bad;
      moonIds.add(m.id);
    }
    if (!Array.isArray(p.effects) || p.effects.length > MAX_EFFECTS) return bad;
    if (new Set(p.effects.map((x) => x?.kind)).size !== p.effects.length || !p.effects.every((x) => x && has(EFFECTS, x.kind) && bool(x.built))) return bad;
    if (p.life !== null && (!p.life || !has(LIFE, p.life.kind) || !isInt(p.life.creature, 0, LIFE[p.life.kind].creatures - 1) || !bool(p.life.built))) return bad;
    if (!Array.isArray(p.tech) || p.tech.length > Object.keys(TECH).length) return bad;
    if (new Set(p.tech.map((x) => x?.kind)).size !== p.tech.length || !p.tech.every((x) => x && has(TECH, x.kind) && bool(x.built))) return bad;
    if (PLANETS[p.kind].wonder && (p.ring || p.moons.length)) return 'A ring world has no rings or moons of its own.';
  }
  if (s.planets.flatMap((p) => p.moons).filter((m) => m.yours).length > 1) return 'You only have one moon of your own.';
  return builtProblem(s);
}

/** The rules a built piece must keep (a planned piece may break them while it's only a plan). */
function builtProblem(s: SystemDesign): string | null {
  const anyBuilt = s.planets.some((p) => p.built) || !!s.belt?.built || !!s.comets?.built || s.tech.some((t) => t.built);
  if (anyBuilt && !s.sun?.built) return 'Build your sun first. Everything else goes round it.';
  for (let slot = 0; slot < s.planets.length; slot++) {
    const p = s.planets[slot];
    const info = PLANETS[p.kind];
    const parts = [p.ring, p.life, ...p.moons, ...p.effects, ...p.tech].filter(Boolean) as Built[];
    if (!p.built && parts.some((x) => x.built)) return `Build ${nameText(p.name)} before the things on it.`;
    for (const e of p.effects) {
      if (!e.built) continue;
      const need = EFFECTS[e.kind].needs;
      if (need === 'water' && !info.water) return `${EFFECTS[e.kind].name} need a world with water.`;
      if (need === 'solid' && !info.solid) return `${EFFECTS[e.kind].name} need solid ground.`;
      if (need === 'near' && !nearSun(slot)) return 'A dust tail only streams off a planet close to its sun.';
    }
    for (const t of p.tech) {
      if (!t.built) continue;
      const need = TECH[t.kind].needs;
      if (need === 'solid' && !info.solid) return `${TECH[t.kind].name} needs solid ground.`;
      if (need === 'moon' && !p.moons.some((m) => m.built)) return 'A moon base needs a moon.';
    }
    if (p.life?.built) {
      if (!info.life.includes(p.life.kind)) return `${LIFE[p.life.kind].name} can't live on a ${info.name.toLowerCase()}.`;
      if (!inZone(s.sun?.kind, slot) && !p.tech.some((t) => t.kind === 'domes' && t.built)) {
        return `${nameText(p.name)} is outside the "just right" zone, so life there needs domes first.`;
      }
    }
  }
  for (const t of s.tech) {
    if (!t.built) continue;
    const need = SYSTEM_TECH[t.kind].needs;
    if (need === 'belt' && !s.belt?.built) return 'Asteroid miners need an asteroid belt.';
    if (need === 'twoPlanets' && s.planets.filter((p) => p.built).length < 2) return 'Trade lanes need two built planets.';
  }
  return null;
}

/** Why a planned piece can't be built yet (for greying out "Build it"), or null. Uses the same rules as the server. */
export function lifeProblem(s: SystemDesign, slot: number, kind: LifeKind): string | null {
  const p = s.planets[slot];
  if (!p) return null;
  if (!PLANETS[p.kind].life.includes(kind)) return `${LIFE[kind].name} can't live on a ${PLANETS[p.kind].name.toLowerCase()}.`;
  if (!inZone(s.sun?.kind, slot) && !p.tech.some((t) => t.kind === 'domes')) return 'Outside the "just right" zone: add domes first.';
  return null;
}

// ---------------------------------------------------------------------------------------------
// What a change costs
// ---------------------------------------------------------------------------------------------

export interface CostLine {
  what: string;
  /** Positive: paid. Negative: given back. */
  credits: number;
  kind: 'build' | 'repaint' | 'refund';
}

export interface ForgeCost {
  lines: CostLine[];
  /** What it comes to: paid less given back. */
  total: number;
  /** The total price of everything built (for points and the gallery). */
  worth: number;
}

const looksOf = (p: PlanetPick): string => JSON.stringify([p.surface, p.tint, p.clouds, p.sky, p.name, p.ring?.tilt ?? 0, p.life?.creature ?? 0, p.moons.map((m) => [m.id, m.look])]);

/** Everything built in a design, with its price: the list `forgeCost` compares. Keys are stable ids. */
function builtPieces(s: SystemDesign, ownsMoon: boolean): Map<string, { what: string; price: number; looks: string }> {
  const out = new Map<string, { what: string; price: number; looks: string }>();
  const add = (key: string, what: string, price: number, looks = '') => out.set(key, { what, price, looks });
  if (s.sun?.built) add(`sun:${s.sun.kind}`, SUNS[s.sun.kind].name, SUNS[s.sun.kind].price, JSON.stringify([s.sun.name, s.name, s.background]));
  for (const p of s.planets) {
    if (!p.built) continue;
    const n = nameText(p.name);
    add(`planet:${p.id}:${p.kind}:${p.size}`, `${n} (${PLANETS[p.kind].name})`, planetPrice(p), looksOf(p));
    if (p.ring?.built) add(`ring:${p.id}:${p.ring.kind}`, `${RINGS[p.ring.kind].name} for ${n}`, RINGS[p.ring.kind].price);
    for (const m of p.moons) if (m.built) add(`moon:${p.id}:${m.id}`, `A moon for ${n}`, m.yours && ownsMoon ? 0 : MOON_PRICE_PIECE);
    for (const e of p.effects) if (e.built) add(`effect:${p.id}:${e.kind}`, `${EFFECTS[e.kind].name} on ${n}`, EFFECTS[e.kind].price);
    if (p.life?.built) add(`life:${p.id}:${p.life.kind}`, `${LIFE[p.life.kind].name} on ${n}`, LIFE[p.life.kind].price);
    for (const t of p.tech) if (t.built) add(`tech:${p.id}:${t.kind}`, `${TECH[t.kind].name} at ${n}`, TECH[t.kind].price);
  }
  if (s.belt?.built) add(`belt:${s.belt.kind}`, BELTS[s.belt.kind].name, BELTS[s.belt.kind].price, String(s.beltAfter));
  if (s.comets?.built) for (let i = 0; i < s.comets.count; i++) add(`comet:${i}`, 'A comet', COMET_PRICE);
  for (const t of s.tech) if (t.built) add(`stech:${t.kind}`, SYSTEM_TECH[t.kind].name, SYSTEM_TECH[t.kind].price);
  return out;
}

/**
 * What going from one design to the next costs: new built pieces at full price, built pieces with new looks at a
 * repaint, built pieces taken away at half back. `ownsMoon`: the pupil bought the old moon, so one moon is free.
 * Planned pieces never cost anything.
 */
export function forgeCost(before: SystemDesign, after: SystemDesign, ownsMoon = false): ForgeCost {
  const a = builtPieces(before, ownsMoon);
  const b = builtPieces(after, ownsMoon);
  const lines: CostLine[] = [];
  for (const [key, piece] of b) {
    const old = a.get(key);
    if (!old) lines.push({ what: piece.what, credits: piece.price, kind: 'build' });
    else if (old.looks !== piece.looks && piece.price > 0) lines.push({ what: `New look for ${piece.what}`, credits: Math.max(100, Math.round((piece.price * REPAINT_PCT) / 100 / 10) * 10), kind: 'repaint' });
  }
  for (const [key, piece] of a) {
    if (!b.has(key) && piece.price > 0) lines.push({ what: `Take down ${piece.what}`, credits: -Math.floor((piece.price * REFUND_PCT) / 100), kind: 'refund' });
  }
  const worth = [...b.values()].reduce((sum, p) => sum + p.price, 0);
  return { lines, total: lines.reduce((sum, l) => sum + l.credits, 0), worth };
}

/** What building every planned piece would cost now (the "Build everything" button and the goal bar). */
export function planCost(d: SystemDesign, ownsMoon = false): number {
  return forgeCost(d, buildAll(d), ownsMoon).total;
}

/** The same design with every piece built. */
export function buildAll(d: SystemDesign): SystemDesign {
  const b = <T extends Built>(x: T): T => ({ ...x, built: true });
  return {
    ...d,
    sun: d.sun && b(d.sun),
    planets: d.planets.map((p) => ({ ...b(p), ring: p.ring && b(p.ring), moons: p.moons.map(b), effects: p.effects.map(b), life: p.life && b(p.life), tech: p.tech.map(b) })),
    belt: d.belt && b(d.belt),
    comets: d.comets && b(d.comets),
    tech: d.tech.map(b),
  };
}

/** The counts kept for achievements (docs/TRADER-SYSTEM-PLAN.md, section 1.3). */
export function systemCounts(d: SystemDesign) {
  const planets = d.planets.filter((p) => p.built);
  const lifeOn = planets.filter((p) => p.life?.built);
  return {
    sun: d.sun?.built ? 1 : 0,
    planets: planets.length,
    life: lifeOn.length,
    lifeInZone: lifeOn.filter((p) => inZone(d.sun?.kind, d.planets.indexOf(p))).length,
    moons: planets.reduce((n, p) => n + p.moons.filter((m) => m.built).length, 0),
    bigTech: planets.reduce((n, p) => n + p.tech.filter((t) => t.built && TECH[t.kind].tier === 3).length, 0) + d.tech.filter((t) => t.built && SYSTEM_TECH[t.kind].tier === 3).length,
  };
}

/** The system in words, for screen readers and the gallery. Only built pieces unless `withPlans`. */
export function describeSystem(d: SystemDesign, withPlans = false): string {
  const show = (x: Built | null | undefined) => !!x && (withPlans || !!x.built);
  if (!show(d.sun)) return `The ${nameText(d.name)} System has no sun yet.`;
  const sun = d.sun!;
  const planets = d.planets.filter(show);
  const bits = [`The ${nameText(d.name)} System: a ${SUNS[sun.kind].name.toLowerCase()} called ${nameText(sun.name)}, with ${planets.length === 1 ? '1 planet' : `${planets.length} planets`}.`];
  for (const p of planets) {
    const extras = [
      p.ring && show(p.ring) ? RINGS[p.ring.kind].name.toLowerCase() : '',
      p.moons.filter(show).length ? `${p.moons.filter(show).length} moon${p.moons.filter(show).length > 1 ? 's' : ''}` : '',
      ...p.effects.filter(show).map((e) => EFFECTS[e.kind].name.toLowerCase()),
      p.life && show(p.life) ? LIFE[p.life.kind].name.toLowerCase() : '',
      ...p.tech.filter(show).map((t) => TECH[t.kind].name.toLowerCase()),
    ].filter(Boolean);
    bits.push(`${nameText(p.name)}, a ${SIZES[p.size].toLowerCase()} ${PLANETS[p.kind].name.toLowerCase()}${extras.length ? ` with ${extras.join(', ')}` : ''}.`);
  }
  if (show(d.belt)) bits.push(`A ${BELTS[d.belt!.kind].name.toLowerCase()}.`);
  const tech = d.tech.filter(show);
  if (tech.length) bits.push(`${tech.map((t) => SYSTEM_TECH[t.kind].name).join(', ')}.`);
  return bits.join(' ');
}
