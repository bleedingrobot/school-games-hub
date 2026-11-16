/**
 * Dragon Maths, an arena clash on the big arena painting (James, 17 Nov 2026): Hammer, Sword or Net each round, then a
 * maths question that powers the attack. The same screen plays a practice clash against a computer hero (worked out
 * here, pays nothing) and a live clash against a classmate (worked out by the server). It only shows rounds: whoever
 * holds the clash hands it the rounds played so far and is told which attack the pupil picked.
 *
 * The circle of attacks is always on screen, so it's clear what beats what. Each new round plays out in two beats: both
 * attacks slam up over the heroes with the line that says who won the clash, then both heroes swing and the hits pop.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CLASH_MOVES, CLASH_ROUNDS, MOVE_INFO, clashLine, replayClash, type ClashMove, type ClashPick, type ClashSide } from '../../../shared/lord/clash';
import type { HeroClass } from '../../../shared/lord/types';
import { BigStage, Bar, COINS, FloatNum, type Float } from './Fight';
import { HeroSprite } from './Sprite';
import './clash.css';

export interface ClashHero {
  name: string;
  heroClass: HeroClass;
  look?: string;
}

/** The ending, when it isn't simply played out (someone left, the teacher switched it off). */
export interface ClashEnding {
  title: string;
  line?: string;
  won?: boolean;
}

const ICONS_MS = 1000;
const HITS_MS = 1500;

/** The circle: Hammer smashes Sword, Sword cuts Net, Net tangles Hammer. */
export function ClashCircle({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`lord-clash__circle${compact ? ' is-compact' : ''}`} aria-label="Hammer smashes Sword. Sword cuts Net. Net tangles Hammer.">
      {CLASH_MOVES.map((m) => (
        <span key={m} className="lord-clash__rule" aria-hidden="true">
          <b>{MOVE_INFO[m].icon}</b> {MOVE_INFO[m].verb} <b>{MOVE_INFO[MOVE_INFO[m].beats].icon}</b>
        </span>
      ))}
    </p>
  );
}

