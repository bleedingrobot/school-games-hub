/** The choices a pupil can change, remembered on this device: flight, goal arrow, motion, mouse and touch. */
import { WRONG_ANSWER_DAMAGE, WRONG_ANSWER_STEPS, STEPS_PER_SECOND, REBUILD_PENALTY_STEPS } from '../../../shared/mine/config';
import type { MinePrefs } from './prefs';

export function SettingsPanel({
  prefs, onChange, inRun = false,
}: {
  prefs: MinePrefs;
  onChange: (p: MinePrefs) => void;
  inRun?: boolean;
}) {
  const set = <K extends keyof MinePrefs>(key: K, value: MinePrefs[K]) => onChange({ ...prefs, [key]: value });
  return (
    <div className="mn-settings">
      <h3>Settings</h3>
      <label className="mn-check">
        <input type="checkbox" checked={prefs.steady} onChange={(e) => set('steady', e.target.checked)} />
        <span>Steady flight <small>Keeps your ship level, so up is always up. Best for most pilots. {inRun ? 'Changes the next time you start a mine.' : ''}</small></span>
      </label>
      <label className="mn-check">
        <input type="checkbox" checked={prefs.arrow} onChange={(e) => set('arrow', e.target.checked)} />
        <span>Arrow to the next goal <small>Points the way to the next key, door, reactor or exit.</small></span>
      </label>
      <label className="mn-field">
        <span>Less motion</span>
        <select value={prefs.lessMotion === null ? 'auto' : prefs.lessMotion ? 'on' : 'off'} onChange={(e) => set('lessMotion', e.target.value === 'auto' ? null : e.target.value === 'on')}>
          <option value="auto">Same as my device</option>
          <option value="on">On: no spinning or bobbing, fewer sparks</option>
          <option value="off">Off</option>
        </select>
      </label>
      <label className="mn-field">
        <span>Turning speed: {prefs.sensitivity.toFixed(1)}</span>
        <input type="range" min="0.4" max="2.5" step="0.1" value={prefs.sensitivity} onChange={(e) => set('sensitivity', Number(e.target.value))} />
      </label>
      <label className="mn-check">
        <input type="checkbox" checked={prefs.invertY} onChange={(e) => set('invertY', e.target.checked)} />
        <span>Flip looking up and down</span>
      </label>
      <label className="mn-check">
        <input type="checkbox" checked={prefs.lock} onChange={(e) => set('lock', e.target.checked)} />
        <span>Capture the mouse <small>Move the mouse to look, click to fire. Press Esc to let go. If it does not work on your computer, leave it off and drag to look.</small></span>
      </label>
      <label className="mn-field">
        <span>On-screen sticks and buttons</span>
        <select value={prefs.touch} onChange={(e) => set('touch', e.target.value as MinePrefs['touch'])}>
          <option value="auto">Only on a touch screen</option>
          <option value="on">Always show them</option>
          <option value="off">Never</option>
        </select>
      </label>
      <label className="mn-field">
        <span>Which hand steers?</span>
        <select value={prefs.hand} onChange={(e) => set('hand', e.target.value as MinePrefs['hand'])}>
          <option value="right">Right hand looks, left hand moves</option>
          <option value="left">Left hand looks, right hand moves</option>
        </select>
      </label>
    </div>
  );
}

export function ControlsHelp() {
  return (
    <div className="mn-controls">
      <h3>Controls</h3>
      <dl className="mn-keys-list">
        <div><dt>W / S</dt><dd>Forward and back</dd></div>
        <div><dt>A / D</dt><dd>Slide left and right</dd></div>
        <div><dt>R / F</dt><dd>Rise and sink</dd></div>
        <div><dt>Arrow keys</dt><dd>Turn and look up or down</dd></div>
        <div><dt>Q / E</dt><dd>Roll (only if steady flight is off)</dd></div>
        <div><dt>Space</dt><dd>Fire the laser</dd></div>
        <div><dt>Shift or X</dt><dd>Launch a missile</dd></div>
        <div><dt>Enter</dt><dd>Use a question door or pad</dd></div>
        <div><dt>M</dt><dd>Map</dd></div>
        <div><dt>Esc or P</dt><dd>Pause</dd></div>
        <div><dt>Mouse</dt><dd>Drag to look, quick tap to fire (or capture the mouse in Settings)</dd></div>
        <div><dt>Touch</dt><dd>Left stick moves, right stick looks, big buttons fire</dd></div>
      </dl>
    </div>
  );
}

export function HowToPlayBody({ questions }: { questions: boolean }) {
  return (
    <div className="mn-howto">
      <p>You fly a little ship through a mine. The tunnels twist up, down and round the corner, so use the map and the arrow.</p>
      <ol>
        <li><strong>Find the keys.</strong> A coloured key opens the door of the same colour. Fly near the door with the key and it opens by itself.</li>
        {questions && (
          <li>
            <strong>Answer the question doors.</strong> Fly up to a purple door and press Enter. A right answer opens it. A wrong answer costs {WRONG_ANSWER_DAMAGE} shield and
            adds {Math.round(WRONG_ANSWER_STEPS / STEPS_PER_SECOND)} seconds, and you try again with a new question.
          </li>
        )}
        {questions && <li><strong>Glowing pads</strong> give you a big refill when you answer right. A wrong answer costs nothing, and you get three tries.</li>}
        <li><strong>Shoot the robots</strong> with lasers (they use energy) and missiles. They are only machines.</li>
        <li><strong>Destroy the reactor.</strong> It is the glowing orange ball in a cage, in the furthest room. Keep shooting it until it breaks (missiles hit hardest). Then an escape timer starts.</li>
        <li><strong>Race back to the exit</strong> before the timer runs out.</li>
      </ol>
      <p>If your shield runs out, your ship is rebuilt in the last room you were in and {Math.round(REBUILD_PENALTY_STEPS / STEPS_PER_SECOND)} seconds are added to your time. You never lose your keys.</p>
      <p>Feeling dizzy? Turn on Steady flight and Less motion in Settings, and fly slowly.</p>
    </div>
  );
}
