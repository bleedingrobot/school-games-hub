/**
 * How to play, in plain words. Every number comes from shared/isles/config.ts, so changing a rule changes this page.
 */
import {
  BUILD_COINS, CHUNK_PER_SPOT, DRIFT_PER_DAY, FAIR_WIND, FARM_FOOD, FESTIVAL_COINS, FESTIVAL_HAPPINESS, FIRST_WIN_PRIZE, FOOD_PER_PERSON,
  GRAND_ISLE, HOUSE_ROOM, LATER_WIN_PRIZE, LEVEL_GOODS, LEVEL_TIMES, LIGHTHOUSE, MINE_COINS, MOST_TURNS_SAVED, PEOPLE_PER_TAX_COIN, RACES_PER_DAY,
  RACE_QUESTIONS, START, TURNS_PER_DAY, UPGRADES, WELL_RACED_COINS,
} from '../../../shared/isles/config';

const pct = (x: number) => `${Math.round((x - 1) * 100)}%`;

export function HowToPlayBody() {
  return (
    <div className="si-howto">
      <h3>Your island</h3>
      <p>
        You keep a small floating island in the sky. It starts with {START.spots.length} building spots, {START.coins} coins, {START.food} food and {START.people} people.
        Grow it to a <strong>Grand Isle</strong> ({GRAND_ISLE} spots), then light the <strong>Sky Lighthouse</strong> in {LIGHTHOUSE.length} stages.
      </p>

      <h3>Each day</h3>
      <p>You have {TURNS_PER_DAY} turns a day. Turns you don't use wait for you, up to {MOST_TURNS_SAVED}. Each turn:</p>
      <ul>
        <li><strong>The sky pilot's question.</strong> Get it right for a fair wind: everything you collect this turn grows by {pct(FAIR_WIND)}. Wrong just means no wind. You never lose anything.</li>
        <li><strong>Collect.</strong> Your buildings make food, coins, sky-boats, goods and ideas.</li>
        <li><strong>Feed.</strong> Each person eats {FOOD_PER_PERSON === 0.5 ? 'half a food' : `${FOOD_PER_PERSON} food`} a turn. Without enough food, some people go to stay with a neighbour.</li>
        <li><strong>Spend.</strong> Anchor land, build, raise buildings, set your tax, and more. Then press <strong>End turn</strong>.</li>
      </ul>

      <h3>Buildings</h3>
      <ul>
        <li><strong>Farm</strong> ({BUILD_COINS.farm} coins): {FARM_FOOD} food a turn.</li>
        <li><strong>Mine</strong> ({BUILD_COINS.mine} coins): {MINE_COINS} coins a turn.</li>
        <li><strong>Dock</strong> ({BUILD_COINS.dock} coins): more coins when your people are happy.</li>
        <li><strong>House</strong> ({BUILD_COINS.house} coins): room for {HOUSE_ROOM} people.</li>
        <li><strong>Workshop</strong> ({BUILD_COINS.workshop} coins): sky-boats or goods. You choose the mix.</li>
        <li><strong>Library</strong> ({BUILD_COINS.library} coins): ideas, for upgrades.</li>
      </ul>
      <p>
        Every building can be raised to level 2 (it makes twice as much) for {LEVEL_TIMES[2]} times its price, and to level 3 (three times as much) for{' '}
        {LEVEL_TIMES[3]} times its price and {LEVEL_GOODS[3]} goods.
      </p>

      <h3>Land</h3>
      <p>
        Each day the wind brings {DRIFT_PER_DAY === 1 ? 'a chunk' : `${DRIFT_PER_DAY} chunks`} of land drifting past. Anchor it to add a building spot. A chunk costs {CHUNK_PER_SPOT} coins for every spot you already have,
        so small islands can catch up.
      </p>

      <h3>Tax and happiness</h3>
      <ul>
        <li><strong>Low:</strong> 1 coin from every {PEOPLE_PER_TAX_COIN.low} people. People get happier.</li>
        <li><strong>Fair:</strong> 1 coin from every {PEOPLE_PER_TAX_COIN.fair} people.</li>
        <li><strong>High:</strong> 1 coin from every {PEOPLE_PER_TAX_COIN.high} people. People get grumpy, and fewer move in.</li>
      </ul>
      <p>A festival costs {FESTIVAL_COINS} coins and adds {FESTIVAL_HAPPINESS} happiness, once a day. Happy people make Docks earn more.</p>

      <h3>Sky Races</h3>
      <p>
        Race the Gull Riders up to {RACES_PER_DAY} times a day. You answer {RACE_QUESTIONS} questions: each right answer is a gust of wind for your boat. The day's first win brings{' '}
        {FIRST_WIN_PRIZE.coins} coins and {FIRST_WIN_PRIZE.goods} goods, a later win {LATER_WIN_PRIZE.coins} coins. If you lose, you still get {WELL_RACED_COINS} coins for racing well.
        Nobody ever loses anything.
      </p>

      <h3>Upgrades</h3>
      <ul>
        {UPGRADES.map((u) => <li key={u.id}><strong>{u.name}</strong> ({u.ideas} ideas): {u.does}.</li>)}
      </ul>
    </div>
  );
}
