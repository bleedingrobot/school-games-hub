/**
 * How to play. Every number comes from the game's own rules, so changing a number changes this page.
 */
import { useEffect, useRef } from 'react';
import { APPLE_HEALTH, GLASS_STING, MAX_SHOT_DAMAGE, ROUNDS_TO_WIN, START_HEALTH } from '../../../shared/archery/config';
import { FIGHT_POINTS, ROUND_POINTS, WIN_POINTS } from '../../../shared/archery/points';
import { CARRY_MOST, LEVEL_SPEND } from '../../../shared/archery/shop';
import { COINS_PER_RIGHT, EARNING_ROUNDS_PER_DAY, FIRST_SECONDS, POINT_AT, ROUND_QUESTIONS } from '../../../shared/archery/speed';
import { WORLD_IDS } from '../../../shared/archery/types';
import { WORLD_HINTS, WORLD_NAMES } from './text';

export function HowToPlay({ onBack }: { onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="ar-page ar-how" aria-labelledby="ar-how-title">
      <div className="ar-page__head">
        <h2 id="ar-how-title" ref={heading} tabIndex={-1}>How to play</h2>
        <button type="button" className="button button--light ar-btn" onClick={onBack}>Back</button>
      </div>
      <h3>Fights</h3>
      <ul>
        <li>Take turns with the bot. Set your <b>angle</b> and <b>power</b>, then Shoot. There's no aiming line: watch where your arrow lands, and change the numbers a bit. The wind pushes arrows; it stays the same all round.</li>
        <li>Each archer has {START_HEALTH} health in every round. At 0 you pop! First to win {ROUNDS_TO_WIN} rounds wins the fight.</li>
        <li>No single arrow can take more than {MAX_SHOT_DAMAGE} from you, so one lucky shot never ends a round.</li>
        <li>Keys: ← → angle, ↑ ↓ power (Shift for 5 at a time), space to shoot. On a touch screen, drag back from your archer like pulling a bowstring.</li>
      </ul>
      <h3>The worlds</h3>
      <ul>
        {WORLD_IDS.map((w) => <li key={w}><b>{WORLD_NAMES[w]}:</b> {WORLD_HINTS[w]}</li>)}
      </ul>
      <h3>Coins and the speed round</h3>
      <ul>
        <li>Coins come only from speed rounds: {ROUND_QUESTIONS} questions from your maths. The first has {FIRST_SECONDS} seconds, the next 9, and so on down to 1.</li>
        <li>Each right answer in time earns {COINS_PER_RIGHT} coins. A wrong answer just moves on.</li>
        <li>{EARNING_ROUNDS_PER_DAY} rounds a day earn coins. After that you can still practise.</li>
      </ul>
      <h3>The Armory</h3>
      <ul>
        <li>Spend coins on special arrows, helpers, shields and bows. You can carry {CARRY_MOST} of each arrow or helper.</li>
        <li>Spending raises your Armory level and opens more of the shop (level 5 at {LEVEL_SPEND[LEVEL_SPEND.length - 1]} coins spent).</li>
        <li>Pack what you want before each fight. Anything you don't use comes back.</li>
        <li>An Apple gives +{APPLE_HEALTH} health. An Umbrella opens by itself when you fall.</li>
        <li>The <b>Glass Arrow</b>: its shards stick in them. On their next turn they must hit you back, or they pop! Hitting back breaks the shards (they still sting for {GLASS_STING}).</li>
      </ul>
      <h3>Points</h3>
      <ul>
        <li>Finish a fight: {FIGHT_POINTS} points ({WIN_POINTS} if you win). Get {POINT_AT} or more right in a speed round: {ROUND_POINTS} point.</li>
        <li>A New Season starts everyone again with no coins and no gear.</li>
      </ul>
    </section>
  );
}
