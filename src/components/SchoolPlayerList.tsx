/**
 * "Who's here" for the games you play live against someone (docs/plans/play-anyone/PLAN.md, stage 1): my class first, then
 * everyone else at school, with a name search and the class name beside kids from other classes. A whole school online can
 * be 100+ kids, so the rest of the school shows a page at a time, with "Show more". Each game draws its own rows.
 */
import { useState, type ReactNode } from 'react';
import './schoolPlayerList.css';

export interface SchoolPlayer {
  id: string;
  name: string;
  /** In my class (the server says so). */
  sameClass: boolean;
  /** Their class's name, or null. Shown only for kids from other classes. */
  className: string | null;
}

/** How many of the rest of the school show before "Show more". */
export const SCHOOL_PAGE = 20;
/** The search box shows once the list is longer than this. */
const SEARCH_FROM = 6;

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Splits the list into my class and the rest, each by name, keeping only names (or class names) that match the search. */
export function splitByClass<T extends SchoolPlayer>(people: T[], search: string): { mine: T[]; others: T[] } {
  const q = fold(search.trim());
  const hit = (p: T) => !q || fold(p.name).includes(q) || (!p.sameClass && !!p.className && fold(p.className).includes(q));
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  const kept = people.filter(hit);
  return { mine: kept.filter((p) => p.sameClass).sort(byName), others: kept.filter((p) => !p.sameClass).sort(byName) };
}

/** Reads `sameClass` and `className` from a "who's here" row (older replies have neither: treat them as my class). */
export function readClassBits(o: Record<string, unknown>): { sameClass: boolean; className: string | null } {
  return { sameClass: o.sameClass !== false, className: typeof o.className === 'string' && o.className ? o.className : null };
}

/** The class name tag beside a kid from another class. */
export function ClassTag({ player }: { player: SchoolPlayer }) {
  if (player.sameClass || !player.className) return null;
  return <span className="school-list__class">{player.className}</span>;
}

export function SchoolPlayerList<T extends SchoolPlayer>({ people, label, listClassName, itemClassName, searchLabel = 'Find a name', row }: {
  people: T[];
  /** What the list is, for screen readers ("Players in Archery Challenge now"). */
  label: string;
  listClassName?: string;
  itemClassName?: string;
  searchLabel?: string;
  /** One row's inside (the <li> is made here). Put <ClassTag player={p} /> beside the name. */
  row: (p: T) => ReactNode;
}) {
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(SCHOOL_PAGE);
  const { mine, others } = splitByClass(people, search);
  const both = mine.length > 0 && others.length > 0;
  const list = (items: T[], what: string) => (
    <ul className={listClassName} aria-label={what}>
      {items.map((p) => <li key={p.id} className={itemClassName}>{row(p)}</li>)}
    </ul>
  );
  return (
    <div className="school-list">
      {people.length > SEARCH_FROM && (
        <input
          type="search"
          className="school-list__search"
          placeholder={`🔎 ${searchLabel}`}
          aria-label={searchLabel}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShown(SCHOOL_PAGE); }}
        />
      )}
      {mine.length === 0 && others.length === 0 && <p className="school-list__none">Nobody here matches “{search.trim()}”.</p>}
      {mine.length > 0 && (
        <>
          {both && <h4 className="school-list__head">Your class</h4>}
          {list(mine, both ? `${label}: your class` : label)}
        </>
      )}
      {others.length > 0 && (
        <>
          {mine.length > 0 ? <h4 className="school-list__head">Rest of the school</h4> : null}
          {list(others.slice(0, shown), mine.length > 0 ? `${label}: rest of the school` : label)}
          {others.length > shown && (
            <button type="button" className="school-list__more" onClick={() => setShown((n) => n + SCHOOL_PAGE)}>
              Show more ({others.length - shown} more)
            </button>
          )}
        </>
      )}
    </div>
  );
}
