/**
 * Big painted moments for quests 6 to 10 (docs/plans/trader-quests-2/PLAN.md, R.2): the Comet Cup's start lamps, the
 * checkpoint whoosh and the finish line, and Rust-Beard sailing in before his fight. Only for show: the server has already
 * ticked the step. Tap (or any key) skips; with less motion they appear still and go a little sooner.
 */
import { useEffect } from 'react';
import { momentArt } from './questGuide';

export type RaceMomentKind = 'start' | 'checkpoint' | 'finish';

const RACE: Record<RaceMomentKind, { art: 'zip-3' | 'zip-4'; big: string; small: string; ms: number }> = {
  start: { art: 'zip-3', big: 'GO!', small: 'The Comet Cup has started. One tank, no more fuel till the finish!', ms: 3400 },
  checkpoint: { art: 'zip-4', big: 'Checkpoint!', small: 'Through! Now on to the finish line.', ms: 2200 },
  finish: { art: 'zip-4', big: 'Finish line!', small: 'You flew the whole Comet Cup on one tank!', ms: 3000 },
};

/** The Comet Cup's moments: red, yellow, green lamps then GO!, a checkpoint whoosh, the finish with chequered flags. */
export function RaceMoment({ kind, still, onDone }: { kind: RaceMomentKind; still: boolean; onDone: () => void }) {
  const m = RACE[kind];
  useEffect(() => {
    const timer = window.setTimeout(onDone, still ? 1800 : m.ms);
    const key = () => onDone();
    window.addEventListener('keydown', key);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', key);
    };
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const art = momentArt(m.art);
  return (
    <div className={`stq-fx stq-fx--${kind} ${still ? 'stq-fx--still' : ''}`} role="status" aria-label={`${m.big} ${m.small}`} onClick={onDone} data-fx={kind}>
      {art && <img className="stq-fx__art" src={art.wide} srcSet={`${art.small} 800w, ${art.wide} 1600w`} sizes="100vw" alt="" draggable={false} />}
      <div className="stq-fx__streaks" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <span key={i} style={{ ['--i' as string]: i }} />)}</div>
      {kind === 'start' && (
        <div className="stq-fx__lamps" aria-hidden="true">
          <span className="stq-fx__lamp stq-fx__lamp--red" />
          <span className="stq-fx__lamp stq-fx__lamp--amber" />
          <span className="stq-fx__lamp stq-fx__lamp--green" />
        </div>
      )}
      {kind === 'finish' && <div className="stq-fx__flags" aria-hidden="true"><span>🏁</span><span>🏁</span></div>}
      <p className="stq-fx__big" aria-hidden="true">{m.big}</p>
      <p className="stq-fx__small" aria-hidden="true">{m.small}</p>
    </div>
  );
}

/** Rust-Beard's grand entrance above his fight: his rusty ship sails in, the screen shakes, and his name slams down. */
export function BossBanner({ still }: { still: boolean }) {
  const art = momentArt('sable-2');
  return (
    <div className={`stq-boss ${still ? 'stq-boss--still' : ''}`} data-fx="boss">
      {art && <img className="stq-boss__art" src={art.small} alt="" draggable={false} />}
      <p className="stq-boss__name">🏴‍☠️ Rust-Beard!</p>
      <p className="stq-boss__sub">A pirate <strong>Captain</strong>: tougher than any pirate you've met. If you lose, he takes nothing, so have a go!</p>
    </div>
  );
}
