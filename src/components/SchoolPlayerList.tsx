/**
 * "Who's here" for the games you play live against someone (docs/plans/play-anyone/PLAN.md, stage 1): my class first, then
 * everyone else at school, with a name search and the class name beside kids from other classes. A whole school online can
 * be 100+ kids, so the rest of the school shows a page at a time, with "Show more". Each game draws its own rows.
 *
 * Stars (stage 8, section F): "⭐ Your stars" sits above Your class, each with a green "here now" dot, and every row has a
 * ☆ / ⭐ button when the list is given `onStar`. A star is private: it only changes the order of MY list.
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
  /** I starred them (only I can see this). */
  starred?: boolean;
}

/** How many of the rest of the school show before "Show more". */
export const SCHOOL_PAGE = 20;
/** The search box shows once the list is longer than this. */
const SEARCH_FROM = 6;

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Does a kid match the search (their name, or the class name of a kid from another class)? */
export function matches(p: SchoolPlayer, search: string): boolean {
  const q = fold(search.trim());
  return !q || fold(p.name).includes(q) || (!p.sameClass && !!p.className && fold(p.className).includes(q));
}

/** Splits the list into my stars, my class and the rest, each by name, keeping only kids that match the search. */
export function splitByClass<T extends SchoolPlayer>(people: T[], search: string): { stars: T[]; mine: T[]; others: T[] } {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  const kept = people.filter((p) => matches(p, search));
  const rest = kept.filter((p) => !p.starred);
  return {
    stars: kept.filter((p) => p.starred).sort(byName),
    mine: rest.filter((p) => p.sameClass).sort(byName),
    others: rest.filter((p) => !p.sameClass).sort(byName),
  };
}

/** Reads `sameClass`, `className` and `starred` from a "who's here" row (older replies have none: my class, not starred). */
export function readClassBits(o: Record<string, unknown>): { sameClass: boolean; className: string | null; starred: boolean } {
  return { sameClass: o.sameClass !== false, className: typeof o.className === 'string' && o.className ? o.className : null, starred: o.starred === true };
}

/** The ☆ / ⭐ button: big enough for small fingers. */
export function StarButton({ player, onToggle, disabled }: { player: SchoolPlayer; onToggle: () => void; disabled?: boolean }) {
  const on = !!player.starred;
  return (
    <button
      type="button"
      className={`school-list__star${on ? ' school-list__star--on' : ''}`}
      aria-pressed={on}
      aria-label={on ? `Take the star off ${player.name}` : `Star ${player.name}`}
      disabled={disabled}
      onClick={onToggle}
    >
      {on ? '⭐' : '☆'}
    </button>
  );
}

/**
 * Starring with the server, shown straight away (put back if the server says no). `onStar` gives null when it worked, or the
 * words for why not (30 stars already). Returns the people with my latest stars, a toggle, and the last problem.
 */
export function useStars<T extends SchoolPlayer>(people: T[], onStar?: (p: T, on: boolean) => Promise<string | null>) {
  const [mine, setMine] = useState<Record<string, boolean>>({});
  const [problem, setProblem] = useState('');
  const withStars = people.map((p) => (p.id in mine && mine[p.id] !== !!p.starred ? { ...p, starred: mine[p.id] } : p));
  const toggle = (p: T) => {
    if (!onStar) return;
    const on = !p.starred;
    setProblem('');
    setMine((m) => ({ ...m, [p.id]: on }));
    void onStar(p, on).then((why) => {
      if (why === null) return;
      setMine((m) => ({ ...m, [p.id]: !on }));
      setProblem(why);
    });
  };
  return { people: withStars, toggle, problem };
}

/** The class name tag beside a kid from another class. */
export function ClassTag({ player }: { player: SchoolPlayer }) {
  if (player.sameClass || !player.className) return null;
  return <span className="school-list__class">{player.className}</span>;
}

export function SchoolPlayerList<T extends SchoolPlayer>({ people, label, listClassName, itemClassName, searchLabel = 'Find a name', row, onStar, away, awayRow }: {
  people: T[];
  /** What the list is, for screen readers ("Players in Archery Challenge now"). */
  label: string;
  listClassName?: string;
  itemClassName?: string;
  searchLabel?: string;
  /** One row's inside (the <li> is made here). Put <ClassTag player={p} /> beside the name. */
  row: (p: T) => ReactNode;
  /** Star or unstar (gives null when it worked, or why not). Without it there are no star buttons. */
  onStar?: (p: T, on: boolean) => Promise<string | null>;
  /** My stars who aren't here (the Lobby): greyed under the stars who are, with "Not here right now". */
  away?: SchoolPlayer[];
  /** The inside of an away row (default: the name and class tag). */
  awayRow?: (p: SchoolPlayer) => ReactNode;
}) {
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(SCHOOL_PAGE);
  const here = useStars(people, onStar);
  const gone = useStars((away ?? []).map((p) => ({ ...p, starred: true })), onStar as ((p: SchoolPlayer, on: boolean) => Promise<string | null>) | undefined);
  const { stars, mine, others } = splitByClass(here.people, search);
  const awayShown = gone.people.filter((p) => matches(p, search)).sort((a, b) => a.name.localeCompare(b.name));
  const groups = [stars.length + awayShown.length, mine.length, others.length].filter((n) => n > 0).length;
  const heads = groups > 1;
  const star = (p: T) => onStar && <StarButton player={p} onToggle={() => here.toggle(p)} />;
  const list = (items: T[], what: string, dot = false) => (
    <ul className={listClassName} aria-label={what}>
      {items.map((p) => (
        <li key={p.id} className={`${itemClassName ?? ''}${dot ? ' school-list__item--star' : ''}`.trim() || undefined}>
          {dot && <span className="school-list__dot" role="img" aria-label="here now" title="Here now" />}
          {row(p)}
          {star(p)}
        </li>
      ))}
    </ul>
  );
  const problem = here.problem || gone.problem;
  return (
    <div className="school-list">
      {people.length + (away?.length ?? 0) > SEARCH_FROM && (
        <input
          type="search"
          className="school-list__search"
          placeholder={`🔎 ${searchLabel}`}
          aria-label={searchLabel}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShown(SCHOOL_PAGE); }}
        />
      )}
      {problem && <p className="school-list__problem" role="alert">{problem}</p>}
      {groups === 0 && <p className="school-list__none">Nobody here matches “{search.trim()}”.</p>}
      {stars.length + awayShown.length > 0 && (
        <>
          <h4 className="school-list__head"><span aria-hidden="true">⭐ </span>Your stars</h4>
          {stars.length > 0 && list(stars, `${label}: your stars`, true)}
          {awayShown.length > 0 && (
            <ul className={`${listClassName ?? ''} school-list__away`.trim()} aria-label="Your stars who aren’t here">
              {awayShown.map((p) => (
                <li key={p.id} className={`${itemClassName ?? ''} school-list__item--away`.trim()}>
                  {awayRow ? awayRow(p) : <span>{p.name}<ClassTag player={p} /></span>}
                  <span className="school-list__gone">Not here right now</span>
                  {onStar && <StarButton player={p} onToggle={() => gone.toggle(p)} />}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {mine.length > 0 && (
        <>
          {heads && <h4 className="school-list__head">Your class</h4>}
          {list(mine, heads ? `${label}: your class` : label)}
        </>
      )}
      {others.length > 0 && (
        <>
          {heads ? <h4 className="school-list__head">Rest of the school</h4> : null}
          {list(others.slice(0, shown), heads ? `${label}: rest of the school` : label)}
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
