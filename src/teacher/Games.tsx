/**
 * The Games tab (/teacher/:classId/games, docs/TEACHER-VIEW-PLAN.md, section 4.5): one compact table for the header's class, one
 * row per game, grouped like the dashboard. The on/off switch and the maths switch sit in the row; "Settings ›" opens the game's
 * own settings in a drawer on a wide screen, or on its own page (/teacher/:classId/games/:gameId) on a narrow one, so the back
 * button works either way.
 *
 * Each game says what goes in its row through `teacher` in its GameDefinition (section 6). A game that hasn't moved to that yet
 * still gets a row, and its old TeacherPanels open in the same drawer.
 */
import { Suspense, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { ALL_GAMES } from '../games/registry';
import type { DashboardGroup, GameDefinition, TeacherContract } from '../games/types';
import type { MathsSwitch } from '../../shared/space/mathsSwitch';
import { SettingChoice, SettingToggle, type Choice } from './Settings';
import { useTeacherClass } from './TeacherClass';
import './games.css';

/** The same groups, in the same order, as the dashboard. */
export const GAME_GROUPS: { title: string; group: DashboardGroup }[] = [
  { title: 'No maths', group: 'no-maths' },
  { title: 'Easy maths', group: 'easy-maths' },
  { title: 'Complex maths', group: 'complex-maths' },
];

/** Wide enough for the drawer beside the table; narrower, a game's settings get their own page. */
const WIDE = '(min-width: 800px)';

function useWide(): boolean {
  const ask = () => typeof window === 'undefined' || typeof window.matchMedia !== 'function' || window.matchMedia(WIDE).matches;
  const [wide, setWide] = useState(ask);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(WIDE);
    const change = () => setWide(query.matches);
    query.addEventListener?.('change', change);
    return () => query.removeEventListener?.('change', change);
  }, []);
  return wide;
}

/** Does the game have anything to open from its row? */
const hasSettings = (game: GameDefinition) => Boolean(game.teacher ? game.teacher.Settings : game.TeacherPanels);

const gamesPath = (classId: string) => `/teacher/${classId}/games`;

/**
 * Set on the way into a game's settings from the table, so closing goes back a step instead of adding one. `focusGame` is set
 * when closing has to replace the address instead (the settings were opened straight from a link).
 */
interface FromTable {
  fromTable?: boolean;
  focusGame?: string;
}

/**
 * Which "Settings ›" gets focus back, and on which visit to the table. It lives outside the component because the page is built
 * again from scratch on every change of address (Layout keys it by the path), so a ref would be gone by then. `tableKey` is the
 * history entry the table was last shown on: going back to that entry (Close, Escape or the browser's Back button) gives focus
 * back; arriving at the table any other way (say, from another tab) doesn't.
 */
let returnFocus: { gameId: string; tableKey: string | null } | null = null;
let lastTableKey: string | null = null;

export function TeacherGames() {
  const { classId } = useTeacherClass();
  const { gameId } = useParams();
  const wide = useWide();
  const navigate = useNavigate();
  const location = useLocation();
  const links = useRef(new Map<string, HTMLAnchorElement>());

  const game = gameId ? ALL_GAMES.find((g) => g.id === gameId) : undefined;

  // Coming back from a game's settings (drawer closed, or back from its page): focus goes back to its "Settings ›".
  useEffect(() => {
    if (gameId) {
      returnFocus = { gameId, tableKey: lastTableKey };
      return;
    }
    const asked = (location.state as FromTable | null)?.focusGame;
    const back = asked ?? (returnFocus && returnFocus.tableKey === location.key ? returnFocus.gameId : null);
    returnFocus = null;
    lastTableKey = location.key;
    if (back) links.current.get(back)?.focus();
  }, [gameId, location.key, location.state]);

  if (!classId) return null;
  // Not a game, or nothing to open: the table.
  if (gameId && (!game || !hasSettings(game))) return <Navigate to={gamesPath(classId)} replace />;

  const close = () => {
    if ((location.state as FromTable | null)?.fromTable) navigate(-1);
    else navigate(gamesPath(classId), { replace: true, state: { focusGame: gameId } satisfies FromTable });
  };

  if (game && !wide) {
    return (
      <GamePage game={game} onBack={close} backTo={gamesPath(classId)}>
        <GameSettings game={game} classId={classId} />
      </GamePage>
    );
  }

  return (
    <>
      <GamesTable classId={classId} links={links.current} />
      {game && (
        <Drawer title={game.name} onClose={close}>
          <GameSettings game={game} classId={classId} />
        </Drawer>
      )}
    </>
  );
}

function GamesTable({ classId, links }: { classId: string; links: Map<string, HTMLAnchorElement> }) {
  return (
    <section className="panel games-table" aria-labelledby="games-table-title">
      <h2 id="games-table-title" className="panel__title">
        Games for this class
      </h2>
      {/* The roles are the table's own: they keep it a table for screen readers when a narrow screen lays the rows out as cards. */}
      <table role="table" className="games-table__table" aria-labelledby="games-table-title">
        <thead role="rowgroup">
          <tr role="row">
            <th role="columnheader" scope="col">Game</th>
            <th role="columnheader" scope="col">On</th>
            <th role="columnheader" scope="col">Maths</th>
            <th role="columnheader" scope="col">
              <span className="sr-only">Settings</span>
            </th>
          </tr>
        </thead>
        {GAME_GROUPS.map(({ title, group }) => {
          const games = ALL_GAMES.filter((g) => g.group === group);
          if (games.length === 0) return null;
          return (
            <tbody key={group} role="rowgroup">
              <tr role="row" className="games-table__group">
                <th role="columnheader" scope="colgroup" colSpan={4}>
                  {title}
                </th>
              </tr>
              {games.map((game) => (
                <GameRow
                  key={`${game.id}-${classId}`}
                  game={game}
                  classId={classId}
                  linkRef={(el) => (el ? links.set(game.id, el) : links.delete(game.id))}
                />
              ))}
            </tbody>
          );
        })}
      </table>
    </section>
  );
}

