/**
 * Shark Bay on the big screen (docs/SHARK-PLAN.md): Four Corners' scene with the round bay, spinning quarters and drifting
 * boats, a fin that circles (gently while pupils swim, then faster and faster for the strike), and the strike itself:
 * either Simon leaps out of the struck quarter with a big splash, or the water darkens, a spotlight sweeps quarter to
 * quarter like a dice roll and Simon snaps where it stops. Rounds run on the server's clock: this asks the server
 * (`onTick`) just after each deadline so it moves on.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AvatarImage } from '../../avatar/AvatarImage';
import { AVATAR_R, JAIL_RIGHT, podium, ROLL_MS, type Corner, type CornersGame, type CornersMine, type Spot } from '../../../shared/classlive/corners';
import {
  BAY_WORDS, bayAngle, bayPoint, bayRound, quarterMid, SHARK, SHARK_MECHANICS, SHARK_POWER_WORDS, SHARK_UNLOCK, spinAt, type BayRound, type SharkGame, type SharkMechanic,
  type SharkMineExtra,
} from '../../../shared/classlive/shark';
import type { ScreenView } from '../../../shared/classlive/server';
import type { ClassLiveSound } from './audio';
import { at as spotAt, Token } from './CornersBoard';
import { useEdgeLink } from './edgeLink';
import type { ClassLiveLink } from './link';
import { painted } from './paintedArt';
import { SharkBoard, QUARTER_COLOURS, QUARTER_NAMES, sharkHazardPic } from './SharkBoard';
import { lineOf } from './CornersScene';

const MECH_ABOUT: Record<SharkMechanic, (w: (typeof BAY_WORDS)['lagoon']) => string> = {
  items: () => 'Power-ups! Grab one, then answer a question in the water to switch it on.',
  storm: (w) => `${w.storm}! It slows you down.`,
  teleport: (w) => `${w.teleport}s! Swim into one to pop out of the other.`,
  ice: (w) => `${w.ice}! You slide and can't stop fast.`,
  fog: (w) => `${w.fog}! The big screen can't see you at the end.`,
  roller: (w) => `${w.roller}s! They roll across the bay and knock you flying.`,
  twist: () => `Twist! Two sharks, or ${SHARK} is full.`,
};

/** Strike timing, as shares of the strike phase (ROLL_MS): the build-up, then the burst or the snap. */
const BURST = 0.78;
/** How long caught pupils take to swim off to the cave after the strike (ms from the end of the strike phase). */
const SWIM_MS = 1500;

type Person = ScreenView['people'][number];

const TAU = Math.PI * 2;
const ease = (k: number) => 1 - (1 - k) * (1 - k);

/** A fin cutting through the water at angle `a` (bay coordinates), on a circle (an oval on a wide board `w`) of radius `r`, pointing the way it swims. */
function Fin({ a, r, bay, w, size = 0.1, calm }: { a: number; r: number; bay: SharkGame['bay']; w: number; size?: number; calm?: boolean }) {
  const p = bayPoint(a, r, w);
  const pic = sharkHazardPic(bay, 'fin');
  // The way round the oval at this point (screen angle).
  const heading = Math.atan2(Math.cos(a), -Math.sin(a) * w);
  return (
    <div className={`sb-fin ${calm ? 'sb-fin--calm' : ''}`} style={{ ...spotAt(p.x, p.y, w), width: `${(size / w) * 100}%`, height: `${size * 100}%`, transform: `translate(-50%, -50%) rotate(${(heading * 180) / Math.PI}deg)` }} aria-hidden="true">
      {pic ? <img src={pic} alt="" /> : <i className="sb-fin__blade" />}
      <i className="sb-fin__wake" />
    </div>
  );
}

