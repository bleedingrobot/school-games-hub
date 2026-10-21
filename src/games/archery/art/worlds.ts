/**
 * Each world's colours and living touches (docs/ARCHERY-PLAN.md, sections 3 and 10), from the
 * look-and-feel mock-up James approved.
 */
import type { WorldId } from '../../../../shared/archery/types';

export interface Palette {
  seed: number;
  sky: [string, string, string];
  sun: { x: number; y: number; r: number; c: string; glow: string; rays: string | null } | null;
  moon: { x: number; y: number; r: number } | null;
  farBack: [string, string];
  farFront: [string, string];
  haze: string;
  snowcap: string | null;
  hill: [string, string];
  treeA: string;
  treeB: string;
  /** Rock: top colour, deep colour, the strata line colour. */
  soil: [string, string];
  strata: string;
  /** The land's own top: main colour, light edge, shadow under it. */
  surf: string;
  surf2: string;
  surfShade: string;
  pebble: [string, string];
  dust: [string, string];
  cloud: [string, string];
  weather: 'leaves' | 'sand' | 'snow' | 'city';
  hitWord: string;
  /** The darker tint of freshly dug earth around a crater. */
  scar: string;
}

export const WORLDS: Record<WorldId, Palette> = {
  forest: {
    seed: 11, sky: ['#58b3ec', '#a6dbf6', '#ffe8c0'],
    sun: { x: 0.8, y: 0.16, r: 34, c: '#fff6c2', glow: 'rgba(255,240,170,.6)', rays: 'rgba(255,250,220,.15)' }, moon: null,
    farBack: ['#a3c7e6', '#cfe3f2'], farFront: ['#7ea9d3', '#a7c6e3'], haze: '#e5f2fa', snowcap: '#f4f9ff',
    hill: ['#4f9a45', '#8fcd6c'], treeA: '#2c7543', treeB: '#47a05c',
    soil: ['#b0927a', '#4a3832'], strata: '#5e4a3e', surf: '#5cbf45', surf2: '#a6e86f', surfShade: '#2f6a2a',
    pebble: ['#6a4224', '#cf9b68'], dust: ['#f1dfbd', '#c9a677'], cloud: ['#ffffff', '#cfe2f2'], weather: 'leaves', hitWord: 'THUD!',
    scar: '#4a2e1e',
  },
  desert: {
    seed: 23, sky: ['#3f9fdc', '#93d0ee', '#ffdc9c'],
    sun: { x: 0.78, y: 0.17, r: 44, c: '#fff3b8', glow: 'rgba(255,196,90,.55)', rays: 'rgba(255,230,170,.15)' }, moon: null,
    farBack: ['#ebbe95', '#f6dbbb'], farFront: ['#d58f5c', '#ebb07e'], haze: '#ffe8c6', snowcap: null,
    hill: ['#e09d4f', '#f8d08c'], treeA: '#3e8a4e', treeB: '#62b36b',
    soil: ['#e8a466', '#873e20'], strata: '#a9542a', surf: '#f6cf7c', surf2: '#fff0c4', surfShade: '#b7783a',
    pebble: ['#a65e2a', '#f8d49a'], dust: ['#fbe7c2', '#ddb176'], cloud: ['#fffaf0', '#f0d6b8'], weather: 'sand', hitWord: 'POOF!',
    scar: '#7a3a1c',
  },
  snow: {
    seed: 37, sky: ['#5594d4', '#a7d0f1', '#f0f8ff'],
    sun: { x: 0.2, y: 0.15, r: 28, c: '#ffffff', glow: 'rgba(255,255,255,.75)', rays: null }, moon: null,
    farBack: ['#b7cee8', '#dae8f6'], farFront: ['#90b0d8', '#b9cfea'], haze: '#ecf5ff', snowcap: '#ffffff',
    hill: ['#c8dcf0', '#f7fbff'], treeA: '#2a5a70', treeB: '#41808f',
    soil: ['#a9bbd1', '#3d5072'], strata: '#6f84a3', surf: '#ffffff', surf2: '#ffffff', surfShade: '#7ea6d6',
    pebble: ['#5b80aa', '#e6f3ff'], dust: ['#ffffff', '#cfe2f4'], cloud: ['#ffffff', '#d5e2f0'], weather: 'snow', hitWord: 'FLUMP!',
    scar: '#34466a',
  },
  city: {
    seed: 53, sky: ['#2b285e', '#94578f', '#ffb077'],
    sun: null, moon: { x: 0.84, y: 0.15, r: 24 },
    farBack: ['#6f5c9f', '#8a74b0'], farFront: ['#4f4384', '#62529a'], haze: '#e7a28c', snowcap: null,
    hill: ['#3a3160', '#4c4178'], treeA: '#2c5a46', treeB: '#3d7a5a',
    soil: ['#b06a50', '#4a2630'], strata: '#7e3e30', surf: '#b8b0c8', surf2: '#e6e0f0', surfShade: '#4a3a52',
    pebble: ['#7a3a33', '#e6a184'], dust: ['#f6e1d3', '#c9a29a'], cloud: ['#f6c1c4', '#b985a6'], weather: 'city', hitWord: 'THWACK!',
    scar: '#3a1c22',
  },
};
