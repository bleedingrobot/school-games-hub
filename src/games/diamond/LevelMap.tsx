/**
 * The level map (docs/DIAMOND-PLAN.md, section 7): the depth gauge as a cut-away of the ground, a chamber for each
 * level, Nugget with the next-step line, and the buttons to the rest of the game.
 */
import { useEffect, useRef } from 'react';
import { CAVERNS, FIRST_CAVERN, LAST_LEVEL, LEVELS, isCavern, levelSpec, type LevelSpec } from '../../../shared/diamond/config';
import { DIG_MONSTERS, goalWords } from '../../../shared/diamond/caverns';
import { cavernsOpen, digOpen, levelsOpen, type Player } from '../../../shared/diamond/progress';
import { artLevel, caveTint, monsterUrl } from './art/monsters';
import type { NextStep } from '../../../shared/diamond/nextStep';
import { drawGem, drawNugget } from './art/draw';
import { paintFile } from './art/paint';
import { drawRig, type Worn } from './art/items';
import type { DiamondPrefs } from './prefs';
import { HubButtons } from './HubButtons';
import { Sprite } from './Sprite';
import { KeyBadge } from '../../kit';

/** The colour of each level's chamber wall, from the topsoil down to the diamond heart. */
const CHAMBER = ['#7d4f25', '#b86236', '#7f7665', '#232b45', '#33254c', '#1b344c', '#7c6d57', '#52332d', '#331512', '#24163d'];

/** A layer of the depth gauge: a strip from the middle of that level's own painting, or its colour until there is one. */
function layerLook(level: number): string {
  const n = artLevel(level);
  const painted = paintFile('levels', `${n}-800`);
  const tint = caveTint(level);
  const wash = tint ? `linear-gradient(${tint}, ${tint}), ` : '';
  return painted ? `${wash}linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url(${painted}) center 60% / cover, ${CHAMBER[n - 1]}` : `${wash}${CHAMBER[n - 1]}`;
}

/** Where a pupil stands on one level or cavern. */
export function levelState(player: Player, now: Date, unlimited: boolean, n: number) {
  if (isCavern(n)) {
    const open = cavernsOpen(player, now, unlimited);
    const deepest = FIRST_CAVERN - 1 + (player.caves?.deepest ?? 0);
    return { passed: digOpen(player) && n <= deepest, isNext: n === open.next, nextOpen: open.nextOpen, stars: player.caves?.stars[n - FIRST_CAVERN] ?? 0 };
  }
  const open = levelsOpen(player, now, unlimited);
  return { passed: n <= player.deepest, isNext: n === open.next, nextOpen: open.nextOpen, stars: player.stars[n - 1] ?? 0 };
}

