import { CONFIG } from '../../../shared/clans/config';
import { ACHIEVEMENTS } from '../../../shared/clans/rewards';
import { VILLAGE_BUILDINGS } from '../../../shared/clans/types';

const R = CONFIG.rewards;
const percent = (x: number) => Math.round((x - 1) * 100);

/**
 * The words of "How to play", for a 9-year-old. Every number is read from CONFIG (or, for fights a day, from what the teacher chose),
 * never typed in twice. Short sections, two or three short lines each.
 */
export function HowToPlayBody({ fightsPerDay = CONFIG.fightsPerDay }: { fightsPerDay?: number }) {
  return (
    <>
      <p>Make a clan of {CONFIG.minMembers} heroes. Fight monsters in the Mines, spend your gold, train your heroes and build your own village. Everyone in your class has their own clan.</p>
      <div className="cq-howto">
        <section aria-labelledby="htp-clan">
          <h3 id="htp-clan">Your clan</h3>
          <p>You pick a race and a class for each hero. Don't like the numbers? Roll again. The first hero is your leader. You start with {CONFIG.startGold} gold. Heroes can reach level {CONFIG.maxLevel}.</p>
          <p>Each hero has four looks to pick from. It only changes the picture, and you can change it any time with “Change look”.</p>
        </section>
        <section aria-labelledby="htp-mines">
          <h3 id="htp-mines">The Mines</h3>
          <p>This is where you fight. Pick how deep to go. The tag says if it is too easy, just right, tough or too hard. Deeper means more experience, but harder monsters. Bosses wait at some depths.</p>
          <p>You get <strong>{fightsPerDay} fights a day</strong>. They all come back tomorrow.</p>
          <p>Heroes who are knocked out are not gone for good. They wake up the next day, or at the Church.</p>
        </section>
        <section aria-labelledby="htp-cry">
          <h3 id="htp-cry">Battle Cry</h3>
          <p>Before each round you get a maths question from your own maths: the same kind you are working on in the other maths games. Get it right and your clan chooses a power-up: <strong>{percent(CONFIG.battleCryDamage)}% more damage</strong> or <strong>a little healing</strong> for everyone.</p>
          <p>Get it wrong? Nothing is lost, and the game shows you the right answer. There is no timer. Not sure? Press <strong>No thanks</strong> and the round goes on as normal.</p>
        </section>
        <section aria-labelledby="htp-keys">
          <h3 id="htp-keys">Using the keyboard</h3>
          <p>Each round your clan gets a plan: what every hero will do. Press <kbd>Enter</kbd> to fight with it, or <kbd>1</kbd>, <kbd>2</kbd>, <kbd>3</kbd> to change one hero's order first.</p>
          <p>Changing an order: <kbd>A</kbd> to attack, <kbd>S</kbd> for a spell, <kbd>G</kbd> to guard and <kbd>R</kbd> to run. <kbd>1</kbd>, <kbd>2</kbd>, <kbd>3</kbd> pick from a list. <kbd>Esc</kbd> goes back to the plan.</p>
        </section>
        <section aria-labelledby="htp-shop">
          <h3 id="htp-shop">The Market</h3>
          <p>Buy weapons and armour for your heroes. There is a village tax of {CONFIG.shopTax}% on prices, so check the bill with maths. Paying {CONFIG.examinePercent}% of the price lets you look at the item's real numbers first.</p>
        </section>
        <section aria-labelledby="htp-train">
          <h3 id="htp-train">The Training Hall</h3>
          <p>Every level up gives {CONFIG.pointsPerLevel} training points. Spend them to make a hero stronger, quicker, wiser or tougher.</p>
        </section>
        <section aria-labelledby="htp-church">
          <h3 id="htp-church">The Church</h3>
          <p>Wakes up knocked-out heroes. The first {CONFIG.freeWakesPerDay === 1 ? 'one' : CONFIG.freeWakesPerDay} each day {CONFIG.freeWakesPerDay === 1 ? 'is' : 'are'} free. After that it costs a little gold.</p>
        </section>
        <section aria-labelledby="htp-village">
          <h3 id="htp-village">My Village</h3>
          <p>Your clan has its own village with {VILLAGE_BUILDINGS.length} buildings. You pay for them with your gold. Press <strong>Upgrade</strong> to make a building one level bigger. Each level costs more than the last.</p>
          <p>Your builders can do <strong>{CONFIG.empire.buildsPerDay} upgrades a day</strong>. Before an upgrade you may get a quick maths question about the building's space. Not sure? No harm done: the upgrade still happens.</p>
        </section>
        <section aria-labelledby="htp-troops">
          <h3 id="htp-troops">Troops</h3>
          <p>Build a Barracks so troops have somewhere to live. Followers you win in the Mines join as footmen by themselves while there is room. You can also buy axemen and knights.</p>
          <p>Your army strength adds them up: a footman counts {CONFIG.empire.troopMight.footman}, an axeman {CONFIG.empire.troopMight.axeman} and a knight {CONFIG.empire.troopMight.knight}.</p>
        </section>
        <section aria-labelledby="htp-kingdoms">
          <h3 id="htp-kingdoms">Raids on kingdoms</h3>
          <p>Pick a computer kingdom, then pick <strong>Careful</strong>, <strong>Steady</strong> or <strong>Bold</strong>. A colour tells you if you should win. A win brings gold home, but some troops may not come back.</p>
          <p>You can raid <strong>{CONFIG.empire.raids.kingdomPerDay} computer {CONFIG.empire.raids.kingdomPerDay === 1 ? 'kingdom' : 'kingdoms'} a day</strong>. A practice battle costs nothing and does not use up your raid.</p>
        </section>
        <section aria-labelledby="htp-quests">
          <h3 id="htp-quests">Quests</h3>
          <p>{CONFIG.quests.perDay === 1 ? 'One' : CONFIG.quests.perDay} short story a day. You choose what to do, and sometimes there is a puzzle. A very charming clan gets extra choices.</p>
        </section>
        <section aria-labelledby="htp-raids">
          <h3 id="htp-raids">Raids on classmates</h3>
          <p>Your teacher can switch these on or off. When they are on, you can raid <strong>{CONFIG.empire.raids.perDay} classmate a day</strong> whose army is about as big as yours. Pick gold, or knock a level or two off their buildings. You take at most {CONFIG.empire.raids.classmateLootMax}%.</p>
          <p>Gold kept in a Strongroom is safe, and Walls protect buildings. A new clan is safe for {CONFIG.empire.raids.newClanDays} days. A clan that was raided rests behind a shield the next {CONFIG.empire.raids.shieldDays === 1 ? 'day' : `${CONFIG.empire.raids.shieldDays} days`} too.</p>
        </section>
        <section aria-labelledby="htp-season">
          <h3 id="htp-season">Seasons and the village goal</h3>
          <p>A season lasts 5 weeks, on the same dates as Dragon Maths. Finish every building to earn the <strong>Master Builder</strong> badge, {CONFIG.season.villageReward.fame} fame and a place in the Hall of Legends.</p>
          <p>Builds you don't use are saved, up to {CONFIG.empire.buildsSavedMax}. In the last two weeks, raids on classmates rest. A new season starts every clan fresh, but badges and the Hall stay.</p>
        </section>
        <section aria-labelledby="htp-monster">
          <h3 id="htp-monster">The season monster</h3>
          <p>From day {CONFIG.season.monsterFrom}, a huge monster attacks. You get <strong>one try a day</strong>: first the <strong>siege</strong>, where your village fights it, then your clan fights what is left. Guard when it warns you!</p>
          <p>Each lost try leaves it <strong>{Math.round(CONFIG.monster.tiredPerLoss * 100)}% weaker</strong>, and nothing real is lost. The Market sells supplies from day {CONFIG.season.warnFrom}; press <kbd>P</kbd> for a healing potion. Win the <strong>Giant Slayer</strong> badge! The giant, golem and troll take turns each season.</p>
        </section>
        <section aria-labelledby="htp-fame">
          <h3 id="htp-fame">Fame and the Scoreboard</h3>
          <p>Fame goes up when you win: <strong>{R.fame.mineWin}</strong> for a fight in the Mines, <strong>{R.fame.bossWin}</strong> for a boss, <strong>{R.fame.warWin}</strong> for a practice battle, <strong>{R.fame.kingdomRaidWin}</strong> for a raid on a kingdom and <strong>{R.fame.classRaidWin}</strong> for a raid on a classmate.</p>
          <p>Fame never goes down, and it never comes from maths scores. The Scoreboard shows clan names and fame only.</p>
        </section>
        <section aria-labelledby="htp-ach">
          <h3 id="htp-ach">Achievements</h3>
          <p>There are {ACHIEVEMENTS.length} to collect, like your first win or reaching level {ACHIEVEMENTS.find((a) => a.measure === 'clan_level')?.goal}. Each one earns bonus points. The Achievements page shows how to get each one.</p>
        </section>
      </div>
    </>
  );
}

/** The How to play screen, reached from the clan page. */
export function HowToPlay({ fightsPerDay, onBack }: { fightsPerDay?: number; onBack: () => void }) {
  return (
    <section className="cq-howtoplay" aria-label="How to play">
      <div className="cq-place__head">
        <h2>How to play</h2>
        <button type="button" className="cq-btn" onClick={onBack}>Back to the clan</button>
      </div>
      <HowToPlayBody fightsPerDay={fightsPerDay} />
      <div className="cq-actions"><button type="button" className="cq-btn" onClick={onBack}>Back to the clan</button></div>
    </section>
  );
}
