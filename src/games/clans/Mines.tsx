import { bossAt } from '../../../shared/clans/fight';
import { nextBossFame } from '../../../shared/clans/rewards';
import { CONFIG } from '../../../shared/clans/config';
import { UNLIMITED_LABEL } from '../../../shared/unlimited';
import { fightsLabel } from './fightView';
import { useEffect, useRef, useState } from 'react';
import { averageLevel, hintFor, type FightSummary, type Session } from './session';
import { depthHint } from '../../../shared/clans/character';
import { memberArt, memberThumb, mineArt, sceneArt, zoneScene } from './art';
import { lookOf } from '../../../shared/clans/looks';
import { Portrait } from './Sprite';
import type { BestNote } from './Fight';
import { ZONE_TEXT, depthName, zoneForDepth } from './text';
import type { Member } from '../../../shared/clans/types';

const HINT_TEXT = { 'too easy': 'Too easy', 'just right': 'Just right', tough: 'Tough', 'too hard': 'Too hard' } as const;

/** The deepest depth that is "just right" for the clan: where the Mines open (all too easy: the bottom; none: the top). */
export function recommendedDepth(clan: Session['clan']): number {
  const avg = averageLevel(clan);
  let best = -1;
  for (let d = 0; d <= CONFIG.maxLevel; d++) if (depthHint(d, avg) === 'just right') best = d;
  if (best >= 0) return best;
  return depthHint(CONFIG.maxLevel, avg) === 'too easy' ? CONFIG.maxLevel : 0;
}

/**
 * Choose how deep to go. Each depth has its own painting and name, with the choices laid over it. The Mines open at the
 * recommended depth unless the clan already chose one that is just right or tough. Keys: Enter goes in, B takes on the
 * boss, the arrow keys (or - and +) change the depth.
 */
/** The painting of a mine depth, or its zone's painting when that depth has none of its own. */
export function depthArt(depth: number): { wide?: string; small?: string } {
  const own = mineArt(depth);
  return own.wide ? own : sceneArt(zoneScene(zoneForDepth(depth)));
}

