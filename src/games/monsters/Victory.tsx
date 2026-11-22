/**
 * The end of a battle, as a celebration over the battle painting: a big "Victory!" slams in, light rays turn,
 * confetti falls, and each monster that earned experience gets its own card where the exp counts up, the bar
 * fills (wrapping round with a "Level up!" stamp for every level gained) and any new form flashes in.
 * Enter (or the button) carries on. A tired team gets a calm version with no confetti.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { expForLevel, type Monster } from '../../../shared/monsters/rules';
import { MonsterArt } from './art/MonsterArt';
import { scenePic } from './art/painted';
import { nameOf } from './text';
import './victory.css';

export type EndPhase = 'won' | 'caught' | 'lost' | 'ran';

export interface VictoryProps {
  phase: EndPhase;
  /** The team as it came into the battle, and as it leaves (same order; a caught monster may be added at the end). */
  before: readonly Monster[];
  after: readonly Monster[];
  caught: string | null;
  questions: number;
  /** 0 in tests: everything shows at once. */
  timeScale: number;
  onLevelUp?: () => void;
  onContinue: () => void;
}

const shareOf = (level: number, exp: number) => {
  const from = expForLevel(level);
  const to = expForLevel(level + 1);
  return to > from ? Math.max(0, Math.min(1, (exp - from) / (to - from))) : 1;
};

/** One monster's exp: the number counts up while the bar fills, wrapping round once per level gained. */
function ExpCard({ before, after, delay, timeScale, onLevelUp }: { before: Monster; after: Monster; delay: number; timeScale: number; onLevelUp?: () => void }) {
  const gained = Math.max(0, after.exp - before.exp);
  const levels = Math.max(0, after.level - before.level);
  const finalShare = shareOf(after.level, after.exp);
  const instant = timeScale === 0;
  const [level, setLevel] = useState(instant ? after.level : before.level);
  const [share, setShare] = useState(instant ? finalShare : shareOf(before.level, before.exp));
  const [snap, setSnap] = useState(false);
  const [count, setCount] = useState(instant ? gained : 0);
  const [stamp, setStamp] = useState(instant ? levels : 0);
  const [grown, setGrown] = useState(instant || before.species === after.species);
  const levelUp = useRef(onLevelUp);
  levelUp.current = onLevelUp;

  useEffect(() => {
    if (instant) return;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms * timeScale));
    // Count the number up over the whole fill.
    const fillMs = 700 + levels * 750;
    let raf = 0;
    at(delay, () => {
      const t0 = performance.now();
      const tick = () => {
        const p = Math.min(1, (performance.now() - t0) / (fillMs * timeScale));
        setCount(Math.round(gained * (1 - (1 - p) ** 2)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    let t = delay;
    for (let i = 0; i < levels; i++) {
      at(t, () => { setSnap(false); setShare(1); });
      t += 650;
      at(t, () => {
        setSnap(true);
        setShare(0);
        setLevel((l) => l + 1);
        setStamp((s) => s + 1);
        levelUp.current?.();
      });
      t += 100;
    }
    at(t, () => { setSnap(false); setShare(finalShare); });
    if (before.species !== after.species) at(t + 900, () => setGrown(true));
    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <li className={`mv-card${stamp ? ' is-levelled' : ''}`} style={{ '--d': `${delay}ms` } as CSSProperties}>
      <div className={`mv-card__art${grown && before.species !== after.species ? ' is-grown' : ''}`}>
        <MonsterArt species={grown ? after.species : before.species} shiny={after.shiny} size={116} />
        {stamp > 0 && <span key={stamp} className="mv-stamp">Level up!</span>}
      </div>
      <strong className="mv-card__name">{nameOf(grown ? after.species : before.species)}</strong>
      <span key={level} className={`mv-card__level${level > before.level ? ' is-up' : ''}`}>Lv {level}</span>
      <div className="mv-bar" role="progressbar" aria-label={`${nameOf(after.species)} experience`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(finalShare * 100)}>
        <span className={snap ? 'is-snap' : undefined} style={{ width: `${share * 100}%` }} />
      </div>
      <span className="mv-gain">+{count} exp</span>
      {grown && before.species !== after.species && <span className="mv-evo">Grew into {nameOf(after.species)}!</span>}
    </li>
  );
}

const CONFETTI = Array.from({ length: 36 }, (_, i) => i);
const COLOURS = ['#fde047', '#f472b6', '#60a5fa', '#4ade80', '#fb923c', '#c084fc'];

export function Victory({ phase, before, after, caught, questions, timeScale, onLevelUp, onContinue }: VictoryProps) {
  const happy = phase === 'won' || phase === 'caught';
  const title = phase === 'won' ? 'Victory!' : phase === 'caught' ? 'Caught!' : phase === 'ran' ? 'Got away!' : 'Time to rest';
  const earners = before
    .map((b, i) => ({ b, a: after[i] }))
    .filter(({ b, a }) => a && a.exp > b.exp);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => button.current?.focus({ preventScroll: true }), []);

  // The painted celebration field (a trophy on a hilltop, bunting and fireworks) behind a win. Decoration only.
  const pic = scenePic('victory');
  const picStyle = (happy && pic.wide ? { '--mv-wide': `url("${pic.wide}")`, '--mv-small': `url("${pic.small}")` } : undefined) as CSSProperties | undefined;

  return (
    <div className={`mv${happy ? ' mv--happy' : ' mv--calm'}${picStyle ? ' has-art' : ''}`} style={picStyle} role="dialog" aria-modal="true" aria-label={title}>
      {happy && <div className="mv-rays" aria-hidden="true" />}
      {happy && (
        <div className="mv-confetti" aria-hidden="true">
          {CONFETTI.map((i) => (
            <i key={i} style={{ '--x': `${(i * 37) % 100}%`, '--t': `${(i % 9) * 0.22}s`, '--c': COLOURS[i % COLOURS.length], '--r': `${(i * 53) % 360}deg` } as CSSProperties} />
          ))}
        </div>
      )}
      <h2 className="mv-title" data-text={title}>{title}</h2>
      {phase === 'lost' && <p className="mv-note">Your monsters are tired, so you hurry back to rest. They’re healed, and you keep everything.</p>}
      {caught && (
        <div className="mv-caught">
          <MonsterArt species={caught} size={130} />
          <strong>{nameOf(caught)} is yours!</strong>
        </div>
      )}
      {earners.length > 0 && (
        <ul className="mv-cards">
          {earners.map(({ b, a }, i) => (
            <ExpCard key={i} before={b} after={a} delay={500 + i * 350} timeScale={timeScale} onLevelUp={onLevelUp} />
          ))}
        </ul>
      )}
      <p className="mv-questions">
        <span aria-hidden="true">★</span> {questions} question{questions === 1 ? '' : 's'} answered
      </p>
      <button ref={button} type="button" className="mb-btn mb-btn--primary mv-go" onClick={onContinue} aria-keyshortcuts="Enter">
        Continue <kbd aria-hidden="true">Enter</kbd>
      </button>
    </div>
  );
}
