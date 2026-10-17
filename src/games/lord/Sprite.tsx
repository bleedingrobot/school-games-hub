import type { CSSProperties } from 'react';
import tiles from './tiles.png';
import {
  ARMOUR_TILES, CLASS_TILES, DEFAULT_MONSTER_TILE, DRAGON_TILE, HERO_TILE, ICON_TILES, MASTER_TILES, MONSTER_TILES, SHEET_COLUMNS,
  SHEET_ROWS, TILE, WEAPON_TILES, type Tile,
} from './tileMap';
import type { HeroClass, Monster } from '../../../shared/lord/types';

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

export function MonsterSprite({ monster, scale = 6 }: { monster: Pick<Monster, 'name' | 'id' | 'level'>; scale?: number }) {
  const dragon = monster.id.startsWith('dragon-');
  return <Sprite tile={monsterTile(monster)} scale={scale} colour={dragon ? ANSI.red : colourForLevel(monster.level)} label={monster.name} />;
}

export const HeroSprite = ({ heroClass, scale = 6 }: { heroClass?: HeroClass; scale?: number }) => (
  <Sprite tile={heroClass ? CLASS_TILES[heroClass] : HERO_TILE} scale={scale} colour={ANSI.white} label="Your hero" />
);
export const WeaponSprite = ({ index, scale = 3 }: { index: number; scale?: number }) => <Sprite tile={WEAPON_TILES[index]} scale={scale} colour={ANSI.cyan} />;
export const ArmourSprite = ({ index, scale = 3 }: { index: number; scale?: number }) => <Sprite tile={ARMOUR_TILES[index]} scale={scale} colour={ANSI.yellow} />;
export const Icon = ({ name, scale = 2, colour = ANSI.yellow }: { name: keyof typeof ICON_TILES; scale?: number; colour?: string }) => (
  <Sprite tile={ICON_TILES[name]} scale={scale} colour={colour} />
);
