/**
 * Goblin Storm's stand-in look: colours and simple shapes for every hero, monster, map and weapon, until James paints
 * the real art (docs/GOBLINSTORM-ART-PLAN.md). Attacks stay drawn in code even after that.
 */
import type { HeroId, PassiveId, WeaponId } from '../../../shared/goblinstorm/config';

export interface MapLook {
  ground: string;
  ground2: string;
  /** Little things scattered on the ground: tufts, stones, flowers. */
  bits: string[];
  /** Darkening at the edges of the screen. */
  vignette: string;
}

export const MAP_LOOKS: Record<string, MapLook> = {
  castle: { ground: '#5f9b45', ground2: '#6eab50', bits: ['#4c823a', '#86bf5d', '#f4e27a', '#f29bc0', '#9a9a8c'], vignette: 'rgba(20,40,10,0.45)' },
  forest: { ground: '#2f4f2c', ground2: '#3a5d33', bits: ['#24401f', '#4e7a3d', '#7a5a3a', '#b9e27d', '#5b4632'], vignette: 'rgba(5,15,8,0.6)' },
  graveyard: { ground: '#4a4a5c', ground2: '#555569', bits: ['#3a3a4a', '#6c6c84', '#8f8fa6', '#8bd0a0', '#2e2e3a'], vignette: 'rgba(10,8,25,0.6)' },
  peaks: { ground: '#d9e6f2', ground2: '#e8f1f9', bits: ['#b9cde0', '#ffffff', '#9fb8d0', '#cfe6ff', '#8aa3bb'], vignette: 'rgba(40,70,110,0.4)' },
  lava: { ground: '#3a2622', ground2: '#46302a', bits: ['#2a1a17', '#ff7a2a', '#ffb347', '#5a3a30', '#c2401c'], vignette: 'rgba(40,5,0,0.6)' },
  // The Storm Lands
  sunken: { ground: '#1f5f6e', ground2: '#26707f', bits: ['#174a56', '#3fa3a8', '#f0d58a', '#e27a8a', '#8ad8d0'], vignette: 'rgba(0,25,45,0.6)' },
  sky: { ground: '#9fb4d6', ground2: '#b3c6e2', bits: ['#8aa0c4', '#ffffff', '#dfe8f6', '#ffe68a', '#6f86ad'], vignette: 'rgba(30,35,80,0.55)' },
  crystal: { ground: '#2c2448', ground2: '#352b56', bits: ['#231c3a', '#9a7aff', '#6ae6ff', '#ff8ad8', '#4a3d78'], vignette: 'rgba(10,5,30,0.65)' },
  swamp: { ground: '#2c3a2a', ground2: '#344432', bits: ['#222e20', '#5a7a3a', '#8ab04a', '#b6e86a', '#3e2f2a'], vignette: 'rgba(5,10,5,0.7)' },
  citadel: { ground: '#3a3a4a', ground2: '#44445a', bits: ['#2e2e3c', '#7a7a9a', '#ffd84a', '#8ad0ff', '#56566e'], vignette: 'rgba(15,10,35,0.65)' },
};

export type Shape = 'blob' | 'critter' | 'winged' | 'spider' | 'brute' | 'ghost' | 'flame' | 'skull' | 'dragon' | 'mushroom';

export interface MonsterLook {
  shape: Shape;
  body: string;
  dark: string;
  eye: string;
  ears?: 'pointy' | 'round';
  horns?: boolean;
  crown?: boolean;
  tusks?: boolean;
  spots?: string;
}

