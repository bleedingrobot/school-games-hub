/** The teacher's music switch and volume, on the Class Live and Class Showdown big-screen bars. */
import { setMusic, useMusicSettings } from './music';
import './music.css';

/** `onPads`, where given, adds the switch for music on pupils' devices too (off: the big screen only). */
export function MusicControl({ className = 'cl-btn cl-btn--small', onPads }: { className?: string; onPads?: (on: boolean) => void }) {
  const { on, volume, pads } = useMusicSettings();
  return (
    <span className="cl-music">
      <button type="button" className={className} aria-pressed={on} onClick={() => setMusic({ on: !on })}>{on ? '🎵 Music on' : '🎵 Music off'}</button>
      {on && (
        <input
          type="range" className="cl-music__vol" min={0} max={100} step={5} value={Math.round(volume * 100)}
          aria-label="Music volume" onChange={(e) => setMusic({ volume: Number(e.target.value) / 100 })}
        />
      )}
      {on && onPads && (
        <button type="button" className={className} aria-pressed={pads} onClick={() => { setMusic({ pads: !pads }); onPads(!pads); }}>
          {pads ? '📱 Music on iPads too' : '🖥️ Music on big screen only'}
        </button>
      )}
    </span>
  );
}