function GameRow({ game, classId, linkRef }: { game: GameDefinition; classId: string; linkRef: (el: HTMLAnchorElement | null) => void }) {
  const t = game.teacher;
  return (
    <tr role="row">
      <th role="rowheader" scope="row" className="games-table__game">
        <span className="games-table__icon" aria-hidden="true">
          <game.Icon size={28} />
        </span>
        {game.name}
      </th>
      <td role="cell" className="games-table__on" data-label="On">
        {t?.switch ? (
          <SwitchCell game={game} switchOf={t.switch} classId={classId} />
        ) : !t && game.useTeacherSwitch ? (
          <span className="games-table__quiet">in Settings</span>
        ) : (
          <span className="games-table__quiet">always</span>
        )}
      </td>
      <td role="cell" className="games-table__maths" data-label="Maths">
        {t?.maths ? (
          <MathsSwitchSetting game={game} classId={classId} />
        ) : t?.useSummary ? (
          <SummaryCell use={t.useSummary} classId={classId} />
        ) : !t && game.TeacherPanels && game.group !== 'no-maths' ? (
          <span className="games-table__quiet">in Settings</span>
        ) : (
          <span className="games-table__quiet">
            <span aria-hidden="true">–</span>
            <span className="sr-only">None</span>
          </span>
        )}
      </td>
      <td role="cell" className="games-table__settings">
        {hasSettings(game) && (
          <Link
            ref={linkRef}
            to={game.id}
            state={{ fromTable: true } satisfies FromTable}
            className="games-table__open"
            aria-label={`${game.name} settings`}
          >
            <span>Settings</span>
            <span aria-hidden="true">›</span>
          </Link>
        )}
      </td>
    </tr>
  );
}

function SwitchCell({ game, switchOf, classId }: { game: GameDefinition; switchOf: NonNullable<TeacherContract['switch']>; classId: string }) {
  const value = switchOf.useValue(classId);
  return (
    <SettingToggle
      compact
      label={game.name}
      about={switchOf.about}
      value={value.value}
      loadFailed={value.failed}
      save={(on) => switchOf.save(on, classId)}
    />
  );
}

function SummaryCell({ use, classId }: { use: (classId: string) => string | null; classId: string }) {
  const summary = use(classId);
  return <span className="games-table__summary">{summary ?? '…'}</span>;
}

/** The 3-way maths switch every maths game shares (Off / Students choose / On for everyone). */
export const MATHS_CHOICES: Choice<MathsSwitch>[] = [
  { value: 'off', label: 'Off', detail: 'No maths questions in this game. Nothing else changes.' },
  { value: 'choose', label: 'Students choose', detail: 'Each student picks maths on or off when they set up a game.' },
  { value: 'on', label: 'On for everyone', detail: 'Every game has maths questions, with no way to turn them off.' },
];

/** A game's maths switch for the class, as it sits in its row of the Games table. */
export function MathsSwitchSetting({ game, classId }: { game: GameDefinition; classId: string }) {
  const maths = game.teacher!.maths!;
  const value = maths.useValue(classId);
  return (
    <SettingChoice
      compact
      label={`${game.name} maths`}
      about={maths.about}
      options={MATHS_CHOICES}
      value={value.value}
      loadFailed={value.failed}
      save={(mode) => maths.save(mode, classId)}
    />
  );
}

/** What opens from a row: the game's Settings, or (until it moves) its old panels, which read the class themselves. */
function GameSettings({ game, classId }: { game: GameDefinition; classId: string }) {
  const Settings = game.teacher?.Settings;
  const Old = game.teacher ? undefined : game.TeacherPanels;
  return (
    <div className="games-settings">
      <Suspense fallback={<p className="panel__empty">Loading…</p>}>
        {Settings ? <Settings classId={classId} /> : Old ? <Old /> : null}
      </Suspense>
    </div>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A side drawer over the table. Focus moves into it and stays there (Tab and Shift+Tab go round), Escape or the backdrop closes
 * it, and the table gives focus back to the button that opened it.
 */
function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButton.current?.focus();
  }, []);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !box.current) return;
    const all = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest('[hidden]'));
    if (all.length === 0) return;
    const first = all[0];
    const last = all[all.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === box.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="games-drawer">
      <div className="games-drawer__backdrop" aria-hidden="true" onClick={onClose} />
      <div
        ref={box}
        className="games-drawer__box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="games-drawer-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="games-drawer__head">
          <h2 id="games-drawer-title" className="games-drawer__title">
            {title}
          </h2>
          <button ref={closeButton} type="button" className="games-drawer__close" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** A narrow screen: the game's settings on their own page, with a way back to the table. */
function GamePage({ game, onBack, backTo, children }: { game: GameDefinition; onBack: () => void; backTo: string; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section className="panel games-page" aria-labelledby="games-page-title">
      <Link
        to={backTo}
        className="games-page__back"
        onClick={(e) => {
          e.preventDefault();
          onBack();
        }}
      >
        <span aria-hidden="true">‹</span>
        <span>All games</span>
      </Link>
      <h2 id="games-page-title" ref={heading} tabIndex={-1} className="panel__title">
        {game.name}
      </h2>
      {children}
    </section>
  );
}
