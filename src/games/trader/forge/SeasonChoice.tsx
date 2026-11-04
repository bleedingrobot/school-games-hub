/** The New Season choice (docs/TRADER-SYSTEM-PLAN.md, section 1.2): keep the solar system, or keep the ship and credits. Nothing else works until they pick. */
import { useEffect, useRef, useState } from 'react';
import { SHIPS } from '../../../../shared/trader/config';
import type { SeasonChoice as Choice } from '../../../data/trader';
import { BoltFace } from '../coach/CoachBar';
import { COACH_NAME } from '../text';

export function SeasonChoice({ choice, bolt, onPick, onExit }: {
  choice: Choice;
  bolt: boolean;
  onPick: (pick: 'keep' | 'fresh') => Promise<string | null>;
  onExit?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => head.current?.focus(), []);
  const ship = SHIPS[choice.carry.ship]?.name ?? 'ship';
  const credits = choice.carry.credits.toLocaleString('en-NZ');
  async function pick(p: 'keep' | 'fresh') {
    setBusy(true);
    const bad = await onPick(p);
    if (bad) {
      setProblem(bad);
      setBusy(false);
    }
  }
  return (
    <div className="st-title">
      <div className="st-title__box stf-season" role="group" aria-labelledby="stf-season-h">
        <h1 id="stf-season-h" ref={head} tabIndex={-1} className="st-title__h">A new season! 🌟</h1>
        <p className="st-title__p">You built <strong>{choice.name}</strong>, worth {choice.worth.toLocaleString('en-NZ')} credits. What do you want to do with it?</p>
        {bolt && (
          <p className="stf-bolt"><BoltFace size={26} /> <span><strong>{COACH_NAME}:</strong> Keep your system, or keep your {ship} and {credits} credits. Either way you can build more. It is your choice!</span></p>
        )}
        <div className="stf-season__choices">
          <button type="button" className="st-btn st-btn--big stf-season__btn" disabled={busy} onClick={() => void pick('keep')}>
            <span className="stf-season__t">🌌 Keep my solar system</span>
            <span className="stf-season__s">You keep {choice.name}. Your ship and credits start fresh.</span>
          </button>
          <button type="button" className="st-btn st-btn--big stf-season__btn" disabled={busy} onClick={() => void pick('fresh')}>
            <span className="stf-season__t">📸 Save a picture and start a new one</span>
            <span className="stf-season__s">You keep your {ship} and {credits} credits, and design a new system.</span>
          </button>
        </div>
        {problem && <p className="st-warn" role="alert">{problem}</p>}
        {onExit && <div className="st-actions st-actions--centre"><button type="button" className="st-btn" onClick={onExit}>Back to the hub</button></div>}
      </div>
    </div>
  );
}
