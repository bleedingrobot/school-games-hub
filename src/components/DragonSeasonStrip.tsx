import { Link } from 'react-router';
import { SEASON_DAYS } from '../../shared/lord/data';
import { lordSeasonRoad, type HomeLordSeason, type LordStageId } from '../../shared/lord/seasonRoad';

// Only the four round pictures this strip needs (not the whole Dragon Maths picture set).
const FILES = import.meta.glob('../games/lord/art/timeline/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const FILE: Record<LordStageId, string> = { forest: 'stage-forest', masters: 'stage-masters', dragon: 'stage-dragon', new: 'stage-new-season' };
const EMOJI: Record<LordStageId, string> = { forest: '🌲', masters: '🗡️', dragon: '🐉', new: '🌅' };

/**
 * The Dragon Maths season on the home page: the same four stops as the road in the game's village (Forest, Masters, Dragon week,
 * New season), small and in the home page's colours, with the pupil's own line. The caller only shows it while the season runs.
 */
export default function DragonSeasonStrip({ season, title = 'This season' }: { season: HomeLordSeason; title?: string }) {
  const { clock, hero } = season;
  const road = lordSeasonRoad(clock, hero);
  const { before, strong, after } = road.headline;
  return (
    <section className="panel season-strip season-strip--dragon" aria-label={`Dragon Maths. ${road.label}`}>
      <div className="panel__head season-strip__head">
        <h2 className="panel__title">{title}</h2>
        <p className="season-strip__count">
          Season {clock.number} · day {clock.day} of {SEASON_DAYS}
        </p>
      </div>
      <p className="season-strip__headline">
        {before}
        <strong>{strong}</strong>
        {after}
        {road.mine && ` ${road.mine}`}
      </p>
      <div className="season-strip__track" style={{ ['--season-fill' as string]: `${road.fill * 100}%` }}>
        <div className="season-strip__bar" aria-hidden="true">
          <div className="season-strip__fill" />
        </div>
        <ol className="season-strip__stops">
          {road.stages.map((s) => {
            const src = FILES[`../games/lord/art/timeline/${FILE[s.id]}.webp`];
            return (
              <li key={s.id} className={`is-${s.state}`} data-stage={s.id} aria-current={s.state === 'now' ? 'step' : undefined}>
                <span className="season-strip__medal">{src ? <img src={src} alt="" /> : <span aria-hidden="true">{EMOJI[s.id]}</span>}</span>
                <span className="season-strip__name">{s.name}</span>
                <small className="season-strip__when">{s.when}</small>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="season-strip__go">
        <Link to="/dragon-maths" className="button">
          Open Dragon Maths
        </Link>
      </p>
    </section>
  );
}
