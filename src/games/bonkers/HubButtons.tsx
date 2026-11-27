import { useSound } from '../../sound';

/** Smash Quest covers the whole window, over the hub's bar, so the way back to the hub and the sound switch sit in its top bar. */
export function HubButtons() {
  const { soundOn, setSoundOn } = useSound();
  return (
    <span className="bq-hubbtns">
      <a className="bq-btn bq-btn--ghost" href="#/"><span aria-hidden="true">⌂</span> Hub</a>
      <button
        type="button" className="bq-btn bq-btn--ghost" aria-pressed={soundOn} onClick={() => setSoundOn(!soundOn)}
        title={soundOn ? 'Sound is on: click to mute' : 'Sound is off: click to turn on'}
      >
        <span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span><span className="bq-sr">Sound</span>
      </button>
    </span>
  );
}
