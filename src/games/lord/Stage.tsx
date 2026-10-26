import type { CSSProperties, ReactNode } from 'react';
import { PEOPLE, personArt, sceneArt, type PersonId, type SceneId } from './art';

/**
 * The picture window at the top of a screen: the place's painting (or a colour wash in its colours until the
 * painting arrives), with figures standing in it (a monster, a hero, a person who works there). The painting is a
 * CSS background, so it is decoration only and loads when the screen opens; the figures keep their own names.
 */
export function Stage({ scene, children, size = 'normal', className = '' }: {
  scene: SceneId; children?: ReactNode; size?: 'short' | 'normal' | 'tall'; className?: string;
}) {
  const art = sceneArt(scene);
  const style = (art.wide ? { '--stage-wide': `url("${art.wide}")`, '--stage-small': `url("${art.small}")` } : {}) as CSSProperties;
  return (
    <div className={`lord-stage lord-stage--${scene} lord-stage--${size}${art.wide ? ' has-art' : ''} ${className}`} style={style}>
      <div className="lord-stage__mist" aria-hidden="true" />
      {children}
    </div>
  );
}

/** A painted portrait of someone who works in the village, standing in the stage. Nothing until the picture arrives. */
export function Portrait({ who }: { who: PersonId }) {
  const src = personArt(who);
  if (!src) return null;
  return <img className="lord-portrait" src={src} alt={PEOPLE[who].name} decoding="async" draggable={false} />;
}
