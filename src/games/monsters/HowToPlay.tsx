/**
 * "How to play" for Maths Monsters, in plain words for a 9-year-old. It is shown on the new-game screen and
 * from the map Menu. Numbers come from the game's own rules (steps a Repel lasts, how many badges, the six
 * types and their topics), never typed in twice. Short sections with real headings, so a screen reader
 * can jump between them. Points are explained on the hub's "How points work" page.
 */
import { TOPICS } from '../../../shared/maths/skillPacks';
import { AREAS, FOLLOW_BADGES } from '../../../shared/monsters/world/areas';
import { BATTLES_PER_DAY } from '../../../shared/monsters/world/battleCap';
import { REPEL_STEPS } from '../../../shared/monsters/world/rewards';
import { MAX_TEAM } from '../../../shared/monsters/engine';
import { TYPE_LABEL, TYPE_TOPIC, TYPES, strongAgainst } from '../../../shared/monsters/types';
import { EGGS, HATCH_SPOTS } from '../../../shared/monsters/quests/eggs';
import { GIANTS } from '../../../shared/monsters/quests/giants';
import { QUESTS } from '../../../shared/monsters/quests/quests';
import { TypeChart } from './TypeChart';

const topicLabel = (id: string) => TOPICS.find((t) => t.id === id)?.label ?? id;

