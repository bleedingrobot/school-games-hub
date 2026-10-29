import { useState } from 'react';
import { SEASON_DAYS } from '../../../shared/lord/data';
import { canFaceDragon } from '../../../shared/lord/engine';
import { lordSeasonRoad, type LordStageId } from '../../../shared/lord/seasonRoad';
import type { Hero } from '../../../shared/lord/types';
import { stageArt } from './art';

const EMOJI: Record<LordStageId, string> = { forest: '🌲', masters: '🗡️', dragon: '🐉', new: '🌅' };

/** "This season": four round stops on a road (Forest, Masters, Dragon week, New season) that fills up as the days pass, and the pupil's own line. */
export function SeasonRoad({ season, hero }: { season: { number: number; dayOfSeason: number }; hero: Hero }) {
  const [open, setOpen] = useState<LordStageId | null>(null);
  if (season.number <= 0 || season.dayOfSeason <= 0) return null;
  const road = lordSeasonRoad({ number: season.number, day: season.dayOfSeason }, { level: hero.level, ready: canFaceDragon(hero) });
  const shown = road.stages.find((s) => s.id === open);
  const { before, strong, after } = road.headline;
  return (
    <section className="lord-road" aria-label={road.label}>
      <div className="lord-road__head">
        <h3>Season {season.number} · day {season.dayOfSeason} of {SEASON_DAYS}</h3>
        <p>{before}<strong>{strong}</strong>{after}</p>
      </div>
      <div className="lord-road__track" style={{ ['--lord-road-fill' as string]: `${road.fill * 100}%` }}>
        <div className="lord-road__bar" aria-hidden="true"><div className="lord-road__fill" /></div>
        <ol className="lord-road__stops">
          {road.stages.map((s) => {
            const src = stageArt(s.id);
            return (
              <li key={s.id} className={`is-${s.state}`} data-stage={s.id} aria-current={s.state === 'now' ? 'step' : undefined}>
                <button type="button" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>
                  <span className="lord-road__medal">
                    {src ? <img src={src} alt="" /> : <span className="lord-road__emoji" aria-hidden="true">{EMOJI[s.id]}</span>}
                  </span>
                  <span className="lord-road__name">{s.name}</span>
                  <small>{s.when}</small>
                  <small className="lord-road__say">{s.say}</small>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      {shown && <p className="lord-road__note"><strong>{shown.name}.</strong> {shown.note}</p>}
      {road.mine && <p className="lord-road__mine">{road.mine}</p>}
    </section>
  );
}