/** Simon bursting out (or snapping) at a spot, with a big splash. */
function Burst({ at: p, bay, w, style, late }: { at: Spot; bay: SharkGame['bay']; w: number; style: 'leap' | 'spot'; late?: boolean }) {
  const pic = sharkHazardPic(bay, 'shark');
  return (
    <div className={`sb-burst sb-burst--${style} ${late ? 'sb-burst--late' : ''}`} style={spotAt(p.x, p.y, w)} aria-hidden="true">
      <i className="sb-burst__ring" /><i className="sb-burst__ring sb-burst__ring--b" /><i className="sb-burst__ring sb-burst__ring--c" />
      <span className="sb-burst__drops">💦</span>
      <span className="sb-burst__shark">{pic ? <img src={pic} alt="" /> : '🦈'}</span>
      {style === 'spot' && <b className="sb-burst__chomp">CHOMP!</b>}
    </div>
  );
}

export function SharkScene({ screen, game, link: baseLink, room, clock, sound, say, onTick, over, onAgain }: {
  screen: ScreenView; game: SharkGame; link: ClassLiveLink; room: number | null;
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
  const br: BayRound | null = bayRound(r);
  /** The board's width (height 1): wide since 27 Nov 2026, the bay an oval. */
  const bw = r?.w ?? game.w ?? 1;
  const angleOf = (p: Spot) => bayAngle(p, bw);
  const targets = useRef<Record<string, Spot>>({});
  const shown = useRef<Record<string, Spot>>({});
  const [, setFrame] = useState(0);
  const [avatars, setAvatars] = useState<Record<string, unknown>>({});
  const words = BAY_WORDS[game.bay];

  // Everyone's avatar (again when more join).
  const count = screen.people.length;
  useEffect(() => {
    if (!room) return;
    let live = true;
    void link.avatars(room).then((a) => { if (live && a) setAvatars(a); }, () => undefined);
    return () => { live = false; };
  }, [room, count, link]);

  // Saved spots, every 0.3 s while a round runs (every 2 s otherwise).
  const running = !!r && r.caught === null && !over;
  useEffect(() => {
    if (!room || over) return;
    let live = true;
    const read = () => void link.positions(room).then((p) => { if (live && p) targets.current = p; }, () => undefined);
    read();
    const id = window.setInterval(read, running ? (link.readMs ?? 300) : 2000);
    return () => { live = false; window.clearInterval(id); };
  }, [room, running, over, link]);

  // Glide every avatar towards its newest spot, every frame.
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

  // Ask the server just after each deadline: the run's end (a moment later, so last moves land), then the next round.
  const deadline = !r ? 4000 : r.caught === null ? r.runEnd + 450 : r.showEnd + 50;
  const tick = useRef(onTick);
  tick.current = onTick;
  useEffect(() => {
    if (over || screen.startedAt === null) return;
    const wait = Math.max(50, deadline - t);
    const id = window.setTimeout(() => tick.current(), wait);
    // And again if the reply got lost.
    const again = window.setTimeout(() => tick.current(), wait + 2500);
    return () => { window.clearTimeout(id); window.clearTimeout(again); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, over, screen.startedAt]);

  // The strike, in numbers: how far through the strike phase (0 to 1), and whether it has burst.
  const phase = !r ? 'ready' : r.caught === null ? (t < r.runEnd ? 'run' : 'wait') : t < r.rollEnd ? 'roll' : t < r.showEnd ? 'show' : 'wait';
  const k = r && (phase === 'roll' || phase === 'show' || phase === 'wait') ? Math.max(0, Math.min(1, (t - r.runEnd) / ROLL_MS)) : 0;
  const struck = !!r && r.caught !== null && k >= BURST;
  const landed = phase === 'show';
  const secLeft = r && phase === 'run' ? Math.ceil((r.runEnd - t) / 1000) : null;

  // Sounds and Bella, once per moment.
  const moment = useRef('');
  useEffect(() => {
    if (over || !r) return;
    const key = `${r.n}:${phase}`;
    if (moment.current === key) return;
    moment.current = key;
    if (phase === 'run') {
      sound.play('start');
      say(lineOf(r.n === 1 ? 'sharkStart' : 'sharkRun') ?? 'Swim to a coloured quarter, or hide under a boat!', 300);
      if (r.n <= 2) window.setTimeout(() => say(lineOf('sharkBoat') ?? 'Hide under a boat!'), 4200);
    } else if (phase === 'roll') {
      sound.play('drumroll');
      const style = (r as BayRound).style;
      say(lineOf(style === 'spot' ? 'sharkSpot' : 'sharkLeap') ?? 'Here comes Simon!', 100);
      // The burst: a big splash and a chomp, then Bella calls the quarter.
      const burstIn = Math.max(0, r.runEnd + ROLL_MS * BURST - (screen.startedAt === null ? 0 : clock() - screen.startedAt));
      window.setTimeout(() => { sound.play('splash'); window.setTimeout(() => sound.play('chomp'), 250); }, burstIn);
      const called = r.twist === 'lucky' ? lineOf('sharkFull')
        : r.twist === 'two' ? lineOf('sharkTwo')
          : r.rolled.length ? lineOf(`sharkStrike${QUARTER_NAMES[r.rolled[0]]}`) : null;
      say(called ?? (r.twist === 'lucky' ? `${SHARK} is full! Nobody is caught!` : `${SHARK} strikes ${QUARTER_NAMES[r.rolled[0] ?? 0]}!`), burstIn + 300);
    } else if (phase === 'show') {
      const caught = r.caught?.length ?? 0;
      window.setTimeout(() => sound.play(caught ? 'caught' : 'safe'), 600);
      const boated = (r as BayRound).boated?.length ?? 0;
      if (r.saved.length) window.setTimeout(() => say(lineOf('shieldSaved') ?? 'A shark cage saved someone!'), 2200);
      else if (caught === 0) window.setTimeout(() => say(lineOf('nobodyCaught') ?? 'Nobody caught!'), 2200);
      else if (caught >= Math.max(4, screen.people.length / 3)) window.setTimeout(() => say(lineOf('sharkCave') ?? 'Lots of you are off to the shark cave!'), 2200);
      else if (boated > 0) window.setTimeout(() => say(lineOf('sharkBoated') ?? 'The boats kept some pupils safe!'), 2200);
    }
  }, [phase, r, over, say, sound, screen.people.length, screen.startedAt, clock]);
  const lastTick = useRef<number | null>(null);
  useEffect(() => {
    if (secLeft === null || secLeft === lastTick.current) return;
    lastTick.current = secLeft;
    if (secLeft <= 5 && secLeft > 0) sound.play((secLeft <= 3 ? 'tickLast' : 'tick'));
    if (secLeft === 3) say(lineOf('sharkHurry') ?? 'Three seconds!');
  }, [secLeft, sound, say]);

  // Grabs, power-ups and escapes: little pops (from the screen's events, once each).
  const seenSeq = useRef<number | null>(null);
  const [pops, setPops] = useState<{ key: number; at: Spot; text: string }[]>([]);
  useEffect(() => {
    const evs = screen.events;
    if (seenSeq.current === null) { seenSeq.current = screen.seq; return; }
    const fresh = evs.filter((e) => e.seq > (seenSeq.current as number));
    if (!fresh.length) return;
    seenSeq.current = fresh[fresh.length - 1].seq;
    const add: { key: number; at: Spot; text: string }[] = [];
    for (const e of fresh) {
      const pos = 'pupil' in e && typeof e.pupil === 'string' ? (shown.current[e.pupil] ?? { x: bw / 2, y: 0.5 }) : { x: bw / 2, y: 0.5 };
      // `e.power` is typed for every map game's powers (Musical Thrones adds its own); these events are Shark Bay's.
      if (e.type === 'grab') { sound.play('grab'); add.push({ key: e.seq, at: pos, text: SHARK_POWER_WORDS[e.power as keyof typeof SHARK_POWER_WORDS].emoji }); }
      else if (e.type === 'power') { sound.play('power'); add.push({ key: e.seq, at: pos, text: `${SHARK_POWER_WORDS[e.power as keyof typeof SHARK_POWER_WORDS].emoji} ${SHARK_POWER_WORDS[e.power as keyof typeof SHARK_POWER_WORDS].name}!` }); }
      else if (e.type === 'escape') sound.play('escape');
    }
    if (fresh.some((e) => e.type === 'escape')) say(lineOf('escape') ?? 'Out of the cave!', 800);
    if (add.length) {
      setPops((p) => [...p, ...add].slice(-8));
      window.setTimeout(() => setPops((p) => p.filter((x) => !add.includes(x))), 1800);
    }
  }, [screen.events, screen.seq, sound, say]);

  const nameOf = (p: Person) => (screen.showNames ? p.name : null);
  const jailed = screen.people.filter((p) => game.mine[p.id]?.jailedIn !== null && game.mine[p.id] !== undefined);
  const free = screen.people.filter((p) => !jailed.includes(p));
  // The caught stay in the water until the strike has landed, then swim off to the cave strip.
  const justCaught = new Set(r?.caught ?? []);
  const boated = new Set(br?.boated ?? []);
  const swimK = r && r.caught !== null ? Math.max(0, Math.min(1, (t - r.rollEnd) / SWIM_MS)) : 0;
  const swimming = !!r && r.caught !== null && swimK < 1 && t < r.showEnd;
  const onBoard = !r || r.caught === null || swimK >= 1 ? free : screen.people.filter((p) => !jailed.includes(p) || justCaught.has(p.id));
  const inCave = !r || r.caught === null || swimK >= 1 ? jailed : jailed.filter((p) => !justCaught.has(p.id));
  const fresh = r ? SHARK_MECHANICS.find((m) => SHARK_UNLOCK[m] === r.n) : undefined;
  const top = useMemo(() => {
    if (!screen.showNames) return [];
    return [...screen.people].filter((p) => (game.mine[p.id]?.score ?? 0) > 0).sort((a, b) => (game.mine[b.id]?.score ?? 0) - (game.mine[a.id]?.score ?? 0)).slice(0, 5);
  }, [screen.people, screen.showNames, game.mine]);
  const jailPic = painted('shark', `cave-${game.bay}`) ?? painted('corners', `jail-${game.map}`);

  // The strike picture: where Simon hits, and the fin's or the spotlight's place on the way.
  const spin = br ? spinAt(br, t) : 0;
  const strikeAt = (br?.rolled ?? []).map((q) => quarterMid(q, spin, 0.27, bw));
  const strikeActive = !!br && br.caught !== null && (phase === 'roll' || phase === 'show');
  const finAngles: number[] = [];
  let spot: { p: Spot; q: Corner } | null = null;
  if (br && strikeActive) {
    const goals = br.rolled.length ? br.rolled.map((q) => angleOf(quarterMid(q, spin))) : [angleOf(quarterMid(0, spin))];
    if (br.style === 'leap' && !struck) {
      // Faster and faster, ending exactly on the target as the shark bursts.
      const kk = Math.min(1, k / BURST);
      goals.forEach((g) => finAngles.push(g - TAU * 5 * (1 - kk * kk)));
    } else if (br.style === 'spot' && !struck) {
      // The spotlight steps quarter to quarter, each step longer than the last, and stops on the target.
      const kk = k / BURST;
      const steps = 14;
      const gap = (i: number) => 0.4 + (i / steps) ** 2 * 2.6;
      const total = Array.from({ length: steps + 1 }, (_, i) => gap(i)).reduce((a, b) => a + b, 0);
      let acc = 0;
      let step = 0;
      for (let i = 0; i <= steps; i++) {
        acc += gap(i) / total;
        if (kk >= acc) step = Math.min(steps, i + 1);
      }
      const goal = br.rolled[0] ?? 0;
      const q = (((goal - (steps - step)) % 4) + 4) % 4 as Corner;
      spot = { p: quarterMid(q, spin, 0.27, bw), q };
    }
  }
  const darkness = br && strikeActive && br.style === 'spot' ? Math.min(1, k / 0.12) * (landed ? Math.max(0.25, 1 - (t - br.rollEnd) / 1200) : 1) : 0;
  const lucky = br?.twist === 'lucky';
  const calloutOf = () => {
    if (!br) return '';
    return lucky ? `${SHARK} is full! Everyone is safe` : `${SHARK} strikes ${br.rolled.map((q) => QUARTER_NAMES[q]).join(' and ')}!`;
  };

  const catchAt = (p: Person, base: Spot): Spot => {
    if (!swimming || !justCaught.has(p.id)) return base;
    // Off to the cave strip beside the bay.
    const kk = ease(swimK);
    return { x: base.x + (bw + 0.2 - base.x) * kk, y: base.y + (0.45 - base.y) * kk };
  };

  return (
    <div className={`fc-scene fc-scene--shark sb-scene sb-scene--${game.bay} ${bw > 1 ? 'fc-scene--wide' : ''}`}>
      <div className={`fc-stage ${struck && r && t < r.rollEnd + 900 && !lucky ? 'sb-shake' : ''}`}>
        <SharkBoard map={game.bay} w={bw} round={br} t={t} flash={struck && br ? br.rolled : null}>
          {/* A gentle fin circles the bay while everyone swims. */}
          {br && phase === 'run' && <Fin a={(t / 1000) * 0.55 + br.spin0} r={0.38} bay={game.bay} w={bw} size={0.07} calm />}
          {br && strikeActive && !struck && br.style === 'leap' && finAngles.map((a, i) => <Fin key={i} a={a} r={0.3} bay={game.bay} w={bw} size={0.11} />)}
          {br && strikeActive && br.style === 'spot' && (
            <div
              className="sb-dark"
              style={{ opacity: darkness, ['--sx' as string]: spot && !struck ? `${(spot.p.x / bw) * 100}%` : `${((strikeAt[0]?.x ?? bw / 2) / bw) * 100}%`, ['--sy' as string]: spot && !struck ? `${spot.p.y * 100}%` : `${(strikeAt[0]?.y ?? 0.5) * 100}%`, ['--sc' as string]: spot ? QUARTER_COLOURS[spot.q] : '#fff' }}
              aria-hidden="true"
            />
          )}
          {onBoard.map((p) => {
            const m = game.mine[p.id];
            const base = shown.current[p.id] ?? m?.spot;
            if (!base || !m) return null;
            const pos = catchAt(p, base);
            const n = r?.n ?? 0;
            const inBoat = boated.has(p.id);
            const gone = swimming && justCaught.has(p.id);
            const cls = [
              m.shieldIn === n ? 'fc-token--shield' : '', m.speedTo !== null && n <= m.speedTo ? 'fc-token--fast' : '',
              m.ghostTo !== null && n <= m.ghostTo ? 'fc-token--ghost' : '', gone ? 'sb-token--swim' : '', inBoat ? 'sb-token--boated' : '',
              landed && r?.saved.includes(p.id) ? 'fc-token--saved' : '', landed && !justCaught.has(p.id) && !r?.saved.includes(p.id) ? 'fc-token--safe' : '',
            ].join(' ');
            return (
              <Token key={p.id} x={pos.x} y={pos.y} size={AVATAR_R * 1.8} className={cls} label={nameOf(p)}>
                <AvatarImage avatar={avatars[p.id] ?? null} size={64} />
                {inBoat && <span className="sb-token__boat" aria-label="Under a boat">⛵</span>}
              </Token>
            );
          })}
          {pops.map((p) => <span key={p.key} className="fc-pop" style={spotAt(p.at.x, p.at.y, bw)}>{p.text}</span>)}
          {br && struck && strikeAt.map((p, i) => <Burst key={`${br.n}-${i}`} at={p} bay={game.bay} w={bw} style={br.style} late={i > 0} />)}
          {br && strikeActive && lucky && struck && <div className="sb-full" aria-hidden="true">😋</div>}
        </SharkBoard>

        <aside className="fc-side">
          <div className="fc-side__map">{words.name}</div>
          <div className="fc-side__round">{r ? `Round ${r.n}` : 'Get ready!'}</div>
          {fresh && phase === 'run' && <div className="fc-new" key={fresh}><b>New!</b> {MECH_ABOUT[fresh](words)}</div>}
          {br && br.spinRate !== 0 && phase === 'run' && r?.n === 2 && <div className="fc-new fc-new--swap"><b>🌀 The bay spins!</b> The colours move, so keep checking where they are.</div>}
          {top.length > 0 && phase !== 'roll' && (
            <div className="fc-best">
              <h3>Most safe rounds</h3>
              <ol>{top.map((p) => <li key={p.id}><span>{p.name}</span><b>{game.mine[p.id]?.score ?? 0}</b></li>)}</ol>
            </div>
          )}
          <div className={`fc-jail sb-cave ${jailPic ? 'fc-jail--painted' : ''}`} style={jailPic ? { backgroundImage: `url(${jailPic})` } : undefined} aria-label={words.jail}>
            <h3>🦈 {words.jail} <span>{inCave.length}</span></h3>
            <div className="fc-jail__cells">
              {inCave.map((p) => {
                const m = game.mine[p.id];
                return (
                  <div key={p.id} className="fc-jail__who">
                    <AvatarImage avatar={avatars[p.id] ?? null} size={44} />
                    <span className="fc-jail__locks" aria-label={`${m?.jailRight ?? 0} of ${JAIL_RIGHT} right`}>
                      {Array.from({ length: JAIL_RIGHT }, (_, i) => <i key={i} className={i < (m?.jailRight ?? 0) ? 'on' : ''} />)}
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
      {!over && br && strikeActive && (
        <div className={`sb-banner ${struck ? 'sb-banner--hit' : ''}`} key={struck ? 'hit' : 'wait'}>
          {struck
            ? (
              <>
                <span style={!lucky && br.rolled.length === 1 ? { color: QUARTER_COLOURS[br.rolled[0]] } : undefined}>{calloutOf()}</span>
                {landed && (
                  <small>
                    {(r?.caught?.length ?? 0) === 0 ? 'Nobody caught!' : `${r?.caught?.length} off to the ${words.jail.toLowerCase()}`}
                    {boated.size ? ` · ⛵ ${boated.size} hid under a boat` : ''}{r && r.saved.length ? ` · 🛡️ ${r.saved.length} saved by a cage` : ''}
                  </small>
                )}
              </>
            )
            : <span>{br.style === 'spot' ? `Where will ${SHARK} snap?` : `${SHARK} is circling…`}</span>}
        </div>
      )}
      {over && <SharkFinish screen={screen} game={game} avatars={avatars} onAgain={onAgain} />}
    </div>
  );
}

/** The podium (names only when shown), safe rounds, and a few true shout-outs (Four Corners' finish, in Shark Bay words). */
function SharkFinish({ screen, game, avatars, onAgain }: { screen: ScreenView; game: CornersGame; avatars: Record<string, unknown>; onAgain: () => void }) {
  const top = podium(game, screen.people.map((p) => p.id));
  const byId = (id: string) => screen.people.find((p) => p.id === id);
  const ids = screen.people.map((p) => p.id);
  const m = (id: string) => game.mine[id] as (CornersMine & SharkMineExtra) | undefined;
  const bay = (game as SharkGame).bay;
  const names = (list: string[]) => {
    const n = list.map((id) => byId(id)?.name).filter(Boolean) as string[];
    return n.length > 2 ? `${n.slice(0, 2).join(', ')} and ${n.length - 2} more` : n.join(' and ');
  };
  /** The top pupils on a stat (ties share it); low: smallest wins. */
  const top1 = (f: (id: string) => number | undefined, low = false) => {
    let v: number | null = null;
    for (const id of ids) { const x = f(id); if (x !== undefined && x > 0 && (v === null || (low ? x < v : x > v))) v = x; }
    return v === null ? null : { v, who: ids.filter((id) => f(id) === v) };
  };
  const award = (emoji: string, title: string, f: (id: string) => number | undefined, say: (v: number) => string, low = false) => {
    const t = top1(f, low);
    return t ? { emoji, title, who: names(t.who), what: say(t.v) } : null;
  };
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const accuracy = (id: string) => {
    const r = m(id)?.right ?? 0;
    const w = m(id)?.wrong ?? 0;
    return r + w >= 5 ? Math.round((100 * r) / (r + w)) : undefined;
  };
  const untouched = ids.filter((id) => (m(id)?.caught ?? 0) === 0 && (m(id)?.safe ?? 0) > 0);
  const awards = screen.showNames ? [
    award('🍀', 'Luckiest', (id) => m(id)?.lucky, (v) => plural(v, 'lucky escape')),
    award('🎁', 'Power-up collector', (id) => m(id)?.grabs, (v) => `picked up ${v}`),
    award('⚡', 'Power player', (id) => m(id)?.powersUsed, (v) => `switched on ${v}`),
    award('⛵', 'Boat hider', (id) => m(id)?.boats, (v) => `hid under a boat ${plural(v, 'time')}`),
    award('🌀', `${BAY_WORDS[bay].teleport} traveller`, (id) => m(id)?.warps, (v) => plural(v, 'warp')),
    award('🧮', 'Maths whizz', (id) => m(id)?.right, (v) => plural(v, 'right answer')),
    award('🔥', 'Hot streak', (id) => ((m(id)?.bestStreak ?? 0) >= 3 ? m(id)?.bestStreak : undefined), (v) => `${v} right in a row`),
    award('⏱️', 'Fastest answer', (id) => m(id)?.fastMs, (v) => `${(v / 1000).toFixed(1)} seconds`, true),
    award('🎯', 'Sharpshooter', accuracy, (v) => `${v}% right`),
    award('🔓', 'Great escaper', (id) => m(id)?.escapes, (v) => `swam out ${plural(v, 'time')}`),
    award('🔑', 'Kind friend', (id) => m(id)?.freed, (v) => `freed ${v} from the cave`),
    award('🦸', 'Lone ranger', (id) => m(id)?.alone, (v) => `${plural(v, 'round')} with a quarter to themselves`),
    untouched.length > 0 && untouched.length < ids.length ? { emoji: '🛡️', title: 'Never caught', who: names(untouched), what: '' } : null,
  ].filter((x): x is { emoji: string; title: string; who: string; what: string } => !!x) : [];
  // Facts about the whole class (no names, so they show even with names off).
  const rolls = game.rolls ?? [0, 0, 0, 0];
  const most = Math.max(...rolls);
  const fav = most > 0 ? rolls.indexOf(most) : -1;
  const sum = (f: (id: string) => number | undefined) => ids.reduce((n, id) => n + (f(id) ?? 0), 0);
  const facts = [
    fav >= 0 && `🦈 ${SHARK} struck ${QUARTER_NAMES[fav]} most (${plural(most, 'time')})`,
    (game.caughtAll ?? 0) > 0 && `🦈 ${plural(game.caughtAll ?? 0, 'trip')} to the cave`,
    sum((id) => m(id)?.escapes) > 0 && `🔓 ${plural(sum((id) => m(id)?.escapes), 'escape')}`,
    sum((id) => m(id)?.right) > 0 && `🧮 ${plural(sum((id) => m(id)?.right), 'right answer')}`,
    sum((id) => m(id)?.powersUsed) > 0 && `⚡ ${plural(sum((id) => m(id)?.powersUsed), 'power-up')} switched on`,
    sum((id) => m(id)?.boats) > 0 && `⛵ ${plural(sum((id) => m(id)?.boats), 'boat save')}`,
    sum((id) => m(id)?.warps) > 0 && `🌀 ${plural(sum((id) => m(id)?.warps), BAY_WORDS[bay].teleport.toLowerCase())}`,
  ].filter(Boolean) as string[];
  const rounds = game.round?.n ?? 0;
  return (
    <div className="cl-finish fc-finish" role="dialog" aria-label="Finish">
      <h2 className="cl-finish__title">Shark Bay is over!</h2>
      <p className="cl-finish__sub">{rounds} {rounds === 1 ? 'round' : 'rounds'} in the {BAY_WORDS[bay].name}</p>
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
