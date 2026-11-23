/**
 * How to play, in short sentences a 9-year-old can read on their own (James, 24 Nov 2026: the goal first, then how to
 * get there). Every number comes from shared/isles/config.ts, so changing a rule changes this page.
 */
import {
  BUILD_COINS, CALM_TURNS, CHUNK_PRICE, COINS, DECORATIONS, DRIFT_PER_DAY, FAIR_WIND, FIRST_WIN_PRIZE, GARDEN_PLACES, GIFT_COINS,
  GIFTS_RECEIVED_PER_DAY, GRAND_ISLE, HOUSE_ROOM, MOST_CHALLENGED, MOST_DRIFT_SAVED,
  LATER_WIN_PRIZE, LEVEL_CRYSTALS, LEVEL_TIMES, LIGHTHOUSE, MOST_TURNS_SAVED, RACES_PER_DAY, RACE_QUESTIONS, RAINBOW_CRYSTALS,
  TURNS_PER_DAY, WELL_RACED_COINS, WORKSHOP_CRYSTALS,
} from '../../../shared/isles/config';
import { KEY_HELP } from './keys';
import { crystalWords, n } from './words';

const pct = (x: number) => `${Math.round((x - 1) * 100)}%`;

export function HowToPlayBody() {
  const helps = DECORATIONS.filter((d) => 'help' in d);
  return (
    <div className="si-howto">
      <h3>What's the goal?</h3>
      <p>You look after a little island floating in the sky. Here's how to finish it:</p>
      <ol>
        <li><strong>Build and earn.</strong> Your buildings make coins every turn.</li>
        <li><strong>Grow your island.</strong> Buy the land that drifts by until you have {GRAND_ISLE} building spots. Now it's a <strong>Grand Isle</strong>! That's as big as an island gets.</li>
        <li><strong>Build the Sky Lighthouse.</strong> It has {LIGHTHOUSE.length} parts. Build all {LIGHTHOUSE.length} to light it.</li>
        <li><strong>Lighthouse lit!</strong> A sky garden floats over with {GARDEN_PLACES} more places for decorations, and you win the Lighthouse picture.</li>
      </ol>
      <p>The box at the top of your island always shows how far you've got and what to do next.</p>
      <p>Nothing bad ever happens. Nobody leaves, and the weather is always good.</p>

      <h3>Your turns</h3>
      <p>You get {TURNS_PER_DAY} turns a day. Turns you don't use are saved, up to {MOST_TURNS_SAVED}. Each turn has 4 steps:</p>
      <ol>
        <li><strong>Question.</strong> Get it right for a fair wind: {pct(FAIR_WIND)} more coins. Get it wrong and you just don't get the wind.</li>
        <li><strong>Collect.</strong> Your buildings make coins.</li>
        <li><strong>Build.</strong> Spend your coins. You can do lots of things in one turn.</li>
        <li><strong>Race or rest.</strong> Have a Sky Race, or end your turn.</li>
      </ol>

      <h3>Buildings</h3>
      <p>On your turn, tap an empty spot to build.</p>
      <ul>
        <li><strong>Farm</strong> costs {BUILD_COINS.farm} coins. Makes {COINS.farm} coins a turn.</li>
        <li><strong>Mine</strong> costs {BUILD_COINS.mine} coins. Makes {COINS.mine} coins a turn.</li>
        <li><strong>Library</strong> costs {BUILD_COINS.library} coins. Makes {COINS.library} coins a turn.</li>
        <li><strong>House</strong> costs {BUILD_COINS.house} coins. Makes {COINS.house} coins a turn, and {HOUSE_ROOM} islanders can move in.</li>
        <li><strong>Dock</strong> costs {BUILD_COINS.dock} coins. Makes {COINS.dock} coins a turn, and gives you a sky-boat so you go faster in Sky Races.</li>
        <li><strong>Workshop</strong> costs {BUILD_COINS.workshop} coins. Makes {COINS.workshop} coins and {crystalWords(WORKSHOP_CRYSTALS)} a turn. You need crystals for the Lighthouse!</li>
      </ul>

      <h3>Upgrading</h3>
      <p>
        Upgrade a building to make it earn more. Level 2 makes twice as much. It costs {LEVEL_TIMES[2]} times the building's price.
        Level 3 makes three times as much. It costs {LEVEL_TIMES[3]} times the price, plus {LEVEL_CRYSTALS[3]} sky crystals.
      </p>

      <h3>Getting more land</h3>
      <p>
        Each day, {DRIFT_PER_DAY === 1 ? 'a chunk' : `${DRIFT_PER_DAY} chunks`} of land drifts past your island. On your turn, anchor it for {n(CHUNK_PRICE)} coins.
        Each chunk is one new building spot. Missed a day? Up to {MOST_DRIFT_SAVED} chunks wait for you.
        Once you have {GRAND_ISLE} spots your island is full, and no more land comes.
      </p>

      <h3>Sky crystals</h3>
      <p>You need sky crystals for level 3 buildings, the Lighthouse and the fanciest decorations. You get them from:</p>
      <ul>
        <li><strong>Workshops</strong>: a little every turn. More Workshops, and higher levels, make more.</li>
        <li><strong>Rainbows</strong>: sometimes after a turn. Each one gives {crystalWords(RAINBOW_CRYSTALS)}.</li>
        <li><strong>Sky Races</strong>: your first win each day gives {FIRST_WIN_PRIZE.crystals} crystals.</li>
      </ul>

      <h3>The Sky Lighthouse</h3>
      <p>
        You can start it once your island is a Grand Isle. On your turn, go to Build and press <strong>Sky Lighthouse</strong>.
        The button shows up when you have enough coins and crystals for the next part.
      </p>
      <ul>
        {LIGHTHOUSE.map((stage, i) => <li key={i}>Part {i + 1}: {n(stage.coins)} coins and {stage.crystals} sky crystals</li>)}
      </ul>
      <p>If you have enough, you can build more than one part in the same turn.</p>

      <h3>Decorations</h3>
      <p>
        Put decorations around your island. Most are just pretty. A few help a bit:{' '}
        {helps.map((d, i) => <span key={d.id}>{i ? '; ' : ''}<strong>{d.name}</strong>: {d.does}</span>)}.
      </p>

      <h3>Sky Races</h3>
      <p>
        Race the Gull Riders or a classmate, up to {RACES_PER_DAY} times a day. You answer {RACE_QUESTIONS} questions as you go. Every right answer
        gives your boat a gust of wind. Your first win each day gives {FIRST_WIN_PRIZE.coins} coins and {FIRST_WIN_PRIZE.crystals} sky crystals.
        Later wins give {LATER_WIN_PRIZE.coins} coins. Didn't win? You still get {WELL_RACED_COINS} coins for racing well. You never lose anything.
      </p>

      <h3>Your class</h3>
      <p>
        Open <strong>Class sky</strong> to see your classmates' islands and the Sky news. <strong>Visit</strong> an island to look around.
        Nobody can see your coins or your maths.
      </p>
      <p>
        <strong>Send a gift</strong> once a day: flowers, a cake or a paper lantern. It gives them {GIFT_COINS} coins and it's free for you.
        An island can get up to {GIFTS_RECEIVED_PER_DAY} gifts a day.
      </p>
      <p>
        <strong>Race a classmate's island</strong> once a day each. A new island is safe for its first {CALM_TURNS} turns.
        An island can be raced {MOST_CHALLENGED} times a day, and it gets {WELL_RACED_COINS} coins whoever wins.
      </p>

      <h3>When does it end?</h3>
      <p>
        Your island lasts all season. When the season ends, every island that lit its Lighthouse goes in your class's Hall of the Skies forever.
        So do the class's top 3 islands. Then everyone starts a brand new island. You keep your Sky Keeper and your island's name.
      </p>

      <h3>Keyboard shortcuts</h3>
      <ul>
        {KEY_HELP.map(([key, does]) => <li key={key}><kbd>{key}</kbd>: {does}</li>)}
      </ul>
    </div>
  );
}
