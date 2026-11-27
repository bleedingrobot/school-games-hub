/**
 * Glitches on the big screen (docs/CREW-PLAN.md): the whole factory with everyone's avatar (roles never shown),
 * sparking machines, the power bar, the round's clock, the teacher's "Call a meeting" button (James: teacher only), the
 * meeting (40 s talk, secret vote with counts only, a kind reveal), the round's end with who the Glitches were, and
 * the podium. The server decides everything: this asks it (`onTick`) twice a second during work, and just after each
 * deadline otherwise.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AvatarImage } from '../../avatar/AvatarImage';
import {
  activeGlitches, AVATAR_R, JAMMED_WIN, MACHINES, MECHANICS, phaseOf, podium, POWER_WORDS, powerNow, sparking, UNLOCK, type CrewGame, type CrewMechanic,
} from '../../../shared/classlive/crew';
import type { Spot } from '../../../shared/classlive/corners';
import type { ScreenView } from '../../../shared/classlive/server';
import type { ClassLiveSound } from './audio';
import { lineOf } from './CornersScene';
import { CrewBoard, CrewToken } from './CrewBoard';
import { useEdgeLink } from './edgeLink';
import type { ClassLiveLink } from './link';

type Person = ScreenView['people'][number];
const TICK_MS = 500;

export const CREW_MECH_ABOUT: Record<CrewMechanic, string> = {
  items: 'Power-up crates! Crew walk over one, then a right answer switches it on: rocket boots, a camera or a super toolkit.',
  lights: 'Lights out! A Glitch can switch off the lights once a round. Two right answers in the Control Room turn them back on.',
  belts: 'Conveyor belts! They carry you along. Drones float over them.',
};
const WHY: Record<string, string> = {
  power: '⚡ Full power! The Crew win the round!',
  found: '🔍 Every Glitch found! The Crew win the round!',
  jammed: `💥 ${JAMMED_WIN} machines jammed! The Glitches win the round!`,
  time: '⏱️ Time up before full power. The Glitches win the round!',
  outnumbered: '⚡ As many Glitches as Crew! The Glitches win the round!',
};

export function CrewScene({ screen, game, link: baseLink, room, clock, sound, say, onTick, onCrew, over, onAgain }: {
  screen: ScreenView; game: CrewGame; link: ClassLiveLink; room: number | null;
  clock: () => number;
  sound: ClassLiveSound; say: (text: string, delay?: number) => void;
  onTick: () => void;
  /** The teacher's meeting buttons. */
  onCrew: (what: 'meeting' | 'vote' | 'more') => void;
  over: boolean;
  onAgain: () => void;
}) {
  // Cloudflare rooms send and read spots over a live connection (edgeLink.ts), 10 times a second.
  const link = useEdgeLink(baseLink, room, screen.edge);
  const t = screen.startedAt === null ? 0 : clock() - screen.startedAt;
  const r = game.round;
  const targets = useRef<Record<string, Spot>>({});
  const shown = useRef<Record<string, Spot>>({});
  const [, setFrame] = useState(0);
  const [avatars, setAvatars] = useState<Record<string, unknown>>({});
  const ids = screen.people.map((p) => p.id);
  const phase = phaseOf(r, t);

  const count = screen.people.length;
  useEffect(() => {
    if (!room) return;
    let live = true;
    void link.avatars(room).then((a) => { if (live && a) setAvatars(a); }, () => undefined);
    return () => { live = false; };
  }, [room, count, link]);

  const running = phase === 'work';
  useEffect(() => {
    if (!room || over) return;
    let live = true;
    const read = () => void link.positions(room).then((p) => { if (live && p) targets.current = p; }, () => undefined);
    read();
    const id = window.setInterval(read, running ? (link.readMs ?? 300) : 1500);
    return () => { live = false; window.clearInterval(id); };
  }, [room, running, over, link]);

  // Everyone glides to their saved spot; the server's own spot wins when it moved them (the Canteen).
  const placedSeen = useRef<Record<string, number>>({});
  useEffect(() => {
    let id = 0;
    let last = performance.now();
    const loop = (ts: number) => {
      const dt = Math.min(0.1, (ts - last) / 1000);
      last = ts;
      const k = Math.min(1, dt * 9);
      for (const p of screen.people) {
        const m = game.mine[p.id];
        if (m && placedSeen.current[p.id] !== m.placed) {
          placedSeen.current[p.id] = m.placed;
          targets.current[p.id] = { ...m.spot };
        }
        const goal = phase === 'work' ? (targets.current[p.id] ?? m?.spot) : m?.spot;
        if (!goal) continue;
        const cur = shown.current[p.id];
        if (!cur || Math.hypot(goal.x - cur.x, goal.y - cur.y) > 0.35) shown.current[p.id] = { ...goal };
        else shown.current[p.id] = { x: cur.x + (goal.x - cur.x) * k, y: cur.y + (goal.y - cur.y) * k };
      }
      setFrame((f) => (f + 1) % 1_000_000);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [screen.people, game.mine, phase]);

  // The server moves the game on: often during work (sparks, the power bar), else just after the next deadline.
  const tick = useRef(onTick);
  tick.current = onTick;
  const mt = r?.meeting ?? null;
  const deadline = !r ? 3000 : r.done ? (r.showEnd ?? 0) + 50 : mt ? (mt.revealEnd ?? (t < mt.talkEnd ? mt.talkEnd : mt.voteEnd)) + 50 : t < r.startAt ? r.startAt + 50 : r.endAt + 50;
  useEffect(() => {
    if (over || screen.startedAt === null) return;
    if (phase === 'work' || phase === 'vote') {
      const id = window.setInterval(() => tick.current(), TICK_MS);
      return () => window.clearInterval(id);
    }
    const wait = Math.max(50, deadline - t);
    const a = window.setTimeout(() => tick.current(), wait);
    const b = window.setTimeout(() => tick.current(), wait + 2500);
    return () => { window.clearTimeout(a); window.clearTimeout(b); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, phase, over, screen.startedAt]);

  // The teacher's keys: M calls a meeting, V votes now.
  const crewRef = useRef(onCrew);
  crewRef.current = onCrew;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.key === 'm' || e.key === 'M') && phaseRef.current === 'work') crewRef.current('meeting');
      if ((e.key === 'v' || e.key === 'V') && phaseRef.current === 'talk') crewRef.current('vote');
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  // Bella and sounds for each moment.
  const moment = useRef('');
  useEffect(() => {
    if (over || !r) return;
    const key = `${r.n}:${r.meetings}:${phase}`;
    if (moment.current === key) return;
    moment.current = key;
    if (phase === 'roles') {
      sound.play('start');
      say(lineOf(r.n === 1 ? 'crewStart' : 'crewRound') ?? 'Check your role!', 300);
    } else if (phase === 'work' && r.meetings === 0) {
      sound.play('drumroll');
      const fresh = MECHANICS.find((m) => UNLOCK[m] === r.n);
      say((fresh ? lineOf(`mech_crew_${fresh}`) : null) ?? lineOf('crewWork') ?? 'Get to work!', 200);
    } else if (phase === 'talk') {
      say(lineOf('crewTalk') ?? 'Talk it over!', 2600);
    } else if (phase === 'vote') {
      sound.play('tick');
      say(lineOf('crewVote') ?? 'Vote now!', 100);
    } else if (phase === 'reveal' && mt) {
      sound.play(mt.out ? (mt.glitch ? 'safe' : 'caught') : 'land');
      say(lineOf(!mt.out ? 'crewNobody' : mt.glitch ? 'crewGlitch' : 'crewCrew') ?? '', 900);
    } else if (phase === 'done' && r.done) {
      sound.play(r.done.winner === 'crew' ? 'safe' : 'caught');
      window.setTimeout(() => sound.play('land'), 500);
      const k = { power: 'crewWinPower', found: 'crewWinFound', jammed: 'crewWinJammed', time: 'crewWinTime', outnumbered: 'crewWinMany' }[r.done.why];
      say(lineOf(k) ?? 'Round over!', 600);
    }
  }, [phase, r, mt, over, say, sound]);

  const nSparking = r ? sparking(r) : 0;
  const nudged = useRef('');
  useEffect(() => {
    if (!r || phase !== 'work' || nSparking < 3) return;
    const key = `${r.n}:${r.meetings}`;
    if (nudged.current === key) return;
    nudged.current = key;
    say(lineOf('crewThree') ?? 'Three machines are sparking!', 1200);
  }, [nSparking, phase, r, say]);

  const workLeft = r && (phase === 'work' || phase === 'roles') ? Math.max(0, Math.ceil((r.endAt - t) / 1000)) : r && mt ? Math.max(0, Math.ceil((r.endAt - mt.at) / 1000)) : null;
  const lastSec = useRef<number | null>(null);
  useEffect(() => {
    if (phase !== 'work' || workLeft === null || workLeft === lastSec.current) return;
    lastSec.current = workLeft;
    if (workLeft <= 5 && workLeft > 0) sound.play(workLeft <= 3 ? 'tickLast' : 'tick');
    if (workLeft === 30) say(lineOf('crewHurry') ?? 'Thirty seconds left!');
  }, [workLeft, phase, sound, say]);

  // Sparks, fixes, jobs, lights and power-ups: pops on the board (from the screen's events, once each).
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
      const mAt = 'machine' in e && typeof e.machine === 'number' ? { x: MACHINES[e.machine].x, y: MACHINES[e.machine].y - 0.05 } : null;
      const pAt = 'pupil' in e && typeof e.pupil === 'string' ? (shown.current[e.pupil] ?? null) : null;
      if (e.type === 'c_spark' && mAt) { sound.play('crack'); add.push({ key: e.seq, at: mAt, text: '⚡💥', kind: 'spark' }); chat('crewSpark'); }
      else if (e.type === 'c_fix' && mAt) { sound.play(e.mended ? 'build' : 'plop'); add.push({ key: e.seq, at: mAt, text: e.mended ? '🔧✨' : '🔧', kind: 'fix' }); if (e.mended) chat('crewMend'); }
      else if (e.type === 'c_job' && mAt) { sound.play('glow'); add.push({ key: e.seq, at: mAt, text: '+⚡', kind: 'job' }); }
      else if (e.type === 'c_dark') { sound.play('storm'); lastSaid.current = 0; chat('crewDark'); }
      else if (e.type === 'c_light') { sound.play('power'); lastSaid.current = 0; chat('crewLight'); }
      else if (e.type === 'c_grab' && pAt) { sound.play('grab'); add.push({ key: e.seq, at: pAt, text: POWER_WORDS[e.power].emoji, kind: 'grab' }); }
      else if (e.type === 'c_meeting') { sound.play('dice'); say(lineOf('crewMeeting') ?? 'Meeting time!', 100); }
    }
    if (add.length) {
      setPops((p) => [...p, ...add].slice(-12));
      window.setTimeout(() => setPops((p) => p.filter((x) => !add.includes(x))), 1800);
    }
  }, [screen.events, screen.seq, sound, say]);

  const nameOf = (p: Person) => (screen.showNames ? p.name : null);
  const byId = (id: string | null) => (id ? screen.people.find((p) => p.id === id) : undefined);
  const dark = !!r && r.lightsTo > t && phase === 'work';
  const fresh = r ? MECHANICS.find((m) => UNLOCK[m] === r.n) : undefined;
  const power = r ? powerNow({ power: r.power, powerAt: r.powerAt, sparking: nSparking, paused: phase !== 'work' }, t) : 0;
  const glitchesLeft = activeGlitches(game, ids).length;
  const fixers = useMemo(() => {
    if (!screen.showNames) return [];
    return [...screen.people].filter((p) => (game.mine[p.id]?.mends ?? 0) > 0).sort((a, b) => (game.mine[b.id]?.mends ?? 0) - (game.mine[a.id]?.mends ?? 0)).slice(0, 4);
  }, [screen.people, screen.showNames, game.mine]);
  const out = byId(mt?.out ?? null);
  const talkLeft = mt && phase === 'talk' ? Math.max(0, Math.ceil((mt.talkEnd - t) / 1000)) : null;
  const voteLeft = mt && phase === 'vote' ? Math.max(0, Math.ceil((mt.voteEnd - t) / 1000)) : null;
  const voters = ids.filter((id) => game.mine[id] && !game.mine[id].drone).length;
  const sparkNames = r ? MACHINES.filter((mc) => r.machines[mc.id].sparked).map((mc) => mc.room) : [];

  return (
    <div className="fc-scene sc-scene">
      <div className="fc-stage">
        <CrewBoard round={r} dark={dark ? 'all' : null} meeting={!!mt}>
          {screen.people.map((p) => {
            const m = game.mine[p.id];
            const at = shown.current[p.id] ?? m?.spot;
            if (!at || !m) return null;
            const cls = [
              m.bootsTo > t ? 'fc-token--fast' : '',
              phase === 'reveal' && mt?.out === p.id ? 'sc-token--out' : '',
              phase === 'done' && r?.done && m.last === 'won' ? 'sc-token--winner' : '',
              phase === 'done' && m.glitch ? 'sc-token--glitch' : '',
            ].join(' ');
            return (
              <CrewToken key={p.id} x={at.x} y={at.y} size={AVATAR_R * 2.1} drone={m.drone} className={cls} label={nameOf(p)}>
                <AvatarImage avatar={avatars[p.id] ?? null} size={64} />
              </CrewToken>
            );
          })}
          {pops.map((p) => <span key={p.key} className={`fc-pop sc-pop sc-pop--${p.kind}`} style={{ left: `${p.at.x * 100}%`, top: `${p.at.y * 100}%` }}>{p.text}</span>)}
        </CrewBoard>

        <aside className="fc-side sc-side">
          <div className="fc-side__map">🤖 Robot Factory</div>
          <div className="fc-side__round">{r ? `Shift ${r.n}` : 'Get ready!'}</div>
          {r && (
            <div className="sc-power" aria-label={`Power ${Math.round(power)} of 100`}>
              <span className="sc-power__label">⚡ Power</span>
              <div className="sc-power__bar"><i style={{ width: `${Math.min(100, power)}%` }} /></div>
              <b>{Math.floor(power)}%</b>
            </div>
          )}
          {r && (
            <div className="sc-counts">
              <span className={nSparking >= 3 ? 'is-hot' : ''}><b>{nSparking}</b> / {JAMMED_WIN} ⚡ sparking</span>
              <span><b>{glitchesLeft}</b> 🕵️ {glitchesLeft === 1 ? 'Glitch' : 'Glitches'} hiding</span>
            </div>
          )}
          {workLeft !== null && phase !== 'done' && <div className={`gt-time ${workLeft <= 30 && phase === 'work' ? 'gt-time--low' : ''}`} role="timer">⏱️ {Math.floor(workLeft / 60)}:{String(workLeft % 60).padStart(2, '0')}{mt ? ' (paused)' : ''}</div>}
          {phase === 'work' && !over && (
            <button type="button" className={`cl-btn cl-btn--go sc-call ${nSparking >= 3 ? 'sc-call--hot' : ''}`} onClick={() => onCrew('meeting')} title="Or press M">
              🚨 Call a meeting
            </button>
          )}
          {phase === 'work' && nSparking >= 3 && <p className="sc-nudge">{nSparking} machines down! Call a meeting?</p>}
          {dark && <p className="sc-nudge sc-nudge--dark">🌑 Lights out! Look at your device.</p>}
          {fresh && phase !== 'done' && !mt && <div className="fc-new" key={fresh}><b>New!</b> {CREW_MECH_ABOUT[fresh]}</div>}
          {fixers.length > 0 && phase !== 'done' && !mt && (
            <div className="fc-best">
              <h3>Top fixers</h3>
              <ol>{fixers.map((p) => <li key={p.id}><span>{p.name}</span><b>🔧 {game.mine[p.id]?.mends ?? 0}</b></li>)}</ol>
            </div>
          )}
        </aside>
      </div>

      {!over && phase === 'wait' && <div className="fc-count" role="status">{screen.people.length < 3 ? 'Waiting for 3 players…' : 'Get ready…'}</div>}
      {!over && phase === 'roles' && r && (
        <div className="gt-ready sc-roles" role="status" key={r.n}>
          <div className="gt-ready__n" key={Math.ceil((r.startAt - t) / 1000)}>{Math.max(1, Math.ceil((r.startAt - t) / 1000))}</div>
          <p>🤫 Check your device: are you <b>Crew</b> or a <b>Glitch</b>?</p>
          <p className="gt-ready__who">{r.glitches.length} {r.glitches.length === 1 ? 'Glitch is' : 'Glitches are'} hiding in the factory…</p>
        </div>
      )}
      {!over && mt && (phase === 'talk' || phase === 'vote') && (
        <div className="sc-meeting" role="dialog" aria-label="Meeting">
          <h2>🚨 Emergency meeting!</h2>
          {phase === 'talk' ? (
            <>
              <div className="sc-meeting__timer" role="timer">{talkLeft}s</div>
              <p>Talk it over out loud. Who was near the sparking machines? Be kind, and use clues!</p>
              {sparkNames.length > 0 && <p className="sc-meeting__clue">⚡ Sparking now: {sparkNames.join(', ')}</p>}
              <div className="cl-finish__row">
                <button type="button" className="cl-btn cl-btn--go" onClick={() => onCrew('vote')} title="Or press V">🗳️ Vote now</button>
                <button type="button" className="cl-btn" onClick={() => onCrew('more')}>+20 s talk</button>
              </div>
            </>
          ) : (
            <>
              <div className="sc-meeting__timer" role="timer">{voteLeft}s</div>
              <p>🗳️ Vote on your device. It's secret!</p>
              <div className="sc-voted"><b>{Object.keys(mt.votes).length}</b> of {voters} voted</div>
            </>
          )}
        </div>
      )}
      {!over && mt && phase === 'reveal' && (
        <div className={`sc-reveal ${mt.out ? (mt.glitch ? 'sc-reveal--glitch' : 'sc-reveal--crew') : 'sc-reveal--none'}`} role="status">
          {out ? (
            <>
              <div className="sc-reveal__who"><AvatarImage avatar={avatars[out.id] ?? null} size={140} /></div>
              <b>{screen.showNames && out.name ? `${out.name} was ${mt.glitch ? 'a Glitch!' : 'Crew.'}` : mt.glitch ? 'That was a Glitch!' : 'That was Crew.'}</b>
              <small>{mt.glitch ? '🔍 Well spotted! Beep boop, drone mode on.' : '🛸 Drone mode on: they keep helping the factory.'}</small>
            </>
          ) : <b>🤷 Nobody was sent off. Back to work!</b>}
          {mt.counts && (
            <ul className="sc-reveal__counts">
              {Object.entries(mt.counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => (
                <li key={k}><span>{k === 'skip' ? 'Skip' : (screen.showNames ? byId(k)?.name : null) ?? 'A player'}</span><b>{n}</b></li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!over && phase === 'done' && r?.done && (
        <div className={`gt-banner sc-banner sc-banner--${r.done.winner}`} role="status" key={r.n}>
          <b>{WHY[r.done.why]}</b>
          <span>This shift's {r.glitches.length === 1 ? 'Glitch was' : 'Glitches were'}:</span>
          <div className="gt-banner__who">
            {r.glitches.map((id) => <span key={id}><AvatarImage avatar={avatars[id] ?? null} size={64} />{screen.showNames && <small>{byId(id)?.name}</small>}</span>)}
          </div>
          <small>Next shift soon…</small>
        </div>
      )}
      {over && <CrewFinish screen={screen} game={game} avatars={avatars} onAgain={onAgain} />}
    </div>
  );
}

/** The podium (names only when shown), awards and class facts. */
function CrewFinish({ screen, game, avatars, onAgain }: { screen: ScreenView; game: CrewGame; avatars: Record<string, unknown>; onAgain: () => void }) {
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
  const awards = screen.showNames ? [
    award('🔧', 'Chief engineer', (id) => m(id)?.mends, (v) => `mended ${plural(v, 'machine')}`),
    award('🔍', 'Sharp detective', (id) => m(id)?.detects, (v) => `found ${plural(v, 'Glitch', 'Glitches')}`),
    award('⚡', 'Sneakiest Glitch', (id) => m(id)?.glitchWins, (v) => `won ${plural(v, 'shift')} as a Glitch`),
    award('📋', 'Hardest worker', (id) => m(id)?.jobsDone, (v) => plural(v, 'job')),
    award('🧮', 'Maths whizz', (id) => m(id)?.right, (v) => plural(v, 'right answer')),
    award('🔥', 'Hot streak', (id) => ((m(id)?.bestStreak ?? 0) >= 3 ? m(id)?.bestStreak : undefined), (v) => `${v} right in a row`),
    award('🎁', 'Power-up collector', (id) => m(id)?.grabs, (v) => `picked up ${v}`),
  ].filter((x): x is { emoji: string; title: string; who: string; what: string } => !!x) : [];
  const sum = (f: (id: string) => number) => ids.reduce((n, id) => n + f(id), 0);
  const facts = [
    sum((id) => m(id)?.jobsDone ?? 0) > 0 && `📋 ${plural(sum((id) => m(id)?.jobsDone ?? 0), 'job')} done`,
    sum((id) => m(id)?.mends ?? 0) > 0 && `🔧 ${plural(sum((id) => m(id)?.mends ?? 0), 'machine')} mended`,
    sum((id) => m(id)?.right ?? 0) > 0 && `🧮 ${plural(sum((id) => m(id)?.right ?? 0), 'right answer')}`,
  ].filter(Boolean) as string[];
  const rounds = game.round?.n ?? 0;
  return (
    <div className="cl-finish fc-finish" role="dialog" aria-label="Finish">
      <h2 className="cl-finish__title">Glitches is over!</h2>
      <p className="cl-finish__sub">{rounds} {rounds === 1 ? 'shift' : 'shifts'} in the Robot Factory</p>
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
