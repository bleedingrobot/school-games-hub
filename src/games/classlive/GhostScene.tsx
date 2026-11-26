/**
 * Ghost Tag on the big screen (docs/GHOST-PLAN.md): the map with everyone's avatar gliding between saved spots (read
 * every 0.3 s), ghosts in white sheets, invisible pupils hidden, the round's countdown, catches with a pop and a sound,
 * the last one standing, and the podium. The server decides every catch: this asks it (`onTick`) twice a second while
 * a hunt is on, and just after each deadline otherwise.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AvatarImage } from '../../avatar/AvatarImage';
import {
  alive, AVATAR_R, isFrozen, isHidden, MAP_WORDS, MECHANICS, podium, POWER_WORDS, UNLOCK, type GhostGame, type GhostMechanic,
} from '../../../shared/classlive/ghost';
import type { Spot } from '../../../shared/classlive/corners';
import type { ScreenView } from '../../../shared/classlive/server';
import type { ClassLiveSound } from './audio';
import { lineOf } from './CornersScene';
import { at, GhostBoard, GhostToken } from './GhostBoard';
import { useEdgeLink } from './edgeLink';
import { useNetStats } from './netStats';
import type { ClassLiveLink } from './link';

type Person = ScreenView['people'][number];
/** Twice a second while a hunt is on: the server checks for catches each time. */
const TICK_MS = 500;
/** Fog comes down this long after the ghosts are let out. */
const FOG_AFTER_MS = 12_000;

export const MECH_ABOUT: Record<GhostMechanic, (w: (typeof MAP_WORDS)['graveyard']) => string> = {
  items: () => 'Power-ups! Run over one to grab it: garlic shield, speed boots or a frost bomb.',
  teleport: (w) => `${w.teleport}s! Step in one to pop out of the other.`,
  slow: (w) => `${w.slow}! They slow you down, but ghosts float over them.`,
  fog: (w) => `${w.fog}! The big screen can't see you after a while. Use your device!`,
  bats: (w) => `${w.bats}! It swoops across the map and knocks you flying.`,
};

