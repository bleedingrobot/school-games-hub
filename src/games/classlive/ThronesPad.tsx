/**
 * Musical Thrones, the pupil's device (docs/THRONES-PLAN.md): a joystick (or arrow keys / WASD) moves their own avatar
 * at once; the spot is saved about every 0.4 s (`link.move`) and the other pupils come back as dots (no names). While the
 * music plays they dance, grab power-ups and (with a held one) answer a question to switch it on. When the music stops
 * the pad flashes STOP and sits the pupil on a throne they run onto. Left standing: the courtyard, three right answers
 * to come back. Never shows anyone else's results, and never the time the music stops.
 *
 * Times: the room's rounds are in session time (ms since the start); `clock()` is the server's time now.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { AvatarImage } from '../../avatar/AvatarImage';
import { AVATAR_R, GRAB_R, startSpot, stepMove, type MoveState, type Spot } from '../../../shared/classlive/corners';
import type { PlayerView, RoomView } from '../../../shared/classlive/server';
import { COURT_RIGHT, HALL_WORDS, moveRound, POWER_WORDS, SIT_R, type ThroneRound, type ThronePower } from '../../../shared/classlive/thrones';
import type { PublicQuestion } from '../../../shared/maths/serverQuestions';
import { QuestionModal, type MarkedAnswer } from '../../maths/QuestionModal';
import type { ClassLiveLink } from './link';
import { ThronesBoard, thronePowerPic, Token } from './ThronesBoard';
import { ThronesGuide } from './ThronesGuide';
import './controller.css';
import './thrones.css';

type Mine = Extract<PlayerView['game'], { kind: 'thrones' }>;
type Pub = Extract<RoomView['game'], { kind: 'thrones' }>;
const SEND_MS = 400;
const factOf = (q: PublicQuestion, answer: number) => q.parts.map((p) => p.replace(/\?/g, String(answer))).join(' ');
const dist = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.y - b.y);
const buzz = (pattern: number | number[]) => { try { navigator.vibrate?.(pattern); } catch { /* not on this device */ } };

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

type Flash = { key: number; kind: 'stop' | 'ear' | 'got'; text: string };

