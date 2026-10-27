/**
 * "How to play" for Maths Monsters, in plain words for a 9-year-old. It is shown on the new-game screen and
 * from the map Menu. Numbers come from the game's own rules (steps a Repel lasts, how many badges, the six
 * types and their topics), never typed in twice. Short sections with real headings, so a screen reader
 * can jump between them. Points are explained on the hub's "How points work" page.
 */
import { TOPICS } from '../../../shared/maths/skillPacks';
import { AREAS } from '../../../shared/monsters/world/areas';
import { BATTLES_PER_DAY } from '../../../shared/monsters/world/battleCap';
import { REPEL_STEPS } from '../../../shared/monsters/world/rewards';
import { MAX_TEAM } from '../../../shared/monsters/engine';
import { TYPE_LABEL, TYPE_TOPIC, TYPES, strongAgainst } from '../../../shared/monsters/types';

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
          When you pick an attack, a maths question pops up. <strong>Get it right and the attack hits.</strong> A quick right answer hits extra hard.
          <strong> Get it wrong</strong> and the attack is only a small hit, and the game shows you the right answer. There is no losing a turn for being slow.
        </p>
        <p>Enemy monsters hit back without asking you anything. If all your monsters get tired, you hurry back to your last healing spot and keep everything.</p>
        <p>
          Your monsters can have <strong>{BATTLES_PER_DAY} battles a day</strong>. After that they rest until tomorrow: no wild monsters and no trainers, but you can still explore and battle in the Towers. Running away before a question doesn’t count.
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
