import { useSound } from '../../sound';

/**
 * Bond Match fills the whole window, over the hub's bar (game guide "Full window"), so the way back to the hub and the
 * sound switch sit on the beach instead. Copied from Dragon Maths (src/games/lord/HubButtons.tsx).
 */
export function HubButtons({ hub = true }: { hub?: boolean }) {
  const { soundOn, setSoundOn } = useSound();
  return (
    <span className="bm-hubbtns">
      {hub && <a className="bm-hubbtn" href="#/"><span aria-hidden="true">⌂</span> Hub</a>}
      <button
        type="button" className="bm-hubbtn bm-hubbtn--round" aria-pressed={soundOn} onClick={() => setSoundOn(!soundOn)}
        title={soundOn ? 'Sound is on: click to mute' : 'Sound is off: click to turn on'}
      >
        <span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span><span className="sr-only">Sound</span>
      </button>
    </span>
  );
}
