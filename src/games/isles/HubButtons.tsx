import { useSound } from '../../sound';

/**
 * Sky Isles fills the whole window, over the hub's bar (James, 18 Nov 2026: like Star Trader), so the way back to the
 * hub and the sound switch sit in the game's own top bar instead.
 */
export function HubButtons() {
  const { soundOn, setSoundOn } = useSound();
  return (
    <span className="si-hubbtns">
      <a className="button button--light si-hubbtn" href="#/"><span aria-hidden="true">⌂</span> Hub</a>
      <button
        type="button" className="button button--light si-hubbtn" aria-pressed={soundOn} onClick={() => setSoundOn(!soundOn)}
        aria-label="Sound" title={soundOn ? 'Sound is on: click to mute' : 'Sound is off: click to turn on'}
      >
        <span aria-hidden="true">{soundOn ? '🔔' : '🔕'}</span>
      </button>
    </span>
  );
}
