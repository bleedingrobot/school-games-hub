/**
 * Tūī's Ten Tree's pictures (painted in clay by scripts/tui-art.py into ./art/paint/, docs/TUI-PLAN.md section 7) and
 * the parts drawn in code on top of them. A painting can't be trusted to hold exactly ten, so every count is placed
 * here one berry at a time, and every number, tag and frame line is drawn in code. Each picture falls back to a plain
 * drawn shape if it hasn't downloaded. Only the pictures' addresses are bundled.
 */
import type { CSSProperties } from 'react';
import type { Friend as FriendName, Metal } from '../../../shared/tui/progress';
import { FRIEND_NAMES } from '../../../shared/tui/progress';

const FILES = import.meta.glob('./art/paint/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export const paint = (path: string): string | undefined => FILES[`./art/paint/${path}.webp`];

export type Pose = 'sit' | 'eat' | 'sing' | 'cheer' | 'fly';
export type Scenery = 'bronze' | 'silver' | 'gold';

const BACK: Record<Scenery, string> = { bronze: 'back/spring', silver: 'back/silver', gold: 'back/golden' };

/** The scene's painted background as a CSS value (the smaller one on narrow screens is left to the browser's scaling). */
export const backFor = (scenery: Scenery): CSSProperties => {
  const src = paint(BACK[scenery]);
  return src ? ({ '--tui-back': `url("${src}")` } as CSSProperties) : {};
};

/** Tūī has every pose; the friends sit or cheer. */
const friendArt = (friend: FriendName, pose: Pose) =>
  friend === 'tui' ? paint(`tui/tui-${pose}`) ?? paint('tui/tui-sit') : paint(`friends/${friend}-${pose === 'cheer' ? 'cheer' : 'sit'}`);

export function Friend({ friend, pose }: { friend: FriendName; pose: Pose }) {
  const src = friendArt(friend, pose);
  return (
    <span className={`tui-friend tui-friend--${pose}`}>
      {src ? <img src={src} alt="" draggable={false} /> : <span className="tui-friend__drawn" aria-hidden="true">🐦</span>}
      <span className="tui-sr">{FRIEND_NAMES[friend]}</span>
    </span>
  );
}

/**
 * One berry. In a ten, berries 1 to 5 are orange and 6 to 10 a deeper red-orange (`deep`), tinted in code from the one
 * picture, as Weka's stones and the shared ten-frames do. `empty` is a dashed space where a berry is missing.
 */
export function Berry({ deep = false, gold = false, empty = false, pop = false, eaten = false }: { deep?: boolean; gold?: boolean; empty?: boolean; pop?: boolean; eaten?: boolean }) {
  if (empty) return <span className="tui-berry tui-berry--empty" />;
  const src = paint(gold ? 'tree/berry-gold' : 'tree/berry');
  const cls = `tui-berry${deep ? ' tui-berry--deep' : ''}${pop ? ' tui-berry--pop' : ''}${eaten ? ' tui-berry--eaten' : ''}`;
  return <span className={cls}>{src ? <img src={src} alt="" draggable={false} /> : <span className="tui-berry__drawn" />}</span>;
}

/**
 * A ten-frame: two rows of five, filled left to right, top row first. `count` berries; `empty` dashed spaces after
 * them; `popFrom` makes the berries from that one on pop in one at a time (level 5); `eaten` makes them go one at a
 * time, last first, each leaving a dashed space (the friend eating the ten on "take the ten away").
 */
export function TenFrame({ count, empty = 0, popFrom, label, branch = false, eaten = false }: { count: number; empty?: number; popFrom?: number; label: string; branch?: boolean; eaten?: boolean }) {
  return (
    <div className={`tui-frame${branch ? ' tui-frame--branch' : ''}`} role="img" aria-label={label}>
      {Array.from({ length: 10 }, (_, i) => (
        <span
          key={i}
          className={`tui-frame__cell${eaten ? ' tui-frame__cell--eaten' : ''}`}
          style={eaten ? ({ '--tui-eat': count - 1 - i } as CSSProperties) : popFrom !== undefined && i >= popFrom ? ({ '--tui-pop': i - popFrom } as CSSProperties) : undefined}
        >
          {i < count ? <Berry deep={i >= 5} pop={popFrom !== undefined && i >= popFrom} eaten={eaten} /> : i < count + empty ? <Berry empty /> : null}
        </span>
      ))}
    </div>
  );
}

/** The flax kete that holds exactly ten, with its "10" tag drawn in code. */
export function Kete({ className = '', label }: { className?: string; label?: string }) {
  const src = paint('tree/kete-full');
  return (
    <span className={`tui-kete ${className}`} role={label ? 'img' : undefined} aria-label={label}>
      {src ? <img src={src} alt="" draggable={false} /> : <span className="tui-kete__drawn" />}
      <span className={`tui-kete__tag${src ? ' tui-kete__tag--painted' : ''}`} aria-hidden="true">10</span>
    </span>
  );
}

/** An answer nest with its number. */
export function Nest({ value }: { value: number }) {
  const src = paint('tree/nest');
  return (
    <span className="tui-nest">
      {src ? <img src={src} alt="" draggable={false} /> : <span className="tui-nest__drawn" />}
      <span className="tui-nest__value">{value}</span>
    </span>
  );
}

const FLOWER: Record<Metal, string> = { bud: 'flowers/flower-bud', bronze: 'flowers/flower-bronze', silver: 'flowers/flower-silver', gold: 'flowers/flower-gold' };

export function Flower({ metal, glow = false }: { metal: Metal; glow?: boolean }) {
  const src = paint(FLOWER[metal]);
  return (
    <span className={`tui-flower tui-flower--${metal}${glow ? ' tui-flower--glow' : ''}`}>
      {src ? <img src={src} alt="" draggable={false} /> : <span className="tui-flower__drawn" />}
    </span>
  );
}

export function GoldenNest({ cushion = false }: { cushion?: boolean }) {
  const src = paint('things/golden-nest');
  const under = cushion ? paint('things/nest-cushion') : undefined;
  return (
    <span className="tui-golden" role="img" aria-label="The Golden Nest">
      {under && <img className="tui-golden__cushion" src={under} alt="" draggable={false} />}
      {src ? <img className="tui-golden__nest" src={src} alt="" draggable={false} /> : <span aria-hidden="true">🪺</span>}
    </span>
  );
}
