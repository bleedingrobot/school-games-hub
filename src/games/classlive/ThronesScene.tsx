/**
 * Musical Thrones on the big screen (docs/THRONES-PLAN.md): the hall with everyone's avatar gliding between saved spots
 * (read every 0.3 s), the music banner (no countdown: the stop time is secret), the STOP slam, the 4 second scramble
 * ring, the courtyard strip, the crowns board and the podium. The game runs on the server's clock: this asks the server
 * (`onTick`) just after each deadline so it moves on.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AvatarImage } from '../../avatar/AvatarImage';
import type { Spot } from '../../../shared/classlive/corners';
import { AVATAR_R } from '../../../shared/classlive/corners';
import type { ScreenView } from '../../../shared/classlive/server';
import {
  COURT_RIGHT, HALL_WORDS, MECHANICS, MIMIC_FROM, nextDeadline, phaseOf, podium, POWER_WORDS, SCRAMBLE_MS, UNLOCK, type ThroneMechanic, type ThronesEvent, type ThronesGame,
} from '../../../shared/classlive/thrones';
import type { ClassLiveSound } from './audio';
import { lineOf } from './CornersScene';
import { useEdgeLink } from './edgeLink';
import type { ClassLiveLink } from './link';
import { PLAYER_COLOURS } from './StarSky';
import { ThronesBoard, Token, type ThronesBoardRound } from './ThronesBoard';
import { next } from './voiceLines';
import './thrones.css';

type Person = ScreenView['people'][number];
type Hall = ThronesGame['hall'];

const MECH_ABOUT: Record<ThroneMechanic, (w: (typeof HALL_WORDS)['castle']) => string> = {
  items: () => 'Power-ups! Grab one, then answer a question while the music plays to switch it on.',
  storm: (w) => `${w.storm}! It slows you down.`,
  teleport: (w) => `${w.teleport}s! Step in one to warp to the other.`,
  ice: (w) => `${w.ice}! You slide and can't stop fast.`,
  roller: (w) => `${w.roller}s! They knock you flying.`,
};

interface Slam { key: number; text: string; sub?: string; kind: 'stop' | 'steal' }
interface Top { key: number; text: string; sub?: string }
interface PopText { key: number; at: Spot; text: string }

export function ThronesScene({ screen, game, link: baseLink, room, clock, sound, say, onTick, over, onAgain }: {
  screen: ScreenView; game: ThronesGame; link: ClassLiveLink; room: number | null;
  /** Server time now (ms). */
  clock: () => number;
  sound: ClassLiveSound; say: (text: string, delay?: number) => void;
  /** Ask the server to move the game on (a deadline passed). */
  onTick: () => void;
  over: boolean;
  onAgain: () => void;
}) {
  // Cloudflare rooms send and read spots over a live connection (edgeLink.ts), 10 times a second.
  const link = useEdgeLink(baseLink, room, screen.edge);
  const t = screen.startedAt === null ? 0 : clock() - screen.startedAt;
  const r = game.round;
  const hall: Hall = game.hall;
  const words = HALL_WORDS[hall];
  const targets = useRef<Record<string, Spot>>({});
  const shown = useRef<Record<string, Spot>>({});
  const [, setFrame] = useState(0);
  const [avatars, setAvatars] = useState<Record<string, unknown>>({});

  // Everyone's avatar (again when more join).
  const count = screen.people.length;
  useEffect(() => {
    if (!room) return;
    let live = true;
    void link.avatars(room).then((a) => { if (live && a) setAvatars(a); }, () => undefined);
    return () => { live = false; };
  }, [room, count, link]);

  // Saved spots, every 0.3 s while a round runs (every 2 s otherwise).
  const running = !!r && !over;
  useEffect(() => {
    if (!room || over) return;
    let live = true;
    const read = () => void link.positions(room).then((p) => { if (live && p) targets.current = p; }, () => undefined);
    read();
    const id = window.setInterval(read, running ? (link.readMs ?? 300) : 2000);
    return () => { live = false; window.clearInterval(id); };
  }, [room, running, over, link]);

  // Glide every avatar towards its newest spot, every frame. Seated and courtyard pupils go where the game put them.
  useEffect(() => {
    let id = 0;
    let last = performance.now();
    const loop = (ts: number) => {
      const dt = Math.min(0.1, (ts - last) / 1000);
      last = ts;
      const k = Math.min(1, dt * 8);
      for (const p of screen.people) {
        const m = game.mine[p.id];
        const goal = m && (m.courtIn !== null || m.seat !== null) ? m.spot : (targets.current[p.id] ?? m?.spot);
        if (!goal) continue;
        const cur = shown.current[p.id];
        shown.current[p.id] = cur ? { x: cur.x + (goal.x - cur.x) * k, y: cur.y + (goal.y - cur.y) * k } : { ...goal };
      }
      setFrame((f) => (f + 1) % 1_000_000);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [screen.people, game.mine]);

  // Ask the server just after each deadline (the music's end a little later, so the last moves land).
  const deadline = nextDeadline(game, screen.startedAt);
  const gap = r && !r.stopped ? 250 : 80;
  const tick = useRef(onTick);
  tick.current = onTick;
  useEffect(() => {
    if (over || screen.startedAt === null || deadline === null) return;
    const wait = Math.max(50, deadline + gap - (clock() - screen.startedAt));
    const id = window.setTimeout(() => tick.current(), wait);
    // And again if the reply got lost.
    const again = window.setTimeout(() => tick.current(), wait + 2500);
    return () => { window.clearTimeout(id); window.clearTimeout(again); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, gap, over, screen.startedAt]);

  const phase = !r ? 'ready' : phaseOf(r, t);
  const covered = !!r && (phase === 'music' || !r.stopped);

  // Banners, pops and sounds, from the screen's events (once each).
  const gameRef = useRef(game);
  gameRef.current = game;
  const seenSeq = useRef<number | null>(null);
  const prevThrones = useRef<number | null>(null);
  const saidGolden = useRef(false);
  const [slam, setSlam] = useState<Slam | null>(null);
  const [top, setTop] = useState<Top | null>(null);
  const [pops, setPops] = useState<PopText[]>([]);
  const [crowned, setCrowned] = useState<number[]>([]);
  const [chomping, setChomping] = useState<number[]>([]);
  const saidMimic = useRef(false);
  const [shake, setShake] = useState(0);
  useEffect(() => {
    if (seenSeq.current === null) { seenSeq.current = screen.seq; return; }
    const fresh = screen.events.filter((e) => e.seq > (seenSeq.current as number));
    if (!fresh.length) return;
    seenSeq.current = Math.max(...fresh.map((e) => e.seq));
    const g = gameRef.current;
    const add: PopText[] = [];
    const sit: number[] = [];
    const where = (id: string): Spot => shown.current[id] ?? { x: 0.5, y: 0.5 };
    for (const raw of fresh) {
      const e = raw as unknown as ThronesEvent & { seq: number };
      if (e.type === 'round') {
        sound.play('tick');
        const fewer = prevThrones.current !== null && e.thrones < prevThrones.current;
        prevThrones.current = e.thrones;
        const mech = MECHANICS.find((m) => UNLOCK[m] === e.n && (m !== 'items' || e.n > 1));
        const about = mech ? MECH_ABOUT[mech](HALL_WORDS[g.hall]) : undefined;
        setTop({ key: e.seq, text: `Round ${e.n} · ${e.thrones} ${e.thrones === 1 ? 'throne' : 'thrones'}`, sub: about });
        window.setTimeout(() => setTop((x) => (x && x.key === e.seq ? null : x)), 3300);
        say(e.n === 1 ? next('startThrones') : next('newRound'), 300);
        let at = 3000;
        const extra = (text: string | null) => { if (text) { say(text, at); at += 3200; } };
        if (mech) extra(lineOf(`mt_${g.hall}_${mech}`));
        if (g.round && g.round.n === e.n && g.round.thrones.some((th) => th.golden) && !saidGolden.current) { saidGolden.current = true; extra(next('goldenThrone')); }
        else if (fewer && Math.random() < 0.6) extra(next('fewerThrones'));
        // The first round with mimics: a warning (they pop up when the music stops).
        if (e.n === MIMIC_FROM && !saidMimic.current) { saidMimic.current = true; extra(next('mimicWarn')); }
      } else if (e.type === 'stop') {
        sound.play('stop');
        setSlam({ key: e.seq, text: 'STOP! SIT DOWN!', kind: 'stop' });
        window.setTimeout(() => setSlam((x) => (x && x.key === e.seq ? null : x)), 2300);
        setShake(Date.now());
        say(next('musicStop'), 100);
        for (const id of e.dancers) add.push({ key: e.seq * 1000 + add.length, at: where(id), text: '+1 👑' });
        if (e.dancers.length && Math.random() < 0.6) say(next('dancers'), 2200);
      } else if (e.type === 'sit') {
        sound.play('sit');
        sit.push(e.throne);
        const th = g.round?.thrones.find((x) => x.id === e.throne);
        if (th) add.push({ key: e.seq * 1000 + add.length, at: th, text: e.golden ? '+3 👑' : '+1 👑' });
      } else if (e.type === 'steal') {
        sound.play('steal');
        sit.push(e.throne);
        setSlam({ key: e.seq, text: '🗡️ Throne stolen!', kind: 'steal' });
        window.setTimeout(() => setSlam((x) => (x && x.key === e.seq ? null : x)), 2300);
        say(next('steal'), 200);
      } else if (e.type === 'seated') {
        const n = e.standing.length;
        sound.play(n ? 'caught' : 'safe');
        say(n === 0 ? next('allSeated') : n >= 5 ? next('lotsStanding') : next('stoodUp'), 600);
        setTop({ key: e.seq, text: n === 0 ? '👑 A throne for everyone!' : `${n} off to the ${HALL_WORDS[g.hall].court.toLowerCase()}!` });
        window.setTimeout(() => setTop((x) => (x && x.key === e.seq ? null : x)), 3300);
      } else if (e.type === 'grab') {
        sound.play('grab');
        add.push({ key: e.seq * 1000 + add.length, at: where(e.pupil), text: POWER_WORDS[e.power].emoji });
      } else if (e.type === 'power') {
        sound.play('power');
        add.push({ key: e.seq * 1000 + add.length, at: where(e.pupil), text: `${POWER_WORDS[e.power].emoji} ${POWER_WORDS[e.power].name}!` });
      } else if (e.type === 'eaten') {
        sound.play('chomp');
        const mm = g.round?.mimics?.find((x) => x.id === e.mimic);
        if (mm) add.push({ key: e.seq * 1000 + add.length, at: mm, text: '🦷 CHOMP!' });
        setSlam({ key: e.seq, text: '🦷 CHOMP! A mimic!', kind: 'steal' });
        window.setTimeout(() => setSlam((x) => (x && x.key === e.seq ? null : x)), 1800);
        setChomping((c) => [...c, e.mimic]);
        window.setTimeout(() => setChomping((c) => c.filter((id) => id !== e.mimic)), 1400);
        say(next('mimicChomp'), 300);
      } else if (e.type === 'escape') {
        sound.play('escape');
        say(next('courtBack'), 800);
      } else if (e.type === 'court_right') {
        add.push({ key: e.seq * 1000 + add.length, at: where(e.pupil), text: e.scroll ? '📜 Crown thief scroll!' : `✅ ${e.right} of ${COURT_RIGHT}` });
      }
    }
    if (sit.length) {
      setCrowned((c) => [...c, ...sit]);
      window.setTimeout(() => setCrowned((c) => c.filter((id) => !sit.includes(id))), 1700);
    }
    if (add.length) {
      setPops((p) => [...p, ...add].slice(-14));
      window.setTimeout(() => setPops((p) => p.filter((x) => !add.includes(x))), 1900);
    }
  }, [screen.events, screen.seq, sound, say]);

  // The last two seconds of the scramble tick.
  const secLeft = r && phase === 'scramble' ? Math.ceil((r.scrambleEnd - t) / 1000) : null;
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (secLeft === null || secLeft === lastTick.current) return;
    lastTick.current = secLeft;
    if (secLeft <= 2 && secLeft > 0) sound.play('tickLast');
  }, [secLeft, sound]);

  const nameOf = (p: Person) => (screen.showNames ? p.name : null);
  const inCourt = screen.people.filter((p) => game.mine[p.id]?.courtIn != null);
  const fresh = r && phase === 'music' ? MECHANICS.find((m) => UNLOCK[m] === r.n && (m !== 'items' || r.n > 1)) : undefined;
  const board = useMemo<ThronesBoardRound | null>(
    () => (r ? { ...r, thrones: r.thrones.map((th) => ({ id: th.id, x: th.x, y: th.y, golden: th.golden, taken: th.by !== null })), mimics: (r.mimics ?? []).map((mm) => ({ id: mm.id, x: mm.x, y: mm.y, ate: mm.ate.length })), items: r.items.filter((x) => !x.by) } : null),
    [r],
  );
  const best = useMemo(
    () => [...screen.people].filter((p) => (game.mine[p.id]?.crowns ?? 0) > 0).sort((a, b) => (game.mine[b.id]?.crowns ?? 0) - (game.mine[a.id]?.crowns ?? 0)).slice(0, 8),
    [screen.people, game.mine],
  );
  const frac = r && phase === 'scramble' ? Math.max(0, Math.min(1, (r.scrambleEnd - t) / SCRAMBLE_MS)) : 0;
  const circ = 2 * Math.PI * 45;

  return (
    <div className={`mt-scene mt-scene--${hall}`}>
      <div className={`mt-stage ${Date.now() - shake < 700 ? 'mt-shake' : ''}`}>
        <ThronesBoard hall={hall} round={board} t={t} covered={covered} crowned={crowned} chomping={chomping} courtLabel={words.court} courtCount={inCourt.length}>
          {screen.people.map((p) => {
            const m = game.mine[p.id];
            const at = shown.current[p.id] ?? m?.spot;
            if (!at || !m) return null;
            const n = r?.n ?? 0;
            const court = m.courtIn !== null;
            const cls = [
              covered && !court ? 'mt-token--dance' : '', court ? 'mt-token--court' : '', m.seat !== null && !covered ? 'mt-token--sit mt-token--crown' : '',
              m.shieldIn === n ? 'mt-token--shield' : '', m.speedTo !== null && n <= m.speedTo ? 'fc-token--fast' : '', m.ghostTo !== null && n <= m.ghostTo ? 'mt-token--ghost' : '',
            ].join(' ');
            return (
              <Token key={p.id} x={at.x} y={at.y} size={AVATAR_R * 1.8} className={cls} label={nameOf(p)}>
                <AvatarImage avatar={avatars[p.id] ?? null} size={64} />
              </Token>
            );
          })}
          {pops.map((p) => <span key={p.key} className="mt-pop" style={{ left: `${p.at.x * 100}%`, top: `${p.at.y * 100}%` }}>{p.text}</span>)}
        </ThronesBoard>

        <aside className="mt-side">
          <div className="mt-side__hall">{words.name}</div>
          <div className="mt-side__round">{r ? `Round ${r.n}` : 'Get ready!'}{r && <small>{r.thrones.length} {r.thrones.length === 1 ? 'throne' : 'thrones'}</small>}</div>
          {fresh && <div className="mt-new" key={fresh}><b>New!</b> {MECH_ABOUT[fresh](words)}</div>}
          {best.length > 0 && (
            <div className="mt-best">
              <h3>👑 Crowns</h3>
              <ol>
                {best.map((p) => (
                  <li key={p.id}>
                    <i style={{ ['--c' as string]: PLAYER_COLOURS[p.colour % 12] }} />
                    <span>{screen.showNames ? p.name : ''}</span>
                    <b>{game.mine[p.id]?.crowns ?? 0}</b>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div className="mt-courtcount">🔒 {words.court}: <b>{inCourt.length}</b></div>
        </aside>
      </div>

      {!over && phase === 'ready' && <div className="mt-ready" role="status">Get ready…</div>}
      {!over && phase === 'music' && r && (
        <div className="mt-music" role="status" aria-label="Music playing" key="music">
          <span aria-hidden="true">🎵</span> Music playing! Keep dancing!
          <span className="mt-eq" aria-hidden="true"><i /><i /><i /><i /><i /></span>
        </div>
      )}
      {!over && phase === 'scramble' && r && r.standing === null && (
        <div className={`mt-ring ${secLeft !== null && secLeft <= 2 ? 'mt-ring--low' : ''}`} role="timer">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle className="mt-ring__track" cx="50" cy="50" r="45" />
            <circle className="mt-ring__go" cx="50" cy="50" r="45" strokeDasharray={circ} strokeDashoffset={circ * (1 - frac)} />
          </svg>
          <span>Find a throne!</span>
        </div>
      )}
      {top && !over && <div className="mt-top" key={top.key} role="status">{top.text}{top.sub && <small>{top.sub}</small>}</div>}
      {slam && !over && <div className={`mt-slam mt-slam--${slam.kind}`} key={slam.key} role="alert">{slam.text}</div>}
      {over && <ThronesFinish screen={screen} game={game} avatars={avatars} onAgain={onAgain} />}
    </div>
  );
}

const CONFETTI = Array.from({ length: 60 }, (_, i) => ({
  x: `${(i * 37) % 100}%`, d: `${3.2 + ((i * 13) % 30) / 10}s`, w: `${-((i * 7) % 40) / 10}s`,
  c: ['#facc15', '#ec4899', '#60a5fa', '#4ade80', '#fb923c', '#a855f7'][i % 6],
}));

/** The podium (names only when shown), awards, and a few facts about the whole class. */
function ThronesFinish({ screen, game, avatars, onAgain }: { screen: ScreenView; game: ThronesGame; avatars: Record<string, unknown>; onAgain: () => void }) {
  const ids = screen.people.map((p) => p.id);
  const top = podium(game, ids);
  const byId = (id: string) => screen.people.find((p) => p.id === id);
  const m = (id: string) => game.mine[id];
  const names = (list: string[]) => {
    const n = list.map((id) => byId(id)?.name).filter(Boolean) as string[];
    return n.length > 2 ? `${n.slice(0, 2).join(', ')} and ${n.length - 2} more` : n.join(' and ');
  };
  const top1 = (f: (id: string) => number | undefined | null, low = false) => {
    let v: number | null = null;
    for (const id of ids) { const x = f(id); if (x !== undefined && x !== null && x > 0 && (v === null || (low ? x < v : x > v))) v = x; }
    return v === null ? null : { v, who: ids.filter((id) => f(id) === v) };
  };
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const award = (emoji: string, title: string, f: (id: string) => number | undefined | null, say: (v: number) => string, low = false) => {
    const t = top1(f, low);
    return t ? { emoji, title, who: names(t.who), what: say(t.v) } : null;
  };
  const never = ids.filter((id) => (m(id)?.stood ?? 0) === 0 && (m(id)?.sat ?? 0) > 0);
  const awards = screen.showNames ? [
    award('👑', 'Royal Champion', (id) => m(id)?.crowns, (v) => plural(v, 'crown')),
    award('🗡️', 'Throne Thief', (id) => m(id)?.steals, (v) => `stole ${plural(v, 'throne')}`),
    award('🌟', 'Golden Bottom', (id) => m(id)?.golden, (v) => `${plural(v, 'golden throne')}`),
    award('💃', 'Dance Machine', (id) => m(id)?.dances, (v) => `${plural(v, 'dance tile bonus', 'dance tile bonuses')}`),
    never.length > 0 && never.length < ids.length ? { emoji: '🛡️', title: 'Never Stood', who: names(never), what: 'sat down every round' } : null,
    award('🔓', 'Comeback Kid', (id) => m(id)?.escapes, (v) => `back from the courtyard ${plural(v, 'time')}`),
    award('🧮', 'Maths Whizz', (id) => m(id)?.right, (v) => plural(v, 'right answer')),
    award('⚡', 'Speedy', (id) => m(id)?.fastMs, (v) => `${(v / 1000).toFixed(1)} seconds`, true),
  ].filter((x): x is { emoji: string; title: string; who: string; what: string } => !!x) : [];
  const rounds = game.round?.n ?? 0;
  const facts = [
    `🎵 ${plural(rounds, 'round')} played`,
    game.stealsAll > 0 && `🗡️ ${plural(game.stealsAll, 'throne')} stolen`,
    game.stoodAll > 0 && `🔒 ${plural(game.stoodAll, 'trip')} to the ${HALL_WORDS[game.hall].court.toLowerCase()}`,
  ].filter(Boolean) as string[];
  return (
    <div className="cl-finish fc-finish mt-finish" role="dialog" aria-label="Finish">
      <div className="mt-confetti" aria-hidden="true">
        {CONFETTI.map((c, i) => <i key={i} style={{ ['--x' as string]: c.x, ['--d' as string]: c.d, ['--w' as string]: c.w, ['--c' as string]: c.c }} />)}
      </div>
      <h2 className="cl-finish__title">👑 Musical Thrones is over!</h2>
      <p className="cl-finish__sub">{plural(rounds, 'round')} in the {HALL_WORDS[game.hall].name}</p>
      {screen.showNames && top.length > 0 && (
        <div className="fc-podium">
          {([2, 1, 3] as const).map((place) => (
            <div key={place} className={`fc-podium__step fc-podium__step--${place}`}>
              <div className="fc-podium__who">
                {top.filter((x) => x.place === place).slice(0, 3).map((x) => (
                  <span key={x.player}><AvatarImage avatar={avatars[x.player] ?? null} size={place === 1 ? 72 : 56} /><b>{byId(x.player)?.name}</b></span>
                ))}
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