export function HowToPlayBody() {
  return (
    <div className="mm-howto">
      <p>
        Walk around New Zealand, find monsters in the long grass, battle them and catch them. <strong>Every attack and every catch is a maths question.</strong>{' '}
        A wrong answer never loses your game.
      </p>

      <section aria-labelledby="mht-walk">
        <h3 id="mht-walk">Walking</h3>
        <ul>
          <li><strong>Keyboard:</strong> the arrow keys or <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>. Hold a key to keep walking.</li>
          <li><strong>Mouse or touch:</strong> tap a spot on the map and you walk there. Tap a person, sign or chest to walk up and talk.</li>
          <li><strong>On-screen arrows:</strong> switch them on in Settings if you like buttons better.</li>
          <li><kbd>Space</kbd> or <kbd>Enter</kbd> talks to what you are facing, or moves the words on. <kbd>M</kbd> or <kbd>Esc</kbd> opens the Menu.</li>
        </ul>
      </section>

      <section aria-labelledby="mht-battle">
        <h3 id="mht-battle">Battles</h3>
        <p>
          A wild monster might jump out when you walk in <strong>long grass</strong>. Trainers battle you when they see you. In a battle choose <strong>Fight</strong>, <strong>Team</strong>, <strong>Bag</strong> or{' '}
          <strong>Run</strong> (you can’t run from a trainer). The keys <kbd>1</kbd> to <kbd>4</kbd> pick from the list, and <kbd>Esc</kbd> goes back.
        </p>
        <p>
          <strong>Wild monsters:</strong> the first time you pick an attack, a <strong>Power up</strong> maths question pops up. Get it right and every attack hits harder for the
          rest of that battle (a quick answer powers up even more). Get it wrong and the game shows you the right answer, and your attacks hit as normal. After that, attacks ask nothing.
        </p>
        <p>
          <strong>Trainers, Tower leaders and sleeping giants:</strong> every attack asks a maths question. <strong>Get it right and the attack hits.</strong> A quick right answer hits extra hard.
          <strong> Get it wrong</strong> and the attack is only a small hit, and the game shows you the right answer. There is no losing a turn for being slow.
        </p>
        <p>Enemy monsters hit back without asking you anything. If all your monsters get tired, you hurry back to your last healing spot and keep everything.</p>
        <p>
          Your monsters can have <strong>{BATTLES_PER_DAY} battles a day</strong>. After that they rest until tomorrow: no wild monsters and no trainers, but you can still explore and battle in the Towers. Running away before a question doesn’t count. Some days your teacher may give unlimited battles.
        </p>
      </section>

      <section aria-labelledby="mht-catch">
        <h3 id="mht-catch">Catching</h3>
        <p>
          In a wild battle, open the Bag and throw a ball. You answer a question first: <strong>a right answer makes the catch much more likely</strong>. Weak, tired monsters are easier to catch.
          You can’t catch a trainer’s monster. Your team holds {MAX_TEAM}; the rest wait safely in the Monster box in Harbour Town.
        </p>
      </section>

      <section aria-labelledby="mht-types">
        <h3 id="mht-types">Types and maths</h3>
        <p>Each type of monster asks its own kind of maths. A type hits the next one in the list extra hard.</p>
        <TypeChart />
        <ul>
          {TYPES.map((t) => (
            <li key={t}>
              <strong>{TYPE_LABEL[t]}</strong>: {topicLabel(TYPE_TOPIC[t])}. Strong against {TYPE_LABEL[strongAgainst(t)]}.
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="mht-grow">
        <h3 id="mht-grow">Growing</h3>
        <p>Monsters that win battles get experience, gain levels and some grow into new monsters. The Monster book remembers every monster you have met or caught.</p>
      </section>

      <section aria-labelledby="mht-heal">
        <h3 id="mht-heal">Healing and the Bag</h3>
        <p>
          Talk to a nurse (the Healing Centre) to make your whole team well again. That is also where you wake up if you lose. Potions heal one monster. A Repel stops wild
          battles for {REPEL_STEPS} steps in long grass.
        </p>
      </section>

      <section aria-labelledby="mht-towers">
        <h3 id="mht-towers">Towers and badges</h3>
        <p>
          There are {AREAS.length} places to explore: {AREAS.map((a) => a.name).join(', ')}. Each has a Tower with trainers inside. Beat the top trainer to win that area’s badge, and the next place opens.
          Each tower asks the maths of its type.
          Win {FOLLOW_BADGES} badges and the first monster in your team walks behind you on the map.
        </p>
      </section>

      <section aria-labelledby="mht-quests">
        <h3 id="mht-quests">Quests and puzzles</h3>
        <p>
          People with a <strong>!</strong> need your help: there are {QUESTS.length} story quests. The quest log in the Menu shows what to do next, and so does the line at the bottom of the map.
          The notice board in Harbour Town has 3 small jobs every day. Puzzles hide around the map (stepping stones, ice slides, lanterns, locks and crates): a sparkle shows where, until you solve it. After 3 tries you can ask for a hint.
        </p>
      </section>

      <section aria-labelledby="mht-bits">
        <h3 id="mht-bits">Bits and the Tinker</h3>
        <p>
          Winning a battle gives you <strong>bits</strong> of the monster’s type (leaves, shells, embers and more). Take them to the Tinker in Harbour Town to make balls, potions, an egg warmer,
          and the special things that wake the sleeping giants.
        </p>
      </section>

      <section aria-labelledby="mht-giants">
        <h3 id="mht-giants">Sleeping giants</h3>
        <p>
          {GIANTS.length} giant monsters are asleep across paths, blocking secret places. Each needs the right badge and a special item from the Tinker to wake it. Beat it or catch it and the way opens.
          A giant battle doesn’t count towards your {BATTLES_PER_DAY} a day.
        </p>
      </section>

      <section aria-labelledby="mht-eggs">
        <h3 id="mht-eggs">Eggs</h3>
        <p>
          Some quests, puzzles and nests give you an egg. You can carry {EGGS.basket}. An egg needs <strong>days of play</strong> to hatch: {EGGS.days.uncommon} days, or {EGGS.days.rare} or {EGGS.days.ultra} for
          rarer ones. A day of play is a day you answer at least one question. When it’s ready, take it to its own place to hatch (a leafy egg likes {HATCH_SPOTS.leafy.place}). A glowing ring on the ground shows the spot, then open the egg basket and tap Hatch.
        </p>
        <p>
          <strong>Keep your eggs warm!</strong> If you have no battles for {EGGS.coldAfter} days in a row, your eggs go cold and are lost. The game warns you on the last day.
        </p>
      </section>

      <section aria-labelledby="mht-rare">
        <h3 id="mht-rare">Rare monsters and weather</h3>
        <p>
          Some monsters are <strong>uncommon</strong>, <strong>rare</strong> or even <strong>ultra rare</strong>, and they are a little stronger. Each place has its own weather each day, which brings out
          monsters of one type, and the notice board says which rare monster has been spotted today and where.
        </p>
      </section>

      <section aria-labelledby="mht-save">
        <h3 id="mht-save">Saving and points</h3>
        <p>
          Your game saves by itself, at the nurse, after a Tower battle, every few minutes and when you leave. If the internet drops, it waits on your Chromebook and sends later.
          You earn points for winning battles and badges, up to the daily limit; the hub’s “How points work” page has the numbers.
        </p>
      </section>

      <section aria-labelledby="mht-set">
        <h3 id="mht-set">Make it fit you</h3>
        <p>
          Open Menu, then Settings. <strong>Calm</strong> turns off the quick-answer bonus, so nothing is timed. <strong>Choose answers</strong> gives you four buttons to tap instead of typing.
          <strong> On-screen arrows</strong> are for touch screens. The speaker button at the top of the page turns sound on and off.
        </p>
      </section>
    </div>
  );
}
