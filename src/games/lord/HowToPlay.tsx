/**
 * The how-to-play page, in plain words. Opened from the village (key ?) and from the class choice (a fold-out, so a
 * new hero can read it first). Everything here must match docs/LORD-RULES.md; the numbers come from the game's own
 * constants, so they cannot drift.
 */
import { ARENA_FIGHTS_PER_DAY, MAX_LEVEL, FOREST_FIGHTS_PER_DAY, SKILL_USES_PER_DAY } from '../../../shared/lord/data';
import { Place } from './Places';

export function HowToPlayBody() {
  return (
    <div className="lord-howto">
      <h3>The story</h3>
      <p>The Red Dragon stole the village’s treasure, food and light. You are a hero, and you are going to get them back.</p>

      <h3>A day in the game</h3>
      <ul>
        <li>Each day you can fight in <strong>the forest</strong> (usually {FOREST_FIGHTS_PER_DAY} fights, and the teacher can change that). Winning gives gold and experience. Events in the forest are free.</li>
        <li>Your health and turns come back every morning. If you miss a day, up to two days’ worth of forest fights are saved up for you, so there is no need to rush.</li>
        <li>You can use a class skill {SKILL_USES_PER_DAY} times a day. Pick it in a fight.</li>
        <li>If you lose a forest fight you wake at the healer. You lose the gold you are carrying, but <strong>gold in the bank is safe</strong>, and you keep your experience. Then you carry on.</li>
      </ul>

      <h3>The village</h3>
      <ul>
        <li><strong>Shop:</strong> buy weapons and armour (you can sell them back). You need enough strength or defence.</li>
        <li><strong>Healer:</strong> mends your health for gold.</li>
        <li><strong>Bank:</strong> keeps gold safe. From level 4, once a day, the banker pays 1 gold for every 20 gold you have saved, if you can work out how much that is.</li>
        <li><strong>Inn:</strong> a song, the riddle of the day, and a number-guessing game. No gambling.</li>
        <li><strong>Training grounds:</strong> when you have enough experience, fight your master to go up a level. Three questions first make you a little stronger.</li>
        <li><strong>The Arena:</strong> {ARENA_FIGHTS_PER_DAY} fights a day against classmates’ heroes and computer heroes. Losing costs nothing.</li>
        <li><strong>News, Warriors list, Hall of Heroes:</strong> what happened, who is doing best, and who has beaten the dragon.</li>
      </ul>

      <h3>The Red Dragon</h3>
      <p>
        At level {MAX_LEVEL} you can face the dragon: three fights in a row, with a riddle before each. It is hard, and gear and skills matter most. If it goes badly you lose nothing but today’s try, and you can come back tomorrow. Beat it and you earn a gold star and start again at level 1.
      </p>

      <h3>Where the maths comes in</h3>
      <ul>
        <li>Answer a question right and you get a bonus: a bigger first hit, ten percent off in the shop or healer, a little gold, or a shield against the dragon.</li>
        <li><strong>A wrong answer never takes anything away.</strong> You just don’t get the bonus. There is no timer.</li>
        <li>Every question has a <strong>Hint</strong> button, once per question. It gives a clue: two wrong choices are greyed out, or it tells you what numbers the answer is between. A right answer after a hint still counts, with a smaller bonus.</li>
        <li>You can say “No thanks” to some questions. That is never counted as wrong.</li>
      </ul>

      <h3>Keys</h3>
      <p>
        In the village, press the letter on a button (F for the forest, S for the shop, and so on). <kbd>Esc</kbd> goes back. In a fight, number keys pick moves. In a question, type the answer and press Enter. The whole game works with only a keyboard or by tapping.
      </p>

      <h3>Seasons</h3>
      <p>Every five weeks there is a new season and everyone starts again at level 1. Your stars, the Hall of Heroes and your achievements stay. Fights you win against the computer earn hub points, within the same daily limit as every other game.</p>
    </div>
  );
}

export function HowToPlay({ back }: { back: () => void }) {
  return (
    <Place title="How to play" scene="map" back={back}>
      <HowToPlayBody />
    </Place>
  );
}
