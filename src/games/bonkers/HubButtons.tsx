import { useSound } from '../../sound';
import { useReadAloud } from '../../speech';
import { VOICE_ON_BY_DEFAULT } from './voice';

/**
 * Smash Quest covers the whole window, over the hub's bar, so the way back to the hub, Bella's speaker (she reads Granny
 * Jetpack aloud) and the sound switch sit in its top bar.
 */
export function HubButtons() {
  const { soundOn, setSoundOn } = useSound();
  const voice = useReadAloud({ defaultOn: VOICE_ON_BY_DEFAULT });
  const voiceOn = voice.on && soundOn;
  return (
    <span className="bq-hubbtns">
      <a className="bq-btn bq-btn--ghost" href="#/"><span aria-hidden="true">⌂</span> Hub</a>
      {voice.available && (
        <button
          type="button" className={`bq-btn bq-btn--ghost${voiceOn ? '' : ' bq-btn--dim'}`} aria-pressed={voice.on} aria-label="Read aloud"
          onClick={() => voice.setOn(!voice.on)}
          title={!soundOn ? 'Read aloud: turn the sound on to hear it' : voice.on ? 'Read aloud is on: click to stop' : 'Read aloud is off: click to turn on'}
        >
          <span aria-hidden="true">🗣️</span>
        </button>
      )}
      <button
        type="button" className="bq-btn bq-btn--ghost" aria-pressed={soundOn} onClick={() => setSoundOn(!soundOn)}
        title={soundOn ? 'Sound is on: click to mute' : 'Sound is off: click to turn on'}
      >
        <span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span><span className="bq-sr">Sound</span>
      </button>
    </span>
  );
}
