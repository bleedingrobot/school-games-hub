/**
 * Ghost Tag, the pupil's device (docs/GHOST-PLAN.md): a joystick (or arrow keys / WASD) moves their own avatar at once;
 * the spot is saved every 0.4 s (0.3 s with someone near; one call at a time, see liveLink `gated`) through `link.ghostMove`, which brings back every other
 * spot with who is a ghost (no names). A big button gets a question: a pupil's right answer makes them invisible for
 * 5 seconds; a ghost's gives a speed dash or a lantern. Running over a power-up grabs it. Never shows anyone's results.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AvatarImage } from '../../avatar/AvatarImage';
import {
  AVATAR_R, GRAB_R, HIDE_MS, MAP_WORDS, POWER_WORDS, speedOf, stepGhost, type GhostMove,
} from '../../../shared/classlive/ghost';
import type { GhostSpots } from '../../../shared/classlive/ghostBot';
import type { Spot } from '../../../shared/classlive/corners';
import type { PlayerView, RoomView } from '../../../shared/classlive/server';
import type { PublicQuestion } from '../../../shared/maths/serverQuestions';
import { QuestionModal, type MarkedAnswer } from '../../maths/QuestionModal';
import { Joystick, useKeys } from './CornersPad';
import { GhostBoard, GhostToken } from './GhostBoard';
import { GhostHelp } from './GhostCard';
import type { ClassLiveLink } from './link';
import './controller.css';

type Mine = Extract<PlayerView['game'], { kind: 'ghost' }>;
type Pub = Extract<RoomView['game'], { kind: 'ghost' }>;
const SEND_MS = 400;
const SEND_NEAR_MS = 300;
const factOf = (q: PublicQuestion, answer: number) => q.parts.map((p) => p.replace(/\?/g, String(answer))).join(' ');

export function GhostPad({ link, room, view, me, setMe, setView, clock, avatar }: {
  link: ClassLiveLink; room: number | null; view: RoomView; me: PlayerView | null;
  setMe: (m: PlayerView) => void; setView: (f: (v: RoomView | null) => RoomView | null) => void;
  clock: () => number;
  avatar?: unknown;
}) {
  const pub: Pub | null = view.game.kind === 'ghost' ? view.game : null;
  const mg: Mine | null = me && me.game.kind === 'ghost' ? me.game : null;
  const r = pub?.round ?? null;
  const keysDir = useKeys();
  const stickDir = useRef<Spot>({ x: 0, y: 0 });
  const pos = useRef<GhostMove>({ p: mg?.spot ?? { x: 0.5, y: 0.8 }, v: { x: 0, y: 0 } });
  const placed = useRef(-1);
  const seen = useRef<GhostSpots | null>(null);
  const lastSent = useRef(0);
  const grabbing = useRef<number | null>(null);
  const [, setFrame] = useState(0);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [say, setSay] = useState<{ n: number; text: string; good?: boolean } | null>(null);
  const [help, setHelp] = useState(false);
  const [flash, setFlash] = useState<{ n: number; kind: 'caught' | 'hide' | 'win' } | null>(null);
  const sayN = useRef(0);
  const asking = useRef(false);
  const pendingMe = useRef<{ me?: PlayerView; view?: RoomView } | null>(null);
  const toast = useCallback((text: string, good?: boolean) => setSay({ n: ++sayN.current, text, good }), []);
  const tNow = () => (view.startedAt === null ? 0 : clock() - view.startedAt);

  if (mg && mg.placed !== placed.current) {
    placed.current = mg.placed;
    pos.current = { p: { ...mg.spot }, v: { x: 0, y: 0 } };
  }
  // The move reply says at once when we've been caught (before our own row arrives): only during this round's hunt, so a
  // reply from the last round can't pull a pupil into the crypt.
  const seenRound = useRef(-1);
  const ghost = !!mg?.ghost || (!!seen.current?.me.ghost && !!r && !r.done && seenRound.current === r.n && tNow() >= r.startAt);
  const live = view.state === 'live' && !!r && !r.done;

  useEffect(() => {
    if (room === null) return;
    let id = 0;
    let last = performance.now();
    const loop = (ts: number) => {
      const dt = ts - last;
      last = ts;
      const t = tNow();
      if (live && r && mg && t >= r.readyAt) {
        const k = keysDir();
        const dir = k.x || k.y ? k : stickDir.current;
        const hitBefore = pos.current.hitAt;
        pos.current = stepGhost(pos.current, dir, dt, r, t, { ghost, speed: speedOf({ ...mg, ghost }, t) });
        if (pos.current.hitAt !== undefined && pos.current.hitAt !== hitBefore && pub) {
          toast(`💥 The ${MAP_WORDS[pub.map].bats.toLowerCase()} knocked you flying!`);
          try { navigator.vibrate?.(200); } catch { /* not on this device */ }
        }
        const p = pos.current.p;
        const near = (seen.current?.spots ?? []).some(([x, y, kind]) => (ghost ? kind === 0 || kind === 3 : kind === 1) && Math.hypot(x - p.x, y - p.y) < 0.25);
        const now = Date.now();
        if (now - lastSent.current >= (near ? SEND_NEAR_MS : SEND_MS)) {
          lastSent.current = now;
          const send = link.ghostMove ?? (async () => null);
          const n = r.n;
          void send(room, p.x, p.y).then((got) => { if (got) { seen.current = got; seenRound.current = n; } }, () => undefined);
        }
        if (!ghost && grabbing.current === null) {
          const it = r.items.find((x) => Math.hypot(x.x - p.x, x.y - p.y) < GRAB_R + AVATAR_R);
          if (it) {
            grabbing.current = it.id;
            void link.move(room, p.x, p.y).then(() => link.send({ action: 'play', room, grab: it.id })).then((out) => {
              const b = out.body as { me?: PlayerView; view?: RoomView };
              if (b.me) setMe(b.me);
              if (b.view) setView(() => b.view as RoomView);
              if (out.status === 200) toast(`${POWER_WORDS[it.power].emoji} ${POWER_WORDS[it.power].name}! ${POWER_WORDS[it.power].how}`, true);
            }, () => undefined).finally(() => { window.setTimeout(() => { grabbing.current = null; }, 600); });
          }
        }
      }
      setFrame((f) => (f + 1) % 1_000_000);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, live, r, mg, ghost, link]);

  // Caught: a big flash and a buzz, once.
  const wasGhost = useRef<boolean | null>(null);
  useEffect(() => {
    if (wasGhost.current === false && ghost && live) {
      setFlash({ n: Date.now(), kind: 'caught' });
      try { navigator.vibrate?.([120, 60, 200]); } catch { /* not on this device */ }
      setQuestion(null);
    }
    wasGhost.current = ghost;
  }, [ghost, live]);
  // A new round: back to who the server says we are.
  const roundN = r?.n ?? 0;
  useEffect(() => { seen.current = null; }, [roundN]);
  // The end of a round: what happened to me.
  const told = useRef(-1);
  useEffect(() => {
    if (!r?.done || !mg || told.current === r.n) return;
    told.current = r.n;
    if (mg.last === 'last') { toast('🏆 You are the last one standing! You win the round!', true); setFlash({ n: Date.now(), kind: 'win' }); }
    else if (mg.last === 'survived') toast('👑 You survived the round!', true);
    else if (mg.last === 'caught') toast('👻 Caught this round. Next round, run!');
    else if (mg.last === 'ghost') toast('👻 Round over. You were a ghost this time.');
  }, [r, mg, toast]);

  const t = tNow();
  const hiddenLeft = mg && !ghost && mg.hideTo > t ? Math.ceil((mg.hideTo - t) / 1000) : 0;
  const frozen = !!mg && ghost && mg.frozenTo > t;
  const canAskNow = live && !!mg && !!r && t >= r.readyAt && t >= mg.nextAt && hiddenLeft === 0 && !frozen;

  const ask = async () => {
    if (!canAskNow || question || asking.current || room === null) return;
    asking.current = true;
    try {
      const out = await link.send({ action: 'ask', room });
      const b = out.body as { question?: PublicQuestion; error?: string };
      if (out.status === 200 && b.question) setQuestion(b.question);
      else toast(b.error ?? 'Try again in a moment.');
    } catch {
      toast('We lost the connection. Try again.');
    } finally {
      asking.current = false;
    }
  };
  // Laptops: Space asks for a question too.
  const askRef = useRef(ask);
  askRef.current = ask;
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key !== ' ' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
      e.preventDefault();
      void askRef.current();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);
  const onSubmit = async (value: number, ms: number): Promise<MarkedAnswer> => {
    const q = question as PublicQuestion;
    let out;
    try {
      out = await link.send({ action: 'answer', room, slot: q.slot, answer: value, ms });
    } catch {
      throw new Error('We lost the connection. Try again.');
    }
    const b = out.body as { right?: boolean; answer?: number; me?: PlayerView; view?: RoomView; gave?: string; error?: string; reason?: string };
    if (out.status !== 200) {
      if (b.reason === 'answered' || b.reason === 'not_now') setQuestion(null);
      throw new Error(String(b.error ?? 'Try again.'));
    }
    pendingMe.current = { me: b.me, view: b.view };
    if (b.right && b.gave === 'hide') setFlash({ n: Date.now(), kind: 'hide' });
    return { correct: b.right === true, fact: factOf(q, b.answer as number), boxBefore: 0, boxAfter: 0, answer: b.answer as number };
  };
  const onDone = () => {
    const next = pendingMe.current;
    pendingMe.current = null;
    if (next?.me) setMe(next.me);
    if (next?.view) setView(() => next.view as RoomView);
    setQuestion(null);
    const now = next?.me?.game.kind === 'ghost' ? next.me.game : null;
    const tt = tNow();
    if (now && !now.ghost && now.hideTo > tt) toast(`✨ Invisible for ${Math.round(HIDE_MS / 1000)} seconds! Ghosts can't catch you.`, true);
    else if (now && now.ghost && now.dashTo > tt) toast('💨 Ghost dash! Zoom after them!', true);
    else if (now && now.ghost && now.lanternTo > tt) toast('🏮 Lantern lit! You can see invisible players near you.', true);
  };

  if (!pub || !mg) return <div className="cl-c-center"><p className="cl-c-say">Getting ready…</p></div>;
  const words = MAP_WORDS[pub.map];

  if (view.state === 'lobby') {
    return (
      <div className="cl-c-center fc-pad-lobby">
        <h1 className="cl-c-title">You're in! Look at the big screen.</h1>
        <div className="fc-pad-me"><AvatarImage avatar={avatar ?? null} size={120} /></div>
        <p className="cl-c-say">Run from the ghosts with the joystick (or the arrow keys). Answer a question to turn invisible!</p>
        <p className="cl-c-say">Tonight's map: <b>{words.name}</b></p>
        <button type="button" className="cl-btn fc-guide-btn" onClick={() => setHelp(true)}>👻 How it works</button>
        {help && <GhostHelp map={pub.map} onClose={() => setHelp(false)} />}
      </div>
    );
  }
  if (view.state === 'over') {
    return (
      <div className="cl-c-center">
        <h1 className="cl-c-title">{mg.place === 1 ? '🏆 You won!' : mg.place ? `🥈 Podium place ${mg.place}!` : 'Finished!'}</h1>
        <div className="fc-pad-me"><AvatarImage avatar={avatar ?? null} size={110} /></div>
        <ul className="fc-pad-stats">
          {([
            ['👑', mg.crowns, 'rounds won'],
            ['👻', mg.tags, 'caught as a ghost'],
            ['✨', mg.stats.vanishes, 'times invisible'],
            ['🧮', mg.stats.right, 'right answers'],
            ['🔥', mg.stats.bestStreak, 'in a row, best'],
            ['🎁', mg.stats.grabs, 'power-ups'],
            ['🏃', mg.stats.aliveS, 'seconds not caught'],
          ] as const).filter(([, n]) => n > 0).map(([e, n, w]) => <li key={w}><span aria-hidden="true">{e}</span> <b>{n}</b> {w}</li>)}
        </ul>
        <p className="cl-c-look">Look at the big screen!</p>
      </div>
    );
  }

  const ready = !!r && t < r.startAt && !r.done;
  const secLeft = r && !r.done && !ready ? Math.max(0, Math.ceil((r.endAt - t) / 1000)) : null;
  const here = pos.current.p;
  const status = !r ? 'Waiting for the round…' : r.done ? 'Round over! Look at the big screen.'
    : ready ? (ghost ? `👻 You're a ghost! Wait in ${words.crypt}…` : `🏃 Run! Ghosts come out in ${Math.ceil((r.startAt - t) / 1000)}…`)
    : ghost ? (frozen ? '❄️ Frozen!' : '👻 Catch the others!') : hiddenLeft ? `✨ Invisible: ${hiddenLeft}` : '🏃 Run from the ghosts!';
  const btnText = ghost ? (frozen ? '❄️ Frozen' : '⚡ Ghost power') : hiddenLeft ? `✨ ${hiddenLeft}` : '✨ Vanish';
  return (
    <div className={`fc-pad fc-pad--run gt-pad ${ghost ? 'gt-pad--ghost' : ''}`}>
      <header className="fc-pad__top">
        <span>Round {roundN}</span>
        <b className={`gt-pad__status ${hiddenLeft ? 'is-hidden' : ''}`}>{status}</b>
        <span>{secLeft !== null ? `⏱️ ${secLeft}` : ''} 👤 {pub.humans}</span>
      </header>
      <div className="fc-pad__powers">
        {mg.shield && !ghost && <span className="fc-chip">🧄 Garlic shield: one ghost bounces off</span>}
        {mg.bootsTo > t && !ghost && <span className="fc-chip">👟 Speed boots</span>}
        {ghost && mg.dashTo > t && <span className="fc-chip">💨 Ghost dash</span>}
        {ghost && mg.lanternTo > t && <span className="fc-chip">🏮 Lantern lit</span>}
      </div>
      <div className="fc-pad__board">
        <GhostBoard map={pub.map} round={r} t={t}>
          {(seen.current?.spots ?? []).map(([x, y, kind], i) => (
            <span key={i} className={`fc-dot gt-dot gt-dot--${kind}`} style={{ left: `${x * 100}%`, top: `${y * 100}%` }}>{kind === 1 || kind === 2 ? '👻' : ''}</span>
          ))}
          <GhostToken x={here.x} y={here.y} size={AVATAR_R * 2.4} ghost={ghost} className={`fc-token--me ${hiddenLeft ? 'gt-token--hidden' : ''} ${frozen ? 'gt-token--frozen' : ''} ${mg.shield && !ghost ? 'fc-token--shield' : ''}`} label="You">
            <AvatarImage avatar={avatar ?? null} size={64} />
          </GhostToken>
        </GhostBoard>
      </div>
      <div className="cl-c-fb fc-fb" aria-live="polite">
        {say && <div key={say.n} className={`cl-s-card${say.good ? ' cl-s-card--right' : ''}`}><p className="cl-s-card__text">{say.text}</p></div>}
      </div>
      {flash && Date.now() - flash.n < 1600 && (
        <div className={`gt-flash gt-flash--${flash.kind}`} key={flash.n} aria-hidden="true">
          {flash.kind === 'caught' ? '👻 BOO! You\'re a ghost!' : flash.kind === 'hide' ? '✨ Poof!' : '🏆'}
        </div>
      )}
      {question && (
        <div className="fc-q">
          <QuestionModal
            key={question.slot}
            question={{ id: question.slot, parts: question.parts, spoken: question.spoken, prompt: question.prompt, choices: question.choices, choiceLabels: question.choiceLabels, input: question.input, maxLength: question.maxLength }}
            title={ghost ? 'Ghost power' : 'Turn invisible'}
            note={ghost ? 'Right: a speed dash or a lantern' : `Right: invisible for ${Math.round(HIDE_MS / 1000)} seconds`}
            spot="Ghost Tag" inline scribble={false} onSubmit={onSubmit} onDone={onDone}
          />
        </div>
      )}
      {live && !question && (
        <div className="gt-controls">
          <button type="button" className={`gt-power ${ghost ? 'gt-power--ghost' : ''}`} disabled={!canAskNow} onClick={() => void ask()} title="Space works too">{btnText}</button>
          <Joystick onDir={(d) => { stickDir.current = d; }} />
        </div>
      )}
    </div>
  );
}
