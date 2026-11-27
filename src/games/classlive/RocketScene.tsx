/**
 * Rocket Relay on the big screen (docs/ROCKET-PLAN.md): one lane per team with its rocket climbing to the Moon, the
 * runner now (glowing while they're at their iPad) and who's next. Boosts flare up; the first rocket to the Moon wins.
 */
import { useEffect, useRef, useState } from 'react';
import type { RocketGame } from '../../../shared/classlive/rocket';
import { rocketPlaces, winningTeam } from '../../../shared/classlive/rocket';
import { rocketPublic } from '../../../shared/classlive/rocketServer';
import type { ScreenView } from '../../../shared/classlive/server';
import { speak } from '../../speech';
import { painted } from './paintedArt';
import { next, ROCKET_MOON_LINES, VOICE_FOLDER } from './voiceLines';
import './rocket.css';

export function RocketScene({ screen, game, over, muted, onEnd, onAgain }: {
  screen: ScreenView;
  game: RocketGame;
  over: boolean;
  muted: boolean;
  onEnd: () => void;
  onAgain: () => void;
}) {
  const pub = rocketPublic(game);
  const [flare, setFlare] = useState<Record<number, number>>({});
  const [sureEnd, setSureEnd] = useState(false);
  const seen = useRef<number | null>(null);
  const said = useRef(0);
  const say = (text: string) => { if (!muted) speak(text, VOICE_FOLDER); };
  const shown = (name: string) => (screen.showNames ? name : '');

  useEffect(() => {
    const evs = screen.events as unknown as { type: string; seq: number; team?: number }[];
    if (seen.current === null) { seen.current = screen.seq; return; }
    const fresh = evs.filter((e) => e.seq > (seen.current as number)).sort((a, b) => a.seq - b.seq);
    if (!fresh.length) return;
    seen.current = Math.max(...fresh.map((e) => e.seq));
    for (const e of fresh) {
      if (e.type === 'rocket_boost' && e.team !== undefined) {
        setFlare((f) => ({ ...f, [e.team as number]: Date.now() }));
        if (Date.now() - said.current > 6000) { said.current = Date.now(); say(next('rocketBoost')); }
      }
      if (e.type === 'rocket_moon' && e.team !== undefined) say(ROCKET_MOON_LINES[e.team % ROCKET_MOON_LINES.length]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen.seq]);

  useEffect(() => { if (over) say(next('rocketEnd')); /* once */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);

  const back = painted('relay', 'back') ?? painted('back', 'star-sky');
  const win = over ? winningTeam(game) : game.winner;

  if (over) {
    const places = rocketPlaces(game);
    return (
      <div className="rk-stage" style={back ? { backgroundImage: `url(${back})` } : undefined}>
        <div className="rk-over">
          <h1>{win !== null ? `🏆 ${pub.teams[win].name} team wins!` : '🚀 What a race!'}</h1>
          <ol>
            {places.map((i) => (
              <li key={i} style={{ borderColor: pub.teams[i].colour }}>
                <b>{pub.teams[i].name}</b>
                <span>{Math.min(100, Math.round((pub.teams[i].height / pub.moon) * 100))}% of the way to the Moon</span>
              </li>
            ))}
          </ol>
          <button type="button" className="rk-btn rk-btn--go" onClick={onAgain}>Play again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="rk-stage" style={back ? { backgroundImage: `url(${back})` } : undefined}>
      <header className="rk-top">
        <b>🚀 Rocket Relay</b>
        <span className="rk-chip">{pub.perRun === 1 ? '1 question a run' : `${pub.perRun} questions a run`}</span>
        {screen.joinCode && <span className="rk-chip">Join code {screen.joinCode}</span>}
        <span className="rk-top__gap" />
        {sureEnd ? (
          <>
            <button type="button" className="rk-btn rk-btn--stop" onClick={onEnd}>Yes, end the race</button>
            <button type="button" className="rk-btn" onClick={() => setSureEnd(false)}>Keep racing</button>
          </>
        ) : <button type="button" className="rk-btn" onClick={() => setSureEnd(true)}>End</button>}
      </header>
      <div className="rk-moon" aria-hidden="true">🌕</div>
      <main className="rk-lanes" style={{ gridTemplateColumns: `repeat(${pub.teams.length}, minmax(0, 1fr))` }}>
        {pub.teams.map((t, i) => {
          const k = Math.min(1, t.height / pub.moon);
          const flaring = flare[i] && Date.now() - flare[i] < 1500;
          return (
            <section key={t.name} className={`rk-lane ${win === i ? 'rk-lane--won' : ''}`} style={{ ['--c' as string]: t.colour }} aria-label={`${t.name} team`}>
              <div className="rk-track">
                <div className="rk-trail" style={{ height: `${k * 100}%` }} />
                <div className={`rk-rocket ${flaring ? 'rk-rocket--flare' : ''}`} key={flare[i] ?? 0} style={{ bottom: `calc(${k} * (100% - 1.2em))` }}>🚀</div>
              </div>
              <footer className="rk-foot">
                <b>{t.name}</b>
                {win === i ? <span className="rk-now">🌕 On the Moon!</span> : t.runner && (
                  <span className={`rk-now ${t.active ? 'rk-now--here' : ''}`}>{t.active ? '🔥 ' : '🏃 '}{shown(t.runner.name) || 'Runner'}{t.active ? ' answering' : ''}</span>
                )}
                {win === null && t.next && <span className="rk-next-name">Next: {shown(t.next.name) || '…'}</span>}
              </footer>
            </section>
          );
        })}
      </main>
      {game.winner !== null && (
        <div className="rk-winner" role="status">
          <b>🌕 {pub.teams[game.winner].name} team reached the Moon!</b>
          <button type="button" className="rk-btn rk-btn--go" onClick={onEnd}>Finish the race</button>
        </div>
      )}
    </div>
  );
}
