/**
 * Goblin Storm's screens (docs/GOBLINSTORM-PLAN.md): pick a hero, pick a map, the run, and the end of the run.
 * Between runs: the gold shop and the Weapon Codex (BetweenRuns.tsx). All of it sits in one full-window layer over the hub. The game only talks to the backend it is given: the stand-in
 * in the preview, the school's server live.
 *
 * What's open comes from the pupil's save (`backend.me()`): Knight and Ranger and Castle Fields at first, each other
 * hero by its own deed and each map by beating the boss before it. The server checks both again when a run starts.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyBadge, StoryBook, StoryShelf, useGameKeys, useStories, useStoryOnce } from '../../kit';
import type { Story } from '../../../shared/kit/stories';
import { HEROES, MAPS, UNLOCK_WORDS, type HeroDef } from '../../../shared/goblinstorm/config';
import { heroOpen, mapOpen, RUNS_A_DAY } from '../../../shared/goblinstorm/server';
import { CODEX_SIZE } from '../../../shared/goblinstorm/shop';
import { AchievementPop } from '../../achievements/AchievementPop';
import { TrophyWonLine } from '../../trophies/TrophyWonLine';
import { CodexScreen, GoldLine, ShopScreen, codexOf } from './BetweenRuns';
import { GoblinStormError, type GoblinStormBackend, type MySave, type StartReply } from './backend';
import { HubButtons } from './HubButtons';
import { powerPic, powerWords } from './heroPowers';
import { HERO_ICON, MAP_ICON, WEAPON_ICON } from './look';
import { Pic } from './Pic';
import { PlayScreen, type RunEnd } from './PlayScreen';
import { FirstTimeTip } from '../../kit';
import { useSound } from '../../sound';
import { OPENING, bossStory, goblinShelf, heroStory, mapStory } from './stories';
import { nextStep, type ShowMe } from './nextStep';
import { readQuality, saveQuality, setTipsSeen, tipsSeen, type Quality } from './quality';
import { hush, say } from './voice';
import { TIPS } from './voiceLines';
import './goblinstorm.css';

type Screen = 'hero' | 'map' | 'play' | 'end' | 'shop' | 'codex' | 'stories';

/** Speed and health as 1–5 dots, for the hero cards. */
const dots = (v: number, lo: number, hi: number) => Math.max(1, Math.min(5, Math.round(1 + ((v - lo) / (hi - lo)) * 4)));

function Dots({ n, label }: { n: number; label: string }) {
  return (
    <span className="gs-dots" aria-label={`${label} ${n} of 5`}>
      <span className="gs-dots__label">{label}</span>
      {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= n ? 'on' : ''} />)}
    </span>
  );
}

/** What opens each map after the first: the boss of the map before it. */
const MAP_LOCK: Record<string, string> = {
  forest: 'Beat the Goblin King to open',
  graveyard: 'Beat the Forest Ogre to open',
  peaks: 'Beat the Lich to open',
  lava: 'Beat the Ice Dragon to open',
};

/**
 * How many of today's runs are left, so "all done for today" is plain on every screen (James, 20 Nov 2026: pupils
 * couldn't tell they'd run out). On an Unlimited day there's no count.
 */
function RunsToday({ left, unlimited }: { left: number; unlimited: boolean }) {
  if (unlimited) return <p className="gs-runs gs-runs--unlimited">♾️ Unlimited runs today!</p>;
  return (
    <p className={`gs-runs${left === 0 ? ' gs-runs--none' : ''}`} aria-label={`Runs left today: ${left} of ${RUNS_A_DAY}`}>
      <span>⚔️ Runs left today:</span>
      <span className="gs-runs__pips" aria-hidden="true">
        {Array.from({ length: RUNS_A_DAY }, (_, i) => <i key={i} className={i < left ? 'on' : ''} />)}
      </span>
      <b>{left} of {RUNS_A_DAY}</b>
    </p>
  );
}

/** The big "come back tomorrow" card, shown at the top of each screen once today's runs are used up. */
function DoneToday() {
  return (
    <div className="gs-done" role="status">
      <span className="gs-done__icon" aria-hidden="true">🌙</span>
      <div>
        <h2 className="gs-done__title">All {RUNS_A_DAY} runs done for today!</h2>
        <p className="gs-done__line">Come back tomorrow for {RUNS_A_DAY} more. You can still look in the Shop and the Codex.</p>
      </div>
    </div>
  );
}

