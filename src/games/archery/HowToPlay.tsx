/**
 * How to play. Every number comes from the game's own rules, so changing a number changes this page.
 */
import { useEffect, useRef } from 'react';
import { APPLE_HEALTH, DUEL_MAX_TIMEOUTS, DUEL_TURN_MS, GLASS_STING, MAX_SHOT_DAMAGE, ROUNDS_TO_WIN, START_HEALTH } from '../../../shared/archery/config';
import { DUEL_POINTS, DUEL_WIN_POINTS, FIGHT_POINTS, ROUND_POINTS, WIN_POINTS } from '../../../shared/archery/points';
import { CARRY_MOST, LEVEL_SPEND, START_COINS } from '../../../shared/archery/shop';
import {
  CHEST_LOSS_COINS, CHEST_WIN_COINS, COINS_PER_RIGHT, DAILY_COINS, FIRST_SECONDS, LAST_SECONDS, POINT_AT, ROUND_QUESTIONS, SHORT_QUESTIONS,
  SHORT_SECONDS, STREAK_AT, STREAK_BONUS,
} from '../../../shared/archery/speed';
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
      <h3>Fights against classmates</h3>
      <ul>
        <li><b>Challenge a classmate</b> shows who in your class has the game open. Pick a world and challenge them; they can say yes or no.</li>
        <li>You both pack your quivers, then it's <b>one round</b>: win it to win the fight. Whoever did more maths brings better gear!</li>
        <li>Each turn has {DUEL_TURN_MS / 1000} seconds. If the time runs out, that turn is missed. Miss {DUEL_MAX_TIMEOUTS} in a row and the fight stops.</li>
        <li>Leaving part-way lets the other player win, and nobody gets points.</li>
      </ul>
      <h3>The worlds</h3>
      <ul>
        {WORLD_IDS.map((w) => <li key={w}><b>{WORLD_NAMES[w]}:</b> {WORLD_HINTS[w]}</li>)}
      </ul>
      <h3>Coins come from maths</h3>
      <ul>
        <li><b>Loot chest:</b> after every fight, {SHORT_QUESTIONS} questions ({SHORT_SECONDS} seconds each). Each right answer earns {CHEST_WIN_COINS} coins if you won, {CHEST_LOSS_COINS} if you didn't.</li>
        <li><b>Restock:</b> between rounds of a bot fight, {SHORT_QUESTIONS} quick questions for {COINS_PER_RIGHT} coins each.</li>
        <li><b>Speed round:</b> {ROUND_QUESTIONS} questions from your maths. The first has {FIRST_SECONDS} seconds, the next 9, and so on down to {LAST_SECONDS}. {COINS_PER_RIGHT} coins for each one right in time.</li>
        <li>Get {STREAK_AT} or more right in a row and each one earns {STREAK_BONUS} extra. A wrong answer just moves on.</li>
        <li>Maths can earn up to {DAILY_COINS} coins a day. After that you can still practise.</li>
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
        <li>Finish a fight against a bot: {FIGHT_POINTS} points ({WIN_POINTS} if you win). Against a classmate: {DUEL_POINTS} points ({DUEL_WIN_POINTS} if you win).</li>
        <li>Get {POINT_AT} or more right in a speed round: {ROUND_POINTS} point.</li>
        <li>A New Season starts everyone again with {START_COINS} coins and no gear.</li>
      </ul>
    </section>
  );
}
