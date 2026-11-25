/**
 * Background music behind the easy and complex maths games (James, 25 Nov 2026 NZ): one looping track per game, made
 * on James's PC with a local music model (src/games/classlive/music/game-<id>.mp3). A small 🎵 button in the corner
 * turns it on or off with one tap (🔊 beside it sets the volume where the device allows), kept on this device (the same switch as Class Live's music on iPads).
 * A game with no track yet plays nothing and shows no button.
 */
import { useState } from 'react';
import { canSetVolume, setMusic, trackUrl, useMusic, useMusicSettings, type Track } from './classlive/music';
import './classlive/music.css';

export function GameMusic({ id }: { id: string }) {
  const track: Track = `game-${id}`;
  const has = !!trackUrl(track);
  useMusic(has ? track : null, true);
  const { on, volume } = useMusicSettings();
  const [open, setOpen] = useState(false);
  if (!has) return null;
  return (
    <div className={`game-music${open ? ' is-open' : ''}`}>
      <button type="button" className="game-music__btn" aria-pressed={on} aria-label={on ? 'Music on: tap to turn it off' : 'Music off: tap to turn it on'}
        title={on ? 'Music on' : 'Music off'} onClick={() => setMusic(on ? { on: false } : { on: true, volume: volume > 0 ? volume : 0.35 })}>{on ? '🎵' : '🔇'}</button>
      {on && canSetVolume && !open && (
        <button type="button" className="game-music__close" aria-label="Music volume" onClick={() => setOpen(true)}>🔊</button>
      )}
      {on && canSetVolume && open && (
        <>
          <input type="range" className="cl-music__vol" min={0} max={100} step={5} value={Math.round(volume * 100)} aria-label="Music volume"
            onChange={(e) => setMusic({ volume: Number(e.target.value) / 100 })} />
          <button type="button" className="game-music__close" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
        </>
      )}
    </div>
  );
}
