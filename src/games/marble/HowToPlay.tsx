import {
  CHECKPOINT_BONUS_STEPS,
  FALL_PENALTY_STEPS,
  GEM_BONUS_STEPS,
  MAX_GEM_BONUSES,
  PIT_BONUS_STEPS,
  RESCUE_GAP_STEPS,
  STEPS_PER_SECOND,
} from '../../../shared/marble/config';

const seconds = (steps: number) => Math.round(steps / STEPS_PER_SECOND);

/**
 * The words of "How to play", for a 9-year-old. Every number is read from the game's settings (shared/marble/config.ts),
 * never typed in twice. Short sections, two or three short lines each. The maths part is about what it asks and what it never does.
 */
export function HowToPlayBody({ mathsAllowed }: { mathsAllowed: boolean }) {
  const fall = seconds(FALL_PENALTY_STEPS);
  return (
    <div className="marble-howto">
      <p>Steer your marble down a track as fast as you can. The clock counts up, and you win a bronze, silver or gold medal for your time.</p>
      <section aria-labelledby="mh-steer">
        <h3 id="mh-steer">Steering</h3>
        <p>
          Use the <kbd>arrow keys</kbd> or <kbd>W A S D</kbd>. On a touch screen or with a mouse, drag the way you want to roll. A thumb stick shows up on a
          touch screen, and you can move it to the other side.
        </p>
        <p>
          <kbd>P</kbd> or <kbd>Esc</kbd> pauses. <kbd>R</kbd> starts again.
        </p>
      </section>
      <section aria-labelledby="mh-falls">
        <h3 id="mh-falls">Falling off</h3>
        <p>
          Roll off the edge, or land too hard, and you’re put back on the track a little behind where you fell. A fall costs <strong>{fall} seconds</strong>, never the whole run.
        </p>
      </section>
      <section aria-labelledby="mh-floor">
        <h3 id="mh-floor">The ground</h3>
        <p>
          <strong>Ice</strong> is slippery, so start turning early. <strong>Mud</strong> is sticky and slow. <strong>Bumpers</strong> bounce you. <strong>Jump pads</strong> and{' '}
          <strong>geysers</strong> throw you into the air. <strong>Conveyor belts</strong> push you along. Watch for <strong>crumbling floors</strong>, <strong>sweeping arms</strong>
          {' '}and <strong>gusts of wind</strong>: they move in a pattern you can learn.
        </p>
      </section>
      <section aria-labelledby="mh-hard">
        <h3 id="mh-hard">Hard mode</h3>
        <p>
          After you finish a course you can try it against a countdown. Each checkpoint gives you {seconds(CHECKPOINT_BONUS_STEPS)} more seconds. If the clock runs out, nothing is lost.
        </p>
      </section>
      <section aria-labelledby="mh-ghost">
        <h3 id="mh-ghost">Ghosts and two players</h3>
        <p>
          Pick <strong>Race a ghost</strong> above the courses. A ghost is a see-through marble that plays back a recorded run: <strong>My best</strong> is your own best run, <strong>Just ahead</strong> is the classmate just ahead of you, and <strong>Fastest</strong> is the fastest in your class. Nobody has to be online.
          On a computer you can also play <strong>two players</strong> on one keyboard. That one isn’t saved.
        </p>
      </section>
      {mathsAllowed && (
        <>
          <h3 className="marble-howto__big">Maths</h3>
          <p>
            Your teacher decides if there are questions. The questions are the maths your class is working on, and a wrong answer <strong>never costs you</strong> anything
            except a longer way round. Each gate asks a question and the right tunnel is the shortcut. Pit stops take 2 seconds off for a right answer, and the
            purple question stops take 1 second or half a second off.
          </p>
          <section aria-labelledby="mh-gate">
            <h3 id="mh-gate">Answer gates</h3>
            <p>
              A sign shows a question, then the track splits into tunnels with answers over them. Roll into the tunnel with the right answer: its shortcut door is open.
              A wrong tunnel is a dead end, so you have to back out and try another.
            </p>
            <p>
              When a question comes into view the game stops and waits (up to 10 seconds) until you press Go, so you can read it. The clock stops too.
            </p>
          </section>
          <section aria-labelledby="mh-pit">
            <h3 id="mh-pit">Pit stops and question stops</h3>
            <p>
              At a checkpoint the clock stops and you get a question. A right answer takes <strong>{seconds(PIT_BONUS_STEPS)} seconds</strong> off your time. You can always skip it.
            </p>
            <p>
              Every course also has two purple <strong>question stops</strong> across the track. They work the same way: one takes <strong>1 second</strong> off for a right answer
              and the other takes <strong>half a second</strong> off (the sign over each one says which).
            </p>
          </section>
          <section aria-labelledby="mh-rescue">
            <h3 id="mh-rescue">Rescue questions</h3>
            <p>
              If your teacher has them on, a fall asks a question. Get it right and the {fall} seconds the fall cost are given back. You won’t be asked more than once every{' '}
              {seconds(RESCUE_GAP_STEPS)} seconds.
            </p>
          </section>
          <section aria-labelledby="mh-gems">
            <h3 id="mh-gems">Number gems</h3>
            <p>
              On some courses a sign shows a question and rows of gems carry answers. Roll through the right gem to take <strong>{seconds(GEM_BONUS_STEPS)} second</strong> off, up to{' '}
              {MAX_GEM_BONUSES} a run. Roll through a wrong gem and nothing happens.
            </p>
          </section>
          <section aria-labelledby="mh-guess">
            <h3 id="mh-guess">Guess your time</h3>
            <p>Before you roll you can guess how many seconds the run will take. Get within 10% and you win a star. It never changes your time.</p>
          </section>
          <section aria-labelledby="mh-records">
            <h3 id="mh-records">Your maths records</h3>
            <p>
              The answers to gates and to pit and rescue questions go into your maths records, like in the other games, so your teacher can see how you are doing.
              The gem questions and your time guesses are just for fun and are not saved. Times with maths have their own boards, apart from times without.
            </p>
          </section>
        </>
      )}
      {!mathsAllowed && (
        <p>Without maths, an arrow at each gate shows you the shortcut.</p>
      )}
      <section aria-labelledby="mh-saved">
        <h3 id="mh-saved">What is saved</h3>
        <p>
          Your best time on each course, and the run itself so a ghost can replay it. Class boards show only player names and avatars, never real names.
        </p>
      </section>
    </div>
  );
}
