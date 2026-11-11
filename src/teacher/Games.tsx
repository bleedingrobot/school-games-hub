/**
 * The Games tab (/teacher/:classId/games, docs/TEACHER-VIEW-PLAN.md, section 4.5): one compact table for the header's class, one
 * row per game, grouped like the dashboard. The on/off switch and the maths switch sit in the row; "Settings ›" opens the game's
 * own settings in a drawer on a wide screen, or on its own page (/teacher/:classId/games/:gameId) on a narrow one, so the back
 * button works either way.
 *
 * Each game says what goes in its row through `teacher` in its GameDefinition (section 6).
 */
import { Suspense, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { fetchGameSwitches, fetchSchoolSwitches, NON_MATHS_COLUMN, saveGameSwitches, saveSchoolSwitches, switchColumnOf } from '../data/games';
import { saveNonMathsGames } from '../data/nonMathsGames';
import { fetchUnlimitedToday, saveUnlimitedToday } from '../data/unlimitedTurns';
import { GAMES } from '../games/registry';
import type { DashboardGroup, GameDefinition } from '../games/types';
import type { MathsSwitch } from '../../shared/space/mathsSwitch';
import { UNLIMITED_GAMES, type UnlimitedGame } from '../../shared/unlimited';
import { PUPILS_SEE_IT, SettingChoice, SettingToggle, settingErrorText, type Choice } from './Settings';
import { useTeacherClass } from './TeacherClass';
import { useSetting } from './useSetting';
import './games.css';

/** The same groups, in the same order, as the dashboard. */
export const GAME_GROUPS: { title: string; group: DashboardGroup }[] = [
  { title: 'Foundational skills', group: 'foundational' },
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
const hasSettings = (game: GameDefinition) => Boolean(game.teacher?.Settings);

/**
 * What the Games table and Lesson controls edit: a class's settings, or the school's defaults row (what a new class starts with;
 * Admin, New class settings). The school's table has the On switches only: a game's maths mode and settings stay per class.
 */
export type SettingsTarget = { kind: 'school' } | { kind: 'class'; classId: string };

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

  const game = gameId ? GAMES.find((g) => g.id === gameId) : undefined;

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
      <GamesTable target={{ kind: 'class', classId }} links={links.current} />
      {game && (
        <Drawer title={game.name} onClose={close}>
          <GameSettings game={game} classId={classId} />
        </Drawer>
      )}
    </>
  );
}

/** What the four No maths rows share: the class's Non-maths games switch (the same value as on Today), loaded once for the table. */
interface NonMaths {
  value: boolean | null;
  failed: boolean;
  onSaved: (on: boolean) => void;
}

/** What the Games table shows: all games, only the ones that are on, or only the ones that are off. */
type Show = 'all' | 'on' | 'off';
const SHOW_KEY = 'teacher-games-show';
const SHOWS: { value: Show; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
];

/** The chip the teacher last picked, remembered on this computer. Browsers can refuse storage; then it is All each visit. */
function useRememberedShow(): [Show, (next: Show) => void] {
  const [show, setShow] = useState<Show>(() => {
    try {
      const kept = localStorage.getItem(SHOW_KEY);
      return kept === 'on' || kept === 'off' ? kept : 'all';
    } catch {
      return 'all';
    }
  });
  return [
    show,
    (next) => {
      setShow(next);
      try {
        localStorage.setItem(SHOW_KEY, next);
      } catch {
        // Not remembered; the chip still works.
      }
    },
  ];
}

