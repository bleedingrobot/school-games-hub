import { useSound } from '../../sound';

/**
 * Circuit Racer fills the whole window, over the hub's bar (docs/game-guide/3-files-and-clashes.md, "Full window"), so the
 * way back to the hub and the sound switch sit on the game's own screens (copied from src/games/lord/HubButtons.tsx).
 */
export function HubButtons() {
  const { soundOn, setSoundOn } = useSound();
  return (
    <span className="cr-hubbtns">
      <a className="cr-glass" href="#/"><span aria-hidden="true">⌂</span> Hub</a>
      <button
        type="button" className="cr-glass" aria-pressed={soundOn} onClick={() => setSoundOn(!soundOn)}
        title={soundOn ? 'Sound is on: click to mute' : 'Sound is off: click to turn on'}
      >
        <span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span><span className="cr-sr">Sound</span>
      </button>
    </span>
  );
}
