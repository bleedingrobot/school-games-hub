/**
 * Toon Flap Relay's Bella lines (docs/RELAY-PLAN.md): a sports commentator who only ever names team colours, never a
 * pupil, and never calls out a bump. Spread into LINES and the clip list in voiceLines.ts. No numbers, so every line has
 * a clip. A few takes each, said in turn.
 */
const COLOURS = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange'] as const;

const perColour = (key: string, takes: (c: string) => string[]) =>
  Object.fromEntries(COLOURS.map((c) => [`${key}${c}`, takes(c)])) as Record<string, string[]>;

export const RELAY_LINES = {
  relayStart: ['Welcome to the Toon Flap Relay! Flyers, get ready!', 'It is relay time! Find your team colour!', 'The Toon Flap Relay is about to begin!'],
  relayRace: ['Next race! New teams, new course!', 'Here comes another race! Check your new team!', 'Get ready for the next race!'],
  relayGo: ['Three, two, one, fly!', 'And they are off!', 'Go, go, go!'],
  relayTurn: ['Change flyers!', 'Pass the baton!', 'New flyer coming in!'],
  relayLast: ['Last stretch! The nest is close!', 'Nearly at the nest!', 'Here comes the finish!'],
  relayTime: ['Time is up! The furthest team wins!', 'That is time! Who got the furthest?', 'The race is over!'],
  relayFinish: ['What a relay! Well done, everyone!', 'Brilliant flying, everyone!', 'That was amazing teamwork!'],
  relayShield: ['Shield up!', 'A shield for the flyer!'],
  relayWide: ['Wide gaps! Fly through!', 'The gaps just got bigger!'],
  relaySlow: ['Slow motion!', 'Everything slows right down!'],
  relayTailwind: ['Tailwind! Zoom!', 'Whoosh! A big tailwind!'],
  relayMagnet: ['Magnet on! Straight through the middle!', 'A magnet pulls the flyer to safety!'],
  relayGhost: ['Ghost wings! Right through the wall!', 'Spooky! Ghost wings!'],
  relayMini: ['Mini bird! Tiny wings!', 'The bird shrinks down!'],
  relayClear: ['Clear sky! The trouble blows away!', 'A rainbow clears the sky!'],
  relayWind: ['Whoa, a gust of wind!', 'Windy weather ahead!'],
  relayFog: ['Fog rolls in!', 'Who turned on the fog?'],
  relayWall: ['An extra wall pops up!', 'Surprise! Another wall!'],
  relayNarrow: ['The gaps are getting narrow!', 'Squeeze through the narrow gaps!'],
  ...perColour('relayLead', (c) => [`${c} team takes the lead!`, `${c} is in front!`]),
  ...perColour('relayWin', (c) => [`${c} team wins the race!`, `A win for ${c} team!`]),
} as Record<string, readonly string[]>;

/** How to play (HowTo.tsx). */
export const RELAY_HOWTO = [
  'You are in a colour team. Teams race to the nest at the same time.',
  'Take turns to fly. Tap your device to flap. Each flyer has thirty seconds.',
  'Not flying? Answer questions. Each right answer gives you a spark.',
  'Spend sparks on perks for your own flyer, like a shield or wider gaps.',
  'Or send trouble to another team, like wind or fog. First team to the nest wins!',
] as const;

const turn: Record<string, number> = {};
/** The next take of a relay line, in turn (null for a key it doesn't have). */
export function relayLine(key: string): string | null {
  const takes = RELAY_LINES[key];
  if (!takes) return null;
  const n = turn[key] ?? 0;
  turn[key] = n + 1;
  return takes[n % takes.length];
}

export const allRelayLines = (): string[] => [...Object.values(RELAY_LINES).flat(), ...RELAY_HOWTO];

export { COLOURS as RELAY_COLOURS };
