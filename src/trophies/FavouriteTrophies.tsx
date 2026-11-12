import { useEffect, useState } from 'react';
import { fetchTrophyShelves, type TrophyShelf } from '../data/trophies';
import { metalLabel } from './cabinet';
import { TrophyArt } from './TrophyArt';
import './trophies.css';
import './favourites.css';

/**
 * Trophies around the hub (docs/plans/profile/PLAN.md card P6): the shelves for the names on a page, asked once per set of
 * names. Missing names (not loaded yet, or outside my school) just show nothing.
 */
export function useTrophyShelves(names: (string | null | undefined)[]): Record<string, TrophyShelf> {
  const wanted = [...new Set(names.filter((n): n is string => !!n))].sort();
  const key = wanted.join('|');
  const [shelves, setShelves] = useState<Record<string, TrophyShelf>>({});
  useEffect(() => {
    if (!key) return;
    let current = true;
    void fetchTrophyShelves(key.split('|')).then((got) => current && setShelves(got));
    return () => {
      current = false;
    };
  }, [key]);
  return shelves;
}

/** A pupil's favourite three, as little cups (or pictures) in their metal. Nothing at all when they have none. */
export function FavouriteTrophies({ shelf, size = 22 }: { shelf: TrophyShelf | undefined; size?: number }) {
  const favourites = shelf?.favourites ?? [];
  if (favourites.length === 0) return null;
  const words = favourites.map((f) => `${f.name} (${metalLabel({ tier: f.tier, count: 1 }).toLowerCase()})`).join(', ');
  return (
    <span className="fav-trophies" role="img" aria-label={`Favourite trophies: ${words}`} title={words}>
      {favourites.map((f) => (
        <TrophyArt key={f.id} id={f.id} game={f.game} kind={f.kind} tier={f.tier} size={size} />
      ))}
    </span>
  );
}

/** "🏆 5 trophies" and the favourite three: the home page's strip, the profile's stats and the teacher's pupil page. */
export function TrophyCount({ shelf }: { shelf: TrophyShelf | undefined }) {
  if (!shelf) return null;
  return (
    <span className="trophy-count">
      <span>
        <span aria-hidden="true">🏆</span> {shelf.count} {shelf.count === 1 ? 'trophy' : 'trophies'}
      </span>
      <FavouriteTrophies shelf={shelf} />
    </span>
  );
}
