/** The items a rocket can hold (up to 3), and how likely each one is from each kind of star. */

export type ItemKind =
  | 'booster'
  | 'hyperdrive'
  | 'navigator'
  | 'force-field'
  | 'escape-pod'
  | 'repair-kit'
  | 'warp-key'
  | 'rescue-beacon'
  | 'tractor-beam'
  | 'gravity-anchor'
  | 'space-mine'
  | 'quantum-swap';

export const ITEM_KINDS: readonly ItemKind[] = [
  'booster', 'hyperdrive', 'navigator', 'force-field', 'escape-pod', 'repair-kit',
  'warp-key', 'rescue-beacon', 'tractor-beam', 'gravity-anchor', 'space-mine', 'quantum-swap',
];

export const MAX_ITEMS = 3;

export interface ItemInfo {
  name: string;
  /** "help" items only affect you; "hinder" items affect someone else. */
  kind: 'help' | 'hinder';
  /** Automatic items work by themselves and can't be used from the item tray. */
  automatic: boolean;
  /** Hinders aimed at another rocket. */
  targeted: boolean;
  rare: boolean;
}

export const ITEMS: Record<ItemKind, ItemInfo> = {
  booster: { name: 'Booster', kind: 'help', automatic: false, targeted: false, rare: false },
  hyperdrive: { name: 'Hyperdrive', kind: 'help', automatic: false, targeted: false, rare: true },
  navigator: { name: 'Navigator', kind: 'help', automatic: false, targeted: false, rare: true },
  'force-field': { name: 'Force Field', kind: 'help', automatic: true, targeted: false, rare: false },
  'escape-pod': { name: 'Escape Pod', kind: 'help', automatic: true, targeted: false, rare: false },
  'repair-kit': { name: 'Repair Kit', kind: 'help', automatic: false, targeted: false, rare: false },
  'warp-key': { name: 'Warp Key', kind: 'help', automatic: false, targeted: false, rare: false },
  'rescue-beacon': { name: 'Rescue Beacon', kind: 'help', automatic: false, targeted: false, rare: false },
  'tractor-beam': { name: 'Tractor Beam', kind: 'hinder', automatic: false, targeted: true, rare: false },
  'gravity-anchor': { name: 'Gravity Anchor', kind: 'hinder', automatic: false, targeted: true, rare: false },
  'space-mine': { name: 'Space Mine', kind: 'hinder', automatic: false, targeted: false, rare: false },
  'quantum-swap': { name: 'Quantum Swap', kind: 'hinder', automatic: false, targeted: true, rare: true },
};

export type ItemTier = 'common' | 'random' | 'rare';

/**
 * Which items each tier can give, and how often (bigger number = more often).
 * The Rescue Beacon never comes from a star: it's only given to a rocket far behind.
 */
export const ITEM_TIERS: Record<ItemTier, readonly (readonly [ItemKind, number])[]> = {
  common: [
    ['booster', 3], ['force-field', 2], ['escape-pod', 2], ['repair-kit', 1],
    ['space-mine', 2], ['tractor-beam', 2],
  ],
  random: [
    ['booster', 3], ['force-field', 2], ['escape-pod', 2], ['repair-kit', 1],
    ['space-mine', 2], ['tractor-beam', 2], ['gravity-anchor', 2], ['warp-key', 1],
    ['hyperdrive', 1], ['navigator', 1], ['quantum-swap', 1],
  ],
  rare: [['hyperdrive', 1], ['navigator', 1], ['quantum-swap', 1], ['warp-key', 1]],
};

/** Catch-up help: the rocket in last place gets one tier better. */
export function betterTier(tier: ItemTier): ItemTier {
  return tier === 'common' ? 'random' : 'rare';
}

export function isItemKind(value: unknown): value is ItemKind {
  return ITEM_KINDS.includes(value as ItemKind);
}
