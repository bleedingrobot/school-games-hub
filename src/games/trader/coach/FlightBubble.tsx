/** First Flight's bubble (docs/TRADER-HINTS-PLAN.md, section 2): Bolt's words for this step, docked at the bottom. */
import { useEffect, useState } from 'react';
import { COACH_NAME } from '../text';
import { BoltFace } from './CoachBar';
import { FLIGHT_STEPS, type FlightStep } from './flight';

export function FlightBubble({ step, top, onAck, onShow, onSkip }: {
  step: FlightStep;
  /** Dock at the top instead, so the bubble never covers the thing it points at. */
  top: boolean;
  onAck: (id: FlightStep['id']) => void;
  onShow: (target: string) => void;
  onSkip: () => void;
}) {
  const [asking, setAsking] = useState(false);
  useEffect(() => setAsking(false), [step.id]);
  useEffect(() => {
    if (!asking) return;
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setAsking(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [asking]);
  return (
    <aside className={`st-flight ${top ? 'st-flight--top' : ''}`} aria-label="First Flight">
      <BoltFace size={44} />
      <div className="st-flight__body">
        <p className="st-flight__step">First Flight · step {step.n} of {FLIGHT_STEPS}</p>
        {asking ? (
          <>
            <p className="st-flight__say" role="status">Sure? You can replay First Flight from the title screen.</p>
            <div className="st-flight__btns">
              <button type="button" className="st-btn st-btn--small st-btn--primary" onClick={onSkip}>Yes, skip it</button>
              <button type="button" className="st-btn st-btn--small" onClick={() => setAsking(false)}>Keep flying</button>
            </div>
          </>
        ) : (
          <>
            <p className="st-flight__say" role="status" aria-live="polite"><strong>{COACH_NAME}:</strong> {step.say}</p>
            <div className="st-flight__btns">
              {step.button && <button type="button" className="st-btn st-btn--small st-btn--primary" onClick={() => onAck(step.id)}>{step.button}</button>}
              {!step.button && step.target && <button type="button" className="st-btn st-btn--small" onClick={() => onShow(step.target as string)}>Show me</button>}
              {step.id !== 'profit' && <button type="button" className="st-btn st-btn--small st-flight__skip" onClick={() => setAsking(true)}>Skip First Flight</button>}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

/**
 * Keep the thing First Flight is talking about lit up until the step changes (unlike "Show me", which glows for a few
 * seconds). Uses an attribute React doesn't own, so a button's own class changes never wipe it. Gives the lit element.
 */
export function holdLight(root: HTMLElement | null, name: string | undefined): HTMLElement | null {
  if (!root) return null;
  for (const old of root.querySelectorAll('[data-flight-lit]')) old.removeAttribute('data-flight-lit');
  if (!name) return null;
  const el = root.querySelector<HTMLElement>(`[data-coach="${name}"]`);
  el?.setAttribute('data-flight-lit', '');
  return el;
}
