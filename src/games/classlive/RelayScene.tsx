/**
 * Toon Flap Relay on the big screen (docs/RELAY-PLAN.md): the race header and clock, the race bar (every team's bird on
 * one track to the nest), one lane a team (each flyer's saved flaps played back a moment behind), effect toasts, Bella
 * the commentator, the standings after each race and the finish. Bella only ever names team colours, never a pupil, and
 * never calls out a bump. The race runs on the server's clock: this asks the server (`onTick`) just after each deadline.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FX_WORDS, isTrouble, RACE_MS, relayCourse, relayDeadline, relayPodium, TEAM_WORDS, TURN_STEPS, type RelayGame,
} from '../../../shared/classlive/relay';
import type { ScreenView } from '../../../shared/classlive/server';
import type { ClassLiveSound } from './audio';
import type { ClassLiveLink } from './link';
import { drawLane, LanePlayer } from './relayDraw';
import { relayLine } from './relayLines';
import { FxIcon } from './RelayCard';
import type { FlyerPose } from '../toonflap/art/art';

type Person = ScreenView['people'][number];

const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

export function RelayScene({ screen, game, clock, sound, say, onTick, over, onAgain }: {
  screen: ScreenView; game: RelayGame; link: ClassLiveLink; room: number | null;
  clock: () => number;
  sound: ClassLiveSound; say: (text: string, delay?: number) => void;
  onTick: () => void;
  over: boolean;
  onAgain: () => void;
}) {
  const t = screen.startedAt === null ? 0 : clock() - screen.startedAt;
  const r = game.race;
  const [, setFrame] = useState(0);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const players = useRef<LanePlayer[]>([]);
  const raceKey = r ? `${r.n}:${r.seed}` : '';
  const seenRace = useRef('');
  if (seenRace.current !== raceKey) {
    seenRace.current = raceKey;
    players.current = [];
  }
  const gameRef = useRef(game);
  gameRef.current = game;

  // Bella: a line at a time, the small ones skipped when she has just spoken.
  const saidAt = useRef(0);
  const talk = (key: string, delay = 0, small = false) => {
    const now = Date.now();
    if (small && now - saidAt.current < 4000) return;
    const line = relayLine(key);
    if (!line) return;
    saidAt.current = now;
    say(line, delay);
  };

  // The lanes: one loop draws every team's lane.
  useEffect(() => {
    if (over || !r) return;
    let id = 0;
    let last = performance.now();
    const reduced = reducedMotion();
    const loop = (ts: number) => {
      const dt = Math.min(0.25, (ts - last) / 1000);
      last = ts;
      const g = gameRef.current;
      const race = g.race;
      if (race) {
        const base = relayCourse(race.n, race.seed);
        g.teams.forEach((tm, i) => {
          const cv = canvases.current[i];
          if (!cv) return;
          const lp = (players.current[i] ??= new LanePlayer());
          const st = lp.update(base, tm.effects, tm.turn, tm.x, dt * 60);
          const w = cv.clientWidth, h = cv.clientHeight;
          if (!w || !h) return;
          const k = Math.min(2, window.devicePixelRatio || 1);
          if (cv.width !== Math.round(w * k) || cv.height !== Math.round(h * k)) {
            cv.width = Math.round(w * k);
            cv.height = Math.round(h * k);
          }
          const c = cv.getContext('2d');
          if (!c) return;
          c.setTransform(k, 0, 0, k, 0, 0);
          const pose: FlyerPose = st.mode === 'hover' && st.hover === 'bump' ? 'dizzy' : tm.finishT !== null ? 'cheer' : st.vy > 1.5 ? 'up' : 'glide';
          drawLane(c, { course: lp.course ?? base, effects: tm.effects, state: st, w, h, time: ts / 1000, colour: TEAM_WORDS[tm.colour].colour, reduced, own: false, pose });
        });
      }
      setFrame((f) => (f + 1) % 1_000_000);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over, raceKey, game.teams.length]);

  // Ask the server to move the game on just after each deadline (and now and then while a race is on).
  const deadline = relayDeadline(game, screen.startedAt) ?? 4000;
  const tick = useRef(onTick);
  tick.current = onTick;
  useEffect(() => {
    if (over || screen.startedAt === null) return;
    const wait = Math.max(50, deadline - t + 150);
    const id = window.setTimeout(() => tick.current(), wait);
    const again = window.setTimeout(() => tick.current(), wait + 2500);
    return () => { window.clearTimeout(id); window.clearTimeout(again); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, over, screen.startedAt]);
  useEffect(() => {
    if (over) return;
    const id = window.setInterval(() => tick.current(), 4000);
    return () => window.clearInterval(id);
  }, [over]);

  const phase = !r ? 'ready' : r.endT !== null ? 'show' : t < r.goT ? 'count' : 'race';
  const countLeft = r && phase === 'count' ? Math.max(1, Math.ceil((r.goT - t) / 1000)) : null;
  const raceLeft = r && phase === 'race' ? Math.max(0, Math.ceil((r.goT + RACE_MS - t) / 1000)) : null;
  const lastCount = useRef<number | null>(null);
  useEffect(() => {
    if (countLeft === null || countLeft === lastCount.current) return;
    lastCount.current = countLeft;
    if (countLeft <= 3) sound.play(countLeft === 1 ? 'tickLast' : 'tick');
  }, [countLeft, sound]);
  const lastRaceTick = useRef<number | null>(null);
  useEffect(() => {
    if (raceLeft === null || raceLeft === lastRaceTick.current) return;
    lastRaceTick.current = raceLeft;
    if (raceLeft <= 5 && raceLeft > 0) sound.play(raceLeft <= 3 ? 'tickLast' : 'tick');
  }, [raceLeft, sound]);

  // Nearly at the nest: once a race.
  const nestX = r ? relayCourse(r.n, r.seed).nestX : 1;
  const leadFrac = Math.max(0, ...game.teams.map((tm) => tm.x / nestX));
  const lastSaid = useRef('');
  useEffect(() => {
    if (!r || phase !== 'race' || leadFrac < 0.85 || lastSaid.current === raceKey) return;
    lastSaid.current = raceKey;
    talk('relayLast', 0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadFrac >= 0.85, phase, raceKey]);

  const seenSeq = useRef<number | null>(null);
  const [toasts, setToasts] = useState<{ key: number; team: number; text: string; bad: boolean; kind?: keyof typeof FX_WORDS }[]>([]);
  useEffect(() => {
    if (seenSeq.current === null) { seenSeq.current = screen.seq; return; }
    const fresh = screen.events.filter((e) => e.seq > (seenSeq.current as number));
    if (!fresh.length) return;
    seenSeq.current = fresh[fresh.length - 1].seq;
    const add: typeof toasts = [];
    for (const e of fresh) {
      if (e.type === 'relay_race') talk(e.n === 1 ? 'relayStart' : 'relayRace', 300);
      else if (e.type === 'relay_go') { sound.play('start'); talk('relayGo'); }
      else if (e.type === 'relay_turn') {
        sound.play('join');
        if (gameRef.current.teams[e.team]?.turns > 1) talk('relayTurn', 0, true);
      } else if (e.type === 'relay_fx') {
        const bad = isTrouble(e.kind);
        sound.play(bad ? 'storm' : 'power');
        const to = TEAM_WORDS[gameRef.current.teams[e.to]?.colour ?? 0].name;
        add.push({ key: e.seq, team: e.to, bad, kind: e.kind, text: bad ? `${FX_WORDS[e.kind].name} hits ${to}!` : `${FX_WORDS[e.kind].name} for ${to}!` });
        talk(`relay${e.kind[0].toUpperCase()}${e.kind.slice(1)}`, 200, true);
      } else if (e.type === 'relay_lead') {
        const c = TEAM_WORDS[gameRef.current.teams[e.team]?.colour ?? 0].name;
        talk(`relayLead${c}`, 0, true);
      } else if (e.type === 'relay_nest') sound.play('reveal');
      else if (e.type === 'relay_end') {
        sound.play('over');
        const g = gameRef.current;
        if (e.winner !== null && g.teams[e.winner]) talk(`relayWin${TEAM_WORDS[g.teams[e.winner].colour].name}`, 900);
        else talk('relayTime', 600);
      }
    }
    if (add.length) {
      setToasts((p) => [...p, ...add].slice(-8));
      window.setTimeout(() => setToasts((p) => p.filter((x) => !add.includes(x))), 2600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen.events, screen.seq, sound]);

  const byId = useMemo(() => new Map(screen.people.map((p) => [p.id, p] as [string, Person])), [screen.people]);
  // The screen's names are already the live names (shared/liveNames.ts once PR #868 lands): shown as they come.
  const flyerName = (id: string | undefined) => (screen.showNames && id ? (byId.get(id)?.name ?? null) : null);
  const standings = r?.standings ?? null;
  const n = game.teams.length;

  return (
    <div className="tr-scene">
      <header className="tr-head">
        <div className="tr-head__race">{r ? `Race ${r.n} of ${game.races}` : 'Get ready!'}</div>
        <div className="tr-head__wins" aria-label="Races won">
          {game.wins.map((w, c) => (w > 0 ? <span key={c} className="tr-win" style={{ background: TEAM_WORDS[c].colour }}>{TEAM_WORDS[c].name} {'🏆'.repeat(Math.min(w, 5))}</span> : null))}
        </div>
        {raceLeft !== null && <div className={`tr-head__clock ${raceLeft <= 10 ? 'is-low' : ''}`} role="timer">{Math.floor(raceLeft / 60)}:{String(raceLeft % 60).padStart(2, '0')}</div>}
      </header>

      {r && (
        <div className="tr-bar" aria-label="Race to the nest">
          <div className="tr-bar__track" />
          <span className="tr-bar__nest" aria-hidden="true">🪺</span>
          {game.teams.map((tm, i) => (
            <span key={i} className="tr-bar__bird" style={{ left: `${Math.min(100, (tm.x / nestX) * 100)}%`, background: TEAM_WORDS[tm.colour].colour, top: `${((i + 0.5) / n) * 100}%` }}>🐦</span>
          ))}
        </div>
      )}

      <div className={`tr-lanes tr-lanes--${n}`}>
        {game.teams.map((tm, i) => {
          const tw = TEAM_WORDS[tm.colour];
          const turn = tm.turn;
          const left = turn ? Math.max(0, Math.ceil((TURN_STEPS - turn.at) / 60)) : null;
          const live = tm.effects.filter((e) => e.x1 >= tm.x && e.kind !== 'clear');
          const place = standings ? standings.indexOf(i) + 1 : null;
          return (
            <section key={i} className={`tr-lane ${tm.finishT !== null ? 'tr-lane--nest' : ''}`} style={{ ['--team' as string]: tw.colour }} aria-label={`${tw.name} team`}>
              <canvas ref={(el) => { canvases.current[i] = el; }} className="tr-lane__canvas" />
              <div className="tr-lane__tag">
                <b>{tw.name}</b>
                {flyerName(turn?.flyer) && <span className="tr-lane__who">🐦 {flyerName(turn?.flyer)}</span>}
                {left !== null && phase === 'race' && <span className={`tr-lane__left ${left <= 5 ? 'is-low' : ''}`}>{left}s</span>}
                {tm.finishT !== null && <span className="tr-lane__done">🪺 At the nest!</span>}
                {place !== null && <span className="tr-lane__place">{place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : `#${place}`}</span>}
              </div>
              {live.length > 0 && (
                <div className="tr-lane__fx">{live.slice(-4).map((e) => <span key={e.id} className={`tr-chip ${isTrouble(e.kind) ? 'tr-chip--bad' : ''}`}><FxIcon kind={e.kind} /></span>)}</div>
              )}
              {toasts.filter((x) => x.team === i).map((x) => (
                <div key={x.key} className={`tr-toast ${x.bad ? 'tr-toast--bad' : ''}`}>{x.kind && <FxIcon kind={x.kind} />} {x.text}</div>
              ))}
            </section>
          );
        })}
      </div>

      {!over && (phase === 'ready' || phase === 'count') && (
        <div className="fc-count tr-count" key={countLeft ?? 'ready'} role="timer">
          {phase === 'ready' || countLeft === null || countLeft > 3 ? (r ? <><small>Race {r.n}</small> Find your team!</> : 'Get ready…') : countLeft}
        </div>
      )}
      {!over && phase === 'show' && r && standings && (
        <div className="tr-results" role="status">
          <h2>{r.winner !== null ? `${TEAM_WORDS[game.teams[r.winner].colour].name} team wins race ${r.n}!` : `Race ${r.n} is over!`}</h2>
          <ol>
            {standings.map((ti) => {
              const tm = game.teams[ti];
              return (
                <li key={ti} style={{ ['--team' as string]: TEAM_WORDS[tm.colour].colour }}>
                  <b>{TEAM_WORDS[tm.colour].name}</b>
                  <span>{tm.finishT !== null ? '🪺 Reached the nest' : `${Math.round((tm.x / nestX) * 100)}% of the way`}</span>
                </li>
              );
            })}
          </ol>
          {r.n < game.races && <p>Next race soon. New teams, so check your iPad!</p>}
        </div>
      )}
      {over && <RelayFinish screen={screen} game={game} onAgain={onAgain} />}
    </div>
  );
}

/** Races won by each colour, the pupils who won the most races (names only when shown), and a few true shout-outs. */
function RelayFinish({ screen, game, onAgain }: { screen: ScreenView; game: RelayGame; onAgain: () => void }) {
  const ids = screen.people.map((p) => p.id);
  const top = relayPodium(game, ids);
  const byId = (id: string) => screen.people.find((p) => p.id === id);
  const m = (id: string) => game.mine[id];
  const names = (list: string[]) => {
    const n = list.map((id) => byId(id)?.name).filter(Boolean) as string[];
    return n.length > 3 ? `${n.slice(0, 3).join(', ')} and ${n.length - 3} more` : n.join(' and ');
  };
  const award = (emoji: string, title: string, f: (id: string) => number | undefined, sayIt: (v: number) => string) => {
    let v: number | null = null;
    for (const id of ids) { const x = f(id); if (x !== undefined && x > 0 && (v === null || x > v)) v = x; }
    return v === null ? null : { emoji, title, who: names(ids.filter((id) => f(id) === v)), what: sayIt(v) };
  };
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const best = (id: string) => { const x = m(id); return x && x.flights > 0 ? Math.round(x.flown / x.flights) : undefined; };
  const awards = screen.showNames ? [
    award('🐦', 'Far flyer', best, () => 'flew the furthest each turn'),
    award('✨', 'Team helper', (id) => m(id)?.perks, (v) => `${plural(v, 'perk')} for their flyers`),
    award('🌪️', 'Trouble maker', (id) => m(id)?.troubles, (v) => `${plural(v, 'trouble')} sent`),
    award('🧮', 'Spark maker', (id) => m(id)?.right, (v) => plural(v, 'right answer')),
    award('🔥', 'Hot streak', (id) => ((m(id)?.bestStreak ?? 0) >= 3 ? m(id)?.bestStreak : undefined), (v) => `${v} right in a row`),
  ].filter((x): x is { emoji: string; title: string; who: string; what: string } => !!x) : [];
  const sum = (f: (id: string) => number | undefined) => ids.reduce((n, id) => n + (f(id) ?? 0), 0);
  const facts = [
    `🏁 ${plural(game.race?.n ?? 0, 'race')}`,
    sum((id) => m(id)?.flights) > 0 && `🐦 ${plural(sum((id) => m(id)?.flights), 'turn')} flown`,
    sum((id) => m(id)?.perks) > 0 && `✨ ${plural(sum((id) => m(id)?.perks), 'perk')}`,
    sum((id) => m(id)?.troubles) > 0 && `🌪️ ${plural(sum((id) => m(id)?.troubles), 'trouble')}`,
    sum((id) => m(id)?.right) > 0 && `🧮 ${plural(sum((id) => m(id)?.right), 'right answer')}`,
  ].filter(Boolean) as string[];
  const wins = game.wins.map((w, c) => ({ w, c })).filter((x) => x.w > 0).sort((a, b) => b.w - a.w);
  return (
    <div className="cl-finish fc-finish tr-finish" role="dialog" aria-label="Finish">
      <h2 className="cl-finish__title">What a relay!</h2>
      {wins.length > 0 && (
        <div className="tr-finish__wins">
          {wins.map((x) => <span key={x.c} style={{ background: TEAM_WORDS[x.c].colour }}><b>{TEAM_WORDS[x.c].name}</b> won {plural(x.w, 'race')}</span>)}
        </div>
      )}
      {screen.showNames && top.length > 0 && (
        <div className="fc-podium">
          {([2, 1, 3] as const).map((place) => (
            <div key={place} className={`fc-podium__step fc-podium__step--${place}`}>
              <div className="fc-podium__who">
                {top.filter((x) => x.place === place).slice(0, 5).map((x) => <span key={x.player}><b>{byId(x.player)?.name}</b></span>)}
              </div>
              <div className="fc-podium__block">{place}</div>
            </div>
          ))}
        </div>
      )}
      {facts.length > 0 && <p className="fc-facts">{facts.map((f, i) => <span key={i}>{f}</span>)}</p>}
      {awards.length > 0 && (
        <ul className="fc-awards">
          {awards.map((a, i) => (
            <li key={a.title} style={{ animationDelay: `${0.4 + i * 0.12}s` }}>
              <span className="fc-awards__emoji" aria-hidden="true">{a.emoji}</span>
              <span className="fc-awards__title">{a.title}</span>
              <b className="fc-awards__who">{a.who}</b>
              {a.what && <span className="fc-awards__what">{a.what}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="cl-finish__row">
        <button type="button" className="cl-btn cl-btn--go cl-btn--big" onClick={onAgain}>Back to Class Live</button>
      </div>
    </div>
  );
}
