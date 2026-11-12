/**
 * The painted profile art (docs/PROFILE-ART-PLAN.md, card P2): earned pictures, trophies in bronze, silver and gold, the three
 * picture rings and the cabinet shelf. Only the addresses are bundled; each file is fetched when it is first drawn.
 * Every painting has a 512 px file and a `-small` 160 px file for anything drawn at 80 px or less.
 */
import type { Tier } from './earnedPictures';

const FILES = import.meta.glob('./art/{pictures,trophies,rings,cabinet}/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

function find(folder: string, file: string): string | undefined {
  return FILES[`./art/${folder}/${file}.webp`];
}

/** An earned picture's painting (`name` is the art's name, e.g. 'clan-banner'), full size and small. */
export function paintedPicture(name: string): { art: string; artSmall: string } | undefined {
  const art = find('pictures', name);
  return art ? { art, artSmall: find('pictures', `${name}-small`) ?? art } : undefined;
}

/** The Dragon Head painted in each metal (it is the one picture with its own painting per tier). */
export function paintedPictureByTier(name: string): Record<Tier, { art: string; artSmall: string }> | undefined {
  const bronze = paintedPicture(`${name}-bronze`);
  const silver = paintedPicture(`${name}-silver`);
  const gold = paintedPicture(`${name}-gold`);
  return bronze && silver && gold ? { bronze, silver, gold } : undefined;
}

/** The art name of each trophy (kind 'trophy') id; every one is painted in all three metals. */
export const TROPHY_ART: Record<string, string> = {
  'dm-slayer': 'slayers-sword',
  'clan-tooth': 'monster-tooth',
  'chess-knight': 'champions-knight',
  'checkers-king': 'champions-king',
  '101-shark': 'card-shark',
  'pc-cup': 'clash-cup',
  'space-wormhole': 'wormhole',
  'mm-league': 'league-champion',
  'mm-shiny': 'shiny-star',
  'marble-cup': 'marble-cup',
  'bond-star': 'bond-star',
  'mine-lamp': 'miners-lamp',
  'archery-feather': 'hawk-feather',
  'decree-seal': 'royal-seal',
  'trader-ring': 'star-ring',
  'isles-keeper': 'keepers-medal',
  'training-shield': 'times-tables-shield',
  'quick-looks-gate': 'garden-gate',
  'hub-regular': 'season-regular',
  'hub-best-friends': 'best-friends-cup',
  'pair-adventurer': 'adventurers-badge',
  'pair-star-monarch': 'star-monarch',
  'pair-golden-wings': 'golden-wings',
  'hw-star': 'homework-star',
  'hw-weekend': 'weekend-explorer',
  'hw-cup': 'home-learning-cup',
};

/** Each early-years game's Garden Cup is `<game>-cup`. */
const GARDEN_GAMES = ['beanstalk', 'hop', 'pipi', 'korora', 'weka', 'tui', 'lizard', 'parrot', 'pigeon', 'robin', 'swamphen'];

export function trophyArtName(trophyId: string): string | undefined {
  if (TROPHY_ART[trophyId]) return TROPHY_ART[trophyId];
  return GARDEN_GAMES.some((g) => trophyId === `${g}-cup`) ? 'garden-cup' : undefined;
}

/** A painted trophy in a metal, or undefined when it is not painted (the drawn stand-in is used). */
export function paintedTrophy(trophyId: string, tier: Tier, small = false): string | undefined {
  const name = trophyArtName(trophyId);
  return name ? find('trophies', `${name}-${tier}${small ? '-small' : ''}`) : undefined;
}

/** The painted ring for a metal, cut out with a see-through middle. For big sizes only. */
export function paintedRing(tier: Tier): string | undefined {
  return find('rings', `ring-${tier}`);
}

/** The cabinet shelf painting (a wide scene), 800 px wide. */
export const SHELF_ART: string | undefined = find('cabinet', 'shelf-800') ?? find('cabinet', 'shelf');
/** The glow painted behind a friend's picture. */
export const BACKDROP_GOLD = paintedPicture('backdrop-gold');
