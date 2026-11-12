/**
 * "What year are you in at school?" A pupil sees it once, on their first visit after signing in (or the next visit, for
 * pupils who joined before 13 Nov 2026), before the hub. Big buttons, Bella reads it aloud, and a check step so a mis-tap
 * isn't saved: once saved, only a teacher can change it (Students tab). "I'm not sure" lets them play and asks again
 * tomorrow; the teacher sees "Not set" meanwhile.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { HearAgain } from '../kit/HearAgain';
import { fetchMyYear, PUPIL_YEARS, saveMyYear } from '../data/years';
import { speak, stopSpeaking, useReadAloud } from '../speech';
import { VOICE_FOLDER, WORDS } from './words';
import './yearQuestion.css';

const LATER_KEY = 'sgh-year-later';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });

function askedToWaitToday(): boolean {
  try {
    return localStorage.getItem(LATER_KEY) === today();
  } catch {
    return false;
  }
}

function waitUntilTomorrow(): void {
  try {
    localStorage.setItem(LATER_KEY, today());
  } catch {
    // Storage blocked: they'll be asked again next visit.
  }
}

/**
 * Shows the question instead of `children` when a signed-in pupil has no year saved. Anything that goes wrong
 * (offline, slow, a teacher) shows the page as normal: the question never blocks a pupil from playing.
 */
export function YearGate({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const isStudent = profile?.role === 'student';
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    if (!isStudent || askedToWaitToday()) return;
    let current = true;
    fetchMyYear().then(
      (mine) => current && setAsk(mine.student && mine.year === null),
      () => {},
    );
    return () => {
      current = false;
    };
  }, [isStudent, profile?.id]);

  if (!ask) return <>{children}</>;
  return <YearQuestion onDone={() => setAsk(false)} />;
}

type Step = { name: 'pick' } | { name: 'check'; year: number } | { name: 'saving'; year: number } | { name: 'done'; line: string };

export function YearQuestion({ onDone }: { onDone: () => void }) {
  const { on: readAloud } = useReadAloud({ defaultOn: true });
  const [step, setStep] = useState<Step>({ name: 'pick' });
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const say = (text: string, onEnd?: () => void) => (readAloud ? speak(text, VOICE_FOLDER, onEnd) : onEnd?.());
  const line = step.name === 'pick' ? WORDS.question : step.name === 'done' ? step.line : WORDS.check(step.year);

  // Read each new step out (when read-aloud is on) and move focus to it, so a screen reader hears it too.
  useEffect(() => {
    heading.current?.focus();
    if (step.name === 'saving') return;
    if (step.name === 'done') {
      const timer = window.setTimeout(onDone, 2500);
      say(step.line);
      return () => window.clearTimeout(timer);
    }
    say(line);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.name]);

  useEffect(() => () => stopSpeaking(), []);

  async function save(year: number) {
    setStep({ name: 'saving', year });
    setError(null);
    try {
      await saveMyYear(year);
      setStep({ name: 'done', line: WORDS.thanks });
    } catch (e) {
      // Already saved (another tab, or a teacher set it): nothing more to ask.
      if (e instanceof Error && e.message.startsWith('Your year is saved')) {
        onDone();
        return;
      }
      setError(e instanceof Error ? e.message : 'We couldn’t save that. Please try again.');
      setStep({ name: 'check', year });
    }
  }

  return (
    <section className="panel year-q" aria-labelledby="year-q-title">
      <div className="year-q__emoji" aria-hidden="true">
        🎒
      </div>
      <h1 id="year-q-title" className="year-q__title" ref={heading} tabIndex={-1}>
        {step.name === 'pick' ? WORDS.question : step.name === 'done' ? step.line : `Year ${step.year}. Is that right?`}
      </h1>

      {step.name === 'pick' && (
        <>
          <div className="year-q__years" role="group" aria-label="Your year at school">
            {PUPIL_YEARS.map((y) => (
              <button key={y} type="button" className="year-q__year" aria-label={`Year ${y}`} onClick={() => setStep({ name: 'check', year: y })}>
                <span className="year-q__word">Year</span>
                <span className="year-q__number">{y}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="button button--light year-q__unsure"
            onClick={() => {
              waitUntilTomorrow();
              setStep({ name: 'done', line: WORDS.later });
            }}
          >
            🤔 {WORDS.notSure}
          </button>
        </>
      )}

      {(step.name === 'check' || step.name === 'saving') && (
        <div className="year-q__check">
          <p className="year-q__big" aria-hidden="true">
            {step.year}
          </p>
          <div className="year-q__answers">
            <button
              type="button"
              className="button button--primary year-q__yes"
              disabled={step.name === 'saving'}
              onClick={() => void save(step.year)}
            >
              {step.name === 'saving' ? 'Saving…' : `👍 ${WORDS.yes}`}
            </button>
            <button type="button" className="button button--light" disabled={step.name === 'saving'} onClick={() => setStep({ name: 'pick' })}>
              ↩️ {WORDS.back}
            </button>
          </div>
          {error && (
            <p className="year-q__error" role="alert">
              {error}
            </p>
          )}
        </div>
      )}

      {step.name !== 'saving' && (
        <div className="year-q__hear">
          <HearAgain prefix="year-q" label="Hear it again" onHear={() => speak(line, VOICE_FOLDER)} />
        </div>
      )}
      {step.name === 'done' && (
        <button type="button" className="button button--primary" onClick={onDone}>
          Let’s play ▶
        </button>
      )}
    </section>
  );
}
