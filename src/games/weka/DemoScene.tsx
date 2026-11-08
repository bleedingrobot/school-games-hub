/** The made-up go of a "Show me first" demo (demo.ts): the same stones and hops as a real go, nothing to tap. */
import { Fragment } from 'react';
import { DEMOS, type DemoKind } from './demo';
import { Friend, Hop, StepStone } from './WekaArt';
import type { Friend as FriendName } from '../../../shared/weka/progress';

const STONES = Array.from({ length: 20 }, (_, i) => i + 1);

/** The stones passed between two numbers, not counting the first. */
const passed = (from: number, to: number) => {
  const out: number[] = [];
  for (let n = from; n !== to; ) {
    n += to > from ? 1 : -1;
    out.push(n);
  }
  return out;
};

/** `step` 0: Weka waits on the first stone; later steps: Weka has hopped, and the stones it passed are lit. */
export function DemoScene({ kind, step, friend }: { kind: DemoKind; step: number; friend: FriendName }) {
  const demo = DEMOS[kind];
  const landed = demo.steps[step]?.target === 'land';
  const pos = landed ? demo.to : demo.from;
  const lit = new Set(landed ? passed(demo.from, demo.to) : []);
  const sign = kind === 'back' ? '−' : '+';
  return (
    <>
      <p className="wk-ask" aria-live="polite">{demo.sum}</p>
      <p className="wk-stem wk-stem--empty" aria-hidden="true">.</p>
      <div className="wk-hops" aria-hidden="true">
        <span className="wk-hops__label">{sign}{demo.small}</span>
        {Array.from({ length: demo.small }, (_, i) => (
          <Fragment key={i}>
            <Hop part="to" />
          </Fragment>
        ))}
      </div>
      <div className={`wk-scene wk-scene--full${kind === 'back' ? ' wk-scene--back' : ''}`} aria-hidden="true">
        <div className="wk-path">
          {STONES.map((n) => (
            <span key={n} data-n={n} className={`wk-path__spot${n < 5 ? ' wk-path__spot--narrow' : ''}${n === 10 ? ' wk-path__spot--big' : ''}`}>
              <StepStone n={n} big={n === 10} shade={(n - 1) % 10 < 5 ? 'light' : 'dark'} number mark={lit.has(n) ? 'to' : null} />
              {n === pos && (
                <span className="wk-scene__friend">
                  <Friend friend={friend} pose={landed ? 'land' : 'wait'} />
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
