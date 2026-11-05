/**
 * How to play, in plain words. Every number comes from shared/decree/config.ts, so changing a rule changes this page.
 */
import { CARDS_IN_REIGN, METER_MOST, METER_START, POINT_REIGNS_PER_DAY, RIDDLE_BONUS, RIDDLE_EVERY, SEASONS, WINTER_FOOD, YEARS } from '../../../shared/decree/config';
import { CAST } from '../../../shared/decree/cast';

export function HowToPlayBody() {
  return (
    <div className="rd-howto">
      <h3>Your job</h3>
      <p>You are the ruler of Riverstone. Villagers come to your throne one at a time, asking for things. Say yes or no.</p>
      <h3>The four meters</h3>
      <ul>
        <li><strong>Food, Gold, Happiness and Safety</strong> each start at {METER_START} and go up to {METER_MOST}.</li>
        <li>Before you choose, arrows show what will happen: ▲ goes up, ▼ goes down.</li>
        <li>If any meter reaches 0, your reign ends. Try to keep them all in the middle!</li>
        <li>Each new year, everyone has eaten through winter: Food −{WINTER_FOOD}.</li>
      </ul>
      <h3>Saying yes or no</h3>
      <ul>
        <li>Drag the card right for yes, or left for no.</li>
        <li>You can also press the two buttons, or the ← and → keys.</li>
      </ul>
      <h3>Maths visitors</h3>
      <p>Every {RIDDLE_EVERY === 3 ? 'third' : `${RIDDLE_EVERY}th`} visitor asks a maths question. A right answer gives +{RIDDLE_BONUS} to one meter and a star. A wrong answer or “Not now” costs nothing.</p>
      <h3>Winning</h3>
      <ul>
        <li>A full reign is {YEARS} years of {SEASONS} seasons ({CARDS_IN_REIGN} visitors).</li>
        <li>The Royal Album keeps every villager you meet ({CAST.length} in all) and every ending you see.</li>
        <li>Your first {POINT_REIGNS_PER_DAY} reigns each day give points. Longer reigns give more.</li>
      </ul>
    </div>
  );
}
