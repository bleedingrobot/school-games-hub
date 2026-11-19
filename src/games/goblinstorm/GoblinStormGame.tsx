/**
 * Goblin Storm's screens (docs/GOBLINSTORM-PLAN.md): pick a hero, pick a map, the run, and the end of the run.
 * Between runs: the gold shop and the Weapon Codex (BetweenRuns.tsx). All of it sits in one full-window layer over the hub. The game only talks to the backend it is given: the stand-in
 * in the preview, the school's server live.
 *
 * What's open comes from the pupil's save (`backend.me()`): Knight and Ranger and Castle Fields at first, each other
 * hero by its own deed and each map by beating the boss before it. The server checks both again when a run starts.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { HEROES, MAPS, UNLOCK_WORDS, type HeroDef } from '../../../shared/goblinstorm/config';
import { heroOpen, mapOpen } from '../../../shared/goblinstorm/server';
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
import { nextStep, type ShowMe } from './nextStep';
import { readQuality, saveQuality, setTipsSeen, tipsSeen, type Quality } from './quality';
import { hush, say } from './voice';
import { TIPS } from './voiceLines';
import './goblinstorm.css';

type Screen = 'hero' | 'map' | 'play' | 'end' | 'shop' | 'codex';

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

export function GoblinStormGame({ backend, extra, onServer = false }: {
  backend: GoblinStormBackend;
  extra?: ReactNode;
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
        setSave({ ...save, guideSeen: true });
        backend.guideSeen().catch(() => undefined);
      }
      setMapIndex(i);
      setRun(reply);
      setScreen('play');
    } catch (e) {
      // The server's own words when it said no ("All done for today. See you tomorrow!").
      setError(e instanceof GoblinStormError ? e.message : "Couldn't start a run. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gs-window">
      {screen === 'hero' && (
        <Menu title="Pick your hero" extra={extra}>
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
            {HEROES.map((h) => {
              const open = save ? heroOpen(save, h.id) : false;
              const secret = h.secret && !open;
              return (
                <button
                  key={h.id} type="button" disabled={!open}
                  className={`gs-pick${open ? '' : ' gs-pick--locked'}${hero.id === h.id && open ? ' gs-pick--chosen' : ''}`}
                  onClick={() => { setHero(h); setScreen('map'); }}
                >
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
          <p className="gs-menu__sub">Playing as {HERO_ICON[hero.id]} {hero.name}. Survive 3 minutes. A mini-boss comes at 1:30 and the boss at 2:30: beat the boss to win!</p>
          <div className="gs-grid gs-grid--maps">
            {MAPS.map((m, i) => {
              const open = save ? mapOpen(save, i) : i === 0;
              const beaten = save?.bosses.includes(i);
              return (
                <button key={m.id} type="button" disabled={!open || busy} className={`gs-pick gs-pick--map gs-pick--${m.id}${open ? '' : ' gs-pick--locked'}${shown?.kind === 'map' && shown.map === i ? ' gs-show' : ''}`} onClick={() => void play(i)}>
                  <span className="gs-pick__icon" aria-hidden="true">{MAP_ICON[m.id]}</span>
                  <span className="gs-pick__name">{m.name}</span>
                  <span className="gs-pick__blurb">{m.monsters.slice(0, 3).map((x) => x.name).join(', ')}</span>
                  <span className="gs-pick__blurb">Boss: {m.monsters[4].name}{beaten ? ' 👑 beaten' : ''}</span>
                  {!open && <span className="gs-pick__lock">🔒 {MAP_LOCK[m.id]}</span>}
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
          {save && (() => {
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
            </div>
          )}
          {save && (
            <div className="gs-row gs-between gs-settings">
              {save.guideSeen && (
                <button type="button" className="gs-btn gs-btn--ghost gs-btn--small" disabled={busy} onClick={() => void play(0, true)}>🧚 Replay the guide</button>
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
            setEnd(e);
            setScreen('end');
            loadSave();
          }}
        />
      )}

      {screen === 'end' && end && (
        <EndScreen end={end} onAgain={() => void play(mapIndex)} onMenu={() => setScreen('hero')} onShop={() => setScreen('shop')} busy={busy} error={error} newMap={newMap} />
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
          {back && <button type="button" className="gs-btn gs-btn--glass" onClick={back}>← Back</button>}
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

function EndScreen({ end, onAgain, onMenu, onShop, busy, error, newMap }: {
  end: RunEnd; onAgain: () => void; onMenu: () => void; onShop: () => void; busy: boolean; error: string | null; newMap: number | null;
}) {
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
        <div className="gs-row">
          <button type="button" className="gs-btn gs-btn--big" onClick={onAgain} disabled={busy} autoFocus>Play again</button>
          <button type="button" className="gs-btn gs-btn--ghost" onClick={onShop}>🛒 Shop</button>
          <button type="button" className="gs-btn gs-btn--ghost" onClick={onMenu}>Change hero</button>
        </div>
        {error && <p className="gs-menu__error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
