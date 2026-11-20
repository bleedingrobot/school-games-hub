import { useState } from 'react';
import { CONFIG } from '../../../shared/clans/config';
import { MONSTER_LOOKS, monsterOf } from '../../../shared/clans/monster';
import { SEASON_KEEPS, SEASON_RESETS, beatenThisSeason, seasonBanner, seasonRoad, type SeasonClock, type StageId } from '../../../shared/clans/season';
import type { Clan } from '../../../shared/clans/types';
import { seasonMonsterArt, stageArt } from './art';

const EMOJI: Record<Exclude<StageId, 'monster'>, string> = { build: '🔨', ready: '🛒', new: '🌅' };

/** "This season": four round stops on a road (Build, Get ready, Monster week, New season) that fills up as the days pass. Nothing shows until the season clock is on. */
export function SeasonRoad({ clock, clan }: { clock?: SeasonClock | null; clan?: Clan | null }) {
  const [open, setOpen] = useState<StageId | null>(null);
  const [whatNext, setWhatNext] = useState(false);
  if (!clock || clock.number <= 0 || !clock.clockOn) return null;
  const kind = monsterOf(clock.number);
  const look = MONSTER_LOOKS[kind];
  const beaten = beatenThisSeason(clan, clock.number);
  const road = seasonRoad(clock, look, beaten);
  const banner = seasonBanner(clock, look, beaten);
  const notes: Record<StageId, string> = {
    build: 'Win in the Mines, do quests and raid kingdoms to level up and build your village.',
    ready: 'The Market sells fire arrows, healing potions and a giant net for the monster.',
    monster: `${look.bigHelp} Lose and it comes back tomorrow, a little more tired.`,
    new: 'Every clan starts again at level 1 with a fresh village. Trophies, achievements and the Hall of Legends stay forever.',
  };
  const art = (id: StageId): string | undefined => (id === 'monster' ? seasonMonsterArt(kind) : stageArt(id));
  const shown = road.stages.find((s) => s.id === open);
  const { before, strong, after } = road.headline;
  return (
    <section className="cq-road" aria-label={road.label}>
      {banner && (
        <div className={`cq-road__banner cq-road__banner--${banner.kind}`} role="note">
          <strong>{banner.kind === 'last' ? '⏳ ' : '⚔️ '}{banner.title}</strong> {banner.text}{' '}
          {banner.kind === 'last' && (
            <button type="button" className="cq-road__next-btn" aria-expanded={whatNext} onClick={() => setWhatNext(!whatNext)}>
              {whatNext ? 'Hide' : 'What happens next?'}
            </button>
          )}
          {whatNext && banner.kind === 'last' && <SeasonChanges />}
        </div>
      )}
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

/** What a new season keeps and what starts again, side by side (the last-chance banner and, later, the new-season ceremony). */
export function SeasonChanges() {
  return (
    <div className="cq-changes">
      <div className="cq-changes__col cq-changes__col--keep">
        <h4>Stays forever</h4>
        <ul>{SEASON_KEEPS.map((k) => <li key={k.text}><span aria-hidden="true">{k.emoji}</span> {k.text}</li>)}</ul>
      </div>
      <div className="cq-changes__col cq-changes__col--reset">
        <h4>Starts again</h4>
        <ul>{SEASON_RESETS.map((k) => <li key={k.text}><span aria-hidden="true">{k.emoji}</span> {k.text}</li>)}</ul>
      </div>
    </div>
  );
}
