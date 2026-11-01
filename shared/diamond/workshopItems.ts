/**
 * The Claw Workshop's upgrades (docs/DIAMOND-PLAN.md, section 3.5): looks only, never part of a level's replay.
 * Prices come from the rarity (RARITY_PRICE in config.ts). An upgrade with `earnedBy` can't be bought: it comes with that achievement.
 */
import type { WorkshopItem } from './config';

export const WORKSHOP_ITEMS: readonly WorkshopItem[] = [
  // head: the claw itself
  { id: 'golden-claw', name: 'Golden Claw', slot: 'head', rarity: 'epic' },
  { id: 'dino-jaw', name: 'Dino Jaw', slot: 'head', rarity: 'cool' },
  { id: 'robot-hand', name: 'Robot Hand', slot: 'head', rarity: 'cool' },
  { id: 'crab-pincer', name: 'Crab Pincer', slot: 'head', rarity: 'common' },
  { id: 'octopus-arm', name: 'Octopus Arm', slot: 'head', rarity: 'common' },
  { id: 'giant-magnet', name: 'Giant Magnet', slot: 'head', rarity: 'cool' },
  { id: 'rubber-chicken', name: 'Rubber Chicken', slot: 'head', rarity: 'common' },
  { id: 'giant-fork', name: 'Giant Fork', slot: 'head', rarity: 'common' },
  { id: 'dragon-talon', name: 'Dragon Talon', slot: 'head', rarity: 'legendary' },
  { id: 'ice-crystal-claw', name: 'Ice Crystal Claw', slot: 'head', rarity: 'epic' },
  { id: 'grabby-glove', name: 'Grabby Glove', slot: 'head', rarity: 'cool' },
  { id: 'diamond-claw', name: 'Diamond Claw', slot: 'head', rarity: 'legendary', earnedBy: 'diamond_found' },
  // rope: the line the claw hangs from
  { id: 'rainbow-rope', name: 'Rainbow Rope', slot: 'rope', rarity: 'epic' },
  { id: 'jungle-vine', name: 'Jungle Vine', slot: 'rope', rarity: 'cool' },
  { id: 'laser-beam', name: 'Laser Beam', slot: 'rope', rarity: 'legendary' },
  { id: 'sausage-chain', name: 'Sausage Chain', slot: 'rope', rarity: 'common' },
  { id: 'spaghetti', name: 'Spaghetti', slot: 'rope', rarity: 'common' },
  { id: 'candy-cane', name: 'Candy Cane', slot: 'rope', rarity: 'common' },
  { id: 'bike-chain', name: 'Bike Chain', slot: 'rope', rarity: 'cool' },
  { id: 'star-rope', name: 'Star Rope', slot: 'rope', rarity: 'legendary', earnedBy: 'diamond_stars' },
  // trail: what follows the claw as it moves
  { id: 'sparkles', name: 'Sparkles', slot: 'trail', rarity: 'epic' },
  { id: 'bubbles', name: 'Bubbles', slot: 'trail', rarity: 'common' },
  { id: 'flames', name: 'Flames', slot: 'trail', rarity: 'cool' },
  { id: 'confetti', name: 'Confetti', slot: 'trail', rarity: 'cool' },
  { id: 'music-notes', name: 'Music Notes', slot: 'trail', rarity: 'common' },
  // catch: what happens when the claw grabs something
  { id: 'fireworks', name: 'Fireworks', slot: 'catch', rarity: 'epic' },
  { id: 'disco-ball', name: 'Disco Ball', slot: 'catch', rarity: 'epic' },
  { id: 'gem-rain', name: 'Gem Rain', slot: 'catch', rarity: 'epic' },
  { id: 'trumpet-fanfare', name: 'Trumpet Fanfare', slot: 'catch', rarity: 'common' },
  { id: 'happy-dance', name: "Nugget's Happy Dance", slot: 'catch', rarity: 'common' },
  { id: 'gem-rain-deluxe', name: 'Gem Rain Deluxe', slot: 'catch', rarity: 'epic', earnedBy: 'diamond_kinds' },
  // winch: the drum that reels the rope in
  { id: 'steam-engine', name: 'Steam Engine', slot: 'winch', rarity: 'cool' },
  { id: 'rocket-winch', name: 'Rocket Winch', slot: 'winch', rarity: 'legendary' },
  { id: 'giant-snail', name: 'Giant Snail', slot: 'winch', rarity: 'common' },
  { id: 'pirate-ship-wheel', name: 'Pirate Ship Wheel', slot: 'winch', rarity: 'cool' },
  { id: 'hamster-wheel', name: 'Hamster Wheel', slot: 'winch', rarity: 'common' },
  // hat: hats for Nugget the kiwi
  { id: 'pirate-hat', name: 'Pirate Hat', slot: 'hat', rarity: 'cool' },
  { id: 'crown', name: 'Crown', slot: 'hat', rarity: 'epic' },
  { id: 'wizard-hat', name: 'Wizard Hat', slot: 'hat', rarity: 'cool' },
  { id: 'chefs-hat', name: "Chef's Hat", slot: 'hat', rarity: 'common' },
  { id: 'astronaut-helmet', name: 'Astronaut Helmet', slot: 'hat', rarity: 'legendary' },
  { id: 'top-hat', name: 'Top Hat', slot: 'hat', rarity: 'cool' },
  { id: 'miner-lamp', name: 'Miner Lamp', slot: 'hat', rarity: 'cool', earnedBy: 'diamond_grips' },
];
