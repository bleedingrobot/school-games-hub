/**
 * Shark Bay, the pupil's device (docs/SHARK-PLAN.md): Four Corners' pad on the round bay. A joystick (or arrow keys / WASD)
 * swims their own avatar at once (`sharkMove`: it stays in the water); the spot is saved about every 0.4 s (`link.move`),
 * and the other pupils come back as dots. Swimming over a power-up grabs it; holding one, a question in the water (off
 * the jetty) switches it on. In the Shark's Cave: three right answers to come back. The status line says which colour
 * you're in, warns about the jetty and counts boat seats. Never shows anyone else's results.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { AvatarImage } from '../../avatar/AvatarImage';
import { AVATAR_R, GRAB_R, JAIL_RIGHT, startSpot, type MoveState, type Spot, type Corner, type Power } from '../../../shared/classlive/corners';
import {
  BAY_WORDS, BOAT_R, boatAt, CENTRE, DOCK_R, QUARTER_NAMES, quarterOf, SHARK_POWER_WORDS, sharkMove, spinAt, type BayRound,
} from '../../../shared/classlive/shark';
import type { PlayerView, RoomView } from '../../../shared/classlive/server';
import type { PublicQuestion } from '../../../shared/maths/serverQuestions';
import { QuestionModal, type MarkedAnswer } from '../../maths/QuestionModal';
import { Token } from './CornersBoard';
import { QUARTER_COLOURS, SharkBoard, sharkPowerPic } from './SharkBoard';
import type { ClassLiveLink } from './link';
import './controller.css';
import './shark.css';

type Mine = Extract<PlayerView['game'], { kind: 'corners' }>;
type Pub = Extract<RoomView['game'], { kind: 'corners' }>;
const SEND_MS = 400;
/** Seats are counted a little wider than BOAT_R, as the server does (BOAT_R + AVATAR_R * 0.5). */
const SEAT_R = BOAT_R + 0.0175;
const dist = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.y - b.y);
const factOf = (q: PublicQuestion, answer: number) => q.parts.map((p) => p.replace(/\?/g, String(answer))).join(' ');

/** Arrow keys and WASD. */
function useKeys() {
  const keys = useRef(new Set<string>());
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
        // Not while typing an answer.
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        keys.current.add(k);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, []);
  return useCallback((): Spot => {
    const k = keys.current;
    const x = (k.has('arrowright') || k.has('d') ? 1 : 0) - (k.has('arrowleft') || k.has('a') ? 1 : 0);
    const y = (k.has('arrowdown') || k.has('s') ? 1 : 0) - (k.has('arrowup') || k.has('w') ? 1 : 0);
    const len = Math.hypot(x, y);
    return len ? { x: x / len, y: y / len } : { x: 0, y: 0 };
  }, []);
}

/** The on-screen joystick: drag the knob; its pull (0 to 1) is the direction. */
function Joystick({ onDir }: { onDir: (d: Spot) => void }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState<Spot>({ x: 0, y: 0 });
  const active = useRef<number | null>(null);
  const move = (e: ReactPointerEvent) => {
    const el = base.current;
    if (!el || active.current !== e.pointerId) return;
    const b = el.getBoundingClientRect();
    const r = b.width / 2;
    let dx = (e.clientX - (b.left + r)) / r;
    let dy = (e.clientY - (b.top + r)) / r;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    const dead = Math.hypot(dx, dy) < 0.15;
    setKnob({ x: dx, y: dy });
    onDir(dead ? { x: 0, y: 0 } : { x: dx, y: dy });
  };
  const end = () => { active.current = null; setKnob({ x: 0, y: 0 }); onDir({ x: 0, y: 0 }); };
  return (
    <div
      ref={base}
      className="fc-stick"
      role="application"
      aria-label="Joystick: drag to run. Arrow keys work too."
      onPointerDown={(e) => { active.current = e.pointerId; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); move(e); }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="fc-stick__knob" style={{ transform: `translate(${knob.x * 60}%, ${knob.y * 60}%)` }} />
    </div>
  );
}

