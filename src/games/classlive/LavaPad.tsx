/**
 * Floor is Lava, the pupil's device (docs/LAVA-PLAN.md): a joystick (or arrow keys / WASD) moves their own avatar at
 * once over the floor; the spot is saved about every 0.4 s (`link.move`), and the other pupils come back as dots (no
 * names). Glowing tiles sink when the countdown ends. Between runs (and on the button any time) a question earns a
 * brick or switches on a held power-up; a brick builds a bridge over lava beside you, two pull a friend off the raft.
 * On the raft: wait for a friend's rescue, or five right answers to climb back. Never shows anyone else's results.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AvatarImage } from '../../avatar/AvatarImage';
import {
  AVATAR_R, buildTarget, GRAB_R, LAVA_POWER_WORDS, LAVA_WORDS, lavaStartSpot, MAX_BRICKS, RAFT_RIGHT, RESCUE_BRICKS, stepLava, type LavaMove, type LavaPower, type Spot,
} from '../../../shared/classlive/lava';
import type { PlayerView, RoomView } from '../../../shared/classlive/server';
import type { PublicQuestion } from '../../../shared/maths/serverQuestions';
import { QuestionModal, type MarkedAnswer } from '../../maths/QuestionModal';
import { Joystick, useKeys } from './CornersPad';
import { LavaBoard, lavaPowerPic, LavaToken } from './LavaBoard';
import { useEdgeLink } from './edgeLink';
import type { ClassLiveLink } from './link';
import './controller.css';

type Mine = Extract<PlayerView['game'], { kind: 'lava' }>;
type Pub = Extract<RoomView['game'], { kind: 'lava' }>;
const SEND_MS = 400;
const factOf = (q: PublicQuestion, answer: number) => q.parts.map((p) => p.replace(/\?/g, String(answer))).join(' ');

export function LavaPad({ link: baseLink, room, view, me, setMe, setView, clock, avatar }: {
  link: ClassLiveLink; room: number | null; view: RoomView; me: PlayerView | null;
  setMe: (m: PlayerView) => void; setView: (f: (v: RoomView | null) => RoomView | null) => void;
  clock: () => number;
  avatar?: unknown;
}) {
  // Cloudflare rooms send and read spots over a live connection (edgeLink.ts), 10 times a second.
  const link = useEdgeLink(baseLink, room, view.edge);
  const pub: Pub | null = view.game.kind === 'lava' ? view.game : null;
  const mg: Mine | null = me && me.game.kind === 'lava' ? me.game : null;
  const r = pub?.round ?? null;
  const keysDir = useKeys();
  const stickDir = useRef<Spot>({ x: 0, y: 0 });
  const pos = useRef<LavaMove>({ p: mg?.spot ?? lavaStartSpot(0), v: { x: 0, y: 0 } });
  const placed = useRef<number>(-1);
  const others = useRef<Spot[]>([]);
  const lastSent = useRef(0);
  const sentAt = useRef<Spot | null>(null);
  const grabbing = useRef<number | null>(null);
  const [, setFrame] = useState(0);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [purpose, setPurpose] = useState<'raft' | 'power' | 'brick' | null>(null);
  const [say, setSay] = useState<{ n: number; text: string; good?: boolean } | null>(null);
  const [shake, setShake] = useState(0);
  const [wantAsk, setWantAsk] = useState(0);
  const sayN = useRef(0);
  const asking = useRef(false);
  const pendingMe = useRef<{ me?: PlayerView; view?: RoomView } | null>(null);
  const toast = useCallback((text: string, good?: boolean) => setSay({ n: ++sayN.current, text, good }), []);
  const tNow = () => (view.startedAt === null ? 0 : clock() - view.startedAt);

  if (mg && mg.placed !== placed.current) {
    placed.current = mg.placed;
    pos.current = { p: { ...mg.spot }, v: { x: 0, y: 0 } };
  }

  const rafted = !!mg?.raft;
  const canRun = !!r && !rafted && view.state === 'live' && !r.ended;
  const world = pub ? { sunk: pub.sunk, round: r } : null;

  useEffect(() => {
    if (room === null || !world) return;
    let id = 0;
    let last = performance.now();
    const loop = (ts: number) => {
      const dt = ts - last;
      last = ts;
      const t = tNow();
      if (canRun && r && t >= r.startAt && t < r.runEnd) {
        const k = keysDir();
        const dir = question ? { x: 0, y: 0 } : k.x || k.y ? k : stickDir.current;
        const hitBefore = pos.current.hitAt;
        pos.current = stepLava(pos.current, dir, dt, world, t, { boost: !!mg?.boost, boots: !!mg?.boots });
        if (pos.current.hitAt !== undefined && pos.current.hitAt !== hitBefore && pub) {
          toast(`💥 The ${LAVA_WORDS[pub.map].fireball.toLowerCase()} knocked you flying!`);
          try { navigator.vibrate?.(200); } catch { /* not on this device */ }
          setShake(Date.now());
        }
        const moved = !sentAt.current || Math.hypot(pos.current.p.x - sentAt.current.x, pos.current.p.y - sentAt.current.y) > 0.002;
        const now = Date.now();
        if ((moved && now - lastSent.current >= (link.sendMs ?? SEND_MS)) || now - lastSent.current > 2000) {
          lastSent.current = now;
          sentAt.current = { ...pos.current.p };
          const p = pos.current.p;
          void link.move(room, p.x, p.y).then((all) => { if (all) others.current = all; }, () => undefined);
        }
        if (!mg?.held && grabbing.current === null) {
          const it = r.items.find((x) => Math.hypot(x.x - pos.current.p.x, x.y - pos.current.p.y) < GRAB_R + AVATAR_R);
          if (it) {
            grabbing.current = it.id;
            const p = pos.current.p;
            void link.move(room, p.x, p.y).then(() => link.send({ action: 'play', room, grab: it.id })).then((out) => {
              const b = out.body as { me?: PlayerView; view?: RoomView };
              if (b.me) setMe(b.me);
              if (b.view) setView(() => b.view as RoomView);
              if (out.status === 200 && b.me?.game.kind === 'lava' && b.me.game.held) toast(`${LAVA_POWER_WORDS[b.me.game.held].emoji} Got ${LAVA_POWER_WORDS[b.me.game.held].name}! Tap “Switch it on” and answer a question.`, true);
            }, () => undefined).finally(() => { window.setTimeout(() => { grabbing.current = null; }, 600); });
          }
        }
      } else if (canRun && r && t >= r.runEnd && sentAt.current && Math.hypot(pos.current.p.x - sentAt.current.x, pos.current.p.y - sentAt.current.y) > 0.001 && Date.now() - lastSent.current > 120) {
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
  }, [room, canRun, r, pub?.sunk, mg?.boost, mg?.boots, mg?.held, link, question]);

  // Questions: on the raft (until 5 right), and between runs (a brick, or switching on a held power-up); during a run only
  // when the pupil taps the button (they need their hands for the joystick).
  const t = tNow();
  const between = !!r && (r.ended || t >= r.runEnd);
  const wantQuestion = view.state === 'live' && !!r && !!mg && (rafted
    ? mg.raftRight < RAFT_RIGHT
    : (between && (!!mg.held || mg.bricks < MAX_BRICKS)) || wantAsk > 0);
  const [askAgain, setAskAgain] = useState(0);
  useEffect(() => {
    if (!wantQuestion || question || asking.current || room === null) return;
    asking.current = true;
    let got = false;
    const go = async () => {
      if (!rafted) await link.move(room, pos.current.p.x, pos.current.p.y).catch(() => null);
      const out = await link.send({ action: 'ask', room });
      const b = out.body as { question?: PublicQuestion; purpose?: 'raft' | 'power' | 'brick' };
      if (out.status === 200 && b.question) { got = true; setQuestion(b.question); setPurpose(b.purpose ?? null); }
      else if (wantAsk) setWantAsk(0);
    };
    void go().catch(() => undefined).finally(() => {
      window.setTimeout(() => { asking.current = false; if (!got && (rafted || between)) setAskAgain((n) => n + 1); }, got ? 600 : 2000);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantQuestion, question, room, link, rafted, askAgain]);
  // A raft question goes once they are off the raft. A brick or power question asked between runs goes when the next run
  // starts (the pupil needs the joystick; the same question comes back later, the server keeps it open), unless they
  // tapped the button for it.
  const running = !!r && !r.ended && t >= r.startAt && t < r.runEnd;
  useEffect(() => {
    if (question && ((purpose === 'raft' && !rafted) || (rafted && (mg?.raftRight ?? 0) >= RAFT_RIGHT))) { setQuestion(null); setPurpose(null); }
    else if (question && !rafted && running && wantAsk === 0) { setQuestion(null); setPurpose(null); }
  }, [question, purpose, rafted, running, wantAsk, mg?.raftRight]);

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
      if (b.reason === 'answered' || b.reason === 'not_now') { setQuestion(null); setPurpose(null); setWantAsk(0); }
      throw new Error(String(b.error ?? 'Try again.'));
    }
    pendingMe.current = { me: b.me, view: b.view };
    return { correct: b.right === true, fact: factOf(q, b.answer as number), boxBefore: 0, boxAfter: 0, answer: b.answer as number };
  };
  const onDone = () => {
    const was = mg;
    const nextMe = pendingMe.current;
    pendingMe.current = null;
    if (nextMe?.me) setMe(nextMe.me);
    if (nextMe?.view) setView(() => nextMe.view as RoomView);
    setQuestion(null);
    setPurpose(null);
    setWantAsk(0);
    const now = nextMe?.me?.game.kind === 'lava' ? nextMe.me.game : null;
    if (!now) return;
    if (was?.held && !now.held) toast(`${LAVA_POWER_WORDS[was.held].emoji} ${LAVA_POWER_WORDS[was.held].name} is on! ${LAVA_POWER_WORDS[was.held].how}`, true);
    else if (now.raft && now.raftRight > (was?.raftRight ?? 0)) toast(now.raftRight >= RAFT_RIGHT ? '🧗 You can climb back next round!' : `🪜 ${now.raftRight} of ${RAFT_RIGHT}!`, true);
    else if (now.bricks > (was?.bricks ?? 0)) toast(`🧱 A brick! You have ${now.bricks}.`, true);
  };

  const told = useRef('');
  useEffect(() => {
    if (!r || !r.ended || !mg) return;
    const key = `${r.n}`;
    if (told.current === key) return;
    told.current = key;
    if (mg.fellLast) {
      toast(`💦 Splash! You're on the ${LAVA_WORDS[pub?.map ?? 'volcano'].raft.toLowerCase()}. Answer ${RAFT_RIGHT} questions to climb back.`);
      try { navigator.vibrate?.(300); } catch { /* not on this device */ }
      setShake(Date.now());
    } else if (mg.bootedLast) toast('🥾 Your Fire boots saved you!', true);
    else if (!mg.raft) toast('✅ Still standing!', true);
  }, [r, mg, pub?.map, toast]);

  const act = async (body: Record<string, unknown>, good: string) => {
    if (room === null) return;
    await link.move(room, pos.current.p.x, pos.current.p.y).catch(() => null);
    const out = await link.send({ action: 'play', room, ...body }).catch(() => null);
    const b = out?.body as { me?: PlayerView; view?: RoomView; error?: string } | undefined;
    if (b?.me) setMe(b.me);
    if (b?.view) setView(() => b.view as RoomView);
    if (out?.status === 200) toast(good, true);
    else if (b?.error) toast(b.error);
  };

  if (!pub || !mg) return <div className="cl-c-center"><p className="cl-c-say">Getting ready…</p></div>;
  const words = LAVA_WORDS[pub.map];

  if (view.state === 'lobby') {
    return (
      <div className="cl-c-center fc-pad-lobby">
        <h1 className="cl-c-title">You're in! Look at the big screen.</h1>
        <div className="fc-pad-me"><AvatarImage avatar={avatar ?? null} size={120} /></div>
        <p className="cl-c-say">The floor is lava! When tiles glow, run off them with the joystick (or the arrow keys) before the countdown ends.</p>
        <p className="cl-c-say">Today's map: <b>{words.name}</b></p>
      </div>
    );
  }
  if (view.state === 'over') {
    return (
      <div className="cl-c-center">
        <h1 className="cl-c-title">{mg.place === 1 ? '🏆 You won!' : mg.place ? `🥈 Podium place ${mg.place}!` : 'Finished!'}</h1>
        <div className="fc-pad-me"><AvatarImage avatar={avatar ?? null} size={110} /></div>
        <p className="cl-c-say">You stayed up {mg.up} {mg.up === 1 ? 'round' : 'rounds'}{mg.score > mg.up ? ` and scored ${mg.score} with Double stars` : ''}.</p>
        <ul className="fc-pad-stats">
          {([
            ['🧮', mg.stats.right, 'right answers'],
            ['🔥', mg.stats.bestStreak, 'in a row, best'],
            ['🧱', mg.stats.built, 'bridges built'],
            ['🛟', mg.stats.rescues, 'friends rescued'],
            ['🎁', mg.stats.grabs, 'power-ups picked up'],
            ['🧗', mg.stats.climbs, 'climbs back'],
          ] as const).filter(([, n]) => n > 0).map(([e, n, w]) => <li key={w}><span aria-hidden="true">{e}</span> <b>{n}</b> {w}</li>)}
        </ul>
        <p className="cl-c-look">Look at the big screen!</p>
      </div>
    );
  }

  const left = r && !r.ended ? Math.max(0, Math.ceil((r.runEnd - t) / 1000)) : null;
  const titles = { raft: `Climb off the ${words.raft.toLowerCase()}`, power: `Switch on ${mg.held ? LAVA_POWER_WORDS[mg.held].name : 'your power-up'}`, brick: 'Earn a brick' };
  const notes = { raft: `${mg.raftRight} of ${RAFT_RIGHT} right`, power: 'Answer right to switch it on', brick: `Bricks build bridges. You have ${mg.bricks}.` };
  // What the open question is for now (a pupil can fall in with a brick question open: it then counts for the raft).
  const shownPurpose: 'raft' | 'power' | 'brick' = rafted ? 'raft' : mg.held ? 'power' : 'brick';
  const questionBox = question && purpose && (
    <div className={`fc-q ${shownPurpose === 'raft' ? 'fc-q--jail' : ''}`}>
      <QuestionModal
        key={question.slot}
        question={{ id: question.slot, parts: question.parts, spoken: question.spoken, prompt: question.prompt, choices: question.choices, choiceLabels: question.choiceLabels, input: question.input, maxLength: question.maxLength }}
        title={titles[shownPurpose]} note={notes[shownPurpose]}
        spot="Floor is Lava" inline scribble={false} onSubmit={onSubmit} onDone={onDone}
      />
    </div>
  );
  const toastBox = (
    <div className="cl-c-fb fc-fb" aria-live="polite">
      {say && <div key={say.n} className={`cl-s-card${say.good ? ' cl-s-card--right' : ''}`}><p className="cl-s-card__text">{say.text}</p></div>}
    </div>
  );

  if (rafted) {
    return (
      <div className="fc-pad fc-pad--jail lv-pad-raft">
        <header className="fc-pad__top"><b>🛶 {words.raft}</b><span>Round {r?.n ?? 0}</span></header>
        <div className="fc-pad-me fc-pad-me--jail"><AvatarImage avatar={avatar ?? null} size={96} /></div>
        <div className="fc-locks" aria-label={`${mg.raftRight} of ${RAFT_RIGHT} right`}>
          {Array.from({ length: RAFT_RIGHT }, (_, i) => <i key={i} className={i < mg.raftRight ? 'on' : ''}>{i < mg.raftRight ? '🪜' : '🔥'}</i>)}
        </div>
        {mg.raftRight >= RAFT_RIGHT ? (
          <div className="fc-free" role="status">
            <b className="fc-free__word">🧗 Climbing back!</b>
            {mg.climbAt != null && mg.climbAt > t
              ? <><span className="fc-free__count" key={Math.ceil((mg.climbAt - t) / 1000)}>{Math.ceil((mg.climbAt - t) / 1000)}</span><span className="fc-free__say">seconds until you're back on the floor</span></>
              : <span className="fc-free__say">Back on the floor now. Get ready to run!</span>}
          </div>
        ) : <p className="cl-c-say">{`Answer ${RAFT_RIGHT - mg.raftRight} more right to climb back. A friend with bricks can rescue you too!`}</p>}
        {toastBox}
        {questionBox}
      </div>
    );
  }

  const here = pos.current.p;
  const target = mg.bricks > 0 && r ? buildTarget({ sunk: pub.sunk }, { n: r.n, fell: r.ended ? [] : null }, here) : null;
  const canAnswer = !question && (!!mg.held || mg.bricks < MAX_BRICKS);
  return (
    <div className="fc-pad fc-pad--run lv-pad">
      <header className="fc-pad__top">
        <span>Round {r?.n ?? 0}</span>
        {left !== null ? <b className={`fc-pad__left ${left <= 3 ? 'is-low' : ''}`}>{left}</b> : <b>🌋 Look at the big screen!</b>}
        <span>✅ {mg.up}</span>
      </header>
      <div className="fc-pad__powers">
        <span className="lv-bricks" aria-label={`${mg.bricks} bricks`}>🧱 {Array.from({ length: MAX_BRICKS }, (_, i) => <i key={i} className={i < mg.bricks ? 'on' : ''} />)}</span>
        {mg.held && <PowerCard power={mg.held} state="held" text={`In your pocket! Tap “Switch it on” and answer a question. ${LAVA_POWER_WORDS[mg.held].how}`} />}
        {mg.boots && <PowerCard power="boots" state="on" text="Walk on lava this round: you can't fall in." />}
        {mg.boost && <PowerCard power="speed" state="on" text={`You run faster: ${mg.speedLeft > 1 ? `this round and ${mg.speedLeft - 1} more` : 'last round of it'}.`} />}
        {mg.double && <PowerCard power="double" state="on" text="Stay up this round to score 2 points." />}
        <div className="lv-pad__bar">
          {canAnswer && <button type="button" className="lv-btn" onClick={() => setWantAsk((n) => n + 1)}>{mg.held ? '⚡ Switch it on' : '🧮 Earn a brick'}</button>}
          {target !== null && <button type="button" className="lv-btn lv-btn--build" onClick={() => void act({ build: target }, '🧱 Bridge built!')}>🧱 Build a bridge</button>}
          {mg.bricks >= RESCUE_BRICKS && pub.rafted > 0 && <button type="button" className="lv-btn lv-btn--rescue" onClick={() => void act({ rescue: true }, '🛟 You rescued a friend!')}>🛟 Rescue a friend ({RESCUE_BRICKS} 🧱)</button>}
        </div>
      </div>
      <div className={`fc-pad__board ${Date.now() - shake < 500 ? 'fc-pad__board--hit' : ''}`}>
        <LavaBoard map={pub.map} sunk={pub.sunk} round={r} t={t} target={target} onTile={(i) => void act({ build: i }, '🧱 Bridge built!')}>
          {others.current.map((o, i) => <span key={i} className="fc-dot" style={{ left: `${o.x * 100}%`, top: `${o.y * 100}%` }} />)}
          <LavaToken x={here.x} y={here.y} size={AVATAR_R * 2.4} className={`fc-token--me ${mg.boots ? 'lv-token--boots' : ''} ${mg.boost ? 'fc-token--fast' : ''}`} label="You">
            <AvatarImage avatar={avatar ?? null} size={64} />
          </LavaToken>
        </LavaBoard>
      </div>
      {toastBox}
      {questionBox}
      {canRun && !question && <Joystick onDir={(d) => { stickDir.current = d; }} />}
    </div>
  );
}

function PowerCard({ power, state, text }: { power: LavaPower; state: 'held' | 'on'; text: string }) {
  const pic = lavaPowerPic(power);
  return (
    <div className={`fc-power fc-power--${state}`} role="status">
      {pic ? <img className="fc-power__pic" src={pic} alt="" /> : <span className="fc-power__pic fc-power__pic--emoji" aria-hidden="true">{LAVA_POWER_WORDS[power].emoji}</span>}
      <span className="fc-power__words">
        <b>{state === 'on' ? `${LAVA_POWER_WORDS[power].name} ON` : LAVA_POWER_WORDS[power].name}</b>
        <span>{text}</span>
      </span>
    </div>
  );
}