export function Mines({ session, onDepth, onGo, onBack, locked, top }: { session: Session; onDepth: (d: number) => void; onGo: (boss: boolean) => void; onBack: () => void; locked?: string; top?: React.ReactNode }) {
  const hint = hintFor(session);
  const boss = bossAt(session.depth);
  const awake = session.clan.members.some((m) => !m.knockedOut);
  const unlimited = session.unlimitedToday === true;
  const canGo = (session.fightsLeft > 0 || unlimited) && awake && !locked;
  const set = (d: number) => onDepth(Math.max(0, Math.min(CONFIG.maxLevel, d)));
  const recommended = recommendedDepth(session.clan);
  // Opening: a depth that is too easy or too hard moves to the recommended one.
  useEffect(() => {
    if (hint === 'too easy' || hint === 'too hard') set(recommended);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // What is typed in the depth box while it is being typed: it may be empty for a moment, and a leading 0 goes.
  const [draft, setDraft] = useState<string | null>(null);
  const typed = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(-2);
    if (digits === '') return setDraft('');
    const d = Math.max(0, Math.min(CONFIG.maxLevel, Number(digits)));
    setDraft(String(d));
    set(d);
  };
  // The keys, on the whole page while the Mines are open (the latest props each time).
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  keys.current = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    const inBox = t instanceof HTMLInputElement;
    if (t instanceof HTMLButtonElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
    if (e.key === 'Enter' && canGo) onGo(false);
    else if ((e.key === 'b' || e.key === 'B') && !inBox && boss && canGo) onGo(true);
    else if (!inBox && (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === '+' || e.key === '=')) set(session.depth + 1);
    else if (!inBox && (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === '-')) set(session.depth - 1);
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const zone = zoneForDepth(session.depth);
  const art = depthArt(session.depth);
  return (
    <section className="cq-mines" aria-label="The Mines">
      <div className={`cq-mines__stage ${art.wide ? '' : 'is-plain'}`}>
        {art.wide && (
          <img key={art.wide} className="cq-mines__pic" src={art.wide} srcSet={art.small && art.small !== art.wide ? `${art.small} 800w, ${art.wide} 1600w` : undefined} sizes="(max-width: 1100px) 100vw, 1100px" alt="" />
        )}
        {top}
        <div className="cq-mines__top">
          <h2>The Mines</h2>
          <p className="cq-mines__place" aria-live="polite">
            <strong key={session.depth}>Depth {session.depth}: {depthName(session.depth)}</strong>
            <span>{ZONE_TEXT[zone]}</span>
          </p>
        </div>
        <div className="cq-mines__panel">
          <div className="cq-depth">
            <button type="button" className="cq-btn" aria-label="Go less deep" disabled={session.depth <= 0} onClick={() => set(session.depth - 1)}>−</button>
            <label>
              Depth
              <input type="text" inputMode="numeric" aria-label={`Depth, 0 to ${CONFIG.maxLevel}`} value={draft ?? String(session.depth)} onChange={(e) => typed(e.target.value)} onFocus={(e) => e.target.select()} onBlur={() => setDraft(null)} />
            </label>
            <button type="button" className="cq-btn" aria-label="Go deeper" disabled={session.depth >= CONFIG.maxLevel} onClick={() => set(session.depth + 1)}>+</button>
            <span className={`cq-hint cq-hint--${hint.replace(' ', '-')}`}>{HINT_TEXT[hint]}</span>
            {session.depth === recommended ? (
              <span className="cq-hint cq-hint--recommended">★ Recommended</span>
            ) : (
              <button type="button" className="cq-btn cq-btn--small" onClick={() => set(recommended)}>★ Recommended: {recommended}</button>
            )}
            <span className="cq-mines__left">
              Fights left today: <strong>{unlimited && session.fightsLeft === 0 ? UNLIMITED_LABEL : fightsLabel(session.fightsLeft, session.fightsPerDay)}</strong>
            </span>
          </div>
          <div className="cq-actions">
            <button type="button" className="cq-btn cq-btn--hot cq-btn--go" disabled={!canGo} autoFocus onClick={() => onGo(false)}>
              <kbd>Enter</kbd> Into the Mines!
            </button>
            {boss && (
              <button type="button" className="cq-btn" disabled={!canGo} onClick={() => onGo(true)}>
                <kbd>B</kbd> Take on the boss: {boss.name} (+{nextBossFame(session.clan, session.depth, session.clan.season ?? session.season ?? 1)} fame)
              </button>
            )}
            <button type="button" className="cq-btn" onClick={onBack}>Back to the clan</button>
          </div>
        </div>
      </div>
      {locked && <p className="cq-note">{locked}</p>}
      {session.fightsLeft === 0 && !unlimited && <p className="cq-note">That's all the fights for today. Come back tomorrow!</p>}
      {(session.fightsLeft > 0 || unlimited) && !awake && <p className="cq-note">Everyone is resting. They wake up tomorrow.</p>}
    </section>
  );
}

/**
 * How the fight went, member by member. `onMines` is given only when the clan can fight again today.
 * Keys: M goes back to the Mines, C back to the clan (not while typing in a box).
 */
/** Where the coins fly to from the middle of the clan, as [x, y] in percent of the stage (fixed, so no shuffle on re-render). */
const COINS: [number, number][] = [[-30, -34], [-18, -48], [-6, -40], [8, -52], [20, -38], [32, -46], [-38, -18], [40, -22], [-24, -60], [26, -62], [0, -66], [-12, -28], [14, -30]];

/**
 * After a fight: the mine's painting fills the stage, the clan stands on it and the rewards burst over them (experience on
 * each member, gold, followers and fame over the clan), with the buttons on the painting (James, 17 Nov 2026).
 * Enter goes back to the Mines when that's open; C goes back to the clan.
 */
export function Results({ summary, members, fame = 0, extra, onDone, onMines, art, top, best, raid }: {
  summary: FightSummary; members: Member[]; fame?: number; extra?: React.ReactNode; onDone: () => void; onMines?: () => void;
  /** A Village Raid: its own title and Banners, and no experience (a raid never changes the heroes). */
  raid?: { title: string; banners: number; rain?: React.ReactNode };
  /** The painting behind it all (the mine depth the clan fought at). */
  art?: { wide?: string; small?: string };
  /** The game's title and the clan's gold, followers and fame, over the top of the painting. */
  top?: React.ReactNode;
  /** The fight's best hit, slammed in under the title. */
  best?: BestNote;
}) {
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  keys.current = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const k = e.key.toLowerCase();
    // Enter on a focused button is that button's own click, so leave it alone.
    if (k === 'enter' && e.target instanceof HTMLButtonElement) return;
    if ((k === 'enter' || k === 'm') && onMines) onMines();
    else if (k === 'c' || (k === 'enter' && !onMines)) onDone();
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const won = summary.result === 'won';
  const title = raid ? raid.title : won ? 'Victory!' : summary.result === 'lost' ? 'A rest is needed' : 'Back safe';
  const rewards = [
    { cls: 'gold', text: `+${summary.gold} gold`, show: summary.gold > 0 },
    { cls: 'banners', text: `+${raid?.banners ?? 0} ${raid?.banners === 1 ? 'Banner' : 'Banners'}`, show: (raid?.banners ?? 0) > 0 },
    { cls: 'followers', text: `+${summary.followers} followers`, show: summary.followers > 0 },
    { cls: 'fame', text: `+${fame} fame`, show: fame > 0 },
  ].filter((r) => r.show);
  const step = (i: number) => ({ '--d': `${(1.3 + i * 0.35).toFixed(2)}s` }) as React.CSSProperties;
  return (
    <>
      <section className={`cq-vstage ${won ? 'is-won' : 'is-plain'} ${art?.wide ? '' : 'is-bare'}`} aria-label="Fight results">
        {art?.wide && (
          <img className="cq-vstage__pic" src={art.wide} srcSet={art.small && art.small !== art.wide ? `${art.small} 800w, ${art.wide} 1600w` : undefined} sizes="(max-width: 1100px) 100vw, 1100px" alt="" />
        )}
        <div className="cq-vstage__glow" aria-hidden="true" />
        {won && <div className="cq-vstage__rays" aria-hidden="true" />}
        {raid?.rain}
        {top}
        <h2 className="cq-vstage__title">{title}</h2>
        {best && (
          <div className={`cq-vbest ${best.isNew ? 'is-new' : ''}`} role="status">
            <span className="cq-vbest__burst" aria-hidden="true" />
            <span className="cq-vbest__label">Best hit</span>
            <strong className="cq-vbest__num">{best.best.amount}!</strong>
            <span className="cq-vbest__text">{best.best.text}</span>
            {best.isNew ? <span className="cq-vbest__new">★ Your best hit today! ★</span> : best.before && <span className="cq-vbest__old">Today's best is still {best.before.amount}</span>}
          </div>
        )}
        {/* The rewards burst out over the clan. Screen readers get the plain line below instead. */}
        <div className="cq-vstage__pops" aria-hidden="true">
          {summary.gold > 0 && COINS.map(([x, y], i) => (
            <span key={i} className="cq-vcoin" style={{ '--x': `${x}%`, '--y': `${y}%`, '--i': i } as React.CSSProperties} />
          ))}
          {rewards.map((r, i) => (
            <span key={r.cls} className={`cq-vpop cq-vpop--${r.cls}`} style={step(members.length + i)}>{r.text}</span>
          ))}
        </div>
        <ul className="cq-vstage__clan">
          {members.map((m, i) => {
            const pic = memberArt(m.race, m.cls, lookOf(m)) ?? memberThumb(m.race, m.cls, lookOf(m));
            return (
              <li key={m.name} className={m.knockedOut && !raid ? 'is-out' : undefined} style={step(i)}>
                {!raid && <span className="cq-vxp" aria-hidden="true">+{summary.xp[i]} XP</span>}
                {summary.levels[i] > 0 && <span className="cq-vlevel" aria-hidden="true">Level up!</span>}
                {pic ? <img className="cq-vstage__hero" src={pic} alt="" /> : <Portrait race={m.race} cls={m.cls} look={lookOf(m)} scale={6} />}
                <span className="cq-vstage__name">{m.name}</span>
                {!raid && <span className="sr-only">{m.name}: +{summary.xp[i]} experience{summary.levels[i] > 0 && `. Level up! Now level ${m.level}`}</span>}
              </li>
            );
          })}
        </ul>
        <div className="cq-vstage__foot">
          <p className="cq-vstage__sum" style={step(members.length + rewards.length)}>
            {rewards.length ? rewards.map((r) => <strong key={r.cls} className={`cq-vchip cq-vchip--${r.cls}`}>{r.text}</strong>) : <span>No gold this time.</span>}
          </p>
          <div className="cq-vstage__row">
            {onMines && <button type="button" className="cq-btn cq-btn--hot" autoFocus onClick={onMines}><kbd>Enter</kbd> Back to the Mines</button>}
            <button type="button" className={onMines ? 'cq-btn' : 'cq-btn cq-btn--hot'} autoFocus={!onMines} onClick={onDone}><kbd>{onMines ? 'C' : 'Enter'}</kbd> Back to the clan</button>
          </div>
        </div>
      </section>
      {extra}
    </>
  );
}
