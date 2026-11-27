/**
 * Floor is Lava on the big screen (docs/LAVA-PLAN.md): the floor with everyone's avatar gliding between saved spots
 * (read every 0.3 s), the countdown, the glow, the crack (a shake, tiles crumbling, avatars splashing onto the raft), the
 * raft beside the floor, the rounds board and the podium. Also the teacher's setup card and the lobby's heading.
 * Rounds run on the server's clock: this asks the server (`onTick`) just after each deadline.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useEdgeChoice } from './EdgeChoice';
import { AvatarImage } from '../../avatar/AvatarImage';
import {
  AVATAR_R, LATE_MS, LAVA_MAPS, LAVA_MECHANICS, LAVA_POWER_WORDS, LAVA_UNLOCK, LAVA_WORDS, lavaPodium, PATTERN_FROM, PATTERNS, RAFT_RIGHT,
  RUN_DEFAULT_S, RUN_MAX_S, RUN_MIN_S, tileAt, type LavaGame, type LavaMap, type LavaMechanic, type Pattern, type Spot,
} from '../../../shared/classlive/lava';
import type { ScreenView } from '../../../shared/classlive/server';
import type { ClassLiveSound } from './audio';
import { at as boardAt, LavaBoard, LavaToken, type FloorRound } from './LavaBoard';
import { useEdgeLink } from './edgeLink';
import type { ClassLiveLink } from './link';
import { painted } from './paintedArt';
import { lavaLine, patternLine } from './lavaVoice';

const PATTERN_NAMES: Record<Pattern, string> = {
  patches: 'Glowing patches', rows: 'Stripes', checker: 'Checkerboard', ring: 'Rings', cross: 'Giant cross', islands: 'Islands', wave: 'Glow wave',
};
const MECH_ABOUT: Record<LavaMechanic, (w: (typeof LAVA_WORDS)['volcano']) => string> = {
  items: () => 'Power-ups! Grab one, then answer a question to switch it on.',
  bubbles: (w) => `${w.bubbles}! They slow you down.`,
  crust: (w) => `${w.crust}! You slide and can't stop fast.`,
  fireball: (w) => `${w.fireball}! It knocks you flying.`,
  late: (w) => `${w.late}! More tiles start glowing near the end.`,
};

/** The round as the floor draws it. */
export const floorRound = (r: LavaGame['round']): FloorRound | null =>
  r ? { ...r, items: r.items.filter((x) => !x.by), ended: r.fell !== null } : null;

type Person = ScreenView['people'][number];

