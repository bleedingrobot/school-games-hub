/**
 * Naming the island (James, 3 Nov 2026): pick one of six made-up names, or ask for six more. Nothing is typed, so no
 * name can be unkind. The name shows on My island, the class sky, visits and the Hall of the Skies, and stays through
 * New Season. It can be changed any time.
 */
import { useEffect, useRef, useState } from 'react';
import { nameChoices } from '../../../shared/isles/names';
import { pipArt } from './art';
import { Art } from './Island';

export function NamePicker({ current, onChoose, onBack, busy, random = Math.random }: {
  current: string | null;
  onChoose: (name: string) => void;
  onBack: () => void;
  busy: boolean;
  random?: () => number;
}) {
  const [choices, setChoices] = useState(() => nameChoices(random));
  const [picked, setPicked] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="si-names" aria-labelledby="si-names-title">
      <h2 id="si-names-title" ref={heading} tabIndex={-1}>Name your island</h2>
      <div className="si-pipsays">
        <Art src={pipArt('wave')} className="si-pip" fallback={<span className="si-pip si-pip--drawn" aria-hidden="true" />} />
        <p>{current ? `Your island is called ${current}. Pick a new name, or keep it.` : 'Every island needs a name! Pick one you like. You can change it later.'}</p>
      </div>
      <div className="si-names__grid" role="radiogroup" aria-label="Island names">
        {choices.map((name) => (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={picked === name}
            className={`si-name${picked === name ? ' si-name--on' : ''}`}
            onClick={() => setPicked(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="si-keepers__bar">
        <button type="button" className="button button--primary" disabled={!picked || busy} onClick={() => picked && onChoose(picked)}>
          {busy ? 'Saving…' : picked ? `Call it ${picked}` : 'Tap a name first'}
        </button>
        <button
          type="button"
          className="button button--light"
          onClick={() => {
            setChoices(nameChoices(random));
            setPicked(null);
          }}
        >
          Show other names
        </button>
        <button type="button" className="button button--light" onClick={onBack}>Back</button>
      </div>
    </section>
  );
}
