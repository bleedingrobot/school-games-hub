/**
 * The level map (docs/DIAMOND-PLAN.md, section 7; redesigned in docs/DIAMOND-MENU-PLAN.md): a slim top bar, the depth
 * gauge as a cut-away of the ground (Levels and Monster Dig on tabs), Nugget with the next-step line, and the buttons to
 * the rest of the game. On a phone or a short window the gauge becomes a strip of stones you swipe sideways.
 */
import { useEffect, useRef, useState } from 'react';
import { CAVERNS, FIRST_CAVERN, LAST_LEVEL, LEVELS, isCavern, levelSpec, type LevelSpec } from '../../../shared/diamond/config';
import { DIG_MONSTERS, goalWords } from '../../../shared/diamond/caverns';
import { cavernsOpen, digOpen, levelsOpen, type Player } from '../../../shared/diamond/progress';
import { artLevel, caveTint, monsterUrl } from './art/monsters';
import type { NextStep } from '../../../shared/diamond/nextStep';
import { drawGem, drawNugget } from './art/draw';
import { paintFile } from './art/paint';
import { drawRig, type Worn } from './art/items';
import type { DiamondPrefs } from './prefs';
import { HubLink, SoundButton } from './HubButtons';
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
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  const dig = digOpen(player);
  // Levels or the Monster Dig: one list of 10 at a time, always the one holding the chosen level.
  const [tab, setTab] = useState<'levels' | 'dig'>(dig && isCavern(selected) ? 'dig' : 'levels');
  useEffect(() => setTab(dig && isCavern(selected) ? 'dig' : 'levels'), [selected, dig]);
  const pickTab = (t: 'levels' | 'dig') => {
    if (t === tab) return;
    setTab(t);
    // Choose the level a pupil most likely wants on that tab: the next one, else the deepest passed.
    if (t === 'dig') {
      const open = cavernsOpen(player, now, unlimited);
      onSelect(open.next ?? FIRST_CAVERN - 1 + Math.max(1, player.caves?.deepest ?? 1));
    } else {
      const open = levelsOpen(player, now, unlimited);
      onSelect(open.next ?? Math.max(1, player.deepest));
    }
  };
  // The chosen stone stays in view in the sideways strip (and the tall gauge), without moving the page.
  const gaugeRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = gaugeRef.current;
    const btn = list?.querySelector<HTMLElement>('.dd-chamber.is-selected');
    if (!list || !btn) return;
    if (list.scrollWidth > list.clientWidth + 2) list.scrollTo({ left: btn.offsetLeft - list.clientWidth / 2 + btn.offsetWidth / 2, behavior: 'auto' });
  }, [selected, tab]);
  const settingsRef = useRef<HTMLDetailsElement>(null);
  const trail = useRef<[number, number][]>([]);
  const sel = levelState(player, now, unlimited, selected);
  const canPlay = sel.passed || (sel.isNext && sel.nextOpen);
  const why = sel.isNext && !sel.nextOpen ? `${levelName(selected)} opens tomorrow.` : !canPlay ? `${levelName(selected)} is still locked.` : '';
  const worn: Worn = player.worn;

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
                <span className="dd-chamber__mini" aria-hidden="true">{passed ? '★'.repeat(stars) || '✓' : tomorrow ? '⏳' : isNext ? 'Go!' : '🔒'}</span>
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

      <header className="dd-bar">
        <HubLink />
        <h2 id="dd-map-title" ref={heading} tabIndex={-1} className="dd-title">Diamond Drop</h2>
        <span className="dd-chip dd-chip--coins"><span aria-hidden="true">🪙</span> {player.coins}<span className="dd-chip__word"> coins</span><span className="dd-sr"> coins</span></span>
        <details className="dd-settings" ref={settingsRef}>
          <summary className="dd-hubbtn dd-hubbtn--round" aria-label="Settings" title="Settings"><span aria-hidden="true">⚙️</span></summary>
          <div className="dd-settings__panel">
            <p className="dd-settings__title">Settings</p>
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
            <div className="dd-row">
              <button
                type="button"
                className="button button--light dd-btn dd-btn--small"
                onClick={() => { onPrefs({ ...prefs, guideAgain: true, seenTips: [], help: prefs.help === 'off' ? 'auto' : prefs.help }); onSelect(1); }}
              >
                Replay the guide
              </button>
              <button type="button" className="button button--play dd-btn dd-btn--small" onClick={() => { if (settingsRef.current) settingsRef.current.open = false; }}>Done</button>
            </div>
            {prefs.guideAgain && <p className="dd-small" role="status">Nugget will guide your next go at level 1.</p>}
          </div>
        </details>
        <SoundButton />
      </header>

      <div className="dd-map__side">
        <div className="dd-nugget">
          <Sprite size={150} className="dd-nugget__kiwi" draw={(c, t) => drawNugget(c, 46, 96, 82, player.worn.hat, glow ? 'point' : 'wave', t, still)} animate={!still} />
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
            <button type="button" className={`dd-tile${glow === 'shop' ? ' dd-glow' : ''}`} data-key="1" onClick={() => onOpen('shop')}><KeyBadge k="1" /><span className="dd-tile__icon" aria-hidden="true">🛒</span>Shop{player.freeBoost && <span className="dd-tile__badge">Free boost!</span>}</button>
            <button type="button" className={`dd-tile${glow === 'book' ? ' dd-glow' : ''}`} data-key="2" onClick={() => onOpen('book')}><KeyBadge k="2" /><span className="dd-tile__icon" aria-hidden="true">📖</span>{dig ? 'Books' : 'Gem Book'}</button>
            <button type="button" className={`dd-tile${glow === 'hall' ? ' dd-glow' : ''}`} data-key="3" onClick={() => onOpen('hall')}><KeyBadge k="3" /><span className="dd-tile__icon" aria-hidden="true">🏆</span><span className="dd-tile__long">Hall of Finders</span><span className="dd-tile__short" aria-hidden="true">Hall</span></button>
            <button type="button" className={`dd-tile${glow === 'how' ? ' dd-glow' : ''}`} data-key="4" onClick={() => onOpen('how')}><KeyBadge k="4" /><span className="dd-tile__icon" aria-hidden="true">❓</span><span className="dd-tile__long">How to play</span><span className="dd-tile__short" aria-hidden="true">Help</span></button>
          </div>
        </div>
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

      <div className="dd-depth">
        <div className="dd-depth__head">
          {dig ? (
            <div className="dd-depth__tabs" role="group" aria-label="Which dig">
              <button type="button" className={`dd-depth__tab${tab === 'levels' ? ' is-on' : ''}`} aria-pressed={tab === 'levels'} onClick={() => pickTab('levels')}>⛏️ Levels</button>
              <button type="button" className={`dd-depth__tab${tab === 'dig' ? ' is-on' : ''}`} aria-pressed={tab === 'dig'} onClick={() => pickTab('dig')}>🐾 Monster Dig</button>
            </div>
          ) : <p className="dd-depth__name">⛏️ The dig</p>}
          <p className="dd-depth__deepest">
            Deepest: {tab === 'dig' ? (player.caves?.deepest ? `cavern ${player.caves.deepest}` : 'not yet') : player.deepest ? `level ${player.deepest}` : 'not started'}
          </p>
        </div>
        {tab === 'levels' ? (
          <ol ref={gaugeRef} className="dd-gauge" aria-label="The levels, from the top of the ground down to the diamond">
            <li className="dd-gauge__sky" aria-hidden="true" />
            {LEVELS.map(chamber)}
            <li className="dd-gauge__heart" aria-label={player.lifetime.found > 0 ? 'The Heart Diamond: found!' : 'The Heart Diamond waits at the bottom'}>
              <Sprite size={56} className={still ? undefined : 'dd-pulse'} draw={(c) => drawGem(c, 'heartDiamond', 50, 50, 38, { halo: true })} />
            </li>
          </ol>
        ) : (
          <ol ref={gaugeRef} className="dd-gauge dd-gauge--dig" aria-label="The Monster Dig caverns, from the gate down">
            <li className="dd-dig-gate">{paintFile('monsters', 'gate') && <img className="dd-dig-gate__art" src={paintFile('monsters', 'gate')} alt="" width={64} height={64} />}<p className="dd-dig-gate__title">The Monster Dig</p></li>
            {CAVERNS.map(chamber)}
          </ol>
        )}
      </div>
      <p className="dd-sr">{`Level ${LAST_LEVEL}, ${levelSpec(LAST_LEVEL).place}, holds the Heart Diamond.`}</p>
    </section>
  );
}