export function SharkPad({ link, room, view, me, setMe, setView, clock, avatar }: {
  link: ClassLiveLink; room: number | null; view: RoomView; me: PlayerView | null;
  setMe: (m: PlayerView) => void; setView: (f: (v: RoomView | null) => RoomView | null) => void;
  /** The server's time now (ms). */
  clock: () => number;
  /** The pupil's own hub avatar. */
  avatar?: unknown;
}) {
  const pub: Pub | null = view.game.kind === 'corners' ? view.game : null;
  const mg: Mine | null = me && me.game.kind === 'corners' ? me.game : null;
  const r = pub?.round ?? null;
  // The public round carries the bay's spin and boats too.
  const br = r as unknown as (BayRound & { ended: boolean; caught: number }) | null;
  const keysDir = useKeys();
  const stickDir = useRef<Spot>({ x: 0, y: 0 });
  const pos = useRef<MoveState>({ p: mg?.spot ?? startSpot(0), v: { x: 0, y: 0 } });
  const placed = useRef<number>(-1);
  const others = useRef<Spot[]>([]);
  const lastSent = useRef(0);
  const sentAt = useRef<Spot | null>(null);
  const grabbing = useRef<number | null>(null);
  const [, setFrame] = useState(0);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [purpose, setPurpose] = useState<'jail' | 'power' | null>(null);
  const [say, setSay] = useState<{ n: number; text: string; good?: boolean } | null>(null);
  const [shake, setShake] = useState(0);
  const sayN = useRef(0);
  const asking = useRef(false);
  const pendingMe = useRef<{ me?: PlayerView; view?: RoomView } | null>(null);
  const toast = useCallback((text: string, good?: boolean) => setSay({ n: ++sayN.current, text, good }), []);
  const bay = pub?.bay ?? 'lagoon';

  const tNow = () => (view.startedAt === null ? 0 : clock() - view.startedAt);

  // Snap to where the server put us (start, back from the cave, a jet ski).
  if (mg && mg.placed !== placed.current) {
    placed.current = mg.placed;
    pos.current = { p: { ...mg.spot }, v: { x: 0, y: 0 } };
  }

  const jailed = !!mg?.jailed;
  const canRun = !!r && !jailed && view.state === 'live' && !r.ended;

  // Swim every frame; save the spot every 0.4 s (and right away after a whirlpool).
  useEffect(() => {
    if (room === null) return;
    let id = 0;
    let last = performance.now();
    const loop = (ts: number) => {
      const dt = ts - last;
      last = ts;
      const t = tNow();
      if (canRun && r && t >= r.startAt && t < r.runEnd) {
        const k = keysDir();
        const dir = k.x || k.y ? k : stickDir.current;
        const before = pos.current.p;
        const hitBefore = pos.current.hitAt;
        pos.current = sharkMove(pos.current, dir, dt, r, t, { boost: !!mg?.boost, ghost: !!mg?.ghost });
        if (pos.current.hitAt !== undefined && pos.current.hitAt !== hitBefore) {
          toast(`💥 The ${BAY_WORDS[bay].roller.toLowerCase()} knocked you flying!`);
          try { navigator.vibrate?.(200); } catch { /* not on this device */ }
          setShake(Date.now());
        }
        const warped = Math.hypot(pos.current.p.x - before.x, pos.current.p.y - before.y) > 0.2;
        const moved = !sentAt.current || Math.hypot(pos.current.p.x - sentAt.current.x, pos.current.p.y - sentAt.current.y) > 0.002;
        const now = Date.now();
        if ((moved && now - lastSent.current >= SEND_MS) || warped || (now - lastSent.current > 2000)) {
          lastSent.current = now;
          sentAt.current = { ...pos.current.p };
          const p = pos.current.p;
          void link.move(room, p.x, p.y).then((all) => {
            if (all) others.current = all;
            if (warped) void link.send({ action: 'play', room, warp: true }).catch(() => undefined);
          }, () => undefined);
        }
        // Swim over a power-up to grab it.
        if (!mg?.held && grabbing.current === null) {
          const it = r.items.find((x) => Math.hypot(x.x - pos.current.p.x, x.y - pos.current.p.y) < GRAB_R + AVATAR_R);
          if (it) {
            grabbing.current = it.id;
            const p = pos.current.p;
            void link.move(room, p.x, p.y).then(() => link.send({ action: 'play', room, grab: it.id })).then((out) => {
              const b = out.body as { me?: PlayerView; view?: RoomView; error?: string };
              if (b.me) setMe(b.me);
              if (b.view) setView(() => b.view as RoomView);
              if (out.status === 200 && b.me?.game.kind === 'corners' && b.me.game.held) {
                const w = SHARK_POWER_WORDS[b.me.game.held];
                toast(`${w.emoji} Got a ${w.name}! Answer a question in the water to switch it on.`, true);
              }
            }, () => undefined).finally(() => { window.setTimeout(() => { grabbing.current = null; }, 600); });
          }
        }
      } else if (canRun && r && t >= r.runEnd && sentAt.current && Math.hypot(pos.current.p.x - sentAt.current.x, pos.current.p.y - sentAt.current.y) > 0.001 && Date.now() - lastSent.current > 120) {
        // The run is over: save the last spot once (the server reads spots a moment after the end).
        lastSent.current = Date.now();
        sentAt.current = { ...pos.current.p };
        void link.move(room, pos.current.p.x, pos.current.p.y).then((all) => { if (all) others.current = all; }, () => undefined);
      }
      setFrame((f) => (f + 1) % 1_000_000);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, canRun, r, mg?.boost, mg?.ghost, mg?.held, link]);

  // A question when one is due: in the cave (until 3 right), or holding a power-up while in the water (off the jetty).
  const t = tNow();
  const offJetty = dist(pos.current.p, CENTRE) >= DOCK_R;
  const wantQuestion = view.state === 'live' && !!r && (jailed ? (mg?.jailRight ?? 0) < JAIL_RIGHT : !!mg?.held && offJetty && t < r.runEnd - 600 && !r.ended);
  // Bumped to ask again after an ask that brought no question (a busy server, a dropped connection).
  const [askAgain, setAskAgain] = useState(0);
  useEffect(() => {
    if (!wantQuestion || question || asking.current || room === null) return;
    asking.current = true;
    const p = pos.current.p;
    let got = false;
    const go = async () => {
      if (!jailed) await link.move(room, p.x, p.y).catch(() => null);
      const out = await link.send({ action: 'ask', room });
      const b = out.body as { question?: PublicQuestion; purpose?: 'jail' | 'power' };
      if (out.status === 200 && b.question) { got = true; setQuestion(b.question); setPurpose(b.purpose ?? null); }
    };
    void go().catch(() => undefined).finally(() => {
      window.setTimeout(() => { asking.current = false; if (!got) setAskAgain((n) => n + 1); }, got ? 600 : 2000);
    });
  }, [wantQuestion, question, room, link, jailed, askAgain]);
  // A power-up question goes away if the pupil is back on the jetty, the run ends or they are caught; a cave question
  // goes once they are out.
  useEffect(() => {
    if (question && ((purpose === 'power' && (!wantQuestion || jailed)) || (purpose === 'jail' && !jailed))) { setQuestion(null); setPurpose(null); }
  }, [question, purpose, wantQuestion, jailed]);

  const onSubmit = async (value: number, ms: number): Promise<MarkedAnswer> => {
    const q = question as PublicQuestion;
    let out;
    try {
      out = await link.send({ action: 'answer', room, slot: q.slot, answer: value, ms });
    } catch {
      throw new Error('We lost the connection. Try again.');
    }
    const b = out.body as { right?: boolean; answer?: number; me?: PlayerView; view?: RoomView; question?: PublicQuestion; error?: string; reason?: string };
    if (out.status !== 200) {
      if (b.reason === 'answered' || b.reason === 'not_now') { setQuestion(null); setPurpose(null); }
      throw new Error(String(b.error ?? 'Try again.'));
    }
    pendingMe.current = { me: b.me, view: b.view };
    return { correct: b.right === true, fact: factOf(q, b.answer as number), boxBefore: 0, boxAfter: 0, answer: b.answer as number };
  };
  const onDone = () => {
    const was = mg;
    const next = pendingMe.current;
    pendingMe.current = null;
    if (next?.me) setMe(next.me);
    if (next?.view) setView(() => next.view as RoomView);
    setQuestion(null);
    setPurpose(null);
    const now = next?.me?.game.kind === 'corners' ? next.me.game : null;
    if (now && was?.held && !now.held) toast(`${SHARK_POWER_WORDS[was.held].emoji} ${SHARK_POWER_WORDS[was.held].name} is on! ${SHARK_POWER_WORDS[was.held].how}`, true);
    else if (now && now.jailed && now.jailRight > (was?.jailRight ?? 0)) toast(now.jailRight >= JAIL_RIGHT ? '🔓 Free! You come back next round.' : `🔑 ${now.jailRight} of ${JAIL_RIGHT}!`, true);
  };

  // What just happened at the strike: caught, safe, or saved by a boat.
  const roundN = r?.n ?? 0;
  const told = useRef('');
  useEffect(() => {
    if (!r || !r.ended || r.rolled === null || !mg) return;
    const key = `${r.n}`;
    if (told.current === key) return;
    told.current = key;
    const n = br?.caught ?? r.caught;
    const count = n > 0 ? ` ${n} ${n === 1 ? 'swimmer was' : 'swimmers were'} caught.` : ' Nobody was caught!';
    if (mg.caughtLast) toast(`🦈 Caught by Chomper! Off to the ${BAY_WORDS[bay].jail}. Answer ${JAIL_RIGHT} questions to come back.${count}`);
    else if (mg.savedLast) toast(`🛡️ Your Shark cage saved you!${count}`, true);
    else if (!mg.jailed) {
      const p = pos.current.p;
      const inBoat = !!br && br.boats.some((b) => dist(p, boatAt(b, br, br.runEnd)) < SEAT_R);
      const q = br ? quarterOf(p, spinAt(br, br.runEnd)) : null;
      const exposed = q === null || r.rolled.includes(q);
      toast(inBoat && exposed ? `⛵ The ${BAY_WORDS[bay].boat.toLowerCase()} saved you!${count}` : `✅ Safe!${count}`, true);
    }
  }, [r, br, mg, bay, toast]);

  const jump = async (c: Corner) => {
    if (room === null) return;
    const out = await link.send({ action: 'play', room, jump: c }).catch(() => null);
    const b = out?.body as { me?: PlayerView; view?: RoomView } | undefined;
    if (b?.me) setMe(b.me);
    if (b?.view) setView(() => b.view as RoomView);
  };

  if (!pub || !mg) return <div className="cl-c-center"><p className="cl-c-say">Getting ready…</p></div>;
  const words = BAY_WORDS[bay];

  if (view.state === 'lobby') {
    return (
      <div className="cl-c-center fc-pad-lobby">
        <h1 className="cl-c-title">You're in! Look at the big screen.</h1>
        <div className="fc-pad-me"><AvatarImage avatar={avatar ?? null} size={120} /></div>
        <p className="cl-c-say">Use the joystick (or the arrow keys) to swim off the {words.dock.toLowerCase()} and into a colour before the countdown ends. Don't get caught by Chomper!</p>
        <p className="cl-c-say">Today's bay: <b>{words.name}</b></p>
      </div>
    );
  }
  if (view.state === 'over') {
    const boats = (mg.stats as typeof mg.stats & { boats?: number } | undefined)?.boats ?? 0;
    return (
      <div className="cl-c-center">
        <h1 className="cl-c-title">{mg.place === 1 ? '🏆 You won!' : mg.place ? `🥈 Podium place ${mg.place}!` : 'Finished!'}</h1>
        <div className="fc-pad-me"><AvatarImage avatar={avatar ?? null} size={110} /></div>
        <p className="cl-c-say">You were safe {mg.safe} {mg.safe === 1 ? 'round' : 'rounds'}{mg.score > mg.safe ? ` and scored ${mg.score} with Pearls` : ''}.</p>
        {mg.stats && (
          <ul className="fc-pad-stats">
            {([
              ['🧮', mg.stats.right, 'right answers'],
              ['🔥', mg.stats.bestStreak, 'in a row, best'],
              ['🎁', mg.stats.grabs, 'power-ups picked up'],
              ['⚡', mg.stats.powers, 'switched on'],
              ['🌀', mg.stats.warps, `${words.teleport.toLowerCase()} rides`],
              ['⛵', boats, 'saved by a boat'],
              ['🍀', mg.stats.lucky, 'lucky escapes'],
              ['🔓', mg.stats.escapes, 'cave escapes'],
            ] as const).filter(([, n]) => n > 0).map(([e, n, w]) => <li key={w}><span aria-hidden="true">{e}</span> <b>{n}</b> {w}</li>)}
          </ul>
        )}
        <p className="cl-c-look">Look at the big screen!</p>
      </div>
    );
  }

  const left = r && !r.ended ? Math.max(0, Math.ceil((r.runEnd - t) / 1000)) : null;
  const fogged = !!r?.fog && r && (t - r.startAt) / Math.max(1, r.runEnd - r.startAt) > 0.45;
  const questionBox = question && (
    <div className={`fc-q ${purpose === 'jail' ? 'fc-q--jail' : ''}`}>
      <QuestionModal
        key={question.slot}
        question={{ id: question.slot, parts: question.parts, spoken: question.spoken, prompt: question.prompt, choices: question.choices, choiceLabels: question.choiceLabels, input: question.input, maxLength: question.maxLength }}
        title={purpose === 'jail' ? `Get out of the ${words.jail}` : `Switch on ${mg.held ? SHARK_POWER_WORDS[mg.held].name : 'your power-up'}`}
        note={purpose === 'jail' ? `${mg.jailRight} of ${JAIL_RIGHT} right` : 'Answer right to switch it on'}
        spot="Shark Bay" inline scribble={false} onSubmit={onSubmit} onDone={onDone}
      />
    </div>
  );
  const toastBox = (
    <div className="cl-c-fb fc-fb" aria-live="polite">
      {say && <div key={say.n} className={`cl-s-card${say.good ? ' cl-s-card--right' : ''}`}><p className="cl-s-card__text">{say.text}</p></div>}
    </div>
  );

  if (jailed) {
    return (
      <div className="fc-pad fc-pad--jail">
        <header className="fc-pad__top"><b>🔒 {words.jail}</b><span>Round {roundN}</span></header>
        <div className="fc-pad-me fc-pad-me--jail"><AvatarImage avatar={avatar ?? null} size={96} /><span className="fc-bars" aria-hidden="true" /></div>
        <div className="fc-locks" aria-label={`${mg.jailRight} of ${JAIL_RIGHT} right`}>
          {Array.from({ length: JAIL_RIGHT }, (_, i) => <i key={i} className={i < mg.jailRight ? 'on' : ''}>{i < mg.jailRight ? '🔓' : '🔒'}</i>)}
        </div>
        {mg.jailRight >= JAIL_RIGHT ? (
          <div className="fc-free" role="status">
            <b className="fc-free__word">🔓 You're free!</b>
            {mg.freeAt != null && mg.freeAt > t
              ? <><span className="fc-free__count" key={Math.ceil((mg.freeAt - t) / 1000)}>{Math.ceil((mg.freeAt - t) / 1000)}</span><span className="fc-free__say">seconds until you're back in the water</span></>
              : <span className="fc-free__say">Coming back now. Get ready to swim!</span>}
          </div>
        ) : <p className="cl-c-say">{`Answer ${JAIL_RIGHT - mg.jailRight} more right to come back.`}</p>}
        {toastBox}
        {questionBox}
      </div>
    );
  }

  const here = pos.current.p;
  const running = !!br && !br.ended && t >= br.startAt && t < br.runEnd;

  // Seats left on each boat: the other spots we can see, nearest first (as the server seats them).
  const seatsLeft: Record<number, number> = {};
  let under: { boat: number; free: number } | null = null;
  if (br) {
    for (const b of br.boats) {
      const at = boatAt(b, br, Math.min(t, br.runEnd));
      const near = others.current.filter((o) => dist(o, at) < SEAT_R);
      seatsLeft[b.id] = Math.max(0, b.seats - near.length);
      const d = dist(here, at);
      if (d < BOAT_R && (!under || d < dist(here, boatAt(br.boats.find((x) => x.id === under?.boat) ?? b, br, Math.min(t, br.runEnd))))) {
        under = { boat: b.id, free: b.seats - near.filter((o) => dist(o, at) < d).length };
      }
    }
  }
  const quarter = br && !br.ended ? quarterOf(here, spinAt(br, Math.min(t, br.runEnd))) : null;
  let status: { text: string; tone: 'info' | 'warn' | 'good' } | null = null;
  if (running && br) {
    if (left !== null && left <= 3 && quarter === null) status = { text: `On the ${words.dock.toLowerCase()}! Swim off!`, tone: 'warn' };
    else if (under) status = under.free > 0 ? { text: `Under the boat! ${under.free} ${under.free === 1 ? 'seat' : 'seats'}`, tone: 'good' } : { text: 'Under the boat, but it is full! Swim closer to the middle', tone: 'warn' };
    else if (quarter === null) status = { text: `You're on the ${words.dock.toLowerCase()}. Swim into a colour!`, tone: 'info' };
    else status = { text: `You're in ${QUARTER_NAMES[quarter]}`, tone: 'info' };
  } else if (br && !br.ended && t < br.startAt) status = { text: 'Get ready to swim!', tone: 'info' };

  return (
    <div className="fc-pad fc-pad--run">
      <header className="fc-pad__top">
        <span>Round {roundN}</span>
        {left !== null ? <b className={`fc-pad__left ${left <= 3 ? 'is-low' : ''}`}>{left}</b> : <b>🦈 Look at the big screen!</b>}
        <span>{r?.ended && r.rolled === null ? '🦈' : `✅ ${mg.safe}`}</span>
      </header>
      {status && (
        <p className={`sb-pad__status sb-pad__status--${status.tone}`} role="status" style={quarter !== null && status.tone === 'info' ? { ['--qc' as string]: QUARTER_COLOURS[quarter] } : undefined}>
          {status.text}
        </p>
      )}
      <div className="fc-pad__powers">
        {mg.held && (
          <PowerCard power={mg.held} state="held" text={`In your pocket! Swim off the ${words.dock.toLowerCase()} and answer a question to switch it on. ${SHARK_POWER_WORDS[mg.held].how}`} />
        )}
        {mg.shield && <PowerCard power="shield" state="on" text="Chomper can't catch you this round." />}
        {mg.boost && <PowerCard power="speed" state="on" text={`You swim faster: ${(mg.speedLeft ?? 1) > 1 ? `this round and ${(mg.speedLeft ?? 1) - 1} more` : 'last round of it'}.`} />}
        {mg.ghost && <PowerCard power="ghost" state="on" text={`You swim straight through hazards${(mg.ghostLeft ?? 1) > 1 ? ' this round and next' : ' this round'}.`} />}
        {mg.double && <PowerCard power="double" state="on" text="Be safe this round to score 2 points." />}
        {mg.jump && canRun && <PowerCard power="jump" state="on" text="Tap a colour name on the board to zoom straight there!" />}
        {mg.crystal !== null && <PowerCard power="crystal" state="on" text={`${QUARTER_NAMES[mg.crystal]} is safe this round. Swim there!`} />}
        {mg.stay != null && r && !r.ended && <span className="fc-chip fc-chip--swap">🔁 Change colour! Not {QUARTER_NAMES[mg.stay]}</span>}
      </div>
      <div className={`fc-pad__board ${Date.now() - shake < 500 ? 'fc-pad__board--hit' : ''}`}>
        <SharkBoard map={bay} round={br} t={t} flash={r?.ended && r.rolled ? r.rolled : null} periscope={mg.crystal} fogOn={false} seatsLeft={seatsLeft} onQuarter={mg.jump && canRun ? (c) => void jump(c) : undefined}>
          {!fogged && others.current.map((o, i) => <span key={i} className="fc-dot" style={{ left: `${o.x * 100}%`, top: `${o.y * 100}%` }} />)}
          <Token x={here.x} y={here.y} size={AVATAR_R * 2.2} className={`fc-token--me ${mg.shield ? 'fc-token--shield' : ''} ${mg.boost ? 'fc-token--fast' : ''} ${mg.ghost ? 'fc-token--ghost' : ''}`} label="You">
            <AvatarImage avatar={avatar ?? null} size={64} />
          </Token>
        </SharkBoard>
        {mg.jump && canRun && <p className="fc-pad__hint">🚤 Tap a colour to zoom there!</p>}
      </div>
      {toastBox}
      {questionBox}
      {canRun && !question && <Joystick onDir={(d) => { stickDir.current = d; }} />}
    </div>
  );
}

/** A power-up the pupil carries or has switched on, big and plain. */
function PowerCard({ power, state, text }: { power: Power; state: 'held' | 'on'; text: string }) {
  const pic = sharkPowerPic(power);
  const w = SHARK_POWER_WORDS[power];
  return (
    <div className={`fc-power fc-power--${state}`} role="status">
      {pic ? <img className="fc-power__pic" src={pic} alt="" /> : <span className="fc-power__pic fc-power__pic--emoji" aria-hidden="true">{w.emoji}</span>}
      <span className="fc-power__words">
        <b>{state === 'on' ? `${w.name} ON` : w.name}</b>
        <span>{text}</span>
      </span>
    </div>
  );
}
