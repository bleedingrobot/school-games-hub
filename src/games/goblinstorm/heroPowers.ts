/**
 * Each hero's own version of the 8 weapons (James, 20 Nov 2026): a Wizard casts spells, a Ranger uses the forest, and
 * so on. Only the name, blurb, picture and colour change; every hero's "blades" works exactly like every other's
 * (shared/goblinstorm/config.ts WEAPONS has the rules). The Knight uses the plain set. A hero whose starting weapon
 * already suits them keeps it (no entry here), e.g. the Wizard's Fireball.
 *
 * Pictures: weapons/<hero>/<weapon> and evolved/<hero>/<weapon>, painted from docs/goblinstorm-art/config.json; a
 * picture that isn't painted falls back to the plain one.
 */
import { WEAPONS, type HeroId, type WeaponId } from '../../../shared/goblinstorm/config';
import { paint } from './art';
import { WEAPON_COLOUR } from './look';

export interface PowerWords { name: string; blurb: string; evolved: string; evolvedBlurb: string }

const p = (name: string, blurb: string, evolved: string, evolvedBlurb: string): PowerWords => ({ name, blurb, evolved, evolvedBlurb });

export const HERO_POWERS: Partial<Record<HeroId, Partial<Record<WeaponId, PowerWords>>>> = {
  ranger: {
    blades: p('Whirling Leaves', 'Sharp leaves whirl around you.', 'Leaf Storm', 'A storm of leaves shreds the whole screen.'),
    fireball: p('Hunting Hawk', 'A hawk dives at the nearest monster.', 'Hawk Flock', 'A flock of hawks dives on every monster.'),
    lightning: p('Stinging Wasps', 'Wasps sting random monsters.', 'Hornet Swarm', 'Hornets sting the whole screen.'),
    aura: p('Thorn Ring', 'A ring of thorns hurts monsters near you.', 'Wild Brambles', 'Brambles burst across the screen.'),
    nova: p('Tangle Vines', 'Rings of vines slow and hurt monsters.', 'Forest Grasp', 'Roots grab the whole screen.'),
    axes: p('Boomerangs', 'Boomerangs loop up and swoop down through monsters.', 'Boomerang Tornado', 'A tornado of boomerangs tears through everything.'),
    bubble: p('Bark Shield', 'Tree bark blocks a hit, then grows back.', 'Great Oak', 'A great oak blasts monsters away.'),
  },
  wizard: {
    blades: p('Orbiting Runes', 'Glowing runes circle around you.', 'Rune Storm', 'A storm of runes shreds the whole screen.'),
    lightning: p('Magic Missiles', 'Magic bolts strike random monsters.', 'Star Fall', 'Stars crash down across the whole screen.'),
    aura: p('Arcane Circle', 'A magic circle hurts monsters near you.', 'Spell Burst', 'Magic bursts across the screen.'),
    nova: p('Time Ripple', 'Rings of time magic slow and hurt monsters.', 'Time Stop', 'Time freezes the whole screen.'),
    axes: p('Flying Spellbooks', 'Spellbooks fly up and slam down through monsters.', 'Book Tornado', 'A tornado of spellbooks tears through everything.'),
    arrows: p('Wand Sparks', 'Sparks shoot the way you are going.', 'Spark Rain', 'Sparks rain from the sky on every monster.'),
    bubble: p('Magic Shield', 'A magic bubble blocks a hit, then grows back.', 'Crystal Fortress', 'A crystal fortress blasts monsters away.'),
  },
  barbarian: {
    blades: p('Whirling Flails', 'Spiked flails spin around you.', 'Flail Storm', 'A storm of flails smashes the whole screen.'),
    fireball: p('Hurled Boulder', 'Hurls a boulder at the nearest monster.', 'Boulder Barrage', 'Boulders crash down on every monster.'),
    lightning: p('Thunder Stomp', 'Your stomps shake the ground under random monsters.', 'Earthquake', 'An earthquake shakes the whole screen.'),
    aura: p('Battle Fury', 'A red glow of fury hurts monsters near you.', 'Berserk Blaze', 'Fury blazes across the screen.'),
    nova: p('Battle Cry', 'Rings of shouting slow and hurt monsters.', 'Mighty Roar', 'A huge roar booms across the whole screen.'),
    arrows: p('Throwing Spears', 'Spears fly the way you are going.', 'Spear Rain', 'Spears rain from the sky on every monster.'),
    bubble: p('War Shield', 'A wooden shield blocks a hit, then comes back.', 'Iron Fortress', 'An iron fortress blasts monsters away.'),
  },
  cleric: {
    blades: p('Holy Hammers', 'Glowing hammers spin around you.', 'Hammer Halo', 'A halo of hammers smashes the whole screen.'),
    fireball: p('Holy Orb', 'Throws a glowing orb at the nearest monster.', 'Orb Storm', 'Glowing orbs rain on every monster.'),
    lightning: p('Sunbeams', 'Beams of light strike random monsters.', 'Judgement', 'Light strikes the whole screen.'),
    nova: p('Holy Bell', 'Rings from a holy bell slow and hurt monsters.', 'Great Bell', 'A great bell rings across the whole screen.'),
    axes: p('Holy Maces', 'Maces fly up and crash down through monsters.', 'Mace Tornado', 'A tornado of maces tears through everything.'),
    arrows: p('Light Darts', 'Darts of light fly the way you are going.', 'Light Rain', 'Light rains from the sky on every monster.'),
    bubble: p('Angel Shield', 'A shining shield blocks a hit, then comes back.', 'Angel Wings', 'Angel wings blast monsters away.'),
  },
  rogue: {
    blades: p('Spinning Daggers', 'Daggers spin around you.', 'Dagger Storm', 'A storm of daggers shreds the whole screen.'),
    fireball: p('Smoke Bombs', 'Throws a smoke bomb at the nearest monster.', 'Bomb Barrage', 'Bombs rain down on every monster.'),
    lightning: p('Shadow Strikes', 'Shadows strike random monsters.', 'Shadow Army', 'Shadows strike the whole screen.'),
    aura: p('Caltrops', 'Spiky caltrops hurt monsters near you.', 'Spike Field', 'Spikes burst across the screen.'),
    nova: p('Sticky Nets', 'Rings of net slow and hurt monsters.', 'Giant Net', 'A giant net covers the whole screen.'),
    axes: p('Throwing Stars', 'Stars fly up and crash down through monsters.', 'Star Tornado', 'A tornado of throwing stars tears through everything.'),
    arrows: p('Throwing Knives', 'Knives fly the way you are going.', 'Knife Rain', 'Knives rain from the sky on every monster.'),
    bubble: p('Shadow Cloak', 'A cloak hides you from one hit, then comes back.', 'Night Veil', 'Darkness blasts monsters away.'),
  },
  witch: {
    blades: p('Icicle Ring', 'Icicles spin around you.', 'Icicle Storm', 'A storm of icicles shreds the whole screen.'),
    fireball: p('Ice Bolt', 'Throws ice at the nearest monster.', 'Hailstorm', 'Hail rains down on every monster.'),
    lightning: p('Frost Spikes', 'Ice spikes burst under random monsters.', 'Glacier Burst', 'Ice bursts across the whole screen.'),
    aura: p('Chill Circle', 'A frosty circle hurts monsters near you.', 'Polar Flare', 'Cold light bursts across the screen.'),
    axes: p('Snowballs', 'Snowballs fly up and crash down through monsters.', 'Snowball Avalanche', 'An avalanche of snowballs tears through everything.'),
    arrows: p('Ice Shards', 'Ice shards fly the way you are going.', 'Shard Rain', 'Ice shards rain from the sky on every monster.'),
    bubble: p('Ice Wall', 'Ice blocks a hit, then grows back.', 'Ice Castle', 'An ice castle blasts monsters away.'),
  },
  dragonkid: {
    blades: p('Ember Ring', 'Hot embers spin around you.', 'Inferno Ring', 'A ring of fire scorches the whole screen.'),
    lightning: p('Lava Bursts', 'Lava bursts under random monsters.', 'Volcano', 'Lava erupts across the whole screen.'),
    aura: p('Dragon Heat', 'Hot air hurts monsters near you.', 'Dragon Sun', 'Dragon fire bursts across the screen.'),
    nova: p('Smoke Rings', 'Smoke rings slow and hurt monsters.', 'Ash Storm', 'Ash fills the whole screen.'),
    axes: p('Lava Rocks', 'Hot rocks fly up and crash down through monsters.', 'Lava Tornado', 'A tornado of hot rocks tears through everything.'),
    arrows: p('Fire Breath', 'Flames shoot the way you are going.', 'Flame Rain', 'Flames rain from the sky on every monster.'),
    bubble: p('Scale Shield', 'Dragon scales block a hit, then grow back.', 'Dragon Wings', 'Giant wings blast monsters away.'),
  },
};

