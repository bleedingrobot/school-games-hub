import { Link } from 'react-router';
import { CONFIG } from '../../shared/clans/config';
import { MONSTER_LOOKS, monsterOf } from '../../shared/clans/monster';
import { seasonRoad, type SeasonClock, type StageId } from '../../shared/clans/season';

// Only the few pictures this strip needs (not the whole Clan Quest picture set).
const FILES = import.meta.glob('../games/clans/art/{timeline,season-monsters}/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const picture = (group: string, name: string): string | undefined => FILES[`../games/clans/art/${group}/${name}.webp`];

const EMOJI: Record<Exclude<StageId, 'monster'>, string> = { build: '🔨', ready: '🛒', new: '🌅' };
const STAGE_FILE: Record<Exclude<StageId, 'monster'>, string> = { build: 'stage-build', ready: 'stage-ready', new: 'stage-new-season' };

/**
 * "This season" on the home page: the same four stops as the Clan Quest season road (Build, Get ready, Monster week, New season),
 * small and in the home page's colours. The caller only shows it when the season clock is on.
 */
export default function SeasonStrip({ clock }: { clock: SeasonClock }) {
  const kind = monsterOf(clock.number);
  const look = MONSTER_LOOKS[kind];
  const road = seasonRoad(clock, look, false);
  const { before, strong, after } = road.headline;
  return (
    <section className="panel season-strip" aria-label={road.label}>
      <div className="panel__head season-strip__head">
        <h2 className="panel__title">This season</h2>
        <p className="season-strip__count">
          Season {clock.number} · day {clock.day} of {CONFIG.season.length}
        </p>
      </div>
      <p className="season-strip__headline">
        {before}
        <strong>{strong}</strong>
        {after}
      </p>
      <div className="season-strip__track" style={{ ['--season-fill' as string]: `${road.fill * 100}%` }}>
        <div className="season-strip__bar" aria-hidden="true">
          <div className="season-strip__fill" />
        </div>
        <ol className="season-strip__stops">
          {road.stages.map((s) => {
            const src = s.id === 'monster' ? picture('season-monsters', kind) : picture('timeline', STAGE_FILE[s.id]);
            return (
              <li key={s.id} className={`is-${s.state}`} data-stage={s.id} aria-current={s.state === 'now' ? 'step' : undefined}>
                <span className="season-strip__medal">
                  {src ? <img src={src} alt="" /> : <span aria-hidden="true">{s.id === 'monster' ? look.emoji : EMOJI[s.id]}</span>}
                </span>
                <span className="season-strip__name">{s.name}</span>
                <small className="season-strip__when">{s.when}</small>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="season-strip__go">
        <Link to="/clan-quest" className="button">
          Open Clan Quest
        </Link>
      </p>
    </section>
  );
}
