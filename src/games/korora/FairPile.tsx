/**
 * "Fair or not?" at Penguin Pairs (maths review R9, docs/plans/maths-review/R9-game-specific-depth.md section 3.2): a real
 * pile of 6 to 20 fish. The child taps the pile and two fish go to the bowls, one for each chick, again and again until
 * no pair is left. Only then can the child pick Fair or One left over, so the answer comes from the pile and
 * not from a guess at the buttons.
 *
 *  - help 'full' (bronze): the game shares the first two pairs, the child shares the rest;
 *    and the fish in the bowls glow in pairs;
 *  - help 'faint' (silver) and 'none' (gold): the child shares all, and nothing glows;
 *  - `hint` (after the second wrong choice): the fish pair off one by one, so a fish with no partner stands out;
 *  - when the answer is right the fish in one bowl are counted, and the other bowl is the same.
 * Tapping a fish and tapping the button do the same thing (the button is for the keyboard and screen readers). Nothing
 * here is marked: the browser and the server mark the choice (shared/korora/play.ts).
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Help } from '../../../shared/korora/progress';
import type { Go } from '../../../shared/korora/round';
import { playSound } from '../sounds';
import { Chick, Fish } from './KororaArt';
import { WORDS } from './words';

/** The pairs the game shares itself on bronze days. */
export const GAME_SHARES_PAIRS = 2;
const PRE_MS = 420;
const GLOW_MS = 450;
/** The time between counts of one bowl's fish once the child is right. */
export const COUNT_MS = 450;

const rowsOf = (n: number) => Array.from({ length: Math.ceil(n / 5) }, (_, r) => Math.min(5, n - r * 5));

interface Props {
  go: Go;
  help: Help;
  phase: 'ask' | 'right' | 'done';
  /** Set after the second wrong choice: the fish pair off. */
  hint: boolean;
  sound: boolean;
  /** Told whenever the pile changes: true once no pair is left to share. */
  onSorted: (sorted: boolean) => void;
}

export function FairPile({ go, help, phase, hint, sound, onSorted }: Props) {
  /** Fish given to the bowls, by their place in the pile: even places to the left chick, odd to the right. */
  const [shared, setShared] = useState<number[]>([]);
  const [busy, setBusy] = useState(help === 'full');
  const [glow, setGlow] = useState(0);
  const [counted, setCounted] = useState<number[]>([]);
  const timers = useRef<number[]>([]);
  const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const still = Array.from({ length: go.n }, (_, i) => i).filter((i) => !shared.includes(i));
  const sorted = still.length <= 1;
  const odd = go.n % 2 === 1;
  const half = Math.floor(go.n / 2);

  // Bronze: the game shares the first pairs while the child watches.
  useEffect(() => {
    if (help !== 'full') return;
    for (let p = 0; p < GAME_SHARES_PAIRS; p++) {
      later((p + 1) * PRE_MS, () => setShared((s) => (s.length >= (p + 1) * 2 ? s : [...s, p * 2, p * 2 + 1])));
    }
    later((GAME_SHARES_PAIRS + 1) * PRE_MS, () => setBusy(false));
    // Only at the start of the go.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => onSorted(sorted), [sorted]); // eslint-disable-line react-hooks/exhaustive-deps

  // The hint: the pairs light up one after the other, so a fish with no partner is left on its own.
  useEffect(() => {
    if (!hint) return;
    for (let p = 1; p <= half; p++) later(p * GLOW_MS, () => setGlow(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hint]);

  // Count together: one bowl's fish, one at a time.
  useEffect(() => {
    if (phase !== 'right') return;
    const left = shared.filter((_, i) => i % 2 === 0);
    left.forEach((_, i) => later(300 + i * COUNT_MS, () => setCounted(left.slice(0, i + 1))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /** Two fish go into the bowls, one for each chick. A fish with no partner stays on the rock. */
  function sharePair() {
    if (phase !== 'ask' || busy) return;
    if (still.length < 2) {
      if (sound) playSound('tap');
      return;
    }
    setShared((s) => [...s, still[0], still[1]]);
    if (sound) playSound('tap');
  }

  const nest = (side: 'left' | 'right') => {
    const items = shared.filter((_, i) => i % 2 === (side === 'left' ? 0 : 1));
    return (
      <div className={`kr-nest kr-nest--${side}`}>
        <span className="kr-chick"><Chick happy={phase !== 'ask'} /></span>
        <div className="kr-nest__fish kr-bowl kr-rows" aria-label={WORDS.bowlHas(items.length)} role="img">
          {rowsOf(items.length).map((count, r) => (
            <div key={r} className="kr-row kr-row--small">
              {items.slice(r * 5, r * 5 + count).map((id, k) => (
                <span
                  key={id}
                  className={`kr-fish${counted.includes(id) ? ' kr-fish--counted' : ''}${help === 'full' || glow > r * 5 + k ? ' kr-fish--pair' : ''}`}
                  aria-hidden="true"
                >
                  <Fish />
                  {counted.includes(id) && <span className="kr-fish__count">{counted.indexOf(id) + 1}</span>}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // With the hint, the leftover (an odd pile) shows once the pairs have lit up; when right, it jumps.
  const showLeft = odd && (phase !== 'ask' || (hint && glow >= half));
  const message = still.length >= 2 ? WORDS.shareTwo : odd ? WORDS.lonely : WORDS.allShared;
  const style = { '--kr-pile-rows': Math.ceil(go.n / 5) } as CSSProperties;
  return (
    <div className="kr-share kr-share--fair" style={style}>
      {nest('left')}
      <div className="kr-pile kr-pile--fair" onClick={sharePair}>
        <div className="kr-rows">
          {rowsOf(still.length).map((count, r) => (
            <div key={r} className="kr-row">
              {still.slice(r * 5, r * 5 + count).map((i) => (
                <span key={i} className={`kr-fish${showLeft && sorted ? ' kr-fish--left-over' : ''}`} aria-hidden="true">
                  <Fish />
                </span>
              ))}
            </div>
          ))}
        </div>
        <button type="button" className="kr-button kr-pile__share" disabled={phase !== 'ask' || busy || still.length < 2} onClick={(e) => { e.stopPropagation(); sharePair(); }}>
          {message}
        </button>
      </div>
      {nest('right')}
    </div>
  );
}
