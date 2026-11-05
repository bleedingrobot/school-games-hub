/**
 * Royal Decree's step-by-step tutorial (James, 6 Nov 2026: "on by default, and able to be turned off"). Hale walks the
 * player through the real first villager of a new reign: the meters, the year road, the card, the arrows on the
 * answers, then the player makes the first choice and sees the meters move. The switch lives on the start screen and is
 * kept on this device (never on the server), so turning it off sticks for that pupil's computer.
 */
import { METER_NAME, METERS, RIDDLE_BONUS, RIDDLE_EVERY, YEARS, type Meter } from '../../../shared/decree/config';

/** The part of the screen a step points at. */
export type Spot = 'none' | 'meters' | 'road' | 'card' | 'choices';

export interface TourStep {
  spot: Spot;
  text: string;
  /** The player does this step themselves (makes a choice), so it has no "Next step" button. */
  yourTurn?: boolean;
}

const nth = RIDDLE_EVERY === 3 ? 'third' : `${RIDDLE_EVERY}th`;

export const TOUR: TourStep[] = [
  { spot: 'none', text: 'Welcome, Your Majesty! I’m Hale, your helper. Let me show you how to rule Riverstone.' },
  { spot: 'meters', text: 'These are your four meters: Food, Gold, Happiness and Safety. If any one of them reaches 0, your reign ends!' },
  { spot: 'road', text: `Your reign lasts ${YEARS} years. Each dot is one visitor. Reach the last dot to win!` },
  { spot: 'card', text: 'Here comes a villager. Read what they are asking for.' },
  { spot: 'choices', text: 'Each answer shows what it will do. ▲ means that meter goes up. ▼ means it goes down.' },
  { spot: 'card', yourTurn: true, text: 'Your turn! Drag the card right for yes, or left for no. You can press a button too.' },
  { spot: 'meters', text: 'Look at your meters! Every choice helps something, and most cost something too.' },
  { spot: 'none', text: `Every ${nth} visitor asks a maths question. A right answer gives +${RIDDLE_BONUS} to a meter. That’s it. Rule well!` },
];

/** Hale's tips during play: the first-reign ones (when the tutorial didn't run) and the low-meter warning. */
export const TIPS = {
  swipe: 'Drag the card right to say yes, or left to say no. You can press the buttons too.',
  arrows: 'Before you choose, look at the arrows on the meters. ▲ goes up, ▼ goes down.',
  riddle: `Every ${nth} visitor needs help with a maths question. A right answer gives +${RIDDLE_BONUS}!`,
  low: (m: Meter) => `${METER_NAME[m]} is getting low! If it reaches 0, your reign ends. Look for choices with ▲ on ${METER_NAME[m]}.`,
};

/** Everything Hale says out loud: the tutorial and the tips (src/games/decree/voice.test.ts keeps the clips in step). */
export const HALE_LINES: string[] = [...TOUR.map((s) => s.text), TIPS.swipe, TIPS.arrows, TIPS.riddle, ...METERS.map(TIPS.low)];

/** The words Hale's voice reads for a line: the arrows and "+1" as words. */
export const spoken = (text: string): string =>
  text.replace(/▲ means/g, 'An up arrow means').replace(/▼ means/g, 'A down arrow means')
    .replace(/▲ goes/g, 'an up arrow goes').replace(/▼ goes/g, 'a down arrow goes')
    .replace(/with ▲ on/g, 'with an up arrow on').replace(/\+(\d)/g, 'plus $1');

export const VOICE_FOLDER = 'voice/decree/';

/** The step where the player makes the first choice themselves. */
export const YOUR_TURN = TOUR.findIndex((s) => s.yourTurn);

const KEY = 'sgh-decree-tutorial';
const VOICE_KEY = 'sgh-decree-voice';

/** On unless this device turned it off. */
export function tutorialOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setTutorialOn(on: boolean): void {
  try {
    if (on) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, 'off');
  } catch {
    // Not remembered, that's all.
  }
}

/** Hale's voice (Kokoro af_bella clips, see scripts/voice-clips.py): on unless this device turned it off. */
export function haleVoiceOn(): boolean {
  try {
    return localStorage.getItem(VOICE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setHaleVoiceOn(on: boolean): void {
  try {
    if (on) localStorage.removeItem(VOICE_KEY);
    else localStorage.setItem(VOICE_KEY, 'off');
  } catch {
    // Not remembered, that's all.
  }
}