/** A hero's words for a weapon: their own version, or the plain one. */
export function powerWords(hero: HeroId, weapon: WeaponId): PowerWords {
  const own = HERO_POWERS[hero]?.[weapon];
  if (own) return own;
  const w = WEAPONS[weapon];
  return { name: w.name, blurb: w.blurb, evolved: w.evolved.name, evolvedBlurb: w.evolved.blurb };
}

/** The picture path for a hero's weapon (or its evolved form): their own if painted, else the plain one. */
export function powerPic(hero: HeroId, weapon: WeaponId, evolved = false): string {
  const folder = evolved ? 'evolved' : 'weapons';
  const own = `${folder}/${hero}/${weapon}`;
  return HERO_POWERS[hero]?.[weapon] && paint(own) ? own : `${folder}/${weapon}`;
}

/** Each hero's colour, mixed into their own weapons' colours (the Knight and kept weapons stay as they are). */
export const HERO_TINT: Partial<Record<HeroId, string>> = {
  ranger: '#5fd35a',
  wizard: '#9a6bff',
  barbarian: '#e2552b',
  cleric: '#ffd84a',
  rogue: '#8a5ad0',
  witch: '#7fd8ff',
  dragonkid: '#ff6a1a',
};

const mix = (a: string, b: string, t: number): string => {
  const n = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map((i) => Math.round(n(a, i) * (1 - t) + n(b, i) * t).toString(16).padStart(2, '0')).join('');
};

/** A hero's colours for a weapon: the plain colours pulled toward the hero's tint. */
export function powerColour(hero: HeroId, weapon: WeaponId): { main: string; glow: string; evolved: string } {
  const base = WEAPON_COLOUR[weapon];
  const tint = HERO_TINT[hero];
  if (!tint || !HERO_POWERS[hero]?.[weapon]) return base;
  return { main: mix(base.main, tint, 0.6), glow: mix(base.glow, tint, 0.6), evolved: mix(base.evolved, tint, 0.45) };
}
