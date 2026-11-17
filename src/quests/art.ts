/** The quest paintings (docs/quests-art/config.json). Only the addresses are bundled; a missing one falls back to a gradient. */
import type { QuestKind } from '../../shared/quests/kinds';

const FILES = import.meta.glob('./art/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export function questArt(kind: QuestKind, small = false): string | undefined {
  return (small ? FILES[`./art/quest-${kind}-800.webp`] : undefined) ?? FILES[`./art/quest-${kind}.webp`];
}
