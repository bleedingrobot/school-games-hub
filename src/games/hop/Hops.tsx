/**
 * Today's challenge: ten hops. Each hop is a row of lily pads counting in equal steps, with Hop sitting on the pad
 * before the glowing gap. The child taps the glow-worm with the missing number and Hop jumps onto the pad; a wrong
 * glow-worm wobbles and drifts back, with no penalty. The step ("+2") shows on each hop's arc on bronze days, faintly on
 * silver days, and not at all on gold days, when the last three hops count back as Hop hops home.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Tap } from '../../../shared/hop/play';
import type { Friend as FriendName, Help, Metal } from '../../../shared/hop/progress';
import { HOPS_PER_ROUND, showRound, type Round } from '../../../shared/hop/round';
import { playSound } from '../sounds';
import { Friend, GlowWorm, LilyPad } from './HopArt';
import { backFor, type Scenery } from './Pond';
import { WORDS } from './words';

const JUMP_MS = 650;
const LAND_MS = 750;
const WOBBLE_MS = 500;

interface Props {
  round: Round;
  help: Help;
  /** The colour the row's pads have reached: green on bronze days, bronze on silver days, silver on gold days. */
  padMetal: Metal;
  scenery: Scenery;
  friend: FriendName;
  /** The child's very first challenge: a hand shows them the right glow-worm on the first hop. */
  guide?: boolean;
  sound: boolean;
  say: (text: string) => void;
  onDone: (taps: Tap[]) => void;
}

type Phase = 'ask' | 'jump' | 'done';

export function Hops({ round, help, padMetal, scenery, friend, guide = false, sound, say, onDone }: Props) {
  const hops = useMemo(() => showRound(round), [round]);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [at, setAt] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [wobble, setWobble] = useState<number | null>(null);
  const since = useRef(Date.now());
  const timers = useRef<number[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const later = (ms: number, f: () => void) => timers.current.push(window.setTimeout(f, ms));

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);
  // Each new hop is read aloud once (the shared pack's words: "Counting in tens: 20, 30, something, 50. What is missing?").
  useEffect(() => {
    if (at === 0) heading.current?.focus();
    since.current = Date.now();
    say(guide && at === 0 ? `${hops[0].spoken} ${WORDS.guideStart}` : hops[at].spoken);
    // Read again only when the hop changes, not when the guide ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, hops, say]);

  const hop = hops[Math.min(at, hops.length - 1)];
  const pads = hop.parts.map((p) => p.replace(/,$/, '')).map((p) => (p === '?' ? null : Number(p)));
  const gap = pads.indexOf(null);
  const back = round.hops[at]?.key.includes(':back:');
  const sign = back ? '−' : '+';

  function pick(n: number) {
    if (phase !== 'ask') return;
    const now = Date.now();
    const next = [...taps, { pick: n, ms: now - since.current }];
    since.current = now;
    setTaps(next);
    if (n !== hop.answer) {
      setWobble(n);
      say(WORDS.tryAgain);
      if (sound) playSound('tap');
      later(WOBBLE_MS, () => setWobble(null));
      return;
    }
    setPhase('jump');
    say(WORDS.yes(n));
    if (sound) playSound('hop');
    later(JUMP_MS + LAND_MS, () => {
      if (at + 1 >= hops.length) {
        setPhase('done');
        later(LAND_MS, () => onDone(next));
      } else {
        setAt(at + 1);
        setPhase('ask');
      }
    });
  }

  // The guided first go: the hand points at the right glow-worm on the first hop, until it is picked.
  const pointAt = guide && at === 0 && phase === 'ask' ? hop.answer : null;
  const sitting = phase === 'ask' ? gap - 1 : gap;
  const made = at + (phase === 'ask' ? 0 : 1);

  return (
    <div className={`hp-play hp-pond--${scenery}`} style={backFor(scenery)}>
      <div className="hp-stars" aria-hidden="true" />
      <h2 className="hp-sr" tabIndex={-1} ref={heading}>{WORDS.pickWorm}</h2>
      <div className="hp-progress" aria-label={WORDS.hopsMade(made, HOPS_PER_ROUND)}>
        {Array.from({ length: HOPS_PER_ROUND }, (_, i) => (
          <span key={i} className={i < made ? 'hp-pip hp-pip--done' : 'hp-pip'} />
        ))}
      </div>
      <p className="hp-ask" aria-live="polite">{hop.prompt}</p>
      <div className="hp-row" key={at} style={{ ['--hp-n' as string]: pads.length }}>
        {pads.slice(0, -1).map((_, i) => (
          <span key={`arc${i}`} className={`hp-arc hp-arc--${help}${i === gap - 1 ? ' hp-arc--next' : ''}`} style={{ ['--hp-i' as string]: i }}>
            {help !== 'none' && <span className="hp-arc__label">{sign}{round.step}</span>}
          </span>
        ))}
        {pads.map((n, i) => (
          <span key={i} className="hp-row__spot" style={{ ['--hp-i' as string]: i }}>
            <LilyPad metal={padMetal} value={i === gap ? (phase === 'ask' ? null : hop.answer) : n} gap={i === gap && phase === 'ask'} glow={i === gap && phase !== 'ask'} />
          </span>
        ))}
        <span className={`hp-row__frog${phase === 'jump' ? ' hp-row__frog--jump' : ''}`} style={{ ['--hp-i' as string]: sitting }}>
          <Friend friend={friend} pose={phase === 'done' ? 'cheer' : phase === 'jump' ? 'leap' : 'wait'} />
        </span>
      </div>
      <div className="hp-worms" role="group" aria-label={WORDS.pickWorm}>
        {hop.choices.map((n, i) => (
          <button
            key={`${at}-${n}`}
            type="button"
            className={`hp-worm${wobble === n ? ' hp-worm--wobble' : ''}${phase !== 'ask' && n === hop.answer ? ' hp-worm--gone' : ''}${n === pointAt ? ' hp-worm--pointed' : ''}`}
            style={{ ['--hp-i' as string]: i }}
            onClick={() => pick(n)}
            aria-label={n === pointAt ? `${n}, ${WORDS.guideHere}` : String(n)}
          >
            <GlowWorm value={n} />
            {n === pointAt && <span className="hp-hand" aria-hidden="true">👆</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
