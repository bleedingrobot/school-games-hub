import { AvatarImage } from '../../avatar/AvatarImage';
import type { Seat } from './Table';

/** A player's face: a bot's painted bird once it's painted (docs/101-ART-PLAN.md U.3), else their avatar. */
export function SeatFace({ seat, size }: { seat: Seat; size: number }) {
  if (seat.picture) {
    return <img className="c101-bird" src={seat.picture} alt="" aria-hidden="true" width={size} height={size} style={{ width: size, height: size }} />;
  }
  return <AvatarImage avatar={seat.avatar} size={size} />;
}