export function ClashScreen({ me, them, seat, picks, waiting, onPick, prize = 0, note, ending, buttons, onLeave, secondsLeft, tries = 0, theirCheer, problem }: {
  me: ClashHero;
  them: ClashHero & { computer?: boolean };
  /** Which side of the rounds is this pupil's. */
  seat: ClashSide;
  /** The rounds played so far (side 0's pick, side 1's). */
  picks: [ClashPick, ClashPick][];
  /** This pupil has picked for the next round and is waiting for the other side. */
  waiting: boolean;
  onPick: (move: ClashMove) => void;
  /** This pupil's gold for the clash, once it's over. */
  prize?: number;
  /** A line under the result ("Practice: no gold"). */
  note?: string;
  ending?: ClashEnding | null;
  /** What to offer once it's over (Fight again, Back). */
  buttons: ReactNode;
  /** Give up (or go back) while it's being played. */
  onLeave: () => void;
  /** Seconds left to pick and answer this round (live clashes). */
  secondsLeft?: number | null;
  /** Goes up when a pick couldn't be sent, so the attack buttons come back. */
  tries?: number;
  /** What the other side cheered at the end ("Good fight!"). */
  theirCheer?: string | null;
  /** A short line when something went wrong ("We couldn't reach the server"). */
  problem?: string | null;
}) {
  const other: ClashSide = seat === 0 ? 1 : 0;
  const still = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // Rounds fully shown, and how far the next one has got: 'icons' (both attacks up) then 'hits'.
  const [shown, setShown] = useState(still ? picks.length : 0);
  const [beat, setBeat] = useState<'icons' | 'hits' | null>(null);
  const [picked, setPicked] = useState<ClashMove | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (shown >= picks.length) return;
    if (still) { setShown(picks.length); setBeat(null); return; }
    setBeat('icons');
    timers.current = [
      window.setTimeout(() => setBeat('hits'), ICONS_MS),
      window.setTimeout(() => { setBeat(null); setShown((n) => n + 1); }, ICONS_MS + HITS_MS),
    ];
    return () => timers.current.forEach((t) => window.clearTimeout(t));
  }, [picks.length, shown, still]);

  // A new round arrived: the pick made for it is spent.
  useEffect(() => setPicked(null), [picks.length, tries]);

  const revealing = beat !== null ? picks[shown] : null;
  const state = useMemo(() => replayClash(picks.slice(0, shown + (beat === 'hits' ? 1 : 0))), [picks, shown, beat]);
  const whole = useMemo(() => replayClash(picks), [picks]);
  const done = !!ending || (whole.over && shown >= picks.length);
  const won = ending ? !!ending.won : whole.winner === seat;
  const draw = !ending && whole.over && whole.winner === null;
  const round = beat ? shown + 1 : picks.length + 1;

  const floats: Float[] = [];
  if (beat === 'hits' && revealing) {
    const r = state.rounds[state.rounds.length - 1];
    floats.push({ id: shown * 2, side: 'foe', text: `${r.hits[seat]}`, tone: r.clash === seat ? 'crit' : 'hit', delay: 0 });
    floats.push({ id: shown * 2 + 1, side: 'me', text: `${r.hits[other]}`, tone: r.clash === other ? 'crit' : 'hit', delay: 250 });
  }
  const myMove = revealing ? revealing[seat].move : picked;
  const theirMove = revealing ? revealing[other].move : null;
  const clashWinner = revealing ? (revealing[seat].move === revealing[other].move ? 'tie' : replayClash([revealing]).rounds[0].clash === seat ? 'me' : 'them') : null;

  function pick(move: ClashMove) {
    if (waiting || picked || beat || done) return;
    setPicked(move);
    onPick(move);
  }

  const title = ending?.title ?? (draw ? 'A draw!' : won ? 'Victory!' : 'Not this time');
  const line = ending?.line ?? (draw ? 'Neither hero could win it. Well fought!' : won ? `You beat ${them.name}!` : `${them.name} won this one. Well fought!`);
  const said = revealing && beat === 'hits'
    ? `${clashLine(revealing[seat].move, revealing[other].move)} You hit for ${state.rounds[state.rounds.length - 1].hits[seat]}, ${them.name} hits for ${state.rounds[state.rounds.length - 1].hits[other]}.`
    : done ? `${title} ${line}` : waiting || picked ? `Waiting for ${them.name}.` : `Round ${round}. Pick your attack.`;

  return (
    <BigStage scene="arena" label="Arena clash" className={`lord-fight lord-arena lord-clash${done ? ` is-over is-${won ? 'won' : 'lost'}` : ''}`}>
      <div className="lord-big__hud">
        <div className="lord-big__side lord-big__side--me">
          <h2 className="lord-big__name">You</h2>
          <Bar value={state.hp[seat]} max={50} label="Your health" side="me" />
        </div>
        <div className="lord-clash__round" aria-hidden="true">
          {!done && (round <= CLASH_ROUNDS ? `Round ${round} of ${CLASH_ROUNDS}` : 'Extra round!')}
          {!done && secondsLeft != null && !waiting && !picked && !beat && <small className={secondsLeft <= 10 ? 'is-low' : undefined}>{secondsLeft}s</small>}
        </div>
        <div className="lord-big__side lord-big__side--foe">
          <h3 className="lord-big__name">{them.name}</h3>
          <Bar value={state.hp[other]} max={50} label={`${them.name}’s health`} side="foe" />
          {them.computer && <div className="lord-big__chips"><span className="lord-chip">computer hero</span></div>}
        </div>
      </div>

      {!done && <ClashCircle compact />}

      <div className="lord-big__floor">
        <div className={`lord-big__fig lord-big__fig--me${done && !won && !draw ? ' is-down' : ''}`}>
          {myMove && (
            <span key={`m${shown}${myMove}`} className={`lord-clash__move${clashWinner === 'me' ? ' is-win' : clashWinner === 'them' ? ' is-lose' : ''}${!revealing ? ' is-ready' : ''}`} aria-hidden="true">
              {MOVE_INFO[myMove].icon}
            </span>
          )}
          <div key={`me${shown}${beat}`} className={`lord-big__body${beat === 'hits' ? ' lord-lunge-r lord-hit' : ''}`}>
            <HeroSprite heroClass={me.heroClass} look={me.look} scale={8} label="" />
          </div>
          {floats.filter((f) => f.side === 'me').map((f) => <FloatNum key={f.id} f={f} />)}
        </div>
        <div className={`lord-big__fig lord-big__fig--foe lord-arena__them${done && won ? ' is-down' : ''}`}>
          {revealing && (
            <span key={`t${shown}`} className={`lord-clash__move${clashWinner === 'them' ? ' is-win' : clashWinner === 'me' ? ' is-lose' : ''}`} aria-hidden="true">
              {theirMove ? MOVE_INFO[theirMove].icon : '💤'}
            </span>
          )}
          {!revealing && !done && (waiting || picked) && <span className="lord-clash__think" aria-hidden="true">?</span>}
          <div key={`foe${shown}${beat}`} className={`lord-big__body${beat === 'hits' ? ' lord-lunge-l lord-hit' : ''}`}>
            <HeroSprite heroClass={them.heroClass} look={them.look} scale={8} label={them.name} />
          </div>
          {floats.filter((f) => f.side === 'foe').map((f) => <FloatNum key={f.id} f={f} />)}
        </div>
      </div>

      {revealing && (
        <p key={`l${shown}`} className={`lord-clash__line${clashWinner === 'me' ? ' is-me' : clashWinner === 'them' ? ' is-them' : ''}`} aria-hidden="true">
          {clashLine(revealing[seat].move, revealing[other].move)}
        </p>
      )}

      {done && (
        <div className="lord-end">
          {won && <div className="lord-end__rays" aria-hidden="true" />}
          <p className="lord-end__title">{title}</p>
          {line && <p className="lord-end__line">{line}</p>}
          {prize > 0 && (
            <p className="lord-end__pops"><span className="lord-pop lord-pop--gold" style={{ '--d': '0.45s' } as CSSProperties}>+{prize} gold</span></p>
          )}
          {note && <p className="lord-end__line lord-clash__note">{note}</p>}
          {theirCheer && <p className="lord-clash__cheer">{them.name}: “{theirCheer}”</p>}
          {prize > 0 && (
            <div className="lord-end__coins" aria-hidden="true">
              {COINS.map((c) => <span key={c.i} style={{ '--i': c.i, '--x': c.x, '--y': c.y } as CSSProperties} />)}
            </div>
          )}
        </div>
      )}

      {problem && !done && <p className="lord-clash__problem" role="alert">{problem}</p>}
      <p className="lord-sr" aria-live="polite">{said}</p>

      <div className="lord-big__bar" role="group" aria-label={done ? 'Next' : 'Pick your attack'}>
        {done ? buttons : waiting || picked || beat ? (
          <>
            <p className="lord-clash__wait" role="status">{beat ? '' : `Waiting for ${them.name}…`}</p>
            {!beat && <button type="button" className="lord-btn lord-btn--glass" onClick={onLeave}>Give up</button>}
          </>
        ) : (
          <>
            {CLASH_MOVES.map((m, i) => (
              <button key={m} type="button" className={`lord-btn lord-btn--hot lord-btn--big lord-clash__pick lord-clash__pick--${m}`} autoFocus={i === 0} onClick={() => pick(m)}>
                <span className="lord-clash__icon" aria-hidden="true">{MOVE_INFO[m].icon}</span> {MOVE_INFO[m].name}
                <small>{MOVE_INFO[m].verb} {MOVE_INFO[MOVE_INFO[m].beats].name}</small>
              </button>
            ))}
            <button type="button" className="lord-btn lord-btn--glass" onClick={onLeave}>Give up</button>
          </>
        )}
      </div>
    </BigStage>
  );
}
