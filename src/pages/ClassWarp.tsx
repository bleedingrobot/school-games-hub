import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import {
  cancelWarpRequest,
  fetchMyClass,
  joinWarp,
  previewWarp,
  type MyClass,
  type WarpPreview,
} from '../data/classes';
import { FriendlyError } from '../data/profile';
import './classes.css';

type Found = Extract<WarpPreview, { status: 'found' }>;

type Step =
  | { name: 'type' }
  | { name: 'confirm'; found: Found }
  | { name: 'warping'; label: string }
  | { name: 'welcome'; label: string }
  | { name: 'waiting'; label: string };

/** How long the warp animation runs before the welcome. Short and calm. */
export const WARP_MS = 1200;

const NOPE = 'That code didn’t work.';
const SLOW_DOWN = 'That’s a lot of tries. Wait a few minutes, then try again.';

function prefersLessMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * Class Warp: type the code your teacher gave you, see the class (or group) it belongs to, say yes, and you're in.
 * A code only ever puts you in a class; it never shows you anyone else. A wrong code only says it didn't work.
 */
export function ClassWarp() {
  const [mine, setMine] = useState<MyClass | null>(null);
  const [typed, setTyped] = useState('');
  const [step, setStep] = useState<Step>({ name: 'type' });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  const reload = useCallback(async () => {
    try {
      setMine(await fetchMyClass());
    } catch {
      /* the page still works without the line about my class */
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Waiting for a teacher to say yes: look again every few seconds.
  const waitingFor = mine?.waitingFor ?? null;
  useEffect(() => {
    if (!waitingFor) return;
    const timer = window.setInterval(() => void reload(), 8000);
    return () => window.clearInterval(timer);
  }, [waitingFor, reload]);

  // Move focus to the new step's heading so a keyboard or screen-reader user lands on it.
  useEffect(() => {
    if (step.name !== 'type') heading.current?.focus();
  }, [step.name]);

  useEffect(() => {
    if (step.name !== 'warping') return;
    const timer = window.setTimeout(() => setStep({ name: 'welcome', label: step.label }), prefersLessMotion() ? 0 : WARP_MS);
    return () => window.clearTimeout(timer);
  }, [step]);

  async function look(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await previewWarp(typed);
      if (result.status === 'found') setStep({ name: 'confirm', found: result });
      else setMessage(result.status === 'slow-down' ? SLOW_DOWN : NOPE);
    } catch (error) {
      setMessage(error instanceof FriendlyError ? error.message : NOPE);
    } finally {
      setBusy(false);
    }
  }

  async function warp() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await joinWarp(typed);
      if (result.status === 'joined') {
        setStep({ name: 'warping', label: result.name });
        void reload();
      } else if (result.status === 'waiting') {
        setStep({ name: 'waiting', label: result.name });
        void reload();
      } else {
        setStep({ name: 'type' });
        setMessage(result.status === 'slow-down' ? SLOW_DOWN : NOPE);
      }
    } catch (error) {
      setStep({ name: 'type' });
      setMessage(error instanceof FriendlyError ? error.message : NOPE);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await cancelWarpRequest();
      await reload();
      setStep({ name: 'type' });
      setMessage('Your request was cancelled.');
    } catch (error) {
      setMessage(error instanceof FriendlyError ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const where = mine?.className ? `${mine.className}${mine.groupName ? `, ${mine.groupName}` : ''}` : null;

  return (
    <div className="warp">
      <h1 className="page-title" ref={step.name === 'type' ? heading : undefined} tabIndex={step.name === 'type' ? -1 : undefined}>
        🌀 Class Warp
      </h1>

      {step.name === 'type' && (
        <section className="panel warp__panel" aria-labelledby="warp-type">
          <h2 id="warp-type" className="panel__title">
            Join your class
          </h2>
          <p>
            Your teacher has a code for your class. Type it in to warp into your class. You can keep playing all the games
            without one.
          </p>
          {where && (
            <p className="warp__where">
              You’re in <strong>{where}</strong> now. A new code moves you to a different class.
            </p>
          )}
          {mine?.waitingFor && (
            <div className="warp__waiting" role="status">
              <p>
                You asked to join <strong>{mine.waitingFor}</strong>. Your teacher needs to say yes first. You can keep playing.
              </p>
              <button type="button" className="button button--light-outline" disabled={busy} onClick={() => void cancel()}>
                Cancel my request
              </button>
            </div>
          )}
          <form onSubmit={(e) => void look(e)} className="warp__form">
            <label className="warp__label" htmlFor="warp-code">
              Class code
            </label>
            <input
              id="warp-code"
              className="warp__input"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              maxLength={12}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-describedby="warp-help"
              aria-invalid={message === NOPE ? true : undefined}
            />
            <p id="warp-help" className="warp__help">
              It’s 5 letters and numbers, like <span className="warp__example">KM4 TP</span>.
            </p>
            <button type="submit" className="button button--primary" disabled={busy || typed.trim() === ''}>
              Warp!
            </button>
          </form>
          <p className="warp__message" role="alert">
            {message}
          </p>
          <Link to="/" className="warp__back">
            Not now, back to the games
          </Link>
        </section>
      )}

      {step.name === 'confirm' && (
        <section className="panel warp__panel" aria-labelledby="warp-confirm">
          <h2 id="warp-confirm" className="panel__title" ref={heading} tabIndex={-1}>
            {step.found.alreadyIn
              ? `You’re already in ${step.found.name}`
              : step.found.leaving
                ? `Leave ${step.found.leaving} and warp to ${step.found.name}?`
                : `Warp to ${step.found.name}?`}
          </h2>
          {step.found.kind === 'group' && !step.found.alreadyIn && (
            <p>
              This group is in <strong>{step.found.className}</strong>. You’ll join the class and the group.
            </p>
          )}
          {step.found.leaving && (
            <p>All your points and progress come with you. Nothing is lost.</p>
          )}
          {step.found.ask && !step.found.alreadyIn && (
            <p>Your teacher needs to say yes before you join. You can keep playing while you wait.</p>
          )}
          <div className="warp__buttons">
            {!step.found.alreadyIn && (
              <button type="button" className="button button--primary" disabled={busy} onClick={() => void warp()}>
                {step.found.ask ? 'Yes, ask my teacher' : 'Yes, warp!'}
              </button>
            )}
            <button
              type="button"
              className="button button--light-outline"
              onClick={() => {
                setStep({ name: 'type' });
                setTyped('');
              }}
            >
              {step.found.alreadyIn ? 'Back' : 'No, stay where I am'}
            </button>
          </div>
        </section>
      )}

      {step.name === 'warping' && (
        <section className="panel warp__panel warp__stage" aria-label="Warping">
          <div className="warp__portal" aria-hidden="true">
            <span className="warp__ring warp__ring--1" />
            <span className="warp__ring warp__ring--2" />
            <span className="warp__ring warp__ring--3" />
            <span className="warp__core">🌀</span>
          </div>
          <p role="status" className="warp__going">
            Warping…
          </p>
        </section>
      )}

      {step.name === 'welcome' && (
        <section className="panel warp__panel warp__stage" aria-labelledby="warp-welcome">
          <h2 id="warp-welcome" className="panel__title" ref={heading} tabIndex={-1}>
            Welcome to {step.label}!
          </h2>
          <p role="status">You’re in. Your points and progress are all still yours.</p>
          <Link className="button button--play warp__home" to="/">
            Let’s play
          </Link>
        </section>
      )}

      {step.name === 'waiting' && (
        <section className="panel warp__panel" aria-labelledby="warp-waiting">
          <h2 id="warp-waiting" className="panel__title" ref={heading} tabIndex={-1}>
            Asked! Now your teacher says yes.
          </h2>
          <p role="status">
            You asked to join <strong>{step.label}</strong>. You’ll be in as soon as your teacher says yes. You can keep playing.
          </p>
          <Link className="button button--primary" to="/">
            Back to the games
          </Link>
        </section>
      )}
    </div>
  );
}
