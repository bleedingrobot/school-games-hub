/**
 * Goblin Storm's screens (docs/GOBLINSTORM-PLAN.md, stage 2): pick a hero, pick a map, the run, and the end of the run.
 * All of it sits in one full-window layer over the hub. The game only talks to the backend it is given: the stand-in
 * in the preview for now, the school's server from stage 3.
 *
 * Stage 2 has no save yet, so only the free heroes and the first map are open; the rest show what opens them.
 */
import { useState, type ReactNode } from 'react';
import { HEROES, MAPS, UNLOCK_WORDS, WEAPONS, type HeroDef } from '../../../shared/goblinstorm/config';
import { GoblinStormError, type GoblinStormBackend, type StartReply } from './backend';
import { HubButtons } from './HubButtons';
import { HERO_ICON, MAP_ICON, WEAPON_ICON } from './look';
import { PlayScreen, type RunEnd } from './PlayScreen';
import './goblinstorm.css';

type Screen = 'hero' | 'map' | 'play' | 'end';

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

/** Which maps open: each map's boss opens the next. Stage 2 has no save, so only the first. */
const MAP_LOCK: Record<string, string> = {
  forest: 'Beat the Goblin King to open',
  graveyard: 'Beat the Forest Ogre to open',
  peaks: 'Beat the Lich to open',
  lava: 'Beat the Ice Dragon to open',
};

export function GoblinStormGame({ backend, extra }: { backend: GoblinStormBackend; extra?: ReactNode }) {
  const [screen, setScreen] = useState<Screen>('hero');
  const [hero, setHero] = useState<HeroDef>(HEROES[0]);
  const [mapIndex, setMapIndex] = useState(0);
  const [run, setRun] = useState<StartReply | null>(null);
  const [end, setEnd] = useState<RunEnd | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const play = async (i: number) => {
    setBusy(true);
    setError(null);
    try {
      const reply = await backend.start(hero.id, i);
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
          <div className="gs-grid">
            {HEROES.map((h) => {
              const open = h.unlock === 'free';
              const secret = h.secret && !open;
              return (
                <button
                  key={h.id} type="button" disabled={!open}
                  className={`gs-pick${open ? '' : ' gs-pick--locked'}${hero.id === h.id && open ? ' gs-pick--chosen' : ''}`}
                  onClick={() => { setHero(h); setScreen('map'); }}
                >
                  <span className="gs-pick__icon" aria-hidden="true">{secret ? '❔' : HERO_ICON[h.id]}</span>
                  <span className="gs-pick__name">{secret ? 'Secret hero' : h.name}</span>
                  {!secret && <span className="gs-pick__blurb">{h.blurb}</span>}
                  {!secret && (
                    <span className="gs-pick__stats">
                      <Dots n={dots(h.speed, 3, 4.6)} label="Speed" />
                      <Dots n={dots(h.health, 75, 140)} label="Health" />
                      <span className="gs-pick__weapon">{WEAPON_ICON[h.weapon]} {WEAPONS[h.weapon].name}</span>
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
              const open = i === 0;
              return (
                <button key={m.id} type="button" disabled={!open || busy} className={`gs-pick gs-pick--map gs-pick--${m.id}${open ? '' : ' gs-pick--locked'}`} onClick={() => void play(i)}>
                  <span className="gs-pick__icon" aria-hidden="true">{MAP_ICON[m.id]}</span>
                  <span className="gs-pick__name">{m.name}</span>
                  <span className="gs-pick__blurb">{m.monsters.slice(0, 3).map((x) => x.name).join(', ')}</span>
                  <span className="gs-pick__blurb">Boss: {m.monsters[4].name}</span>
                  {!open && <span className="gs-pick__lock">🔒 {MAP_LOCK[m.id]}</span>}
                </button>
              );
            })}
          </div>
          {busy && <p className="gs-menu__sub" role="status">Getting ready…</p>}
          {error && <p className="gs-menu__error" role="alert">{error}</p>}
        </Menu>
      )}

      {screen === 'play' && run && (
        <PlayScreen
          key={run.seed}
          backend={backend}
          start={run}
          hero={hero}
          map={MAPS[mapIndex]}
          onEnd={(e) => { setEnd(e); setScreen('end'); }}
        />
      )}

      {screen === 'end' && end && (
        <EndScreen end={end} onAgain={() => void play(mapIndex)} onMenu={() => setScreen('hero')} busy={busy} />
      )}
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

function EndScreen({ end, onAgain, onMenu, busy }: { end: RunEnd; onAgain: () => void; onMenu: () => void; busy: boolean }) {
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
            <div><dt>Evolutions</dt><dd>{sum.evolved.length ? sum.evolved.map((w) => WEAPONS[w].evolved.name).join(', ') : 'none yet'}</dd></div>
            <div><dt>Bosses</dt><dd>{[sum.miniBeaten && end.map.monsters[3].name, sum.bossBeaten && end.map.monsters[4].name].filter(Boolean).join(', ') || 'none yet'}</dd></div>
          </dl>
        )}
        <p className="gs-end__who">{HERO_ICON[end.hero.id]} {end.hero.name} on {MAP_ICON[end.map.id]} {end.map.name}</p>
        <div className="gs-row">
          <button type="button" className="gs-btn gs-btn--big" onClick={onAgain} disabled={busy} autoFocus>Play again</button>
          <button type="button" className="gs-btn gs-btn--ghost" onClick={onMenu}>Change hero</button>
        </div>
      </div>
    </div>
  );
}
