import type { CSSProperties, ReactNode } from 'react';
import type { Look } from '../../../shared/kingdom/reign';
import { PEOPLE, personArt, rulerArt, sceneArt, type Person, type SceneId } from './art';

/**
 * The picture window at the top of a screen: the place's painting (or a colour wash in its colours until the painting
 * arrives), with people standing in it. The painting is a CSS background, so it is decoration only; the people keep
 * their own names.
 */
export function Stage({ scene, children, size = 'normal', label }: {
  scene: SceneId; children?: ReactNode; size?: 'short' | 'normal' | 'tall'; label?: string;
}) {
  const art = sceneArt(scene);
  const style = (art.wide ? { '--kk-wide': `url("${art.wide}")`, '--kk-small': `url("${art.small}")` } : {}) as CSSProperties;
  return (
    <div className={`kk-stage kk-stage--${scene} kk-stage--${size}${art.wide ? ' has-art' : ''}`} style={style} role={label ? 'img' : undefined} aria-label={label}>
      {children}
    </div>
  );
}

/** Someone at court, standing in the stage (on the right). Nothing until the picture arrives. */
export function Courtier({ who, side = 'right' }: { who: Person; side?: 'left' | 'right' }) {
  const src = personArt(who);
  if (!src) return null;
  return <img className={`kk-figure kk-figure--${side} kk-enter`} src={src} alt={PEOPLE[who].title} decoding="async" draggable={false} />;
}

/** The pupil's ruler, standing in the stage (on the left). */
export function Ruler({ look, side = 'left' }: { look: Look; side?: 'left' | 'right' }) {
  const src = rulerArt(look);
  if (!src) return null;
  return <img className={`kk-figure kk-figure--${side} kk-figure--ruler`} src={src} alt="You, the ruler" decoding="async" draggable={false} />;
}
