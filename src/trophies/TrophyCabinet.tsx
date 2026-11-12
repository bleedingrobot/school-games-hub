import { useEffect, useState } from 'react';
import { useClassSwitches } from '../data/classSwitches';
import { fetchMyTrophies, saveMyFavouriteTrophies, type MyTrophies, type MyTrophy } from '../data/trophies';
import { GAMES } from '../games/registry';
import { MAX_FAVOURITES, metalLabel, nextMetalLine, nextSpots, shelfOrder, trophyPlace, winLine } from './cabinet';
import { TrophyArt } from './TrophyArt';
import './trophies.css';

const SWITCHED_GAMES = GAMES.filter((g) => g.teacherSwitch).map((g) => g.id);

export interface MyCabinet {
  data: MyTrophies | null;
  failed: boolean;
  setFavourites: (ids: string[]) => void;
}

/** My trophies, asked once for the whole profile page (the cabinet and "Change my look" both use them). */
export function useMyTrophies(me: string | undefined): MyCabinet {
  const [data, setData] = useState<MyTrophies | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!me) return;
    let current = true;
    fetchMyTrophies().then(
      (mine) => current && setData(mine),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [me]);
  return { data, failed, setFavourites: (favourites) => setData((was) => (was ? { ...was, favourites } : was)) };
}

/**
 * The trophy cabinet: a lit shelf of every trophy won (favourites first), a plaque with "how you won it" and the seasons for
 * the one tapped, and up to three grey spots for what to win next.
 */
export function TrophyCabinet({ cabinet }: { cabinet: MyCabinet }) {
  const { data, failed } = cabinet;
  const switchedOn = useClassSwitches(SWITCHED_GAMES);
  const [chosen, setChosen] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  if (!data) return <p className="panel__empty">{failed ? 'We couldn’t load your trophies just now.' : 'Loading…'}</p>;

  const shelf = shelfOrder(data.trophies, data.favourites);
  const next = nextSpots(data.next, switchedOn);
  const picked = shelf.find((t) => t.id === chosen) ?? null;

  async function toggleFavourite(trophy: MyTrophy) {
    const was = data!.favourites;
    const isFav = was.includes(trophy.id);
    if (!isFav && was.length >= MAX_FAVOURITES) {
      setStatus('You have three favourites already. Take one off first.');
      return;
    }
    const wanted = isFav ? was.filter((id) => id !== trophy.id) : [...was, trophy.id];
    cabinet.setFavourites(wanted);
    setStatus('Saving…');
    try {
      cabinet.setFavourites(await saveMyFavouriteTrophies(wanted));
      setStatus(isFav ? 'Taken off your favourites.' : 'Saved! It’s one of your favourites now.');
    } catch (error) {
      cabinet.setFavourites(was);
      setStatus(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <div className="cabinet">
      <div className="cabinet__case">
        {shelf.length === 0 ? (
          <p className="cabinet__empty">
            Your cabinet is waiting for its first trophy. Win one with a big feat in a game, and it lives here for good!
          </p>
        ) : (
          <ul className="cabinet__shelf" aria-label="My trophies">
            {shelf.map((t) => {
              const fav = data.favourites.includes(t.id);
              return (
                <li key={t.id} className="cabinet__slot">
                  <button
                    type="button"
                    className="cabinet__trophy"
                    data-tier={t.tier}
                    aria-pressed={chosen === t.id}
                    aria-label={`${t.name}, ${metalLabel(t)}${fav ? ', a favourite' : ''}`}
                    onClick={() => {
                      setChosen(chosen === t.id ? null : t.id);
                      setStatus(null);
                    }}
                  >
                    {fav && (
                      <span className="cabinet__fav" aria-hidden="true">
                        ★
                      </span>
                    )}
                    {t.isNew && <span className="cabinet__new">New!</span>}
                    <TrophyArt id={t.id} game={t.game} kind={t.kind} tier={t.tier} size={84} />
                    <span className="cabinet__name">{t.name}</span>
                    <span className={`cabinet__metal cabinet__metal--${t.tier}`}>{metalLabel(t)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {picked && (
        <section className="plaque" data-tier={picked.tier} aria-label={`${picked.name}: how you won it`}>
          <TrophyArt id={picked.id} game={picked.game} kind={picked.kind} tier={picked.tier} size={120} />
          <div className="plaque__words">
            <h3 className="plaque__name">{picked.name}</h3>
            <p className="plaque__game">
              {trophyPlace(picked.game)} · <strong>{metalLabel(picked)}</strong>
              {picked.kind === 'picture' && ' · a picture you can wear'}
            </p>
            <p className="plaque__how">
              <strong>How you won it:</strong> {picked.how}
            </p>
            <ul className="plaque__wins" aria-label="When you won it">
              {picked.wins.map((w) => (
                <li key={`${w.season}-${w.year}-${w.at}`}>{winLine(picked, w)}</li>
              ))}
            </ul>
            {nextMetalLine(picked, data.season) && <p className="plaque__next">{nextMetalLine(picked, data.season)}</p>}
            <button type="button" className="button button--light-outline plaque__fav" onClick={() => void toggleFavourite(picked)}>
              {data.favourites.includes(picked.id) ? '☆ Take off my favourites' : '★ Make it a favourite'}
            </button>
          </div>
        </section>
      )}
      <p className="cabinet__status" role="status">
        {status ?? (shelf.length > 0 && !picked ? `Tap a trophy to see how you won it. Pick up to ${MAX_FAVOURITES} favourites to show off.` : '')}
      </p>

      {next.length > 0 && (
        <div className="cabinet__next">
          <h3>Next to win</h3>
          <ul>
            {next.map((t) => (
              <li key={t.id} className="cabinet__spot">
                <TrophyArt id={t.id} game={t.game} kind={t.kind} tier={null} size={60} />
                <span>
                  <strong>{t.name}</strong>
                  <span className="cabinet__spot-game">{t.game === 'hub' ? 'Any game' : trophyPlace(t.game)}</span>
                  {t.how}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
