/**
 * Glitches, the pupil's device (docs/CREW-PLAN.md): a joystick (or arrow keys / WASD) moves their own avatar; the
 * spot is saved every 0.4 s through `link.crewMove`, which brings back every other spot (first names and colours, no ids; drones marked; fellow
 * Glitches marked only for a Glitch; in the dark only those close by). Crew see their jobs and get a question at a job,
 * a sparking machine or the light switch. Glitches get pretend jobs (hold Work) and a Jam button, no maths (James).
 * In a meeting the device is the secret ballot. A Glitch's and a Crew member's screens look alike from across the room.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AvatarImage } from '../../avatar/AvatarImage';
import {
  AVATAR_R, CONTROL, GRAB_R, LIGHT_R, MACHINES, phaseOf, POWER_WORDS, REACH, speedOf, stepCrew, WORK_MS, type CrewMove, type Purpose,
} from '../../../shared/classlive/crew';
import type { CrewSpots } from '../../../shared/classlive/crewBot';
import type { Spot } from '../../../shared/classlive/corners';
import type { PlayerView, RoomView } from '../../../shared/classlive/server';
import type { PublicQuestion } from '../../../shared/maths/serverQuestions';
import { QuestionModal, type MarkedAnswer } from '../../maths/QuestionModal';
import { Joystick, useKeys } from './CornersPad';
import { CrewBoard, CrewToken } from './CrewBoard';
import { CrewHelp } from './CrewCard';
import { PLAYER_COLOURS } from './StarSky';
import { useEdgeLink } from './edgeLink';
import type { ClassLiveLink } from './link';
import './controller.css';

type Mine = Extract<PlayerView['game'], { kind: 'crew' }>;
type Pub = Extract<RoomView['game'], { kind: 'crew' }>;
const SEND_MS = 400;
const factOf = (q: PublicQuestion, answer: number) => q.parts.map((p) => p.replace(/\?/g, String(answer))).join(' ');
const near = (id: number, p: Spot) => Math.hypot(MACHINES[id].x - p.x, MACHINES[id].y - p.y) <= MACHINES[id].r + REACH;

/** What a right answer here would do, worked out on the device from what it knows (the server checks again). */
function localPurpose(r: NonNullable<Pub['round']>, mg: Mine, p: Spot, t: number): Purpose | null {
  if (mg.glitch) return mg.drone ? { kind: 'drone' } : null;
  if (r.lightsTo > t && near(CONTROL, p)) return { kind: 'lights' };
  const fix = MACHINES.find((mc) => r.machines[mc.id].sparked && near(mc.id, p));
  if (fix) return { kind: 'fix', machine: fix.id };
  const job = MACHINES.find((mc) => mg.jobs.includes(mc.id) && !r.machines[mc.id].sparked && near(mc.id, p));
  return job ? { kind: 'job', machine: job.id } : null;
}

