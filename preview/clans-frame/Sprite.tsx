/**
 * Try-out stand-in for src/games/clans/Sprite.tsx: shows the painted pictures where the try-out has them, and the
 * old one-colour tiles everywhere else. The real loader comes in Stage A.3 (src/games/clans/art.ts).
 */
import * as Old from '../../src/games/clans/Sprite';

export const { ANSI, raceColour, zoneColour, Sprite, MonsterSprite, PlaceSprite } = Old;

const ART = import.meta.glob('./art/*.webp', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;
export const art = (name: string): string | undefined => ART[`./art/${name}.webp`];
const slug = (s: string) => s.toLowerCase().replace(/'/g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The try-out's pretend clan has one look per race and class. */
const LOOKS: Record<string, string> = {
  'Human/Warrior': 'human-warrior-male-1', 'Elf/Healer': 'elf-healer-female-1',
  'Dwarf/Knight': 'dwarf-knight-male-1', 'Halfling/Wizard': 'halfling-wizard-female-1',
};

export function Portrait({ race, cls, scale = 4 }: { race: string; cls: string; scale?: number }) {
  const src = art(`member-${LOOKS[`${race}/${cls}`]}`);
  if (!src) return <Old.Portrait race={race} cls={cls} scale={scale} />;
  return (
    <span className="cq-portrait cq-portrait--painted" title={`${race} ${cls}`}>
      <img src={src} alt="" />
    </span>
  );
}

export function ItemSprite({ name, kind, scale = 3 }: { name: string; kind: string; scale?: number }) {
  const src = art(`item-${slug(name)}`);
  if (!src) return <Old.ItemSprite name={name} kind={kind} scale={scale} />;
  return <img className="cq-item-art" src={src} alt="" style={{ height: 16 * scale }} />;
}
