import { useState } from 'react';
import { CONFIG } from '../../../shared/clans/config';
import { MONSTER_LOOKS, monsterOf } from '../../../shared/clans/monster';
import { beatenThisSeason, seasonRoad, type SeasonClock, type StageId } from '../../../shared/clans/season';
import type { Clan } from '../../../shared/clans/types';
import { seasonMonsterArt, stageArt } from './art';

const EMOJI: Record<Exclude<StageId, 'monster'>, string> = { build: '🔨', ready: '🛒', new: '🌅' };

/** "This season": four round stops on a road (Build, Get ready, Monster week, New season) that fills up as the days pass. Nothing shows until the season clock is on. */
export function SeasonRoad({ clock, clan }: { clock?: SeasonClock | null; clan?: Clan | null }) {
  const [open, setOpen] = useState<StageId | null>(null);
  if (!clock || clock.number <= 0 || !clock.clockOn) return null;
  const kind = monsterOf(clock.number);
  const look = MONSTER_LOOKS[kind];
  const road = seasonRoad(clock, look, beatenThisSeason(clan, clock.number));
  const notes: Record<StageId, string> = {
    build: 'Win in the Mines, do quests and raid kingdoms to level up and build your village.',
    ready: 'The Market sells fire arrows, healing potions and a giant net for the monster. Raids on classmates rest until the new season.',
    monster: `${look.bigHelp} Lose and it comes back tomorrow, a little more tired.`,
    new: 'Every clan starts again at level 1 with a fresh village. Trophies, achievements and the Hall of Legends stay forever.',
  };
  const art = (id: StageId): string | undefined => (id === 'monster' ? seasonMonsterArt(kind) : stageArt(id));
  const shown = road.stages.find((s) => s.id === open);
  const { before, strong, after } = road.headline;
  return (
    <section className="cq-road" aria-label={road.label}>
      <div className="cq-road__head">
        <h3>Season {clock.number} · day {clock.day} of {CONFIG.season.length}</h3>
        <p>{before}<strong>{strong}</strong>{after}</p>
      </div>
      <div className="cq-road__track" style={{ ['--cq-road-fill' as string]: `${road.fill * 100}%` }}>
        <div className="cq-road__bar"><div className="cq-road__fill" /></div>
        <ol className="cq-road__stops">
          {road.stages.map((s) => {
            const src = art(s.id);
            return (
              <li key={s.id} className={`is-${s.state}`} data-stage={s.id}>
                <button type="button" aria-expanded={open === s.id} onClick={() => setOpen(open === s.id ? null : s.id)}>
                  <span className="cq-road__medal">
                    {src ? <img src={src} alt="" /> : <span className="cq-road__emoji" aria-hidden="true">{s.id === 'monster' ? look.emoji : EMOJI[s.id]}</span>}
                  </span>
                  <span className="cq-road__name">{s.name}</span>
                  <small>{s.when}</small>
                  <small className="cq-road__say">{s.say}</small>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      {shown && <p className="cq-road__note"><strong>{shown.name}.</strong> {notes[shown.id]}</p>}
    </section>
  );
}
