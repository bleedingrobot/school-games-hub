import { useSound } from '../../sound';

/**
 * Royal Decree fills the whole window, over the hub's bar (James, 18 Nov 2026: like Star Trader), so the way back to
 * the hub and the sound switch sit in the game's own title row instead.
 */
export function HubButtons() {
  const { soundOn, setSoundOn } = useSound();
  return (
    <span className="rd-hubbtns">
      <a className="rd-btn rd-btn--quiet" href="#/"><span aria-hidden="true">⌂</span> Hub</a>
      <button
        type="button" className="rd-btn rd-btn--quiet" aria-pressed={soundOn} onClick={() => setSoundOn(!soundOn)}
        title={soundOn ? 'Sound is on: click to mute' : 'Sound is off: click to turn on'}
      >
        <span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span><span className="rd-sr">Sound</span>
      </button>
    </span>
  );
}
