/**
 * Shark Bay's board (docs/SHARK-PLAN.md), drawn the same on the big screen and on each pupil's device: a round bay in
 * a square (sand round the edge), four coloured quarters that spin (rope lines between them), the jetty in the middle,
 * drifting boats, the round's hazards, items and avatars. Board units 0 to 1, placed in % of the square.
 */
import type { ReactNode } from 'react';
import { FOG_SHARE, GRAB_R, rollerAt, rollersOf, TELEPORT_R, type Corner, type Power } from '../../../shared/classlive/corners';
import { BAY_WORDS, BOAT_R, boatAt, DOCK_R, POOL_R, QUARTER_COLOURS, QUARTER_NAMES, quarterMid, SHARK_POWER_WORDS, spinAt, type BayMap, type BayRound } from '../../../shared/classlive/shark';
import { painted } from './paintedArt';
import './shark.css';

export { QUARTER_COLOURS, QUARTER_NAMES };

export const sharkPowerPic = (p: Power) => painted('shark-fx', `power-${p}`) ?? painted('corners-fx', `power-${p}`);
export const sharkHazardPic = (map: BayMap, h: 'storm' | 'ice' | 'roller' | 'teleport' | 'boat' | 'dock' | 'fin' | 'shark') =>
  // Chomper's fin and leap are the same in every bay.
  painted('shark-fx', h === 'fin' || h === 'shark' ? h : `${map}-${h}`);

/** What the board needs of a round (the pupils' copy has these too). */
export type SharkBoardRound = Pick<BayRound, 'startAt' | 'runEnd' | 'spin0' | 'spinRate' | 'boats' | 'storms' | 'ice' | 'teleports' | 'roller' | 'roller2' | 'fog'> & {
  items: { id: number; x: number; y: number; power: Power }[];
};

const pct = (v: number) => `${v * 100}%`;

function Disc({ x, y, r, className, pic, turn, children }: { x: number; y: number; r: number; className: string; pic?: string | null; turn?: number; children?: ReactNode }) {
  return (
    <div className={className} style={{ left: pct(x - r), top: pct(y - r), width: pct(r * 2), height: pct(r * 2), ...(pic ? { backgroundImage: `url(${pic})` } : {}), ...(turn !== undefined ? { transform: `rotate(${turn}deg)` } : {}) }}>
      {children}
    </div>
  );
}