export function ThronesPad({ link, room, view, me, setMe, setView, clock, avatar }: {
  link: ClassLiveLink; room: number | null; view: RoomView; me: PlayerView | null;
  setMe: (m: PlayerView) => void; setView: (f: (v: RoomView | null) => RoomView | null) => void;
  /** The server's time now (ms). */
  clock: () => number;
  /** The pupil's own hub avatar. */
  avatar?: unknown;
}) {
  const pub: Pub | null = view.game.kind === 'thrones' ? view.game : null;
  const mg: Mine | null = me && me.game.kind === 'thrones' ? me.game : null;
  const r = pub?.round ?? null;
  const keysDir = useKeys();
  const stickDir = useRef<Spot>({ x: 0, y: 0 });
  const pos = useRef<MoveState>({ p: mg?.spot ?? startSpot(0), v: { x: 0, y: 0 } });
  const placed = useRef<number>(-1);
  const others = useRef<Spot[]>([]);
  const lastSent = useRef(0);
  const sentAt = useRef<Spot | null>(null);
  const grabbing = useRef<number | null>(null);
  const sitting = useRef<number | null>(null);
  /** Thrones this pupil found taken (or gone) this round, so the pad stops running at them. */
  const refused = useRef<{ n: number; ids: Set<number> }>({ n: 0, ids: new Set() });
  const flashed = useRef<{ stop: number; ear: number }>({ stop: -1, ear: -1 });
  const [, setFrame] = useState(0);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [purpose, setPurpose] = useState<'court' | 'power' | null>(null);
  const [wantPower, setWantPower] = useState(false);
  const [say, setSay] = useState<{ n: number; text: string; good?: boolean } | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [guide, setGuide] = useState(false);
  const [shake, setShake] = useState(0);
  const sayN = useRef(0);
  const flashN = useRef(0);
  const asking = useRef(false);
  const pendingMe = useRef<{ me?: PlayerView; view?: RoomView } | null>(null);
  const toast = useCallback((text: string, good?: boolean) => setSay({ n: ++sayN.current, text, good }), []);
  const showFlash = useCallback((kind: Flash['kind'], text: string, ms: number) => {
    const key = ++flashN.current;
    setFlash({ key, kind, text });
    window.setTimeout(() => setFlash((f) => (f && f.key === key ? null : f)), ms);
  }, []);

  const tNow = () => (view.startedAt === null ? 0 : clock() - view.startedAt);
  const t = tNow();

  // Snap to where the server put us (start, onto a throne, knocked off one, back from the courtyard).
  if (mg && mg.placed !== placed.current) {
    placed.current = mg.placed;
    pos.current = { p: { ...mg.spot }, v: { x: 0, y: 0 } };
  }
  if (r && refused.current.n !== r.n) refused.current = { n: r.n, ids: new Set() };

  const phase = !r ? 'ready' : t < r.musicEnd ? 'music' : t < r.scrambleEnd ? 'scramble' : 'show';
  const court = !!mg?.court;
  const seated = mg?.seat != null;
  const canRun = !!r && !!mg && !court && !seated && view.state === 'live' && (phase === 'music' || phase === 'scramble') && t >= r.startAt;

  // The latest of everything the frame loop reads (so the loop is set up once).
  const live = useRef({ r, mg, pub, view, canRun, tNow });
  live.current = { r, mg, pub, view, canRun, tNow };

  const act = useCallback(async (body: Record<string, unknown>) => {
    const out = await link.send(body);
    const b = out.body as { me?: PlayerView; view?: RoomView; error?: string; reason?: string };
    if (b.me) setMe(b.me);
    if (b.view) setView(() => b.view as RoomView);
    return { status: out.status, error: b.error, reason: b.reason, me: b.me };
  }, [link, setMe, setView]);

  // Move every frame; save the spot every 0.4 s; sit, grab and flash when the moment comes.
  useEffect(() => {
    if (room === null) return;
    let id = 0;
    let last = performance.now();
    const loop = (ts: number) => {
      const dt = ts - last;
      last = ts;
      const { r: rd, mg: m, pub: pb, view: vw, canRun: run, tNow: now } = live.current;
      const tt = now();
      if (rd && m && pb && vw.state === 'live') {
        // The music stops (the pad flashes, buzzes, and the pupil may sit); a Golden ear warns a moment before.
        if (!m.court && tt >= rd.musicEnd && tt < rd.musicEnd + 1500 && flashed.current.stop !== rd.n) {
          flashed.current.stop = rd.n;
          showFlash('stop', 'STOP! SIT!', 1400);
          buzz([250, 80, 250]);
        }
        if (m.earAt !== null && !m.court && tt >= m.earAt && tt < rd.musicEnd && flashed.current.ear !== rd.n) {
          flashed.current.ear = rd.n;
          showFlash('ear', '👂 The music is about to stop!', 1800);
          buzz([100, 60, 100, 60, 100]);
        }
      }
      if (run && rd && m && pb) {
        const mr = moveRound(rd as unknown as ThroneRound);
        const k = keysDir();
        const dir = k.x || k.y ? k : stickDir.current;
        const hitBefore = pos.current.hitAt;
        pos.current = stepMove(pos.current, dir, dt, mr, tt, { boost: m.boost, ghost: m.ghost });
        if (pos.current.hitAt !== undefined && pos.current.hitAt !== hitBefore) {
          toast(`💥 The ${HALL_WORDS[pb.hall].roller.toLowerCase()} knocked you flying!`);
          buzz(200);
          setShake(Date.now());
        }
        const here = pos.current.p;
        const moved = !sentAt.current || dist(here, sentAt.current) > 0.002;
        const warped = sentAt.current !== null && dist(here, sentAt.current) > 0.2;
        const nowMs = Date.now();
        if ((moved && nowMs - lastSent.current >= SEND_MS) || warped || nowMs - lastSent.current > 2000) {
          lastSent.current = nowMs;
          sentAt.current = { ...here };
          void link.move(room, here.x, here.y).then((all) => { if (all) others.current = all; }, () => undefined);
        }
        // Run over a power-up to grab it (music only).
        if (tt < rd.musicEnd && !m.held && grabbing.current === null) {
          const it = rd.items.find((x) => dist(x, here) < GRAB_R + AVATAR_R);
          if (it) {
            grabbing.current = it.id;
            void link.move(room, here.x, here.y)
              .then(() => act({ action: 'play', room, grab: it.id }))
              .then((out) => {
                if (out.status === 200 && out.me?.game.kind === 'thrones' && out.me.game.held) {
                  const p = POWER_WORDS[out.me.game.held];
                  toast(`${p.emoji} Got a ${p.name}! Press “Switch on” and answer a question while the music plays.`, true);
                }
              }, () => undefined)
              .finally(() => { window.setTimeout(() => { grabbing.current = null; }, 600); });
          }
        }
        // Sit on a throne: after the music stops, on a free one (or a taken one with a Crown thief ready).
        if (tt >= rd.musicEnd && sitting.current === null) {
          const th = rd.thrones.find((x) => dist(x, here) < SIT_R && !refused.current.ids.has(x.id) && (!x.taken || m.steal));
          if (th) {
            sitting.current = th.id;
            // Save the spot first, so the server sees we're there.
            void link.move(room, here.x, here.y)
              .then(() => act({ action: 'play', room, sit: th.id }))
              .then((out) => {
                if (out.status !== 200) {
                  if (out.reason === 'taken' || out.reason === 'gone') refused.current.ids.add(th.id);
                  if (out.reason !== 'seated' && out.reason !== 'not_now') toast(out.error ?? 'Someone got there first!');
                }
              }, () => undefined)
              .finally(() => { window.setTimeout(() => { sitting.current = null; }, 450); });
          }
        }
      } else if (rd && m && !m.court && m.seat === null && sentAt.current && tt >= rd.musicEnd && dist(pos.current.p, sentAt.current) > 0.001 && Date.now() - lastSent.current > 120 && vw.state === 'live') {
        // The scramble is over: save the last spot once.
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
  }, [room, link]);

  // Sat on a throne: say so, big.
  const seatNow = mg?.seat ?? null;
  const seatWas = useRef<number | null>(null);
  useEffect(() => {
    if (seatNow !== null && seatWas.current === null) {
      const golden = !!pub?.round?.thrones.find((x) => x.id === seatNow)?.golden;
      showFlash('got', golden ? '👑 You got the GOLDEN throne! 3 crowns!' : '👑 You got a throne!', 2200);
      buzz(120);
    }
    seatWas.current = seatNow;
  }, [seatNow, pub?.round?.thrones, showFlash]);

  // A question when one is due: in the courtyard (until 3 right), or a held power-up the pupil chose to switch on.
  const music = phase === 'music';
  const wantQuestion = view.state === 'live' && !!r && (court ? (mg?.courtRight ?? 0) < COURT_RIGHT : wantPower && !!mg?.held && music && !seated);
  // Bumped to ask again after an ask that brought no question (a busy server, a dropped connection).
  const [askAgain, setAskAgain] = useState(0);
  useEffect(() => {
    if (!wantQuestion || question || asking.current || room === null) return;
    asking.current = true;
    let got = false;
    const go = async () => {
      const out = await link.send({ action: 'ask', room });
      const b = out.body as { question?: PublicQuestion; purpose?: 'court' | 'power' };
      if (out.status === 200 && b.question) { got = true; setQuestion(b.question); setPurpose(b.purpose ?? null); }
      else if (!court) setWantPower(false);
    };
    void go().catch(() => undefined).finally(() => {
      window.setTimeout(() => { asking.current = false; if (!got && court) setAskAgain((n) => n + 1); }, got ? 600 : 2000);
    });
  }, [wantQuestion, question, room, link, court, askAgain]);
  // A power-up question goes away when the music stops (or the power-up is gone); a courtyard one once they are out.
  useEffect(() => {
    if (question && ((purpose === 'power' && (!music || !mg?.held || court)) || (purpose === 'court' && !court))) { setQuestion(null); setPurpose(null); setWantPower(false); }
  }, [question, purpose, music, mg?.held, court]);

  const onSubmit = async (value: number, ms: number): Promise<MarkedAnswer> => {
    const q = question as PublicQuestion;
    let out;
    try {
      out = await link.send({ action: 'answer', room, slot: q.slot, answer: value, ms });
    } catch {
      throw new Error('We lost the connection. Try again.');
    }
    const b = out.body as { right?: boolean; answer?: number; me?: PlayerView; view?: RoomView; error?: string; reason?: string };
    if (out.status !== 200) {
      if (b.reason === 'answered' || b.reason === 'not_now') { setQuestion(null); setPurpose(null); setWantPower(false); }
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
    setWantPower(false);
    const now = next?.me?.game.kind === 'thrones' ? next.me.game : null;
    if (now && was?.held && !now.held) toast(`${POWER_WORDS[was.held].emoji} ${POWER_WORDS[was.held].name} is on! ${POWER_WORDS[was.held].how}`, true);
    else if (now && now.court && now.courtRight > (was?.courtRight ?? 0)) toast(now.courtRight >= COURT_RIGHT ? '🔓 Free! You come back soon.' : `🔑 ${now.courtRight} of ${COURT_RIGHT}!`, true);
  };

  // What just happened at the end of a round.
  const told = useRef('');
  useEffect(() => {
    if (!r || !mg || r.standing === null) return;
    const key = `${r.n}`;
    if (told.current === key) return;
    told.current = key;
    if (mg.stoodLast) toast(`🔒 No throne! Off to the ${HALL_WORDS[pub?.hall ?? 'castle'].court.toLowerCase()}. Answer ${COURT_RIGHT} questions to come back.`);
    else if (mg.danced) toast('💃 Dance tile bonus! +1 crown', true);
  }, [r, mg, pub?.hall, toast]);

  if (!pub || !mg) return <div className="cl-c-center"><p className="cl-c-say">Getting ready…</p></div>;
  const words = HALL_WORDS[pub.hall];

  if (view.state === 'lobby') {
    return (
      <div className="cl-c-center fc-pad-lobby">
        <h1 className="cl-c-title">You're in! Look at the big screen.</h1>
        <div className="fc-pad-me"><AvatarImage avatar={avatar ?? null} size={120} /></div>
        <p className="cl-c-say">Dance round the hall while the music plays. When it stops, run and sit on a throne! There are fewer thrones every round.</p>
        <p className="cl-c-say">Today's hall: <b>{words.name}</b></p>
        <button type="button" className="cl-btn fc-guide-btn" onClick={() => setGuide(true)}>⚡ Power-ups and hazards</button>
        {guide && <ThronesGuide hall={pub.hall} onClose={() => setGuide(false)} />}
      </div>
    );
  }
  if (view.state === 'over') {
    return (
      <div className="cl-c-center">
        <h1 className="cl-c-title">{mg.place === 1 ? '🏆 You won!' : mg.place ? `🥈 Podium place ${mg.place}!` : 'Finished!'}</h1>
        <div className="fc-pad-me"><AvatarImage avatar={avatar ?? null} size={110} /></div>
        <p className="cl-c-say">You finished with <b>{mg.crowns}</b> {mg.crowns === 1 ? 'crown' : 'crowns'} and sat on a throne {mg.sat} {mg.sat === 1 ? 'time' : 'times'}.</p>
        {mg.stats && (
          <ul className="fc-pad-stats">
            {([
              ['🧮', mg.stats.right, 'right answers'],
              ['🔥', mg.stats.bestStreak, 'in a row, best'],
              ['🌟', mg.stats.golden, 'golden thrones'],
              ['💃', mg.stats.dances, 'dance tile bonuses'],
              ['🗡️', mg.stats.steals, 'thrones stolen'],
              ['🎁', mg.stats.grabs, 'power-ups picked up'],
              ['⚡', mg.stats.powers, 'switched on'],
              ['🔓', mg.stats.escapes, `back from the ${words.court.toLowerCase()}`],
            ] as const).filter(([, n]) => n > 0).map(([e, n, w]) => <li key={w}><span aria-hidden="true">{e}</span> <b>{n}</b> {w}</li>)}
          </ul>
        )}
        <p className="cl-c-look">Look at the big screen!</p>
      </div>
    );
  }

  const questionBox = question && (
    <div className={`fc-q ${purpose === 'court' ? 'fc-q--jail' : ''}`}>
      <QuestionModal
        key={question.slot}
        question={{ id: question.slot, parts: question.parts, spoken: question.spoken, prompt: question.prompt, choices: question.choices, choiceLabels: question.choiceLabels, input: question.input, maxLength: question.maxLength }}
        title={purpose === 'court' ? `Get out of the ${words.court.toLowerCase()}` : `Switch on ${mg.held ? POWER_WORDS[mg.held].name : 'your power-up'}`}
        note={purpose === 'court' ? `${mg.courtRight} of ${COURT_RIGHT} right` : 'Answer right to switch it on'}
        spot="Musical Thrones" inline scribble={false} onSubmit={onSubmit} onDone={onDone}
      />
      {purpose === 'power' && <button type="button" className="cl-btn cl-btn--small mt-q-cancel" onClick={() => { setQuestion(null); setPurpose(null); setWantPower(false); }}>Not now: back to dancing</button>}
    </div>
  );
  const toastBox = (
    <div className="cl-c-fb fc-fb" aria-live="polite">
      {say && <div key={say.n} className={`cl-s-card${say.good ? ' cl-s-card--right' : ''}`}><p className="cl-s-card__text">{say.text}</p></div>}
    </div>
  );
  const flashBox = flash && <div key={flash.key} className={`mt-flash mt-flash--${flash.kind}`} role="alert">{flash.text}</div>;
  const roundN = r?.n ?? 0;

  if (court) {
    const done = mg.courtRight >= COURT_RIGHT;
    return (
      <div className="mt-pad">
        <header className="mt-pad__top"><b>🔒 {words.court}</b><span className="mt-crowns" aria-label={`${mg.crowns} crowns`}>👑 <b key={mg.crowns}>{mg.crowns}</b></span><span>Round {roundN}</span></header>
        <div className="fc-pad-me fc-pad-me--jail"><AvatarImage avatar={avatar ?? null} size={96} /><span className="fc-bars" aria-hidden="true" /></div>
        <div className="mt-court-pad">
          <div className="mt-locks" aria-label={`${mg.courtRight} of ${COURT_RIGHT} right`}>
            {Array.from({ length: COURT_RIGHT }, (_, i) => <i key={i} className={i < mg.courtRight ? 'on' : ''}>{i < mg.courtRight ? '🔓' : '🔒'}</i>)}
          </div>
          {done ? (
            <div className="fc-free" role="status">
              <b className="fc-free__word">🔓 You're free!</b>
              {mg.freeAt != null && mg.freeAt > t
                ? <><span className="fc-free__count" key={Math.ceil((mg.freeAt - t) / 1000)}>{Math.ceil((mg.freeAt - t) / 1000)}</span><span className="fc-free__say">seconds until you're back in the game</span></>
                : <span className="fc-free__say">Coming back now. Get ready to dance!</span>}
            </div>
          ) : (
            <>
              <p className="cl-c-say"><b>{mg.courtRight} of {COURT_RIGHT} right.</b> {`Answer ${COURT_RIGHT - mg.courtRight} more right to come back.`}</p>
              <p className="mt-scroll">📜 Get all {COURT_RIGHT} right in a row and you win a <b>Crown thief</b> scroll to steal a throne!</p>
            </>
          )}
          {mg.held && <div className="mt-power mt-power--on"><span className="mt-power__pic mt-power__pic--emoji" aria-hidden="true">{POWER_WORDS[mg.held].emoji}</span><span className="mt-power__words"><b>{POWER_WORDS[mg.held].name} ready</b><span>Keep it for the next round.</span></span></div>}
        </div>
        {toastBox}
        {questionBox}
        {flashBox}
      </div>
    );
  }

  const here = pos.current.p;
  const thrones = (r?.thrones ?? []).map((x) => (refused.current.ids.has(x.id) ? { ...x, taken: true } : x));
  const onChips: { key: string; text: string; cls?: string }[] = [];
  if (mg.steal) onChips.push({ key: 'steal', text: '🗡️ Crown thief ready: run onto a taken throne', cls: 'mt-chip--thief' });
  if (mg.shield) onChips.push({ key: 'shield', text: '🛡️ Royal shield: your throne is safe' });
  if (mg.boost) onChips.push({ key: 'speed', text: '⚡ Speed boots' });
  if (mg.ghost) onChips.push({ key: 'ghost', text: '👻 Ghost: walk through hazards' });
  if (mg.double) onChips.push({ key: 'double', text: '⭐ Double crowns this round' });
  if (mg.seatPower) onChips.push({ key: 'seat', text: '🪑 Royal seat: you will land on a free throne' });
  if (mg.earAt !== null) onChips.push({ key: 'ear', text: '👂 Golden ear: you will be warned', cls: 'mt-chip--ear' });
  const goldenSeat = seated && !!r?.thrones.find((x) => x.id === mg.seat)?.golden;
  const heldPic = mg.held ? thronePowerPic(mg.held as ThronePower) : null;
  return (
    <div className="mt-pad">
      <header className="mt-pad__top">
        <span className="mt-crowns" aria-label={`${mg.crowns} crowns`}>👑 <b key={mg.crowns}>{mg.crowns}</b></span>
        <span className="mt-pad__music">
          {music && <><span aria-hidden="true">🎵</span> Dance! <span className="mt-eq" aria-hidden="true"><i /><i /><i /><i /><i /></span></>}
          {phase === 'scramble' && <b>🪑 SIT!</b>}
          {(phase === 'show' || phase === 'ready') && <b>Look at the big screen!</b>}
        </span>
        <span>Round {roundN}</span>
      </header>
      {mg.held && (
        <div className="mt-power" role="status">
          {heldPic ? <img className="mt-power__pic" src={heldPic} alt="" /> : <span className="mt-power__pic mt-power__pic--emoji" aria-hidden="true">{POWER_WORDS[mg.held].emoji}</span>}
          <span className="mt-power__words">
            <b>{POWER_WORDS[mg.held].name}</b>
            <span>{POWER_WORDS[mg.held].how}</span>
          </span>
          <button type="button" className="cl-btn cl-btn--go" disabled={!music || !!question || seated} onClick={() => setWantPower(true)}>{music ? 'Switch on' : 'Wait…'}</button>
        </div>
      )}
      {onChips.length > 0 && <div className="mt-pad__chips">{onChips.map((c) => <span key={c.key} className={`mt-chip ${c.cls ?? ''}`}>{c.text}</span>)}</div>}
      {seated && <div className="mt-seated" role="status">{goldenSeat ? '👑👑👑 Golden throne! 3 crowns!' : '👑 You got a throne!'}</div>}
      <div className={`mt-pad__board ${Date.now() - shake < 500 ? 'mt-pad__board--hit' : ''}`}>
        <ThronesBoard hall={pub.hall} round={r ? { ...r, thrones } : null} t={t} covered={music} mySeat={mg.seat}>
          {others.current.filter((o) => o.y <= 1).map((o, i) => <span key={i} className="mt-dot" style={{ left: `${o.x * 100}%`, top: `${o.y * 100}%` }} />)}
          <Token x={here.x} y={here.y} size={AVATAR_R * 2.2} className={`mt-token--me ${music ? 'mt-token--dance' : ''} ${seated ? 'mt-token--sit' : ''} ${mg.shield ? 'mt-token--shield' : ''} ${mg.boost ? 'fc-token--fast' : ''} ${mg.ghost ? 'mt-token--ghost' : ''}`} label="You">
            <AvatarImage avatar={avatar ?? null} size={64} />
          </Token>
        </ThronesBoard>
      </div>
      {toastBox}
      {questionBox}
      {canRun && !question && <Joystick onDir={(d) => { stickDir.current = d; }} />}
      {flashBox}
    </div>
  );
}
