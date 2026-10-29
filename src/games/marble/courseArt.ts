/**
 * Course pictures for the picker cards and Play buttons.
 *
 * To add a course picture: put `<course-id>.webp` (big) and `<course-id>-small.webp` in `art/`, then add two
 * import lines and one line in ART below. A course with no picture yet gets a soft gradient from its palette.
 */
import { paletteFor } from './palette';
import boulderBeach from './art/boulder-beach.webp';
import boulderBeachSmall from './art/boulder-beach-small.webp';
import crownRange from './art/crown-range.webp';
import crownRangeSmall from './art/crown-range-small.webp';
import geyserValley from './art/geyser-valley.webp';
import geyserValleySmall from './art/geyser-valley-small.webp';
import glacierRun from './art/glacier-run.webp';
import glacierRunSmall from './art/glacier-run-small.webp';
import windyWelly from './art/windy-welly.webp';
import windyWellySmall from './art/windy-welly-small.webp';
import alpineCrossing from './art/alpine-crossing.webp';
import alpineCrossingSmall from './art/alpine-crossing-small.webp';
import wideHill from './art/wide-hill.webp';
import wideHillSmall from './art/wide-hill-small.webp';
import gapAndIce from './art/gap-and-ice.webp';
import gapAndIceSmall from './art/gap-and-ice-small.webp';

export interface CourseArt {
  /** The big picture. */
  card: string;
  /** The smaller file, used for the card and the Play button. */
  small: string;
  /** CSS background-position for the Play button strip (default 'center 65%'). */
  focus?: string;
}

/** One line per course that has a picture. */
const ART: Record<string, CourseArt> = {
  'boulder-beach': { card: boulderBeach, small: boulderBeachSmall, focus: 'center 75%' },
  'crown-range': { card: crownRange, small: crownRangeSmall },
  'geyser-valley': { card: geyserValley, small: geyserValleySmall },
  'glacier-run': { card: glacierRun, small: glacierRunSmall },
  'windy-welly': { card: windyWelly, small: windyWellySmall },
  'alpine-crossing': { card: alpineCrossing, small: alpineCrossingSmall },
  'wide-hill': { card: wideHill, small: wideHillSmall },
  'gap-and-ice': { card: gapAndIce, small: gapAndIceSmall },
};

/** The pictures for a course, or null if it has none yet. */
export function courseArt(id: string): CourseArt | null {
  return Object.prototype.hasOwnProperty.call(ART, id) ? ART[id] : null;
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** A soft gradient from the course's colours (sky down to floor), for a course with no picture. */
export function courseGradient(id: string): string {
  const p = paletteFor(id);
  return `linear-gradient(160deg, ${hex(p.sky)} 0%, ${hex(p.floorA)} 100%)`;
}

/** The course's own colour, for thin borders. */
export function courseAccent(id: string): string {
  const p = paletteFor(id);
  return hex(p.side);
}
