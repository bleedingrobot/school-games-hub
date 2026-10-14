import { useSound } from '../sound';

export function MuteButton() {
  const { soundOn, setSoundOn } = useSound();
  return (
    <button
      type="button"
      className="icon-button"
      aria-pressed={soundOn}
      onClick={() => setSoundOn(!soundOn)}
      title={soundOn ? 'Sound is on — click to mute' : 'Sound is off — click to turn on'}
    >
      <span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span>
      <span className="icon-button__label">{soundOn ? 'Sound on' : 'Sound off'}</span>
    </button>
  );
}
