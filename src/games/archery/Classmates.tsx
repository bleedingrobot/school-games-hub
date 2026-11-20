/**
 * Finding someone to fight (docs/ARCHERY-PLAN.md, section 7, Stage 6), inside the game: the players at school who have
 * Archery Challenge open right now (display names only; my class first, then other classes, docs/plans/play-anyone), a challenge sent with the world picked,
 * the pop-up when someone challenges you, and the waits in between ("Waiting for Mia to say yes…").
 */
import { useEffect, useRef, useState } from 'react';
import { ClassTag, SchoolPlayerList } from '../../components/SchoolPlayerList';
import { starPlayer } from '../../data/lobbyStars';
import type { Ask, Classmate } from '../../../shared/archery/duel';
import { SNOOZE_MS } from '../../../shared/archery/config';
import { WORLD_IDS, type WorldId } from '../../../shared/archery/types';
import { WORLD_HINTS, WORLD_NAMES } from './text';
import { KeyBadge } from '../../kit';

/** Seconds until an ISO time, by the server's clock (never below 0), ticking once a second. */
function useSecondsUntil(deadline: string, serverNow: () => number): number {
  const left = () => Math.max(0, Math.ceil((Date.parse(deadline) - serverNow()) / 1000));
  const [secs, setSecs] = useState(left);
  useEffect(() => {
    setSecs(left());
    const timer = setInterval(() => setSecs(left()), 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline]);
  return secs;
}

export function ClassmatesScreen({ online, offline, world, sending, problem, onWorld, onChallenge, onRefresh, onBack }: {
  /** Null while the list is still coming. */
  online: Classmate[] | null;
  offline: boolean;
  world: WorldId;
  sending: boolean;
  problem: string;
  onWorld: (w: WorldId) => void;
  onChallenge: (who: Classmate) => void;
  onRefresh: () => void;
  onBack: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="ar-page" aria-labelledby="ar-mates-title">
      <div className="ar-page__head">
        <h2 id="ar-mates-title" ref={heading} tabIndex={-1}>Challenge a friend</h2>
        <button type="button" className="button button--light ar-btn" data-key="esc" onClick={onBack}>Back</button>
      </div>
      <p>One round, one turn each. Win the round to win the fight! You both bring whatever you've packed.</p>
      <h3>1. Where?</h3>
      <div className="ar-choices">
        {WORLD_IDS.map((w, i) => (
          <button key={w} type="button" className={`button button--light ar-btn ar-choice ar-choice--${w}`} data-key={String(i + 1)} aria-pressed={world === w} onClick={() => onWorld(w)}>
            <KeyBadge k={String(i + 1)} />
            <b>{WORLD_NAMES[w]}</b>
            <span>{WORLD_HINTS[w]}</span>
          </button>
        ))}
      </div>
      <h3>2. Who?</h3>
      {problem && <p className="ar-problem" role="alert">{problem}</p>}
      {online === null ? (
        <p className="ar-help" role="status">{offline ? 'The school server could not be reached. Check the Wi-Fi.' : 'Looking for players…'}</p>
      ) : online.length === 0 ? (
        <p className="ar-help" role="status">Nobody else has Archery Challenge open right now. Ask a friend to open it, then look again.</p>
      ) : (
        <SchoolPlayerList
          people={online}
          onStar={starPlayer}
          label="Players in Archery Challenge now"
          listClassName="ar-mates"
          itemClassName="ar-mate"
          row={(c) => (
            <>
              <span className="ar-mate__name">{c.name}<ClassTag player={c} /></span>
              {c.snoozed ? <span className="ar-mate__busy">Not now</span> : c.busy ? <span className="ar-mate__busy">In a fight</span> : (
                <button type="button" className="button button--play ar-btn" disabled={sending} aria-label={`Challenge ${c.name} in the ${WORLD_NAMES[world]}`} onClick={() => onChallenge(c)}>
                  Challenge
                </button>
              )}
            </>
          )}
        />
      )}
      <p className="ar-page__go">
        <button type="button" className="button button--light ar-btn" onClick={onRefresh}>Look again</button>
      </p>
    </section>
  );
}

/** Someone has challenged you: a pop-up over whatever screen you're on, answered with a tap or the keyboard. */
export function ChallengeAsk({ ask, serverNow, busy, problem, onAccept, onDecline, onSnooze, onGone }: {
  ask: Ask;
  serverNow: () => number;
  busy: boolean;
  problem: string;
  onAccept: () => void;
  onDecline: () => void;
  /** Say no, and they can't challenge you again for SNOOZE_MS. */
  onSnooze: () => void;
  /** Its minute ran out. */
  onGone?: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [ask.duel]);
  const secs = useSecondsUntil(ask.deadline, serverNow);
  useEffect(() => {
    if (secs <= 0) onGone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secs <= 0]);
  return (
    <div className="ar-ask" role="alertdialog" aria-modal="true" aria-labelledby="ar-ask-title" aria-describedby="ar-ask-words">
      <div className="ar-ask__card">
        <h2 id="ar-ask-title" ref={heading} tabIndex={-1}>{ask.from} challenges you!</h2>
        <p id="ar-ask-words">A fight in the {WORLD_NAMES[ask.world]}: one round, one turn each. Answer within {secs} seconds.</p>
        {problem && <p className="ar-problem" role="alert">{problem}</p>}
        <div className="ar-row">
          <button type="button" className="button button--play ar-btn" data-key="enter" disabled={busy} onClick={onAccept}>Accept</button>
          <button type="button" className="button button--light ar-btn" disabled={busy} onClick={onDecline}>Say no</button>
          <button type="button" className="button button--light ar-btn" disabled={busy} onClick={onSnooze}>Snooze {ask.from} for {SNOOZE_MS / 60_000} min</button>
        </div>
      </div>
    </div>
  );
}

/** A wait between screens: for an answer, or for the other player to pack. */
export function DuelWait({ title, words, deadline, serverNow, onCancel, cancelLabel, onTimeUp }: {
  title: string;
  words: string;
  deadline: string;
  serverNow: () => number;
  onCancel: () => void;
  cancelLabel: string;
  /** The wait ran out: ask the server again (it ends the challenge or the packing). */
  onTimeUp?: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [title]);
  const secs = useSecondsUntil(deadline, serverNow);
  useEffect(() => {
    if (secs > 0) return;
    // A moment after the server's deadline, so it has passed there too.
    const timer = setTimeout(() => onTimeUp?.(), 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secs <= 0]);
  return (
    <section className="ar-page ar-page--narrow" aria-labelledby="ar-wait-title">
      <h2 id="ar-wait-title" ref={heading} tabIndex={-1}>{title}</h2>
      <p>{words}</p>
      <p className="ar-help" role="timer" aria-label={`${secs} seconds left`}>{secs} seconds left</p>
      <p className="ar-page__go">
        <button type="button" className="button button--light ar-btn" data-key="esc" onClick={onCancel}>{cancelLabel}</button>
      </p>
    </section>
  );
}

/** A challenge that never became a fight (they said no, it ran out, or it was called off). */
export function DuelNotStarted({ title, words, onBack }: { title: string; words: string; onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [title]);
  return (
    <section className="ar-page ar-page--narrow" aria-labelledby="ar-nostart-title">
      <h2 id="ar-nostart-title" ref={heading} tabIndex={-1}>{title}</h2>
      <p>{words}</p>
      <p className="ar-page__go">
        <button type="button" className="button button--play ar-btn" data-key="enter" onClick={onBack}>OK</button>
      </p>
    </section>
  );
}
