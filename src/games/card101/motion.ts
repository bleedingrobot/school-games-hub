/**
 * Cards that move (docs/101-ART-PLAN.md stage U.2): dealt from the stack, drawn from a pile, swapped into a spot,
 * thrown on the discard pile. The table draws where cards *are*; this file slides each card from where it *was*
 * (Web Animations, so nothing in React's state waits on it). Off with reduced motion.
 */
export type Motion =
  | { n: number; kind: 'deal' }
  | { n: number; kind: 'draw'; seat: number; from: 'stack' | 'discard' }
  | { n: number; kind: 'swap'; seat: number; slot: number }
  | { n: number; kind: 'throw'; seat: number }
  | { n: number; kind: 'knock'; seat: number };

type Box = { x: number; y: number; w: number; h: number };

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

export const boxOf = (el: Element | null | undefined): Box | null => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } : null;
};

/** Slides `el` from `from` to where it is now. */
function flyFrom(el: Element | null, from: Box | null, opts: { delay?: number; duration?: number; spin?: number; flip?: boolean } = {}) {
  const to = boxOf(el);
  if (!el || !from || !to || typeof (el as HTMLElement).animate !== 'function') return;
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  const s = from.w / to.w;
  const spin = opts.spin ?? 0;
  (el as HTMLElement).animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(${spin}deg)${opts.flip ? ' rotateY(90deg)' : ''}`, offset: 0 },
      ...(opts.flip ? [{ transform: `translate(${dx * 0.4}px, ${dy * 0.4}px) scale(${(s + 1) / 2 + 0.08}) rotateY(0deg)`, offset: 0.55 }] : []),
      { transform: 'none', offset: 1 },
    ],
    { duration: opts.duration ?? 380, delay: opts.delay ?? 0, easing: 'cubic-bezier(0.25, 0.8, 0.35, 1)', fill: 'backwards' },
  );
}

const q = (root: HTMLElement, sel: string) => root.querySelector(sel);

/** Plays one motion. `held` is where each seat's held card was before this change. */
export function playMotion(root: HTMLElement, motion: Motion, held: Map<number, Box>, players: number, me: number) {
  if (reduced()) return;
  const stack = boxOf(q(root, '[data-pile="stack"] .c101-pile__cards'));
  switch (motion.kind) {
    case 'deal': {
      // Round the table, one card at a time, like a real deal.
      for (let slot = 0; slot < 4; slot++) {
        for (let k = 0; k < players; k++) {
          const seat = (me + k) % players;
          const el = q(root, `[data-seat="${seat}"] [data-card-slot="${slot}"] .playing-card`);
          flyFrom(el, stack, { delay: (slot * players + k) * 70, duration: 360, spin: -14 });
        }
      }
      break;
    }
    case 'draw': {
      const from = motion.from === 'stack' ? stack : boxOf(q(root, '[data-pile="discard"] .c101-pile__cards'));
      flyFrom(q(root, `[data-held-seat="${motion.seat}"] .playing-card`), from, { duration: 420, flip: motion.seat === me && motion.from === 'stack' });
      break;
    }
    case 'swap': {
      const was = held.get(motion.seat) ?? null;
      const spot = q(root, `[data-seat="${motion.seat}"] [data-card-slot="${motion.slot}"] .playing-card`);
      flyFrom(spot, was, { duration: 420, spin: 8 });
      // The card that was there goes on the discard pile.
      flyFrom(q(root, '[data-pile="discard"] .playing-card'), boxOf(spot), { duration: 460, delay: 80, spin: -20 });
      break;
    }
    case 'throw':
      flyFrom(q(root, '[data-pile="discard"] .playing-card'), held.get(motion.seat) ?? null, { duration: 420, spin: -18 });
      break;
    case 'knock': {
      root.animate?.(
        [{ transform: 'none' }, { transform: 'translateY(4px)' }, { transform: 'translateY(-2px)' }, { transform: 'translateY(2px)' }, { transform: 'none' }],
        { duration: 420, easing: 'ease-out' },
      );
      break;
    }
  }
}

/** The motion a batch of game events calls for (the last one that moves a card). */
export function motionFor(events: readonly { kind: string; seat?: number; from?: string; slot?: number }[], n: number): Motion | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.kind === 'deal') return { n, kind: 'deal' };
    if (e.kind === 'draw') return { n, kind: 'draw', seat: e.seat!, from: e.from === 'discard' ? 'discard' : 'stack' };
    if (e.kind === 'swap') return { n, kind: 'swap', seat: e.seat!, slot: e.slot! };
    if (e.kind === 'throw') return { n, kind: 'throw', seat: e.seat! };
    if (e.kind === 'knock') return { n, kind: 'knock', seat: e.seat! };
  }
  return null;
}
