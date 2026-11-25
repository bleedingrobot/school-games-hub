import { useSound } from '../../sound';

/**
 * Star Web fills the whole window, over the hub's bar (James, 18 Nov 2026: like Star Trader), so the way back to
 * the hub and the sound switch sit on the painting instead.
 */
export function HubButtons() {
  const { soundOn, setSoundOn } = useSound();
  return (
    <span className="sw-hubbtns">
      <a className="sw-btn sw-btn--glass" href="#/"><span aria-hidden="true">⌂</span> Hub</a>
      <button
        type="button" className="sw-btn sw-btn--glass" aria-pressed={soundOn} onClick={() => setSoundOn(!soundOn)}
        title={soundOn ? 'Sound is on: click to mute' : 'Sound is off: click to turn on'}
      >
        <span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span><span className="sw-sr">Sound</span>
      </button>
    </span>
  );
}
