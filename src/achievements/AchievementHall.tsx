import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { fetchMyHomePage } from '../data/homePage';
import { fetchRules, type Achievement } from '../data/progress';
import { gameCardArt } from '../components/gameCardArt';
import { findGame } from '../games/registry';
import { playSound } from '../games/sounds';
import { useSound } from '../sound';
import { earnedWords, FILTERS, matches, nextUp, progressWords, readChoice, saveChoice, share, shelvesOf, type HallFilter, type Shelf } from './hall';
import { Medallion, TIER_WORDS } from './Medallion';
import hall from './art/hall.webp';
import hallSmall from './art/hall-800.webp';
import hallTall from './art/hall-tall.webp';
import hallTallSmall from './art/hall-tall-800.webp';
import shelfArt from './art/shelf.webp';
import './hall.css';

const calm = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A number that counts up as the Hall opens (straight to the end for reduced motion). */
function useCountUp(target: number, ms = 1100): number {
  const [shown, setShown] = useState(() => (calm() ? target : 0));
  useEffect(() => {
    if (calm()) return setShown(target);
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setShown(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return shown;
}

/** How many medallions fit across a shelf, so each row gets its own painted plank. */
function useColumns(cell: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setCols(Math.max(2, Math.floor(el.clientWidth / cell)));
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(fit);
    watch.observe(el);
    return () => watch.disconnect();
  }, [cell]);
  return [ref, cols] as const;
}

interface Open {
  a: Achievement;
  shelf: Shelf | undefined;
  /** Where the tapped medallion was, so the card zooms out of it. */
  from: { x: number; y: number };
  button: HTMLElement | null;
}

/**
 * The Achievement Hall (/achievements): every achievement the pupil can earn, as painted medallions on one shelf per game,
 * in a painted hall that fills the window like the full-window games. Trophies stay in the trophy cabinet (linked).
 */
export function AchievementHall() {
  const [all, setAll] = useState<Achievement[] | null>(null);
  const [playedMost, setPlayedMost] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [points, setPoints] = useState<number | null>(null);
  const [choice, setChoice] = useState(readChoice);
  const [sparkle, setSparkle] = useState(0);
  const [open, setOpen] = useState<Open | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { soundOn, setSoundOn } = useSound();

  useEffect(() => {
    let current = true;
    fetchMyHomePage().then(
      (home) => {
        if (!current) return;
        if (!home.progress) return setFailed(true);
        setAll(home.progress.achievements);
        setPlayedMost(home.topGames.mine);
      },
      () => current && setFailed(true),
    );
    fetchRules().then(
      (rules) => current && setPoints(rules.achievementPoints),
      () => {},
    );
    headingRef.current?.focus();
    return () => {
      current = false;
    };
  }, []);

  const shelves = useMemo(() => (all ? shelvesOf(all, playedMost) : []), [all, playedMost]);
  // A game picked on this device that this pupil no longer has (switched off) shows everything instead.
  const game = shelves.some((s) => s.id === choice.game) ? choice.game : '';
  const shown = shelves
    .filter((s) => !game || s.id === game)
    .map((s) => ({ ...s, picked: s.achievements.filter((a) => matches(a, choice.filter)) }))
    .filter((s) => s.picked.length > 0);

  function pick(next: { filter: HallFilter; game: string }) {
    setChoice(next);
    saveChoice(next);
    setSparkle((n) => n + 1);
    if (soundOn) playSound('blip');
  }

  function openCard(a: Achievement, button: HTMLElement) {
    const r = button.getBoundingClientRect();
    setOpen({ a, shelf: shelves.find((s) => s.id === a.game), from: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, button });
    if (soundOn) playSound('tap');
  }

  const earnedCount = all?.filter((a) => a.earnedAt).length ?? 0;

  return (
    <div className="ah-window">
      <picture className="ah-backdrop" aria-hidden="true">
        <source media="(orientation: portrait) and (max-width: 600px)" srcSet={hallTallSmall} />
        <source media="(orientation: portrait)" srcSet={hallTall} />
        <source media="(max-width: 900px)" srcSet={hallSmall} />
        <img src={hall} alt="" />
      </picture>
      <div className="ah">
        <header className="ah-top">
          <span className="ah-top__buttons">
            <a className="ah-btn" href="#/">
              <span aria-hidden="true">⌂</span> Hub
            </a>
            <button
              type="button"
              className="ah-btn"
              aria-pressed={soundOn}
              onClick={() => setSoundOn(!soundOn)}
              title={soundOn ? 'Sound is on: click to mute' : 'Sound is off: click to turn on'}
            >
              <span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span>
              <span className="sr-only">Sound</span>
            </button>
          </span>
          <h1 className="ah-title" ref={headingRef} tabIndex={-1}>
            Achievement Hall
          </h1>
          <Link className="ah-btn ah-btn--gold" to="/profile#trophies">
            <span aria-hidden="true">🏆</span> My trophies
          </Link>
        </header>

        {!all ? (
          <p className="ah-note" role="status">
            {failed ? 'We couldn’t open the Hall just now. Try again soon.' : 'Opening the Hall…'}
          </p>
        ) : (
          <>
            <Hero all={all} earned={earnedCount} onOpen={openCard} />

            <div className="ah-filters" role="group" aria-label="Show">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="ah-chip"
                  aria-pressed={choice.filter === f.id}
                  onClick={() => pick({ ...choice, filter: f.id })}
                >
                  <span aria-hidden="true">{f.emoji}</span> {f.label}
                  {choice.filter === f.id && <Sparkles key={sparkle} />}
                </button>
              ))}
              <label className="ah-picker">
                <span className="sr-only">Game</span>
                <select value={game} onChange={(e) => pick({ ...choice, game: e.target.value })}>
                  <option value="">🎮 Every game</option>
                  {shelves.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.earned} of {s.achievements.length})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="ah-shelves" key={`${choice.filter}-${game}`}>
              {shown.length === 0 ? (
                <p className="ah-note">
                  {choice.filter === 'earned'
                    ? 'None earned here yet. Tap “All” to see what to chase!'
                    : choice.filter === 'nearly'
                      ? 'Nothing started here yet. Play a game and come back!'
                      : 'You’ve started every one of these. Amazing!'}
                </p>
              ) : (
                shown.map((s, i) => <ShelfView key={s.id} shelf={s} picked={s.picked} index={i} onOpen={openCard} />)
              )}
            </div>
          </>
        )}
      </div>
      {open && (
        <BadgeCard
          open={open}
          points={points}
          onClose={() => {
            open.button?.focus();
            setOpen(null);
          }}
        />
      )}
    </div>
  );
}

