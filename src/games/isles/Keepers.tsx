/**
 * Choosing a Sky Keeper (docs/ISLES-PLAN.md, section 7): the first thing a new pupil does. A keeper is just for fun and
 * can be changed any time from My island.
 */
import { useEffect, useRef, useState } from 'react';
import { KEEPERS } from '../../../shared/isles/config';
import { keeperArt, pipArt } from './art';
import { Art } from './Island';

export function Keepers({ current, onChoose, onBack, busy }: { current: string | null; onChoose: (id: string) => void; onBack?: () => void; busy: boolean }) {
  const [picked, setPicked] = useState<string | null>(current);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="si-keepers" aria-labelledby="si-keepers-title">
      <h2 id="si-keepers-title" ref={heading} tabIndex={-1}>Choose your Sky Keeper</h2>
      <div className="si-pipsays">
        <Art src={pipArt('wave')} className="si-pip" fallback={<span className="si-pip si-pip--drawn" aria-hidden="true" />} />
        <p>Who looks after this island? Pick your Sky Keeper. You can change later.</p>
      </div>
      <div className="si-keepers__grid" role="radiogroup" aria-label="Sky Keepers">
        {KEEPERS.map((id, i) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={picked === id}
            aria-label={`Sky Keeper ${i + 1}`}
            className={`si-keeper${picked === id ? ' si-keeper--on' : ''}`}
            onClick={() => setPicked(id)}
          >
            <Art src={keeperArt(id, true)} fallback={<span className="si-keeper__drawn" aria-hidden="true">{i + 1}</span>} />
          </button>
        ))}
      </div>
      <div className="si-keepers__bar">
        {picked && <Art src={keeperArt(picked)} className="si-keepers__big" fallback={<span />} />}
        <button type="button" className="button button--primary" disabled={!picked || busy} onClick={() => picked && onChoose(picked)}>
          {busy ? 'Saving…' : picked ? 'This is my keeper' : 'Tap a keeper first'}
        </button>
        {onBack && <button type="button" className="button button--light" onClick={onBack}>Back</button>}
      </div>
    </section>
  );
}