/** By monster id (shared/goblinstorm/config.ts MAPS). */
export const MONSTER_LOOKS: Record<string, MonsterLook> = {
  goblin: { shape: 'critter', body: '#7bc043', dark: '#4e8a26', eye: '#fff36b', ears: 'pointy' },
  bat: { shape: 'winged', body: '#6b4c8a', dark: '#3f2a57', eye: '#ffde59' },
  slime: { shape: 'blob', body: '#59d1c9', dark: '#2a958e', eye: '#123' },
  troll: { shape: 'brute', body: '#8a9a6b', dark: '#5a6a44', eye: '#ffcf3a', tusks: true },
  goblinking: { shape: 'critter', body: '#5fae32', dark: '#3a7a1a', eye: '#ff5a3a', ears: 'pointy', crown: true },

  mushroom: { shape: 'mushroom', body: '#e2493b', dark: '#9e2a20', eye: '#222', spots: '#fff3e0' },
  wolf: { shape: 'critter', body: '#7d7f8c', dark: '#4e505c', eye: '#ffdd55', ears: 'pointy' },
  spider: { shape: 'spider', body: '#3a2e45', dark: '#1d1626', eye: '#ff4a4a' },
  giantspider: { shape: 'spider', body: '#4b2a5c', dark: '#24112e', eye: '#ff3030', spots: '#d33a3a' },
  ogre: { shape: 'brute', body: '#9c7a4f', dark: '#6a4e2e', eye: '#fff36b', tusks: true, horns: true },

  skeleton: { shape: 'skull', body: '#ece6d6', dark: '#a89f88', eye: '#2a2235' },
  ghost: { shape: 'ghost', body: '#dfe8ff', dark: '#9fb0d8', eye: '#2a2a55' },
  zombie: { shape: 'brute', body: '#7fae7a', dark: '#4e7a4a', eye: '#f5f5a0' },
  boneknight: { shape: 'skull', body: '#d9d3c0', dark: '#6c6c80', eye: '#ff4040', horns: true },
  lich: { shape: 'ghost', body: '#7a4fb0', dark: '#3e2266', eye: '#7dffb0', crown: true },

  imp: { shape: 'critter', body: '#8fd3ff', dark: '#4a9ad0', eye: '#fff', horns: true },
  frostwolf: { shape: 'critter', body: '#e8f4ff', dark: '#9fc0de', eye: '#3aa0ff', ears: 'pointy' },
  yeti: { shape: 'brute', body: '#f4f7fb', dark: '#b9c6d6', eye: '#3a5aa0', horns: true },
  yetichief: { shape: 'brute', body: '#e6eef8', dark: '#8fa4c0', eye: '#ff5a5a', horns: true, crown: true },
  icedragon: { shape: 'dragon', body: '#7fc8ff', dark: '#3a7ab8', eye: '#fff', horns: true },

  sprite: { shape: 'flame', body: '#ffb02e', dark: '#ff5a1f', eye: '#5a1a00' },
  slug: { shape: 'blob', body: '#ff7a3a', dark: '#b8401a', eye: '#2a0a00', spots: '#ffd36b' },
  magma: { shape: 'brute', body: '#4a3a36', dark: '#2a1e1c', eye: '#ffb02e', spots: '#ff6a1f' },
  golem: { shape: 'brute', body: '#5a4a44', dark: '#2e2420', eye: '#ff7a2a', spots: '#ff5a1f', horns: true },
  firedragon: { shape: 'dragon', body: '#e2452b', dark: '#8a1e10', eye: '#ffe36b', horns: true },

  raider: { shape: 'critter', body: '#3fa38a', dark: '#22665a', eye: '#fff36b', ears: 'round' },
  jelly: { shape: 'ghost', body: '#ff9ad8', dark: '#c25aa0', eye: '#4a1a3a' },
  crabknight: { shape: 'spider', body: '#e2573b', dark: '#9e2e1a', eye: '#fff' },
  giantcrab: { shape: 'spider', body: '#ff6a3a', dark: '#a83a1a', eye: '#fff', spots: '#ffd08a', crown: true },
  kraken: { shape: 'spider', body: '#7a4fb0', dark: '#3e2266', eye: '#ffe36b', spots: '#c8a0ff', crown: true },

  harpy: { shape: 'winged', body: '#8a9ad0', dark: '#4e5a8a', eye: '#fff36b' },
  gargoyle: { shape: 'winged', body: '#7a7a86', dark: '#4a4a54', eye: '#ff5a3a', horns: true },
  cloudgolem: { shape: 'blob', body: '#eef4ff', dark: '#a8b8d8', eye: '#3a5aa0' },
  roc: { shape: 'winged', body: '#e8b84a', dark: '#9a6a1a', eye: '#3a2a00', crown: true },
  stormgiant: { shape: 'brute', body: '#6a8ad0', dark: '#344a80', eye: '#fff36b', horns: true, crown: true },

  beetle: { shape: 'spider', body: '#4ad0c8', dark: '#207a74', eye: '#fff' },
  shardbat: { shape: 'winged', body: '#b98bff', dark: '#6a3ab0', eye: '#fff' },
  gemgolem: { shape: 'brute', body: '#8a6ad8', dark: '#4a3088', eye: '#6ae6ff', spots: '#ff8ad8' },
  crystalqueen: { shape: 'ghost', body: '#c8b0ff', dark: '#7a5ad0', eye: '#2a1a55', crown: true },
  wyrm: { shape: 'dragon', body: '#9a7aff', dark: '#4a2ab0', eye: '#6ae6ff', horns: true },

  bogimp: { shape: 'critter', body: '#6a8a3a', dark: '#3e5a1e', eye: '#ffde59', horns: true },
  wisp: { shape: 'flame', body: '#b6ff8a', dark: '#4ab05a', eye: '#1a3a1a' },
  hulk: { shape: 'brute', body: '#4e6a3a', dark: '#2a3e1e', eye: '#d8ff6a', spots: '#7a5a3a' },
  hag: { shape: 'ghost', body: '#6a7a5a', dark: '#3a4632', eye: '#d8ff6a', crown: true },
  hydra: { shape: 'dragon', body: '#2e4a3a', dark: '#14261c', eye: '#b6ff6a', horns: true },

  stormgoblin: { shape: 'critter', body: '#5a8ad0', dark: '#2e5a9a', eye: '#fff36b', ears: 'pointy' },
  crow: { shape: 'winged', body: '#3a3a4e', dark: '#1a1a26', eye: '#8ad0ff' },
  giant: { shape: 'brute', body: '#6a9a5a', dark: '#3a6030', eye: '#ffde59', tusks: true },
  stormknight: { shape: 'skull', body: '#c8d0e0', dark: '#5a6a8a', eye: '#8ad0ff', horns: true },
  stormking: { shape: 'critter', body: '#4a7ad8', dark: '#22448a', eye: '#ffe36b', ears: 'pointy', crown: true, horns: true },
};