export function SharkBoard({ map, round, t, flash, periscope, children, fogOn, onQuarter, labels = true, seatsLeft }: {
  map: BayMap;
  round: SharkBoardRound | null;
  /** Session time (ms since the start). */
  t: number;
  /** Quarters the shark struck (flashing). */
  flash?: Corner[] | null;
  /** A Periscope's safe quarter, for this pupil only. */
  periscope?: Corner | null;
  children?: ReactNode;
  fogOn?: boolean;
  /** Quarters become buttons (a Jet ski). */
  onQuarter?: (q: Corner) => void;
  labels?: boolean;
  /** Seats left per boat id (the pad's guess from the spots it sees), shown on each boat. */
  seatsLeft?: Record<number, number>;
}) {
  const pic = painted('shark', `map-${map}`);
  const words = BAY_WORDS[map];
  const spin = round ? spinAt(round, t) : 0;
  const deg = (spin * 180) / Math.PI;
  const runShare = round ? (t - round.startAt) / Math.max(1, round.runEnd - round.startAt) : 0;
  const fogShows = !!round?.fog && (fogOn ?? true) && runShare >= 1 - FOG_SHARE && t < round.runEnd + 300;
  const quarters: Corner[] = [0, 1, 2, 3];
  return (
    <div className={`sb-board sb-board--${map} ${pic ? 'sb-board--painted' : ''}`} style={pic ? { backgroundImage: `url(${pic})` } : undefined}>
      <div className="sb-water" style={{ left: pct(0.5 - POOL_R), top: pct(0.5 - POOL_R), width: pct(POOL_R * 2), height: pct(POOL_R * 2) }}>
        {/* The four quarters: a conic gradient turned by the spin (0 starts top left, clockwise). */}
        <div
          className="sb-quarters"
          style={{
            transform: `rotate(${deg}deg)`,
            ['--q0' as string]: QUARTER_COLOURS[0], ['--q1' as string]: QUARTER_COLOURS[1], ['--q2' as string]: QUARTER_COLOURS[2], ['--q3' as string]: QUARTER_COLOURS[3],
          }}
        >
          {quarters.map((q) => <i key={q} className={`sb-q sb-q--${q} ${flash?.includes(q) ? 'sb-q--hit' : ''} ${periscope === q ? 'sb-q--safe' : ''}`} />)}
          <span className="sb-rope sb-rope--a" />
          <span className="sb-rope sb-rope--b" />
        </div>
      </div>
      {labels && quarters.map((q) => {
        const m = quarterMid(q, spin, 0.36);
        const Tag = onQuarter ? 'button' : 'div';
        return (
          <Tag
            key={`l${q}`}
            {...(onQuarter ? { type: 'button' as const, onClick: () => onQuarter(q), 'aria-label': `Zoom to ${QUARTER_NAMES[q]}` } : { 'aria-label': `${QUARTER_NAMES[q]} quarter` })}
            className={`sb-label ${onQuarter ? 'sb-label--btn' : ''} ${flash?.includes(q) ? 'sb-label--hit' : ''}`}
            style={{ left: pct(m.x), top: pct(m.y), ['--qc' as string]: QUARTER_COLOURS[q] }}
          >
            {QUARTER_NAMES[q]}{periscope === q ? ' 🔭' : ''}
          </Tag>
        );
      })}
      <Disc x={0.5} y={0.5} r={DOCK_R} className="sb-dock" pic={sharkHazardPic(map, 'dock')}><span className="sb-dock__name">{words.dock}</span></Disc>
      {round?.storms.map((s, i) => <Disc key={`s${i}`} {...s} className="sb-storm" pic={sharkHazardPic(map, 'storm')} />)}
      {round?.ice.map((s, i) => <Disc key={`i${i}`} {...s} className="sb-current" pic={sharkHazardPic(map, 'ice')} turn={(t / 20) % 360} />)}
      {round?.teleports.map((tp, i) => (
        <span key={`t${i}`}>
          <Disc x={tp.a.x} y={tp.a.y} r={TELEPORT_R * 1.4} className="sb-whirl" pic={sharkHazardPic(map, 'teleport')} turn={(t / 6) % 360} />
          <Disc x={tp.b.x} y={tp.b.y} r={TELEPORT_R * 1.4} className="sb-whirl sb-whirl--b" pic={sharkHazardPic(map, 'teleport')} turn={(-t / 6) % 360} />
        </span>
      ))}
      {round?.items.map((it) => (
        <Disc key={`it${it.id}`} x={it.x} y={it.y} r={GRAB_R * 0.7} className="sb-item">
          {sharkPowerPic(it.power) ? <img src={sharkPowerPic(it.power) as string} alt="" /> : <span aria-hidden="true">{SHARK_POWER_WORDS[it.power].emoji}</span>}
        </Disc>
      ))}
      {round && rollersOf(round).map((ro, i) => {
        const p = rollerAt(ro, t);
        return <Disc key={`r${i}`} x={p.x} y={p.y} r={ro.r} className="sb-wave" pic={sharkHazardPic(map, 'roller')} />;
      })}
      {round?.boats.map((b) => {
        const p = boatAt(b, round, t);
        const left = seatsLeft?.[b.id];
        // The boat points the way it drifts.
        const a = Math.atan2(p.y - 0.5, p.x - 0.5) + (b.w > 0 ? Math.PI / 2 : -Math.PI / 2);
        return (
          <Disc key={`b${b.id}`} x={p.x} y={p.y} r={BOAT_R * 1.25} className="sb-boat" pic={sharkHazardPic(map, 'boat')} turn={(a * 180) / Math.PI}>
            <span className="sb-boat__seats" style={{ transform: `rotate(${(-a * 180) / Math.PI}deg)` }}>{left !== undefined ? `${Math.max(0, left)}` : b.seats} 🪑</span>
          </Disc>
        );
      })}
      <div className="sb-board__people">{children}</div>
      {fogShows && <div className="sb-fog" aria-label={words.fog} />}
    </div>
  );
}
