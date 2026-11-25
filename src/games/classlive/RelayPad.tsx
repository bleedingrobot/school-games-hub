/**
 * Toon Flap Relay, the pupil's device (docs/RELAY-PLAN.md). Flying: the team's lane full size, tap (or Space) to flap,
 * flown here at 60 steps a second; the flap list goes to the server every 0.8 s, which replays it (it never takes the
 * iPad's word for where the bird is). New effects on the team's course: the same flaps are flown again on the new course,
 * as the server does. Not flying: questions one after another (a right answer is a spark), and perks for your own flyer
 * or trouble for another team. Never shows anyone else's results.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { encodeFlaps } from '../../../shared/toonflap/engine';
import {
  FX_WORDS, flyStep, MAX_SPARKS, newFly, relayCourse, TEAM_WORDS, teamCourse, TROUBLES, TURN_STEPS, type Effect, type FlyState, type FxKind,
} from '../../../shared/classlive/relay';
import type { PlayerView, RoomView } from '../../../shared/classlive/server';
import type { PublicQuestion } from '../../../shared/maths/serverQuestions';
import { QuestionModal, type MarkedAnswer } from '../../maths/QuestionModal';
import type { FlyerPose } from '../toonflap/art/art';
import type { ClassLiveLink } from './link';
import { drawLane } from './relayDraw';
import { FxIcon } from './RelayCard';
import './controller.css';
import './relay.css';

type Mine = Extract<PlayerView['game'], { kind: 'relay' }>;
type Pub = Extract<RoomView['game'], { kind: 'relay' }>;
const SEND_MS = 800;
const STEP = 1000 / 60;
const factOf = (q: PublicQuestion, answer: number) => q.parts.map((p) => p.replace(/\?/g, String(answer))).join(' ');
const fxKeyOf = (fx: readonly { id: number; x1: number }[]) => fx.map((e) => `${e.id}:${e.x1.toFixed(2)}`).join(',');

interface Flight {
  n: number;
  s: FlyState;
  flaps: number[];
  fxKey: string;
  effects: Effect[];
  sentAt: number;
  sentT: number;
  posting: boolean;
  over: boolean;
  bumpAt: number;
  flapAt: number;
}

export function RelayPad({ link, room, view, me, setMe, setView, clock }: {
  link: ClassLiveLink; room: number | null; view: RoomView; me: PlayerView | null;
  setMe: (m: PlayerView) => void; setView: (f: (v: RoomView | null) => RoomView | null) => void;
  clock: () => number;
  avatar?: unknown;
}) {
  const pub: Pub | null = view.game.kind === 'relay' ? view.game : null;
  const mg: Mine | null = me && me.game.kind === 'relay' ? me.game : null;
  const r = pub?.race ?? null;
  const [, setFrame] = useState(0);
  const [say, setSay] = useState<{ n: number; text: string; good?: boolean } | null>(null);
  const sayN = useRef(0);
  const toast = useCallback((text: string, good?: boolean) => setSay({ n: ++sayN.current, text, good }), []);
  const tNow = () => (view.startedAt === null ? 0 : clock() - view.startedAt);

  // ---------- flying ----------
  const flying = view.state === 'live' && r && r.endT === null ? mg?.flying ?? null : null;
  const flight = useRef<Flight | null>(null);
  const tapQueued = useRef(false);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const meRef = useRef({ setMe, setView });
  meRef.current = { setMe, setView };

  if (flying && (!flight.current || flight.current.n !== flying.turn.n)) {
    flight.current = { n: flying.turn.n, s: newFly(flying.turn), flaps: [], fxKey: fxKeyOf(flying.effects), effects: flying.effects as Effect[], sentAt: 0, sentT: -1, posting: false, over: false, bumpAt: 0, flapAt: 0 };
  }
  if (!flying && flight.current && !flight.current.over) flight.current.over = true;

  const post = useCallback(async (f: Flight) => {
    if (room === null || f.posting) return;
    f.posting = true;
    f.sentAt = Date.now();
    f.sentT = f.s.t;
    try {
      const out = await link.send({ action: 'play', room, fly: encodeFlaps(f.flaps), turn: f.n, at: f.s.t });
      const b = out.body as { me?: PlayerView; view?: RoomView; done?: boolean; reason?: string };
      if (b.me) meRef.current.setMe(b.me);
      if (b.view) meRef.current.setView(() => b.view as RoomView);
      if (out.status === 200 && b.done) f.over = true;
      if (out.status !== 200 && (b.reason === 'old_turn' || b.reason === 'not_flying' || b.reason === 'not_now')) f.over = true;
    } catch {
      // Sent again in a moment.
    } finally {
      f.posting = false;
    }
  }, [link, room]);

  const flyingN = flying?.turn.n ?? null;
  useEffect(() => {
    if (flyingN === null || !r) return;
    let id = 0;
    let last = performance.now();
    let acc = 0;
    const base = relayCourse(r.n, r.seed);
    let course = teamCourse(base, flight.current?.effects ?? []);
    let courseKey = flight.current?.fxKey ?? '';
    const reduced = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
    const loop = (ts: number) => {
      const f = flight.current;
      acc = Math.min(acc + (ts - last), 250);
      last = ts;
      if (f && !f.over) {
        if (f.fxKey !== courseKey) {
          course = teamCourse(base, f.effects);
          courseKey = f.fxKey;
        }
        while (acc >= STEP) {
          acc -= STEP;
          if (f.s.mode === 'done' || f.s.t >= TURN_STEPS) break;
          const flap = tapQueued.current;
          if (f.s.mode === 'hover' && !flap) { acc = 0; break; }
          tapQueued.current = false;
          if (flap) { f.flaps.push(f.s.t); f.flapAt = ts; }
          const e = flyStep(course, f.effects, f.s, flap);
          if (e === 'bump') {
            f.bumpAt = ts;
            try { navigator.vibrate?.(120); } catch { /* not on this device */ }
          }
        }
        const finished = f.s.mode === 'done' || f.s.t >= TURN_STEPS;
        if (!f.posting && ((Date.now() - f.sentAt >= SEND_MS && (f.s.t !== f.sentT || Date.now() - f.sentAt > 2500)) || (finished && f.sentT !== f.s.t))) void post(f);
        const cv = canvas.current;
        if (cv) {
          const w = cv.clientWidth, h = cv.clientHeight;
          const k = Math.min(2, window.devicePixelRatio || 1);
          if (cv.width !== Math.round(w * k) || cv.height !== Math.round(h * k)) { cv.width = Math.round(w * k); cv.height = Math.round(h * k); }
          const c = cv.getContext('2d');
          if (c && w && h) {
            c.setTransform(k, 0, 0, k, 0, 0);
            const pose: FlyerPose = ts - f.bumpAt < 700 ? 'dizzy' : f.s.mode === 'done' ? 'cheer' : ts - f.flapAt < 220 ? 'up' : 'glide';
            drawLane(c, { course, effects: f.effects, state: f.s, w, h, time: ts / 1000, colour: TEAM_WORDS[mg?.colour ?? 0].colour, reduced, own: true, pose });
          }
        }
      }
      setFrame((x) => (x + 1) % 1_000_000);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyingN, r?.n, r?.seed, post]);

  // New effects on the team's course: fly the same flaps again on the new course (as the server does).
  const fxKey = flying ? fxKeyOf(flying.effects) : '';
  useEffect(() => {
    const f = flight.current;
    if (!flying || !f || f.fxKey === fxKey || !r) return;
    const effects = flying.effects as Effect[];
    const course = teamCourse(relayCourse(r.n, r.seed), effects);
    const s = newFly(flying.turn);
    let k = 0;
    while (s.t < f.s.t && s.mode !== 'done') {
      const flap = f.flaps[k] === s.t;
      if (s.mode === 'hover' && !flap) break;
      if (flap) k++;
      flyStep(course, effects, s, flap);
    }
    f.flaps = f.flaps.slice(0, k);
    f.s = s;
    f.effects = effects;
    f.fxKey = fxKey;
    const fresh = effects.filter((e) => e.x0 > s.x && e.kind !== 'clear');
    const newest = fresh[fresh.length - 1];
    if (newest) toast(`${FX_WORDS[newest.kind].emoji} ${FX_WORDS[newest.kind].name} ahead!`, !TROUBLES.includes(newest.kind as never));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fxKey]);

  const tap = useCallback(() => { tapQueued.current = true; }, []);
  useEffect(() => {
    if (flyingN === null) return;
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'Enter' || e.code === 'KeyW') { e.preventDefault(); tap(); }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [flyingN, tap]);

  // ---------- questions (not flying) ----------
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const asking = useRef(false);
  const pendingMe = useRef<{ me?: PlayerView; view?: RoomView } | null>(null);
  const [askAgain, setAskAgain] = useState(0);
  const wantQuestion = view.state === 'live' && !!r && r.endT === null && !!mg && !mg.flying;
  useEffect(() => {
    if (!wantQuestion || question || asking.current || room === null) return;
    asking.current = true;
    let got = false;
    const go = async () => {
      const out = await link.send({ action: 'ask', room });
      const b = out.body as { question?: PublicQuestion };
      if (out.status === 200 && b.question) { got = true; setQuestion(b.question); }
    };
    void go().catch(() => undefined).finally(() => {
      window.setTimeout(() => { asking.current = false; if (!got) setAskAgain((n) => n + 1); }, got ? 300 : 2000);
    });
  }, [wantQuestion, question, room, link, askAgain]);
  useEffect(() => {
    if (!wantQuestion && question) setQuestion(null);
  }, [wantQuestion, question]);

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
      if (b.reason === 'answered' || b.reason === 'not_now') setQuestion(null);
      throw new Error(String(b.error ?? 'Try again.'));
    }
    pendingMe.current = { me: b.me, view: b.view };
    return { correct: b.right === true, fact: factOf(q, b.answer as number), boxBefore: 0, boxAfter: 0, answer: b.answer as number };
  };
  const onDone = () => {
    const was = mg?.sparks ?? 0;
    const nextMe = pendingMe.current;
    pendingMe.current = null;
    if (nextMe?.me) setMe(nextMe.me);
    if (nextMe?.view) setView(() => nextMe.view as RoomView);
    const now = nextMe?.me?.game.kind === 'relay' ? nextMe.me.game : null;
    if (now && now.sparks > was) toast(`✨ A spark! You have ${now.sparks}.`, true);
    else if (now && now.sparks >= MAX_SPARKS) toast('✨ Your sparks are full. Spend them!', true);
    setQuestion(null);
  };

  const spend = async (kind: FxKind) => {
    if (room === null || !pub) return;
    const out = await link.send({ action: 'play', room, spend: kind }).catch(() => null);
    const b = out?.body as { me?: PlayerView; view?: RoomView; error?: string; to?: number } | undefined;
    if (b?.me) setMe(b.me);
    if (b?.view) setView(() => b.view as RoomView);
    if (out?.status === 200 && typeof b?.to === 'number') {
      const trouble = (TROUBLES as readonly string[]).includes(kind);
      const to = TEAM_WORDS[pub.teams[b.to]?.colour ?? 0].name;
      toast(trouble ? `${FX_WORDS[kind].emoji} ${FX_WORDS[kind].name} sent to ${to} team!` : `${FX_WORDS[kind].emoji} ${FX_WORDS[kind].name} for your flyer!`, true);
    } else if (b?.error) toast(b.error);
  };

  // A clock for cooldowns and countdowns while waiting.
  useEffect(() => {
    if (flyingN !== null) return;
    const id = window.setInterval(() => setFrame((x) => (x + 1) % 1_000_000), 250);
    return () => window.clearInterval(id);
  }, [flyingN]);

  // Told once: a new race's team, your turn now.
  const told = useRef('');
  useEffect(() => {
    if (!r || !mg) return;
    const key = `${r.n}:${mg.colour}`;
    if (told.current === key) return;
    told.current = key;
    toast(`🎨 You're on ${TEAM_WORDS[mg.colour].name} team for race ${r.n}!`, true);
  }, [r, mg, toast]);

  if (!pub || !mg) return <div className="cl-c-center"><p className="cl-c-say">Getting ready…</p></div>;
  const tw = TEAM_WORDS[mg.colour];
  const toastBox = (
    <div className="cl-c-fb fc-fb" aria-live="polite">
      {say && <div key={say.n} className={`cl-s-card${say.good ? ' cl-s-card--right' : ''}`}><p className="cl-s-card__text">{say.text}</p></div>}
    </div>
  );

  if (view.state === 'lobby') {
    return (
      <div className="cl-c-center tr-pad-lobby">
        <h1 className="cl-c-title">You're in! Look at the big screen.</h1>
        <div className="tr-pad-bird" aria-hidden="true">🐦</div>
        <p className="cl-c-say">You'll be put in a colour team. When it's your turn, tap the screen to flap. When it isn't, answer questions to earn sparks!</p>
      </div>
    );
  }
  if (view.state === 'over') {
    return (
      <div className="cl-c-center">
        <h1 className="cl-c-title">{mg.wins > 0 ? `🏆 You won ${mg.wins} ${mg.wins === 1 ? 'race' : 'races'} with your team!` : 'Finished!'}</h1>
        <ul className="fc-pad-stats">
          {([
            ['🐦', mg.flights, mg.flights === 1 ? 'turn flying' : 'turns flying'],
            ['🧮', mg.right, 'right answers'],
            ['✨', mg.perks, 'perks for your flyers'],
            ['🌪️', mg.troubles, 'troubles sent'],
          ] as const).filter(([, n]) => n > 0).map(([e, n, w]) => <li key={w}><span aria-hidden="true">{e}</span> <b>{n}</b> {w}</li>)}
        </ul>
        <p className="cl-c-look">Look at the big screen!</p>
      </div>
    );
  }

  const t = tNow();
  const f = flight.current;
  if (flying && f && r) {
    const left = Math.max(0, Math.ceil((TURN_STEPS - f.s.t) / 60));
    const done = f.over || f.s.mode === 'done' || f.s.t >= TURN_STEPS;
    return (
      <div className="tr-fly" style={{ ['--team' as string]: tw.colour }} onPointerDown={(e) => { e.preventDefault(); tap(); }}>
        <canvas ref={canvas} className="tr-fly__canvas" />
        <header className="tr-fly__top">
          <b>{tw.emoji} {tw.name} team</b>
          <span className={`tr-fly__left ${left <= 5 ? 'is-low' : ''}`} role="timer">{left}s</span>
        </header>
        {f.s.mode === 'hover' && !done && <div className="tr-fly__tap">👆 {f.s.hover === 'bump' ? 'Tap to fly on!' : "It's your turn! Tap to fly!"}</div>}
        {done && <div className="tr-fly__tap tr-fly__tap--done">{f.s.mode === 'done' ? '🪺 You reached the nest!' : '🙌 Great flying! Your next teammate carries on.'}</div>}
        {toastBox}
      </div>
    );
  }

  const nestX = r ? relayCourse(r.n, r.seed).nestX : 1;
  const between = !!r && r.endT !== null;
  const going = !!r && r.endT === null && t >= r.goT;
  const cool = Math.max(0, Math.ceil((mg.coolUntil - t) / 1000));
  const myTeam = pub.teams[mg.team];
  const teamDone = myTeam?.finishT !== null && myTeam?.finishT !== undefined;
  const canSpend = going && cool === 0 && !teamDone && !!myTeam?.flying;
  const status = !r ? 'Get ready…'
    : between ? (r.winner === mg.team ? '🏆 Your team won this race!' : 'Race over! Look at the big screen.')
      : t < r.goT ? `Race ${r.n} starts soon. Find your ${tw.name} team on the big screen!`
        : teamDone ? '🪺 Your team reached the nest!'
          : mg.upNext === 0 ? '🐦 You fly next! Get ready.'
            : mg.upNext !== null ? `You fly after ${mg.upNext} more ${mg.upNext === 1 ? 'turn' : 'turns'}.` : 'Help your flyer!';

  return (
    <div className="fc-pad tr-pad" style={{ ['--team' as string]: tw.colour }}>
      <header className="fc-pad__top tr-pad__top">
        <b>{tw.emoji} {tw.name} team</b>
        <span>{r ? `Race ${r.n} of ${pub.races}` : ''}</span>
      </header>
      <p className="tr-pad__status" role="status">{status}</p>
      {r && (
        <div className="tr-mini" aria-label="Race to the nest">
          {pub.teams.map((tm, i) => (
            <div key={i} className={`tr-mini__row ${i === mg.team ? 'is-mine' : ''}`}>
              <span className="tr-mini__fill" style={{ width: `${Math.min(100, (tm.x / nestX) * 100)}%`, background: TEAM_WORDS[tm.colour].colour }} />
              <span className="tr-mini__nest" aria-hidden="true">🪺</span>
            </div>
          ))}
        </div>
      )}
      <div className="tr-sparks" aria-label={`${mg.sparks} sparks`}>
        <span>✨ Sparks</span>
        {Array.from({ length: MAX_SPARKS }, (_, i) => <i key={i} className={i < mg.sparks ? 'on' : ''} />)}
      </div>
      {r && !between && (
        <div className="tr-spend">
          <div className="tr-spend__row" role="group" aria-label="Perks for your flyer">
            {mg.perksOpen.map((p) => {
              const k = p as FxKind;
              const off = !canSpend || mg.sparks < mg.perkCost;
              return (
                <button key={p} type="button" className="tr-spend__btn" disabled={off} onClick={() => void spend(k)} title={FX_WORDS[k].how}>
                  <FxIcon kind={k} /><span>{FX_WORDS[k].name}</span><small>{mg.perkCost} ✨</small>
                </button>
              );
            })}
          </div>
          <div className="tr-spend__row tr-spend__row--bad" role="group" aria-label="Trouble for another team">
            {TROUBLES.map((k) => {
              const off = !canSpend || mg.sparks < mg.troubleCost || !mg.canTrouble;
              return (
                <button key={k} type="button" className="tr-spend__btn tr-spend__btn--bad" disabled={off} onClick={() => void spend(k)} title={FX_WORDS[k].how}>
                  <FxIcon kind={k} /><span>{FX_WORDS[k].name}</span><small>{mg.troubleCost} ✨</small>
                </button>
              );
            })}
          </div>
          {going && cool > 0 && <p className="tr-spend__note">You can send again in {cool}s.</p>}
          {going && cool === 0 && !mg.canTrouble && mg.sparks >= mg.troubleCost && <p className="tr-spend__note">Every other team is safe for now. Try trouble again soon!</p>}
        </div>
      )}
      {question && (
        <div className="fc-q tr-q">
          <QuestionModal
            key={question.slot}
            question={{ id: question.slot, parts: question.parts, spoken: question.spoken, prompt: question.prompt, choices: question.choices, choiceLabels: question.choiceLabels, input: question.input, maxLength: question.maxLength }}
            title="Earn a spark" note="Each right answer is a spark."
            spot="Toon Flap Relay" inline scribble={false} onSubmit={onSubmit} onDone={onDone}
          />
        </div>
      )}
      {toastBox}
    </div>
  );
}
