/**
 * Island names (James, 3 Nov 2026): a pupil picks one from made-up names, never types one, so there's nothing rude to
 * catch. A name is a first word and a place word ("Cloudberry Hollow"). The server only keeps names this list makes.
 * Kept through New Season, like the Sky Keeper.
 */
export const NAME_FIRST = [
  'Cloudberry', 'Misty', 'Sunny', 'Moonlit', 'Starlight', 'Breezy', 'Honey', 'Willow', 'Pebble', 'Feather', 'Rainbow', 'Maple',
  'Clover', 'Lantern', 'Puffin', 'Bluebell', 'Thistle', 'Marigold', 'Silver', 'Golden', 'Drizzle', 'Seashell', 'Daisy', 'Fern',
] as const;
export const NAME_PLACE = [
  'Isle', 'Hollow', 'Haven', 'Rise', 'Nook', 'Meadow', 'Cove', 'Peak', 'Glen', 'Harbour', 'Gardens', 'Hill', 'Landing', 'Springs',
  'Rest', 'Reach',
] as const;

/** Is this one of the names the list makes? */
export function isIslandName(name: unknown): name is string {
  if (typeof name !== 'string') return false;
  const [first, place, ...rest] = name.split(' ');
  return rest.length === 0 && (NAME_FIRST as readonly string[]).includes(first) && (NAME_PLACE as readonly string[]).includes(place);
}

/** `count` different names to choose from, picked with `random` (0 to 1). */
export function nameChoices(random: () => number, count = 6): string[] {
  const out = new Set<string>();
  while (out.size < count) {
    out.add(`${NAME_FIRST[Math.floor(random() * NAME_FIRST.length)]} ${NAME_PLACE[Math.floor(random() * NAME_PLACE.length)]}`);
  }
  return [...out];
}
