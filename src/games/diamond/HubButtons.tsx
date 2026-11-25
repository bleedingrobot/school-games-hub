import { useSound } from '../../sound';

/**
 * Diamond Drop covers the whole window, over the hub's bar (James, 18 Nov 2026: like Star Trader), so the way back to
 * the hub and the sound switch sit in the level map's top bar (docs/DIAMOND-MENU-PLAN.md).
 */
export function HubLink() {
  return (
    <a className="button button--light-outline dd-btn dd-btn--small dd-hubbtn" href="#/" aria-label="Back to the Hub">
      <span aria-hidden="true">⌂</span><span className="dd-hubbtn__word" aria-hidden="true">Hub</span>
    </a>
  );
}

export function SoundButton() {
  const { soundOn, setSoundOn } = useSound();
  return (
    <button
      type="button" className="button button--light-outline dd-btn dd-btn--small dd-hubbtn dd-hubbtn--round" aria-pressed={soundOn} onClick={() => setSoundOn(!soundOn)}
      title={soundOn ? 'Sound is on: click to mute' : 'Sound is off: click to turn on'}
    >
      <span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span><span className="dd-sr">Sound</span>
    </button>
  );
}

export function HubButtons() {
  return <span className="dd-hubbtns"><HubLink /><SoundButton /></span>;
}
