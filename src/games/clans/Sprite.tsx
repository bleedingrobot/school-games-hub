import type { CSSProperties } from 'react';
import { SHEET_COLUMNS, SHEET_ROWS, TILE, MONSTER_TILES, DEFAULT_MONSTER_TILE, CLASS_TILES, DEFAULT_CLASS_TILE, ITEM_TILES, KIND_TILES, PLACE_TILES, type Tile } from './tileMap';
import tiles from './tiles.png';

/** The old terminal colours, used to colour the one-colour pictures. */
export const ANSI = {
  green: '#55ff55', cyan: '#55ffff', red: '#ff5555', yellow: '#ffff55', magenta: '#ff55ff', white: '#ffffff', grey: '#aaaaaa',
  blue: '#7777ff', orange: '#ffaa00', darkgreen: '#00aa00', brown: '#aa7744',
};

const ZONE_COLOURS: Record<string, string> = { Meadow: ANSI.green, Caves: ANSI.cyan, Swamp: ANSI.darkgreen, Ruins: ANSI.yellow, Mountain: ANSI.orange };
const RACE_COLOURS: Record<string, string> = {
  Human: ANSI.white, Dwarf: ANSI.orange, Elf: ANSI.green, 'Half-Elf': ANSI.cyan, Halfling: ANSI.yellow, Orc: ANSI.darkgreen, Muya: ANSI.magenta,
  Minotaur: ANSI.brown, Imp: ANSI.red,
};
export const raceColour = (race: string) => RACE_COLOURS[race] ?? ANSI.white;
export const zoneColour = (zone: string) => ZONE_COLOURS[zone] ?? ANSI.grey;

/** One 16 x 16 picture from the sheet, drawn `scale` times bigger with hard edges and a colour. */
export function Sprite({ tile, scale = 4, colour = ANSI.green, label }: { tile: Tile; scale?: number; colour?: string; label?: string }) {
  const size = TILE * scale;
  const pos = `${-tile[0] * size}px ${-tile[1] * size}px`;
  const sheet = `${SHEET_COLUMNS * size}px ${SHEET_ROWS * size}px`;
  const style: CSSProperties = {
    width: size, height: size, backgroundColor: colour, WebkitMaskImage: `url(${tiles})`, maskImage: `url(${tiles})`,
    WebkitMaskSize: sheet, maskSize: sheet, WebkitMaskPosition: pos, maskPosition: pos,
  };
  return <span className="cq-sprite" style={style} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

export const MonsterSprite = ({ name, zone, scale = 4 }: { name: string; zone: string; scale?: number }) => (
  <Sprite tile={MONSTER_TILES[name] ?? DEFAULT_MONSTER_TILE} scale={scale} colour={zoneColour(zone)} />
);

/** A member's portrait, put together from parts: the class's figure, coloured by race, on a race-lettered badge. */
export function Portrait({ race, cls, scale = 4 }: { race: string; cls: string; scale?: number }) {
  return (
    <span className="cq-portrait" title={`${race} ${cls}`}>
      <Sprite tile={CLASS_TILES[cls] ?? DEFAULT_CLASS_TILE} scale={scale} colour={raceColour(race)} />
      <span className="cq-portrait__badge" style={{ color: raceColour(race) }} aria-hidden="true">
        {race[0]}
      </span>
    </span>
  );
}

const KIND_COLOURS: Record<string, string> = { weapon: ANSI.yellow, armor: ANSI.cyan, shield: ANSI.orange };

/** A shop item's picture, coloured by what it is (weapons yellow, armour cyan, shields orange). */
export const ItemSprite = ({ name, kind, scale = 3 }: { name: string; kind: string; scale?: number }) => (
  <Sprite tile={ITEM_TILES[name] ?? KIND_TILES[kind] ?? DEFAULT_MONSTER_TILE} scale={scale} colour={KIND_COLOURS[kind] ?? ANSI.white} />
);

/** The picture beside a place's heading. */
export const PlaceSprite = ({ place, scale = 3 }: { place: 'market' | 'training' | 'church' | 'mines'; scale?: number }) => (
  <Sprite tile={PLACE_TILES[place]} scale={scale} colour={place === 'church' ? ANSI.magenta : place === 'training' ? ANSI.orange : ANSI.yellow} />
);
