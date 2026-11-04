/**
 * How to play, in plain words. Every number comes from shared/isles/config.ts, so changing a rule changes this page.
 */
import {
  BUILD_COINS, CALM_TURNS, CHUNK_PRICE, COINS, DECORATIONS, DRIFT_PER_DAY, FAIR_WIND, FIRST_WIN_PRIZE, GARDEN_PLACES, GIFT_COINS,
  GIFTS_RECEIVED_PER_DAY, GRAND_ISLE, HOUSE_ROOM, MOST_CHALLENGED,
  LATER_WIN_PRIZE, LEVEL_CRYSTALS, LEVEL_TIMES, LIGHTHOUSE, MOST_TURNS_SAVED, RACES_PER_DAY, RACE_QUESTIONS, START, TURNS_PER_DAY,
  WELL_RACED_COINS,
} from '../../../shared/isles/config';
import { crystalWords } from './words';

const pct = (x: number) => `${Math.round((x - 1) * 100)}%`;

export function HowToPlayBody() {
  const helps = DECORATIONS.filter((d) => 'help' in d);
  return (
    <div className="si-howto">
      <h3>Your island</h3>
      <p>
        You look after a small floating island in the sky. It starts with {START.spots.length} building spots, {START.coins} coins and {START.islanders} islanders.
        Grow it to a <strong>Grand Isle</strong> ({GRAND_ISLE} spots), then light the <strong>Sky Lighthouse</strong> in {LIGHTHOUSE.length} stages.
        Nothing ever goes wrong: nobody leaves, and the weather is only ever good.
      </p>

      <h3>Each day</h3>
      <p>You have {TURNS_PER_DAY} turns a day. Turns you don't use wait for you, up to {MOST_TURNS_SAVED}. Some days your teacher may give unlimited turns. Each turn has 4 steps:</p>
      <ol>
        <li><strong>The sky pilot's question.</strong> Get it right for a fair wind: {pct(FAIR_WIND)} more coins this turn. Wrong just means no wind.</li>
        <li><strong>Collect.</strong> Every building makes coins.</li>
        <li><strong>Build.</strong> Build, raise buildings, anchor land and put up decorations.</li>
        <li><strong>Race or rest.</strong> A Sky Race, or End turn.</li>
      </ol>

      <h3>Buildings</h3>
      <ul>
        <li><strong>Farm</strong> ({BUILD_COINS.farm} coins): {COINS.farm} coins a turn.</li>
        <li><strong>Mine</strong> ({BUILD_COINS.mine} coins): {COINS.mine} coins a turn.</li>
        <li><strong>House</strong> ({BUILD_COINS.house} coins): {COINS.house} coins a turn, and room for {HOUSE_ROOM} islanders.</li>
        <li><strong>Dock</strong> ({BUILD_COINS.dock} coins): {COINS.dock} coins a turn, and +1 sky-boat, so your boat is a little faster in Sky Races. Each Dock level adds a sky-boat; each new one helps a bit less than the last.</li>
        <li><strong>Workshop</strong> ({BUILD_COINS.workshop} coins): {COINS.workshop} coins and {crystalWords(0.25)} a turn.</li>
        <li><strong>Library</strong> ({BUILD_COINS.library} coins): {COINS.library} coins a turn.</li>
      </ul>
      <p>
        A building can be raised to level 2 (it makes twice as much) for {LEVEL_TIMES[2]} times its price, and to level 3 (three times as much) for{' '}
        {LEVEL_TIMES[3]} times its price and {LEVEL_CRYSTALS[3]} sky crystals.
      </p>

      <h3>Land and islanders</h3>
      <p>
        Each day the wind brings {DRIFT_PER_DAY === 1 ? 'a chunk' : `${DRIFT_PER_DAY} chunks`} of land drifting past. Anchor it for {CHUNK_PRICE} coins to add a building spot.
        Islanders move in while there's room, and they never leave.
      </p>

      <h3>Sky crystals</h3>
      <p>Sky crystals come from Workshops, rainbows and your first Sky Race win each day. They raise buildings to level 3, build the Sky Lighthouse and buy the grandest decorations.</p>

      <h3>Decorations</h3>
      <p>
        Put decorations on the decoration places around your island. Most are just pretty. A few help a little:{' '}
        {helps.map((d, i) => <span key={d.id}>{i ? '; ' : ''}<strong>{d.name}</strong>: {d.does}</span>)}. Once the Lighthouse is lit, a sky garden floats by with {GARDEN_PLACES} more places.
      </p>

      <h3>Sky Races</h3>
      <p>
        Race the Gull Riders, or a classmate's island, up to {RACES_PER_DAY} times a day. You answer {RACE_QUESTIONS} questions during the race: each right answer is a gust of wind for your boat. The day's first win brings{' '}
        {FIRST_WIN_PRIZE.coins} coins and {FIRST_WIN_PRIZE.crystals} sky crystals, a later win {LATER_WIN_PRIZE.coins} coins. If you don't win, you still get {WELL_RACED_COINS} coins for racing well.
        Nobody ever loses anything.
      </p>

      <h3>Your class</h3>
      <p>
        The <strong>Class sky</strong> shows your classmates' islands and the Sky news (good news only). <strong>Visit</strong> an island to look around:
        you see its buildings, decorations and islanders, never its coins or maths.
      </p>
      <p>
        <strong>Leave a gift</strong> (flowers, a cake or a paper lantern): it gives them {GIFT_COINS} coins and costs you nothing. You can leave one gift a day,
        and an island can get up to {GIFTS_RECEIVED_PER_DAY} a day. Gifts wait in the Sky post until they next open Sky Isles.
      </p>
      <p>
        <strong>Race a classmate's island:</strong> once a day each, after the island's first {CALM_TURNS} turns, and an island can be raced {MOST_CHALLENGED} times
        a day. Their island races at home and gets {WELL_RACED_COINS} coins for racing well, whoever wins.
      </p>
    </div>
  );
}
