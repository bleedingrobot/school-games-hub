import beachFull from './art/boulder-beach.webp';
import beachSmall from './art/boulder-beach-small.webp';

import crownFull from './art/crown-range.webp';
import crownSmall from './art/crown-range-small.webp';
import geyserFull from './art/geyser-valley.webp';
import geyserSmall from './art/geyser-valley-small.webp';
import glacierFull from './art/glacier-run.webp';
import glacierSmall from './art/glacier-run-small.webp';
import welly from './art/windy-welly.webp';
import wellySmall from './art/windy-welly-small.webp';
import alpineFull from './art/alpine-crossing.webp';
import alpineSmall from './art/alpine-crossing-small.webp';
import hillFull from './art/wide-hill.webp';
import hillSmall from './art/wide-hill-small.webp';
import iceFull from './art/gap-and-ice.webp';
import iceSmall from './art/gap-and-ice-small.webp';

export type TopPattern = 'sand' | 'tarmac' | 'sinter' | 'snow' | 'concrete' | 'scoria' | 'grass' | 'none';
export type WallBase = 'planks' | 'boardwalk' | 'concrete' | 'rock' | 'snowbank' | 'hazard';
export type WallTop = 'log' | 'pipe' | 'none';
export type WallPost = 'round' | 'snowpole' | 'bollard' | 'none';
export interface WallLook {
  base: WallBase;
  top: WallTop;
  post: WallPost;
  /** A colour multiplied into the wall texture (default white). */
  tint?: number;
  /** Snow caps on the post tops and a white strip along log tops. */
  snowy?: boolean;
}

/** Extra look settings per course. */
export interface Look {
  /** Sun shadows, soft corner darkening, patterned tops, edge lines, slope stripes, low walls, sky gradient. */
  diorama: boolean;
  topPattern: TopPattern;
  wall: WallLook;
  skyTop: number;
  skyBottom: number;
  sunColour: number;
  /** The colour of the ground under the track and walls where it drops away (default: a soft sand from the course palette). */
  ground?: number;
  /** A painted picture behind the course (the full size, and a smaller one for Simple). The gradient sky shows until it loads. */
  backdrop?: { full: string; small: string };
}

const PLAIN: Look = { diorama: false, topPattern: 'none', wall: { base: 'planks', top: 'none', post: 'none' }, skyTop: 0xcfe9f3, skyBottom: 0xcfe9f3, sunColour: 0xfff4e0 };

const WARM = 0xffe2b0;
const COOL = 0xe6efff;

const LOOKS: Record<string, Look> = {
  'boulder-beach': { diorama: true, topPattern: 'sand', wall: { base: 'planks', top: 'log', post: 'round' }, skyTop: 0x7fc4ec, skyBottom: 0xfdf0d5, sunColour: WARM, backdrop: { full: beachFull, small: beachSmall } },
  'crown-range': { diorama: true, topPattern: 'tarmac', wall: { base: 'concrete', top: 'pipe', post: 'snowpole' }, skyTop: 0x7bc0ec, skyBottom: 0xe9dcc0, sunColour: WARM, ground: 0xc9a85a, backdrop: { full: crownFull, small: crownSmall } },
  'geyser-valley': { diorama: true, topPattern: 'sinter', wall: { base: 'boardwalk', top: 'log', post: 'round', tint: 0xcdb8a0 }, skyTop: 0x90caec, skyBottom: 0xf0e2c6, sunColour: WARM, ground: 0xc4a77c, backdrop: { full: geyserFull, small: geyserSmall } },
  'glacier-run': { diorama: true, topPattern: 'snow', wall: { base: 'snowbank', top: 'none', post: 'none' }, skyTop: 0x8ccfe9, skyBottom: 0xe2f0f5, sunColour: COOL, ground: 0xe3f0f8, backdrop: { full: glacierFull, small: glacierSmall } },
  'windy-welly': { diorama: true, topPattern: 'concrete', wall: { base: 'hazard', top: 'pipe', post: 'bollard' }, skyTop: 0x82c4e8, skyBottom: 0xe3eef0, sunColour: WARM, ground: 0x8e99a3, backdrop: { full: welly, small: wellySmall } },
  'alpine-crossing': { diorama: true, topPattern: 'scoria', wall: { base: 'rock', top: 'none', post: 'none' }, skyTop: 0x87caea, skyBottom: 0xe6e2d2, sunColour: WARM, ground: 0x8c5640, backdrop: { full: alpineFull, small: alpineSmall } },
  'wide-hill': { diorama: true, topPattern: 'grass', wall: { base: 'planks', top: 'log', post: 'round', tint: 0xb89a74 }, skyTop: 0x7ec7ea, skyBottom: 0xeaf0d0, sunColour: WARM, ground: 0x9cbd5c, backdrop: { full: hillFull, small: hillSmall } },
  'gap-and-ice': { diorama: true, topPattern: 'snow', wall: { base: 'planks', top: 'log', post: 'round', snowy: true }, skyTop: 0xacd7e9, skyBottom: 0xe8eef0, sunColour: COOL, ground: 0xcfdde8, backdrop: { full: iceFull, small: iceSmall } },
};

export function lookFor(courseId: string): Look {
  return LOOKS[courseId] ?? PLAIN;
}
