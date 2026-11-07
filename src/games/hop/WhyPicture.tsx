/**
 * The picture for a wrong glow-worm (maths review R5, section 3.3): a small row of pads that shows the mistake. Hop sits
 * on the pad before the gap; a lit arc is the real hop; the wrong number is a faded, crossed-out ghost pad.
 *   off1  the real hop lands on the answer; the wrong number sits just beside it
 *   stay  Hop on its pad, the arc empty, going nowhere
 *   far   the real hop, then a ghost hop beyond it
 *   step / way  the real hop, and under it the wrong hop (a different step, or going the wrong way) crossed out
 */
import type { Friend as FriendName } from '../../../shared/hop/progress';
import type { Hop, HopMistake } from '../../../shared/hop/round';
import { Friend } from './HopArt';

interface Props {
  hop: Hop;
  kind: HopMistake;
  /** The wrong number picked. */
  wrong: number;
  friend: FriendName;
}

const Pad = ({ n, mod = '', children }: { n?: number | null; mod?: string; children?: React.ReactNode }) => (
  <span className={`hp-mini__pad ${mod}`}>
    {n ?? '?'}
    {children}
  </span>
);
const Arc = ({ label, mod = '' }: { label?: string; mod?: string }) => <span className={`hp-mini__arc ${mod}`}>{label}</span>;

export function WhyPicture({ hop, kind, wrong, friend }: Props) {
  const sign = hop.back ? '−' : '+';
  const frog = (
    <span className="hp-mini__frog" aria-hidden="true">
      <Friend friend={friend} pose="wait" />
    </span>
  );
  const start = (
    <Pad n={hop.before} mod="hp-mini__pad--here">
      {frog}
    </Pad>
  );
  const hopped = `${sign}${hop.size}`;
  const wrongHop = `${wrong > hop.before ? '+' : '−'}${Math.abs(wrong - hop.before)}`;
  let rows: React.ReactNode;
  switch (kind) {
    case 'off1':
      rows = (
        <div className="hp-mini__row">
          {start}
          <Arc label={hopped} mod="hp-mini__arc--lit" />
          <Pad n={hop.answer} mod="hp-mini__pad--glow" />
          <Pad n={wrong} mod="hp-mini__pad--ghost" />
        </div>
      );
      break;
    case 'stay':
      rows = (
        <div className="hp-mini__row">
          {start}
          <Arc mod="hp-mini__arc--empty" />
          <Pad mod="hp-mini__pad--gap" />
        </div>
      );
      break;
    case 'far':
      rows = (
        <div className="hp-mini__row">
          {start}
          <Arc label={hopped} mod="hp-mini__arc--lit" />
          <Pad mod="hp-mini__pad--gap" />
          <Arc label={hopped} mod="hp-mini__arc--ghost" />
          <Pad n={wrong} mod="hp-mini__pad--ghost" />
        </div>
      );
      break;
    default:
      rows = (
        <>
          <div className="hp-mini__row">
            {start}
            <Arc label={hopped} mod="hp-mini__arc--lit" />
            <Pad mod="hp-mini__pad--gap" />
          </div>
          <div className="hp-mini__row">
            <Pad n={hop.before} />
            <Arc label={wrongHop} mod="hp-mini__arc--ghost" />
            <Pad n={wrong} mod="hp-mini__pad--ghost" />
          </div>
        </>
      );
  }
  return <div className="hp-mini" aria-hidden="true">{rows}</div>;
}
