/** Stand-in pictures for the Forge's buttons: an emoji and a colour per choice, until the painted buttons arrive (art.ts). */
import type { BeltKind, EffectKind, LifeKind, PlanetKind, RingKind, SunKind, SystemTechKind, TechKind } from '../../../../shared/trader/system';

export interface Look { emoji: string; colour: string }

export const SUN_LOOK: Record<SunKind, Look> = {
  yellow: { emoji: '☀️', colour: '#ffd54a' }, red: { emoji: '🔴', colour: '#ff6a3d' }, blue: { emoji: '🔵', colour: '#6fa8ff' }, white: { emoji: '⚪', colour: '#f2f6ff' },
  pulsar: { emoji: '⚡', colour: '#cfe0ff' }, binary: { emoji: '🌞', colour: '#ffe6c4' }, blackhole: { emoji: '⚫', colour: '#2a1a40' }, baby: { emoji: '🌟', colour: '#ffb26b' },
};
export const PLANET_LOOK: Record<PlanetKind, Look> = {
  rocky: { emoji: '🪨', colour: '#8d8a86' }, desert: { emoji: '🏜️', colour: '#d9a35b' }, ice: { emoji: '🧊', colour: '#bfe3f5' }, ocean: { emoji: '🌊', colour: '#2f6fd0' },
  lava: { emoji: '🌋', colour: '#e2531c' }, jungle: { emoji: '🌴', colour: '#2f8f3a' }, gas: { emoji: '🪐', colour: '#d9b38a' }, icegiant: { emoji: '🔷', colour: '#6fd0d9' },
  crystal: { emoji: '💎', colour: '#b48cf5' }, toxic: { emoji: '☣️', colour: '#8fb832' }, eyeball: { emoji: '👁️', colour: '#5aa0a8' }, shattered: { emoji: '💥', colour: '#9a8a7a' },
  cube: { emoji: '🟦', colour: '#4f7fd0' }, donut: { emoji: '🍩', colour: '#d98fb0' }, ringworld: { emoji: '💍', colour: '#c0c8d8' },
};
export const LIFE_LOOK: Record<LifeKind, Look> = {
  microbes: { emoji: '🦠', colour: '#7fd06a' }, plants: { emoji: '🌿', colour: '#3f8f3a' }, sea: { emoji: '🐙', colour: '#3a7fd0' }, animals: { emoji: '🦌', colour: '#b0804a' },
  floaters: { emoji: '🪼', colour: '#e07fd0' }, crystalfolk: { emoji: '🔮', colour: '#9a7ff0' }, robots: { emoji: '🤖', colour: '#8ea0b8' }, cities: { emoji: '🏙️', colour: '#f0c060' },
};
export const TECH_LOOK: Record<TechKind, Look> = {
  satellites: { emoji: '🛰️', colour: '#8ea0b8' }, moonbase: { emoji: '🏠', colour: '#a0a8b8' }, station: { emoji: '🏗️', colour: '#b0b8c8' }, telescope: { emoji: '🔭', colour: '#7f9ad0' },
  elevator: { emoji: '🛗', colour: '#8ab0c8' }, domes: { emoji: '🏟️', colour: '#7fc0d0' }, terraformer: { emoji: '🌱', colour: '#5fb06a' }, orbitalring: { emoji: '⭕', colour: '#e0c060' }, engine: { emoji: '🔥', colour: '#f08040' },
};
export const SYSTEM_TECH_LOOK: Record<SystemTechKind, Look> = {
  lanes: { emoji: '🛣️', colour: '#7fb0e0' }, sails: { emoji: '⛵', colour: '#f0e0b0' }, miners: { emoji: '⛏️', colour: '#c0a060' }, gate: { emoji: '🌀', colour: '#8f7ff0' }, dyson: { emoji: '🔆', colour: '#ffd070' },
};
export const EFFECT_EMOJI: Record<EffectKind, string> = { aurora: '🌌', lightning: '⚡', volcano: '🌋', geysers: '💦', meteors: '☄️', glowseas: '✨', islands: '🏝️', tail: '💨' };
export const RING_EMOJI: Record<RingKind, string> = { dusty: '🪐', icy: '❄️', crystal: '💎', rainbow: '🌈', double: '⭕' };
export const BELT_COLOUR: Record<BeltKind, string> = { rocky: '#8d8a86', icy: '#bfe3f5', golden: '#e0b040' };

/** Tints and sky colours (the swatches). The names are what a screen reader hears; the colours are close to what the viewer paints. */
export const TINT_SWATCHES: [string, string][] = [
  ['Natural', '#9aa3ad'], ['Rose', '#e0809a'], ['Orange', '#e8903a'], ['Gold', '#e8c840'], ['Green', '#58b858'], ['Teal', '#38b8b0'], ['Blue', '#4a80e0'], ['Violet', '#9060d8'],
];
export const SKY_SWATCHES: [string, string][] = [
  ['Blue', '#5aa0f0'], ['Cyan', '#58d8e8'], ['Green', '#68d888'], ['Yellow', '#f0e060'], ['Orange', '#f09848'], ['Red', '#e85858'], ['Pink', '#f088c8'], ['Violet', '#a078f0'],
];
export const BACKGROUND_NAMES = ['Deep dark', 'Purple nebula', 'Milky Way', 'Close galaxy', 'Blue mist', 'Red dust', 'Green glow', 'Golden cloud'];
export const BACKGROUND_COLOURS = ['#05060f', '#3a1a5a', '#2a3050', '#4a2a6a', '#1a3a5a', '#5a2020', '#1a4a3a', '#5a4a1a'];
export const MOON_NAMES = ['Grey', 'Cratered', 'Dusty', 'Icy', 'Golden', 'Rusty', 'Bluish', 'Dark'];
export const SURFACE_NAMES = ['Look 1', 'Look 2', 'Look 3', 'Look 4'];
export const CLOUD_NAMES: Record<string, string> = { none: 'No clouds', thin: 'Thin clouds', thick: 'Thick clouds', storms: 'Swirling storms', spot: 'Giant storm spot' };
