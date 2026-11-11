/** How to play, on its own page. Every number is read from the game's settings (shared/toonflap/config.ts). */
import { useEffect, useRef } from 'react';
import { BUMP_PENALTY_STEPS, CHECK_BONUS_STEPS, GENTLE_SPEED, POTIONS_MAX, STEPS_PER_SECOND, TAILWIND_STEPS, UNLOCK_RUNS } from '../../../shared/toonflap/config';
import { LEVELS } from '../../../shared/toonflap/levels';

const sec = (steps: number) => steps / STEPS_PER_SECOND;

export function HowToPlay({ onBack }: { onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section className="tf-howto" aria-labelledby="tf-how-h">
      <header className="tf-map__top">
        <h2 id="tf-how-h" className="tf-h" tabIndex={-1} ref={heading}>How to play</h2>
        <button type="button" className="tf-btn" onClick={onBack}>Back</button>
      </header>
      <div className="tf-howto__body">
        <section>
          <h3 className="tf-h3">Flying</h3>
          <p>Tap, click or press <kbd>Space</kbd> to flap. Each flap lifts your bird up. Gravity pulls it down. Fly through the gaps to reach the nest. Your time counts up. Beat it next time!</p>
        </section>
        <section>
          <h3 className="tf-h3">Bumps</h3>
          <p>If you hit a wall, the floor or the top, it is just <strong>{sec(BUMP_PENALTY_STEPS)} seconds</strong> added. You never have to start again. Tap to fly on.</p>
        </section>
        <section>
          <h3 className="tf-h3">Checks</h3>
          <p>A perch is a check. Your bird lands and <strong>the clock stops</strong>. Answer the maths question. Get it right and <strong>{sec(CHECK_BONUS_STEPS)} seconds</strong> come off. Get it wrong and nothing is lost: you see the right answer.</p>
        </section>
        <section>
          <h3 className="tf-h3">Answer gaps</h3>
          <p>A sign shows a quick sum. The next wall has gaps with numbers. Fly through the one with the right answer for a tailwind: <strong>{sec(TAILWIND_STEPS)} seconds</strong> off. The first gap you fly through is your answer. The results tell you how you did.</p>
        </section>
        <section>
          <h3 className="tf-h3">Medals</h3>
          <p>Every finish earns a medal. Bronze, silver or gold, from your time. Few bumps and right answers are the way to gold.</p>
        </section>
        <section>
          <h3 className="tf-h3">Gentle wings 🪶</h3>
          <p>Slower ({Math.round(GENTLE_SPEED * 100)}% speed) and wider gaps. You can use it on any level. Finishing still opens the next level. Gold needs normal wings.</p>
        </section>
        <section>
          <h3 className="tf-h3">Flyers, trails and potions</h3>
          <p>Finish a level <strong>{UNLOCK_RUNS} times</strong> to unlock its flyer. Win gold to make it shiny. Trails are earned too. They only change how your bird looks, never how it flies.</p>
          <p>Sometimes you earn a 🧪 revive potion. Hold up to {POTIONS_MAX}. Use one in a run to cancel a bump.</p>
        </section>
        <section>
          <h3 className="tf-h3">The 10 worlds</h3>
          <p>Finish a level to open the next one. <strong>One new level opens each day</strong>, so come back tomorrow for the next world. You can fly any open level as often as you like.</p>
          <ol className="tf-howto__levels">
            {LEVELS.map((l) => (
              <li key={l.id}><strong>{l.name}.</strong> {l.newThing}</li>
            ))}
          </ol>
        </section>
      </div>
    </section>
  );
}
