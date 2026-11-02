/**
 * Bolt's help panel (docs/TRADER-HINTS-PLAN.md, section 6), opened by the 🤖 Help button in the top strip at any help
 * level. It sits beside the game and never traps focus: Escape or ✕ closes it and focus goes back to the Help button.
 */
import { useEffect, useRef } from 'react';
import { COACH_NAME } from '../text';
import { BoltFace } from './CoachBar';
import { HELP_LEVELS, type HelpLevel } from './level';
import type { NextStep } from './nextStep';
import { screenHelp, wordList, type HelpScreen } from './words';

export function HelpPanel({ step, screen, jumpsPerDay, tips, level, picked, onLevel, onShow, onReplay, onClose }: {
  /** Bolt's next step now (null in an encounter or a result screen). */
  step: NextStep | null;
  screen: HelpScreen;
  jumpsPerDay: number;
  /** The first-time tips already shown, to read again. */
  tips: string[];
  level: HelpLevel;
  /** The pupil's own pick (null: Bolt picked). */
  picked: HelpLevel | null;
  onLevel: (level: HelpLevel | null) => void;
  onShow: (target: string) => void;
  /** Start First Flight again (missing when it can't start now). */
  onReplay?: () => void;
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  useEffect(() => {
    const close = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);
  const about = screenHelp(screen);
  return (
    <section className="st-help" role="dialog" aria-modal="false" aria-labelledby="st-help-h">
      <div className="st-help__top">
        <BoltFace />
        <h2 id="st-help-h" ref={heading} tabIndex={-1} className="st-h st-help__h">{COACH_NAME}'s help</h2>
        <button type="button" className="st-btn st-btn--small st-tip__x" onClick={onClose} aria-label={`Close ${COACH_NAME}'s help`}>✕</button>
      </div>

      <h3 className="st-help__sub">What should I do?</h3>
      {step ? (
        <div className="st-help__step">
          <p>{step.say}</p>
          {step.target && <button type="button" className="st-btn st-btn--small" onClick={() => onShow(step.target as string)}>Show me</button>}
        </div>
      ) : (
        <p>Finish what's on the screen first. {about.points[0]}</p>
      )}

      <h3 className="st-help__sub">What's this screen? {about.title}</h3>
      <ul className="st-help__list">{about.points.map((p) => <li key={p}>{p}</li>)}</ul>

      <details className="st-help__more">
        <summary>Words</summary>
        <dl className="st-words">
          {wordList(jumpsPerDay).map(([word, means]) => (
            <div key={word}><dt>{word}</dt><dd>{means}</dd></div>
          ))}
        </dl>
      </details>

      {tips.length > 0 && (
        <details className="st-help__more">
          <summary>{COACH_NAME}'s tips again ({tips.length})</summary>
          <ul className="st-help__list">{tips.map((t) => <li key={t}>{t}</li>)}</ul>
        </details>
      )}

      <fieldset className="st-help__level">
        <legend>How much help?</legend>
        <div className="st-levels">
          {HELP_LEVELS.map((l) => (
            <label key={l.id} className={`st-level ${level === l.id ? 'st-level--on' : ''}`}>
              <input type="radio" name="st-help-level" value={l.id} checked={level === l.id} onChange={() => onLevel(l.id)} />
              <strong>{l.name}</strong>
              <span className="st-soft">{l.about}</span>
            </label>
          ))}
        </div>
        {picked === null ? (
          <p className="st-soft">{COACH_NAME} picked this for you. Pick your own any time.</p>
        ) : (
          <button type="button" className="st-btn st-btn--small" onClick={() => onLevel(null)}>Let {COACH_NAME} pick</button>
        )}
      </fieldset>

      {onReplay && <button type="button" className="st-btn" onClick={onReplay}>Replay First Flight</button>}
    </section>
  );
}
