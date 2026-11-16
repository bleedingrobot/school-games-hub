import { bossAt } from '../../../shared/clans/fight';
import { nextBossFame } from '../../../shared/clans/rewards';
import { CONFIG } from '../../../shared/clans/config';
import { UNLIMITED_LABEL } from '../../../shared/unlimited';
import { fightsLabel } from './fightView';
import { useEffect, useRef, useState } from 'react';
import { averageLevel, hintFor, type FightSummary, type Session } from './session';
import { depthHint } from '../../../shared/clans/character';
import { mineArt, sceneArt, zoneScene } from './art';
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
export function Mines({ session, onDepth, onGo, onBack, locked }: { session: Session; onDepth: (d: number) => void; onGo: (boss: boolean) => void; onBack: () => void; locked?: string }) {
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
  const own = mineArt(session.depth);
  const art = own.wide ? own : sceneArt(zoneScene(zone));
  return (
    <section className="cq-mines" aria-label="The Mines">
      <div className={`cq-mines__stage ${art.wide ? '' : 'is-plain'}`}>
        {art.wide && (
          <img key={art.wide} className="cq-mines__pic" src={art.wide} srcSet={art.small && art.small !== art.wide ? `${art.small} 800w, ${art.wide} 1600w` : undefined} sizes="(max-width: 1100px) 100vw, 1100px" alt="" />
        )}
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

/** How the fight went, member by member. `onMines` is given only when the clan can fight again today. */
export function Results({ summary, members, fame = 0, extra, onDone, onMines }: { summary: FightSummary; members: Member[]; fame?: number; extra?: React.ReactNode; onDone: () => void; onMines?: () => void }) {
  return (
    <section className="cq-results" aria-label="Fight results">
      <h2>{summary.result === 'won' ? 'Victory!' : summary.result === 'lost' ? 'A rest is needed' : 'Back safe'}</h2>
      {extra}
      <p>Gold: <strong>+{summary.gold}</strong>{summary.followers > 0 && <> · Followers: <strong>+{summary.followers}</strong></>}{fame > 0 && <> · Fame: <strong>+{fame}</strong></>}</p>
      <ul className="cq-xp">
        {members.map((m, i) => (
          <li key={m.name}>
            {m.name}: +{summary.xp[i]} experience{summary.levels[i] > 0 && <strong className="cq-levelup"> · Level up! Now level {m.level}</strong>}
          </li>
        ))}
      </ul>
      <div className="cq-actions">
        {onMines && <button type="button" className="cq-btn cq-btn--hot" autoFocus onClick={onMines}>Back to the Mines</button>}
        <button type="button" className={onMines ? 'cq-btn' : 'cq-btn cq-btn--hot'} autoFocus={!onMines} onClick={onDone}>Back to the clan</button>
      </div>
    </section>
  );
}