function Sparkles() {
  return (
    <span className="ah-sparkles" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} style={{ '--i': i } as CSSProperties} />
      ))}
    </span>
  );
}

/** The top strip: "N of M", the big ring filling as the Hall opens, and the three closest to being earned. */
function Hero({ all, earned, onOpen }: { all: Achievement[]; earned: number; onOpen: (a: Achievement, el: HTMLElement) => void }) {
  const count = useCountUp(earned);
  const next = nextUp(all);
  const done = all.length ? earned / all.length : 0;
  return (
    <section className="ah-hero" aria-label="My achievements">
      <div className="ah-ring" style={{ '--ah-ring': done * 100 } as CSSProperties}>
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <defs>
            <linearGradient id="ah-ring-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff3b0" />
              <stop offset="0.5" stopColor="#f5b82e" />
              <stop offset="1" stopColor="#c97a0a" />
            </linearGradient>
          </defs>
          <circle className="ah-ring__track" cx="60" cy="60" r="52" pathLength={100} />
          <circle className="ah-ring__fill" cx="60" cy="60" r="52" pathLength={100} />
        </svg>
        <p className="ah-ring__words">
          <strong>{count}</strong>
          <span>of {all.length}</span>
        </p>
      </div>
      <div className="ah-next">
        <h2 className="ah-next__title">Next up</h2>
        {next.length === 0 ? (
          <p className="ah-next__all">You’ve earned every one. Legend!</p>
        ) : (
          <ul className="ah-next__list">
            {next.map((a) => (
              <li key={a.id}>
                <button type="button" className="ah-next__item" onClick={(e) => onOpen(a, e.currentTarget)} aria-label={`${a.name}: ${progressWords(a)}`}>
                  <Medallion a={a} size={72} />
                  <span className="ah-next__name">{a.name}</span>
                  <span className="ah-next__count">{progressWords(a)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

const CELL = 116;

function ShelfView({ shelf, picked, index, onOpen }: { shelf: Shelf; picked: Achievement[]; index: number; onOpen: (a: Achievement, el: HTMLElement) => void }) {
  const [ref, cols] = useColumns(CELL);
  const art = gameCardArt(shelf.id);
  const colours = findGame(shelf.id)?.colours ?? ['#5b3a8c', '#2b1b4a'];
  const rows: Achievement[][] = [];
  for (let i = 0; i < picked.length; i += cols) rows.push(picked.slice(i, i + cols));
  const style = {
    '--ah-delay': `${Math.min(index, 8) * 70}ms`,
    '--ah-c1': colours[0],
    '--ah-c2': colours[1],
    ...(art ? { '--ah-banner': `url(${art.small})`, '--ah-focus': art.focus ?? 'center 55%' } : {}),
  } as CSSProperties;
  const titleId = `ah-shelf-${shelf.id}`;
  return (
    <section className="ah-shelf" style={style} aria-labelledby={titleId}>
      <div className={`ah-banner${art ? '' : ' ah-banner--plain'}`}>
        <h2 id={titleId} className="ah-banner__name">
          {shelf.name}
        </h2>
        <p className="ah-banner__count">
          {shelf.earned} of {shelf.achievements.length}
        </p>
        <span className="ah-banner__bar" aria-hidden="true">
          <span style={{ width: `${(shelf.earned / Math.max(1, shelf.achievements.length)) * 100}%` }} />
        </span>
      </div>
      <div className="ah-rows" ref={ref}>
        {rows.map((row, r) => (
          <div key={r} className="ah-row">
            <ul className="ah-row__items">
              {row.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="ah-item"
                    data-achievement={a.id}
                    onClick={(e) => onOpen(a, e.currentTarget)}
                    aria-label={`${a.name}, ${TIER_WORDS[a.tier ?? 2]}: ${a.earnedAt ? 'earned' : progressWords(a)}`}
                  >
                    <Medallion a={a} size={84} />
                    <span className="ah-item__name">{a.name}</span>
                  </button>
                </li>
              ))}
            </ul>
            <img className="ah-row__plank" src={shelfArt} alt="" aria-hidden="true" draggable={false} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** The badge card that zooms out of its medallion: big medallion, name, how, progress, when, points, Play. */
function BadgeCard({ open, points, onClose }: { open: Open; points: number | null; onClose: () => void }) {
  const { a, shelf } = open;
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const done = a.earnedAt !== null;
  const counted = a.measure !== 'rank' && a.goal > 1;
  const style = {
    '--ah-from-x': `${open.from.x - window.innerWidth / 2}px`,
    '--ah-from-y': `${open.from.y - window.innerHeight / 2}px`,
  } as CSSProperties;
  return (
    <div className="ah-card-layer" onClick={onClose}>
      <div
        className={`ah-card ah-card--t${a.tier ?? 2}${done ? ' is-earned' : ''}`}
        style={style}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ah-card-name"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} type="button" className="ah-card__close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        {done && <span className="ah-card__rays" aria-hidden="true" />}
        <Medallion a={a} size={164} />
        <p className="ah-card__tier">
          {TIER_WORDS[a.tier ?? 2]}
          {shelf ? ` · ${shelf.name}` : ''}
        </p>
        <h2 id="ah-card-name" className="ah-card__name">
          {a.name}
        </h2>
        {a.how && <p className="ah-card__how">{a.how}</p>}
        {done ? (
          <p className="ah-card__when">✅ {earnedWords(a.earnedAt!)}</p>
        ) : (
          <div className="ah-card__progress">
            <strong>{progressWords(a)}</strong>
            {counted && (
              <span className="ah-card__bar" aria-hidden="true">
                <span style={{ width: `${share(a) * 100}%` }} />
              </span>
            )}
          </div>
        )}
        {points !== null && <p className="ah-card__points">{done ? `+${points} points won` : `+${points} points`}</p>}
        {shelf && (
          <Link className="ah-card__play" to={shelf.playTo}>
            ▶ {shelf.playLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
