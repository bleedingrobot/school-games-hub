/** The map: a cartoon trail through the 10 worlds (docs/TOON-FLAP-PLAN.md, section 1). Tap a lit stop to fly it. */
import { FLYERS, finishesToUnlock, levelOpen, nextStep, openedLevel, opensTomorrow, unlockRuns, type Progress } from '../../../shared/toonflap/collection';
import { LEVELS } from '../../../shared/toonflap/levels';
import { useEffect } from 'react';
import { HELP_SETTINGS, type HelpSetting } from './guide';
import { screenArt } from './art/art';

/** A painted picture as a soft page background (the list stays easy to read over it). */
export const paintedBackground = (url: string | undefined) =>
  url ? { backgroundImage: `linear-gradient(rgba(255,255,255,0.55), rgba(255,255,255,0.7)), url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center top', backgroundAttachment: 'local' } : undefined;

/** The revive potion: James's painting, or the emoji until it loads. */
export function PotionIcon({ size = 22 }: { size?: number }) {
  const url = screenArt('potion');
  return url ? <img src={url} alt="" width={size} height={size} style={{ verticalAlign: 'middle' }} /> : <span aria-hidden="true">🧪</span>;
}

/** Each world's colours (top, bottom, accent) and a picture word, for its stop on the trail. */
export const LEVEL_LOOK: Array<{ a: string; b: string; icon: string }> = [
  { a: '#A9D8F0', b: '#9CCB6B', icon: '🌻' },
  { a: '#F7E3A1', b: '#D9783B', icon: '🌵' },
  { a: '#2E9BD6', b: '#FF7FA8', icon: '🫧' },
  { a: '#EFE2C2', b: '#F2C744', icon: '🧀' },
  { a: '#6FB8E8', b: '#FBE48A', icon: '🍩' },
  { a: '#2B2A5C', b: '#7FB069', icon: '👻' },
  { a: '#8FC3E8', b: '#F4F6F8', icon: '🌲' },
  { a: '#F7C77A', b: '#F26B1D', icon: '🌋' },
  { a: '#141E4A', b: '#FF3E9A', icon: '🤖' },
  { a: '#1D2340', b: '#F28C38', icon: '🪐' },
];

export const MEDAL_ICON = { gold: '🥇', silver: '🥈', bronze: '🥉' } as const;
export const MEDAL_WORD = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' } as const;

export const fmtSeconds = (s: number | null): string => (s === null ? '' : `${s.toFixed(1)} s`);

export function MapScreen({ progress, today, maths, gentle, onGentle, onPlay, onHangar, onHowTo, busy, error, help = 'lots', onHelp, onReplayGuide, voice, talk }: {
  progress: Progress;
  /** The NZ day, for the one-new-level-a-day rule. */
  today: string;
  maths: boolean;
  gentle: boolean;
  onGentle: (on: boolean) => void;
  onPlay: (n: number) => void;
  onHangar: () => void;
  onHowTo: () => void;
  busy: boolean;
  error: string | null;
  /** First-time tips: Lots, Some or Off. */
  help?: HelpSetting;
  onHelp?: (h: HelpSetting) => void;
  onReplayGuide?: () => void;
  voice?: { on: boolean; setOn: (on: boolean) => void; available: boolean };
  talk?: (text: string) => void;
}) {
  const step = nextStep(progress, today);
  // Bella says what to do next as the map opens.
  useEffect(() => talk?.(step), [step, talk]);
  const next = LEVELS.find((l) => (progress.levels[l.id]?.finishes ?? 0) === 0 && levelOpen(progress, l.n, today));
  return (
    <section className="tf-map" aria-labelledby="tf-map-h" style={paintedBackground(screenArt('map'))}>
      <header className="tf-map__top">
        <div>
          <h2 id="tf-map-h" className="tf-h">Toon Flap</h2>
          <p className="tf-next" role="status">{step}</p>
        </div>
        <div className="tf-map__buttons">
          {progress.potions > 0 && <span className="tf-chip tf-chip--potion" title="Revive potions: each cancels one bump in a run"><PotionIcon /> × {progress.potions}</span>}
          <button type="button" className="tf-btn" onClick={onHangar}>Hangar</button>
          <button type="button" className="tf-btn tf-btn--ghost" onClick={onHowTo}>How to play</button>
          {voice?.available && (
            <button type="button" className="tf-btn tf-btn--ghost" aria-pressed={voice.on} onClick={() => voice.setOn(!voice.on)}>
              {voice.on ? '🔊 Voice on' : '🔈 Voice off'}
            </button>
          )}
        </div>
      </header>

      <label className="tf-gentle">
        <input type="checkbox" checked={gentle} onChange={(e) => onGentle(e.target.checked)} />
        <span>
          <strong>Gentle wings 🪶</strong>
          <small>Slower and wider gaps. Gold needs normal wings.</small>
        </span>
      </label>
      {onHelp && (
        <div className="tf-help" role="group" aria-label="Tips">
          <span className="tf-help__label">Tips:</span>
          {HELP_SETTINGS.map((h) => (
            <button key={h.id} type="button" className="tf-btn tf-btn--small tf-btn--ghost" aria-pressed={help === h.id} onClick={() => onHelp(h.id)}>{h.name}</button>
          ))}
          {onReplayGuide && (progress.levels.garden?.finishes ?? 0) > 0 && (
            <button type="button" className="tf-btn tf-btn--small tf-btn--ghost" disabled={busy} onClick={onReplayGuide}>Replay the guide</button>
          )}
        </div>
      )}
      {error && <p className="tf-error" role="alert">{error}</p>}

      <ol className="tf-trail">
        {LEVELS.map((l) => {
          const rec = progress.levels[l.id];
          const open = levelOpen(progress, l.n, today);
          const flyer = FLYERS.find((f) => f.level === l.id);
          const left = finishesToUnlock(progress, l.id);
          const best = maths ? rec?.best ?? null : rec?.bestPlain ?? null;
          const isNext = next?.n === l.n;
          const look = LEVEL_LOOK[l.n - 1];
          return (
            <li key={l.id} className="tf-stop" data-open={open} data-next={isNext || undefined} style={{ ['--tf-a' as string]: look.a, ['--tf-b' as string]: look.b }}>
              <button
                type="button"
                className="tf-stop__btn"
                disabled={!open || busy}
                onClick={() => onPlay(l.n)}
                aria-label={`${l.name}${open ? '' : ', locked'}${rec?.medal ? `, ${MEDAL_WORD[rec.medal]} medal` : ''}`}
              >
                <span className="tf-stop__node" aria-hidden="true">
                  <span className="tf-stop__icon">{open ? look.icon : '🔒'}</span>
                </span>
                <span className="tf-stop__body">
                  <span className="tf-stop__name">{l.name}</span>
                  {open ? (
                    <>
                      <span className="tf-stop__line">
                        {rec?.medal ? <span title={MEDAL_WORD[rec.medal]}>{MEDAL_ICON[rec.medal]}</span> : <span className="tf-dim">No medal yet</span>}
                        {best !== null && <span className="tf-stop__best">{fmtSeconds(best)}</span>}
                      </span>
                      {flyer && (
                        <span className="tf-stop__flyer">
                          {left === 0 ? `${flyer.name} unlocked` : `${unlockRuns(l.id) - left} of ${unlockRuns(l.id)} to unlock the ${flyer.name}`}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="tf-stop__line tf-dim">{l.n === openedLevel(progress) + 1 && opensTomorrow(progress, today) ? 'Opens tomorrow. One new level a day.' : 'Locked. Finish the one before.'}</span>
                  )}
                  {isNext && <span className="tf-stop__go">Fly this one!</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
