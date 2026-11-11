/** The results: the time, the medal, where every second went, and what you unlocked (docs/TOON-FLAP-PLAN.md, section 7). */
import { useEffect, useRef } from 'react';
import { FLYERS, TRAILS, levelOpen } from '../../../shared/toonflap/collection';
import { BUMP_PENALTY_STEPS, CHECK_BONUS_STEPS, STEPS_PER_SECOND, TAILWIND_STEPS } from '../../../shared/toonflap/config';
import { LEVELS } from '../../../shared/toonflap/levels';
import type { FinishReply } from './backend';
import { FlyerCanvas, TrailCanvas } from './Hangar';
import { MEDAL_ICON, MEDAL_WORD, fmtSeconds } from './MapScreen';
import { factText } from './PlayScreen';

const secs = (steps: number) => (steps / STEPS_PER_SECOND).toFixed(1);

export function ResultsScreen({ reply, level, gentle, maths, onNext, onAgain, onMap }: {
  reply: FinishReply;
  level: number;
  gentle: boolean;
  maths: boolean;
  onNext: (n: number) => void;
  onAgain: () => void;
  onMap: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const def = LEVELS[level - 1];
  const { score, unlocks } = reply;
  if (!reply.valid) {
    return (
      <section className="tf-results" aria-labelledby="tf-res-h">
        <h2 id="tf-res-h" className="tf-h" tabIndex={-1} ref={heading}>{def.name}</h2>
        <p className="tf-card-note">That run couldn't be checked, so it wasn't saved.</p>
        <div className="tf-row">
          <button type="button" className="tf-btn tf-btn--big" onClick={onAgain}>Fly again</button>
          <button type="button" className="tf-btn tf-btn--ghost" onClick={onMap}>Map</button>
        </div>
      </section>
    );
  }
  const bumps = Math.round(score.bumpSteps / BUMP_PENALTY_STEPS);
  const checks = Math.round(score.checkBonus / CHECK_BONUS_STEPS);
  const tails = Math.round(score.tailwind / TAILWIND_STEPS);
  const nextOpen = level < LEVELS.length && levelOpen(reply.progress, level + 1);
  const newFlyers = unlocks.flyers.map((id) => FLYERS.find((f) => f.id === id)).filter((f) => !!f);
  const newTrails = unlocks.trails.map((id) => TRAILS.find((t) => t.id === id)).filter((t) => !!t);
  const celebrate = newFlyers.length > 0 || newTrails.length > 0 || unlocks.potion || unlocks.newGold || unlocks.newBest;
  return (
    <section className="tf-results" aria-labelledby="tf-res-h">
      <h2 id="tf-res-h" className="tf-h" tabIndex={-1} ref={heading}>{def.name}</h2>
      <div className="tf-results__main">
        <div className="tf-results__big">
          <p className="tf-results__time" aria-label={`Your time: ${fmtSeconds(score.seconds)}`}>
            {score.seconds.toFixed(1)}<small> s</small>
            {gentle && <span className="tf-feather" title="Gentle wings" role="img" aria-label="Gentle wings">🪶</span>}
          </p>
          <p className="tf-results__medal">
            <span className="tf-results__medalicon" aria-hidden="true">{MEDAL_ICON[reply.medal]}</span> {MEDAL_WORD[reply.medal]}
          </p>
          {gentle && <p className="tf-dim">Gentle wings finish. Gold needs normal wings.</p>}
        </div>

        <table className="tf-table">
          <caption className="tf-sr">Where your seconds went</caption>
          <tbody>
            <tr><th scope="row">Flying time</th><td>{secs(score.flying)} s</td></tr>
            <tr><th scope="row">Bumps ({bumps} × 3 s)</th><td>+{secs(score.bumpSteps)} s</td></tr>
            {score.potion && <tr><th scope="row">🧪 Potion</th><td>−{secs(BUMP_PENALTY_STEPS)} s</td></tr>}
            {maths && <tr><th scope="row">Checks right ({checks} × 3 s)</th><td>−{secs(score.checkBonus)} s</td></tr>}
            {maths && def.answerWalls > 0 && <tr><th scope="row">Tailwinds ({tails} × 2 s)</th><td>−{secs(score.tailwind)} s</td></tr>}
            <tr className="tf-table__total"><th scope="row">Your time</th><td>{score.seconds.toFixed(1)} s</td></tr>
          </tbody>
        </table>
      </div>

      {maths && reply.signs.length > 0 && (
        <div className="tf-signs">
          <h3 className="tf-h3">Answer signs</h3>
          <ul>
            {reply.signs.map((s, i) => {
              const ok = s.picked !== null && s.picked === s.right;
              return (
                <li key={i} className={ok ? 'tf-sign-row tf-sign-row--ok' : 'tf-sign-row'}>
                  <span className="tf-sign-row__sum">{factText(s.parts, s.answer)}</span>
                  <span>{ok ? '✓ Right gap. Tailwind!' : s.picked === null ? 'No gap picked' : 'Different gap this time'}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {celebrate && (
        <div className="tf-party" role="status">
          {unlocks.newGold && <p className="tf-party__line">🥇 A new gold! That flyer is shiny now.</p>}
          {unlocks.newBest && !unlocks.firstFinish && <p className="tf-party__line">⭐ New best time!</p>}
          {unlocks.potion && <p className="tf-party__line">🧪 You earned a revive potion!</p>}
          {newFlyers.map((f) => f && (
            <div key={f.id} className="tf-party__item">
              <FlyerCanvas flyer={f.id} gold={false} size={72} />
              <p className="tf-party__line">You unlocked a new flyer! <strong>{f.name}</strong></p>
            </div>
          ))}
          {newTrails.map((t) => t && (
            <div key={t.id} className="tf-party__item">
              <TrailCanvas trail={t.id} size={56} />
              <p className="tf-party__line">New trail! <strong>{t.name}</strong></p>
            </div>
          ))}
        </div>
      )}

      <div className="tf-row tf-row--end">
        {nextOpen && <button type="button" className="tf-btn tf-btn--big tf-btn--play" onClick={() => onNext(level + 1)}>Next level: {LEVELS[level].name}</button>}
        <button type="button" className={nextOpen ? 'tf-btn' : 'tf-btn tf-btn--big tf-btn--play'} onClick={onAgain}>Fly again</button>
        <button type="button" className="tf-btn tf-btn--ghost" onClick={onMap}>Map</button>
      </div>
    </section>
  );
}
