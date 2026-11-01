/**
 * The island picture: the painted base for the island's size, each building standing on its clearing (spot n on the
 * base's clearing n, docs/ISLES-ART-PLAN.md), the drifting chunk of land, the Sky Lighthouse and the Sky Keeper. Each
 * spot and the chunk are real buttons. Any picture that hasn't loaded is drawn as a coloured shape in the same place.
 */
import { useState, type CSSProperties, type ReactElement } from 'react';
import { GRAND_ISLE, type PlotOrEmpty } from '../../../shared/isles/config';
import type { Island } from '../../../shared/isles/engine';
import { BASE_ASPECT, SPOTS, backgroundArt, baseArt, baseFor, buildingArt, keeperArt } from './art';
import { KIND_NAME } from './words';

/** A painted picture, or the drawn shape when it's missing or won't load. */
export function Art({ src, alt = '', className, fallback }: { src?: string; alt?: string; className?: string; fallback: ReactElement }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return fallback;
  return <img className={className} src={src} alt={alt} draggable={false} onError={() => setFailed(true)} />;
}

/** How wide a building is drawn, as a share of the base's width: smaller on the bigger bases, bigger at higher levels. */
const BUILDING_WIDTH = [19, 16, 15, 13, 12];
const LEVEL_GROWTH = [0.8, 1, 1.14, 1.3];

export const spotName = (kind: PlotOrEmpty, level: number) => (kind === 'empty' ? 'Empty spot' : `${KIND_NAME[kind]}, level ${level}`);

export function IslandPicture({
  island,
  keeper,
  onSpot,
  onDrift,
  selected,
  lit,
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
}) {
  const base = baseFor(island.spots.length);
  const places = SPOTS[base];
  const bg = backgroundArt('island');
  const shown = island.spots.slice(0, places.length);
  const extra = island.spots.length - shown.length;
  const keeperSrc = keeper ? keeperArt(keeper, true) : undefined;

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
        {keeperSrc && <img className="si-isle__keeper" src={keeperSrc} alt="Your Sky Keeper" />}
      </div>
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