/** A cavern's sign: a first-form monster that lives there. */
const caveMonster = (spec: LevelSpec) => {
  const h = spec.cavern!.habitat;
  return (DIG_MONSTERS.find((s) => s.stage === 1 && s.rarity !== 'ultra' && (h === 'all' ? s.family === ['fractopus', 'squaremander', 'dozepebble', 'kilokiwi'][spec.level % 4] : s.type === h)) ?? DIG_MONSTERS[0]).id;
};
const levelName = (n: number) => (isCavern(n) ? `Cavern ${n - LAST_LEVEL}` : `Level ${n}`);

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
  const trail = useRef<[number, number][]>([]);
  const sel = levelState(player, now, unlimited, selected);
  const canPlay = sel.passed || (sel.isNext && sel.nextOpen);
  const why = sel.isNext && !sel.nextOpen ? `${levelName(selected)} opens tomorrow.` : !canPlay ? `${levelName(selected)} is still locked.` : '';
  const worn: Worn = player.worn;
  const dig = digOpen(player);

  const pick = levelSpec(selected);
  const pickPassed = sel.passed;
  const pickNext = sel.isNext;
  const pickLocked = !pickPassed && !pickNext;
  const pickStars = sel.stars;
  const pickArtLevel = artLevel(selected);
  const pickArt = paintFile('levels', `${pickArtLevel}`);

  const chamber = (spec: LevelSpec) => {
          const n = spec.level;
          const st = levelState(player, now, unlimited, n);
          const passed = st.passed;
          const isNext = st.isNext;
          const locked = !passed && !isNext;
          const tomorrow = isNext && !st.nextOpen;
          const stars = st.stars;
          const state = passed ? `passed, ${stars} of 3 stars` : tomorrow ? 'opens tomorrow' : isNext ? 'open now' : 'locked';
          return (
            <li key={n} className="dd-gauge__layer" style={{ background: layerLook(n) }}>
              <button
                type="button"
                className={`dd-chamber${spec.cavern ? ' is-cavern' : ''}${locked ? ' is-locked' : ''}${passed ? ' is-passed' : ''}${selected === n ? ' is-selected' : ''}${tomorrow ? ' is-tomorrow' : ''}`}
                onClick={() => onSelect(n)}
                aria-pressed={selected === n}
                aria-label={`${levelName(n)}, ${spec.place}: ${state}`}
              >
                <span className="dd-chamber__num" aria-hidden="true">{spec.cavern ? n - LAST_LEVEL : n}</span>
                <span className="dd-chamber__name" aria-hidden="true">{locked ? 'Locked' : spec.place}</span>
                <span className="dd-chamber__state" aria-hidden="true">
                  {passed ? '★★★'.slice(0, stars) + '☆☆☆'.slice(0, 3 - stars) : tomorrow ? 'Opens tomorrow' : isNext ? 'Open now' : '🔒'}
                </span>
                {(spec.cavern ? n - LAST_LEVEL === player.caves?.deepest : n === player.deepest) && <span className="dd-chamber__you">Deepest</span>}
                {!locked && (spec.cavern ? <img className="dd-chamber__gem" src={monsterUrl(caveMonster(spec))} alt="" width={30} height={30} /> : <Sprite size={30} className="dd-chamber__gem" draw={(c) => drawGem(c, spec.gem, 50, 52, 36)} />)}
              </button>
            </li>
          );
        };

  return (
    <section className={`dd-map${still ? ' is-still' : ''}`} aria-labelledby="dd-map-title">
      {/* The chosen level's painting fills the whole window behind everything, fading in afresh when a new level is picked. */}
      <div className="dd-map__art" aria-hidden="true">
        {pickArt ? <img key={selected} className="dd-map__paint" src={pickArt} alt="" style={{ background: `${CHAMBER[pickArtLevel - 1]} url(${paintFile('levels', `${pickArtLevel}-800`) ?? ''}) center / cover` }} /> : <div key={selected} className="dd-map__paint" style={{ background: CHAMBER[pickArtLevel - 1] }} />}
        <div className="dd-map__shade" />
        {!still && Array.from({ length: 14 }, (_, i) => <span key={i} className="dd-spark" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 0.83) % 7}s`, animationDuration: `${6 + (i % 5)}s` }} />)}
      </div>

      <div className="dd-map__top">
        <h2 id="dd-map-title" ref={heading} tabIndex={-1} className="dd-title">Diamond Drop</h2>
        <div className="dd-stats">
          <span className="dd-chip"><span aria-hidden="true">🪙</span> {player.coins} coins</span>
          <span className="dd-chip">Deepest: {player.deepest ? `level ${player.deepest}` : 'not started'}</span>
          {dig && <span className="dd-chip">Monster Dig: {player.caves?.deepest ? `cavern ${player.caves.deepest}` : 'open!'}</span>}
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
          <button type="button" className={`button button--play dd-btn dd-btn--big${glow === 'play' ? ' dd-glow' : ''}`} data-key="enter" onClick={() => onOpen('play')} disabled={!canPlay} aria-describedby={why ? 'dd-why' : undefined}>
            Play {levelName(selected).toLowerCase()}
          </button>
          {why && <p id="dd-why" className="dd-why">{why}</p>}
          <div className="dd-menu__row">
            <button type="button" className={`dd-tile${glow === 'shop' ? ' dd-glow' : ''}`} data-key="1" onClick={() => onOpen('shop')}><KeyBadge k="1" /><span className="dd-tile__icon" aria-hidden="true">🛒</span>Shop</button>
            <button type="button" className={`dd-tile${glow === 'book' ? ' dd-glow' : ''}`} data-key="2" onClick={() => onOpen('book')}><KeyBadge k="2" /><span className="dd-tile__icon" aria-hidden="true">📖</span>{dig ? 'Books' : 'Gem Book'}</button>
            <button type="button" className={`dd-tile${glow === 'hall' ? ' dd-glow' : ''}`} data-key="3" onClick={() => onOpen('hall')}><KeyBadge k="3" /><span className="dd-tile__icon" aria-hidden="true">🏆</span>Hall of Finders</button>
            <button type="button" className={`dd-tile${glow === 'how' ? ' dd-glow' : ''}`} data-key="4" onClick={() => onOpen('how')}><KeyBadge k="4" /><span className="dd-tile__icon" aria-hidden="true">❓</span>How to play</button>
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
        {pickLocked ? <span className="dd-hero__lock">🔒</span> : pick.cavern ? <img className={`dd-hero__gem${still ? '' : ' dd-float'}`} src={monsterUrl(caveMonster(pick), false, false)} alt="" width={150} height={150} /> : <Sprite size={150} className={`dd-hero__gem${still ? '' : ' dd-float'}`} draw={(c) => drawGem(c, pick.gem, 50, 50, 40)} />}
        <p className="dd-hero__level">{levelName(selected)}</p>
        <p className="dd-hero__place">{pickLocked ? 'Still locked' : pick.place}</p>
        <p className="dd-hero__state">
          {pickPassed ? <span className="dd-hero__stars">{'★★★'.slice(0, pickStars)}<span className="is-off">{'☆☆☆'.slice(0, 3 - pickStars)}</span></span>
            : pickNext && !sel.nextOpen ? 'Opens tomorrow' : pickNext ? (pick.cavern ? `${goalWords(pick.cavern.goal)} in ${pick.seconds} seconds` : `Bank ${pick.target} in ${pick.seconds} seconds`) : pick.cavern ? 'Pass the caverns above to dig down here' : 'Pass the levels above to dig down here'}
        </p>
      </div>

      <ol className="dd-gauge" aria-label="The levels, from the top of the ground down to the diamond">
        <li className="dd-gauge__sky" aria-hidden="true" />
        {LEVELS.map(chamber)}
        <li className="dd-gauge__heart" aria-label={player.lifetime.found > 0 ? 'The Heart Diamond: found!' : 'The Heart Diamond waits at the bottom'}>
          <Sprite size={56} className={still ? undefined : 'dd-pulse'} draw={(c) => drawGem(c, 'heartDiamond', 50, 50, 38, { halo: true })} />
        </li>
        {dig && <li className="dd-dig-gate">{paintFile('monsters', 'gate') && <img className="dd-dig-gate__art" src={paintFile('monsters', 'gate')} alt="" width={64} height={64} />}<p className="dd-dig-gate__title">⛏️ The Monster Dig 🐾</p></li>}
        {dig && CAVERNS.map(chamber)}
      </ol>
      <p className="dd-sr">{`Level ${LAST_LEVEL}, ${levelSpec(LAST_LEVEL).place}, holds the Heart Diamond.`}</p>
    </section>
  );
}
