/**
 * Gold Rush on the iPad (docs/SHOWDOWN-PLAN.md section 4.2): the seam picker. Big tappable cards, one per open seam, each with
 * its painting, what it pays right now (richer seams pay more, but only have room for a few diggers: past that the gold is
 * split), how many are digging against its room, and how much gold is left. It never takes the keyboard's focus.
 */
import type { CSSProperties } from 'react';
import { GOLDRUSH } from '../../../shared/showdown/goldrush';
import type { RoomView } from '../../../shared/showdown/server';

const paintings = import.meta.glob('./art/paint/**/*.webp', { eager: true, import: 'default' }) as Record<string, string>;
const paint = (folder: string, file: string): string | undefined => paintings[`./art/paint/${folder}/${file}.webp`];

type Seam = RoomView['seams'][number];
export const SEAM_NAME = { gold: 'Gold seam', gem: 'Gem seam', rich: 'Rich vein' } as const;
const MAX_TIMES = GOLDRUSH.kinds.rich.times;

/** Room for diggers at a seam (the server's rule: the kind's room for every 12 pupils playing). */
export const seamRoom = (view: Pick<RoomView, 'players'>, kind: Seam['kind']) => GOLDRUSH.kinds[kind].room * Math.max(1, Math.ceil(view.players / 12));

/** What a dig pays at this seam (times the usual gold), with `diggers` digging there. */
export function seamPay(view: Pick<RoomView, 'players'>, s: Seam, diggers: number): number {
  const k = GOLDRUSH.kinds[s.kind];
  return Math.max(GOLDRUSH.minTimes, k.times * Math.min(1, seamRoom(view, s.kind) / Math.max(1, diggers)));
}
const fmt = (n: number) => `${Math.round(n * 10) / 10}`.replace(/\.0$/, '');

/** A little pay meter: how much of the best possible pay (a quiet rich vein) this seam gives you. */
export function PayMeter({ pay, crowded }: { pay: number; crowded: boolean }) {
  return (
    <span className={`sd-c-pay${crowded ? ' sd-c-pay--crowded' : ''}`}>
      <span className="sd-c-pay__bar" aria-hidden="true"><i style={{ transform: `scaleX(${Math.min(1, pay / MAX_TIMES)})` }} /></span>
      <b>{fmt(pay)}×</b>
    </span>
  );
}

export function SeamPicker({ view, mySeam, onPick, onClose, said }: { view: RoomView; mySeam: number | null; onPick: (seam: number) => void; onClose: () => void; said: string | null }) {
  const back = paint('back', 'gold-rush-800') ?? paint('back', 'gold-rush');
  // What it pays you if you dig there: counting yourself if you're not there already.
  const rows = view.seams.map((s) => {
    const mine = s.id === mySeam;
    const room = seamRoom(view, s.kind);
    const pay = seamPay(view, s, s.diggers + (mine ? 0 : 1));
    return { s, mine, room, pay, crowded: s.diggers + (mine ? 0 : 1) > room };
  });
  const best = rows.reduce<number>((b, r) => Math.max(b, r.pay), 0);
  return (
    <div className="sd-c-seams" role="dialog" aria-label="Pick a seam to dig" style={back ? ({ '--seam-back': `url(${back})` } as CSSProperties) : undefined}>
      <div className="sd-c-seams__head">
        <h2>Pick a seam to dig!</h2>
        <button type="button" className="sd-c-seams__close" onClick={onClose}>{mySeam === null ? 'Pick for me' : 'Back to digging'}</button>
      </div>
      <p className="sd-c-seams__hint">Rich seams pay more, but there is only room for a few diggers.</p>
      {said && <p className="sd-c-say sd-c-seams__say" role="alert">{said}</p>}
      <ul className="sd-c-seams__list">
        {rows.map(({ s, mine, room, pay, crowded }) => {
          const img = paint('goldrush', `seam-${s.kind}`);
          return (
            <li key={s.id}>
              <button type="button" className={`sd-c-seam sd-c-seam--${s.kind}${mine ? ' sd-c-seam--mine' : ''}${crowded ? ' sd-c-seam--crowded' : ''}`} aria-pressed={mine} onClick={() => onPick(s.id)}>
                <span className="sd-c-seam__pic" aria-hidden="true">{img ? <img src={img} alt="" /> : '⛏'}</span>
                <span className="sd-c-seam__info">
                  <strong>{SEAM_NAME[s.kind]}{mine && <em> · you are here</em>}{!mine && pay === best && best > 0 && <em className="sd-c-seam__best"> ★ best pay</em>}</strong>
                  <PayMeter pay={pay} crowded={crowded} />
                  <span className="sd-c-seam__who">⛏ {s.diggers} digging · room for {room}</span>
                  <span className="sd-c-seam__left" aria-label="Gold left"><i style={{ transform: `scaleX(${Math.max(0, Math.min(1, s.left / Math.max(1, s.size)))})` }} /></span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