export function CrewPad({ link: baseLink, room, view, me, setMe, setView, clock, avatar }: {
  link: ClassLiveLink; room: number | null; view: RoomView; me: PlayerView | null;
  setMe: (m: PlayerView) => void; setView: (f: (v: RoomView | null) => RoomView | null) => void;
  clock: () => number;
  avatar?: unknown;
}) {
  // Cloudflare rooms send and read spots over a live connection (edgeLink.ts), 10 times a second.
  const link = useEdgeLink(baseLink, room, view.edge);
  const pub: Pub | null = view.game.kind === 'crew' ? view.game : null;
  const mg: Mine | null = me && me.game.kind === 'crew' ? me.game : null;
  const r = pub?.round ?? null;
  const keysDir = useKeys();
  const stickDir = useRef<Spot>({ x: 0, y: 0 });
  const pos = useRef<CrewMove>({ p: mg?.spot ?? { x: 0.5, y: 0.5 } });
  const placed = useRef(-1);
  const seen = useRef<CrewSpots | null>(null);
  const lastSent = useRef(0);
  const grabbing = useRef<number | null>(null);
  const [, setFrame] = useState(0);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [say, setSay] = useState<{ n: number; text: string; good?: boolean } | null>(null);
  const [help, setHelp] = useState(false);
  const [peek, setPeek] = useState(false);
  const [working, setWorking] = useState<{ machine: number; from: number } | null>(null);
  const sayN = useRef(0);
  const asking = useRef(false);
  const pendingMe = useRef<{ me?: PlayerView; view?: RoomView } | null>(null);
  const toast = useCallback((text: string, good?: boolean) => setSay({ n: ++sayN.current, text, good }), []);
  const tNow = () => (view.startedAt === null ? 0 : clock() - view.startedAt);
  const apply = (out: { status: number; body: Record<string, unknown> }) => {
    const b = out.body as { me?: PlayerView; view?: RoomView; error?: string };
    if (b.me) setMe(b.me);
    if (b.view) setView(() => b.view as RoomView);
    return b;
  };

  if (mg && mg.placed !== placed.current) {
    placed.current = mg.placed;
    pos.current = { p: { ...mg.spot } };
  }
  const t0 = tNow();
  const phase = phaseOf(r, t0);
  const working0 = phase === 'work';
  const live = view.state === 'live' && working0;

  useEffect(() => {
    if (room === null) return;
    let id = 0;
    let last = performance.now();
    const loop = (ts: number) => {
      const dt = ts - last;
      last = ts;
      const t = tNow();
      if (live && r && mg) {
        const k = keysDir();
        const dir = k.x || k.y ? k : stickDir.current;
        pos.current = stepCrew(pos.current, question ? { x: 0, y: 0 } : dir, dt, { belts: r.belts, startAt: r.startAt, meeting: r.meeting, done: r.done }, t, { drone: mg.drone, speed: speedOf(mg, t) });
        const p = pos.current.p;
        const now = Date.now();
        if (now - lastSent.current >= (link.sendMs ?? SEND_MS)) {
          lastSent.current = now;
          const send = link.crewMove ?? (async () => null);
          void send(room, p.x, p.y).then((got) => { if (got) seen.current = got; }, () => undefined);
        }
        if (!mg.glitch && !mg.held && !mg.toolkit && grabbing.current === null) {
          const it = r.items.find((x) => Math.hypot(x.x - p.x, x.y - p.y) < GRAB_R + AVATAR_R);
          if (it) {
            grabbing.current = it.id;
            void link.move(room, p.x, p.y).then(() => link.send({ action: 'play', room, grab: it.id })).then((out) => {
              apply(out);
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
  }, [room, live, r, mg, link, question]);

  // A Glitch's pretend job: hold still at the machine while the bar fills, then it's sent.
  useEffect(() => {
    if (!working || room === null) return;
    const id = window.setTimeout(() => {
      setWorking(null);
      if (!near(working.machine, pos.current.p)) { toast('You walked away. Try again!'); return; }
      void link.move(room, pos.current.p.x, pos.current.p.y).then(() => link.send({ action: 'play', room, work: working.machine })).then((out) => {
        const b = apply(out);
        toast(out.status === 200 ? '✅ Job done!' : (b.error ?? 'Try again.'), out.status === 200);
      }, () => undefined);
    }, WORK_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [working, room, link]);

  // What happened, once each: a new round's role card, the meeting, the reveal, the round's end.
  const roundN = r?.n ?? 0;
  useEffect(() => { seen.current = null; setPeek(false); setWorking(null); setQuestion(null); }, [roundN]);
  const meetingAt = r?.meeting?.at ?? null;
  useEffect(() => {
    if (meetingAt === null) return;
    setQuestion(null);
    setWorking(null);
    try { navigator.vibrate?.([200, 80, 200]); } catch { /* not on this device */ }
  }, [meetingAt]);
  const told = useRef(-1);
  useEffect(() => {
    if (!r?.done || !mg || told.current === r.n) return;
    told.current = r.n;
    toast(mg.last === 'won' ? '🏆 Your side won the shift!' : 'Your side lost this shift. Next one!', mg.last === 'won');
  }, [r, mg, toast]);

  const t = t0;
  const here = pos.current.p;
  const purpose = live && r && mg ? localPurpose(r, mg, here, t) : null;
  const canAskNow = !!purpose && !!mg && t >= mg.nextAt && !question;
  const jamMachine = live && r && mg && mg.glitch && !mg.drone ? MACHINES.find((mc) => !r.machines[mc.id].sparked && near(mc.id, here)) : undefined;
  const jamLeft = mg ? Math.max(0, Math.ceil((mg.jamTo - t) / 1000)) : 0;
  const fakeJob = live && mg?.glitch && !mg.drone ? mg.jobs.find((id) => near(id, here)) : undefined;

  const ask = async () => {
    if (!canAskNow || asking.current || room === null) return;
    asking.current = true;
    try {
      await link.move(room, here.x, here.y);
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
  const doJam = async () => {
    if (!jamMachine || room === null) return;
    await link.move(room, here.x, here.y);
    const out = await link.send({ action: 'play', room, jam: jamMachine.id });
    const b = apply(out);
    toast(out.status === 200 ? `🤫 Jammed! The ${jamMachine.name} will spark in a few seconds. Walk away!` : (b.error ?? 'Try again.'), out.status === 200);
  };
  const doLights = async () => {
    if (room === null) return;
    const out = await link.send({ action: 'play', room, lights: true });
    const b = apply(out);
    toast(out.status === 200 ? '🌑 Lights out! The Crew can only see close by.' : (b.error ?? 'Not now.'), out.status === 200);
  };
  const vote = async (pick: string) => {
    if (room === null) return;
    const out = await link.send({ action: 'play', room, vote: pick });
    const b = apply(out);
    if (out.status !== 200) toast(b.error ?? 'Try again.');
  };
  const onSubmit = async (value: number, ms: number): Promise<MarkedAnswer> => {
    const q = question as PublicQuestion;
    let out;
    try {
      await link.move(room as number, pos.current.p.x, pos.current.p.y);
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
    const said: Record<string, string> = { job: '✅ Job done! Power up!', fix: '🔧 Nearly fixed! One more…', mended: '🔧✨ Machine mended!', lights: '💡 One more right answer for the lights!', lights_on: '💡 Lights back on!', drone: '🛸 Beep! The Glitches can jam sooner.' };
    if (b.right && b.gave && said[b.gave]) window.setTimeout(() => toast(said[b.gave as string], true), 50);
    return { correct: b.right === true, fact: factOf(q, b.answer as number), boxBefore: 0, boxAfter: 0, answer: b.answer as number };
  };
  const onDone = () => {
    const next = pendingMe.current;
    pendingMe.current = null;
    if (next?.me) setMe(next.me);
    if (next?.view) setView(() => next.view as RoomView);
    setQuestion(null);
  };

  if (!pub || !mg) return <div className="cl-c-center"><p className="cl-c-say">Getting ready…</p></div>;

  if (view.state === 'lobby') {
    return (
      <div className="cl-c-center fc-pad-lobby">
        <h1 className="cl-c-title">You're in! Look at the big screen.</h1>
        <div className="fc-pad-me"><AvatarImage avatar={avatar ?? null} size={120} /></div>
        {me?.name && <p className="sc-nick">Your factory name: <b>{me.name}</b></p>}
        <p className="cl-c-say">Most of you are Crew, keeping the robot factory running with maths. A few are secret Glitches…</p>
        <button type="button" className="cl-btn fc-guide-btn" onClick={() => setHelp(true)}>🤖 How it works</button>
        {help && <CrewHelp onClose={() => setHelp(false)} />}
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
            ['🏆', mg.wins, 'shifts won'],
            ['📋', mg.stats.jobs, 'jobs done'],
            ['🔧', mg.stats.mends, 'machines mended'],
            ['🔍', mg.stats.detects, 'Glitches found'],
            ['⚡', mg.stats.jams, 'machines jammed'],
            ['🧮', mg.stats.right, 'right answers'],
            ['🔥', mg.stats.bestStreak, 'in a row, best'],
          ] as const).filter(([, n]) => n > 0).map(([e, n, w]) => <li key={w}><span aria-hidden="true">{e}</span> <b>{n}</b> {w}</li>)}
        </ul>
        <p className="cl-c-look">Look at the big screen!</p>
      </div>
    );
  }

  const role = mg.glitch ? (mg.drone ? '🛸⚡ Glitch drone' : '⚡ Glitch') : mg.drone ? '🛸 Crew drone' : '🔧 Crew';
  // The role card, first thing each round (and again when they peek).
  if (r && (phase === 'roles' || peek)) {
    return (
      <div className={`cl-c-center sc-rolecard ${mg.glitch ? 'sc-rolecard--glitch' : 'sc-rolecard--crew'}`} onClick={() => setPeek(false)}>
        <p className="cl-c-say">🤫 Keep it secret!</p>
        <h1 className="cl-c-title">{mg.glitch ? "You're a Glitch!" : "You're Crew!"}</h1>
        <div className="fc-pad-me"><AvatarImage avatar={avatar ?? null} size={120} /></div>
        {me?.name && <p className="sc-nick">You are <b>{me.name}</b></p>}
        <p className="cl-c-say">{mg.glitch ? 'Sneak up to machines and jam them. Pretend to do your jobs so nobody guesses!' : 'Do your jobs, fix sparking machines, and work out who the Glitches are.'}</p>
        {mg.glitch && mg.mates.length > 0 && <p className="cl-c-say">Your fellow {mg.mates.length === 1 ? 'Glitch' : 'Glitches'}: <b>{mg.mates.join(', ')}</b></p>}
        {peek && <button type="button" className="cl-btn" onClick={() => setPeek(false)}>Hide</button>}
      </div>
    );
  }

  const mt = r?.meeting ?? null;
  if (r && mt && (phase === 'talk' || phase === 'vote' || phase === 'reveal')) {
    return (
      <div className="cl-c-center sc-ballot">
        <h1 className="cl-c-title">🚨 Meeting!</h1>
        {phase === 'talk' && <p className="cl-c-say">Talk it over out loud. Voting opens in {Math.max(0, Math.ceil((mt.talkEnd - t) / 1000))} s.</p>}
        {phase === 'vote' && (mg.drone ? <p className="cl-c-say">🛸 Drones don't vote. Watch the big screen!</p> : <p className="cl-c-say">{mg.myVote ? 'Voted! You can change it until the time is up.' : 'Who do you think is a Glitch? Your vote is secret.'} ({Math.max(0, Math.ceil((mt.voteEnd - t) / 1000))} s)</p>)}
        {phase === 'reveal' && <p className="cl-c-title sc-ballot__reveal">{mt.out ? `${mg.outName ?? 'They'} ${mt.glitch ? 'was a Glitch!' : 'was Crew.'}` : 'Nobody was sent off.'}</p>}
        {phase !== 'reveal' && mg.ballot && !mg.drone && (
          <div className="sc-ballot__list" role="group" aria-label="Vote">
            {mg.ballot.map((b) => (
              <button key={b.id} type="button" disabled={phase !== 'vote'} className={`sc-ballot__pick sc-colour--${b.colour} ${mg.myVote === b.id ? 'is-on' : ''}`} aria-pressed={mg.myVote === b.id} onClick={() => void vote(b.id)}>{b.name}</button>
            ))}
            <button type="button" disabled={phase !== 'vote'} className={`sc-ballot__pick sc-ballot__skip ${mg.myVote === 'skip' ? 'is-on' : ''}`} aria-pressed={mg.myVote === 'skip'} onClick={() => void vote('skip')}>Skip</button>
          </div>
        )}
        <div className="cl-c-fb fc-fb" aria-live="polite">
          {say && <div key={say.n} className={`cl-s-card${say.good ? ' cl-s-card--right' : ''}`}><p className="cl-s-card__text">{say.text}</p></div>}
        </div>
      </div>
    );
  }

  const dark = !!r && r.lightsTo > t && !mg.glitch && !mg.drone && mg.cameraTo <= t;
  const secLeft = r && !r.done ? Math.max(0, Math.ceil((r.endAt - t) / 1000)) : null;
  const status = !r ? 'Waiting for the shift…' : r.done ? (r.done.winner === 'crew' ? 'Crew win the shift! 🔧' : 'Glitches win the shift! ⚡')
    : dark ? '🌑 Lights out!' : mg.drone ? '🛸 Drone: keep helping!' : `📋 ${mg.jobs.length} jobs left`;
  const btnText = !purpose ? '🔧 Go to a machine' : purpose.kind === 'fix' ? '🔧 Fix it' : purpose.kind === 'job' ? '📋 Do the job' : purpose.kind === 'lights' ? '💡 Lights on' : '🛸 Help';
  const workPct = working ? Math.min(100, ((Date.now() - working.from) / WORK_MS) * 100) : 0;
  return (
    <div className={`fc-pad fc-pad--run sc-pad ${mg.drone ? 'sc-pad--drone' : ''}`}>
      <header className="fc-pad__top">
        <span>Shift {roundN}</span>
        <b className="gt-pad__status">{status}</b>
        <span>{secLeft !== null ? `⏱️ ${Math.floor(secLeft / 60)}:${String(secLeft % 60).padStart(2, '0')}` : ''}</span>
      </header>
      <div className="fc-pad__powers">
        <button type="button" className="fc-chip sc-peek" onClick={() => setPeek(true)}>🤫 My role</button>
        {me?.name && <span className="fc-chip sc-nick-chip">🤖 {me.name}</span>}
        {mg.drone && <span className="fc-chip">{role}</span>}
        {mg.held && <span className="fc-chip fc-chip--held">{POWER_WORDS[mg.held].emoji} {POWER_WORDS[mg.held].name}: answer to switch it on</span>}
        {mg.toolkit && <span className="fc-chip">🧰 Super toolkit ready</span>}
        {mg.bootsTo > t && <span className="fc-chip">🚀 Rocket boots</span>}
        {mg.cameraTo > t && <span className="fc-chip">📹 Camera on</span>}
        {r && <span className="fc-chip">⚡ {Math.floor(r.power)}%</span>}
      </div>
      <div className="fc-pad__board">
        <CrewBoard round={r} highlight={mg.jobs} dark={dark ? { x: here.x, y: here.y, r: LIGHT_R } : null}>
          {(seen.current?.spots ?? []).map(([x, y, kind, name, colour], i) => (
            <span key={i} className={`fc-dot sc-dot sc-dot--${kind}`} style={{ left: `${x * 100}%`, top: `${y * 100}%`, ...(kind === 0 ? { background: PLAYER_COLOURS[(colour ?? 0) % 12] } : {}) }}>
              {kind === 1 ? '🛸' : ''}
              {name && <small className="sc-dot__name">{name}</small>}
            </span>
          ))}
          <CrewToken x={here.x} y={here.y} size={AVATAR_R * 2.4} drone={mg.drone} className="fc-token--me" label={me?.name ? `You: ${me.name}` : 'You'}>
            <AvatarImage avatar={avatar ?? null} size={64} />
          </CrewToken>
        </CrewBoard>
      </div>
      <div className="cl-c-fb fc-fb" aria-live="polite">
        {say && <div key={say.n} className={`cl-s-card${say.good ? ' cl-s-card--right' : ''}`}><p className="cl-s-card__text">{say.text}</p></div>}
      </div>
      {question && purpose && (
        <div className="fc-q">
          <QuestionModal
            key={question.slot}
            question={{ id: question.slot, parts: question.parts, spoken: question.spoken, prompt: question.prompt, choices: question.choices, choiceLabels: question.choiceLabels, input: question.input, maxLength: question.maxLength }}
            title={purpose.kind === 'fix' ? `Fix the ${MACHINES[purpose.machine].name}` : purpose.kind === 'job' ? `Job: ${MACHINES[purpose.machine].name}` : purpose.kind === 'lights' ? 'Light switch' : 'Drone help'}
            note={purpose.kind === 'job' ? 'Right: power for the factory' : purpose.kind === 'fix' ? 'Right: fills the fix bar' : undefined}
            spot="Glitches" inline scribble={false} onSubmit={onSubmit} onDone={onDone}
          />
        </div>
      )}
      {live && !question && (
        <div className="gt-controls sc-controls">
          {mg.glitch && !mg.drone ? (
            <div className="sc-buttons">
              <button type="button" className="gt-power sc-act" disabled={fakeJob === undefined || !!working} onClick={() => fakeJob !== undefined && setWorking({ machine: fakeJob, from: Date.now() })}>
                {working ? <span className="sc-work"><i style={{ width: `${workPct}%` }} />Working…</span> : '📋 Do the job'}
              </button>
              <button type="button" className="gt-power sc-act sc-act--jam" disabled={!jamMachine || jamLeft > 0} onClick={() => void doJam()}>{jamLeft > 0 ? `⚡ ${jamLeft}` : '⚡ Jam'}</button>
              {mg.canLights && <button type="button" className="gt-power sc-act sc-act--dark" onClick={() => void doLights()}>🌑 Lights out</button>}
            </div>
          ) : (
            <button type="button" className="gt-power sc-act" disabled={!canAskNow} onClick={() => void ask()} title="Space works too">{btnText}</button>
          )}
          <Joystick onDir={(d) => { stickDir.current = d; }} />
        </div>
      )}
    </div>
  );
}