export function GoblinStormGame({ backend, extra, onServer = false, unlimitedToday }: {
  backend: GoblinStormBackend;
  extra?: ReactNode;
  /** Whether the class has Unlimited today on for Goblin Storm (live only; the preview has the normal 5). */
  unlimitedToday?: () => Promise<boolean>;
  /** The school's server is behind `backend`, so achievements and the Crown can be won (off in the preview). */
  onServer?: boolean;
}) {
  const [screen, setScreen] = useState<Screen>('hero');
  const [hero, setHero] = useState<HeroDef>(HEROES[0]);
  const [mapIndex, setMapIndex] = useState(0);
  const [run, setRun] = useState<StartReply | null>(null);
  const [end, setEnd] = useState<RunEnd | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [save, setSave] = useState<MySave | null>(null);
  const [saveError, setSaveError] = useState(false);
  /** The map this run opened, if it beat a boss for the first time. */
  const [newMap, setNewMap] = useState<number | null>(null);
  /** This run is the guided first go (Castle Fields, until the server says it's been seen, or "Replay the guide"). */
  const [guided, setGuided] = useState(false);
  const [quality, setQuality] = useState<Quality>(readQuality);
  /** What "Show me" is pointing at on the map screen. */
  const [shown, setShown] = useState<ShowMe | null>(null);
  const [tip, setTip] = useState<number | null>(null);
  const { soundOn } = useSound();
  const [unlimited, setUnlimited] = useState(false);
  useEffect(() => {
    unlimitedToday?.().then(setUnlimited, () => undefined);
  }, [unlimitedToday]);
  /** Runs left today, or null before the save loads. */
  const left = save ? Math.max(0, RUNS_A_DAY - save.today) : null;
  const outToday = left === 0 && !unlimited;

  const loadSave = useCallback(() => {
    setSaveError(false);
    backend.me().then(setSave, () => setSaveError(true));
  }, [backend]);
  useEffect(loadSave, [loadSave]);

  // The first-time tips on the map screen, once the guide has been seen and after the first run (kept on this device).
  useEffect(() => {
    if (screen === 'map' && save?.guideSeen && save.runs > 0 && tip === null && !tipsSeen()) setTip(0);
  }, [screen, save, tip]);
  useEffect(() => {
    if (tip !== null && tip < TIPS.length && soundOn) say(TIPS[tip]);
  }, [tip]);
  const closeTips = () => {
    setTip(TIPS.length);
    setTipsSeen();
    hush();
  };

  const windowRef = useRef<HTMLDivElement>(null);
  // Keys press the menu buttons (heroes and maps 1 to 9, Play again = Enter, Back = Esc); a run has its own keys (PlayScreen).
  // Stories (docs/plans/stories/PLAN.md, ST.3): the opening once the save loads, then a hero's story the first time they are
  // picked, a page the first time a later map is played, and one the first time a boss is beaten. All skippable, once each.
  const stories = useStories();
  const opening = useStoryOnce(OPENING.id, screen === 'hero' && !!save);
  const [book, setBook] = useState<{ story: Story; then?: () => void } | null>(null);
  /** Shows `story` first if this pupil hasn't seen it, then does `then`. */
  const storyFirst = (story: Story | null, then?: () => void) => {
    if (story && stories.shouldShow(story.id)) setBook({ story, then });
    else then?.();
  };
  const storyOpen = opening.open || book !== null;
  useGameKeys(windowRef, screen !== 'play' && !storyOpen);

  const play = async (i: number, replayGuide = false) => {
    setBusy(true);
    setError(null);
    setShown(null);
    try {
      const reply = await backend.start(hero.id, i);
      const guide = i === 0 && (replayGuide || (save !== null && !save.guideSeen));
      setGuided(guide);
      if (guide && save && !save.guideSeen) {
        // Kept in the server's save, so it isn't offered again on another device. A failure only means it shows again.
        setSave((s) => (s ? { ...s, guideSeen: true } : s));
        backend.guideSeen().catch(() => undefined);
      }
      if (reply.runsLeft === null) setUnlimited(true);
      // Count this run straight away; the save reloads at the end of the run.
      setSave((s) => (s ? { ...s, today: s.today + 1 } : s));
      setMapIndex(i);
      setRun(reply);
      setScreen('play');
    } catch (e) {
      // The server's own words when it said no ("All done for today. See you tomorrow!").
      if (e instanceof GoblinStormError && e.code === 'done-today') {
        // Out of runs (perhaps on another device): show the big card rather than a small line.
        setUnlimited(false);
        setSave((s) => (s ? { ...s, today: Math.max(s.today, RUNS_A_DAY) } : s));
        setScreen((now) => (now === 'end' ? 'map' : now));
      } else {
        setError(e instanceof GoblinStormError ? e.message : "Couldn't start a run. Try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gs-window" ref={windowRef}>
      {screen === 'hero' && (
        <Menu title="Pick your hero" extra={extra}>
          {outToday && <DoneToday />}
          {left !== null && !outToday && <RunsToday left={left} unlimited={unlimited} />}
          {save && (
            <p className="gs-menu__sub gs-progress">
              🦸 Heroes {HEROES.filter((h) => heroOpen(save, h.id)).length}/{HEROES.length} · 👑 Bosses beaten {save.bosses.length}/{MAPS.length}
            </p>
          )}
          {!save && !saveError && <p className="gs-menu__sub" role="status">Loading your save…</p>}
          {saveError && (
            <p className="gs-menu__error" role="alert">
              Your save couldn't be loaded. <button type="button" className="gs-btn gs-btn--ghost" onClick={loadSave}>Try again</button>
            </p>
          )}
          <div className="gs-grid">
            {HEROES.map((h, i) => {
              const open = save ? heroOpen(save, h.id) : false;
              const secret = h.secret && !open;
              return (
                <button
                  key={h.id} type="button" disabled={!open} data-key={i < 9 ? String(i + 1) : undefined}
                  className={`gs-pick${open ? '' : ' gs-pick--locked'}${hero.id === h.id && open ? ' gs-pick--chosen' : ''}`}
                  onClick={() => { setHero(h); storyFirst(heroStory(h.id), () => setScreen('map')); }}
                >
                  {i < 9 && <KeyBadge k={String(i + 1)} />}
                  <span className="gs-pick__icon" aria-hidden="true">{secret ? '❔' : <Pic path={`portraits/${h.id}`} small fallback={HERO_ICON[h.id]} className="gs-pic--portrait" />}</span>
                  <span className="gs-pick__name">{secret ? 'Secret hero' : h.name}</span>
                  {!secret && <span className="gs-pick__blurb">{h.blurb}</span>}
                  {!secret && (
                    <span className="gs-pick__stats">
                      <Dots n={dots(h.speed, 3, 4.6)} label="Speed" />
                      <Dots n={dots(h.health, 75, 140)} label="Health" />
                      <span className="gs-pick__weapon"><Pic path={powerPic(h.id, h.weapon)} small fallback={WEAPON_ICON[h.weapon]} className="gs-pic--inline" /> {powerWords(h.id, h.weapon).name}</span>
                    </span>
                  )}
                  {!open && <span className="gs-pick__lock">🔒 {UNLOCK_WORDS[h.unlock]}</span>}
                </button>
              );
            })}
          </div>
        </Menu>
      )}

      {screen === 'map' && (
        <Menu title="Pick a map" back={() => setScreen('hero')} extra={extra}>
          {outToday && <DoneToday />}
          {left !== null && !outToday && <RunsToday left={left} unlimited={unlimited} />}
          <p className="gs-menu__sub">Playing as {HERO_ICON[hero.id]} {hero.name}. Survive 3 minutes. A mini-boss comes at 1:30 and the boss at 2:30: beat the boss to win!</p>
          <div className="gs-grid gs-grid--maps">
            {MAPS.map((m, i) => {
              const open = save ? mapOpen(save, i) : i === 0;
              const beaten = save?.bosses.includes(i);
              return (
                <button key={m.id} type="button" disabled={!open || busy || outToday} data-key={i < 9 ? String(i + 1) : undefined} className={`gs-pick gs-pick--map gs-pick--${m.id}${open ? '' : ' gs-pick--locked'}${shown?.kind === 'map' && shown.map === i ? ' gs-show' : ''}`} onClick={() => storyFirst(mapStory(i), () => void play(i))}>
                  {i < 9 && <KeyBadge k={String(i + 1)} />}
                  <span className="gs-pick__icon" aria-hidden="true">{MAP_ICON[m.id]}</span>
                  <span className="gs-pick__name">{m.name}</span>
                  <span className="gs-pick__blurb">{m.monsters.slice(0, 3).map((x) => x.name).join(', ')}</span>
                  <span className="gs-pick__blurb">Boss: {m.monsters[4].name}{beaten ? ' 👑 beaten' : ''}</span>
                  {!open && <span className="gs-pick__lock">🔒 {MAP_LOCK[m.id]}</span>}
                  {open && outToday && <span className="gs-pick__lock">🌙 Come back tomorrow</span>}
                </button>
              );
            })}
          </div>
          {save && tip !== null && tip < TIPS.length && (
            <FirstTimeTip
              prefix="gs" who="Bella" face={<span className="gs-coach__face" aria-hidden="true">🧚</span>}
              say={TIPS[tip]} n={tip} of={TIPS.length} inline
              nextLabel="Next" lastLabel="Got it" closeLabel="Close the tips"
              onNext={() => setTip(tip + 1)} onClose={closeTips}
            />
          )}
          {save && !outToday && (() => {
            const next = nextStep(save);
            return (
              <p className="gs-next">
                <span>👉 {next.text}</span>
                <button type="button" className="gs-btn gs-btn--glass gs-btn--small" onClick={() => {
                  if (next.show.kind === 'hero') setScreen('hero');
                  else setShown(next.show);
                }}>Show me</button>
              </p>
            );
          })()}
          {save && (
            <div className="gs-row gs-between">
              <GoldLine save={save} />
              <button type="button" className={`gs-btn gs-btn--ghost${shown?.kind === 'shop' ? ' gs-show' : ''}`} onClick={() => setScreen('shop')}>🛒 Shop</button>
              <button type="button" className={`gs-btn gs-btn--ghost${shown?.kind === 'codex' ? ' gs-show' : ''}`} onClick={() => setScreen('codex')}>📖 Codex {codexOf(save)}/{CODEX_SIZE}</button>
              <button type="button" className="gs-btn gs-btn--ghost" onClick={() => setScreen('stories')}>📜 Stories</button>
            </div>
          )}
          {save && (
            <div className="gs-row gs-between gs-settings">
              {save.guideSeen && (
                <button type="button" className="gs-btn gs-btn--ghost gs-btn--small" disabled={busy || outToday} onClick={() => void play(0, true)}>🧚 Replay the guide</button>
              )}
              <span className="gs-quality" role="group" aria-label="Effects">
                <span>Effects:</span>
                {(['high', 'low'] as const).map((q) => (
                  <button key={q} type="button" aria-pressed={quality === q} className={`gs-btn gs-btn--small${quality === q ? '' : ' gs-btn--ghost'}`}
                    onClick={() => { setQuality(q); saveQuality(q); }}>{q === 'high' ? 'High' : 'Low'}</button>
                ))}
              </span>
            </div>
          )}
          {busy && <p className="gs-menu__sub" role="status">Getting ready…</p>}
          {error && <p className="gs-menu__error" role="alert">{error}</p>}
        </Menu>
      )}

      {screen === 'shop' && save && (
        <Menu title="Gold shop" back={() => setScreen('map')} extra={extra}>
          <ShopScreen backend={backend} save={save} onSave={setSave} />
        </Menu>
      )}

      {screen === 'codex' && save && (
        <Menu title="Weapon Codex" back={() => setScreen('map')} extra={extra}>
          <CodexScreen save={save} hero={hero} onHero={setHero} />
        </Menu>
      )}

      {screen === 'stories' && save && (
        <Menu title="Stories" back={() => setScreen('map')} extra={extra}>
          <StoryShelf
            stories={goblinShelf((id) => heroOpen(save, id), (i) => mapOpen(save, i), save.bosses)}
            book={{ className: 'gs-storybook' }}
          />
        </Menu>
      )}

      {screen === 'play' && run && (
        <PlayScreen
          key={run.seed}
          backend={backend}
          start={run}
          hero={hero}
          map={MAPS[mapIndex]}
          guided={guided}
          quality={quality}
          onEnd={(e) => {
            const opened = e.reply?.valid && e.reply.summary.bossBeaten && !save?.bosses.includes(mapIndex) && mapIndex + 1 < MAPS.length;
            setNewMap(opened ? mapIndex + 1 : null);
            if (e.reply?.valid && e.reply.summary.bossBeaten) storyFirst(bossStory(mapIndex));
            setEnd(e);
            setScreen('end');
            loadSave();
          }}
        />
      )}

      {screen === 'end' && end && (
        <EndScreen end={end} onAgain={() => void play(mapIndex)} onMenu={() => setScreen('hero')} onShop={() => setScreen('shop')} busy={busy} error={error} newMap={newMap}
          left={unlimited || left === null ? null : left} />
      )}
      {opening.open && <StoryBook story={OPENING} onClose={opening.close} endLabel="Let's go!" className="gs-storybook" />}
      {book && (
        <StoryBook
          story={book.story}
          endLabel={book.then ? "Let's go!" : 'The end'}
          className="gs-storybook"
          onClose={() => { const then = book.then; setBook(null); then?.(); }}
        />
      )}
      {/* Mounted for the whole game, so the trophy line knows what the pupil had before the run ended. */}
      <TrophyWonLine games={['goblinstorm']} watch={end?.reply ?? null} off={!onServer} />
      <AchievementPop games={['goblinstorm']} watch={end?.reply ?? null} off={!onServer} />
    </div>
  );
}

function Menu({ title, back, extra, children }: { title: string; back?: () => void; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="gs-menu">
      <header className="gs-menu__top">
        <div className="gs-menu__brand">
          {back && <button type="button" className="gs-btn gs-btn--glass" data-key="esc" onClick={back}>← Back</button>}
          <h1 className="gs-title">Goblin Storm</h1>
        </div>
        <HubButtons />
      </header>
      <h2 className="gs-menu__title">{title}</h2>
      {children}
      {extra}
    </div>
  );
}

const OUTCOME_WORDS = {
  won: { title: 'Victory!', icon: '🏆', line: 'You beat the boss!' },
  survived: { title: 'You survived!', icon: '🛡️', line: 'Beat the boss next time to win the map.' },
  lost: { title: 'You fell!', icon: '💫', line: 'Pick Armour or a Bubble Shield to take less damage.' },
  quit: { title: 'Run over', icon: '🚪', line: 'You left the run.' },
  running: { title: 'Run over', icon: '🚪', line: '' },
} as const;

function EndScreen({ end, onAgain, onMenu, onShop, busy, error, newMap, left }: {
  end: RunEnd; onAgain: () => void; onMenu: () => void; onShop: () => void; busy: boolean; error: string | null; newMap: number | null;
  /** Runs left today after this one (null on an Unlimited day). */
  left: number | null;
}) {
  const out = left === 0;
  const sum = end.reply?.summary;
  const words = OUTCOME_WORDS[sum?.outcome ?? 'quit'];
  const time = sum ? `${Math.floor(sum.seconds / 60)}:${String(sum.seconds % 60).padStart(2, '0')}` : '–';
  return (
    <div className="gs-menu gs-end">
      <header className="gs-menu__top">
        <h1 className="gs-title">Goblin Storm</h1>
        <HubButtons />
      </header>
      <div className={`gs-end__card gs-end__card--${sum?.outcome ?? 'quit'}`}>
        <span className="gs-end__icon" aria-hidden="true">{words.icon}</span>
        <h2 className="gs-end__title">{words.title}</h2>
        <p className="gs-end__line">{words.line}</p>
        {!end.reply && <p className="gs-menu__error" role="alert">Couldn't count up this run.</p>}
        {end.reply && !end.reply.valid && <p className="gs-menu__error" role="alert">This run didn't check out, so it doesn't count.</p>}
        {sum && (
          <dl className="gs-stats">
            <div><dt>Time</dt><dd>{time}</dd></div>
            <div><dt>Level</dt><dd>{sum.level}</dd></div>
            <div><dt>Monsters beaten</dt><dd>{sum.kills}</dd></div>
            <div><dt>Gold</dt><dd>🪙 {sum.gold}</dd></div>
            <div><dt>Evolutions</dt><dd>{sum.evolved.length ? sum.evolved.map((w) => powerWords(end.hero.id, w).evolved).join(', ') : 'none yet'}</dd></div>
            <div><dt>Bosses</dt><dd>{[sum.miniBeaten && end.map.monsters[3].name, sum.bossBeaten && end.map.monsters[4].name].filter(Boolean).join(', ') || 'none yet'}</dd></div>
          </dl>
        )}
        {newMap !== null && <p className="gs-end__new">{MAP_ICON[MAPS[newMap].id]} New map open: {MAPS[newMap].name}!</p>}
        {end.reply?.unlocked?.map((id) => {
          const h = HEROES.find((x) => x.id === id);
          return h ? <p key={id} className="gs-end__new">{HERO_ICON[h.id]} New hero: {h.name}!</p> : null;
        })}
        <p className="gs-end__who">{HERO_ICON[end.hero.id]} {end.hero.name} on {MAP_ICON[end.map.id]} {end.map.name}</p>
        {out && <DoneToday />}
        {left !== null && !out && <RunsToday left={left} unlimited={false} />}
        <div className="gs-row">
          {!out && <button type="button" className="gs-btn gs-btn--big" data-key="enter" onClick={onAgain} disabled={busy} autoFocus>Play again</button>}
          <button type="button" className="gs-btn gs-btn--ghost" onClick={onShop}>🛒 Shop</button>
          <button type="button" className="gs-btn gs-btn--ghost" data-key="esc" onClick={onMenu}>Change hero</button>
        </div>
        {error && <p className="gs-menu__error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
