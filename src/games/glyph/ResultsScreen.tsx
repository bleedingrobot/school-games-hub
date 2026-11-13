import { useEffect, useRef } from 'react';
import { PASS_FIRST_GO, TEMPLES, TOP_TEMPLE, WALLS_PER_TEMPLE } from '../../../shared/glyph/config';
import type { TempleResult } from '../../../shared/glyph/play';
import { GlyphStar, Monkey } from './Art';
import type { Say } from './voice';
import { RESULT_CLOSE, RESULT_PASSED } from './words';

export function ResultsScreen({ temple, result, points, onNext, onAgain, onMap, say }: {
  temple: number;
  result: TempleResult;
  points: number;
  onNext: () => void;
  onAgain: () => void;
  onMap: () => void;
  say?: Say;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  useEffect(() => say?.(result.passed ? RESULT_PASSED : RESULT_CLOSE), [say, result.passed]);
  const name = TEMPLES.find((t) => t.id === temple)?.name ?? '';
  const stars = result.firstGoes >= WALLS_PER_TEMPLE ? 3 : result.passed ? 2 : result.firstGoes > 0 ? 1 : 0;
  return (
    <section className="gg-results" aria-labelledby="gg-res-h">
      <div className="gg-results__monkeys" aria-hidden="true"><Monkey cheer={result.passed} /><Monkey cheer={result.passed} flip /></div>
      <h2 id="gg-res-h" className="gg-h" tabIndex={-1} ref={heading}>{result.passed ? `${name} is open!` : `${name}: nearly there`}</h2>
      <p className="gg-results__big">{result.firstGoes} of {WALLS_PER_TEMPLE} walls opened first go</p>
      <p className="gg-stars gg-stars--big" aria-hidden="true">{[1, 2, 3].map((k) => <GlyphStar key={k} on={k <= stars} />)}</p>
      <p>{result.passed ? RESULT_PASSED : `${RESULT_CLOSE} Open ${PASS_FIRST_GO} first go to pass.`}</p>
      {points > 0 && <p className="gg-points">+{points} points</p>}
      <div className="gg-results__btns">
        {result.passed && temple < TOP_TEMPLE && <button type="button" className="gg-btn gg-btn--primary" onClick={onNext}>Next temple</button>}
        <button type="button" className={`gg-btn${result.passed ? '' : ' gg-btn--primary'}`} onClick={onAgain}>Try again</button>
        <button type="button" className="gg-btn" onClick={onMap}>Map</button>
      </div>
    </section>
  );
}
