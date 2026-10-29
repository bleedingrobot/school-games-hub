import beachFull from './art/boulder-beach.webp';
import beachSmall from './art/boulder-beach-small.webp';

/** Extra look settings per course. Only the try-out course (Boulder Beach) has the new "toy diorama" look so far. */
export interface Look {
  /** Sun shadows, soft corner darkening, patterned tops, edge lines, slope stripes, low rails, sky gradient. */
  diorama: boolean;
  topPattern: 'sand' | 'none';
  rail: 'driftwood' | 'block';
  skyTop: number;
  skyBottom: number;
  sunColour: number;
  /** A painted picture behind the course (the full size, and a smaller one for Simple). The gradient sky shows until it loads. */
  backdrop?: { full: string; small: string };
}

const PLAIN: Look = { diorama: false, topPattern: 'none', rail: 'block', skyTop: 0xcfe9f3, skyBottom: 0xcfe9f3, sunColour: 0xfff4e0 };

const LOOKS: Record<string, Look> = {
  'boulder-beach': { diorama: true, topPattern: 'sand', rail: 'driftwood', skyTop: 0x7fc4ec, skyBottom: 0xfdf0d5, sunColour: 0xffe2b0, backdrop: { full: beachFull, small: beachSmall } },
};

export function lookFor(courseId: string): Look {
  return LOOKS[courseId] ?? PLAIN;
}