export interface HeroLook { body: string; trim: string; skin: string; cape: string; hat: 'helmet' | 'hood' | 'pointy' | 'horns' | 'halo' | 'mask' | 'witch' | 'dragon' }

export const HERO_LOOKS: Record<HeroId, HeroLook> = {
  knight: { body: '#b8c2cc', trim: '#e8eef2', skin: '#f2c9a0', cape: '#2f6fd6', hat: 'helmet' },
  ranger: { body: '#3f8a3a', trim: '#a8d86a', skin: '#e9b98c', cape: '#2a5a2a', hat: 'hood' },
  wizard: { body: '#5a3fb0', trim: '#ffd84a', skin: '#f2c9a0', cape: '#3a2580', hat: 'pointy' },
  barbarian: { body: '#a0603a', trim: '#e0c08a', skin: '#e0a070', cape: '#7a2a1a', hat: 'horns' },
  cleric: { body: '#f2efe6', trim: '#ffd84a', skin: '#f2c9a0', cape: '#d9b34a', hat: 'halo' },
  rogue: { body: '#3a3a4a', trim: '#b05ad9', skin: '#e9b98c', cape: '#1e1e2a', hat: 'mask' },
  witch: { body: '#7fc8ff', trim: '#ffffff', skin: '#f6dccc', cape: '#3a6ab0', hat: 'witch' },
  dragonkid: { body: '#e2452b', trim: '#ffd36b', skin: '#f2a070', cape: '#8a1e10', hat: 'dragon' },
};

/** Each weapon's colour: its shots, its card frame and its evolution's flash. */
export const WEAPON_COLOUR: Record<WeaponId, { main: string; glow: string; evolved: string }> = {
  blades: { main: '#dfe9f5', glow: '#7fd0ff', evolved: '#ffcf4a' },
  fireball: { main: '#ff8a2a', glow: '#ffb347', evolved: '#ff4a1a' },
  lightning: { main: '#fff36b', glow: '#9fd8ff', evolved: '#b98bff' },
  aura: { main: '#ffe68a', glow: '#fff3b0', evolved: '#ffa23a' },
  nova: { main: '#bfe8ff', glow: '#7fd0ff', evolved: '#e8f8ff' },
  axes: { main: '#c9a06a', glow: '#ffd08a', evolved: '#ff8a4a' },
  arrows: { main: '#f2e2b8', glow: '#c8ff8a', evolved: '#8aff9a' },
  bubble: { main: '#9ae6ff', glow: '#c8f4ff', evolved: '#ff9ad8' },
};

/** Stand-in card pictures until the icons are painted. */
export const WEAPON_ICON: Record<WeaponId, string> = {
  blades: '⚔️', fireball: '🔥', lightning: '⚡', aura: '🌟', nova: '❄️', axes: '🪓', arrows: '🏹', bubble: '🫧',
};
export const PASSIVE_ICON: Record<PassiveId, string> = {
  armour: '🛡️', spiky: '🌵', boots: '👢', tome: '📖', crown: '👑', holywater: '💧', snow: '💠', gauntlets: '🧤', magnet: '🧲', heart: '❤️',
};
export const HERO_ICON: Record<HeroId, string> = {
  knight: '🛡️', ranger: '🏹', wizard: '🧙', barbarian: '🪓', cleric: '✨', rogue: '🗡️', witch: '❄️', dragonkid: '🐉',
};
export const MAP_ICON: Record<string, string> = {
  castle: '🏰', forest: '🌲', graveyard: '🪦', peaks: '🏔️', lava: '🌋',
  sunken: '🌊', sky: '⛈️', crystal: '💎', swamp: '🌫️', citadel: '🌪️',
};