export function GhostScene({ screen, game, link: baseLink, room, clock, sound, say, onTick, over, onAgain }: {
  screen: ScreenView; game: GhostGame; link: ClassLiveLink; room: number | null;
  clock: () => number;
  sound: ClassLiveSound; say: (text: string, delay?: number) => void;
  onTick: () => void;
  over: boolean;
  onAgain: () => void;
}) {
  // James's pilot rooms: spots straight from Cloudflare (edgeLink.ts), read 10 times a second.
  const link = useEdgeLink(baseLink, room, screen.edge);
  const t = screen.startedAt === null ? 0 : clock() - screen.startedAt;
  const r = game.round;
  /** The map's width (height 1): wide since 26 Nov 2026. */
  const bw = r?.w ?? game.w ?? 1;
  const targets = useRef<Record<string, Spot>>({});
  const shown = useRef<Record<string, Spot>>({});
  const [, setFrame] = useState(0);
  const [avatars, setAvatars] = useState<Record<string, unknown>>({});
  const words = MAP_WORDS[game.map];
  const ids = screen.people.map((p) => p.id);

  const count = screen.people.length;
  useEffect(() => {
    if (!room) return;
    let live = true;
    void link.avatars(room).then((a) => { if (live && a) setAvatars(a); }, () => undefined);
    return () => { live = false; };
  }, [room, count, link]);

  const phase: 'wait' | 'ready' | 'hunt' | 'show' = !r ? 'wait' : r.done ? 'show' : t < r.startAt ? 'ready' : 'hunt';
  const running = phase === 'ready' || phase === 'hunt';
  // Before-and-after numbers for the Cloudflare pilot (netStats.ts).
  const netStats = useNetStats(baseLink, room, 'screen', screen.state === 'live', over, !!screen.edge);
  useEffect(() => {
    if (!room || over) return;
    let live = true;
    const read = () => {
      const t0 = performance.now();
      void link.positions(room).then((p) => {
        const before = targets.current;
        const moved = p ? Object.entries(p).filter(([id, q]) => !before[id] || before[id].x !== q.x || before[id].y !== q.y).length : 0;
        if (running) netStats.current?.call(performance.now() - t0, !!p, moved > 0, moved);
        if (live && p) targets.current = p;
      }, () => { if (running) netStats.current?.call(performance.now() - t0, false, false); });
    };
    read();
    const id = window.setInterval(read, running ? (link.readMs ?? 300) : 2000);
    return () => { live = false; window.clearInterval(id); };
  }, [room, running, over, link]);

  useEffect(() => {
    let id = 0;
    let last = performance.now();
    const loop = (ts: number) => {
      const dt = Math.min(0.1, (ts - last) / 1000);
      last = ts;
      const k = Math.min(1, dt * 9);
      for (const p of screen.people) {
        const goal = targets.current[p.id] ?? game.mine[p.id]?.spot;
        if (!goal) continue;
        const cur = shown.current[p.id];
        if (!cur || Math.hypot(goal.x - cur.x, goal.y - cur.y) > 0.3) shown.current[p.id] = { ...goal };
        else shown.current[p.id] = { x: cur.x + (goal.x - cur.x) * k, y: cur.y + (goal.y - cur.y) * k };
      }
      setFrame((f) => (f + 1) % 1_000_000);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [screen.people, game.mine]);

  // The server moves the game on: often during a hunt (catches), else just after the next deadline.
  const tick = useRef(onTick);
  tick.current = onTick;
  const deadline = !r ? 3000 : r.done ? (r.showEnd ?? 0) + 50 : t < r.startAt ? r.startAt + 50 : r.endAt + 50;
  useEffect(() => {
    if (over || screen.startedAt === null) return;
    if (phase === 'hunt') {
      const id = window.setInterval(() => tick.current(), TICK_MS);
      return () => window.clearInterval(id);
    }
    const wait = Math.max(50, deadline - t);
    const a = window.setTimeout(() => tick.current(), wait);
    const b = window.setTimeout(() => tick.current(), wait + 2500);
    return () => { window.clearTimeout(a); window.clearTimeout(b); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, phase, over, screen.startedAt]);

  // Bella and sounds for each moment of a round.
  const moment = useRef('');
  const left = alive(game, ids).length;
  useEffect(() => {
    if (over || !r) return;
    const key = `${r.n}:${phase}`;
    if (moment.current === key) return;
    moment.current = key;
    if (phase === 'ready') {
      sound.play('start');
      const fresh = MECHANICS.find((m) => UNLOCK[m] === r.n);
      say((fresh ? lineOf(`mech_ghost_${fresh}`) : null) ?? lineOf(r.n === 1 ? 'ghostStart' : 'ghostRound') ?? 'Get ready!', 300);
    } else if (phase === 'hunt') {
      sound.play('drumroll');
      say(lineOf('ghostHunt') ?? 'The ghosts are out!', 200);
    } else if (phase === 'show' && r.done) {
      sound.play(r.done.why === 'all' ? 'caught' : 'safe');
      window.setTimeout(() => sound.play('land'), 500);
      say(lineOf(r.done.why === 'last' ? 'ghostLast' : r.done.why === 'time' ? 'ghostTime' : 'ghostAll') ?? 'Round over!', 600);
    }
  }, [phase, r, over, say, sound]);
  const twoTold = useRef(-1);
  useEffect(() => {
    if (phase === 'hunt' && r && left === 2 && r.humans > 3 && twoTold.current !== r.n) {
      twoTold.current = r.n;
      say(lineOf('ghostTwoLeft') ?? 'Only two left!', 900);
    }
  }, [phase, left, r, say]);
  const secLeft = r && phase === 'hunt' ? Math.max(0, Math.ceil((r.endAt - t) / 1000)) : null;
  const readyLeft = r && phase === 'ready' ? Math.max(1, Math.ceil((r.startAt - t) / 1000)) : null;
  const lastSec = useRef<number | null>(null);
  useEffect(() => {
    const s = secLeft ?? readyLeft;
    if (s === null || s === lastSec.current) return;
    lastSec.current = s;
    if (readyLeft !== null && readyLeft <= 3) sound.play('tick');
    if (secLeft !== null && secLeft <= 5 && secLeft > 0) sound.play(secLeft <= 3 ? 'tickLast' : 'tick');
    if (secLeft === 10) say(lineOf('ghostHurry') ?? 'Ten seconds left!');
  }, [secLeft, readyLeft, sound, say]);

  // Catches, vanishes and power-ups: pops on the board (from the screen's events, once each); Bella now and then.
  const seenSeq = useRef<number | null>(null);
  const lastSaid = useRef(0);
  const [pops, setPops] = useState<{ key: number; at: Spot; text: string; kind: string }[]>([]);
  useEffect(() => {
    if (seenSeq.current === null) { seenSeq.current = screen.seq; return; }
    const fresh = screen.events.filter((e) => e.seq > (seenSeq.current as number));
    if (!fresh.length) return;
    seenSeq.current = fresh[fresh.length - 1].seq;
    const add: { key: number; at: Spot; text: string; kind: string }[] = [];
    const chat = (key: string) => {
      if (Date.now() - lastSaid.current < 4000) return;
      lastSaid.current = Date.now();
      const line = lineOf(key);
      if (line) say(line, 300);
    };
    for (const e of fresh) {
      const at = 'pupil' in e && typeof e.pupil === 'string' ? (shown.current[e.pupil] ?? { x: bw / 2, y: 0.5 }) : { x: bw / 2, y: 0.5 };
      if (e.type === 'g_tag') { sound.play('caught'); add.push({ key: e.seq, at, text: '👻 BOO!', kind: 'tag' }); chat('ghostTag'); }
      else if (e.type === 'g_vanish') { sound.play('warp'); add.push({ key: e.seq, at, text: '✨', kind: 'vanish' }); chat('ghostVanish'); }
      else if (e.type === 'g_bounce') { sound.play('power'); add.push({ key: e.seq, at, text: '🧄 Bounce!', kind: 'bounce' }); chat('ghostBounce'); }
      else if (e.type === 'g_dash') { sound.play('storm'); add.push({ key: e.seq, at, text: '💨', kind: 'dash' }); chat('ghostDash'); }
      else if (e.type === 'g_lantern') { sound.play('glow'); add.push({ key: e.seq, at, text: '🏮', kind: 'lantern' }); chat('ghostLantern'); }
      else if (e.type === 'g_grab') {
        sound.play('grab');
        add.push({ key: e.seq, at, text: POWER_WORDS[e.power].emoji, kind: 'grab' });
        if (e.power === 'freeze' && e.froze > 0) chat('ghostFreeze');
      }
    }
    if (add.length) {
      setPops((p) => [...p, ...add].slice(-10));
      window.setTimeout(() => setPops((p) => p.filter((x) => !add.includes(x))), 1800);
    }
  }, [screen.events, screen.seq, sound, say]);

  const nameOf = (p: Person) => (screen.showNames ? p.name : null);
  const fogged = !!r?.fog && phase === 'hunt' && t >= r.startAt + FOG_AFTER_MS;
  const fresh = r ? MECHANICS.find((m) => UNLOCK[m] === r.n) : undefined;
  const best = useMemo(() => {
    if (!screen.showNames) return [];
    return [...screen.people].filter((p) => (game.mine[p.id]?.crowns ?? 0) > 0).sort((a, b) => (game.mine[b.id]?.crowns ?? 0) - (game.mine[a.id]?.crowns ?? 0)).slice(0, 5);
  }, [screen.people, screen.showNames, game.mine]);
  const hunters = useMemo(() => {
    if (!screen.showNames) return [];
    return [...screen.people].filter((p) => (game.mine[p.id]?.tags ?? 0) > 0).sort((a, b) => (game.mine[b.id]?.tags ?? 0) - (game.mine[a.id]?.tags ?? 0)).slice(0, 3);
  }, [screen.people, screen.showNames, game.mine]);
  const starters = r ? screen.people.filter((p) => r.starters.includes(p.id)) : [];
  const winners = r?.done ? screen.people.filter((p) => r.done!.winners.includes(p.id)) : [];

  return (
    <div className={`fc-scene gt-scene gt-scene--${game.map} ${bw > 1 ? 'gt-scene--wide' : ''}`}>
      <div className="fc-stage">
        <GhostBoard map={game.map} w={bw} round={r} t={t} dark={fogged}>
          {screen.people.map((p) => {
            const m = game.mine[p.id];
            const at = shown.current[p.id] ?? m?.spot;
            if (!at || !m) return null;
            // Invisible pupils are hidden (the class watches this screen); so are pupils under the fog.
            if (phase === 'hunt' && isHidden(m, t)) return null;
            if (fogged && !m.ghost) return null;
            const cls = [
              m.shield ? 'fc-token--shield' : '', m.bootsTo > t || m.dashTo > t ? 'fc-token--fast' : '', isFrozen(m, t) ? 'gt-token--frozen' : '',
              m.lanternTo > t ? 'gt-token--lantern' : '', m.ghost && m.caughtAt !== null && t - m.caughtAt < 1500 ? 'gt-token--rising' : '',
              phase === 'show' && r?.done?.winners.includes(p.id) ? 'gt-token--winner' : '',
            ].join(' ');
            return (
              <GhostToken key={p.id} x={at.x} y={at.y} size={AVATAR_R * 2.1} ghost={m.ghost} className={cls} label={nameOf(p)}>
                <AvatarImage avatar={avatars[p.id] ?? null} size={64} />
              </GhostToken>
            );
          })}
          {pops.map((p) => <span key={p.key} className={`fc-pop gt-pop gt-pop--${p.kind}`} style={at(p.at.x, p.at.y, bw)}>{p.text}</span>)}
        </GhostBoard>

        <aside className="fc-side">
          <div className="fc-side__map">{words.name}</div>
          <div className="fc-side__round">{r ? `Round ${r.n}` : 'Get ready!'}</div>
          {r && (
            <div className="gt-counts" aria-live="polite">
              <span className="gt-counts__h"><b>{left}</b> running</span>
              <span className="gt-counts__g"><b>{ids.length - left}</b> 👻</span>
            </div>
          )}
          {secLeft !== null && <div className={`gt-time ${secLeft <= 10 ? 'gt-time--low' : ''}`} role="timer">⏱️ {secLeft}s</div>}
          {fresh && phase !== 'show' && <div className="fc-new" key={fresh}><b>New!</b> {MECH_ABOUT[fresh](words)}</div>}
          {best.length > 0 && phase !== 'show' && (
            <div className="fc-best">
              <h3>Most rounds won</h3>
              <ol>{best.map((p) => <li key={p.id}><span>{p.name}</span><b>👑 {game.mine[p.id]?.crowns ?? 0}</b></li>)}</ol>
            </div>
          )}
          {hunters.length > 0 && phase !== 'show' && (
            <div className="fc-best gt-best--ghost">
              <h3>Top ghost hunters</h3>
              <ol>{hunters.map((p) => <li key={p.id}><span>{p.name}</span><b>👻 {game.mine[p.id]?.tags ?? 0}</b></li>)}</ol>
            </div>
          )}
        </aside>
      </div>

      {!over && phase === 'wait' && <div className="fc-count" role="status">{screen.people.length < 2 ? 'Waiting for 2 players…' : 'Get ready…'}</div>}
      {!over && phase === 'ready' && r && (
        <div className="gt-ready" role="status" key={r.n}>
          <div className="gt-ready__n" key={readyLeft}>{readyLeft}</div>
          <p>Ghosts out of {words.crypt} in…</p>
          {starters.length > 0 && screen.showNames && <p className="gt-ready__who">👻 {starters.map((p) => p.name).join(', ')}</p>}
        </div>
      )}
      {!over && phase === 'show' && r?.done && (
        <div className={`gt-banner gt-banner--${r.done.why}`} role="status" key={r.n}>
          <b>
            {r.done.why === 'last' ? (screen.showNames && winners[0] ? `🏆 ${winners[0].name} is the last one standing!` : '🏆 The last one standing wins!')
              : r.done.why === 'time' ? `⏱️ Time! ${winners.length} ${winners.length === 1 ? 'survivor wins' : 'survivors win'} the round`
              : '👻 The ghosts caught everyone!'}
          </b>
          {winners.length > 0 && winners.length <= 8 && (
            <div className="gt-banner__who">
              {winners.map((p) => <span key={p.id}><AvatarImage avatar={avatars[p.id] ?? null} size={64} />{nameOf(p) && <small>{nameOf(p)}</small>}</span>)}
            </div>
          )}
          <small>Next round soon…</small>
        </div>
      )}
      {over && <GhostFinish screen={screen} game={game} avatars={avatars} onAgain={onAgain} />}
    </div>
  );
}

/** The podium (names only when shown), awards and class facts. */
function GhostFinish({ screen, game, avatars, onAgain }: { screen: ScreenView; game: GhostGame; avatars: Record<string, unknown>; onAgain: () => void }) {
  const ids = screen.people.map((p) => p.id);
  const top = podium(game, ids);
  const byId = (id: string) => screen.people.find((p) => p.id === id);
  const m = (id: string) => game.mine[id];
  const names = (list: string[]) => {
    const n = list.map((id) => byId(id)?.name).filter(Boolean) as string[];
    return n.length > 2 ? `${n.slice(0, 2).join(', ')} and ${n.length - 2} more` : n.join(' and ');
  };
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const award = (emoji: string, title: string, f: (id: string) => number | undefined, what: (v: number) => string) => {
    let v = 0;
    for (const id of ids) v = Math.max(v, f(id) ?? 0);
    return v > 0 ? { emoji, title, who: names(ids.filter((id) => (f(id) ?? 0) === v)), what: what(v) } : null;
  };
  const never = ids.filter((id) => (m(id)?.caught ?? 0) === 0 && (m(id)?.crowns ?? 0) > 0);
  const awards = screen.showNames ? [
    award('👻', 'Top ghost', (id) => m(id)?.tags, (v) => `caught ${v}`),
    award('✨', 'Vanishing act', (id) => m(id)?.vanishes, (v) => `invisible ${plural(v, 'time')}`),
    award('🧄', 'Garlic guard', (id) => m(id)?.shieldSaves, (v) => `bounced ${plural(v, 'ghost')}`),
    award('🎁', 'Power-up collector', (id) => m(id)?.grabs, (v) => `picked up ${v}`),
    award('🏃', 'Longest runner', (id) => Math.round((m(id)?.aliveMs ?? 0) / 1000), (v) => `${v} seconds not caught`),
    award('🧮', 'Maths whizz', (id) => m(id)?.right, (v) => plural(v, 'right answer')),
    award('🔥', 'Hot streak', (id) => ((m(id)?.bestStreak ?? 0) >= 3 ? m(id)?.bestStreak : undefined), (v) => `${v} right in a row`),
    never.length > 0 && never.length < ids.length ? { emoji: '🛡️', title: 'Never caught', who: names(never), what: '' } : null,
  ].filter((x): x is { emoji: string; title: string; who: string; what: string } => !!x) : [];
  const sum = (f: (id: string) => number) => ids.reduce((n, id) => n + f(id), 0);
  const facts = [
    sum((id) => m(id)?.tags ?? 0) > 0 && `👻 ${plural(sum((id) => m(id)?.tags ?? 0), 'catch', 'catches')}`,
    sum((id) => m(id)?.vanishes ?? 0) > 0 && `✨ ${plural(sum((id) => m(id)?.vanishes ?? 0), 'vanish', 'vanishes')}`,
    sum((id) => m(id)?.right ?? 0) > 0 && `🧮 ${plural(sum((id) => m(id)?.right ?? 0), 'right answer')}`,
  ].filter(Boolean) as string[];
  const rounds = game.round?.n ?? 0;
  return (
    <div className="cl-finish fc-finish" role="dialog" aria-label="Finish">
      <h2 className="cl-finish__title">Ghost Tag is over!</h2>
      <p className="cl-finish__sub">{rounds} {rounds === 1 ? 'round' : 'rounds'} in the {MAP_WORDS[game.map].name}</p>
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
