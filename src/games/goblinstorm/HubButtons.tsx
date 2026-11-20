import { useSound } from '../../sound';

/**
 * Goblin Storm fills the whole window, over the hub's bar (as Dragon Maths and Toon Flap do), so the way back to the hub
 * and the sound switch sit on the game itself.
 */
export function HubButtons() {
  const { soundOn, setSoundOn } = useSound();
  return (
    <span className="gs-hubbtns">
      <a className="gs-btn gs-btn--glass" href="#/"><span aria-hidden="true">⌂</span> Hub</a>
      <button
        type="button" className="gs-btn gs-btn--glass" aria-pressed={soundOn} onClick={() => setSoundOn(!soundOn)}
        title={soundOn ? 'Sound is on: click to mute' : 'Sound is off: click to turn on'}
      >
        <span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span><span className="gs-sr">Sound</span>
      </button>
    </span>
  );
}
