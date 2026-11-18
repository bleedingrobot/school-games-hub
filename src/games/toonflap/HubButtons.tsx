import { useSound } from '../../sound';

/**
 * Toon Flap covers the whole window, over the hub's bar (James, 18 Nov 2026: like Star Trader), so the way back to
 * the hub and the sound switch sit next to the game's name on the map.
 */
export function HubButtons() {
  const { soundOn, setSoundOn } = useSound();
  return (
    <span className="tf-hubbtns">
      <a className="tf-btn tf-btn--ghost tf-hubbtn" href="#/"><span aria-hidden="true">⌂</span> Hub</a>
      <button
        type="button" className="tf-btn tf-btn--ghost tf-hubbtn" aria-pressed={soundOn} onClick={() => setSoundOn(!soundOn)}
        title={soundOn ? 'Sound is on: click to mute' : 'Sound is off: click to turn on'}
      >
        <span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span><span className="tf-sr">Sound</span>
      </button>
    </span>
  );
}
