/**
 * Bolt's help panel words (docs/TRADER-HINTS-PLAN.md, section 6): what each screen is for, and the word list. Numbers
 * come from the game's own config, so changing a rule changes the words.
 */
import { LOAN_MAX, LOAN_WEEKLY_PCT, MOON_PRICE, POD_HOLDS, SHIPYARD_TECH } from '../../../../shared/trader/config';

export type HelpScreen = 'trade' | 'ship' | 'bank' | 'map' | 'forge' | 'fight' | 'deal' | 'junk' | 'other';

const n = (x: number): string => x.toLocaleString('en-NZ');

/** "What's this screen?": 3 or 4 short points about the screen that's open. */
export function screenHelp(screen: HelpScreen): { title: string; points: string[] } {
  switch (screen) {
    case 'trade':
      return {
        title: 'The market',
        points: [
          'Step 1 is Sell: sell what is in your hold. Step 2 is Buy: fill your hold with something cheap.',
          '"You buy at" is what you pay. "You sell at" is what the planet pays you.',
          'Buy where a good is cheap, then fly to a planet that pays more for it. The difference is your profit.',
          'Pick your numbers, then press Trade in the bar at the bottom.',
        ],
      };
    case 'ship':
      return {
        title: 'Your ship',
        points: [
          'Buy fuel here. Each square you fly uses 1 fuel.',
          `Mend your hull and buy upgrades at a shipyard (planets of tech level ${SHIPYARD_TECH} or more).`,
          `A cargo pod adds ${POD_HOLDS} holds. Bigger ships carry more, so every trip earns more.`,
          `Save ${n(MOON_PRICE)} credits to buy your own moon.`,
        ],
      };
    case 'forge':
      return {
        title: 'The Star Forge',
        points: [
          'Design your own solar system. Planning is free and you can change your mind as often as you like.',
          'Tap the Sun or a planet card, then go through the steps: type, size, looks, effects, life, technology and name.',
          'Plans look like holograms. Press Build it to pay with credits and make a piece solid.',
          '"View in full screen" lets you fly round your system and take a picture of it.',
        ],
      };
    case 'bank':
      return {
        title: 'The bank',
        points: [
          `You can borrow up to ${n(LOAN_MAX)} credits.`,
          `Once a week the bank adds ${LOAN_WEEKLY_PCT}% of what you borrowed.`,
          'Part of each sale pays the loan back by itself.',
          'A loan only helps if you have a good trade to spend it on.',
        ],
      };
    case 'map':
      return {
        title: 'The star chart',
        points: [
          'Tap a planet to see its prices, what it bans and its coordinates.',
          'To jump, type its x (across) and y (up or down). Below the middle line, y is negative.',
          'The dotted shape shows how far your fuel takes you.',
          'Each jump uses one of your jumps for today.',
        ],
      };
    case 'fight':
      return {
        title: 'Pirates!',
        points: [
          '⚡ Charge fires your lasers. A right answer is a full-power shot.',
          '🛡️ Shields soak up their shots.',
          '💨 Flee tries to escape.',
          'If they win, they take some cargo, never your credits.',
        ],
      };
    case 'deal':
      return {
        title: 'A friendly trader',
        points: [
          'When you buy, a lower price than the planet is good.',
          'When you sell, a higher price than the planet is good.',
          'Check it fits in your hold and that you can pay.',
          'No thanks is always fine.',
        ],
      };
    case 'junk':
      return {
        title: 'Space junk',
        points: ['Answer the maths check to steer round the rocks.', 'A bump only scrapes your hull a little. Mend it at a shipyard.'],
      };
    default:
      return { title: 'Star Trader', points: ['Buy cheap, fly, sell for more.', `Save ${n(MOON_PRICE)} credits for your own moon.`] };
  }
}

/** Bolt's word list: each word in one kid-sized sentence. */
export function wordList(jumpsPerDay: number): [string, string][] {
  return [
    ['Credits', 'The money of space. 💰 shows how many you have.'],
    ['Profit', 'What you earn on a trade after taking away what you paid.'],
    ['Holds', 'The spaces in your ship for cargo. One good fills one hold.'],
    ['Cargo', 'The goods you carry in your holds.'],
    ['Fuel', 'What your ship burns to fly. Each square uses 1.'],
    ['Hull', "Your ship's body, like its health. Pirates and rocks damage it."],
    ['Jump', `Flying to another planet. You get ${jumpsPerDay} a day.`],
    ['Tech level', `How advanced a planet is. Shipyards are on tech level ${SHIPYARD_TECH} or more.`],
    ['Shipyard', 'Where you mend your ship and buy upgrades.'],
    ['Customs', 'Space police who check for banned goods.'],
    ['Banned', 'Not allowed on that planet. Customs take banned goods away.'],
    ['Bounty', 'A reward for beating pirates.'],
    ['Loan', 'Credits the bank lends you, which you pay back later.'],
    ['Interest', 'The extra the bank adds to a loan each week.'],
  ];
}
