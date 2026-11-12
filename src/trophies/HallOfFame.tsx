import { useEffect, useState } from 'react';
import { AvatarImage } from '../avatar/AvatarImage';
import { fetchHallOfFame, type HallOfFame as Hall, type HallPerson } from '../data/trophies';
import { trophyPlace } from './cabinet';
import { TrophyArt } from './TrophyArt';
import './favourites.css';

const PLACES = ['1st', '2nd', '3rd', '4th', '5th'];

/** A pupil without a made-up name (an approved own name) shows as "A classmate". */
const nameOf = (p: HallPerson) => p.name ?? 'A classmate';

/**
 * The Leaderboard's Hall of fame (profile card P10): each season's first five dragon slayers, and this season's new pictures.
 * Game feats only: never maths results, never a ranking.
 */
export function HallOfFame() {
  const [hall, setHall] = useState<Hall | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    fetchHallOfFame().then(
      (h) => current && setHall(h),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, []);

  if (failed) return <p className="panel__empty">We couldn’t load the hall of fame just now. Please try again soon.</p>;
  if (!hall) return <p className="panel__empty">Loading…</p>;

  return (
    <div className="hall">
      <p className="leaderboard__about">Big feats from your school, kept here for good.</p>

      <section className="hall__part" aria-labelledby="hall-dragon">
        <h2 id="hall-dragon">🐉 First five to slay the dragon</h2>
        {hall.dragon.length === 0 ? (
          <p className="panel__empty">Nobody has slain the dragon yet. Will it be you?</p>
        ) : (
          hall.dragon.map((d) => (
            <div key={d.season} className="hall__season">
              <h3>Dragon Maths season {d.season}</h3>
              <ol className="hall__list">
                {d.slayers.map((s) => (
                  <li key={s.place}>
                    <span className="hall__place">{PLACES[s.place - 1] ?? s.place}</span>
                    <AvatarImage avatar={s.avatar} size={36} />
                    <span className="hall__name">{nameOf(s)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))
        )}
      </section>

      <section className="hall__part" aria-labelledby="hall-pictures">
        <h2 id="hall-pictures">🖼️ New pictures this season</h2>
        {hall.pictures.length === 0 ? (
          <p className="panel__empty">No new pictures yet this season. Win one to be the first!</p>
        ) : (
          <ul className="hall__list">
            {hall.pictures.map((p) => (
              <li key={`${p.trophy}-${p.at}`}>
                <TrophyArt id={p.trophy} game={p.game} kind="picture" tier={p.tier} size={40} />
                <AvatarImage avatar={p.avatar} size={36} />
                <span className="hall__name">
                  {nameOf(p)} <span className="hall__won">won {p.title}</span>
                  <span className="hall__where">{trophyPlace(p.game)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
