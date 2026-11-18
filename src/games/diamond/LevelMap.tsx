/**
 * The level map (docs/DIAMOND-PLAN.md, section 7): the depth gauge as a cut-away of the ground, a chamber for each
 * level, Nugget with the next-step line, and the buttons to the rest of the game.
 */
import { useEffect, useRef } from 'react';
import { LAST_LEVEL, LEVELS, levelSpec } from '../../../shared/diamond/config';
import { levelsOpen, type Player } from '../../../shared/diamond/progress';
import type { NextStep } from '../../../shared/diamond/nextStep';
import { drawGem, drawNugget } from './art/draw';
import { paintFile } from './art/paint';
import { drawRig, type Worn } from './art/items';
import type { DiamondPrefs } from './prefs';
import { HubButtons } from './HubButtons';
import { Sprite } from './Sprite';

/** The colour of each level's chamber wall, from the topsoil down to the diamond heart. */
const CHAMBER = ['#7d4f25', '#b86236', '#7f7665', '#232b45', '#33254c', '#1b344c', '#7c6d57', '#52332d', '#331512', '#24163d'];

/** A layer of the depth gauge: a strip from the middle of that level's own painting, or its colour until there is one. */
function layerLook(n: number): string {
  const painted = paintFile('levels', `${n}-800`);
  return painted ? `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url(${painted}) center 60% / cover, ${CHAMBER[n - 1]}` : CHAMBER[n - 1];
}

export type MapButton = 'play' | 'shop' | 'book' | 'how' | 'hall';

