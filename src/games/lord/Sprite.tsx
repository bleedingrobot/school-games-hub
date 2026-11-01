import type { CSSProperties } from 'react';
import tiles from './tiles.png';
import {
  ARMOUR_TILES, CLASS_TILES, DEFAULT_MONSTER_TILE, DRAGON_TILE, HERO_TILE, ICON_TILES, MASTER_TILES, MONSTER_TILES, SHEET_COLUMNS,
  SHEET_ROWS, TILE, WEAPON_TILES, type Tile,
} from './tileMap';
import type { HeroClass, Monster } from '../../../shared/lord/types';
import { ARMOURS, WEAPONS } from '../../../shared/lord/data';
import { armourArt, dragonArt, heroArt, lookArt, masterArt, monsterArt, weaponArt } from './art';

/** The old 16 ANSI colours, used to colour the one-colour pictures. */
export const ANSI = {
  green: '#55ff55', cyan: '#55ffff', red: '#ff5555', yellow: '#ffff55', magenta: '#ff55ff', white: '#ffffff', grey: '#aaaaaa',
  blue: '#7777ff', orange: '#ffaa00', darkgreen: '#00aa00', brown: '#aa7744',
};
const LEVEL_COLOURS = [ANSI.green, ANSI.cyan, ANSI.yellow, ANSI.orange, ANSI.magenta, ANSI.red, ANSI.blue, ANSI.white];
export const colourForLevel = (level: number) => LEVEL_COLOURS[(level - 1) % LEVEL_COLOURS.length];

/** One 16 × 16 picture from the sheet, drawn `scale` times bigger with hard edges and a colour. */
export function Sprite({ tile, scale = 4, colour = ANSI.green, label, className = '' }: {
  tile: Tile; scale?: number; colour?: string; label?: string; className?: string;
}) {
  const size = TILE * scale;
  const style: CSSProperties = {
    width: size, height: size, backgroundColor: colour,
    WebkitMaskImage: `url(${tiles})`, maskImage: `url(${tiles})`,
    WebkitMaskSize: `${SHEET_COLUMNS * size}px ${SHEET_ROWS * size}px`, maskSize: `${SHEET_COLUMNS * size}px ${SHEET_ROWS * size}px`,
    WebkitMaskPosition: `${-tile[0] * size}px ${-tile[1] * size}px`, maskPosition: `${-tile[0] * size}px ${-tile[1] * size}px`,
  };
  return <span className={`lord-sprite ${className}`} style={style} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

export const monsterTile = (m: Pick<Monster, 'name' | 'id'>): Tile =>
  m.id.startsWith('dragon-') ? DRAGON_TILE : m.id.startsWith('master-') ? MASTER_TILES[Number(m.id.slice(7)) - 2] ?? HERO_TILE : MONSTER_TILES[m.name] ?? DEFAULT_MONSTER_TILE;

/** The painted picture for a monster, master or the dragon, if it has arrived (art.ts). */
export function paintedMonster(m: Pick<Monster, 'name' | 'id'>): string | undefined {
  if (m.id.startsWith('dragon-')) return dragonArt();
  if (m.id.startsWith('master-')) return masterArt(m.name);
  return monsterArt(m.name);
}

/**
 * A painted picture `scale × 16` pixels tall (the same box the old tile used, so layouts keep their size).
 * `label` empty = decorative.
 */
function Painted({ src, scale, label, kind }: { src: string; scale: number; label?: string; kind: string }) {
  return (
    <img
      className={`lord-art lord-art--${kind}`} src={src} alt={label ?? ''} aria-hidden={label ? undefined : true}
      style={{ height: TILE * scale }} decoding="async" draggable={false}
    />
  );
}

/** `decorative` when the name is written right beside it, so a screen reader does not say it twice. */
export function MonsterSprite({ monster, scale = 6, decorative = false }: { monster: Pick<Monster, 'name' | 'id' | 'level'>; scale?: number; decorative?: boolean }) {
  const dragon = monster.id.startsWith('dragon-');
  const label = decorative ? undefined : monster.name;
  const painted = paintedMonster(monster);
  if (painted) return <Painted src={painted} scale={scale} label={label} kind={dragon ? 'dragon' : monster.id.startsWith('master-') ? 'master' : 'monster'} />;
  return <Sprite tile={monsterTile(monster)} scale={scale} colour={dragon ? ANSI.red : colourForLevel(monster.level)} label={label} className="lord-sprite--figure" />;
}

export function HeroSprite({ heroClass, look, scale = 6, label = 'Your hero' }: { heroClass?: HeroClass; look?: string; scale?: number; label?: string }) {
  // A painted hero is the whole hero, head to boots, so it is drawn taller than the old whole-body tile to look the same size.
  const painted = (look && lookArt(look)) || (heroClass && heroArt(heroClass));
  if (painted) return <Painted src={painted} scale={scale * 1.8} label={label} kind="hero" />;
  return <Sprite tile={heroClass ? CLASS_TILES[heroClass] : HERO_TILE} scale={scale} colour={ANSI.white} label={label} className="lord-sprite--figure" />;
}
/**
 * Shop gear: the painting if it has arrived, else the old tile. Always decorative, because the name is written beside it.
 * A painting is drawn a third bigger than the tile: its detail is lost at the tile's size.
 */
export function WeaponSprite({ index, scale = 3 }: { index: number; scale?: number }) {
  const painted = WEAPONS[index] && weaponArt(WEAPONS[index].name);
  if (painted) return <Painted src={painted} scale={scale * 1.35} kind="gear" />;
  return <Sprite tile={WEAPON_TILES[index]} scale={scale} colour={ANSI.cyan} className="lord-sprite--weapon" />;
}
export function ArmourSprite({ index, scale = 3 }: { index: number; scale?: number }) {
  const painted = ARMOURS[index] && armourArt(ARMOURS[index].name);
  if (painted) return <Painted src={painted} scale={scale * 1.35} kind="gear" />;
  return <Sprite tile={ARMOUR_TILES[index]} scale={scale} colour={ANSI.yellow} className="lord-sprite--armour" />;
}
export const Icon = ({ name, scale = 2, colour = ANSI.yellow }: { name: keyof typeof ICON_TILES; scale?: number; colour?: string }) => (
  <Sprite tile={ICON_TILES[name]} scale={scale} colour={colour} className={`lord-sprite--${name}`} />
);
