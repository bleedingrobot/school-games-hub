import { useEffect } from 'react';
import { INNKEEPER } from '../../../shared/bonkers/content';
import { Pic, grannyArt } from './art';
import { useBella } from './voice';

/** Granny Jetpack with her one line in a speech bubble, read aloud by Bella when the line is new. */
export function Granny({ line, className }: { line: string; className?: string }) {
  const say = useBella();
  useEffect(() => { say(line); }, [line, say]);
  return (
    <div className={`bq-granny${className ? ` ${className}` : ''}`}>
      <span className="bq-granny__face" aria-hidden="true">{grannyArt() ? <Pic src={grannyArt()} emoji="" /> : <>{INNKEEPER.emoji}<span className="bq-granny__jet">🚀</span></>}</span>
      <p className="bq-granny__bubble" aria-live="polite"><b>{INNKEEPER.name}:</b> {line}</p>
    </div>
  );
}