export function GamesTable({ target, links }: { target: SettingsTarget; links: Map<string, HTMLAnchorElement> }) {
  const { current } = useTeacherClass();
  const school = target.kind === 'school';
  const classId = target.kind === 'class' ? target.classId : '';
  const className = school ? 'new classes' : (current?.name ?? 'this class');
  const loaded = useSetting(() => (school ? fetchSchoolSwitches() : fetchGameSwitches(classId)), [classId, school]);
  const unlimited = useSetting(() => fetchUnlimitedToday(classId), [classId], !school);
  // Switches changed from this page, over what was loaded; the rows are built again (`version`) after a whole section changes.
  const [changed, setChanged] = useState<Record<string, boolean>>({});
  const [version, setVersion] = useState(0);
  const [show, setShow] = useRememberedShow();
  const [confirming, setConfirming] = useState<DashboardGroup | null>(null);
  const [busy, setBusy] = useState<DashboardGroup | null>(null);
  const [problem, setProblem] = useState<{ group: DashboardGroup; text: string } | null>(null);
  const allOff = useRef(new Map<DashboardGroup, HTMLButtonElement>());
  useEffect(() => {
    setChanged({});
    setConfirming(null);
    setProblem(null);
  }, [classId]);

  const valueOf = (column: string): boolean | null => changed[column] ?? loaded.value?.[column] ?? null;
  const nonMaths: NonMaths = {
    value: valueOf(NON_MATHS_COLUMN),
    failed: loaded.failed,
    onSaved: (on) => setChanged((c) => ({ ...c, [NON_MATHS_COLUMN]: on })),
  };
  /** On, off, or null while it loads. A game with no switch is always on. */
  const isOn = (game: GameDefinition): boolean | null => {
    const column = switchColumnOf(game);
    return column ? valueOf(column) : true;
  };

  const counts = useMemo(() => {
    const on = GAMES.filter((g) => isOn(g) === true).length;
    return { on, total: GAMES.length, ready: GAMES.every((g) => isOn(g) !== null) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded.value, changed]);

  async function setSection(group: DashboardGroup, on: boolean) {
    const columns = [...new Set(GAMES.filter((g) => g.group === group).map(switchColumnOf).filter((c): c is string => c !== null))];
    setConfirming(null);
    setProblem(null);
    setBusy(group);
    try {
      const changes = Object.fromEntries(columns.map((c) => [c, on]));
      await (school ? saveSchoolSwitches(changes) : saveGameSwitches(changes, classId));
      setChanged((c) => ({ ...c, ...Object.fromEntries(columns.map((column) => [column, on])) }));
      setVersion((v) => v + 1);
    } catch (error) {
      setProblem({ group, text: settingErrorText(error) });
    } finally {
      setBusy(null);
    }
    if (!on) setTimeout(() => allOff.current.get(group)?.focus());
  }

  const sections = GAME_GROUPS.map(({ title, group }) => {
    const games = GAMES.filter((g) => g.group === group);
    const switchable = games.filter((g) => switchColumnOf(g) !== null);
    const onCount = games.filter((g) => isOn(g) === true).length;
    const shown = games.filter((g) => show === 'all' || isOn(g) === (show === 'on'));
    return { title, group, games, switchable, onCount, shown };
  }).filter((section) => section.games.length > 0);
  const nothingShown = sections.every((section) => section.shown.length === 0);

  return (
    <section className="panel games-table" aria-labelledby="games-table-title">
      <h2 id="games-table-title" className="panel__title">
        {school ? 'Games for new classes' : 'Games for this class'}
      </h2>
      <div className="games-summary">
        <p className="games-summary__count" aria-live="polite">
          On for {className}: <strong>{counts.ready ? `${counts.on} of ${counts.total} games` : '…'}</strong>
        </p>
        <div className="games-summary__show" role="group" aria-label="Show games">
          <span className="games-summary__show-label" aria-hidden="true">
            Show
          </span>
          {SHOWS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="games-summary__chip"
              aria-pressed={show === option.value}
              onClick={() => setShow(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {nothingShown && counts.ready && <p className="panel__empty">{show === 'on' ? 'No games are on for this class.' : 'Every game is on for this class.'}</p>}
      {/* The roles are the table's own: they keep it a table for screen readers when a narrow screen lays the rows out as cards. */}
      <table role="table" className="games-table__table" aria-labelledby="games-table-title">
        <thead role="rowgroup">
          <tr role="row">
            <th role="columnheader" scope="col">Game</th>
            <th role="columnheader" scope="col">On</th>
            {!school && (
              <>
                <th role="columnheader" scope="col">Unlimited today</th>
                <th role="columnheader" scope="col">Maths</th>
                <th role="columnheader" scope="col">
                  <span className="sr-only">Settings</span>
                </th>
              </>
            )}
          </tr>
        </thead>
        {sections.map(({ title, group, switchable, onCount, games, shown }) => {
          if (shown.length === 0) return null;
          const loadedAll = loaded.value !== null;
          const mixed = (on: boolean) => switchable.some((g) => isOn(g) !== on);
          return (
            <tbody key={group} role="rowgroup">
              <tr role="row" className="games-table__group">
                <th role="columnheader" scope="colgroup" colSpan={school ? 2 : 5}>
                  <div className="games-table__group-head">
                    <span>{title}</span>
                    <span className="games-table__group-count">{loadedAll ? `${onCount} of ${games.length} on` : '…'}</span>
                    {switchable.length > 0 && confirming !== group && (
                      <span className="games-table__group-buttons">
                        <button
                          type="button"
                          className="games-table__bulk"
                          disabled={!loadedAll || busy !== null || !mixed(true)}
                          aria-label={`All on, ${title}`}
                          onClick={() => void setSection(group, true)}
                        >
                          All on
                        </button>
                        <button
                          type="button"
                          className="games-table__bulk"
                          ref={(el) => {
                            if (el) allOff.current.set(group, el);
                            else allOff.current.delete(group);
                          }}
                          disabled={!loadedAll || busy !== null || !mixed(false)}
                          aria-label={`All off, ${title}`}
                          onClick={() => setConfirming(group)}
                        >
                          All off
                        </button>
                      </span>
                    )}
                    {confirming === group && (
                      <span className="games-table__confirm" role="alertdialog" aria-label="Turn off a section">
                        <span className="games-table__confirm-text">
                          Turn off all {switchable.length} {title} games for {className}?
                        </span>
                        <button type="button" className="games-table__bulk games-table__bulk--confirm" autoFocus onClick={() => void setSection(group, false)}>
                          Turn off
                        </button>
                        <button type="button" className="games-table__bulk" onClick={() => setConfirming(null)}>
                          Keep them on
                        </button>
                      </span>
                    )}
                    <span className="games-table__group-status" role="status">
                      {busy === group ? 'Saving…' : problem?.group === group ? problem.text : ''}
                    </span>
                  </div>
                </th>
              </tr>
              {shown.map((game) => school ? (
                <SchoolRow
                  key={`${game.id}-${version}`}
                  game={game}
                  value={valueOf(switchColumnOf(game) ?? '')}
                  failed={loaded.failed}
                  onSwitched={(column, on) => setChanged((c) => ({ ...c, [column]: on }))}
                />
              ) : (
                <GameRow
                  key={`${game.id}-${classId}-${version}`}
                  game={game}
                  classId={classId}
                  nonMaths={nonMaths}
                  onSwitched={(column, on) => setChanged((c) => ({ ...c, [column]: on }))}
                  unlimited={unlimited}
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

/** A game's row in the school's table: its On switch and nothing else. A game with no switch is always on. */
function SchoolRow({ game, value, failed, onSwitched }: { game: GameDefinition; value: boolean | null; failed: boolean; onSwitched: (column: string, on: boolean) => void }) {
  const column = switchColumnOf(game);
  const shared = game.group === 'no-maths';
  return (
    <tr role="row">
      <th role="rowheader" scope="row" className="games-table__game">
        <span className="games-table__icon" aria-hidden="true">
          <game.Icon size={28} />
        </span>
        {game.name}
      </th>
      <td role="cell" className="games-table__on" data-label="On">
        {column ? (
          <SettingToggle
            compact
            label={shared ? `${game.name} (with Non-maths games)` : game.name}
            about={shared ? 'Chess, checkers, 101 and Power Clash share one switch.' : undefined}
            value={value}
            loadFailed={failed}
            save={(on) => saveSchoolSwitches({ [column]: on })}
            onSaved={(on) => onSwitched(column, on)}
          />
        ) : (
          <span className="games-table__quiet">always</span>
        )}
      </td>
    </tr>
  );
}

function GameRow({
  game,
  classId,
  nonMaths,
  onSwitched,
  unlimited,
  linkRef,
}: {
  game: GameDefinition;
  classId: string;
  nonMaths: NonMaths;
  onSwitched: (column: string, on: boolean) => void;
  unlimited: { value: Record<UnlimitedGame, boolean> | null; failed: boolean };
  linkRef: (el: HTMLAnchorElement | null) => void;
}) {
  const t = game.teacher;
  const column = switchColumnOf(game);
  const unlimitedGame = UNLIMITED_GAMES.find((g) => g.id === game.id);
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
          <GameSwitchSetting game={game} classId={classId} onSaved={column ? (on) => onSwitched(column, on) : undefined} />
        ) : game.group === 'no-maths' ? (
          <>
            <SettingToggle
              compact
              label={`${game.name} (with Non-maths games)`}
              about="Chess, checkers, 101 and Power Clash share one switch. It is the same as Non-maths games on Today."
              value={nonMaths.value}
              savedText={PUPILS_SEE_IT}
              loadFailed={nonMaths.failed}
              save={(on) => saveNonMathsGames(on, classId)}
              onSaved={nonMaths.onSaved}
            />
            <span className="games-table__quiet">On with Non-maths games</span>
          </>
        ) : (
          <span className="games-table__quiet">always</span>
        )}
      </td>
      <td role="cell" className="games-table__unlimited" data-label="Unlimited today">
        {unlimitedGame && (
          <SettingToggle
            compact
            label={`${game.name} unlimited today`}
            about={`Unlimited ${unlimitedGame.lifts} today. It turns itself off at midnight.`}
            value={unlimited.value?.[unlimitedGame.id] ?? null}
            loadFailed={unlimited.failed}
            save={(on) => saveUnlimitedToday(unlimitedGame.id, on, classId)}
          />
        )}
      </td>
      <td role="cell" className="games-table__maths" data-label="Maths">
        {t?.maths ? (
          <MathsSwitchSetting game={game} classId={classId} />
        ) : t?.useSummary ? (
          <SummaryCell use={t.useSummary} classId={classId} />
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

/** A game's on/off switch for the class, as it sits in its row of the Games table. */
export function GameSwitchSetting({ game, classId, onSaved }: { game: GameDefinition; classId: string; onSaved?: (on: boolean) => void }) {
  const switchOf = game.teacher!.switch!;
  const value = switchOf.useValue(classId);
  return (
    <SettingToggle
      compact
      label={game.name}
      about={switchOf.about}
      value={value.value}
      savedText={PUPILS_SEE_IT}
      loadFailed={value.failed}
      save={(on) => switchOf.save(on, classId)}
      onSaved={onSaved}
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
      savedText={PUPILS_SEE_IT}
      loadFailed={value.failed}
      save={(mode) => maths.save(mode, classId)}
    />
  );
}

/** What opens from a row: the game's Settings, for the header's class. */
function GameSettings({ game, classId }: { game: GameDefinition; classId: string }) {
  const Settings = game.teacher?.Settings;
  return (
    <div className="games-settings">
      <Suspense fallback={<p className="panel__empty">Loading…</p>}>
        {Settings && <Settings classId={classId} />}
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
