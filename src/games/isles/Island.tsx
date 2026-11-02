/**
 * The island picture: the painted base for the island's size, each building standing on its clearing (spot n on the
 * base's clearing n, docs/ISLES-ART-PLAN.md), the decorations on their places, islanders strolling between the
 * buildings, the drifting chunk of land, the Sky Lighthouse, the sky garden and the Sky Keeper. Each spot, the chunk
 * and (when one is being placed) each free decoration place are real buttons. Any picture that hasn't loaded is drawn
 * as a coloured shape in the same place.
 */
import { useState, type CSSProperties, type ReactElement } from 'react';
import { DECORATION_PLACES, GRAND_ISLE, type PlotOrEmpty } from '../../../shared/isles/config';
import { decoration, hasGarden, type Island } from '../../../shared/isles/engine';
import {
  BASE_ASPECT, DECOR_PLACES, GARDEN_ASPECT, GARDEN_SPOTS, SPOTS, backgroundArt, baseArt, baseFor, buildingArt, decorArt, gardenArt,
  keeperArt, walkerArt,
} from './art';
import { DECOR_EMOJI, KIND_NAME } from './words';

/** A painted picture, or the drawn shape when it's missing or won't load. */
export function Art({ src, alt = '', className, fallback }: { src?: string; alt?: string; className?: string; fallback: ReactElement }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return fallback;
  return <img className={className} src={src} alt={alt} draggable={false} onError={() => setFailed(true)} />;
}

/** How wide a building is drawn, as a share of the base's width: smaller on the bigger bases, bigger at higher levels. */
const BUILDING_WIDTH = [19, 16, 15, 13, 12];
const LEVEL_GROWTH = [0.8, 1, 1.14, 1.3];
/** How far in front of a clearing walkers stroll (in % of the base's height). */
const WALK_AHEAD = 7;

export const spotName = (kind: PlotOrEmpty, level: number) => (kind === 'empty' ? 'Empty spot' : `${KIND_NAME[kind]}, level ${level}`);

/** How many little islanders stroll about: more islanders, more walkers, up to 8. */
export const walkerCount = (islanders: number) => Math.min(8, Math.max(1, Math.floor(islanders / 15)));

/** Where decoration place n is: on the island's base, or (past the base's places) in the sky garden. */
function placeAt(base: number, place: number): { garden: boolean; x: number; y: number } {
  const own = DECORATION_PLACES[base];
  if (place < own) return { garden: false, x: DECOR_PLACES[base][place][0], y: DECOR_PLACES[base][place][1] };
  const [x, y] = GARDEN_SPOTS[place - own] ?? [50, 50];
  return { garden: true, x, y };
}

/** A free decoration place, as a button to put the chosen decoration there. */
function PlaceButton({ place, x, y, lit, onPlace }: { place: number; x: number; y: number; lit?: boolean; onPlace: (place: number) => void }) {
  return (
    <button
      type="button"
      className={`si-place${lit ? ' si-lit' : ''}`}
      style={{ left: `${x}%`, top: `${y}%` }}
      data-pip={`place-${place}`}
      aria-label={`Decoration place ${place + 1}`}
      onClick={() => onPlace(place)}
    >
      {place + 1}
    </button>
  );
}

