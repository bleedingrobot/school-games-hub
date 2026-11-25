/** The end card (docs/STARWEB-PLAN.md "How a sky plays" 5): the medal, stars per arm, the tables it lit and the points. */
import { useEffect, useRef } from 'react';
import { ARMS, ARM_NAMES, type Anchor } from '../../../shared/classlive/stars';
import { TABLES } from '../../../shared/starweb/config';
import { tablesLit, type Progress } from '../../../shared/starweb/map';
import { armCounts, countedStars } from '../../../shared/starweb/sky';
import { ARM_COLOURS } from '../classlive/arms';
import { AchievementPop } from '../../achievements/AchievementPop';
import type { FinishReply, Mode } from './backend';
import { MEDAL_COLOURS, MEDAL_WORDS } from './words';

export function EndScreen({ reply, anchor, mode, before, onNext, onMap, trial }: {
  reply: FinishReply;
  anchor: Anchor;
  mode: Mode;
  before: Progress;
  onNext(): void;
  onMap(): void;
  trial: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const medal = reply.medal || 1;
  const counts = armCounts(reply.stars);
  const newlyLit = tablesLit(reply.progress) - tablesLit(before);
  const tables = [...new Set([anchor.x, anchor.y])].sort((a, b) => a - b);
  return (
    <section className="sw-end" aria-labelledby="sw-end-h">
      <div className="sw-end__medal" style={{ '--medal': MEDAL_COLOURS[medal] } as React.CSSProperties} aria-hidden="true">{medal === 3 ? '🥇' : medal === 2 ? '🥈' : '🥉'}</div>
      <h1 id="sw-end-h" className="sw-title" tabIndex={-1} ref={heading}>{MEDAL_WORDS[medal].title}</h1>
      <p className="sw-end__line">You found <b>{countedStars(reply.stars)}</b> stars from {anchor.x} × {anchor.y} = {anchor.p}.</p>
      <ul className="sw-end__arms">
        {ARMS.map((a) => (
          <li key={a} style={{ '--arm': ARM_COLOURS[a] } as React.CSSProperties}><b>{counts[a]}</b> {ARM_NAMES[a]}</li>
        ))}
      </ul>
      {mode === 'map' ? (
        <p className="sw-end__line">
          The {tables.join(' and ')} times {tables.length === 1 ? 'table glows' : 'tables glow'} on your Star Map.
          {newlyLit > 0 && ` ${newlyLit} new! `} {tablesLit(reply.progress)} of {TABLES.length} lit.
        </p>
      ) : (
        <p className="sw-end__line">A free sky, just for fun.</p>
      )}
      {reply.points > 0 && <p className="sw-end__points">+{reply.points} points</p>}
      <div className="sw-end__btns">
        <button type="button" className="sw-btn sw-btn--play sw-btn--big" onClick={onNext}>Next sky ✨</button>
        <button type="button" className="sw-btn" onClick={onMap}>Star Map</button>
      </div>
      <AchievementPop games={['starweb']} watch={reply} off={trial} />
    </section>
  );
}
