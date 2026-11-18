import { useSound } from '../../sound';

/**
 * Marble Rush fills the whole window, over the hub's bar (James, 18 Nov 2026: like Star Trader), so the way back to
 * the hub and the sound switch sit in the course picker's top row instead.
 */
export function HubButtons() {
  const { soundOn, setSoundOn } = useSound();
  return (
    <span className="mr-hubbtns">
      <a className="mr-glass" href="#/"><span aria-hidden="true">⌂</span> Hub</a>
      <button
        type="button" className="mr-glass" aria-pressed={soundOn} onClick={() => setSoundOn(!soundOn)}
        title={soundOn ? 'Sound is on: click to mute' : 'Sound is off: click to turn on'}
      >
        <span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span><span className="sr-only">Sound</span>
      </button>
    </span>
  );
}
