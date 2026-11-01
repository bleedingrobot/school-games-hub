/** Bolt's next-step line and the "Show me" spotlight (docs/TRADER-HINTS-PLAN.md, section 3). */
import { COACH_NAME } from '../text';
import type { NextStep } from './nextStep';

/** Bolt's face: a small round robot (drawn here so it doesn't look like the Robots cargo icon). */
export function BoltFace({ size = 34 }: { size?: number }) {
  return (
    <svg className="st-bolt" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <line x1="20" y1="4" x2="20" y2="10" stroke="#a5b4fc" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="20" cy="4" r="3" fill="#fde047" />
      <rect x="6" y="10" width="28" height="24" rx="9" fill="#38bdf8" stroke="#e0f2fe" strokeWidth="2" />
      <rect x="10" y="15" width="20" height="11" rx="5" fill="#0a1026" />
      <circle cx="15.5" cy="20.5" r="2.6" fill="#fde047" />
      <circle cx="24.5" cy="20.5" r="2.6" fill="#fde047" />
      <path d="M15 29.5 q5 3 10 0" stroke="#0a1026" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function CoachBar({ step, onShow }: { step: NextStep; onShow: (target: string) => void }) {
  return (
    <div className="st-coach">
      <BoltFace />
      <p className="st-coach__say" role="status">
        <strong>{COACH_NAME}:</strong> {step.say}
      </p>
      {step.target && (
        <button type="button" className="st-btn st-btn--small st-coach__show" onClick={() => onShow(step.target as string)}>
          Show me
        </button>
      )}
    </div>
  );
}

/** How long a lit-up button glows. */
const GLOW_MS = 4000;
let glowTimer = 0;

/**
 * Light up the thing named `data-coach="…"` inside `root`: scroll it into view, give it a glowing outline for a few
 * seconds and move keyboard focus to it. Nothing else on the screen is covered or blocked. Gives false if it isn't there.
 */
export function lightUp(root: HTMLElement | null, name: string, still: boolean): boolean {
  if (!root) return false;
  for (const old of root.querySelectorAll('.st-lit')) old.classList.remove('st-lit');
  window.clearTimeout(glowTimer);
  const el = root.querySelector<HTMLElement>(`[data-coach="${name}"]`);
  if (!el) return false;
  el.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: still ? 'auto' : 'smooth' });
  el.classList.add('st-lit');
  el.focus({ preventScroll: true });
  glowTimer = window.setTimeout(() => el.classList.remove('st-lit'), GLOW_MS);
  return true;
}