export function LevelMap({
  player,
  now,
  unlimited = false,
  selected,
  onSelect,
  onOpen,
  step,
  glow,
  onShowMe,
  still,
  prefs,
  onPrefs,
}: {
  player: Player;
  now: Date;
  /** The teacher's switch: the next new level is open even after one today. */
  unlimited?: boolean;
  selected: number;
  onSelect: (level: number) => void;
  onOpen: (b: MapButton) => void;
  step: NextStep;
  /** The button "Show me" has lit up. */
  glow: MapButton | null;
  onShowMe: () => void;
  still: boolean;
  prefs: DiamondPrefs;
  onPrefs: (p: DiamondPrefs) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const open = levelsOpen(player, now, unlimited);
  const trail = useRef<[number, number][]>([]);
  const canPlay = selected <= player.deepest || (selected === open.next && open.nextOpen);
  const why = selected === open.next && !open.nextOpen ? `Level ${selected} opens tomorrow.` : selected > player.deepest + 1 ? `Level ${selected} is still locked.` : '';
  const worn: Worn = player.worn;

  const pick = levelSpec(selected);
  const pickPassed = selected <= player.deepest;
  const pickNext = selected === open.next;
  const pickLocked = !pickPassed && !pickNext;
  const pickStars = player.stars[selected - 1] ?? 0;
  const pickArt = paintFile('levels', `${selected}`);

  return (
    <section className={`dd-map${still ? ' is-still' : ''}`} aria-labelledby="dd-map-title">
      {/* The chosen level's painting fills the whole window behind everything, fading in afresh when a new level is picked. */}
      <div className="dd-map__art" aria-hidden="true">
        {pickArt ? <img key={selected} className="dd-map__paint" src={pickArt} alt="" style={{ background: `${CHAMBER[selected - 1]} url(${paintFile('levels', `${selected}-800`) ?? ''}) center / cover` }} /> : <div key={selected} className="dd-map__paint" style={{ background: CHAMBER[selected - 1] }} />}
        <div className="dd-map__shade" />
        {!still && Array.from({ length: 14 }, (_, i) => <span key={i} className="dd-spark" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 0.83) % 7}s`, animationDuration: `${6 + (i % 5)}s` }} />)}
      </div>

      <div className="dd-map__top">
        <h2 id="dd-map-title" ref={heading} tabIndex={-1} className="dd-title">Diamond Drop</h2>
        <div className="dd-stats">
          <span className="dd-chip"><span aria-hidden="true">🪙</span> {player.coins} coins</span>
          <span className="dd-chip">Deepest: {player.deepest ? `level ${player.deepest}` : 'not started'}</span>
          {player.freeBoost && <span className="dd-chip dd-chip--gold">Free boost waiting</span>}
        </div>
        <HubButtons />
      </div>

      <div className="dd-map__side">
        <div className="dd-nugget">
          <Sprite size={150} draw={(c, t) => drawNugget(c, 46, 96, 82, player.worn.hat, glow ? 'point' : 'wave', t, still)} animate={!still} />
          <div className="dd-bubble">
            <p className="dd-bubble__text" aria-live="polite">{step.text}</p>
            <button type="button" className="button button--light dd-btn dd-btn--small" onClick={onShowMe}>Show me</button>
          </div>
        </div>
        <div className="dd-menu">
          <button type="button" className={`button button--play dd-btn dd-btn--big${glow === 'play' ? ' dd-glow' : ''}`} onClick={() => onOpen('play')} disabled={!canPlay} aria-describedby={why ? 'dd-why' : undefined}>
            Play level {selected}
          </button>
          {why && <p id="dd-why" className="dd-why">{why}</p>}
          <div className="dd-menu__row">
            <button type="button" className={`dd-tile${glow === 'shop' ? ' dd-glow' : ''}`} onClick={() => onOpen('shop')}><span className="dd-tile__icon" aria-hidden="true">🛒</span>Shop</button>
            <button type="button" className={`dd-tile${glow === 'book' ? ' dd-glow' : ''}`} onClick={() => onOpen('book')}><span className="dd-tile__icon" aria-hidden="true">📖</span>Gem Book</button>
            <button type="button" className={`dd-tile${glow === 'hall' ? ' dd-glow' : ''}`} onClick={() => onOpen('hall')}><span className="dd-tile__icon" aria-hidden="true">🏆</span>Hall of Finders</button>
            <button type="button" className={`dd-tile${glow === 'how' ? ' dd-glow' : ''}`} onClick={() => onOpen('how')}><span className="dd-tile__icon" aria-hidden="true">❓</span>How to play</button>
          </div>
        </div>
        <details className="dd-settings">
          <summary>Settings</summary>
          <label className="dd-check">
            <input type="checkbox" checked={still} onChange={(e) => onPrefs({ ...prefs, lessMotion: e.target.checked })} />
            Less motion (no sparkles or shaking)
          </label>
          <label className="dd-check">
            <input type="checkbox" checked={prefs.slower} onChange={(e) => onPrefs({ ...prefs, slower: e.target.checked })} />
            Slower game (more time to aim)
          </label>
          <fieldset className="dd-help">
            <legend>Help from Nugget</legend>
            {(['auto', 'lots', 'some', 'off'] as const).map((h) => (
              <label key={h} className="dd-check">
                <input type="radio" name="dd-help" checked={prefs.help === h} onChange={() => onPrefs({ ...prefs, help: h })} />
                {h === 'auto' ? 'Less as I get better' : h === 'lots' ? 'Lots' : h === 'some' ? 'Some' : 'Off'}
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            className="button button--light dd-btn dd-btn--small"
            onClick={() => { onPrefs({ ...prefs, guideAgain: true, seenTips: [], help: prefs.help === 'off' ? 'auto' : prefs.help }); onSelect(1); }}
          >
            Replay the guide
          </button>
          {prefs.guideAgain && <p className="dd-small" role="status">Nugget will guide your next go at level 1.</p>}
        </details>
      </div>


      {/* The chosen level, big in the middle: the claw swinging over its gem, the place's name and how it went. */}
      <div className="dd-hero" key={selected} aria-hidden="true">
        <Sprite size={170} box={200} className="dd-hero__rig" draw={(c, t) => drawRig(c, worn, t, still, trail.current, false)} animate />
        {pickLocked ? <span className="dd-hero__lock">🔒</span> : <Sprite size={150} className={`dd-hero__gem${still ? '' : ' dd-float'}`} draw={(c) => drawGem(c, pick.gem, 50, 50, 40)} />}
        <p className="dd-hero__level">Level {selected}</p>
        <p className="dd-hero__place">{pickLocked ? 'Still locked' : pick.place}</p>
        <p className="dd-hero__state">
          {pickPassed ? <span className="dd-hero__stars">{'★★★'.slice(0, pickStars)}<span className="is-off">{'☆☆☆'.slice(0, 3 - pickStars)}</span></span>
            : pickNext && !open.nextOpen ? 'Opens tomorrow' : pickNext ? `Bank ${pick.target} in ${pick.seconds} seconds` : 'Pass the levels above to dig down here'}
        </p>
      </div>

      <ol className="dd-gauge" aria-label="The levels, from the top of the ground down to the diamond">
        <li className="dd-gauge__sky" aria-hidden="true" />
        {LEVELS.map((spec) => {
          const n = spec.level;
          const passed = n <= player.deepest;
          const isNext = n === open.next;
          const locked = !passed && !isNext;
          const tomorrow = isNext && !open.nextOpen;
          const stars = player.stars[n - 1] ?? 0;
          const state = passed ? `passed, ${stars} of 3 stars` : tomorrow ? 'opens tomorrow' : isNext ? 'open now' : 'locked';
          return (
            <li key={n} className="dd-gauge__layer" style={{ background: layerLook(n) }}>
              <button
                type="button"
                className={`dd-chamber${locked ? ' is-locked' : ''}${passed ? ' is-passed' : ''}${selected === n ? ' is-selected' : ''}${tomorrow ? ' is-tomorrow' : ''}`}
                onClick={() => onSelect(n)}
                aria-pressed={selected === n}
                aria-label={`Level ${n}, ${spec.place}: ${state}`}
              >
                <span className="dd-chamber__num" aria-hidden="true">{n}</span>
                <span className="dd-chamber__name" aria-hidden="true">{locked ? 'Locked' : spec.place}</span>
                <span className="dd-chamber__state" aria-hidden="true">
                  {passed ? '★★★'.slice(0, stars) + '☆☆☆'.slice(0, 3 - stars) : tomorrow ? 'Opens tomorrow' : isNext ? 'Open now' : '🔒'}
                </span>
                {n === player.deepest && <span className="dd-chamber__you">Deepest</span>}
                {!locked && <Sprite size={30} className="dd-chamber__gem" draw={(c) => drawGem(c, spec.gem, 50, 52, 36)} />}
              </button>
            </li>
          );
        })}
        <li className="dd-gauge__heart" aria-label={player.lifetime.found > 0 ? 'The Heart Diamond: found!' : 'The Heart Diamond waits at the bottom'}>
          <Sprite size={56} className={still ? undefined : 'dd-pulse'} draw={(c) => drawGem(c, 'heartDiamond', 50, 50, 38, { halo: true })} />
        </li>
      </ol>
      <p className="dd-sr">{`Level ${LAST_LEVEL}, ${levelSpec(LAST_LEVEL).place}, holds the Heart Diamond.`}</p>
    </section>
  );
}