export function LavaScene({ screen, game, link: baseLink, room, clock, sound, say, onTick, over, onAgain }: {
  screen: ScreenView; game: LavaGame; link: ClassLiveLink; room: number | null;
  clock: () => number;
  sound: ClassLiveSound; say: (text: string, delay?: number) => void;
  onTick: () => void;
  over: boolean;
  onAgain: () => void;
}) {
  // Cloudflare rooms send and read spots over a live connection (edgeLink.ts), 10 times a second.
  const link = useEdgeLink(baseLink, room, screen.edge);
  const t = screen.startedAt === null ? 0 : clock() - screen.startedAt;
  const r = game.round;
  /** The floor's width (height 1): wide since 27 Nov 2026. */
  const bw = r?.w ?? game.w ?? 1;
  const targets = useRef<Record<string, Spot>>({});
  const shown = useRef<Record<string, Spot>>({});
  const [, setFrame] = useState(0);
  const [avatars, setAvatars] = useState<Record<string, unknown>>({});
  const words = LAVA_WORDS[game.map];

  const count = screen.people.length;
  useEffect(() => {
    if (!room) return;
    let live = true;
    void link.avatars(room).then((a) => { if (live && a) setAvatars(a); }, () => undefined);
    return () => { live = false; };
  }, [room, count, link]);

  const running = !!r && r.fell === null && !over;
  useEffect(() => {
    if (!room || over) return;
    let live = true;
    const read = () => void link.positions(room).then((p) => { if (live && p) targets.current = p; }, () => undefined);
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

  const deadline = !r ? 4000 : r.fell === null ? r.runEnd + 450 : r.showEnd + 50;
  const tick = useRef(onTick);
  tick.current = onTick;
  useEffect(() => {
    if (over || screen.startedAt === null) return;
    const wait = Math.max(50, deadline - t);
    const id = window.setTimeout(() => tick.current(), wait);
    const again = window.setTimeout(() => tick.current(), wait + 2500);
    return () => { window.clearTimeout(id); window.clearTimeout(again); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, over, screen.startedAt]);

  const phase = !r ? 'ready' : r.fell === null ? (t < r.runEnd ? 'run' : 'wait') : t < r.crackEnd ? 'crack' : t < r.showEnd ? 'show' : 'wait';
  const secLeft = r && phase === 'run' ? Math.ceil((r.runEnd - t) / 1000) : null;
  const moment = useRef('');
  useEffect(() => {
    if (over || !r) return;
    const key = `${r.n}:${phase}`;
    if (moment.current === key) return;
    moment.current = key;
    if (phase === 'run') {
      sound.play('rumble');
      const fresh = LAVA_MECHANICS.find((m) => LAVA_UNLOCK[m] === r.n);
      const freshPattern = PATTERN_FROM[r.pattern] === r.n && r.n > 1;
      say(r.n === 1 ? lavaLine('startLava') : fresh ? lavaLine(`lava_${fresh}`) : freshPattern ? patternLine(r.pattern) : lavaLine('lavaRun'), 300);
    } else if (phase === 'crack') {
      sound.play('crack');
      say(lavaLine('lavaCrack'), 200);
      const fell = r.fell?.length ?? 0;
      window.setTimeout(() => sound.play(fell ? 'plop' : 'safe'), 1300);
      if (r.booted.length) window.setTimeout(() => say(lavaLine('lavaBoots')), 2400);
      else if (fell === 0) window.setTimeout(() => say(lavaLine('lavaNobody')), 2400);
      else if (fell >= Math.max(4, screen.people.length / 3)) window.setTimeout(() => say(lavaLine('lavaLots')), 2400);
    }
  }, [phase, r, over, say, sound, screen.people.length]);
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (secLeft === null || secLeft === lastTick.current) return;
    lastTick.current = secLeft;
    if (secLeft <= 5 && secLeft > 0) sound.play(secLeft <= 3 ? 'tickLast' : 'tick');
    if (secLeft === 3) say(lavaLine('lavaHurry'));
  }, [secLeft, sound, say]);
  // Late cracks light up: a rumble and a warning.
  const lateOn = !!r && r.late.length > 0 && phase === 'run' && t >= r.runEnd - LATE_MS;
  useEffect(() => {
    if (!lateOn) return;
    sound.play('rumble');
    say(lavaLine('lavaLate'));
  }, [lateOn, sound, say]);

  const seenSeq = useRef<number | null>(null);
  const [pops, setPops] = useState<{ key: number; at: Spot; text: string }[]>([]);
  useEffect(() => {
    if (seenSeq.current === null) { seenSeq.current = screen.seq; return; }
    const fresh = screen.events.filter((e) => e.seq > (seenSeq.current as number));
    if (!fresh.length) return;
    seenSeq.current = fresh[fresh.length - 1].seq;
    const add: { key: number; at: Spot; text: string }[] = [];
    for (const e of fresh) {
      const at = 'pupil' in e && typeof e.pupil === 'string' ? (shown.current[e.pupil] ?? { x: bw / 2, y: 0.5 }) : { x: bw / 2, y: 0.5 };
      if (e.type === 'lava_grab') { sound.play('grab'); add.push({ key: e.seq, at, text: LAVA_POWER_WORDS[e.power].emoji }); }
      else if (e.type === 'lava_power') { sound.play('power'); add.push({ key: e.seq, at, text: `${LAVA_POWER_WORDS[e.power].emoji} ${LAVA_POWER_WORDS[e.power].name}!` }); }
      else if (e.type === 'build') { sound.play('build'); add.push({ key: e.seq, at, text: '🧱' }); }
      else if (e.type === 'rescue') { sound.play('escape'); add.push({ key: e.seq, at, text: '🛟 Rescue!' }); }
      else if (e.type === 'climb') sound.play('escape');
    }
    if (fresh.some((e) => e.type === 'rescue')) say(lavaLine('lavaRescue'), 600);
    else if (fresh.some((e) => e.type === 'climb')) say(lavaLine('lavaClimb'), 800);
    else if (fresh.filter((e) => e.type === 'build').length >= 2) say(lavaLine('lavaBuild'), 400);
    if (add.length) {
      setPops((p) => [...p, ...add].slice(-10));
      window.setTimeout(() => setPops((p) => p.filter((x) => !add.includes(x))), 1800);
    }
  }, [screen.events, screen.seq, sound, say, bw]);

  const nameOf = (p: Person) => (screen.showNames ? p.name : null);
  const rafted = screen.people.filter((p) => game.mine[p.id] && game.mine[p.id].raftIn !== null);
  const justFell = new Set(r?.fell ?? []);
  const cracking = phase === 'crack';
  // The fallen stay on the floor (splashing) while it cracks, then move to the raft.
  const onFloor = screen.people.filter((p) => !rafted.includes(p) || (cracking && justFell.has(p.id)));
  const onRaft = cracking ? rafted.filter((p) => !justFell.has(p.id)) : rafted;
  const freshMech = r ? LAVA_MECHANICS.find((m) => LAVA_UNLOCK[m] === r.n) : undefined;
  const top = useMemo(() => {
    if (!screen.showNames) return [];
    return [...screen.people].filter((p) => (game.mine[p.id]?.score ?? 0) > 0).sort((a, b) => (game.mine[b.id]?.score ?? 0) - (game.mine[a.id]?.score ?? 0)).slice(0, 5);
  }, [screen.people, screen.showNames, game.mine]);
  const raftPic = painted('lava', `raft-${game.map}`);
  const fr = floorRound(r);

  return (
    <div className={`fc-scene lv-scene lv-scene--${game.map} ${bw > 1 ? 'lv-scene--wide' : ''}`}>
      <div className="lv-heat" aria-hidden="true" />
      <div className={`fc-stage lv-stage ${cracking ? 'lv-shake' : ''}`}>
        <LavaBoard map={game.map} w={bw} sunk={game.sunk} round={fr} t={t}>
          {onFloor.map((p) => {
            const m = game.mine[p.id];
            const at = shown.current[p.id] ?? m?.spot;
            if (!at || !m) return null;
            const n = r?.n ?? 0;
            const cls = [
              m.bootsIn === n ? 'lv-token--boots' : '', m.speedTo !== null && n <= m.speedTo ? 'fc-token--fast' : '',
              cracking && justFell.has(p.id) ? 'lv-token--fell' : '', phase === 'show' && !justFell.has(p.id) ? 'lv-token--safe' : '',
            ].join(' ');
            return (
              <LavaToken key={p.id} x={at.x} y={at.y} size={AVATAR_R * 2.1} className={cls} label={nameOf(p)}>
                <AvatarImage avatar={avatars[p.id] ?? null} size={64} />
              </LavaToken>
            );
          })}
          {pops.map((p) => <span key={p.key} className="fc-pop" style={boardAt(p.at.x, p.at.y, bw)}>{p.text}</span>)}
        </LavaBoard>

        <aside className="fc-side">
          <div className="fc-side__map">{words.name}</div>
          <div className="fc-side__round">{r ? `Round ${r.n}` : 'Get ready!'}</div>
          {r && phase === 'run' && <div className="lv-pattern">🔥 {PATTERN_NAMES[r.pattern]}</div>}
          {freshMech && phase === 'run' && <div className="fc-new" key={freshMech}><b>New!</b> {MECH_ABOUT[freshMech](words)}</div>}
          {top.length > 0 && phase !== 'crack' && (
            <div className="fc-best">
              <h3>Most rounds up</h3>
              <ol>{top.map((p) => <li key={p.id}><span>{p.name}</span><b>{game.mine[p.id]?.score ?? 0}</b></li>)}</ol>
            </div>
          )}
          <div className={`lv-raft ${raftPic ? 'lv-raft--painted' : ''}`} style={raftPic ? { backgroundImage: `url(${raftPic})` } : undefined} aria-label={words.raft}>
            <h3>🛶 {words.raft} <span>{onRaft.length}</span></h3>
            <div className="lv-raft__cells">
              {onRaft.map((p) => {
                const m = game.mine[p.id];
                return (
                  <div key={p.id} className="lv-raft__who">
                    <AvatarImage avatar={avatars[p.id] ?? null} size={44} />
                    <span className="lv-raft__marks" aria-label={`${m?.raftRight ?? 0} of ${RAFT_RIGHT} right`}>
                      {Array.from({ length: RAFT_RIGHT }, (_, i) => <i key={i} className={i < (m?.raftRight ?? 0) ? 'on' : ''} />)}
                    </span>
                    {nameOf(p) && <small>{nameOf(p)}</small>}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {!over && (phase === 'ready' || (phase === 'run' && secLeft !== null)) && (
        <div className={`fc-count ${secLeft !== null && secLeft <= 3 ? 'fc-count--low' : ''}`} key={secLeft ?? 'ready'} role="timer">
          {phase === 'ready' ? 'Get ready…' : secLeft}
        </div>
      )}
      {!over && (phase === 'crack' || phase === 'show') && r && (
        <div className="lv-callout" key={r.n}>
          {phase === 'crack' ? 'CRACK!' : (r.fell?.length ?? 0) === 0 ? 'Everyone safe!' : `${r.fell?.length} in the lava!`}
          {phase === 'show' && <small>{r.booted.length ? `🥾 ${r.booted.length} saved by Fire boots · ` : ''}{onFloor.length} still standing</small>}
        </div>
      )}
      {over && <LavaFinish screen={screen} game={game} avatars={avatars} onAgain={onAgain} />}
    </div>
  );
}

/** The podium (names only when shown), rounds up, and a few true shout-outs. */
function LavaFinish({ screen, game, avatars, onAgain }: { screen: ScreenView; game: LavaGame; avatars: Record<string, unknown>; onAgain: () => void }) {
  const ids = screen.people.map((p) => p.id);
  const top = lavaPodium(game, ids);
  const byId = (id: string) => screen.people.find((p) => p.id === id);
  const m = (id: string) => game.mine[id];
  const names = (list: string[]) => {
    const n = list.map((id) => byId(id)?.name).filter(Boolean) as string[];
    return n.length > 2 ? `${n.slice(0, 2).join(', ')} and ${n.length - 2} more` : n.join(' and ');
  };
  const top1 = (f: (id: string) => number | undefined, low = false) => {
    let v: number | null = null;
    for (const id of ids) { const x = f(id); if (x !== undefined && x > 0 && (v === null || (low ? x < v : x > v))) v = x; }
    return v === null ? null : { v, who: ids.filter((id) => f(id) === v) };
  };
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const award = (emoji: string, title: string, f: (id: string) => number | undefined, sayIt: (v: number) => string, low = false) => {
    const x = top1(f, low);
    return x ? { emoji, title, who: names(x.who), what: sayIt(x.v) } : null;
  };
  const accuracy = (id: string) => {
    const r = m(id)?.right ?? 0;
    const w = m(id)?.wrong ?? 0;
    return r + w >= 5 ? Math.round((100 * r) / (r + w)) : undefined;
  };
  const neverFell = ids.filter((id) => (m(id)?.falls ?? 0) === 0 && (m(id)?.up ?? 0) > 0);
  const awards = screen.showNames ? [
    award('🧱', 'Bridge builder', (id) => m(id)?.built, (v) => `built ${plural(v, 'bridge')}`),
    award('🛟', 'Lifeguard', (id) => m(id)?.rescues, (v) => `rescued ${plural(v, 'friend')}`),
    award('🎁', 'Power-up collector', (id) => m(id)?.grabs, (v) => `picked up ${v}`),
    award('🧮', 'Maths whizz', (id) => m(id)?.right, (v) => plural(v, 'right answer')),
    award('🔥', 'Hot streak', (id) => ((m(id)?.bestStreak ?? 0) >= 3 ? m(id)?.bestStreak : undefined), (v) => `${v} right in a row`),
    award('⏱️', 'Fastest answer', (id) => m(id)?.fastMs, (v) => `${(v / 1000).toFixed(1)} seconds`, true),
    award('🎯', 'Sharpshooter', accuracy, (v) => `${v}% right`),
    award('🧗', 'Comeback kid', (id) => m(id)?.climbs, (v) => `climbed back ${plural(v, 'time')}`),
    neverFell.length > 0 && neverFell.length < ids.length ? { emoji: '🦶', title: 'Never fell in', who: names(neverFell), what: '' } : null,
  ].filter((x): x is { emoji: string; title: string; who: string; what: string } => !!x) : [];
  const sum = (f: (id: string) => number | undefined) => ids.reduce((n, id) => n + (f(id) ?? 0), 0);
  const facts = [
    game.sankAll > 0 && `🌋 ${plural(game.sankAll, 'tile')} sank`,
    game.builtAll > 0 && `🧱 ${plural(game.builtAll, 'bridge')} built`,
    sum((id) => m(id)?.falls) > 0 && `💦 ${plural(sum((id) => m(id)?.falls), 'splash', 'splashes')}`,
    sum((id) => m(id)?.rescues) > 0 && `🛟 ${plural(sum((id) => m(id)?.rescues), 'rescue')}`,
    sum((id) => m(id)?.right) > 0 && `🧮 ${plural(sum((id) => m(id)?.right), 'right answer')}`,
  ].filter(Boolean) as string[];
  const rounds = game.round?.n ?? 0;
  return (
    <div className="cl-finish fc-finish" role="dialog" aria-label="Finish">
      <h2 className="cl-finish__title">Floor is Lava is over!</h2>
      <p className="cl-finish__sub">{rounds} {rounds === 1 ? 'round' : 'rounds'} on {LAVA_WORDS[game.map].name}</p>
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

/** The lobby's heading. */
export function LavaLobbyHead({ map }: { map: LavaMap }) {
  return (
    <>
      <h1 className="cl-lobby__title">Floor is Lava</h1>
      <div className="cl-lobby__fact">{LAVA_WORDS[map].name}</div>
      <div className="lv-lobby-floor" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} />)}</div>
      <p className="cl-lobby__ask">When a tile glows, get off it! Answer questions to build bridges and rescue friends.</p>
    </>
  );
}

const RUNS = Array.from({ length: RUN_MAX_S - RUN_MIN_S + 1 }, (_, i) => RUN_MIN_S + i);
const TIMERS = [2, 3, 5, 10, 15, 0];

/** The teacher's card on the Class Live picker. */
export function LavaCard({ busy, disabled, onOpen }: { busy: boolean; disabled: boolean; onOpen: (body: Record<string, unknown>) => void }) {
  const lavaRun = useEdgeChoice('lava');
  const [map, setMap] = useState<LavaMap | 'any'>('any');
  const [run, setRun] = useState(RUN_DEFAULT_S);
  const [length, setLength] = useState(5);
  const pic = painted('pick', 'lava', true) ?? painted('lava', 'lake-volcano', true);
  return (
    <section className="cl-card cl-card--active cl-card--lava" aria-label="Floor is Lava">
      <div className="cl-card__art" aria-hidden="true">{pic ? <img src={pic} alt="" loading="eager" /> : <div className="lv-card-art"><div className="lv-lobby-floor">{Array.from({ length: 12 }, (_, i) => <i key={i} />)}</div></div>}</div>
      <h2 className="cl-card__name">🌋 Floor is Lava</h2>
      <p className="cl-card__blurb">Tiles glow, then crack into the lava. Answer to build bridges and rescue friends!</p>
      <div className="cl-opt">
        <span className="cl-opt__label">Which map?</span>
        <div className="cl-chips" role="group" aria-label="Map">
          <button type="button" className={`cl-choice ${map === 'any' ? 'cl-choice--on' : ''}`} aria-pressed={map === 'any'} onClick={() => setMap('any')}>Surprise me</button>
          {LAVA_MAPS.map((m) => (
            <button key={m} type="button" className={`cl-choice ${map === m ? 'cl-choice--on' : ''}`} aria-pressed={map === m} onClick={() => setMap(m)}>{LAVA_WORDS[m].name}</button>
          ))}
        </div>
      </div>
      <div className="cl-opt">
        <span className="cl-opt__label">Time to get off the glow</span>
        <div className="cl-chips" role="group" aria-label="Time to get off the glow">
          {RUNS.map((n) => <button key={n} type="button" className={`cl-choice ${run === n ? 'cl-choice--on' : ''}`} aria-pressed={run === n} onClick={() => setRun(n)}>{n} s</button>)}
        </div>
      </div>
      <div className="cl-opt">
        <span className="cl-opt__label">Timer</span>
        <div className="cl-chips" role="group" aria-label="Timer">
          {TIMERS.map((m) => <button key={m} type="button" className={`cl-choice ${length === m ? 'cl-choice--on' : ''}`} aria-pressed={length === m} onClick={() => setLength(m)}>{m === 0 ? 'No timer' : `${m} min`}</button>)}
        </div>
      </div>
      {lavaRun.node}
      <button type="button" className="cl-btn cl-btn--go" disabled={busy || disabled} onClick={() => onOpen({ length, run, ...(map === 'any' ? {} : { map }), ...lavaRun.extra })}>{busy ? 'Opening…' : 'Open the room'}</button>
    </section>
  );
}

export { PATTERNS, tileAt };
