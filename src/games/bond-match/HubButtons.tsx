import { useSound } from '../../sound';
import { useReadAloud } from '../../speech';
import { VOICE_ON_BY_DEFAULT } from './voice';

/**
 * Bond Match fills the whole window, over the hub's bar (game guide "Full window"), so the way back to the hub, Bella's
 * speaker and the sound switch sit on the beach instead. Copied from Dragon Maths (src/games/lord/HubButtons.tsx).
 */
export function HubButtons({ hub = true }: { hub?: boolean }) {
  const { soundOn, setSoundOn } = useSound();
  const voice = useReadAloud({ defaultOn: VOICE_ON_BY_DEFAULT });
  const voiceOn = voice.on && soundOn;
  return (
    <span className="bm-hubbtns">
      {hub && <a className="bm-hubbtn" href="#/"><span aria-hidden="true">⌂</span> Hub</a>}
      {voice.available && (
        <button
          type="button" className={`bm-hubbtn bm-hubbtn--round bm-voicebtn${voiceOn ? '' : ' bm-voicebtn--off'}`}
          aria-pressed={voice.on} aria-label="Read aloud" onClick={() => voice.setOn(!voice.on)}
          title={!soundOn ? 'Read aloud: turn the sound on to hear it' : voice.on ? 'Read aloud is on: click to stop' : 'Read aloud is off: click to turn on'}
        >
          <span aria-hidden="true">🗣️</span>
        </button>
      )}
      <button
        type="button" className="bm-hubbtn bm-hubbtn--round" aria-pressed={soundOn} onClick={() => setSoundOn(!soundOn)}
        title={soundOn ? 'Sound is on: click to mute' : 'Sound is off: click to turn on'}
      >
        <span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span><span className="sr-only">Sound</span>
      </button>
    </span>
  );
}
