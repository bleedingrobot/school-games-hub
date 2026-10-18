/**
 * The courses as the picker shows them: the six New Zealand places (docs/MARBLE-PLAN.md, section 3), then the
 * practice courses the engine was built with. Only courses with a `playable` id (a course in shared/marble/courses.ts)
 * can be played; the rest say "coming soon" until stage M.3.
 *
 * The "Did you know?" lines are short and plain. James (or a colleague who knows te reo Māori) checks every one,
 * and the spelling of every place name, before go-live. Courses keep to public tracks and roads, never summits or sacred places.
 */
export interface CourseInfo {
  id: string;
  name: string;
  /** The real place it is inspired by. */
  place: string;
  /** What the course is like, in a few words. */
  blurb: string;
  /** 1 (gentle) to 6. */
  difficulty: number;
  didYouKnow?: string;
  /** The id in shared/marble/courses.ts, once the course is built. */
  playable?: string;
  practice?: boolean;
}

export const COURSE_INFO: readonly CourseInfo[] = [
  {
    id: 'boulder-beach', name: 'Boulder Beach', place: 'Moeraki Boulders, Otago', difficulty: 1,
    blurb: 'A wide sandy path with giant round boulders. Learn to steer.',
    didYouKnow: 'The Moeraki Boulders on Koekohe Beach are huge round stones that took millions of years to form, slowly, on the seabed.',
  },
  {
    id: 'crown-range', name: 'Crown Range Zig-Zag', place: 'Crown Range Road, Central Otago', difficulty: 2,
    blurb: 'Hairpin bends, gaps in the barriers and a snow-pole slalom.',
    didYouKnow: 'The Crown Range Road is the highest main road in New Zealand, about 1,076 metres above sea level.',
  },
  {
    id: 'geyser-valley', name: 'Geyser Valley', place: 'Rotorua', difficulty: 3,
    blurb: 'Geysers that puff you into the air, and popping mud pots.',
    didYouKnow: 'Pōhutu Geyser at Te Puia, Rotorua, can shoot hot water as high as 30 metres.',
  },
  {
    id: 'glacier-run', name: 'Glacier Run', place: 'Franz Josef Glacier, West Coast', difficulty: 4,
    blurb: 'Slippery ice at the top, then sticky mud and gravel at the bottom.',
    didYouKnow: 'Franz Josef Glacier also has a Māori name, Kā Roimata o Hine Hūkatere, which means the tears of Hine Hūkatere.',
  },
  {
    id: 'windy-welly', name: 'Windy Welly', place: 'Wellington', difficulty: 5,
    blurb: 'A cable car, sweeping crane arms and gusts of wind. Timing is everything.',
    didYouKnow: 'The Wellington Cable Car has carried people up the hill to Kelburn since 1902.',
  },
  {
    id: 'alpine-crossing', name: 'Alpine Crossing', place: 'Tongariro Alpine Crossing', difficulty: 6,
    blurb: 'A narrow ridge, crumbly rock and strong wind, ending at the Emerald Lakes.',
    didYouKnow: 'The Emerald Lakes get their bright colour from minerals washed into the water from the volcanic rock around them.',
  },
  { id: 'test-easy', name: 'Wide Hill', place: 'Practice course', difficulty: 1, blurb: 'A wide track with a mud patch.', playable: 'test-easy', practice: true },
  { id: 'test-hard', name: 'Gap and Ice', place: 'Practice course', difficulty: 3, blurb: 'A jump over a gap, then ice and a bumper.', playable: 'test-hard', practice: true },
];

export const infoFor = (playableId: string) => COURSE_INFO.find((c) => c.playable === playableId);