export function IslandPicture({
  island,
  keeper,
  onSpot,
  onDrift,
  selected,
  lit,
  free,
  onPlace,
  pops,
}: {
  island: Island;
  keeper: string | null;
  /** Tapping a spot (left out when the spots can't be tapped, as on most steps of a turn). */
  onSpot?: (spot: number) => void;
  /** Tapping the drifting chunk (only while there is one). */
  onDrift?: () => void;
  selected?: number | null;
  /** The `data-pip` name lit up by "Show me". */
  lit?: string | null;
  /** Free decoration places to choose from (while one is being placed). */
  free?: number[];
  onPlace?: (place: number) => void;
  /** Coins popping off each spot (the collect step), by spot. */
  pops?: Record<number, number>;
}) {
  const base = baseFor(island.spots.length);
  const places = SPOTS[base];
  const bg = backgroundArt('island');
  const shown = island.spots.slice(0, places.length);
  const extra = island.spots.length - shown.length;
  const keeperSrc = keeper ? keeperArt(keeper, true) : undefined;
  const choosing = free && onPlace ? free : [];
  const decor = island.decorations.flatMap((d, i) => (d.place === null ? [] : [{ ...d, i, at: placeAt(base, d.place) }]));
  const garden = hasGarden(island);
  // Each walker strolls back and forth between the fronts of two neighbouring clearings, at its own pace, so it walks
  // on the grass in front of buildings, never over them.
  const used = places.slice(0, Math.max(2, shown.length));
  const walkers = Array.from({ length: walkerCount(island.islanders) }, (_, i) => {
    const from = used[(i * 3) % used.length];
    const to = used.filter((p) => p !== from).sort((a, b) => Math.hypot(a[0] - from[0], a[1] - from[1]) - Math.hypot(b[0] - from[0], b[1] - from[1]))[i % 2];
    return { i, from, to: to ?? from };
  });
  /** In front of a clearing, and drawn above buildings further back but behind those nearer the front. */
  const front = (p: [number, number]) => ({ y: p[1] + WALK_AHEAD, z: Math.round(p[1] + WALK_AHEAD) + 10 });

  const decorPicture = (d: (typeof decor)[number]) => {
    const name = decoration(d.id)?.name ?? 'Decoration';
    return (
      <span key={`d${d.i}`} className="si-decor" style={{ left: `${d.at.x}%`, top: `${d.at.y}%`, zIndex: Math.round(d.at.y) + 10 }} role="img" aria-label={name}>
        <Art src={decorArt(d.id)} fallback={<span className="si-decor__drawn" aria-hidden="true">{DECOR_EMOJI[d.id]}</span>} />
      </span>
    );
  };

  return (
    <div className="si-stage" style={{ '--si-bg': bg.wide ? `url(${bg.wide})` : 'none', '--si-bg-small': bg.small ? `url(${bg.small})` : 'none' } as CSSProperties}>
      <div className="si-isle" style={{ aspectRatio: String(BASE_ASPECT[base]) }}>
        <Art src={baseArt(base)} className="si-isle__base" fallback={<div className="si-isle__drawn" aria-hidden="true" />} />
        {island.lighthouse > 0 && (
          <div className="si-lighthouse" style={{ '--si-stage': island.lighthouse } as CSSProperties} aria-label={`Sky Lighthouse, stage ${island.lighthouse} of 4`} role="img">
            <span className="si-lighthouse__light" />
          </div>
        )}
        {shown.map((spot, i) => {
          const [x, y] = places[i];
          const width = BUILDING_WIDTH[base] * LEVEL_GROWTH[spot.kind === 'empty' ? 0 : spot.level];
          const name = spotName(spot.kind, spot.level);
          const style = { left: `${x}%`, top: `${y}%`, width: `${width}%`, zIndex: Math.round(y) + 10 };
          const art = (
            <Art
              src={buildingArt(spot.kind, spot.level)}
              fallback={<span className={`si-spot__drawn si-kind--${spot.kind}`} aria-hidden="true">{spot.kind === 'empty' ? '+' : `${KIND_NAME[spot.kind][0]}${spot.level}`}</span>}
            />
          );
          const look = `si-spot si-spot--${spot.kind}${selected === i ? ' si-spot--chosen' : ''}${lit === `spot-${i}` ? ' si-lit' : ''}`;
          if (!onSpot) {
            return <span key={i} className={`${look} si-spot--still`} style={style} data-pip={`spot-${i}`} role="img" aria-label={`Spot ${i + 1}: ${name}`}>{art}</span>;
          }
          return (
            <button key={i} type="button" className={look} style={style} data-pip={`spot-${i}`} aria-label={`Spot ${i + 1}: ${name}`} aria-pressed={selected === i} onClick={() => onSpot(i)}>
              {art}
            </button>
          );
        })}
        {decor.filter((d) => !d.at.garden).map(decorPicture)}
        {walkers.map((w) => (
          <span
            key={`w${w.i}`}
            className="si-walker"
            style={{
              '--x1': `${w.from[0]}%`, '--y1': `${front(w.from).y}%`, '--z1': front(w.from).z,
              '--x2': `${w.to[0]}%`, '--y2': `${front(w.to).y}%`, '--z2': front(w.to).z,
              animationDuration: `${14 + w.i * 3}s`, animationDelay: `${-w.i * 2.5}s`,
            } as CSSProperties}
            aria-hidden="true"
          >
            <Art src={walkerArt(w.i)} fallback={<span className={`si-walker__drawn si-walker__drawn--${w.i % 4}`} />} />
          </span>
        ))}
        {pops && Object.entries(pops).map(([spot, coins]) => {
          const at = places[Number(spot)];
          return at && coins > 0 ? <span key={`p${spot}`} className="si-pop" style={{ left: `${at[0]}%`, top: `${at[1]}%` }} aria-hidden="true">+{coins}</span> : null;
        })}
        {choosing.filter((p) => !placeAt(base, p).garden).map((p) => {
          const at = placeAt(base, p);
          return <PlaceButton key={`c${p}`} place={p} x={at.x} y={at.y} lit={lit === `place-${p}`} onPlace={onPlace!} />;
        })}
        {keeperSrc && <img className="si-isle__keeper" src={keeperSrc} alt="Your Sky Keeper" />}
      </div>
      {garden && (
        <div className="si-garden" style={{ aspectRatio: String(GARDEN_ASPECT) }} role="group" aria-label="Your sky garden">
          <Art src={gardenArt()} className="si-isle__base" fallback={<div className="si-isle__drawn" aria-hidden="true" />} />
          {decor.filter((d) => d.at.garden).map(decorPicture)}
          {choosing.filter((p) => placeAt(base, p).garden).map((p) => {
            const at = placeAt(base, p);
            return <PlaceButton key={`c${p}`} place={p} x={at.x} y={at.y} lit={lit === `place-${p}`} onPlace={onPlace!} />;
          })}
        </div>
      )}
      {onDrift && island.driftLeft > 0 && (
        <button type="button" className={`si-drift${lit === 'drift' ? ' si-lit' : ''}`} data-pip="drift" onClick={onDrift} aria-label={`A chunk of land is drifting by (${island.driftLeft} in the drift). Tap to anchor it.`}>
          <Art src={baseArt(0)} fallback={<span className="si-isle__drawn si-drift__drawn" aria-hidden="true" />} />
          <span className="si-drift__count">{island.driftLeft}</span>
        </button>
      )}
      {extra > 0 && (
        <div className="si-more" role="group" aria-label="More building spots">
          {island.spots.slice(places.length).map((spot, j) => {
            const i = places.length + j;
            return (
              <button key={i} type="button" className={`si-more__spot${lit === `spot-${i}` ? ' si-lit' : ''}`} data-pip={`spot-${i}`} aria-pressed={selected === i} disabled={!onSpot} onClick={() => onSpot?.(i)}>
                Spot {i + 1}: {spotName(spot.kind, spot.level)}
              </button>
            );
          })}
        </div>
      )}
      {island.spots.length >= GRAND_ISLE && <p className="si-stage__badge">Grand Isle!</p>}
    </div>
  );
}
